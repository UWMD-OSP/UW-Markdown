"""UNACCEPTED reciprocal-first integer graph; exact-rational step oracle.

All finite integral binary64 exponents, not a production or fractional kernel.
Only the existing isolated word/rational/RN-even helper is reused; no floats.
"""
import hashlib
import importlib.util
import json
from pathlib import Path

HELPER = Path(__file__).resolve().parent.parent / "power-procedures" / "reference.py"
_spec = importlib.util.spec_from_file_location("power_reference_0088", HELPER)
P = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(P)


def classify(x, y):
    if not P.finite(x) or not P.finite(y):
        return {"kind": "nonfinite_input"}
    exponent = P.rational(y)
    if exponent == 0:
        return {"kind": "zero_exponent"}
    if exponent.denominator != 1:
        return {"kind": "fractional", "negative": exponent < 0}
    n = abs(exponent.numerator)
    return {"kind": "integer", "negative": exponent < 0, "odd": bool(n & 1),
            "bit_length": n.bit_length(), "popcount": n.bit_count(),
            "basic_operation_bound": n.bit_length() - 1 + n.bit_count() + int(exponent < 0)}


def graph(x, y):
    trace = []
    def finish(value):
        return dict(value, operations=len(trace), trace_sha256=hashlib.sha256(
            json.dumps(trace, separators=(",", ":")).encode()).hexdigest())
    special = P.dispatch(x, y)
    if special is not None:
        return finish(special)
    category = classify(x, y)
    if category["kind"] == "fractional":
        return finish({"status": "fdlibm_fractional_required"})
    def operation(name, left, right):
        answer = P._basic(name, left, right)
        trace.append([name, P.hexword(left), P.hexword(right), P.hexword(answer)])
        if not P.finite(answer):
            raise ArithmeticError
        return answer
    n, factor, accumulator = abs(P.rational(y).numerator), x, P.ONE
    try:
        if category["negative"]:
            factor = operation("divide", P.ONE, factor)
        while n:
            if n & 1:
                accumulator = operation("multiply", accumulator, factor)
            n //= 2
            if n:  # No unused final square, no underflow-zero shortcut.
                factor = operation("multiply", factor, factor)
        return finish({"status": "finite", "bits": P.hexword(accumulator)})
    except ArithmeticError:
        return finish({"status": "intermediate_nonfinite"})
