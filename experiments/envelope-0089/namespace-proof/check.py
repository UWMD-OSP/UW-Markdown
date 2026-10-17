"""Read-only current replay plus exact preservation of the initial local capture."""
import gzip
import hashlib
import json
from pathlib import Path
import capture

HERE = Path(__file__).resolve().parent
old = HERE / "initial-dbaa5f76"
raw = (old / "observations.json").read_bytes()
assert hashlib.sha256(raw).hexdigest() == "a65ce3d21ad29bfaf960da98607c4dc52bd6469e3ee4ac58c13c7c36a2c38269"
initial = json.loads(raw)
final = json.loads((HERE / "evidence/observations.json").read_bytes())
for name in ("node.stdout.json", "node.stderr.txt"):
    assert (old/name).read_bytes() == (HERE/"evidence"/name).read_bytes(), name
stdin = gzip.decompress((old / "node.stdin.json.gz").read_bytes())
assert hashlib.sha256(stdin).hexdigest() == initial["raw"]["node_stdin_sha256"]
assert json.loads(stdin) == json.loads((HERE / "evidence/node.stdin.json").read_bytes())
assert initial["behavior"] == final["behavior"]
assert initial["node_dependency_sha256"] == final["node_dependency_sha256"]
path = "experiments/envelope-0089/namespace-proof/capture.py"
current_line = b'stdin = json.dumps(inputs, ensure_ascii=True, sort_keys=True, separators=(",", ":")).encode("utf8")'
code = (HERE/"capture.py").read_bytes()
assert code.count(current_line) == 1
restored = code.replace(current_line, b"stdin = encoded(inputs)")
assert hashlib.sha256(restored).hexdigest() == initial["source_sha256"][path]
assert {k: v for k, v in initial["source_sha256"].items() if k != path} == {k: v for k, v in final["source_sha256"].items() if k != path}
capture.main()
print("Initial capture preserved: identical parsed stdin, stdout, stderr and all behavior; only compact JSON transport/code identity differs")
