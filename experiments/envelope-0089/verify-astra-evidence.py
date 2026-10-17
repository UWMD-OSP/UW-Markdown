"""Verify frozen review evidence integrity, not a production conformance claim."""
import hashlib
import json
import pathlib

base = pathlib.Path(__file__).resolve().parent
manifest = json.loads((base / "astra-review-manifest.json").read_text(encoding="utf-8"))
for artifact in manifest["artifacts"]:
    raw = (base / artifact["path"]).read_bytes()
    assert len(raw) == artifact["bytes"]
    assert hashlib.sha256(raw).hexdigest() == artifact["sha256"]
report = (base / "astra-review-external.txt").read_bytes()
assert len(report) == 17559 and hashlib.sha256(report).hexdigest() == "60c4469f95d1317d469362b159dd9be7f1ca37740dad89aaaac6fd5b04d9614d"
evidence = json.loads((base / "astra-review-evidence.json").read_text(encoding="utf-8"))
rows = evidence["extension_projection"]["observations"]
assert len(rows) == 3 and len({r["source_sha256"] for r in rows}) == 3
assert len({r["receipt_subject"]["digest"] for r in rows}) == 1
assert all(r["receipt_verification"]["verdict"] == "verified" for r in rows)
assert len(evidence["selection_controls"]) == 8
assert len(evidence["unicode_admission"]["observations"]) == 11
assert evidence["csv_block_extras"]["observations"][1]["directory_decode"]["code"] == "CSV_DIGEST_MISMATCH"
assert evidence["csv_block_extras"]["observations"][1]["zip_decode"]["code"] == "CSV_DIGEST_MISMATCH"
old = json.loads((base / "astra-jcs-baseline.json").read_text(encoding="utf-8"))
new = json.loads((base / "astra-jcs-proposed.json").read_text(encoding="utf-8"))
assert old["valid_controls"] == new["valid_controls"]
assert len(new["low_level_controls"]) == 24 and all(r["outcome"]["refused"]["name"] == "TypeError" for r in new["low_level_controls"])
assert all(r["receipt_verification"]["verdict"] == "verified" for r in old["public_controls"])
assert all(r["receipt_verification"]["issues"][0]["code"] == "RCP-09" for r in new["public_controls"])
assert all(r["document_verification"]["issues"][0]["code"] == "INT-15" and r["signature_backend_calls"] == 0 for r in new["public_controls"])
assert json.loads((base / "astra-jcs-unit-evidence.json").read_text(encoding="utf-8"))["passed"] == 16
print("Frozen Astra reproduction evidence verified; proposed Unicode guard remains unapplied.")
