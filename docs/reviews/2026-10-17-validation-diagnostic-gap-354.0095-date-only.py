"""Independent RFC0095 U3 date-only research; no production implementation.

Run: python this_file.py --vectors this_file.vectors.json --output observations.json
The default vector file is the same basename with .vectors.json replacing .py.
Expected verdicts are manually authored, frozen inputs; this procedure does not
import UWMD code, a host date parser, regular expressions, or a clock.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path

FROZEN_VECTORS_SHA256 = "f8d3ebc4aef8b0992edf2a333cc53fa2325b869c680ba990158225f18c6e7400"


def date_only(value):
    """Exactly ASCII YYYY-MM-DD, real Gregorian date, year 0001..9999."""
    if not isinstance(value, str) or len(value) != 10:
        return False
    if value[4] != "-" or value[7] != "-":
        return False
    digits = []
    for position in (0, 1, 2, 3, 5, 6, 8, 9):
        digit = ord(value[position]) - ord("0")
        if digit < 0 or digit > 9:
            return False
        digits.append(digit)
    year = digits[0] * 1000 + digits[1] * 100 + digits[2] * 10 + digits[3]
    month = digits[4] * 10 + digits[5]
    day = digits[6] * 10 + digits[7]
    if year < 1 or year > 9999 or month < 1 or month > 12:
        return False
    leap = year % 400 == 0 or (year % 4 == 0 and year % 100 != 0)
    days = (31, 29 if leap else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)
    return 1 <= day <= days[month - 1]


def required_as_of_carrier(value):
    """Research carrier context, not another date value or diagnostic allocation.

    Only the authored object examples are evaluated here. Unknown siblings are
    retained; no other parent/container contract is selected or invented.
    """
    if not isinstance(value, dict):
        raise TypeError("Carrier vectors must explicitly supply an object")
    present = "as_of" in value
    return dict(field_present=present, date_evaluated=present,
                required_missing=not present,
                admitted=date_only(value["as_of"]) if present else False)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--vectors", type=Path, default=Path(__file__).with_suffix(".vectors.json"))
    parser.add_argument("--output", type=Path, required=True)
    arguments = parser.parse_args()
    raw = arguments.vectors.read_bytes()
    vector_hash = hashlib.sha256(raw).hexdigest()
    if vector_hash != FROZEN_VECTORS_SHA256:
        raise ValueError("Frozen vector bytes changed")
    vectors = json.loads(raw)
    before = copy.deepcopy(vectors)
    dates = []
    carriers = []
    for case in vectors["date_cases"]:
        actual = date_only(case["input"])
        dates.append(dict(id=case["id"], admitted=actual))
        if actual is not case["admitted"]:
            raise AssertionError((case["id"], actual, case["admitted"]))
    for case in vectors["required_as_of_carriers"]:
        actual = required_as_of_carrier(case["input"])
        expected = {key: case[key] for key in actual}
        carriers.append(dict(id=case["id"], **actual))
        if actual != expected:
            raise AssertionError((case["id"], actual, expected))
    if vectors != before or arguments.vectors.read_bytes() != raw:
        raise AssertionError("Source vectors or inputs changed")
    result = dict(kind="Independent research observation, not production or conformance activation",
        base_head=vectors["base_head"], reference_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        vectors_sha256=vector_hash,
        summary=dict(date_cases=len(dates), admitted=sum(case["admitted"] for case in dates),
                     refused=sum(not case["admitted"] for case in dates),
                     carrier_cases=len(carriers), passed=len(dates) + len(carriers), failed=0),
        date_observations=dates, carrier_observations=carriers)
    arguments.output.write_text(json.dumps(result, ensure_ascii=True, allow_nan=False, indent=2) + "\n",
                                encoding="utf8", newline="\n")
    print(json.dumps(dict(summary=result["summary"], output=str(arguments.output),
        sha256=hashlib.sha256(arguments.output.read_bytes()).hexdigest()), sort_keys=True))


if __name__ == "__main__":
    main()
