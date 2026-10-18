"""Read-only RFC 0088 candidate-source audit; downloads bytes, never executes C.

Usage: python this-file.py [--source-dir PATH]
No selected kernel, numeric oracle, conformance claim, or dependency installation.
"""
import argparse
import hashlib
import json
import pathlib
import re
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
MANIFEST = HERE / "2026-10-15-fdlibm-closure-356.sources.json"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=pathlib.Path)
    args = parser.parse_args()
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    observations = []
    for entry in manifest["files"]:
        if args.source_dir:
            data = (args.source_dir / entry["file"]).read_bytes()
        else:
            # These are fixed public HTTPS source URLs, never executable inputs.
            with urllib.request.urlopen(entry["url"], timeout=30) as response:
                data = response.read(65537)
        if len(data) != entry["bytes"]:
            raise ValueError(f'{entry["file"]}: source length changed')
        digest = hashlib.sha256(data).hexdigest()
        if digest != entry["sha256"]:
            raise ValueError(f'{entry["file"]}: source hash changed')
        code = re.sub(r"/\*.*?\*/", "", data.decode("ascii"), flags=re.S)
        loops = re.findall(r"\b(?:for|while|do)\b", code)
        if loops != entry["loop_tokens"]:
            raise ValueError(f'{entry["file"]}: loop inventory changed')
        observations.append({"file": entry["file"], "bytes": len(data),
                             "sha256": digest, "loop_tokens": loops})
    print(json.dumps({"purpose": manifest["purpose"],
                      "files": observations,
                      "total_source_bytes": sum(item["bytes"] for item in observations),
                      "numeric_execution": False}, indent=2))


if __name__ == "__main__":
    main()
