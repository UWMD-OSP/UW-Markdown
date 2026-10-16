"""Independent, incomplete Python numeric kernel from Protocol VIII.5/9.1.

This is not a Reader/Verifier or a claimed implementation of calc-evaluate.
No TypeScript imports, subprocesses, reference output lookup, or dependencies.
"""

import datetime
import math


def quantize(value, places):
    """VIII.5 decimal-string shift; one half-away boundary, positive zero.

    Calc round_to domain only. Stated-precision domains need a separate API.
    """
    if isinstance(places, bool) or not isinstance(places, int) or not -12 <= places <= 12:
        raise ValueError("CALC-TYPE-001")
    if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value):
        raise ValueError("CALC-TYPE-001")
    value = float(value)
    # repr is Python's shortest round-tripping decimal, not Decimal.from_float.
    coefficient, _, exponent = repr(abs(value)).lower().partition("e")
    shifted = float(coefficient + "e" + str(int(exponent or 0) + places))
    if not math.isfinite(shifted) or shifted > 9007199254740991:
        return 0.0 if value == 0 else value
    integer = int(shifted) if shifted.is_integer() else math.floor(shifted + 0.5)
    result = float(str(integer) + "e" + str(-places))
    return 0.0 if result == 0 else math.copysign(result, value)


def calendar_date(text):
    """VIII.3 strict Gregorian YYYY-MM-DD predicate, never coerce."""
    if not isinstance(text, str) or len(text) != 10:
        return False
    if text[4] != "-" or text[7] != "-":
        return False
    digits = text[:4] + text[5:7] + text[8:]
    if any(character not in "0123456789" for character in digits):
        return False
    try:
        datetime.date(int(text[:4]), int(text[5:7]), int(text[8:]))
        return True
    except ValueError:
        return False


def year_fraction(first, last, convention):
    """VIII.9.1; closed registry, ordered dates; divide last."""
    if not calendar_date(first) or not calendar_date(last):
        raise ValueError("invalid calendar date")
    start, end = datetime.date.fromisoformat(first), datetime.date.fromisoformat(last)
    if end < start:
        raise ValueError("dates out of order")
    if convention == "actual/365f":
        return (end - start).days / 365
    if convention == "actual/360":
        return (end - start).days / 360
    if convention == "30/360us":
        left = min(start.day, 30)
        right = 30 if end.day == 31 and left == 30 else end.day
        return ((end.year - start.year) * 360 + (end.month - start.month) * 30 + right - left) / 360
    raise ValueError("unknown day-count convention")


def cash_totals(amounts):
    """VIII.9.4 ordered total_net and moic; missing is not zero.

    Returns None for an undefined MOIC (no contributed capital). No overall
    verification verdict is implied; source binding/validation are not present.
    """
    total = incoming = outgoing = 0.0
    for amount in amounts:
        if isinstance(amount, bool) or not isinstance(amount, (int, float)) or not math.isfinite(amount):
            raise ValueError("finite stated amount required")
        total += amount
        if amount > 0:
            incoming += amount
        elif amount < 0:
            outgoing += -amount
        if not all(map(math.isfinite, (total, incoming, outgoing))):
            raise ValueError("finite cash totals required")
    return total, incoming / outgoing if outgoing else None
