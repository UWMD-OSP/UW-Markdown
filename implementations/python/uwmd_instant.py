"""Instants for DQ-05 gap staleness, as the reference reads `last_checked`.

Format §4.22 says a gap older than the freshness threshold
is stale (DQ-05) but not how a `last_checked` without a time or an offset is
placed in time. The reference parses it with ECMAScript `Date.parse`, so this
module implements the ECMAScript Date Time String Format (ECMA-262 §21.4.1.32):

- `YYYY`, `YYYY-MM`, `YYYY-MM-DD` and the six-digit signed extended years;
- optionally `THH:mm`, `:ss` and a fraction (truncated to milliseconds);
- optionally `Z` or a `+HH:mm` / `-HH:mm` offset.

A date-only form is UTC midnight; a date-time form without an offset is the
host's local time, exactly as ECMAScript specifies. Strings outside the format
are not instants (the finding is not assessed), including the host-specific
legacy forms some engines also accept. Out-of-range fields are not instants.
"""
from datetime import datetime, timedelta, timezone
import re


_FORMAT = re.compile(
    r"(?P<year>[0-9]{4}|[+-][0-9]{6})(?:-(?P<month>[0-9]{2})(?:-(?P<day>[0-9]{2}))?)?"
    r"(?:[Tt](?P<hour>[0-9]{2}):(?P<minute>[0-9]{2})(?::(?P<second>[0-9]{2})(?:\.(?P<fraction>[0-9]+))?)?"
    r"(?P<zone>[Zz]|[+-][0-9]{2}:?[0-9]{2})?)?\Z")
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
    if match is None or match["year"] == "-000000":
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
    if hour == 24 and (minute or second or millis):
        return None
    if hour > 24 or minute > 59 or second > 59:
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
    # No offset on a date-time: the host's local time zone (ECMA-262).
    try:
        local = datetime(year, month, day) + timedelta(hours=hour, minutes=minute, seconds=second)
        seconds = round(local.timestamp())
    except (OverflowError, OSError, ValueError):
        return None
    return seconds * 1000 + millis


def instant_milliseconds(instant):
    """Exact integer milliseconds of an aware datetime (no float rounding)."""
    return (instant - _EPOCH) // timedelta(milliseconds=1)
