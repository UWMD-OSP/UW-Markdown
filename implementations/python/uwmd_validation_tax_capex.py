"""Independent accepted tax and capex stated-fact validation (0053/0057/0081)."""
import math

from uwmd_binding_sources import finite
from uwmd_numeric import calendar_date, quantize
from uwmd_periods import parse_period_selector, PeriodError
from uwmd_text import nonblank
from uwmd_validation_selection import current_blocks, select_section, field


def _period(value):
    try:
        return parse_period_selector(value)
    except (PeriodError, TypeError):
        return None


def _money_equal(a, b):
    return finite(a) and finite(b) and quantize(a, 2) == quantize(b, 2)


def _tax_quantize(value, places):
    """Format 4.5 admits integer tax magnitude places, unlike Calc round_to.

    Extend the existing VIII.5 decimal-string shift to that admitted domain;
    do not impose the calculation declaration's [0,12] ceiling on tax facts.
    """
    if -12 <= places <= 12:
        return quantize(value, places)
    coefficient, _, exponent = repr(abs(float(value))).lower().partition("e")
    shifted = float(coefficient + "e" + str(int(exponent or 0) + places))
    if not math.isfinite(shifted) or shifted > 9007199254740991:
        return 0.0 if value == 0 else value
    integer = int(shifted) if shifted.is_integer() else math.floor(shifted + 0.5)
    result = float(str(integer) + "e" + str(-places))
    return 0.0 if result == 0 else math.copysign(result, value)


def tax_rules(ledger):
    document = ledger.document
    lines = []
    for block in current_blocks(document, "noi_model"):
        line = field(block.parsed.value, "expenses.real_estate_taxes")
        if isinstance(line, dict):
            lines.append(("noi_model", "expenses.real_estate_taxes", line, None))
    for block in current_blocks(document, "dcf"):
        terminal = field(block.parsed.value, "exit_analysis.terminal_tax")
        if terminal is not None:
            lines.append(("dcf", "exit_analysis.terminal_tax", terminal,
                          field(block.parsed.value, "exit_analysis.exit_value_gross")))
    for section, root, line, exit_value in lines:
        def issue(code, suffix, message):
            ledger.issue(code, "error", section, root + ("." + suffix if suffix else ""), message)
        if not isinstance(line, dict):
            issue("TAX-01", "", "Tax facts must be an object")
            continue
        terminal = section == "dcf"
        reassessment = line if terminal else line.get("reassessment")
        if reassessment is not None:
            if not isinstance(reassessment, dict):
                issue("TAX-01", "reassessment", "Reassessment must be an object")
            else:
                r = reassessment
                group = ("assessed_value", "millage_rate", "indicated_tax")
                extras = ("jurisdiction", "value_basis", "assessment_ratio", "round_to_decimals")
                # The normal G1 reassessment admits a lone trigger. The
                # separate terminal schema requires all assessment members.
                group_stated = terminal or any(r.get(k) is not None for k in (*group, *extras))
                def rpath(member=""):
                    return member if terminal else "reassessment" + ("."+member if member else "")
                valid = r.get("trigger") in ("sale", "construction_completion", "statutory_cycle", "none")
                if group_stated:
                    valid = valid and all(finite(r.get(k)) for k in group)
                    basis, ratio = r.get("value_basis"), r.get("assessment_ratio")
                    if basis is not None or ratio is not None:
                        valid = valid and finite(basis) and finite(ratio) and _money_equal(basis * ratio, r.get("assessed_value"))
                missing = [key for key in group if r.get(key) is None]
                if any(r.get(key) is not None for key in group) and missing:
                    for key in missing:
                        issue("TAX-01", rpath(key), "Every stated assessment group requires this member")
                elif not valid:
                    member = ("trigger" if r.get("trigger") not in ("sale", "construction_completion", "statutory_cycle", "none")
                              else "assessment_ratio" if r.get("assessment_ratio") is not None and (not finite(r["assessment_ratio"]) or not 0 < r["assessment_ratio"] <= 1)
                              else next((k for k in group if not finite(r.get(k))), "assessed_value"))
                    issue("TAX-01", rpath(member), "Reassessment vocabulary, assessment group or product is invalid")
                if group_stated and all(finite(r.get(k)) for k in group):
                    product = r["assessed_value"] * r["millage_rate"]
                    if not _money_equal(product, r["indicated_tax"]):
                        issue("TAX-02", rpath("indicated_tax"), "Indicated tax must equal assessed value times millage")
                    # Format 4.5: round_to_decimals MUST be an integer under TAX-03.
                    places = r.get("round_to_decimals")
                    places = 2 if places is None else places
                    if not (finite(places) and int(places) == places):
                        issue("TAX-03", rpath("round_to_decimals"), "Rounding decimals must be an integer")
                    else:
                        if not terminal and not _money_equal(line.get("value"), _tax_quantize(r["indicated_tax"], int(places))):
                            issue("TAX-03", "value", "Stated tax does not equal indicated tax at the declared quantum")
        abatement = line.get("abatement")
        if abatement is not None:
            if not isinstance(abatement, dict):
                issue("TAX-05", "abatement", "Abatement schedule is malformed")
            else:
                rows = abatement.get("schedule")
                kind = abatement.get("kind")
                if kind not in ("exemption", "freeze", "pilot", "phase_in", "credit"):
                    issue("TAX-06", "abatement.kind", "Abatement kind is outside the closed vocabulary")
                if not isinstance(rows, list) or not rows:
                    issue("TAX-05", "abatement.schedule", "Abatement schedule must be nonempty")
                else:
                    previous, full_previous, matched = None, None, None
                    # TAX-07 reads the schedule only once it is admitted: every
                    # row an object with a selector and finite amounts, one
                    # increasing granularity, and a nondecreasing freeze.
                    admitted = kind in ("exemption", "freeze", "pilot", "phase_in", "credit")
                    for index, row in enumerate(rows):
                        path = "abatement.schedule[" + str(index) + "]"
                        if not isinstance(row, dict):
                            issue("TAX-05", path, "Schedule row must state a period")
                            admitted = False
                            continue
                        identity = _period(row.get("period"))
                        if identity is None or previous is not None and (identity[0] != previous[0] or identity <= previous):
                            issue("TAX-05", path + ".period" if identity is None else "abatement.schedule", "Periods must be one kind, increasing and unique")
                            admitted = False
                        if identity is not None:
                            previous = identity
                        full, abated = row.get("full_tax"), row.get("abated_tax")
                        if not finite(full) or not finite(abated):
                            admitted = False
                        if not finite(full) or not finite(abated) or not 0 <= abated <= full:
                            issue("TAX-06", path, "Tax amounts must satisfy zero <= abated <= full")
                        if kind == "freeze" and finite(full):
                            if full_previous is not None and full < full_previous:
                                issue("TAX-06", path + ".full_tax", "Freeze full-tax amounts must be nondecreasing")
                                admitted = False
                            full_previous = full
                        if matched is None and row.get("period") == abatement.get("stabilized_period"):
                            matched = row
                    # Format §4.5: "when stabilized_period is stated"; a stated
                    # null is not stated. A selector naming no row is reported at
                    # the selector; a disagreeing stated tax at the stated value.
                    stabilized = abatement.get("stabilized_period")
                    if admitted and stabilized is not None:
                        if not isinstance(stabilized, str) or matched is None:
                            issue("TAX-07", "abatement.stabilized_period", "Stabilized period must name a schedule row")
                        elif finite(line.get("value")) and not _money_equal(line["value"], matched.get("abated_tax")):
                            issue("TAX-07", "value", "Stated tax must equal the stabilized period's abated tax")
        if terminal:
            if not isinstance(line.get("in_exit_noi"), bool):
                issue("TAX-08", "in_exit_noi", "Terminal tax must disclose whether it is in exit NOI")
            if (line.get("trigger") == "sale" and not nonblank(line.get("value_basis_differs_because"))
                    and (not finite(exit_value) or not finite(line.get("value_basis")) or line["value_basis"] != exit_value)):
                issue("TAX-08", "value_basis", "Sale-triggered terminal tax must use the stated gross exit value or disclose why it differs")


def capex_rules(ledger):
    document = ledger.document
    noi = select_section(document, "noi_model")
    expenses = field(noi.block.parsed.value, "expenses") if noi.block is not None else None
    for block in current_blocks(document, "sources_uses"):
        renovation = field(block.parsed.value, "uses.renovation")
        if renovation is None:
            continue
        def issue(code, suffix, message):
            ledger.issue(code, "error", "sources_uses", "uses.renovation" + ("." + suffix if suffix else ""), message)
        if not isinstance(renovation, dict):
            issue("CAPX-01", "", "Renovation must be a stated object")
            continue
        r = renovation
        amounts = ("budget", "contingency", "contingency_used", "drawn_to_date")
        group = ("contingency_used", "drawn_to_date", "as_of_date")
        draw_stated = any(r.get(k) is not None for k in (*group, "contingency_remaining"))
        valid = any(r.get(k) is not None for k in ("budget", "contingency"))
        valid = valid and all(r.get(k) is None or finite(r[k]) and r[k] >= 0 for k in amounts)
        valid = valid and set(r) <= {*amounts, "contingency_remaining", "as_of_date", "expense_targeted"}
        if draw_stated:
            valid = valid and all(finite(r.get(k)) and r[k] >= 0 for k in amounts) and calendar_date(r.get("as_of_date"))
        if not valid:
            member = next((k for k in amounts if r.get(k) is not None and (not finite(r[k]) or r[k] < 0)),
                          "as_of_date" if r.get("as_of_date") is not None and not calendar_date(r["as_of_date"]) else "")
            issue("CAPX-01", member, "Renovation amounts and all-or-none draw group must be valid stated facts")
        if any(r.get(k) is not None for k in group):
            for key in group:
                if r.get(key) is None:
                    issue("CAPX-01", key, "Every stated draw group requires this member")
        if draw_stated and all(finite(r.get(k)) and r[k] >= 0 for k in amounts):
            if r["contingency_used"] > r["contingency"]:
                issue("CAPX-02", "contingency_used", "Contingency use exceeds the stated contingency")
            capacity = r["budget"] + r["contingency"]
            if not finite(capacity) or not r["contingency_used"] <= r["drawn_to_date"] <= capacity:
                issue("CAPX-03", "drawn_to_date", "Total draw must include contingency use and stay within the stated total")
            if r.get("contingency_remaining") is not None and not _money_equal(r["contingency_remaining"], r["contingency"] - r["contingency_used"]):
                issue("CAPX-04", "contingency_remaining", "Remaining contingency does not reconcile at the currency quantum")
        projects = r.get("expense_targeted")
        if projects is None:
            continue
        if not isinstance(projects, list):
            issue("CAPX-06", "expense_targeted", "Expense-targeted projects must be an array")
            continue
        for index, project in enumerate(projects):
            path = "expense_targeted[" + str(index) + "]"
            if not isinstance(project, dict):
                issue("CAPX-06", path, "Project must be an object")
                continue
            valid = (nonblank(project.get("label")) and finite(project.get("amount")) and project["amount"] >= 0
                     and finite(project.get("annual_savings")) and project["annual_savings"] >= 0
                     and _period(project.get("savings_begin")) is not None and nonblank(project.get("targets")))
            if noi.block is not None:
                valid = valid and isinstance(expenses, dict) and project.get("targets") in expenses
            if not valid:
                member = ("label" if not nonblank(project.get("label")) else "amount" if not finite(project.get("amount")) or project["amount"] < 0
                          else "annual_savings" if not finite(project.get("annual_savings")) or project["annual_savings"] < 0
                          else "savings_begin" if _period(project.get("savings_begin")) is None else "targets")
                issue("CAPX-06", path + "." + member, "Project identity, period, amounts or stated expense target is invalid")
            if not isinstance(project.get("in_noi_model"), bool):
                issue("CAPX-07", path + ".in_noi_model", "Project must disclose whether the saving is already in NOI")
            payback = project.get("simple_payback_years")
            if payback is not None:
                amount, saving = project.get("amount"), project.get("annual_savings")
                if not finite(payback) or not finite(amount) or not finite(saving) or saving <= 0 or not finite(amount / saving) or quantize(payback, 4) != quantize(amount / saving, 4):
                    issue("CAPX-08", path + ".simple_payback_years", "Payback must equal stated amount divided by positive stated saving")
