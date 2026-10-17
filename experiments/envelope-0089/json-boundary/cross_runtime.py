"""Exact measured cross-runtime replay; retain every actual run outside the repo."""
import argparse
import copy
from datetime import datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path
import shutil
import sys
import tempfile
import traceback
import capture

HERE = Path(__file__).resolve().parent
BASELINE_SHA = "94cb67dc98c2e9a5a9018ce33c0fce421af31474836bd4eabe3651b0bd6bca27"
NODE20_SHA = "d4ea6feb037ba421b78497781f1227de53517d3dd8eb77139741f3009a46b83e"
# Exact proven V8 wording only; never ignore error_message generally.
NATIVE = [
    (32, "trailing-input", "Unexpected non-whitespace character after JSON at position 2 (line 1 column 3)", "Unexpected non-whitespace character after JSON at position 2"),
    (33, "trailing-comma", "Expected double-quoted property name in JSON at position 7 (line 1 column 8)", "Expected double-quoted property name in JSON at position 7"),
]
PROFILES = ("v24.14.1", "v20.20.2")
INPUTS = {32: "dd1cadb254629e9b14afb090f2976f34fdfaaf91cdaba9a57eae86b290ebd0ed",
          33: "aa99a5ce3eb0dd8355f0bfb15376ea1d862ad75d0d278af1f8c280ca8c02c640"}
PROVENANCE_SHA = "1d45f5e81a2d3f6093780ab795d024ab0cb77d33c1e4ff48d2fab0b7296f9de2"

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def pinned():
    raw = (HERE/"evidence/observations.json").read_bytes()
    assert sha(raw) == BASELINE_SHA, "original observation bytes"
    return json.loads(raw)

def expected(profile):
    assert profile in PROFILES, "unmeasured Node runtime: " + profile
    value = copy.deepcopy(pinned())
    stdout = (HERE/"evidence/node.stdout.json").read_bytes()
    for index, vector, old, new in NATIVE:
        row = value["behavior"]["rows"][index]["node"]
        assert (row["case"], row["carrier"], row["vector"]) == ("syntax-only", "json-data", vector)
        assert row["input_sha256"] == INPUTS[index], "exact native syntax input"
        event = row["historical"]
        assert event == dict(accepted=False, error_name="SyntaxError", error_message=old, raw_crypto_verify_calls=0)
        assert stdout.count(old.encode("utf8")) == 1
        if profile == "v20.20.2":
            event["error_message"] = new
            stdout = stdout.replace(old.encode("utf8"), new.encode("utf8"), 1)
    value["raw"]["node_stdout_sha256"] = sha(stdout)
    return value, stdout

def compare(actual, stdin, stdout, stderr):
    baseline, wanted_stdout = expected(actual["runtime"]["node"])
    assert set(actual) == set(baseline) - {"created_at", "executed_git_head"}, "result fields"
    for key in ("scope", "behavior", "source_sha256", "node_dependency_sha256", "raw"):
        assert actual[key] == baseline[key], key
    assert set(actual["runtime"]) == set(baseline["runtime"]), "runtime metadata fields"
    assert stdin == gzip.decompress((HERE/"evidence/node.stdin.json.gz").read_bytes()), "exact stdin"
    assert stdout == wanted_stdout, "exact profiled stdout"
    assert stderr == (HERE/"evidence/node.stderr.txt").read_bytes(), "exact stderr"
    assert {"node_stdin_sha256": sha(stdin), "node_stdout_sha256": sha(stdout), "node_stderr_sha256": sha(stderr)} == actual["raw"], "actual raw hashes"

def check_reference():
    raw = (HERE/"node20-reference/actual.json").read_bytes()
    assert sha(raw) == NODE20_SHA, "exact independently captured Node20 reference"
    assert sha((HERE/"node20-reference/runtime-provenance.json").read_bytes()) == PROVENANCE_SHA, "official Windows runtime reference provenance"
    reference = json.loads(raw)
    assert reference["runtime"]["node"] == "v20.20.2"
    compare(reference, gzip.decompress((HERE/"evidence/node.stdin.json.gz").read_bytes()),
        (HERE/"node20-reference/node.stdout.json").read_bytes(), (HERE/"node20-reference/node.stderr.txt").read_bytes())

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, help="New disposable output directory; must not exist")
    args = parser.parse_args()
    if args.out is None:
        out = Path(tempfile.mkdtemp(prefix="uwmd-json-boundary-replay-"))
    else:
        out = args.out
        out.mkdir(parents=True, exist_ok=False)
    binary = shutil.which("node")
    metadata = dict(started_at=datetime.now(timezone.utc).isoformat(), python=sys.version,
        checker_sha256=sha(Path(__file__).read_bytes()),
        guard_tests_sha256=sha((HERE/"test_cross_runtime.py").read_bytes()),
        node_binary_name=Path(binary).name if binary else None, node_binary_sha256=sha(Path(binary).read_bytes()) if binary else None)
    (out/"execution.json").write_bytes(capture.encoded(metadata))
    original_run = capture.subprocess.run
    calls = []
    # Record real bytes before the original collector's assertions, even if its
    # observer returns nonzero. Its collector/readers/frozen files stay untouched.
    def retained_run(*values, **options):
        result = original_run(*values, **options)
        command = values[0] if values else options.get("args", [])
        if len(command) > 1 and command[1] == str(HERE/"observe.mjs"):
            calls.append(command)
            (out/"node.stdin.json.gz").write_bytes(gzip.compress(options["input"], mtime=0))
            (out/"node.stdout.json").write_bytes(result.stdout)
            (out/"node.stderr.txt").write_bytes(result.stderr)
            (out/"node.process.json").write_bytes(capture.encoded(dict(command=["node", "observe.mjs"], returncode=result.returncode)))
        return result
    capture.subprocess.run = retained_run
    try:
        check_reference()
        actual, stdin, stdout, stderr = capture.run()
        (out/"actual.json").write_bytes(capture.encoded(actual))
        assert len(calls) == 1, "exact observer process count"
        compare(actual, stdin, stdout, stderr)
    except BaseException:
        (out/"failure.txt").write_text(traceback.format_exc(), encoding="utf8")
        (out/"status.json").write_bytes(capture.encoded(dict(passed=False, observer_processes=len(calls))))
        print("JSON boundary replay FAILED; preserved actual evidence: " + str(out), file=sys.stderr)
        raise
    finally:
        capture.subprocess.run = original_run
    (out/"status.json").write_bytes(capture.encoded(dict(passed=True, observer_processes=len(calls), native_syntax_profile=actual["runtime"]["node"])))
    print("JSON boundary cross-runtime PASS:36 vectors; exact material fields and two precise native syntax wording profiles")
    print("Preserved actual streams/provenance: " + str(out))
    print("Runtime (informational): " + json.dumps(actual["runtime"], sort_keys=True))

if __name__ == "__main__":
    main()
