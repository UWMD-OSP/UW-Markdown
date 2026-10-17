"""Independent Format 4.3 lease clauses and settled CAM recovery checks.

No escalation/remedy is applied, no cap history inferred, and no pool allocation
or future cash flow generated. Only the author's stated facts are compared.
"""
from uwmd_binding_sources import finite
from uwmd_numeric import calendar_date, quantize
from uwmd_text import nonblank
from uwmd_validation_selection import current_blocks

_POOL = ("real_estate_taxes", "insurance", "management_fees", "payroll_benefits",
         "utilities", "repairs_maintenance", "contract_services", "marketing_advertising",
         "administrative", "professional_fees", "other_expenses")


def _whole(value):
    return finite(value) and value >= 0 and int(value) == value


def _nonnegative(value):
    return finite(value) and value >= 0


def _money(a, b):
    return finite(a) and finite(b) and quantize(a, 2) == quantize(b, 2)


def lease_rules(ledger):
    document = ledger.document
    current_cash = {dict(b.attributes).get("variant") for b in current_blocks(document, "cash_flow_series", include_external=True)}
    for block in current_blocks(document, "rent_roll"):
        roll = block.parsed.value
        tenants = roll.get("tenants")
        if not isinstance(tenants, list):
            continue
        for ordinal, tenant in enumerate(tenants):
            if not isinstance(tenant, dict):
                continue
            root = "tenants[" + str(ordinal) + "]"
            def issue(code, suffix, message):
                ledger.issue(code, "error", "rent_roll", root + ("." + suffix if suffix else ""), message)
            start, end = tenant.get("lease_commencement"), tenant.get("lease_expiration")
            term = calendar_date(start) and calendar_date(end)
            schedule = tenant.get("escalation_schedule")
            if schedule is not None:
                if tenant.get("escalation_type") in (None, "none"):
                    issue("LSE-03", "escalation_type", "Stated steps require a non-flat escalation type")
                if not isinstance(schedule, list) or not schedule:
                    issue("LSE-01", "escalation_schedule", "Escalation schedule must be a nonempty step array")
                else:
                    previous = None
                    for i, step in enumerate(schedule):
                        path = "escalation_schedule[" + str(i) + "]"
                        if not isinstance(step, dict):
                            issue("LSE-01", path, "Step must be an object")
                            continue
                        date = step.get("effective_date")
                        valid = calendar_date(date) and _nonnegative(step.get("base_rent_annual"))
                        valid = valid and set(step) <= {"effective_date", "base_rent_annual"}
                        if not valid or previous is not None and calendar_date(date) and date <= previous:
                            issue("LSE-01", path, "Steps require real increasing dates and finite nonnegative resulting rent")
                        if calendar_date(date):
                            if term and not start <= date <= end:
                                issue("LSE-02", path + ".effective_date", "Step lies outside the stated lease term")
                            previous = date
            termination = tenant.get("termination_option")
            if termination is not None:
                if not isinstance(termination, dict):
                    issue("LSE-04", "termination_option", "Termination option must be an object")
                else:
                    date, notice, penalty = termination.get("earliest_date"), termination.get("notice_months"), termination.get("penalty")
                    valid = calendar_date(date) and _whole(notice) and (penalty is None or _nonnegative(penalty))
                    valid = valid and (not term or start <= date <= end)
                    if not valid:
                        issue("LSE-04", "termination_option", "Termination date, notice or stated penalty is invalid")
                    included = termination.get("penalty_includes")
                    if included is not None:
                        if (not isinstance(included, list) or not included
                                or any(x not in ("unamortized_ti", "unamortized_lc", "free_rent", "fee") for x in included)
                                or len({x for x in included if isinstance(x, str)}) != len(included)):
                            issue("LSE-05", "termination_option.penalty_includes", "Penalty components must be unique admitted values")
            details, clause = tenant.get("co_tenancy_details"), tenant.get("co_tenancy_clause")
            if (details is not None and clause is not True) or (clause is True and not isinstance(details, dict)):
                issue("LSE-06", "co_tenancy_details", "Co-tenancy flag and details must agree")
            if isinstance(details, dict):
                trigger = details.get("trigger")
                valid = trigger in ("named_tenant_departure", "occupancy_threshold", "both")
                if trigger in ("named_tenant_departure", "both"):
                    names = details.get("named_cotenants")
                    valid = valid and isinstance(names, list) and bool(names) and all(nonblank(x) for x in names)
                if trigger in ("occupancy_threshold", "both"):
                    value = details.get("occupancy_threshold")
                    valid = valid and finite(value) and 0 < value < 1
                if details.get("cure_period_months") is not None:
                    valid = valid and _whole(details["cure_period_months"])
                if not valid:
                    issue("LSE-07", "co_tenancy_details", "Trigger companions or cure period are invalid")
                remedy, value = details.get("remedy"), details.get("remedy_value")
                valid = (remedy == "rent_reduction" and finite(value) and 0 < value <= 1
                         or remedy == "alternate_rent" and _nonnegative(value)
                         or remedy == "termination_right" and value is None)
                if not valid:
                    issue("LSE-08", "co_tenancy_details.remedy_value", "Remedy and its stated value must agree")
            for original, outstanding in (("ti_allowance_original", "ti_outstanding_balance"), ("lc_original", "lc_outstanding_balance")):
                a, b = tenant.get(original), tenant.get(outstanding)
                if ((a is not None and not _nonnegative(a)) or (b is not None and not _nonnegative(b))
                        or finite(a) and finite(b) and b > a):
                    issue("LSE-09", outstanding, "Outstanding TI/LC must be nonnegative and not exceed its stated original")
            terms = tenant.get("recovery_terms")
            if terms is not None and not isinstance(terms, dict):
                issue("REC-02", "recovery_terms", "Recovery terms must be an object")
                terms = {}
            terms = terms or {}
            share, cap = terms.get("pro_rata_share"), terms.get("cap")
            cap = cap if isinstance(cap, dict) else {}
            pct, method = cap.get("pct"), terms.get("method")
            if ((share is not None and (not finite(share) or not 0 < share <= 1))
                    or pct is not None and (not finite(pct) or not 0 < pct < 1)):
                issue("REC-01", "recovery_terms", "Recovery shares and cap rates must be fractions in their admitted ranges")
            method_needed = any(value is not None for key, value in terms.items() if key not in ("method", "cap"))
            valid = (not method_needed or method is not None)
            if method is not None:
                valid = valid and method in ("net", "base_year_stop", "fixed_stop", "fixed_amount", "none")
                required = {"base_year_stop": "base_year", "fixed_stop": "expense_stop_per_sqft", "fixed_amount": "fixed_recovery_annual"}.get(method) if isinstance(method, str) else None
                if required:
                    value = terms.get(required)
                    valid = valid and finite(value) and (int(value) == value if required == "base_year" else value >= 0)
                if pct is not None:
                    valid = valid and cap.get("accumulation") in ("cumulative", "non_cumulative", "compounding")
            if cap.get("accumulation") is not None and cap["accumulation"] not in ("cumulative", "non_cumulative", "compounding"):
                valid = False
            if cap.get("over") is not None and cap["over"] not in ("base_year", "prior_year"):
                valid = False
            if method_needed and method is None:
                issue("REC-02", "recovery_terms.method", "A stated recovery member requires its method")
            if not valid:
                issue("REC-02", "recovery_terms", "Recovery method, required companions or stated cap treatment is invalid")
            pool = terms.get("recoverable_pool")
            if pool is not None and (not isinstance(pool, list) or not pool or any(k not in _POOL for k in pool)):
                issue("REC-03", "recovery_terms.recoverable_pool", "Pool must name registered operating-expense keys, never totals/ratios/capital")
            true_up = tenant.get("recovery_true_up")
            if true_up is None:
                continue
            if not isinstance(true_up, list):
                issue("REC-04", "recovery_true_up", "Recovery true-up must be an array")
                continue
            for index, row in enumerate(true_up):
                path = "recovery_true_up[" + str(index) + "]"
                if not isinstance(row, dict):
                    issue("REC-04", path, "True-up must state its closed period")
                    continue
                beginning, finish = row.get("period_start"), row.get("period_end")
                valid = calendar_date(beginning) and calendar_date(finish) and beginning <= finish
                valid = valid and row.get("settlement") in (None, "billed", "credited", "disputed", "unsettled")
                if not valid:
                    issue("REC-04", path, "True-up period dates or settlement are invalid")
                if calendar_date(finish) and calendar_date(roll.get("as_of_date")) and finish >= roll["as_of_date"]:
                    issue("REC-05", path + ".period_end", "True-up period must have closed before the stated roll date")
                pool_actual, uncapped = row.get("pool_actual"), row.get("tenant_share_uncapped")
                if all(v is not None for v in (pool_actual, share, uncapped)):
                    product = pool_actual * share if finite(pool_actual) and finite(share) else None
                    if not _money(uncapped, product):
                        issue("REC-06", path + ".tenant_share_uncapped", "Uncapped tenant share does not equal the stated pool times stated share")
                capped, billed, amount = row.get("tenant_share_capped"), row.get("estimated_billed"), row.get("true_up_amount")
                if finite(capped) and finite(uncapped) and capped > uncapped:
                    issue("REC-07", path + ".tenant_share_capped", "A recovery cap cannot increase the stated uncapped amount")
                if all(v is not None for v in (capped, billed, amount)):
                    expected = capped - billed if finite(capped) and finite(billed) else None
                    if not _money(amount, expected):
                        issue("REC-08", path + ".true_up_amount", "True-up does not equal capped share less billed estimate")
                reference = row.get("cash_flow_ref")
                if reference is not None and (not isinstance(reference, dict) or not isinstance(reference.get("variant"), str) or reference["variant"] not in current_cash):
                    issue("REC-09", path + ".cash_flow_ref", "Cash-flow reference must name a current exact variant")
