"""Verify frozen evidence integrity and coverage, not arithmetic conformance."""
import collections
import gzip
import hashlib
import json
import pathlib

base = pathlib.Path(__file__).resolve().parent
manifest = json.loads((base / "observed-impact.json").read_text(encoding="utf-8"))
sha = lambda data: hashlib.sha256(data).hexdigest()
streams = {}
for artifact in manifest["evidence_artifacts"]:
    path = base / artifact["path"]
    if not path.resolve().is_relative_to(base):
        raise ValueError("Evidence path escaped lab")
    packed = path.read_bytes()
    raw = gzip.decompress(packed)
    assert len(packed) == artifact["gzip_bytes"] and sha(packed) == artifact["gzip_sha256"]
    assert len(raw) == artifact["raw_bytes"] and sha(raw) == artifact["raw_sha256"]
    if artifact["kind"] == "completed":
        streams[path.name.removesuffix(".gz")] = raw

case_ids = {case["id"] for case in manifest["cases"]}
assert len(case_ids) == len(manifest["cases"]) == 1089
for mode in ("baseline", "candidate"):
    report = json.loads(streams[mode + ".stdout.json"])
    assert report["summary"] == {"pass": 1089, "fail": 0, "updated": 0}
    rows = [json.loads(line) for line in streams[mode + ".events.ndjson"].splitlines()]
    cases = [row for row in rows if row["kind"] == "case"]
    assert len(cases) == 1089
    assert {json.dumps([row["suite"], row["scenario"]], separators=(",", ":")) for row in cases} == case_ids
    assert not any(row["capture_errors"] for row in cases)
    assert sum(row["kind"] == "primitive" for row in rows) == manifest["runs"][mode]["primitive_count"] == 14145
    assert sha(streams[mode + ".events.ndjson"]) == manifest["runs"][mode]["events_sha256"]
    assert sha(streams[mode + ".transforms.ndjson"]) == manifest["runs"][mode]["transforms_sha256"]

assert manifest["primitive_trace_alignment"] is True
assert len(manifest["primitive_changes_when_aligned"]) == 671
assert sum(case["observation_coverage"].startswith("incomplete") for case in manifest["cases"]) == 108
assert all(case["baseline_status"] == case["candidate_status"] == "pass" for case in manifest["cases"])
assert manifest["summary"]["whole_result_proof_claim"] is False
assert manifest["numeric_sites_not_loaded"] == []
assert all(row["observed_equal"] for row in manifest["receipt_identity_observations"])
print("Frozen impact evidence verified: 1,089 cases per run; 14,145 primitive events per run; 671 raw-word changes; 108 explicitly incomplete actual captures.")
