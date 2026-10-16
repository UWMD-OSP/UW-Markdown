"""Isolated exact cash-graph / decimal-boundary evidence, not a UWMD evaluator.

No production, libm, float, Decimal, repr or Node imports. The predecessor
experiment supplies exact binary64 words, rational basic rounding and power
alternatives; its frozen evidence and source are unchanged.
"""
from fractions import Fraction
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
POWER_SOURCE = ROOT.parent / "power-procedures" / "reference.py"
_spec = importlib.util.spec_from_file_location("isolated_exact_power_reference", POWER_SOURCE)
POWER = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(POWER)
ONE, SIGN = POWER.ONE, POWER.SIGN
rational, nearest, word, hexword = POWER.rational, POWER.nearest, POWER.word, POWER.hexword
GRAPHS = POWER.GRAPHS
LO = 0xbfeff7ced916872b  # Exact binary64 encoding of the accepted -0.999 endpoint.
HI = 0x4024000000000000  # Exact 10.0.


def decimal_scale(exponent):
    return Fraction(10 ** exponent) if exponent >= 0 else Fraction(1, 10 ** -exponent)


def shortest(bits):
    """Independently select shortest round-tripping decimal by exact distances.

    Return signed coefficient and base-10 exponent, not a host formatted string.
    Tests compare native ECMAScript conversion separately; this is a bounded
    evidence tool, not a new production serializer.
    """
    if not POWER.finite(bits):
        raise ValueError("Nonfinite decimal boundary")
    value = abs(rational(bits))
    if not value:
        return 0, 0
    magnitude = len(str(value.numerator)) - len(str(value.denominator))
    while value < decimal_scale(magnitude):
        magnitude -= 1
    while value >= decimal_scale(magnitude + 1):
        magnitude += 1
    for digits in range(1, 18):
        exponent = magnitude - digits + 1
        unit = decimal_scale(exponent)
        scaled = value / unit
        low = scaled.numerator // scaled.denominator
        candidates = [c for c in (low, low + 1) if c > 0 and nearest(c * unit) == (bits & (SIGN - 1))]
        if candidates:
            coefficient = min(candidates, key=lambda c: (abs(c * unit - value), c % 2))
            while coefficient % 10 == 0:
                coefficient //= 10
                exponent += 1
            return -coefficient if bits & SIGN else coefficient, exponent
    raise ValueError("No shortest binary64 decimal found")


def number_token(bits):
    coefficient, exponent = shortest(bits)
    sign = "-" if coefficient < 0 else ""
    digits = str(abs(coefficient))
    position = len(digits) + exponent
    if len(digits) <= position <= 21:
        return sign + digits + "0" * (position - len(digits))
    if 0 < position <= 21:
        return sign + digits[:position] + "." + digits[position:]
    if -6 < position <= 0:
        return sign + "0." + "0" * -position + digits
    power = position - 1
    tail = "." + digits[1:] if len(digits) > 1 else ""
    return sign + digits[0] + tail + "e" + ("+" if power >= 0 else "") + str(power)


def quantize(bits, places):
    """VIII.5 existing decimal-string shift, not rounding exact binary value.

    Select the shortest scientific decimal, shift its exponent and RN to
    binary64. Only then half-away round the shifted binary64, then rebuild the
    result from the integer decimal. No intermediate financial value is rounded.
    """
    if not isinstance(places, int) or isinstance(places, bool) or not 0 <= places <= 12:
        raise ValueError("Outside frozen calc round_to scope")
    coefficient, exponent = shortest(bits)
    sign = -1 if coefficient < 0 else 1
    shifted = nearest(abs(coefficient) * decimal_scale(exponent + places))
    if not POWER.finite(shifted) or rational(shifted) > 9007199254740991:
        result, integer = bits, None
    else:
        value = rational(shifted)
        if value.denominator == 1:
            integer = value.numerator
        else:
            # B(shifted+0.5) occurs before floor, as in the accepted boundary.
            bumped = rational(nearest(value + Fraction(1, 2)))
            integer = bumped.numerator // bumped.denominator
        result = nearest(sign * integer * decimal_scale(-places))
    if rational(result) == 0:
        result = 0
    return {"places": places, "coefficient": str(abs(coefficient)), "exponent": exponent,
            "shifted": hexword(shifted), "rounded_integer": None if integer is None else str(integer),
            "bits": hexword(result), "number_token": number_token(result)}


def result_projection(calc_id, bits, places):
    boundary = quantize(bits, places)
    # These fixed ASCII ids and exact number tokens make this exact RFC8785
    # preimage independently auditable; no arbitrary-value JCS implementation.
    if not calc_id.replace("_", "").isalnum() or not calc_id.isascii():
        raise ValueError("Only fixed ASCII research calc ids are supported")
    preimage = '[{"calc_id":"' + calc_id + '","computed":true,"value":' + boundary["number_token"] + '}]'
    return {"quantization": boundary, "results_preimage": preimage,
            "results_digest": "sha256:" + hashlib.sha256(preimage.encode("utf-8")).hexdigest()}


def sign(bits):
    value = rational(bits)
    return "zero" if value == 0 else "negative" if value < 0 else "positive"


class Recorder:
    def __init__(self):
        self.trace = []

    def basic(self, operation, left, right):
        a, b = rational(left), rational(right)
        if operation == "divide" and b == 0:
            self.trace.append([operation, hexword(left), hexword(right), "zero_denominator"])
            raise ArithmeticError("zero_denominator")
        if operation == "add":
            result = nearest(a + b, a == b == 0 and bool(left & right & SIGN))
        elif operation == "multiply":
            result = nearest(a * b, bool((left ^ right) & SIGN))
        else:
            result = nearest(a / b, bool((left ^ right) & SIGN))
        self.trace.append([operation, hexword(left), hexword(right), hexword(result)])
        if not POWER.finite(result):
            raise ArithmeticError("nonfinite_basic")
        return result

    def power(self, base, exponent, graph):
        result = POWER.graph(base, exponent, graph)
        self.trace.append(["power", hexword(base), hexword(exponent), result])
        if result["status"] != "finite":
            raise ArithmeticError(result["status"])
        return word(result["bits"])


def cash_value(rate, flows, graph, exponents=None):
    """Accepted financial association with unaccepted power/refusal adapter.

    Periodic: flow / power(B(1+rate),index). Dated: flow *
    power(B(1+rate),-year_fraction). Exact prederived exponents only; no new day
    count or date solver is implemented. Source rows accumulate left to right.
    """
    recorder = Recorder()
    try:
        base = recorder.basic("add", ONE, rate)
        total = 0
        for index, amount in enumerate(flows):
            exponent = nearest(Fraction(index)) if exponents is None else exponents[index] ^ SIGN
            factor = recorder.power(base, exponent, graph)
            term = recorder.basic("divide" if exponents is None else "multiply", amount, factor)
            total = recorder.basic("add", total, term)
        return {"status": "finite", "bits": hexword(total), "sign": sign(total), "trace": recorder.trace}
    except ArithmeticError as error:
        return {"status": "candidate_refusal", "reason": str(error), "trace": recorder.trace}


def endpoints(flows, graph):
    """Only accepted VIII.3 steps1-3; no bisection/root guess is supplied."""
    low, high = cash_value(LO, flows, graph), cash_value(HI, flows, graph)
    result = {"low": low, "high": high, "comparison_trace": []}
    if low["status"] != "finite" or high["status"] != "finite":
        result.update(status="candidate_refusal", reason="endpoint_unavailable")
        return result
    a, b = word(low["bits"]), word(high["bits"])
    # The accepted sign-product test may overflow to infinity. Preserve its
    # binary64 product/sign rather than replacing it with separate comparisons.
    product = nearest(rational(a) * rational(b), bool((a ^ b) & SIGN))
    result["comparison_trace"].append(["multiply", hexword(a), hexword(b), hexword(product)])
    if not product & SIGN and product & (SIGN - 1):
        result.update(status="no_bracket", prospective_error="CALC-IRR-DIVERGE")
    elif rational(a) == 0:
        result.update(status="endpoint_root", bits=hexword(LO), endpoint="lo")
    elif rational(b) == 0:
        result.update(status="endpoint_root", bits=hexword(HI), endpoint="hi")
    else:
        result.update(status="bisection_required")
    return result


def evaluate(case, graph):
    flows = [word(value) for value in case["flows"]]
    if case["kind"] == "irr-endpoints":
        result = endpoints(flows, graph)
        if result["status"] == "endpoint_root":
            result["reporting"] = result_projection(case["calc_id"], word(result["bits"]), case["places"])
        return result
    powers = [word(value) for value in case["year_fractions"]] if case["kind"] == "dated-prederived" else None
    result = cash_value(word(case["rate"]), flows, graph, powers)
    if result["status"] == "finite":
        result["reporting"] = result_projection(case["calc_id"], word(result["bits"]), case["places"])
    return result


def evidence():
    raw = (ROOT / "inputs.json").read_bytes()
    given = json.loads(raw)
    return {"status": "UNACCEPTED CANDIDATE CASH GRAPH EVIDENCE; no receipt issued",
            "input_sha256": hashlib.sha256(raw).hexdigest(),
            "reference_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            "power_reference_sha256": hashlib.sha256(POWER_SOURCE.read_bytes()).hexdigest(),
            "cases": [{"id": case["id"], "graphs": {name: evaluate(case, name) for name in GRAPHS}} for case in given["cases"]],
            "quantization_controls": [{"id": item["id"], "boundary": quantize(word(item["bits"]), item["places"])}
                                      for item in given["quantization_controls"]]}
