"""Freeze an existing measurement; no rerun or expected-output mutation."""
import argparse
import collections
import gzip
import hashlib
import io
import json
import pathlib
import re
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument("manifest")
parser.add_argument("--failed-attempt")
args = parser.parse_args()
manifest_path = pathlib.Path(args.manifest)
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
scratch = pathlib.Path(manifest["scratch_evidence"])
base = manifest_path.parent
evidence = base / "evidence"
evidence.mkdir(exist_ok=True)
sha = lambda data: hashlib.sha256(data).hexdigest()
artifacts = []
for kind, directory in [("completed", scratch)] + ([("failed-before-case-execution", pathlib.Path(args.failed_attempt))] if args.failed_attempt else []):
    for source in sorted(directory.iterdir()):
        if not source.is_file():
            continue
        raw = source.read_bytes()
        compressed = io.BytesIO()
        with gzip.GzipFile(fileobj=compressed, mode="wb", filename="", mtime=0, compresslevel=9) as target:
            target.write(raw)
        blob = compressed.getvalue()
        target = evidence / (("failed-" if kind.startswith("failed") else "") + source.name + ".gz")
        target.write_bytes(blob)
        if gzip.decompress(blob) != raw:
            raise ValueError("Archive failed exact round-trip")
        artifacts.append({"kind": kind, "path": target.relative_to(base).as_posix(),
                          "raw_bytes": len(raw), "raw_sha256": sha(raw),
                          "gzip_bytes": len(blob), "gzip_sha256": sha(blob)})

# The six observed changes are retained verbatim, then classified only if
# removing the three exact timestamp fields makes the full source identical.
def timestamps(text):
    text = re.sub(r'last_modified:\s*"[^"\r\n]*"', 'last_modified: "<volatile>"', text)
    text = re.sub(r'"timestamp":\s*"[^"\r\n]*"', '"timestamp": "<volatile>"', text)
    return re.sub(r'ts=\S+', 'ts=<volatile>', text)

for case in manifest["cases"]:
    for change in case["observed_changes"]:
        if (change["path"] == "/result/content" and isinstance(change["baseline"], str)
                and isinstance(change["candidate"], str)
                and timestamps(change["baseline"]) == timestamps(change["candidate"])):
            change["classification"] = "volatile_timestamp_only"
            change["classification_rule"] = "Exact full-string equality after replacing last_modified, annotation ts and metadata timestamp; no numeric or integrity-hash field removed"

# Re-read the preserved events, including receiptBaseline's JSON string
# parameter, to establish exactly which receipt fields were observed.
def events(mode):
    with (scratch / (mode + ".events.ndjson")).open(encoding="utf-8") as stream:
        return {json.dumps([row["suite"], row["scenario"]], separators=(",", ":")): row
                for line in stream for row in [json.loads(line)] if row["kind"] == "case"}

receipts = []
old_events, new_events = events("baseline"), events("candidate")
for case in manifest["cases"]:
    if case["suite"] != "receipts":
        continue
    pair = []
    for table in (old_events, new_events):
        snap = table[case["id"]]["snapshot"]
        identity = {}
        for name, value in snap.items():
            if name == "actual" and isinstance(value, str):
                try:
                    value = json.loads(value)
                except json.JSONDecodeError:
                    continue
            if isinstance(value, dict) and isinstance(value.get("computation"), dict):
                identity[name] = {"subject": value.get("subject"),
                                  "results_digest": value["computation"].get("results_digest"),
                                  "engine": value["computation"].get("engine"),
                                  "engine_version": value["computation"].get("engine_version"),
                                  "results": value["computation"].get("results"),
                                  "signature": value.get("signature")}
        pair.append(identity)
    receipts.append({"id": case["id"], "baseline_observed": pair[0], "candidate_observed": pair[1],
                     "observed_equal": pair[0] == pair[1],
                     "coverage": "captured_receipt_fields" if pair[0] else "no_receipt_produced_or_captured",
                     "signature_payload_authenticated": False})

manifest["receipt_identity_observations"] = receipts
manifest["evidence_artifacts"] = artifacts
manifest.pop("scratch_evidence")
manifest["measurement_harness"] = {
    "commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=base, text=True).strip(),
    "files": {name: sha((base / name).read_bytes()) for name in ("measure.mjs", "hook.mjs", "runtime.mjs")},
    "failed_attempt": "Initial injected import displaced the runner hashbang; parsing stopped before any case. The committed loader fix removes the executable hashbang from the in-memory module body."}
# Baseline and candidate load identical transformed text; factor it once.
old = manifest["runs"]["baseline"].pop("transformations")
new = manifest["runs"]["candidate"].pop("transformations")
if old != new:
    raise ValueError("Unexpected transformation difference between measurement modes")
manifest["transformations"] = old
manifest["summary"]["volatile_timestamp_only_cases"] = sum(
    bool(c["observed_changes"]) and all(d.get("classification") == "volatile_timestamp_only" for d in c["observed_changes"])
    for c in manifest["cases"])
manifest["summary"]["raw_primitive_word_changes"] = len(manifest["primitive_changes_when_aligned"])
manifest["summary"]["primitive_changes_by_site"] = dict(collections.Counter(d["site"] for d in manifest["primitive_changes_when_aligned"]))
manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
print(json.dumps({"manifest": manifest_path.name, "summary": manifest["summary"],
                  "archive_bytes": sum(x["gzip_bytes"] for x in artifacts), "artifacts": len(artifacts)}, indent=2))
