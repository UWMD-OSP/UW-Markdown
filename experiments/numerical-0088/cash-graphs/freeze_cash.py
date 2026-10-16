"""Explicit first freeze/check; never rewrite existing experimental evidence."""
import argparse
import json
from pathlib import Path
from cash_reference import evidence

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    target = Path(__file__).with_name("evidence.json")
    data = (json.dumps(evidence(),indent=2,ensure_ascii=True) + "\n").encode()
    if args.check:
        if target.read_bytes() != data:
            raise SystemExit("Cash evidence changed; review rather than regenerate expectations")
        print("Frozen exact cash evidence matches")
    else:
        if target.exists():
            raise SystemExit("Refusing to overwrite existing evidence")
        target.write_bytes(data)
        print("Created first frozen exact cash evidence")
