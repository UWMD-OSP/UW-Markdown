"""Freeze new exact-integer evidence once; --check never rewrites evidence."""
import argparse
import hashlib
import json
from pathlib import Path
from hybrid_reference import P, HELPER, classify, graph
ROOT = Path(__file__).resolve().parent


def document():
    raw = (ROOT / "inputs.json").read_bytes()
    return {"status": "UNACCEPTED RESEARCH EVIDENCE", "procedure": "reciprocal-first-binary-integer-v1",
            "oracle": "exact rational RN-even at every basic-operation boundary; not generally one-rounded power",
            "input_sha256": hashlib.sha256(raw).hexdigest(),
            "reference_sha256": hashlib.sha256((ROOT / "hybrid_reference.py").read_bytes()).hexdigest(),
            "reused_rounding_helper_sha256": hashlib.sha256(HELPER.read_bytes()).hexdigest(),
            "max_basic_operations": 1077,
            "cases": [{"id": case["id"], "classification": classify(P.word(case["x"]), P.word(case["y"])),
                       "graph": graph(P.word(case["x"]), P.word(case["y"])),
                       "bounded_mathematical_reference": P.mathematical_power(P.word(case["x"]), P.word(case["y"]))}
                      for case in json.loads(raw)["cases"]]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(); parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    encoded = (json.dumps(document(), indent=2) + "\n").encode()
    target = ROOT / "evidence.json"
    if args.check:
        if target.read_bytes() != encoded:
            raise SystemExit("Frozen evidence mismatch: inspect instead of rewriting")
        print("Frozen integer-dispatch evidence matches")
    else:
        if target.exists():
            raise SystemExit("Refusing to overwrite evidence")
        target.write_bytes(encoded)
        print("Wrote new integer-dispatch evidence")
