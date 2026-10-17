"""Generate independently certified accuracy controls once; --check is read-only."""
import argparse
import hashlib
import json
from pathlib import Path
from math_reference import answer, HELPER
ROOT = Path(__file__).resolve().parent


def document():
    raw = (ROOT / "math-inputs.json").read_bytes()
    return {"status": "UNACCEPTED independent bounded mathematical accuracy controls; not candidate outputs",
            "input_sha256": hashlib.sha256(raw).hexdigest(),
            "reference_sha256": hashlib.sha256((ROOT / "math_reference.py").read_bytes()).hexdigest(),
            "rounding_helper_sha256": hashlib.sha256(HELPER.read_bytes()).hexdigest(),
            "limits": {"power_numerator_magnitude": 256, "power_dyadic_denominator": 16,
                       "exp_absolute_input": 1, "series_terms_attempts": [80, 128, 256]},
            "cases": [{"id": c["id"], "reference": answer(c)} for c in json.loads(raw)["cases"]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(); parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    expected = (json.dumps(document(), indent=2) + "\n").encode()
    target = ROOT / "math-evidence.json"
    if args.check:
        if target.read_bytes() != expected:
            raise SystemExit("Mathematical proof evidence mismatch; inspect rather than rewrite")
        print("Frozen independent mathematical controls match")
    else:
        if target.exists():
            raise SystemExit("Refusing to overwrite mathematical evidence")
        target.write_bytes(expected)
        print("Wrote first independently certified mathematical controls")
