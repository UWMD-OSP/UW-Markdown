"""Independent current Python observations, not an RFC approval or oracle."""
import hashlib
import json
import pathlib
import sys

runtime = pathlib.Path(sys.argv[1]).resolve()
sys.path.insert(0, str(runtime / "implementations/python"))
from uwmd_reader import parse
from uwmd_envelope import source_digest
from uwmd_jcs import canonicalize

inputs = json.load(sys.stdin)
rows = []
for item in inputs["sources"]:
    raw = item["source"].encode("utf-8")
    document = parse(raw)
    projection = document.projection()
    try:
        digest = {"returned": source_digest(document)}
    except Exception as error:
        digest = {"refused": type(error).__name__, "message": str(error)}
    rows.append({"id": item["id"], "source_sha256": hashlib.sha256(raw).hexdigest(),
                 "physical_block_count": len(document.source.blocks), "projection": projection,
                 "envelope_digest": digest})
unicode_rows = []
for item in inputs["unicode"]:
    try:
        canonical = canonicalize(item["value"])
        result = {"returned": canonical, "utf8_hex": canonical.encode("utf-8").hex()}
    except Exception as error:
        result = {"refused": type(error).__name__, "message": str(error)}
    unicode_rows.append({"id": item["id"], "result": result})
print(json.dumps({"python": sys.version, "sources": rows, "unicode": unicode_rows}, ensure_ascii=True))
