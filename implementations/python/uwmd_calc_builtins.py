"""Independent Protocol VIII.3 builtins and accepted RFC 0088 financial graphs.

Arguments are already evaluated, left to right. Only expression logical and
conditional syntax short-circuits; ordinary functions do not select AST nodes.
No modeling, defaults beyond explicit optional arguments, or host pow/log/exp.
"""
import math

from uwmd_calc_errors import CalcError
from uwmd_fdlibm import divide, pinned_pow, pinned_exp, pinned_log
from uwmd_numeric import calendar_date, quantize

BUILTINS = frozenset(("sum", "avg", "min", "max", "coalesce", "if", "round",
    "abs", "floor", "ceil", "sqrt", "pow", "log", "exp", "pmt", "fv", "pv",
    "nper", "npv", "irr", "is_calendar_date"))


def wrong(message):
    raise CalcError("CALC-TYPE-001", message)


def number(value, label="operand", *, nullable=False):
    if value is None and nullable:
        return None
    if type(value) not in (int, float):
        wrong(label + " requires a number" + (" or null" if nullable else ""))
    try:
        result = float(value)
    except OverflowError:
        wrong(label + " is not a binary64 number")
    # Unbounded Python integers are not a second numerical representation.
    if type(value) is int and value != result:
        wrong(label + " is not exactly representable as binary64")
    return result


def _arity(name, arguments, minimum, maximum=None):
    maximum = minimum if maximum is None else maximum
    if not minimum <= len(arguments) <= maximum:
        wrong(name + ": invalid argument count")


def periodic_npv(rate, flows):
    """Raw internal graph: infinite factors may yield finite zero terms."""
    base, total = 1.0 + rate, 0.0
    for index, amount in enumerate(flows):
        total = total + divide(amount, pinned_pow(base, float(index)))
    return total


def periodic_irr(flows):
    """VIII.3 exact bracket, endpoint order, products, stopping and no polish."""
    lo, hi = -0.999, 10.0
    flo, fhi = periodic_npv(lo, flows), periodic_npv(hi, flows)
    if not math.isfinite(flo) or not math.isfinite(fhi) or flo * fhi > 0.0:
        raise CalcError("CALC-IRR-DIVERGE", "IRR has no accepted finite bracket")
    if flo == 0.0:
        return lo
    if fhi == 0.0:
        return hi
    for _ in range(200):
        middle = (lo + hi) / 2.0
        residual = periodic_npv(middle, flows)
        if abs(residual) < 1e-9 or (hi - lo) / 2.0 < 1e-12:
            return middle
        if flo * residual < 0.0:
            hi = middle
        else:
            lo, flo = middle, residual
    raise CalcError("CALC-IRR-DIVERGE", "IRR exhausted its 200-step procedure")


def call_builtin(name, arguments):
    """Raw builtin result, not final quantization or a verification verdict."""
    if name not in BUILTINS:
        raise CalcError("CALC-RESOLVE-001", "Unknown function: " + name)
    if name == "is_calendar_date":
        _arity(name, arguments, 1)
        return calendar_date(arguments[0])
    if name == "coalesce":
        return next((value for value in arguments if value is not None), None)
    if name == "if":
        _arity(name, arguments, 3)
        if type(arguments[0]) is not bool:
            wrong("if condition requires a boolean")
        return arguments[1] if arguments[0] else arguments[2]
    if name in ("sum", "avg", "min", "max"):
        total, count, best = 0.0, 0, None
        for argument in arguments:
            value = number(argument, name, nullable=True)
            if value is None:
                continue
            if name in ("sum", "avg"):
                total = total + value
            elif best is None or (value < best if name == "min" else value > best):
                best = value
            count += 1
        if name == "sum":
            return total
        if name == "avg":
            return total / float(count) if count else None
        return best
    if name == "round":
        _arity(name, arguments, 2)
        if arguments[0] is None:
            return None
        value, places = (number(v, name) for v in arguments)
        if not math.isfinite(places) or not places.is_integer():
            wrong("round places requires an integer")
        try:
            return quantize(value, int(places))
        except ValueError as error:
            raise CalcError("CALC-TYPE-001", "Invalid round input") from error
    if name in ("abs", "floor", "ceil", "sqrt", "pow", "log", "exp"):
        _arity(name, arguments, 2 if name == "pow" else 1)
        # Check every argument's type before pow's null propagation.
        values = [number(value, name, nullable=True) for value in arguments]
        if any(value is None for value in values):
            return None
        value = values[0]
        if name == "abs":
            return abs(value)
        if name in ("floor", "ceil"):
            if not math.isfinite(value) or value == 0.0:
                return value
            result = float(math.floor(value) if name == "floor" else math.ceil(value))
            return math.copysign(0.0, value) if result == 0.0 else result
        if name == "sqrt":
            if value < 0.0:
                wrong("sqrt requires a nonnegative operand")
            return math.sqrt(value)  # Public sqrt is unchanged by RFC 0088.
        if name == "log":
            if value <= 0.0:
                wrong("log requires a positive operand")
            return pinned_log(value)
        result = pinned_exp(value) if name == "exp" else pinned_pow(*values)
        if not math.isfinite(result):
            wrong(name + " has a nonfinite result")
        return result
    if name in ("npv", "irr"):
        _arity(name, arguments, 2, len(arguments) if len(arguments) >= 2 else 2)
        if name == "npv":
            rate = number(arguments[0], name)
            # Preserve financial source order and per-flow type admission.
            flows = [number(value, name) for value in arguments[1:]]
            return periodic_npv(rate, flows)
        return periodic_irr([number(value, name) for value in arguments])
    _arity(name, arguments, 3, 3 if name == "pmt" else 4)
    first, second, third = (number(value, name) for value in arguments[:3])
    fourth = number(arguments[3], name) if len(arguments) == 4 else 0.0
    if name == "pmt":
        rate, periods, principal = first, second, third
        if periods == 0.0:
            wrong("pmt refuses zero periods")
        if rate == 0.0:
            return divide(principal, periods)
        return divide(principal * rate, 1.0 - pinned_pow(1.0 + rate, -periods))
    if name in ("fv", "pv"):
        rate, periods, payment = first, second, third
        if rate == 0.0:
            return fourth + payment * periods if name == "fv" else payment * periods + fourth
        if name == "fv":
            growth = pinned_pow(1.0 + rate, periods)
            return fourth * growth + divide(payment * (growth - 1.0), rate)
        discount = pinned_pow(1.0 + rate, -periods)
        return divide(payment * (1.0 - discount), rate) + fourth * discount
    # NPER: preserve quotient guard order, repeated division and raw log calls.
    rate, payment, principal, future = first, second, third, fourth
    if rate == 0.0:
        if payment == 0.0:
            wrong("nper refuses zero payment at zero rate")
        return divide(principal - future, payment)
    numerator, denominator = payment - future * rate, payment - principal * rate
    if denominator == 0.0 or divide(numerator, denominator) <= 0.0:
        wrong("nper has no real solution")
    numerator_log = pinned_log(divide(numerator, denominator))
    denominator_log = pinned_log(1.0 + rate)
    return divide(numerator_log, denominator_log)
