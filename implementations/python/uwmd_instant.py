"""RFC 0122 strict calendar-valid DQ-05 instants; no local-time admission."""
from datetime import datetime, timedelta, timezone
import re


_FORMAT = re.compile(
    r"(?P<year>[0-9]{4})-(?P<month>[0-9]{2})-(?P<day>[0-9]{2})"
    r"(?:T(?P<hour>[0-9]{2}):(?P<minute>[0-9]{2})(?::(?P<second>[0-9]{2})(?:\.(?P<fraction>[0-9]{1,3}))?)?"
    r"(?P<zone>Z|[+-][0-9]{2}:[0-9]{2}))?\Z")
_EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)
_DAY = 86_400_000


def _days_from_civil(year, month, day):
    """Days since 1970-01-01 on the proleptic Gregorian calendar (any year)."""
    year -= month <= 2
    era = year // 400
    of_era = year - era * 400
    of_year = (153 * (month + (-3 if month > 2 else 9)) + 2) // 5 + day - 1
    of_era_days = of_era * 365 + of_era // 4 - of_era // 100 + of_year
    return era * 146097 + of_era_days - 719468


def _leap(year):
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)


def epoch_milliseconds(text):
    """Integer milliseconds since the epoch, or None when `text` is no instant."""
    if not isinstance(text, str):
        return None
    match = _FORMAT.match(text)
    if match is None or int(match["year"]) < 1:
        return None
    year = int(match["year"])
    month = int(match["month"] or 1)
    day = int(match["day"] or 1)
    if not 1 <= month <= 12:
        return None
    lengths = (31, 29 if _leap(year) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)
    if not 1 <= day <= lengths[month - 1]:
        return None
    days = _days_from_civil(year, month, day)
    if match["hour"] is None:
        return days * _DAY
    hour, minute = int(match["hour"]), int(match["minute"])
    second = int(match["second"] or 0)
    millis = int((match["fraction"] or "0")[:3].ljust(3, "0"))
    if hour > 23 or minute > 59 or second > 59:
        return None
    clock = ((hour * 60 + minute) * 60 + second) * 1000 + millis
    zone = match["zone"]
    if zone is not None:
        offset = 0
        if zone not in ("Z", "z"):
            digits = zone[1:].replace(":", "")
            hours, minutes = int(digits[:2]), int(digits[2:])
            if hours > 23 or minutes > 59:
                return None
            offset = (hours * 60 + minutes) * 60_000 * (1 if zone[0] == "+" else -1)
        return days * _DAY + clock - offset
    return None


def instant_milliseconds(instant):
    """Exact integer milliseconds of an aware datetime (no float rounding)."""
    return (instant - _EPOCH) // timedelta(milliseconds=1)


class ValidationClockError(ValueError):
    category = "validate"
    code = "PROTO-VALIDATION-CLOCK"


def validation_now_milliseconds(value):
    if value is None:
        return instant_milliseconds(datetime.now(timezone.utc))
    if isinstance(value, datetime):
        if value.tzinfo is not None and value.utcoffset() is not None:
            return instant_milliseconds(value)
    else:
        instant = epoch_milliseconds(value)
        if instant is not None:
            return instant
    raise ValidationClockError("The supplied validation clock is not an RFC 0122 instant.")
