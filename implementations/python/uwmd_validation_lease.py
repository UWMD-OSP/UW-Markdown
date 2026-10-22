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


def _co_tenancy_rules(tenant, issue):
    """Admit this clause in RFC0055 order; independent tenant rules still run."""
    details, flag = tenant.get("co_tenancy_details"), tenant.get("co_tenancy_clause")
    if details is not None and flag is not True:
        issue("LSE-06", "co_tenancy_clause", "Stated co-tenancy details require a true clause flag")
        return
    if details is None:
        if flag is True:
            issue("LSE-06", "co_tenancy_details", "A true clause flag requires co-tenancy details")
        return
    if not isinstance(details, dict):
        issue("LSE-06", "co_tenancy_details", "Stated co-tenancy details must be an object")
        return
    root = "co_tenancy_details."
    trigger = details.get("trigger")
    if trigger not in ("named_tenant_departure", "occupancy_threshold", "both"):
        issue("LSE-07", root + "trigger", "Co-tenancy trigger must use its closed vocabulary")
        return
    if trigger in ("named_tenant_departure", "both"):
        names = details.get("named_cotenants")
        # RFC0055 requires nonempty strings, not trimmed/nonblank names.
        if not isinstance(names, list) or not names or any(not isinstance(name, str) or not name for name in names):
            issue("LSE-07", root + "named_cotenants", "The named trigger requires a nonempty list of nonempty names")
    if trigger in ("occupancy_threshold", "both"):
        threshold = details.get("occupancy_threshold")
        if not finite(threshold) or not 0 < threshold < 1:
            issue("LSE-07", root + "occupancy_threshold", "The occupancy trigger requires a fraction strictly between zero and one")
    remedy, value = details.get("remedy"), details.get("remedy_value")
    if remedy not in ("rent_reduction", "alternate_rent", "termination_right"):
        issue("LSE-08", root + "remedy", "Co-tenancy remedy must use its closed vocabulary")
        return
    if (remedy == "termination_right" and value is not None
            or remedy == "rent_reduction" and (not finite(value) or not 0 < value <= 1)
            or remedy == "alternate_rent" and not _nonnegative(value)):
        issue("LSE-08", root + "remedy_value", "The remedy and its stated value must agree")
    cure = details.get("cure_period_months")
    # Unlike termination notice_months, this accepted domain has no safe-integer ceiling.
    if cure is not None and not _whole(cure):
        issue("LSE-07", root + "cure_period_months", "Cure period must be a nonnegative whole number of months")


def lease_rules(ledger):
    document = ledger.document
    represented = {}
    physical = {id(block): index for index, block in enumerate(document.source.blocks)}
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
            def issue(code, suffix, message, **evidence):
                if code in ("REC-02", "REC-03", "REC-04", "REC-09"):
                    evidence["context"] = dict(block_index=physical[id(block)],
                                               variant=dict(block.attributes).get("variant"))
                ledger.issue(code, "error", "rent_roll", root + ("." + suffix if suffix else ""), message, **evidence)
            def represented_shape(suffix, constraint, code):
                represented[(physical[id(block)], root + "." + suffix, constraint)] = code
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
                            member = ("effective_date" if not calendar_date(date) or previous is not None and calendar_date(date) and date <= previous
                                      else "base_rent_annual" if not _nonnegative(step.get("base_rent_annual")) else "")
                            issue("LSE-01", path + ("." + member if member else ""), "Steps require real increasing dates and finite nonnegative resulting rent")
                        if calendar_date(date):
                            if term and not start <= date <= end:
                                issue("LSE-02", path + ".effective_date", "Step lies outside the stated lease term")
                            previous = date
            termination = tenant.get("termination_option")
            if termination is not None:
                if not isinstance(termination, dict):
                    issue("LSE-04", "termination_option", "Termination option must be an object")
                elif not calendar_date(termination.get("earliest_date")):
                    # A malformed date stops only this clause's admission; the
                    # independent co-tenancy and recovery passes still run.
                    issue("LSE-04", "termination_option.earliest_date", "Termination date must be a real YYYY-MM-DD date")
                else:
                    date, notice, penalty = termination["earliest_date"], termination.get("notice_months"), termination.get("penalty")
                    # RFC0055 LSE-04 explicitly bounds this field to safe
                    # integers; other admitted integer domains are unchanged.
                    if not _whole(notice) or notice > 9007199254740991:
                        issue("LSE-04", "termination_option.notice_months", "Notice must be a nonnegative safe integer number of months")
                    if penalty is not None and not _nonnegative(penalty):
                        issue("LSE-04", "termination_option.penalty", "Stated penalty must be finite and nonnegative; null means none")
                    if term and not start <= date <= end:
                        issue("LSE-04", "termination_option.earliest_date", "Termination date lies outside the stated lease term")
                    included = termination.get("penalty_includes")
                    if included is not None:
                        if not isinstance(included, list) or not included:
                            issue("LSE-05", "termination_option.penalty_includes", "Penalty components must be a nonempty array when stated")
                        else:
                            seen = set()
                            for index, component in enumerate(included):
                                path = "termination_option.penalty_includes[" + str(index) + "]"
                                if not isinstance(component, str) or component not in ("unamortized_ti", "unamortized_lc", "free_rent", "fee"):
                                    issue("LSE-05", path, "Penalty component is outside the closed vocabulary")
                                    break
                                if component in seen:
                                    issue("LSE-05", path, "Penalty component is listed more than once")
                                    break
                                seen.add(component)
            _co_tenancy_rules(tenant, issue)
            for original, outstanding in (("ti_allowance_original", "ti_outstanding_balance"), ("lc_original", "lc_outstanding_balance")):
                a, b = tenant.get(original), tenant.get(outstanding)
                if ((a is not None and not _nonnegative(a)) or (b is not None and not _nonnegative(b))
                        or finite(a) and finite(b) and b > a):
                    issue("LSE-09", outstanding, "Outstanding TI/LC must be nonnegative and not exceed its stated original")
            terms = tenant.get("recovery_terms")
            if terms is not None and not isinstance(terms, dict):
                issue("REC-02", "recovery_terms", "Recovery terms must be an object",
                      context=dict(block_index=physical[id(block)],
                                   variant=dict(block.attributes).get("variant")))
                represented_shape("recovery_terms", ("type", ("object",)), "REC-02")
                terms = {}
            terms = terms or {}
            share, cap = terms.get("pro_rata_share"), terms.get("cap")
            cap = cap if isinstance(cap, dict) else {}
            pct, method = cap.get("pct"), terms.get("method")
            invalid_cap = terms.get("cap") is not None and not isinstance(terms.get("cap"), dict)
            for value,suffix,upper in ((share,"pro_rata_share","maximum"),(pct,"cap.pct","exclusiveMaximum")):
                invalid=(value is not None and (not finite(value) or value<=0 or value>1 or upper=="exclusiveMaximum" and value==1))
                if invalid:
                    issue("REC-01","recovery_terms."+suffix,"Recovery share or cap rate violates its stated fraction domain",
                          context=dict(block_index=physical[id(block)],variant=dict(block.attributes).get("variant")))
                    if not finite(value):
                        represented_shape("recovery_terms."+suffix,("type",("number","null")),"REC-01")
                    elif value<=0:
                        represented_shape("recovery_terms."+suffix,("exclusiveMinimum",0),"REC-01")
                    else:
                        represented_shape("recovery_terms."+suffix,(upper,1),"REC-01")
            method_needed = any(value is not None for key, value in terms.items() if key not in ("method", "cap"))
            method_present = "method" in terms
            method_stated = method_present and method is not None
            if ((method_present and (not isinstance(method,str) or method not in ("net","base_year_stop","fixed_stop","fixed_amount","none")))
                    or not method_present and method_needed):
                issue("REC-02", "recovery_terms.method", "A stated recovery method must use its non-nullable closed vocabulary")
                if not method_present:
                    represented_shape("recovery_terms.method", ("required", None), "REC-02")
            required = {"base_year_stop":"base_year","fixed_stop":"expense_stop_per_sqft",
                        "fixed_amount":"fixed_recovery_annual"}.get(method) if isinstance(method,str) else None
            if required and (required not in terms or terms[required] is None):
                issue("REC-02", "recovery_terms."+required, "The selected recovery method requires its stated companion")
                if required not in terms:
                    represented_shape("recovery_terms."+required, ("required", None), "REC-02")
            pct_stated = "pct" in cap and pct is not None
            if method_stated and pct_stated and cap.get("accumulation") not in ("cumulative","non_cumulative","compounding"):
                issue("REC-02", "recovery_terms.cap.accumulation", "Stated method and cap.pct require one accumulation declaration")
                if "accumulation" not in cap:
                    represented_shape("recovery_terms.cap.accumulation", ("required", None), "REC-02")
            pool = terms.get("recoverable_pool")
            if pool is not None and (not isinstance(pool, list) or not pool or any(k not in _POOL for k in pool)):
                suffix = "[" + str(next(i for i,k in enumerate(pool) if k not in _POOL)) + "]" if isinstance(pool,list) and pool else ""
                issue("REC-03", "recovery_terms.recoverable_pool" + suffix, "Pool must name registered operating-expense keys, never totals/ratios/capital")
            # Accepted RFC0058 / Format4.3 / REC-02 admits only an object
            # when cap is non-null; this is independent of its method.
            if invalid_cap:
                issue("REC-02", "recovery_terms.cap", "Recovery cap must be an object when stated",
                      context=dict(block_index=physical[id(block)],
                                   variant=dict(block.attributes).get("variant")))
                represented_shape("recovery_terms.cap", ("type", ("object", "null")), "REC-02")
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
                    member = "period_start" if not calendar_date(beginning) else "period_end" if not calendar_date(finish) or finish < beginning else "settlement"
                    issue("REC-04", path + "." + member, "True-up period dates or settlement are invalid")
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
                    issue("REC-09", path + ".cash_flow_ref" + (".variant" if isinstance(reference,dict) else ""), "Cash-flow reference must name a current exact variant")
    return represented
