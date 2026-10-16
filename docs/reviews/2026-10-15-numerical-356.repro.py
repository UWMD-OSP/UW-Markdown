"""Independent arithmetic experiments from Protocol VIII.3/9; no verifier claim.

Usage: python3 this-file.py BUILT_REPO NODE_BINARY [NODE_BINARY ...]
No expectations are regenerated. Candidate multiplication is not current law.
"""
import collections
import decimal
import importlib.util
import json
import math
import pathlib
import platform
import struct
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
spec = importlib.util.spec_from_file_location("kernel", ROOT / "implementations/python/uwmd_numeric.py")
kernel = importlib.util.module_from_spec(spec)
spec.loader.exec_module(kernel)


def bits(number):
    return struct.pack(">d", number).hex()


def product(base, exponent):
    """Candidate ONLY; reciprocal after positive-order multiplication."""
    if not float(exponent).is_integer() or abs(exponent) > 10000:
        raise ValueError("candidate integer domain")
    result = 1.0
    for _ in range(abs(int(exponent))):
        result *= base
    return 1.0 / result if exponent < 0 else result


def ordered_npv(rate, flows, power=pow):
    result = 0.0
    for index, amount in enumerate(flows):
        result += amount / power(1.0 + rate, index)
    return result


def dated_npv(rate, flows):
    result = 0.0
    for row in flows:
        result += row["amount"] * pow(1.0 + rate, -row["t"])
    return result


def bisect_value(function, failure):
    """Specification's fixed bracket and stopping procedure, no polishing."""
    endpoints = [-0.999, 10.0]
    left, right = (function(point) for point in endpoints)
    if not all(map(math.isfinite, (left, right))) or left * right > 0:
        raise ValueError(failure)
    if left == 0:
        return endpoints[0]
    if right == 0:
        return endpoints[1]
    for _ in range(200):
        midpoint = (endpoints[0] + endpoints[1]) / 2
        value = function(midpoint)
        if abs(value) < 1e-9 or (endpoints[1] - endpoints[0]) / 2 < 1e-12:
            return midpoint
        if left * value < 0:
            endpoints[1] = midpoint
        else:
            endpoints[0], left = midpoint, value
    raise ValueError(failure)


def compute(name, arguments, power=pow):
    # These financial expressions are independently constructed test oracles.
    # VIII.3 does not spell out every pmt/fv/pv association/domain detail.
    if name == "integer_product":
        return product(*arguments)
    if name == "pow":
        value = power(*arguments)
        if not math.isfinite(value):
            raise ValueError("CALC-TYPE-001")
        return value
    if name in ("log", "exp"):
        return getattr(math, name)(arguments[0])
    if name == "npv":
        return ordered_npv(arguments[0], arguments[1:], power)
    if name == "irr":
        return bisect_value(lambda rate: ordered_npv(rate, arguments, power), "CALC-IRR-DIVERGE")
    if name == "xnpv":
        return dated_npv(arguments[1], arguments[0])
    if name == "xirr":
        return bisect_value(lambda rate: dated_npv(rate, arguments[0]), "CALC-XIRR-DIVERGE")
    rate, second, third, *optional = arguments
    last = optional[0] if optional else 0
    if name == "pmt":
        return third / second if rate == 0 else third * rate / (1 - power(1 + rate, -second))
    if name == "fv":
        return last + third * second if rate == 0 else last * power(1 + rate, second) + third * (power(1 + rate, second) - 1) / rate
    if name == "pv":
        return third * second + last if rate == 0 else third * (1 - power(1 + rate, -second)) / rate + last * power(1 + rate, -second)
    if name == "nper":
        return (third - last) / second if rate == 0 else math.log((second - last * rate) / (second - third * rate)) / math.log(1 + rate)
    raise ValueError("unknown experiment")


def vectors():
    result = []

    def add(name, arguments):
        result.append({"id": len(result), "fn": name, "args": arguments})

    for base in [0.001000000000000001, 0.5, 0.99, 1.00000001, 1.0041666666666667, 1.01, 1.055, 1.1, 1.2, 2, 11]:
        for exponent in [-360, -31, -3, -1, 0, 1, 2, 3, 7, 31, 360, 1 / 365, -366 / 365, 1 / 12, 2.5]:
            add("pow", [base, exponent])
            if float(exponent).is_integer():
                add("integer_product", [base, exponent])
    for base, exponent in [(0.0, 0), (-2, 3), (-2, -3), (1e200, -2), (1e155, -2), (1e-200, 2), (0.5, 1074)]:
        add("integer_product", [base, exponent])
        add("pow", [base, exponent])
    for number in [1e-15, 0.001, 0.5, 0.99, 1.00000001, 1.01, 1.1, 2, 10, 100, 1e15]:
        add("log", [number])
    for number in [-745, -700, -1, 0, 0.01, 0.1, 1, 10, 700]:
        add("exp", [number])
    for rate in [0, 1e-16, 1e-12, 0.004166666666666667, 0.01, 0.055, -0.001, 0.5]:
        for periods in [1, 3, 31, 360, 2.5]:
            for name, args in [("pmt", [rate, periods, 1000000]), ("fv", [rate, periods, 1000, 1000000]),
                               ("pv", [rate, periods, 1000, 1000000])]:
                add(name, args)
        add("nper", [rate, 60000, 1000000, 0])
        add("npv", [rate, -1000000, 50000, 60000, 70000, 1100000])
        dated = [{"t": 0, "amount": -1000000}, {"t": 181 / 365, "amount": 50000},
                 {"t": 366 / 365, "amount": 1100000}]
        add("xnpv", [dated, rate])
    for flows in [[-100, 110], [-100, 230, -132], [-1, 11], [-1, 20], [-1, 0.001],
                  [-1000000, 50000, 60000, 70000, 1100000]]:
        add("irr", flows)
    for target in [10.0, 4.5005, 1.75075, -0.9]:
        for exponent in range(1, 61):
            add("irr", [-1.0] + [0.0] * (exponent - 1) + [pow(1 + target, exponent)])
    # Synthetic cancellation and tie-adjacent search, no private deal material.
    for index in range(1, 1201):
        count = 2 + index % 19
        rate = [-0.9989, -0.9, 0.0000005, 0.0550005, 0.5, 9.99][index % 6]
        scale = [1, 1e6, 1e16, 1e22][index % 4]
        flows = [-scale] + [scale * 0.01 * ((index + offset) % 7) for offset in range(count - 1)]
        residual = ordered_npv(rate, flows)
        flows.append(-residual * pow(1 + rate, count))
        add("irr", flows)
        add("npv", [rate, *flows])
        dated = [{"t": offset * 366 / 365, "amount": amount} for offset, amount in enumerate(flows)]
        add("xirr", [dated])
    return result


def observe(vector, power=pow):
    try:
        value = compute(vector["fn"], vector["args"], power)
        if not math.isfinite(value):
            return {"id": vector["id"], "nonfinite": str(value)}
        return {"id": vector["id"], "value": value, "bits": bits(value),
                "quantized": [bits(kernel.quantize(value, places)) for places in [2, 6, 12]]}
    except (ValueError, ZeroDivisionError, OverflowError) as error:
        return {"id": vector["id"], "error": str(error)}


def compare(vectors_, left, right):
    counts = collections.Counter()
    examples = {}
    for vector, first, second in zip(vectors_, left, right):
        if first == second:
            continue
        # Textual exception wording is not evidence of a numerical disagreement.
        if "error" in first or "error" in second or "nonfinite" in first or "nonfinite" in second:
            if first.get("error") and first.get("error") == second.get("error"):
                continue
            key = vector["fn"] + ":refusal-or-nonfinite"
        elif first["bits"] != second["bits"]:
            key = vector["fn"] + (":quantized" if first["quantized"] != second["quantized"] else ":raw-only")
        else:
            continue
        counts[key] += 1
        examples.setdefault(key, {"input": vector, "left": first, "right": second})
    return {"counts": dict(sorted(counts.items())), "first_examples": examples}


def stability():
    with decimal.localcontext() as context:
        context.prec = 100
        examples = []
        for base, exponent in [(1.01, 360), (1.00000001, 10000), (1e155, -2), (0.99, -360)]:
            high_precision = decimal.Decimal.from_float(base) ** exponent
            native = pow(base, exponent)
            sequential = product(base, exponent)
            examples.append({"base": base, "exponent": exponent,
                             "decimal_100_digit_reference": str(high_precision),
                             "native": native, "candidate_product": sequential,
                             "native_error_in_ulps": str(abs(decimal.Decimal.from_float(native) - high_precision) / decimal.Decimal.from_float(math.ulp(native))),
                             "product_error_in_native_ulps": str(abs(decimal.Decimal.from_float(sequential) - high_precision) / decimal.Decimal.from_float(math.ulp(native)))})
        return examples


def main():
    cases = vectors()
    python_results = [observe(vector) for vector in cases]
    reports = {}
    nodes = []
    for executable in sys.argv[2:]:
        output = subprocess.run([executable, str(HERE / "2026-10-15-numerical-356.probe.mjs"), sys.argv[1]],
                                input=json.dumps(cases), text=True, capture_output=True, check=True)
        observation = json.loads(output.stdout)
        nodes.append(observation)
        reports["python-vs-" + observation["runtime"]] = compare(cases, python_results, observation["results"])
    for observation in nodes[:-1]:
        reports[observation["runtime"] + "-vs-" + nodes[-1]["runtime"]] = compare(cases, observation["results"], nodes[-1]["results"])
    candidates = [vector for vector in cases if vector["fn"] in ("npv", "irr", "pmt", "pv", "fv")
                  and (vector["fn"] in ("npv", "irr") or float(vector["args"][1]).is_integer())]
    reports["python-current-vs-candidate-product"] = compare(candidates, [observe(v) for v in candidates],
                                                          [observe(v, product) for v in candidates])
    print(json.dumps({"contract_commit": "a18ed8ee7f502e2bd538c3c96be1584f94c458b9", "python": sys.version,
                      "platform": platform.platform(), "vector_count": len(cases),
                      "runtimes": [{key: value for key, value in node.items() if key != "results"} for node in nodes],
                      "stability": stability(), "comparisons": reports}, indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
