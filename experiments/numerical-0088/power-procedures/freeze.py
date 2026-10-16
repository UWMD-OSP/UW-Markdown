"""Recompute exact evidence offline; --check never rewrites frozen data."""
import argparse
import hashlib
import json
from pathlib import Path
from reference import GRAPHS, classify, graph, mathematical_power, word

ROOT = Path(__file__).resolve().parent


def document():
    raw = (ROOT / "inputs.json").read_bytes()
    inputs = json.loads(raw)
    return {"status": "UNACCEPTED RESEARCH EVIDENCE", "oracle": "exact dyadic rational / adjacent binary64 midpoint comparison",
            "input_sha256": hashlib.sha256(raw).hexdigest(),
            "reference_sha256": hashlib.sha256((ROOT / "reference.py").read_bytes()).hexdigest(),
            "oracle_limits": {"absolute_exponent_numerator": 256, "exponent_denominator": 16},
            "cases": [{"id": case["id"], "classification": classify(word(case["x"]), word(case["y"])),
                       "mathematical": mathematical_power(word(case["x"]), word(case["y"])),
                       "graphs": {name: graph(word(case["x"]), word(case["y"]), name) for name in GRAPHS}}
                      for case in inputs["cases"]]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    encoded = (json.dumps(document(), indent=2, ensure_ascii=True) + "\n").encode()
    target = ROOT / "evidence.json"
    if args.check:
        if target.read_bytes() != encoded:
            raise SystemExit("Frozen exact evidence disagrees; inspect rather than auto-update expectations")
        print("Frozen exact evidence matches")
    else:
        if target.exists():
            raise SystemExit("Refusing to overwrite existing evidence; review a separate generation explicitly")
        target.write_bytes(encoded)
        print("Wrote first frozen research evidence")
