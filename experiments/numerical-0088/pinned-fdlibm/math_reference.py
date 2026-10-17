"""Independent bounded exact-rational accuracy evidence, NOT fdlibm emulation.

No float, Decimal, host libm, native C or candidate import. Log uses certified
atanh-series tails; exp uses positive Taylor tails then exact reciprocal.
Sqrt/power use the existing bounded adjacent-midpoint proof. These mathematical
answers do not select or redefine the candidate's procedure-specific answers.
"""
from fractions import Fraction
import importlib.util
from pathlib import Path
ROOT = Path(__file__).resolve().parent
HELPER = ROOT.parent / "power-procedures" / "reference.py"
spec = importlib.util.spec_from_file_location("bounded_midpoint_0088", HELPER)
P = importlib.util.module_from_spec(spec)
spec.loader.exec_module(P)


def dyadic_power(n):
    return Fraction(1 << n) if n >= 0 else Fraction(1, 1 << -n)


def log_interval(x, terms):
    k = x.numerator.bit_length() - x.denominator.bit_length()
    if x < dyadic_power(k):
        k -= 1
    m = x / dyadic_power(k)
    def atanh_series(v):
        z = (v - 1) / (v + 1)
        square, term, total = z * z, z, Fraction(0)
        for j in range(terms):
            total += term / (2 * j + 1)
            term *= square
        # z is nonnegative: every omitted term is positive and denominator
        # >=2N+1, so the geometric tail gives a rigorous enclosing interval.
        return 2 * total, 2 * (total + term / ((2 * terms + 1) * (1 - square)))
    a, b = atanh_series(m)
    c, d = atanh_series(Fraction(2))
    return (a + k * c, b + k * d, k) if k >= 0 else (a + k * d, b + k * c, k)


def exp_interval(x, terms):
    x_abs = abs(x)
    if x_abs > 1:
        raise ValueError("Bounded exponential reference admits |x|<=1 only")
    total, term = Fraction(1), Fraction(1)
    for j in range(1, terms + 1):
        term *= x_abs / j
        total += term
    following = term * x_abs / (terms + 1)
    upper = total + following / (1 - x_abs / (terms + 2))
    return (total, upper) if x >= 0 else (1 / upper, 1 / total)


def answer(case):
    x_bits = P.word(case["x"])
    x = P.rational(x_bits)
    op = case["op"]
    if op in ("sqrt", "pow"):
        y_bits = P.word(case["y"]) if op == "pow" else 0x3fe0000000000000
        return P.mathematical_power(x_bits, y_bits)
    if op == "scalbn":
        n = case["n"]
        if x == 0:
            return {"status": "finite", "bits": case["x"], "proof": "signed zero exact scaling"}
        # Finite input exponent range proves these final bounds independently
        # of the source's wrapped signed32 exponent-sum implementation.
        if n > 4096:
            return {"status": "rounded_overflow", "bits": P.hexword(P.INF | (x_bits & P.SIGN)), "proof": "finite nonzero input and n>4096"}
        if n < -4096:
            return {"status": "finite", "bits": P.hexword(x_bits & P.SIGN), "proof": "finite input and n<-4096 below half-minsub"}
        result = P.nearest(x * dyadic_power(n), negative_zero=bool(x_bits & P.SIGN))
        return {"status": "rounded_overflow" if not P.finite(result) else "finite", "bits": P.hexword(result), "proof": "exact rational scaling and adjacent midpoint"}
    for terms in (80, 128, 256):  # Bounded proof generator, never a kernel budget.
        if op == "log":
            if x <= 0:
                raise ValueError("Real log accuracy controls require x>0")
            lower, upper, k = log_interval(x, terms)
        elif op == "exp":
            lower, upper = exp_interval(x, terms)
            k = None
        else:
            raise ValueError("Unknown independent reference operation")
        low_word, high_word = P.nearest(lower), P.nearest(upper)
        if low_word == high_word:
            return {"status": "finite", "bits": P.hexword(low_word), "proof": {
                "method": "atanh-geometric-tail" if op == "log" else "exp-Taylor-tail-reciprocal",
                "terms": terms, "normalization_exponent": k,
                "lower": str(lower), "upper": str(upper)}}
    raise ArithmeticError("Bounded rational interval cannot certify unique binary64 answer")
