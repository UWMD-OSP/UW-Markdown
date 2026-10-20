"""Independent Format 5.2/5.3 reconciliation and plausibility rules.

Numeric comparisons use the published check-specific thresholds/tolerances,
not dictionary recomputation or inferred underwriting figures.
"""
import json
from pathlib import Path

from uwmd_binding_sources import finite
from uwmd_validation_core import BUILTINS
from uwmd_validation_selection import active_blocks, current_blocks, field


def number(payload, *paths):
    for path in paths:
        value = field(payload, path)
        if value is not None:
            return value if finite(value) else None
    return None


POINTS = ("closing", "stabilization")


def _outstanding_at(point):
    """RFC 0098: a debt_structure block stating `point`, or no point (both)."""
    def keep(block):
        body = block.parsed.value
        return "point_in_time" not in body or body["point_in_time"] == point
    return keep


def cc03(ledger):
    """Format §5.3 CC-03 per point (RFC 0098): closing leg and stack leg."""
    sources = ledger.read("CC-03", "sources_uses")
    debt = {point: ledger.read("CC-03", "debt_structure", key="debt_structure@" + point,
                               preferred_role="senior", block_filter=_outstanding_at(point))
            for point in POINTS}
    reads = dict(ledger._reads.get("CC-03", ()))
    stack = ledger.read("CC-03", "capital_stack")
    su_loan = number(sources, "sources.loan_amount", "sources.debt_proceeds")
    evaluated = False
    closing_loan = number(debt["closing"], "loan_amount")
    if finite(su_loan) and finite(closing_loan):
        evaluated = True
        if abs(su_loan - closing_loan) > 100:
            ledger.issue("CC-03", "error", "sources_uses", "sources.loan_amount",
                         "Closing statement disagrees with the closing senior loan",
                         value=abs(su_loan - closing_loan))
    tranches = field(stack, "tranches")
    tranche = next((t for t in tranches if isinstance(t, dict) and t.get("class") == "senior_debt"), None) \
        if isinstance(tranches, list) else None
    point = stack.get("point_in_time") if isinstance(stack, dict) else None
    point = point if point in POINTS else None
    if tranche is not None and point is not None:
        amount = tranche.get("amount") if finite(tranche.get("amount")) else None
        reference = number(debt[point], "loan_amount")
        if reference is None and point == "closing":
            reference = su_loan
        if amount is not None and finite(reference):
            evaluated = True
            if abs(amount - reference) > 100:
                ledger.issue("CC-03", "error", "capital_stack", "tranches.senior_debt.amount",
                             "Senior tranche disagrees with the senior loan at the stack's point",
                             value=abs(amount - reference))
        # Same rate (§4.24): exact, no tolerance (#406); no closing-statement fallback.
        rate, loan_rate = tranche.get("rate"), number(debt[point], "interest_rate")
        if finite(rate) and finite(loan_rate):
            evaluated = True
            if rate != loan_rate:
                ledger.issue("CC-03", "error", "capital_stack", "tranches.senior_debt.rate",
                             "Senior tranche rate does not equal the senior loan interest_rate",
                             value=abs(rate - loan_rate))
    if evaluated:
        ledger.cover("CC-03", True)
        return
    su_sel = reads.get("sources_uses")
    debt_sel = {p: reads.get("debt_structure@" + p) for p in POINTS}
    stack_sel = dict(ledger._reads.get("CC-03", ())).get("capital_stack")
    def unresolvable(sel):
        return sel is not None and sel.reason == "variant_unresolvable"
    def absent(sel):
        return sel is None or sel.reason == "section_absent"
    if unresolvable(su_sel):
        ledger.cover("CC-03", reason="variant_unresolvable", detail="sources_uses")
    elif any(unresolvable(sel) for sel in debt_sel.values()):
        ledger.cover("CC-03", reason="variant_unresolvable", detail="debt_structure")
    elif unresolvable(stack_sel):
        ledger.cover("CC-03", reason="variant_unresolvable", detail="capital_stack")
    elif absent(su_sel):
        ledger.cover("CC-03", reason="section_absent", detail="sources_uses")
    elif not current_blocks(ledger.document, "debt_structure", include_external=True):
        ledger.cover("CC-03", reason="section_absent", detail="debt_structure")
    elif point is not None and tranche is not None and absent(debt_sel[point]):
        ledger.cover("CC-03", reason="not_applicable", detail="no " + point + " senior debt_structure")
    elif tranche is None and absent(debt_sel["closing"]):
        ledger.cover("CC-03", reason="not_applicable", detail="no closing senior debt_structure")
    else:
        ledger.cover("CC-03", reason="field_absent",
                     detail="sources_uses.sources.loan_amount" if su_loan is None else "debt_structure.loan_amount")


def cross_checks(ledger, *, defer_summaries=False):
    document, fm = ledger.document, ledger.document.frontmatter.value
    def read(rule, section, **options):
        return ledger.read(rule, section, **options)
    def compare(rule, left, right, tolerance, *, relative=False, section="", path=""):
        usable = finite(left) and finite(right)
        ledger.cover(rule, usable)
        if usable:
            limit = tolerance * abs(right) if relative else tolerance
            if abs(left - right) > limit:
                severity = "error" if rule in ("CC-03", "CC-04", "CC-10", "CC-12") else "warning"
                ledger.issue(rule, severity, section, path, "Stated figures exceed the registered reconciliation tolerance",
                             value=dict(stated=left, comparison=right), threshold={"max": limit})
        return usable
    r, o = read("CC-01", "rent_roll", preferred_role="detail"), read("CC-01", "operating_statement", preferred_key="t12")
    compare("CC-01", number(r, "gross_potential_rent", "gross_potential_rent_annual"),
            number(o, "gross_potential_rent", "income.gross_potential_rent"), .03,
            relative=True, section="rent_roll", path="gross_potential_rent")
    debt, valuation = read("CC-02", "debt_structure", preferred_role="senior"), read("CC-02", "valuation")
    loan, value = number(debt, "loan_amount"), number(valuation, "underwritten_value", "purchase_price")
    expected = loan / value if finite(loan) and finite(value) and value != 0 else None
    compare("CC-02", number(debt, "ltv", "sizing_metrics.ltv"), expected, .005, section="debt_structure", path="ltv")
    cc03(ledger)
    s = read("CC-04", "sources_uses")
    compare("CC-04", number(s, "total_sources"), number(s, "total_uses"), 1, section="sources_uses", path="total_sources")
    n, d = read("CC-05", "noi_model"), read("CC-05", "debt_structure", preferred_role="senior")
    compare("CC-05", number(d, "underwritten_noi"), number(n, "net_operating_income"), .01,
            relative=True, section="debt_structure", path="underwritten_noi")
    n, d = read("CC-06", "noi_model"), read("CC-06", "dcf")
    rows = field(d, "annual_cash_flows")
    first = rows[0] if isinstance(rows, list) and rows else None
    compare("CC-06", number(first, "noi", "net_operating_income"), number(n, "net_operating_income"), .02,
            relative=True, section="dcf", path="annual_cash_flows[0].net_operating_income")
    d, stress = read("CC-07", "dcf"), read("CC-07", "stress_tests")
    compare("CC-07", number(d, "assumptions.exit_cap_rate"), number(stress, "base_case.exit_cap_rate"),
            .005, section="stress_tests", path="base_case.exit_cap_rate")
    due, valuation = read("CC-08", "due_diligence", preferred_key="appraisal"), read("CC-08", "valuation")
    compare("CC-08", number(due, "appraisal.appraised_value", "appraised_value"),
            number(valuation, "appraised_value"), 1000, section="valuation", path="appraised_value")
    d, stress = read("CC-09", "debt_structure", preferred_role="senior"), read("CC-09", "stress_tests")
    compare("CC-09", number(stress, "base_case.annual_debt_service"), number(d, "annual_debt_service"),
            500, section="stress_tests", path="base_case.annual_debt_service")
    s, v = read("CC-10", "sources_uses"), read("CC-10", "valuation")
    compare("CC-10", number(s, "uses.purchase_price"), number(v, "purchase_price"), 100,
            section="sources_uses", path="uses.purchase_price")
    component_presence = bool(active_blocks(document, "components"))
    ledger.cover("CC-11", component_presence, reason="section_absent" if not component_presence else None,
                 detail="Components section is absent")
    if component_presence and fm.get("asset_class") != "mixed_use":
        ledger.issue("CC-11", "error", "components", "", "Components are only admitted for mixed-use records")
    c, n = read("CC-12", "components"), read("CC-12", "noi_model")
    values = [v.get("net_operating_income") for k, v in (c or {}).items()
              if not k.startswith("_") and isinstance(v, dict)]
    usable = bool(values) and all(finite(v) for v in values)
    total = 0.0
    if usable:
        for value in values:
            total += value
    compare("CC-12", number(n, "net_operating_income"), total if usable and finite(total) else None,
            0, section="noi_model", path="net_operating_income")
    profile = fm.get("document_profile")
    nondeal = profile is not None and profile != "deal-record-v1"
    property_blocks = active_blocks(document, "property")
    if nondeal:
        ledger.cover("CC-13", reason="not_applicable", detail="Non-deal document profile")
        ledger.cover("CC-14", reason="not_applicable", detail="Non-deal document profile")
    else:
        ledger.cover("CC-14", True)
        if not property_blocks:
            ledger.issue("CC-14", "warning", "property", "", "Deal record has no property section")
            ledger.cover("CC-13", reason="section_absent", detail="Property is absent; CC-14 owns this gap")
        elif fm.get("asset_class") in (None, "mixed_use") or fm.get("asset_class") not in BUILTINS:
            ledger.cover("CC-13", reason="not_applicable", detail="No property-level primary size is registered")
        else:
            prop = read("CC-13", "property")
            if ledger._reads["CC-13"][-1][1].externalized:
                ledger.cover("CC-13", reason="not_applicable", detail="Property is externalized; size belongs to unresolved content")
            elif prop is None:
                ledger.cover("CC-13")
            else:
                registry = json.loads((Path(__file__).resolve().parents[2] / "spec/metrics/builtin.json").read_text(encoding="utf-8"))
                definition = next((r for r in registry["size_intensives"] if fm["asset_class"] in r["asset_classes"]), None)
                if definition is None:
                    ledger.cover("CC-13", reason="not_applicable", detail="Class has no primary size entry")
                else:
                    ledger.cover("CC-13", True)
                    path = definition["path"]
                    if not finite(field(prop, path)):
                        ledger.issue("CC-13", "warning", "property", path, "Primary class size is not stated as a finite number")
    lease, noi = read("CC-15", "lease_up_schedule", lease_up_base=True), read("CC-15", "noi_model")
    compare("CC-15", number(lease, "stabilized_summary.annualized_noi"), number(noi, "net_operating_income"),
            .02, relative=True, section="lease_up_schedule", path="stabilized_summary.annualized_noi")
    ledger.finish_coverage(summaries=not defer_summaries)


_THRESHOLD_SPECS = (
    ("valuation", ("going_in_cap_rate",), "cap_rate", .03, .15, None, None, "FV-01", "FV-02"),
    ("debt_structure", ("sizing_metrics.debt_yield",), "debt_yield", .07, None, None, None, "FV-03", None),
    ("debt_structure", ("sizing_metrics.dscr_underwritten",), "dscr", 1.2, None, 1.0, None, "FV-04", None),
    ("debt_structure", ("sizing_metrics.ltv",), "ltv", None, .75, None, .85, None, "FV-09"),
    ("dcf", ("returns.equity_multiple",), "equity_multiple", 1, 5, None, None, "FV-05", "FV-06"),
    ("dcf", ("returns.levered_irr",), "irr", .05, .4, None, None, "FV-07", "FV-08"),
    ("noi_model", ("expenses.expense_ratio",), "opex_ratio", .2, .7, None, None, "FV-10", "FV-11"),
    ("dcf", ("assumptions.revenue_growth_rate",), "annual_rent_growth", None, .08, None, None, None, "FV-12"),
    ("noi_model", ("income.vacancy_credit_loss.rate_applied",), "vacancy_rate", .02, .4, None, None, "FV-13", "FV-14"),
)


def _default_threshold_bands():
    """Detached current validation defaults, including each unchanged bound."""
    return {key:{name:bound for name,bound in (
                ("warning_below",low),("warning_above",high),
                ("error_below",error_low),("error_above",error_high)) if bound is not None}
            for _,_,key,low,high,error_low,error_high,_,_ in _THRESHOLD_SPECS}


def financial_thresholds(ledger, thresholds=None):
    """Published Format 5.2 thresholds; compare stated values, never solve inputs."""
    thresholds = thresholds or {}
    document = ledger.document
    from uwmd_validation_selection import select_section
    for section, paths, key, low, high, error_low, error_high, low_code, high_code in _THRESHOLD_SPECS:
        selected = select_section(document, section, preferred_role="senior" if section == "debt_structure" else None)
        if selected.block is None:
            continue
        payload = selected.block.parsed.value
        value = number(payload, *paths)
        if not finite(value):
            continue
        configured = thresholds.get(key, {})
        low, high = configured.get("warning_below", low), configured.get("warning_above", high)
        error_low, error_high = configured.get("error_below", error_low), configured.get("error_above", error_high)
        if low_code and ((finite(low) and value < low) or (finite(error_low) and value < error_low)):
            ledger.issue(low_code, "error" if finite(error_low) and value < error_low else "warning",
                         section, paths[0], "Stated value is below its registered threshold", value=value)
        if high_code and ((finite(high) and value > high) or (finite(error_high) and value > error_high)):
            ledger.issue(high_code, "error" if finite(error_high) and value > error_high else "warning",
                         section, paths[0], "Stated value is above its registered threshold", value=value)
