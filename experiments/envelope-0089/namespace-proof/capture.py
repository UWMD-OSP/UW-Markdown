"""Read-only replay by default; first freeze requires explicit --create."""
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import platform
import subprocess
import sys
import xml.parsers.expat
from vectors import vectors

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
EVIDENCE = HERE / "evidence"

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def encoded(value):
    return (json.dumps(value, ensure_ascii=True, sort_keys=True, indent=2) + "\n").encode("utf8")

def run():
    spec = importlib.util.spec_from_file_location("namespace_python_codec", HERE.parent / "codec-study/codec.py")
    codec = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(codec)
    inputs = vectors()
    python_rows = []
    for row in inputs:
        try:
            value = codec.decode_xml(row["text"])
            assert codec.canonical(value) == codec.canonical(row["model"]), "complete decoded model mismatch"
            result = dict(accepted=True, complete_model_jcs_sha256=sha(codec.canonical(value).encode("utf8")), semantic_digest=value["semantic_digest"])
        except Exception as error:
            result = dict(accepted=False, error_name=type(error).__name__, error_message=str(error))
        assert result["accepted"] == row["expected_accepted"], (row["case"], row["vector"], result)
        python_rows.append(dict(case=row["case"], vector=row["vector"], input_sha256=row["input_sha256"], **result))
    stdin = encoded(inputs)
    node = subprocess.run(["node", str(HERE / "observe.mjs")], input=stdin, capture_output=True, check=False)
    assert node.returncode == 0, node.stderr.decode("utf8")
    node_value = json.loads(node.stdout.decode("utf8"))
    node_rows = node_value["rows"]
    assert len(node_rows) == len(python_rows) == 36
    for py, js in zip(python_rows, node_rows):
        for key in ("case", "vector", "input_sha256", "accepted"):
            assert py[key] == js[key], (key, py, js)
        if py["accepted"]:
            for key in ("complete_model_jcs_sha256", "semantic_digest"):
                assert py[key] == js[key], (key, py, js)
    paths = ["namespace-proof/capture.py", "namespace-proof/vectors.py", "namespace-proof/reader.mjs", "namespace-proof/observe.mjs", "codec-study/codec.py", "codec-study/independent.mjs", "candidate_codec.py"]
    paths += [f"codec-study/fixtures/{case}/{name}" for case in ("all-block-extras", "xml-lexical-domain") for name in ("model.json", "document.xml")]
    identities = {str((HERE.parent / path).relative_to(ROOT)).replace("\\", "/"): sha((HERE.parent/path).read_bytes()) for path in paths}
    for path in ("implementations/python/uwmd_jcs.py", "package-lock.json", "spec/UW_XML_MAPPING.md", "spec/UW_ENVELOPE.md", "spec/UW_FORMAT_SPEC.md", "spec/UW_PROTOCOL.md"):
        identities[path] = sha((ROOT / path).read_bytes())
    behavior = dict(rows=[dict(python=py, node=js) for py, js in zip(python_rows, node_rows)], accepted=sum(row["accepted"] for row in python_rows), refused=sum(not row["accepted"] for row in python_rows))
    result = dict(scope="UNAPPROVED candidate lexical XML; two frozen models, bounded ASCII carriers and QName grammar; not general XML/domain/source/auth conformance", behavior=behavior, source_sha256=identities, node_dependency_sha256=node_value["dependencies"], raw=dict(node_stdin_sha256=sha(stdin), node_stdout_sha256=sha(node.stdout), node_stderr_sha256=sha(node.stderr)), runtime=dict(python=platform.python_version(), expat=xml.parsers.expat.EXPAT_VERSION, node=subprocess.check_output(["node", "--version"]).decode("ascii").strip()))
    return result, stdin, node.stdout, node.stderr

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--create", action="store_true")
    args = parser.parse_args()
    actual, stdin, stdout, stderr = run()
    if args.create:
        assert not EVIDENCE.exists(), "frozen evidence already exists"
        actual["created_at"] = datetime.now(timezone.utc).isoformat()
        actual["executed_git_head"] = subprocess.check_output(["git", "-C", str(ROOT), "rev-parse", "HEAD"]).decode("ascii").strip()
        EVIDENCE.mkdir()
        (EVIDENCE / "observations.json").write_bytes(encoded(actual))
        (EVIDENCE / "node.stdin.json").write_bytes(stdin)
        (EVIDENCE / "node.stdout.json").write_bytes(stdout)
        (EVIDENCE / "node.stderr.txt").write_bytes(stderr)
        print("Created new namespace evidence: 36 vectors / 10 accepted / 26 refused per implementation")
    else:
        frozen = json.loads((EVIDENCE / "observations.json").read_bytes())
        for name in ("behavior", "source_sha256", "node_dependency_sha256", "raw", "scope"):
            assert actual[name] == frozen[name], "namespace replay mismatch: " + name
        for name, raw in (("node.stdin.json", stdin), ("node.stdout.json", stdout), ("node.stderr.txt", stderr)):
            assert (EVIDENCE/name).read_bytes() == raw, name
        print("Namespace proof PASS: 36 vectors / 10 accepted / 26 refused per implementation")
        print("Current runtime (informational): " + json.dumps(actual["runtime"], sort_keys=True))

if __name__ == "__main__":
    main()
