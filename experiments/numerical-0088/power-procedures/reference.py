"""Exact-rational research oracle. No float, Decimal, libm, Node or production imports.

Finite words are exact dyadic Fractions. Integer arithmetic proves midpoint
comparisons, including binary64 overflow and gradual-underflow rounding.
This is a bounded vector generator/checker, NOT a production power kernel.
"""
from fractions import Fraction
import hashlib
import json

SIGN = 1 << 63
INF = 0x7ff0000000000000
MAX = INF - 1
ONE = 0x3ff0000000000000
LIMIT = 256  # Lab execution budget only, never a proposed UWMD domain.
GRAPHS = ("sequential-late", "binary-late", "binary-early")


def word(text):
    if not isinstance(text, str) or len(text) != 16 or any(c not in "0123456789abcdef" for c in text):
        raise ValueError("Expected a canonical 16-digit hexadecimal word")
    return int(text, 16)


def hexword(bits):
    return f"{bits:016x}"


def finite(bits):
    return bits & INF != INF


def rational(bits):
    if not finite(bits):
        raise ValueError("Nonfinite word has no rational value")
    magnitude = bits & (SIGN - 1)
    exponent, tail = magnitude >> 52, magnitude & ((1 << 52) - 1)
    significand, shift = (tail, -1074) if exponent == 0 else ((1 << 52) | tail, exponent - 1075)
    value = Fraction(significand << shift) if shift >= 0 else Fraction(significand, 1 << -shift)
    return -value if bits & SIGN else value


def nearest(value, negative_zero=False):
    """Correct binary64 RN-even from an exact rational, by adjacent midpoints."""
    sign = SIGN if value < 0 or value == 0 and negative_zero else 0
    value = abs(value)
    # Next exact precision-53 value beyond MAX is 2**1024; its midpoint
    # with MAX is the RN-even overflow boundary (MAX's last bit is odd).
    threshold = rational(MAX) + Fraction(1 << 970)
    if value >= threshold:
        return sign | INF
    lo, hi = 0, MAX
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if rational(mid) <= value:
            lo = mid
        else:
            hi = mid - 1
    if lo == MAX or rational(lo) == value:
        return sign | lo
    upper = lo + 1
    distance = value - (rational(lo) + rational(upper)) / 2
    return sign | (lo if distance < 0 or distance == 0 and lo % 2 == 0 else upper)


def classify(x, y):
    if not finite(x) or not finite(y):
        return {"kind": "nonfinite_input"}
    exponent = rational(y)
    if exponent == 0:
        return {"kind": "zero_exponent"}
    if exponent.denominator != 1:
        return {"kind": "fractional", "negative": exponent < 0}
    n = exponent.numerator
    return {"kind": "integer", "negative": n < 0, "odd": bool(abs(n) & 1),
            "within_lab_budget": abs(n) <= LIMIT}


def dispatch(x, y):
    """One UNACCEPTED special-case table, shared by graph and oracle scope.

    Finite admission precedes specials. Zero exponent -> +1; zero negative
    power refuses; negative nonzero base requires exactly integral exponent.
    """
    category = classify(x, y)
    kind = category["kind"]
    if kind == "nonfinite_input":
        return {"status": "nonfinite_input"}
    exponent, base = rational(y), rational(x)
    if kind == "zero_exponent":
        return {"status": "finite", "bits": hexword(ONE)}
    if base == 0:
        if exponent < 0:
            return {"status": "zero_negative_exponent"}
        negative = bool(x & SIGN) and kind == "integer" and category["odd"]
        return {"status": "finite", "bits": hexword(SIGN if negative else 0)}
    if base < 0 and kind == "fractional":
        return {"status": "negative_fractional_domain"}
    if base == 1 or base == -1:
        negative = base < 0 and category.get("odd", False)
        return {"status": "finite", "bits": hexword(ONE | (SIGN if negative else 0))}
    return None


def _basic(op, left, right):
    sign = bool((left ^ right) & SIGN)
    a, b = rational(left), rational(right)
    if op == "divide" and b == 0:
        return INF | (SIGN if sign else 0)
    exact = a * b if op == "multiply" else a / b
    return nearest(exact, sign)


def graph(x, y, name):
    if name not in GRAPHS:
        raise ValueError("Unknown graph")
    trace = []
    def finish(result):
        result = dict(result)
        result["operations"] = len(trace)
        result["trace_sha256"] = hashlib.sha256(json.dumps(trace, separators=(",", ":")).encode()).hexdigest()
        return result
    special = dispatch(x, y)
    if special is not None:
        return finish(special)
    category = classify(x, y)
    if category["kind"] == "fractional":
        return finish({"status": "fractional_kernel_required"})
    if not category["within_lab_budget"]:
        return finish({"status": "lab_budget_refusal"})
    def operation(op, left, right):
        result = _basic(op, left, right)
        trace.append([op, hexword(left), hexword(right), hexword(result)])
        if not finite(result):
            raise ArithmeticError
        return result
    try:
        n = abs(rational(y).numerator)
        factor, accumulator = x, ONE
        if name == "binary-early" and category["negative"]:
            factor = operation("divide", ONE, factor)
        if name == "sequential-late":
            for _ in range(n):
                accumulator = operation("multiply", accumulator, factor)
        else:
            while n:
                if n & 1:
                    accumulator = operation("multiply", accumulator, factor)
                n //= 2
                if n:  # Never execute an unused final square.
                    factor = operation("multiply", factor, factor)
        if name != "binary-early" and category["negative"]:
            accumulator = operation("divide", ONE, accumulator)
        return finish({"status": "finite", "bits": hexword(accumulator)})
    except ArithmeticError:
        return finish({"status": "intermediate_nonfinite"})


def mathematical_power(x, y):
    """Exact midpoint proof for |p|<=256, q<=16 of y=p/q, q a power of two.

    Compare positive dyadic candidate**q to exact |x|**p. Binary search
    brackets the real root; compare its exact midpoint raised to q. There is
    no guessed decimal precision, and no claim for other real exponents.
    """
    special = dispatch(x, y)
    if special is not None:
        return special
    base, exponent = rational(x), rational(y)
    p, q = exponent.numerator, exponent.denominator
    if abs(p) > LIMIT or q > 16:
        return {"status": "outside_oracle_scope"}
    target = abs(base) ** p
    sign = SIGN if base < 0 and p & 1 else 0
    threshold = rational(MAX) + Fraction(1 << 970)
    if target >= threshold ** q:
        return {"status": "rounded_overflow", "bits": hexword(sign | INF)}
    lo, hi = 0, MAX
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if rational(mid) ** q <= target:
            lo = mid
        else:
            hi = mid - 1
    if rational(lo) ** q == target:
        return {"status": "finite", "bits": hexword(sign | lo), "proof": {"exact": True}}
    if lo == MAX:
        return {"status": "finite", "bits": hexword(sign | lo), "proof": {
            "exact": False, "overflow_midpoint_relation": "below", "lower": hexword(MAX)}}
    upper = lo + 1
    midpoint = (rational(lo) + rational(upper)) / 2
    comparison = target - midpoint ** q
    chosen = lo if comparison < 0 or comparison == 0 and lo % 2 == 0 else upper
    return {"status": "finite", "bits": hexword(sign | chosen), "proof": {
        "exact": False, "lower": hexword(lo), "upper": hexword(upper),
        "midpoint_relation": "below" if comparison < 0 else "above" if comparison > 0 else "tie",
        "denominator": q}}
