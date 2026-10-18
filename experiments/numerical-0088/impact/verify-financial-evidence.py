"""Check frozen focused observations, not a new normative arithmetic baseline."""
import gzip
import hashlib
import json
import pathlib

base = pathlib.Path(__file__).resolve().parent / "financial-evidence"
manifest = json.loads((base / "manifest.json").read_text(encoding="utf-8"))
sha = lambda value: hashlib.sha256(value).hexdigest()
for artifact in manifest["artifacts"]:
    packed = (base / artifact["path"]).read_bytes()
    raw = gzip.decompress(packed)
    assert len(packed) == artifact["gzip_bytes"] and sha(packed) == artifact["gzip_sha256"]
    assert len(raw) == artifact["raw_bytes"] and sha(raw) == artifact["raw_sha256"]

old = json.loads((base / "baseline.financial.json").read_text(encoding="utf-8"))
new = json.loads((base / "candidate.financial.json").read_text(encoding="utf-8"))
assert old["source"] == new["source"]
assert sha(old["source"].encode()) == old["source_sha256"] == new["source_sha256"]
assert len(old["observations"]) == len(new["observations"]) == 48
assert len(old["debts"]) == len(new["debts"]) == 5
old_cases = {r["id"]: r for r in old["observations"]}
new_cases = {r["id"]: r for r in new["observations"]}
assert old_cases.keys() == new_cases.keys()
assert old_cases["pow-counterexample"]["public_round12"]["value"]["value"] == "284.851576559724"
assert new_cases["pow-counterexample"]["public_round12"]["value"]["value"] == "284.851576559723"
assert old_cases["pow-counterexample"]["public_default"] == new_cases["pow-counterexample"]["public_default"]
assert old_cases["irr-original-endpoint"]["public_default"]["value"]["value"] == "10"
assert new_cases["irr-original-endpoint"]["public_default"]["error"]["code"] == "CALC-IRR-DIVERGE"
assert old_cases["irr-all-zero"]["public_default"]["value"]["value"] == "-0.999"
assert old_cases["irr-tiny-positive"]["public_default"]["value"]["value"] == "4.5005"
assert old_cases["npv-internal-nonfinite-denominator"]["public_default"]["value"]["value"] == "0"
old_receipts = {r["id"]: r["issued_receipt"] for r in old["receipts"]}
assert all(old_receipts.values())
for row in new["receipts"]:
    assert len(row["historical"]) == 8
    for check in row["historical"]:
        original = old_receipts[row["id"]]
        expected_receipt = original if check["signature"] == "unsigned" else {**original, "signature": {"algorithm": "ed25519", "key_id": "research-placeholder", "value": "AAAA"}}
        assert check["receipt"] == expected_receipt
        assert check["receipt_unchanged"] and check["source_unchanged"]
        codes = [issue["code"] for issue in check["result"]["issues"]]
        verdict = check["result"]["verdict"]
        if check["signature"] == "no-backend":
            assert verdict == "unverifiable" and codes == ["RCP-08"]
            assert not check["backend_calls"]
        elif row["id"] == "irr-original-endpoint":
            assert verdict == "failed" and codes == ["RCP-03"]
            assert check["result"]["recomputed"] == [] and not check["backend_calls"]
        elif check["signature"] == "stub-invalid":
            assert verdict == "failed" and codes == ["RCP-01"] and len(check["backend_calls"]) == 1
        elif row["id"] == "pow-round12":
            assert (verdict, codes) == (("failed", ["RCP-03"]) if check["identity"] == "same" else ("unverifiable", ["RCP-07", "RCP-03"]))
        else:
            assert verdict == "verified" and codes == []
assert len(manifest["previously_unexercised_sites_covered"]) == 10
assert manifest["previously_unexercised_sites_still_unexercised"] == []
assert not any(manifest["claims"].values())
print("Frozen focused evidence verified: 48 public financial cases, 5 starter debt cases, 24 historical receipt controls; all 10 previously unexercised numerical sites reached.")
