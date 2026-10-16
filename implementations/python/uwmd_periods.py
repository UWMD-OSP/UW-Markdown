"""Independent Protocol VIII.2a period identity/series foundation.

Payload-level only: callers must already select an active section/variant.
No expression grammar, document validation, financial math or tier is claimed.
The recovery experiment supplied registry/identity concepts, reconciled against
VIII.2a and RFC 0062; its replacement Reader and resolver are not imported.
"""
from dataclasses import dataclass
import math
import re
from types import MappingProxyType

from uwmd_numeric import calendar_date


@dataclass(frozen=True)
class SeriesEntry:
    shape: str
    field: str | None
    grammar: str


PERIOD_SERIES = MappingProxyType({
    ("dcf", "annual_cash_flows"): SeriesEntry("rows", "year", "year_index"),
    ("noi_model", "projections"): SeriesEntry("keyed", None, "year_index"),
    ("lease_up_schedule", "schedule"): SeriesEntry("rows", "period", "calendar_period"),
    ("cash_flow_series", "series"): SeriesEntry("rows", "date", "iso_date"),
    ("distribution_waterfall", "stated_schedule"): SeriesEntry("rows", "date", "iso_date"),
})


class PeriodError(ValueError):
    """Existing calc code, without pretending this foundation evaluates calcs."""
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def _invalid(message):
    raise PeriodError("CALC-PERIOD-001", message)


def parse_period_selector(text):
    """Kind-qualified, immutable identity; no calendar/holding-year coercion."""
    if not isinstance(text, str):
        _invalid("period selector must be a string")
    if re.fullmatch(r"Y[1-9][0-9]*", text):
        # Bound the spelling first, avoiding host integer-conversion limits.
        digits = text[1:]
        if len(digits) <= 16 and int(digits) <= 9007199254740991:
            return ("year", int(digits))
    if re.fullmatch(r"[0-9]{4}-Q[1-4]", text):
        return ("quarter", int(text[:4]), int(text[-1]))
    if re.fullmatch(r"[0-9]{4}-(0[1-9]|1[0-2])", text):
        return ("month", int(text[:4]), int(text[-2:]))
    if calendar_date(text):
        return ("date", text)
    _invalid("invalid period selector")


def canonical_period(entry, value):
    """Read one registered row/key; absent/null period has no identity."""
    if value is None:
        return None
    if entry.shape == "keyed":
        if not isinstance(value, str) or not re.fullmatch(r"year_[0-9]+", value):
            _invalid("malformed year key")
        digits = value[5:].lstrip("0") or "0"
        if len(digits) > 16:
            _invalid("year identity exceeds positive safe integers")
        value = int(digits)
    if entry.grammar == "year_index":
        if (isinstance(value, bool) or not isinstance(value, (int, float))
                or not 1 <= value <= 9007199254740991
                or not math.isfinite(value) or int(value) != value):
            _invalid("year identity must be a positive safe integer")
        return ("year", int(value))
    identity = parse_period_selector(value)
    allowed = ("month", "quarter") if entry.grammar == "calendar_period" else ("date",)
    if identity[0] not in allowed:
        _invalid("period has the wrong kind for the registered series")
    return identity


@dataclass(frozen=True)
class PeriodIssue:
    code: str
    severity: str
    pointer: str
    message: str


@dataclass(frozen=True)
class PeriodRow:
    identity: tuple | None
    pointer: str
    value: dict


@dataclass(frozen=True)
class SeriesInspection:
    rows: tuple[PeriodRow, ...]
    issues: tuple[PeriodIssue, ...]
    malformed: bool


def _child(pointer, key):
    return pointer + "/" + str(key).replace("~", "~0").replace("/", "~1")


def inspect_period_series(payload, section, series):
    """Inspect every stated row, preserving order and original row objects.

    PS-01/02 only. Missing identities warn but do not become invented values.
    The inspection carries no overall validation or financial verdict.
    """
    entry = PERIOD_SERIES.get((section, series))
    if entry is None:
        _invalid("unregistered period series")
    if payload is None:
        return SeriesInspection((), (), False)
    if not isinstance(payload, dict):
        _invalid("selected section payload must be an object or null")
    root = _child("", series)
    rows, issues = [], []
    malformed = False

    def warn(pointer, message, *, refuses=True):
        nonlocal malformed
        malformed = malformed or refuses
        issues.append(PeriodIssue("PS-01", "warning", pointer, message))

    value = payload.get(series)
    if value is None:
        return SeriesInspection((), (), False)
    if not isinstance(value, list if entry.shape == "rows" else dict):
        warn(root, "registered series has the wrong shape")
        return SeriesInspection((), tuple(issues), malformed)
    cadence = payload.get("period_granularity")
    if entry.grammar == "calendar_period" and cadence not in ("monthly", "quarterly"):
        warn("/period_granularity", "calendar series requires monthly or quarterly cadence")
    seen = set()
    for key, row in (enumerate(value) if entry.shape == "rows" else value.items()):
        pointer = _child(root, key)
        if not isinstance(row, dict):
            warn(pointer, "registered series row must be an object")
            continue
        period_pointer = pointer if entry.shape == "keyed" else _child(pointer, entry.field)
        stated = key if entry.shape == "keyed" else row.get(entry.field)
        try:
            identity = canonical_period(entry, stated)
            if identity is None:
                warn(period_pointer, "period identity is absent or null", refuses=False)
            elif (entry.grammar == "calendar_period" and cadence in ("monthly", "quarterly")
                  and identity[0] != {"monthly": "month", "quarterly": "quarter"}[cadence]):
                _invalid("period identity disagrees with stated cadence")
        except PeriodError as error:
            warn(period_pointer, str(error))
            identity = None
        rows.append(PeriodRow(identity, pointer, row))
        if identity is not None:
            if identity in seen and section != "cash_flow_series":
                issues.append(PeriodIssue("PS-02", "error", period_pointer,
                                          "duplicate canonical period identity"))
            seen.add(identity)
    return SeriesInspection(tuple(rows), tuple(issues), malformed)


def select_period_row(payload, section, series, selector):
    """Select a row in an already selected payload, without first/last/sum rules.

    This is not resolvePeriodPath: expression parsing, variants, leaves and
    override addressing are separate unfinished boundaries.
    """
    if (section, series) not in PERIOD_SERIES:
        _invalid("unregistered period series")
    requested = parse_period_selector(selector)
    inspected = inspect_period_series(payload, section, series)
    if inspected.malformed:
        _invalid("malformed registered period series")
    matches = [row.value for row in inspected.rows if row.identity == requested]
    if any(issue.code == "PS-02" for issue in inspected.issues) or len(matches) > 1:
        raise PeriodError("CALC-PERIOD-002", "duplicate canonical period identity")
    return matches[0] if matches else None
