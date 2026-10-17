"""Read-only verification of RFC0091's preserved impact evidence.

The archive preserves exact raw observations, not a regenerated conformance
baseline. To repeat actual observations use actor-inventory.mjs sources/cli/native
on independently built baseline and candidate checkouts (observer only; its
actor-specific proposal fields are historical and are not RFC0091 oracles).
The receipts.mjs companion executes real issuance and public-test crypto.
"""
from __future__ import annotations
import base64
import collections
import gzip
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PREFIX = Path(__file__).with_suffix("")
MANIFEST = PREFIX.with_suffix(".implementation.json")
ARCHIVE = PREFIX.with_suffix(".implementation.json.gz")

def verify():
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    raw = ARCHIVE.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == manifest["archive_sha256"]
    decoded = gzip.decompress(raw)
    assert hashlib.sha256(decoded).hexdigest() == manifest["decoded_archive_sha256"]
    packed = json.loads(decoded)
    assert manifest["files"] == {name: {k: v for k, v in item.items() if k != "base64"} for name, item in packed.items()}
    files = {}
    for name, item in packed.items():
        value = base64.b64decode(item["base64"])
        assert len(value) == item["bytes"]
        assert hashlib.sha256(value).hexdigest() == item["sha256"], name
        files[name] = value
    load = lambda name: json.loads(files[name])
    old, new = load("baseline-sources"), load("candidate-sources")
    changed = {}
    counts = collections.Counter()
    for before, after in zip(old["sources"], new["sources"], strict=True):
        assert before["path"] == after["path"]
        assert before["sha256"] == after["sha256"]
        assert before.get("model") == after.get("model")
        assert before["parse"] == after["parse"]
        assert hashlib.sha256((ROOT / after["path"]).read_bytes()).hexdigest() == after["sha256"]
        if before.get("actual") == after.get("actual"):
            continue
        oi, ni = before["actual"]["issues"], after["actual"]["issues"]
        flags = [x for x in ni if x["code"] in ("META-02", "META-03")]
        assert [x for x in ni if x not in flags] == oi
        assert after["actual"]["errors"] == before["actual"]["errors"] + len(flags)
        assert all(x["severity"] == "error" for x in flags)
        counts.update(x["code"] for x in flags)
        changed[after["path"]] = flags
    predicted = load("original-diagnostic-packet")["two_boolean_exposure"]
    for item in predicted:
        actual = changed[item["path"]]
        assert [(x["section"], x["field"], x["code"]) for x in actual] == [
            (x["section"], x["field"], x["proposed_code"]) for x in item["findings"]]
    assert len(predicted) == 205
    assert sum(len(changed[x["path"]]) for x in predicted) == 943
    assert counts == {"META-02": 506, "META-03": 455}
    assert len(changed) == 223
    assert load("baseline-cli")["cases"] == load("candidate-cli")["cases"]
    assert len(load("candidate-cli")["cases"]) == 111
    bn, cn = load("baseline-native"), load("candidate-native")
    consumers = lambda value: [x for x in value["journal"] if x["kind"].startswith("consumer-api")]
    assert consumers(bn) == consumers(cn)
    assert len(consumers(cn)) == 32
    assert bn["actual"]["report"]["summary"] == {"pass": 1095, "fail": 0, "updated": 0}
    assert cn["actual"]["report"]["summary"] == {"pass": 1090, "fail": 5, "updated": 0}
    failures = [(x["suite"], x["scenario"]) for x in cn["journal"] if x["kind"] == "indexed-case" and x["status"] == "fail"]
    assert failures == [("capital-stack", "senior-reconciles-debt-structure")] + [("standalone", "profiles/" + x) for x in ("lease-abstract-v1", "source-note-v1", "inline-deal", "externalized-deal")]
    # Every original corpus artifact remains byte-identical except one explicitly
    # attributed diagnostic expectation; its original bytes remain in the archive.
    allowed = "conformance/capital-stack/senior-reconciles-debt-structure/expected.json"
    authored_history = ROOT / "examples/standalone/authored-2026-10-17/history.json"
    additions = {}
    if authored_history.exists():
        # The owner's later option(a) adds NEW positive cases; preserve every
        # original indexed assertion and financial expectation, in original order.
        history = json.loads(authored_history.read_text(encoding="utf-8"))
        additions = {x["path"]: x for x in history["additive_originals"]}
        assert set(additions) == {"conformance/corpus-index.json", "conformance/metrics/expected.json"}
    for artifact in load("baseline-catalog")["artifacts"]:
        path = artifact["path"]
        if path in additions:
            original = base64.b64decode(additions[path]["base64"])
            assert hashlib.sha256(original).hexdigest() == artifact["sha256"]
            before, now = json.loads(original), json.loads((ROOT / path).read_text(encoding="utf-8"))
            if isinstance(before, list):
                assert now[:len(before)] == before and len(now) == len(before) + 4
                assert all(x["example"].startswith("standalone/authored-2026-10-17/") for x in now[len(before):])
            else:
                assert {**now, "cases": now["cases"][:len(before["cases"]) ]} == before
                assert len(now["cases"]) == len(before["cases"]) + 11
                assert all("authored" in x["scenario"] for x in now["cases"][len(before["cases"]):])
        elif path != allowed:
            assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == artifact["sha256"], path
    before = load("original-capital-expectation")
    after = json.loads((ROOT / allowed).read_text(encoding="utf-8"))
    assert set(after) == set(before) == {"why", "agree_codes", "mismatch_codes"}
    assert after["why"].startswith("RFC0091 candidate:")
    for key in ("agree_codes", "mismatch_codes"):
        assert after[key] == sorted(before[key] + ["META-02", "META-03"])
    for row in load("actual13-cli")["rows"]:
        baseline, candidate = row["engines"]["baseline"], row["engines"]["candidate"]
        assert candidate["exit"] == 1
        assert baseline["exit"] == (0 if row["path"].startswith("examples/") else 1)
        result = candidate["result"]
        for partition, severity in [("errors", "error"), ("warnings", "warning"), ("info", "info")]:
            assert result[partition] == [x for x in result["issues"] if x["severity"] == severity]
        assert hashlib.sha256((ROOT / row["path"]).read_bytes()).hexdigest() == row["source_sha256"]
    receipt = load("receipt-boundary")
    assert len(receipt["rows"]) == 4
    assert [x["expected_error_delta"] for x in receipt["rows"]] == [0, 1, 1, 2]
    for row in receipt["rows"]:
        assert row["issued"]["baseline"]["subject"] == row["issued"]["candidate"]["subject"]
        assert row["issued"]["baseline"]["computation"] == row["issued"]["candidate"]["computation"]
        for result in row["results"]:
            assert result["valid"]["verdict"] == result["unsigned"]["verdict"] == "verified"
            assert result["invalid"]["verdict"] == "failed"
            assert result["noBackend"]["verdict"] == "unverifiable"
    print(json.dumps({"sources": len(new["sources"]), "changed_direct_api_sources": len(changed), "original_uwx_sources": len(predicted), "original_uwx_findings": 943, "extra_fragment_findings": 18, "portable_cli_equal": 111, "native_consumer_events_equal": 32, "original_native_differences": len(failures), "receipt_vectors": 4, "archive_sha256": manifest["archive_sha256"]}))

if __name__ == "__main__":
    verify()
