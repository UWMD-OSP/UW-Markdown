"""Read-only identities/log/artifact check; does not rerun codec experiments."""
import hashlib
import json
from pathlib import Path
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]

def sha(raw): return hashlib.sha256(raw).hexdigest()
record = json.loads((HERE / "evidence/observations.json").read_bytes())
for path, digest in record["closure_sha256"].items(): assert sha((ROOT / path).read_bytes()) == digest, path
for execution in record["executions"]:
    assert execution["exit_code"] == 0
    for stream in ("stdout", "stderr"):
        item = execution[stream]
        raw = (HERE / "evidence" / item["path"]).read_bytes()
        assert len(raw) == item["bytes"] and sha(raw) == item["sha256"], item["path"]
manifest_bytes = (HERE / "fixtures/manifest.json").read_bytes()
assert sha(manifest_bytes) == record["fixture_manifest_sha256"]
manifest = json.loads(manifest_bytes)
for path, digest in manifest["source_inputs"].items(): assert sha((HERE / path).read_bytes()) == digest
expected = {"manifest.json"}
for case in manifest["cases"]:
    for item in case["artifacts"]:
        path = case["case"] + "/" + item["path"]
        raw = (HERE / "fixtures" / path).read_bytes()
        assert len(raw) == item["bytes"] and sha(raw) == item["sha256"], path
        expected.add(path)
actual = {p.relative_to(HERE / "fixtures").as_posix() for p in (HERE / "fixtures").rglob("*") if p.is_file()}
assert actual == expected and len(expected) == 28
print("PASS immutable empty-carrier evidence: closure, raw streams, 28 artifacts; no experiment rerun")
