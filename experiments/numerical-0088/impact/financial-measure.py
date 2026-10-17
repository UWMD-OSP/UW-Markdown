"""Run bounded public financial/receipt controls, without running conformance."""
import argparse
import gzip
import hashlib
import io
import json
import os
import pathlib
import shutil
import subprocess
import tempfile

parser = argparse.ArgumentParser()
parser.add_argument("--repo-root", required=True)
parser.add_argument("--candidate", required=True)
parser.add_argument("--output-dir", required=True)
args = parser.parse_args()
repo = pathlib.Path(args.repo_root).resolve()
candidate = pathlib.Path(args.candidate).resolve()
output = pathlib.Path(args.output_dir).resolve()
output.mkdir(parents=True, exist_ok=True)
base = pathlib.Path(__file__).resolve().parent
scratch = pathlib.Path(tempfile.mkdtemp(prefix="uwmd-0088-financial-"))
sha = lambda raw: hashlib.sha256(raw).hexdigest()
git = lambda *cmd: subprocess.check_output(["git", *cmd], cwd=repo, text=True, encoding="utf-8").strip()
tracked = git("ls-files", "-z").split("\0")
protected = [p for p in tracked if p and (p.startswith(("spec/", "conformance/", "packages/", "implementations/")) or p in ("VERSIONS.md", "package.json", "package-lock.json"))]
dist = sorted(p for package in (repo / "packages").iterdir() if package.is_dir()
              for p in (package / "dist").rglob("*.js"))
protected_before = {p: sha((repo / p).read_bytes()) for p in protected}
dist_before = {p.relative_to(repo).as_posix(): sha(p.read_bytes()) for p in dist}
candidate_before = {p.relative_to(candidate.parent).as_posix(): sha(p.read_bytes())
                    for p in sorted(candidate.parent.rglob("*")) if p.is_file()}
harness = {name: sha((base / name).read_bytes()) for name in ("financial-measure.py", "financial-driver.mjs", "hook.mjs", "runtime.mjs")}
artifacts = []
reports = {}
for mode in ("baseline", "candidate"):
    events = scratch / (mode + ".events.ndjson")
    transforms = scratch / (mode + ".transforms.ndjson")
    events.write_text("", encoding="utf-8")
    transforms.write_text("", encoding="utf-8")
    result_path = scratch / (mode + ".financial.json")
    env = {**os.environ, "RESEARCH_REPO_ROOT": str(repo), "RESEARCH_MODE": mode,
           "RESEARCH_CANDIDATE": str(candidate), "RESEARCH_EVENTS": str(events),
           "RESEARCH_TRANSFORMS": str(transforms), "RESEARCH_FINANCIAL_OUTPUT": str(result_path)}
    if mode == "candidate":
        env["RESEARCH_PRIOR_RECEIPTS"] = str(scratch / "baseline.financial.json")
    child = subprocess.run([shutil.which("node"), "--experimental-loader", (base / "hook.mjs").as_uri(),
                            str(base / "financial-driver.mjs")], cwd=repo, env=env, capture_output=True)
    (scratch / (mode + ".stdout.txt")).write_bytes(child.stdout)
    (scratch / (mode + ".stderr.txt")).write_bytes(child.stderr)
    if child.returncode:
        raise RuntimeError(f"Focused {mode} process failed {child.returncode}; preserved {scratch}")
    reports[mode] = json.loads(result_path.read_text(encoding="utf-8"))
    (output / (mode + ".financial.json")).write_bytes(result_path.read_bytes())
    print(child.stdout.decode("utf-8").strip())
if protected_before != {p: sha((repo / p).read_bytes()) for p in protected}:
    raise ValueError("Protected source/schema/corpus/version input changed")
if dist_before != {p.relative_to(repo).as_posix(): sha(p.read_bytes()) for p in dist}:
    raise ValueError("Fresh build changed")
if candidate_before != {p.relative_to(candidate.parent).as_posix(): sha(p.read_bytes())
                        for p in sorted(candidate.parent.rglob("*")) if p.is_file()}:
    raise ValueError("Candidate closure changed")
for source in sorted(scratch.iterdir()):
    raw = source.read_bytes()
    packed = io.BytesIO()
    with gzip.GzipFile(fileobj=packed, filename="", mode="wb", mtime=0, compresslevel=9) as stream:
        stream.write(raw)
    blob = packed.getvalue()
    target = output / (source.name + ".gz")
    target.write_bytes(blob)
    if gzip.decompress(blob) != raw:
        raise ValueError("Evidence gzip failed exact round-trip")
    artifacts.append({"path": target.name, "raw_bytes": len(raw), "raw_sha256": sha(raw),
                      "gzip_bytes": len(blob), "gzip_sha256": sha(blob)})

before = {row["id"]: row for row in reports["baseline"]["observations"]}
after = {row["id"]: row for row in reports["candidate"]["observations"]}
if before.keys() != after.keys() or reports["baseline"]["source"] != reports["candidate"]["source"]:
    raise ValueError("Focused input identity changed")
changes = [{"id": key, "baseline": before[key], "candidate": after[key]}
           for key in before if before[key] != after[key]]
receipts = []
for row in reports["candidate"]["receipts"]:
    for check in row["historical"]:
        receipts.append({"id": row["id"], "identity": check["identity"], "signature": check["signature"],
                         "result": check["result"], "backend_call_count": len(check["backend_calls"]),
                         "old_subject_digest": check["receipt"]["subject"]["digest"],
                         "old_results_digest": check["receipt"]["computation"]["results_digest"],
                         "old_signing_payload_sha256": check["signing_payload_sha256"],
                         "receipt_unchanged": check["receipt_unchanged"], "source_unchanged": check["source_unchanged"]})
manifest = {"scope": "Unaccepted focused candidate financial/receipt observations; no normative answers, release action or cryptographic authentication",
            "repository_commit": git("rev-parse", "HEAD"), "repository_tree": git("rev-parse", "HEAD^{tree}"),
            "harness_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=base, text=True).strip(),
            "harness_sha256": harness, "runtime": reports["candidate"]["runtime"],
            "source_sha256": reports["candidate"]["source_sha256"],
            "source_fixture": reports["candidate"]["source_fixture"], "source_fixture_sha256": reports["candidate"]["source_fixture_sha256"],
            "protected_input_hashes": protected_before, "built_input_hashes": dist_before,
            "candidate_closure_sha256": candidate_before, "protected_and_candidate_inputs_unchanged": True,
            "artifacts": artifacts, "public_observation_cases": len(before), "starter_debt_cases": len(reports["candidate"]["debts"]),
            "observed_financial_changes": changes, "candidate_verification_of_baseline_receipts": receipts,
            "claims": {"normative_acceptance": False, "complete_verifier_conformance": False,
                       "historical_receipt_rewrite_authorized": False, "stub_is_cryptographic_evidence": False}}
(output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8", newline="\n")
print(json.dumps({"cases": len(before), "changed_financial_cases": len(changes), "candidate_receipt_checks": len(receipts), "output": str(output)}))
