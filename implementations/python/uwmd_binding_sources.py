"""Independent selected-source structure for VIII.12, not metric evaluation.

Mirrors accepted closed JSON shapes and Format 4.25/4.26 cross-field rules.
Findings are source diagnostics inside RDB-04, not a full validate capability.
"""
import math

from uwmd_numeric import calendar_date
from uwmd_periods import PeriodError, parse_period_selector


_ROLES = ("primary", "senior", "junior", "summary", "detail", "component")
_META = ("_meta", "_role", "_notes")


def finite(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return False
    try:
        return math.isfinite(value)
    except OverflowError:
        return False


def _shape(value, required, optional, field, issues):
    if not isinstance(value, dict):
        issues.append(field + ": object required")
        return False
    for key in required:
        if key not in value:
            issues.append(field + "." + key + ": required")
    for key in value:
        if key not in required and key not in optional:
            issues.append(field + "." + key + ": unknown field")
    return True


def _metadata(payload, issues):
    if "_meta" in payload and not isinstance(payload["_meta"], dict):
        issues.append("_meta: object required")
    if "_role" in payload and payload["_role"] not in _ROLES:
        issues.append("_role: unsupported role")
    if "_notes" in payload and payload["_notes"] is not None and not isinstance(payload["_notes"], str):
        issues.append("_notes: string or null required")


def _number(value, field, issues, minimum=None, maximum=None):
    if value is None:
        return
    if not finite(value) or (minimum is not None and value < minimum) or (maximum is not None and value > maximum):
        issues.append(field + ": invalid finite numeric value")


def cash_source_issues(payload):
    issues = []
    # An absent series is reported once, as the CF-02 non-empty rule below.
    if not _shape(payload, (), (*_META, "series", "label", "day_count", "stated_metrics"), "cash_flow_series", issues):
        return issues
    _metadata(payload, issues)
    if payload.get("label") is not None and not isinstance(payload["label"], str):
        issues.append("label: string or null required")
    if payload.get("day_count") not in (None, "actual/365f", "actual/360", "30/360us"):
        issues.append("day_count: unsupported convention")
    rows = payload.get("series")
    if not isinstance(rows, list) or not rows:
        issues.append("series: nonempty array required")
        return issues
    last_date, positive, negative = None, False, False
    for index, row in enumerate(rows):
        field = "series[" + str(index) + "]"
        if not _shape(row, ("date", "amount"), ("kind", "label"), field, issues):
            continue
        date, amount = row.get("date"), row.get("amount")
        if not calendar_date(date):
            issues.append(field + ".date: real calendar date required")
        else:
            if last_date is not None and date < last_date:
                issues.append(field + ".date: source dates must be nondecreasing")
            last_date = date
        if not finite(amount):
            issues.append(field + ".amount: finite amount required")
        else:
            positive, negative = positive or amount > 0, negative or amount < 0
        if row.get("kind") not in (None, "acquisition", "operating", "capex", "debt_service", "refinance", "disposition", "other"):
            issues.append(field + ".kind: unsupported advisory kind")
        if row.get("label") is not None and not isinstance(row["label"], str):
            issues.append(field + ".label: string or null required")
    metrics = payload.get("stated_metrics")
    if metrics is not None and _shape(metrics, (), ("total_net", "moic", "xnpv", "xirr"), "stated_metrics", issues):
        for key in ("total_net", "moic", "xirr"):
            _number(metrics.get(key), "stated_metrics." + key, issues, 0 if key == "moic" else None)
        npv = metrics.get("xnpv")
        if npv is not None and _shape(npv, ("rate", "value"), (), "stated_metrics.xnpv", issues):
            if not finite(npv.get("rate")) or npv["rate"] <= -1:
                issues.append("stated_metrics.xnpv.rate: finite rate greater than -1 required")
            if not finite(npv.get("value")):
                issues.append("stated_metrics.xnpv.value: finite value required")
        if metrics.get("xirr") is not None and not (positive and negative):
            issues.append("stated_metrics.xirr: source must contain both signs")
    return issues


_DAY_COUNTS = ("actual/365f", "actual/360", "30/360us")
_KINDS = ("acquisition", "operating", "capex", "debt_service", "refinance", "disposition", "other")


def cash_flow_findings(payload):
    """Format §4.26 CF-01/02/03 for one validated cash_flow_series block.

    Returns ordered (code, field, message). CF-01 is exactly the §4.26 row
    grammar: a real date, a finite amount and the closed day_count/kind
    vocabularies. Other schema shape (labels, unknown members, metadata) is
    not a CF-01 condition; RDB binding admission keeps cash_source_issues.
    One finding per defect: a row outside the grammar is not also out of order.
    """
    content = payload if isinstance(payload, dict) else {}
    findings = []
    day_count = content.get("day_count")
    if day_count is not None and day_count not in _DAY_COUNTS:
        findings.append(("CF-01", "day_count", "day_count must be a registered convention"))
    rows = content.get("series")
    if not isinstance(rows, list) or not rows:
        findings.append(("CF-02", "series", "series must be a non-empty array of dated flows"))
        return findings
    previous, positive, negative = None, False, False
    for index, row in enumerate(rows):
        field = "series[" + str(index) + "]"
        row = row if isinstance(row, dict) else {}
        date, amount, kind = row.get("date"), row.get("amount"), row.get("kind")
        if not calendar_date(date):
            findings.append(("CF-01", field + ".date", "date is not a real ISO-8601 calendar day (YYYY-MM-DD)"))
            previous = None
        else:
            if previous is not None and date < previous:
                findings.append(("CF-02", field + ".date", "dates must be non-decreasing"))
            previous = date
        if not finite(amount):
            findings.append(("CF-01", field + ".amount", "amount must be a finite signed number"))
        else:
            positive, negative = positive or amount > 0, negative or amount < 0
        if kind is not None and kind not in _KINDS:
            findings.append(("CF-01", field + ".kind", "kind is not a registered flow kind"))
    metrics = content.get("stated_metrics")
    if isinstance(metrics, dict) and metrics.get("xirr") is not None and not (positive and negative):
        findings.append(("CF-03", "stated_metrics.xirr", "a stated xirr needs both a negative and a positive amount"))
    return findings


def binding_series_valid(payload):
    """Protocol V.12 / Format HDG-08: the selected series a replacement binds.

    A legal day_count and a nonempty ordered series of closed rows (date,
    amount, kind, label) with real dates, finite amounts, registered kinds
    and string-or-null labels. Section-level members are not inspected.
    """
    content = payload if isinstance(payload, dict) else {}
    if content.get("day_count") is not None and content["day_count"] not in _DAY_COUNTS:
        return False
    rows = content.get("series")
    if not isinstance(rows, list) or not rows:
        return False
    previous = ""
    for row in rows:
        if (not isinstance(row, dict) or any(key not in ("date", "amount", "kind", "label") for key in row)
                or not calendar_date(row.get("date")) or not finite(row.get("amount"))
                or row["date"] < previous
                or row.get("kind") is not None and row["kind"] not in _KINDS
                or row.get("label") is not None and not isinstance(row["label"], str)):
            return False
        previous = row["date"]
    return True


def calendar_period(text, cadence):
    try:
        key = parse_period_selector(text)
    except PeriodError:
        return None
    if cadence == "monthly" and key[0] == "month":
        return key[1] * 12 + key[2] - 1
    if cadence == "quarterly" and key[0] == "quarter":
        return key[1] * 4 + key[2] - 1
    return None


def lease_source_issues(payload):
    issues = []
    if not _shape(payload, ("model_type", "period_granularity", "schedule"),
                  (*_META, "stabilization_target", "assumptions", "stabilized_summary"), "lease_up_schedule", issues):
        return issues
    _metadata(payload, issues)
    if payload.get("model_type") not in ("natural_turnover", "absorption_curve"):
        issues.append("model_type: registered model required")
    cadence = payload.get("period_granularity")
    if cadence not in ("monthly", "quarterly"):
        issues.append("period_granularity: monthly or quarterly required")
    rows = payload.get("schedule")
    if not isinstance(rows, list) or not rows:
        issues.append("schedule: nonempty array required")
        return issues
    numeric = ("occupied_sf", "leased_sf", "in_place_rent_psf", "market_rent_psf", "vacancy_rate", "rent_revenue", "concessions", "ti_lc_capex", "net_cash_flow")
    first, previous = None, None
    for index, row in enumerate(rows):
        field = "schedule[" + str(index) + "]"
        if not _shape(row, ("period",), numeric, field, issues):
            continue
        identity = calendar_period(row.get("period"), cadence)
        if identity is None:
            issues.append(field + ".period: cadence-matching calendar period required")
        else:
            if first is None:
                first = identity
            if previous is not None and identity != previous + 1:
                issues.append(field + ".period: strictly increasing gap-free periods required")
            previous = identity
        for key in numeric:
            _number(row.get(key), field + "." + key, issues,
                    0 if key in numeric[:5] else None, 1 if key == "vacancy_rate" else None)
    target = payload.get("stabilization_target")
    if target is not None:
        identity = calendar_period(target, cadence)
        if identity is None or (first is not None and identity < first):
            issues.append("stabilization_target: matching period at or after first required")
    assumptions = payload.get("assumptions")
    rates = ("monthly_turnover_rate", "vacancy_during_lease_up", "leasing_commission_rate")
    amounts = ("market_rent_psf_at_stabilization", "concession_months_per_lease", "tenant_improvement_psf")
    if assumptions is not None and _shape(assumptions, (), rates + amounts, "assumptions", issues):
        for key in (*rates, *amounts):
            _number(assumptions.get(key), "assumptions." + key, issues, 0, 1 if key in rates else None)
    summary = payload.get("stabilized_summary")
    fields = ("occupied_sf", "occupancy_rate", "annualized_egi", "annualized_noi")
    if summary is not None and _shape(summary, (), fields, "stabilized_summary", issues):
        for key in fields:
            _number(summary.get(key), "stabilized_summary." + key, issues,
                    0 if key in fields[:2] else None, 1 if key == "occupancy_rate" else None)
    # LU-04/CC-15 are warnings, not binding source refusals. No trajectory,
    # occupancy/NOI metric or stated cash-flow total is recomputed here.
    return issues
