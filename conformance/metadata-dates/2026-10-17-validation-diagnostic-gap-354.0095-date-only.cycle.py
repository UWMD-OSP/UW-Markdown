"""Read-only independent Gregorian-cycle comparison; no string-date parser.

The procedure under test remains the independent adjacent .py reference. The
external oracle is datetime.date(year, month, day) using integer components.
"""
from datetime import date
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
STEM = "2026-10-17-validation-diagnostic-gap-354.0095-date-only"
reference = ROOT / (STEM + ".py")
source = reference.read_bytes()
spec = importlib.util.spec_from_file_location("independent_date_only_reference", reference)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
actual_bits = bytearray()
oracle_bits = bytearray()
mismatches = []
for year in range(1, 401):
    for month in range(1, 13):
        for day in range(0, 33):
            authored = f"{year:04d}-{month:02d}-{day:02d}"
            actual = module.date_only(authored)
            try:
                date(year, month, day)
                expected = True
            except ValueError:
                expected = False
            actual_bits.append(49 if actual else 48)
            oracle_bits.append(49 if expected else 48)
            if actual != expected:
                mismatches.append(dict(input=authored, actual=actual, expected=expected))
if source != reference.read_bytes():
    raise AssertionError("Reference bytes changed")
result = dict(kind="Independent research evidence; no production or normative activation",
    author_base="fa9a9ea37d31b918f5993eae4276b159f31719f3",
    python_wip_source_base="54a44a3bde8bdca75e946b2f1801db672a18e095",
    reference_sha256=hashlib.sha256(source).hexdigest(),
    cycle_source_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    order="year ascending 1..400, then month ascending 1..12, then day ascending 0..32",
    truth_encoding="one ASCII byte 1 for admit or 0 for refuse per ordered input; no separator or newline",
    oracle="Python datetime.date(year, month, day) integer constructor; not string parsing",
    cases=len(actual_bits), admitted=actual_bits.count(49), refused=actual_bits.count(48),
    mismatches=mismatches, truth_sha256=hashlib.sha256(actual_bits).hexdigest(),
    oracle_truth_sha256=hashlib.sha256(oracle_bits).hexdigest())
output = ROOT / (STEM + ".cycle.json")
output.write_text(json.dumps(result, ensure_ascii=True, allow_nan=False, indent=2) + "\n",
                  encoding="utf8", newline="\n")
print(json.dumps(dict(result=result, report_sha256=hashlib.sha256(output.read_bytes()).hexdigest()), sort_keys=True))
if mismatches:
    raise SystemExit(1)
