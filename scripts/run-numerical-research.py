"""Run isolated frozen RFC0088 controls; collect evidence, never regenerate it."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
LABS = (
    ("power-procedures", "candidates.test.mjs", "freeze.py"),
    ("cash-graphs", "cash_candidates.test.mjs", "freeze_cash.py"),
    ("integer-dispatch", "hybrid.test.mjs", "freeze.py"),
)


def hashes():
    paths = subprocess.check_output(
        ["git", "ls-files", "-z", "--", "experiments/numerical-0088"], cwd=ROOT
    ).decode("utf-8").split("\0")
    return {p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in paths if p}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--python-controls", action="store_true")
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    report = {
        "scope": "UNACCEPTED PROCEDURE RESEARCH; frozen cases only; no tier or full-kernel claim",
        "python_controls_requested": args.python_controls,
        "python": sys.version,
        "platform": platform.platform(),
        "machine": platform.machine(),
        "runner_image": {key: os.environ.get(key) for key in ("ImageOS", "ImageVersion", "RUNNER_OS", "RUNNER_ARCH")},
        "github": {key: os.environ.get(key) for key in ("GITHUB_SHA", "GITHUB_HEAD_REF", "GITHUB_BASE_REF", "RESEARCH_HEAD_SHA")},
        "commands": [],
        "status": "failed",
    }
    failed = False
    before = None
    try:
        report["checkout_commit"] = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
        report["checkout_tree"] = subprocess.check_output(["git", "rev-parse", "HEAD^{tree}"], cwd=ROOT, text=True).strip()
        report["node"] = json.loads(subprocess.check_output([
            "node", "-p", "JSON.stringify({node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch})"
        ], cwd=ROOT, text=True))
        before = hashes()
        report["tracked_hashes_before"] = before
        commands = []
        version = tuple(int(part) for part in report["node"]["node"].removeprefix("v").split(".")[:2])
        # Node18.0 emits TAP directly; later versions support explicit reporter
        # selection, avoiding their runtime-dependent default reporter.
        node_runner = ["node"] + (["--test-reporter=tap"] if version >= (18, 8) else [])
        for name, test, freeze in LABS:
            folder = Path("experiments/numerical-0088") / name
            # Direct entry works on the declared Node18.0 floor; --test arrived later.
            kind = "js-assertions" if name == "integer-dispatch" else "js"
            runner = ["node"] if kind == "js-assertions" else node_runner
            commands.append((name + "-js", runner + [str(folder / test)], kind))
            if args.python_controls:
                commands.extend([
                    (name + "-freeze", [sys.executable, "-B", str(folder / freeze), "--check"], "freeze"),
                    (name + "-python", [sys.executable, "-B", "-m", "unittest", "discover", "-s", str(folder), "-p", "test_*.py", "-v"], "python"),
                ])
        for name, command, kind in commands:
            started = time.monotonic()
            try:
                run = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=180)
                stdout, stderr, code = run.stdout, run.stderr, run.returncode
            except subprocess.TimeoutExpired as error:
                stdout = (error.stdout or b"").decode("utf-8", errors="replace")
                stderr = (error.stderr or b"").decode("utf-8", errors="replace") + "\nCONTROL TIMEOUT"
                code = None
            (output / (name + ".stdout.log")).write_text(stdout, encoding="utf-8")
            (output / (name + ".stderr.log")).write_text(stderr, encoding="utf-8")
            complete = code == 0
            counts = {}
            if kind == "js":
                counts = {key: int(value) for key, value in re.findall(r"^# (tests|pass|fail|cancelled|skipped|todo)\s+(\d+)\s*$", stdout, re.M)}
                complete = complete and counts.get("tests", 0) > 0 and counts.get("pass") == counts.get("tests")
                complete = complete and all(counts.get(key) == 0 for key in ("fail", "cancelled", "skipped", "todo"))
            elif kind == "js-assertions":
                match = re.fullmatch(r"PASS (\d+) independent JS classifications and result/trace records\s*", stdout)
                expected = len(json.loads((ROOT / "experiments/numerical-0088/integer-dispatch/inputs.json").read_text())["cases"])
                complete = complete and match is not None and int(match[1]) == expected and expected > 0
                counts = {"frozen_cases": int(match[1]), "classification_comparisons": int(match[1]),
                          "result_trace_comparisons": int(match[1])} if match else {}
            elif kind == "python":
                match = re.search(r"Ran (\d+) tests? in", stderr)
                counts = {"methods": int(match[1])} if match else {}
                complete = complete and counts.get("methods", 0) > 0 and re.search(r"^OK\s*$", stderr, re.M) is not None
            failed = failed or not complete
            report["commands"].append({"id": name, "argv": command, "exit_code": code,
                "seconds": round(time.monotonic() - started, 6), "complete": complete, "counts": counts})
            print(name, "PASS" if complete else "INCOMPLETE/FAILED", counts, flush=True)
    except Exception as error:
        failed = True
        report["collection_error"] = type(error).__name__ + ": " + str(error)
    finally:
        if before is not None:
            try:
                after = hashes()
                report["tracked_hashes_after"] = after
                report["mutated_paths"] = sorted(key for key in before.keys() | after.keys() if before.get(key) != after.get(key))
                failed = failed or bool(report["mutated_paths"])
            except Exception as error:
                failed = True
                report["post_hash_error"] = str(error)
        report["status"] = "passed_frozen_controls_only" if not failed else "failed_or_incomplete"
        (output / "provenance.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
