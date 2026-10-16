"""Independent RFC 8785 canonical JSON; no runtime or package dependency."""
import json
import math


class CanonicalizationError(ValueError):
    pass


def _number(value):
    """ECMAScript shortest decimal: exact rational candidate distances, ties even.

    Search at most 17 significant digits (binary64 round-trip bound), then use
    ECMAScript fixed/exponent display thresholds. Never expand int(float).
    """
    if isinstance(value, int):
        try:
            converted = float(value)
            if not math.isfinite(converted) or value != converted:
                raise CanonicalizationError("integer is not exactly representable as binary64")
            value = converted
        except OverflowError as error:
            raise CanonicalizationError("number exceeds binary64") from error
    if not math.isfinite(value):
        raise CanonicalizationError("nonfinite number")
    if value == 0:
        return "0"
    sign, value = ("-", -value) if value < 0 else ("", value)
    numerator, denominator = value.as_integer_ratio()
    magnitude = len(str(numerator)) - len(str(denominator))
    def power_ratio(exponent):
        return (10 ** exponent, 1) if exponent >= 0 else (1, 10 ** -exponent)
    a, b = power_ratio(magnitude)
    if numerator * b >= denominator * a:
        magnitude += 1
    for precision in range(1, 18):
        exponent = magnitude - precision
        a, b = power_ratio(exponent)
        quotient = numerator * b // (denominator * a)
        candidates = []
        for coefficient in (quotient, quotient + 1):
            if coefficient <= 0 or float(str(coefficient) + "e" + str(exponent)) != value:
                continue
            distance = abs(coefficient * a * denominator - numerator * b)
            candidates.append((distance, coefficient % 2, coefficient))
        if candidates:
            coefficient = min(candidates)[2]
            while coefficient % 10 == 0:
                coefficient //= 10
                exponent += 1
            digits = str(coefficient)
            position = len(digits) + exponent
            if len(digits) <= position <= 21:
                return sign + digits + "0" * (position - len(digits))
            if 0 < position <= 21:
                return sign + digits[:position] + "." + digits[position:]
            if -6 < position <= 0:
                return sign + "0." + "0" * -position + digits
            power = position - 1
            fraction = "." + digits[1:] if len(digits) > 1 else ""
            return sign + digits[0] + fraction + "e" + ("+" if power >= 0 else "") + str(power)
    raise CanonicalizationError("no binary64 decimal representation")


def canonicalize(value):
    """Exact UTF-8 preimage as text. Reject non-JSON values and lone surrogates."""
    def string(text):
        try:
            text.encode("utf-8", errors="strict")
        except UnicodeError as error:
            raise CanonicalizationError("invalid Unicode") from error
        return json.dumps(text, ensure_ascii=False, separators=(",", ":"))
    def serialize(item):
        if item is None:
            return "null"
        if isinstance(item, bool):
            return "true" if item else "false"
        if isinstance(item, str):
            return string(item)
        if isinstance(item, (int, float)):
            return _number(item)
        if isinstance(item, list):
            return "[" + ",".join(serialize(child) for child in item) + "]"
        if isinstance(item, dict):
            if any(not isinstance(key, str) for key in item):
                raise CanonicalizationError("JSON member names must be strings")
            for key in item:
                string(key)
            keys = sorted(item, key=lambda key: key.encode("utf-16-be"))
            return "{" + ",".join(string(key) + ":" + serialize(item[key]) for key in keys) + "}"
        raise CanonicalizationError("non-JSON value")
    try:
        return serialize(value)
    except (RecursionError, OverflowError) as error:
        raise CanonicalizationError("canonicalization resource failure") from error
