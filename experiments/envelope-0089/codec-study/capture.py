"""Read-only evidence verification by default. --capture is first creation only."""
import argparse
import hashlib
import json
import platform
from pathlib import Path
import subprocess
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUT = HERE / "evidence"
HASH = lambda raw: hashlib.sha256(raw).hexdigest()


def verify():
    evidence = json.loads((OUT / "observations.json").read_text(encoding="utf8"))
    assert evidence["status"] == "UNAPPROVED RFC0089 BOUNDED RESEARCH / NOT CONFORMANCE OR AUTHENTICATION"
    for item in evidence["closure"]: assert HASH((ROOT / item["path"]).read_bytes()) == item["sha256"], item["path"]
    for result in evidence["commands"]:
        assert result["exit_code"] == 0
        for stream in ("stdout", "stderr"):
            artifact = result[stream]
            assert Path(artifact["path"]).name == artifact["path"]
            assert HASH((OUT / artifact["path"]).read_bytes()) == artifact["sha256"]
    matrix = json.loads((HERE / "fixtures/manifest.json").read_text())
    for case in matrix["cases"]:
        for item in case["artifacts"]:
            raw = (HERE / "fixtures" / case["case"] / item["path"]).read_bytes()
            assert len(raw) == item["bytes"] and HASH(raw) == item["sha256"]
    print("Read-only codec-study evidence closure verified; tests were not rerun")


def capture():
    if OUT.exists(): raise SystemExit("Refusing to overwrite frozen codec-study evidence")
    commands = [["python", "-B", "-m", "unittest", "discover", "-s", "experiments/envelope-0089/codec-study", "-p", "test_codec.py", "-v"], ["node", "--test", "experiments/envelope-0089/codec-study/independent.test.mjs"], ["python", "-B", "experiments/envelope-0089/codec-study/freeze.py", "--check"]]
    streams, results = {}, []
    for i, command in enumerate(commands):
        result = subprocess.run(command, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        print(f"Focused command {i}: exit {result.returncode}")
        if result.returncode:
            sys.stdout.buffer.write(result.stdout + result.stderr)
            raise SystemExit("Focused study failed; evidence not frozen")
        row = {"command": command, "exit_code": result.returncode}
        for stream in ("stdout", "stderr"):
            name = f"command-{i}.{stream}.txt"
            raw = getattr(result, stream)
            streams[name] = raw; row[stream] = {"path": name, "sha256": HASH(raw)}
        results.append(row)
    paths = [p for p in HERE.iterdir() if p.suffix in (".py", ".mjs")]
    paths += [ROOT / "implementations/python/uwmd_jcs.py", HERE.parent / "candidate_codec.py", HERE.parent / "codec-examples/matrix.json", HERE / "fixtures/manifest.json"]
    closure = [{"path": p.relative_to(ROOT).as_posix(), "sha256": HASH(p.read_bytes())} for p in paths]
    evidence = {"status": "UNAPPROVED RFC0089 BOUNDED RESEARCH / NOT CONFORMANCE OR AUTHENTICATION", "source_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT).decode().strip(), "source_tree": subprocess.check_output(["git", "rev-parse", "HEAD^{tree}"], cwd=ROOT).decode().strip(), "base_commit": "0a6e0489025f072f3fde6bab02de76296783fe3e", "runtime": {"python": platform.python_version(), "node": subprocess.check_output(["node", "--version"]).decode().strip(), "platform": platform.system(), "architecture": platform.machine()}, "closure": closure, "commands": results, "scope": {"frozen_cases": 2, "frozen_artifacts": 21, "blocks_per_model": 10, "python_methods": 5, "node_tests": 5, "extras": "every block collection; exact empty root and complete extra members", "source": "independent accounting of preserved mixed-null-default and ordered-history physical source/body hashes", "authentication": "no signatures/receipts issued; no V13 admission expansion", "zip": "canonical STORE bounded research profile; not universal ZIP/CSV support"}, "collector_note": "Initial temporary collector failed displaying successful Node Unicode output through cp1252; no proof file was written. This collector retains raw streams without encoding-dependent display. Frozen answers were unchanged."}
    OUT.mkdir()
    for name, raw in streams.items(): (OUT / name).write_bytes(raw)
    (OUT / "observations.json").write_bytes((json.dumps(evidence, indent=2) + "\n").encode())
    verify()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(); parser.add_argument("--capture", action="store_true"); parser.add_argument("--check", action="store_true"); args = parser.parse_args()
    if args.capture and args.check: parser.error("choose capture or check")
    capture() if args.capture else verify()
