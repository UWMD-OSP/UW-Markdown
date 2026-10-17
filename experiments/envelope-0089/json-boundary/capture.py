"""Read-only bounded JSON boundary replay; --create is first freeze only."""
import argparse
from datetime import datetime, timezone
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import platform
import ssl
import subprocess
from vectors import vectors

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
EVIDENCE = HERE / "evidence"
def sha(raw):
    return hashlib.sha256(raw).hexdigest()
def encoded(value):
    return (json.dumps(value, ensure_ascii=True, sort_keys=True, indent=2) + "\n").encode("utf8")
def run():
    spec = importlib.util.spec_from_file_location("json_boundary_python_codec", HERE.parent / "codec-study/codec.py")
    codec = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(codec)
    inputs = vectors()
    python_rows = []
    for row in inputs:
        def observe(strict):
            try:
                decoded = codec.load_json(row["text"])
                if strict:
                    codec.canonical(decoded)
                if row["carrier"] == "model-json":
                    model = codec.validate(decoded)
                elif row["carrier"] == "csv-manifest":
                    model = codec.decode_csv({**row["files"], "manifest.json": row["text"]})
                else:
                    return dict(accepted=True, canonical_value=codec.canonical(decoded))
                assert codec.canonical(model) == codec.canonical(row["model"]), "complete model disagreement"
                return dict(accepted=True, complete_model_jcs_sha256=sha(codec.canonical(model).encode("utf8")), semantic_digest=codec.digest(model))
            except Exception as error:
                return dict(accepted=False, error_name=type(error).__name__, error_message=str(error))
        historical, strict = observe(False), observe(True)
        assert strict["accepted"] == row["expected_strict"], (row["case"], row["vector"], strict)
        python_rows.append(dict(case=row["case"], carrier=row["carrier"], vector=row["vector"], input_sha256=row["input_sha256"], historical=historical, strict=strict))
    stdin = json.dumps(inputs, ensure_ascii=True, sort_keys=True, separators=(",", ":")).encode("utf8")
    node = subprocess.run(["node", str(HERE/"observe.mjs")], input=stdin, capture_output=True, check=False)
    assert node.returncode == 0, node.stderr.decode("utf8")
    js = json.loads(node.stdout.decode("utf8"))
    assert len(js["rows"]) == len(python_rows) == 36
    for py, nr in zip(python_rows, js["rows"]):
        for key in ("case", "carrier", "vector", "input_sha256"):
            assert py[key] == nr[key], key
        assert py["strict"]["accepted"] == nr["strict"]["accepted"]
        if py["strict"]["accepted"]:
            for key in ("canonical_value", "complete_model_jcs_sha256", "semantic_digest"):
                assert py["strict"].get(key) == nr["strict"].get(key), (key, py, nr)
        # Historical differences are explicit evidence, never normalized away.
    paths = [HERE/f for f in ("capture.py", "observe.mjs", "strict.mjs", "vectors.py")]
    paths += [HERE.parent/f for f in ("codec-study/codec.py", "codec-study/independent.mjs", "candidate_codec.py")]
    for case in ("all-block-extras", "xml-lexical-domain"):
        base = HERE.parent/"codec-study/fixtures"/case
        paths += [base/"model.json", *sorted((base/"csv").iterdir())]
    paths += [ROOT/f for f in ("implementations/python/uwmd_jcs.py", "package-lock.json", "spec/UW_CSV_BUNDLE.md", "spec/schemas/uw-document-envelope.schema.json", "docs/rfcs/0014-multi-format-interchange.md")]
    source = {str(path.relative_to(ROOT)).replace("\\", "/"): sha(path.read_bytes()) for path in paths}
    behavior = dict(rows=[dict(python=py, node=nr) for py, nr in zip(python_rows, js["rows"])], artifacts=js["artifacts"], public_key_spki_der_base64=js["public_key_spki_der_base64"])
    result = dict(scope="UNAPPROVED raw JSON model/CSV-manifest boundary profile; research crypto binding only, not public artifact verification or source admission", behavior=behavior, source_sha256=source, node_dependency_sha256=js["dependencies"], raw=dict(node_stdin_sha256=sha(stdin), node_stdout_sha256=sha(node.stdout), node_stderr_sha256=sha(node.stderr)), runtime=dict(python=platform.python_version(), python_openssl=ssl.OPENSSL_VERSION, node=subprocess.check_output(["node", "--version"]).decode("ascii").strip(), node_openssl=subprocess.check_output(["node", "-p", "process.versions.openssl"]).decode("ascii").strip()))
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
        (EVIDENCE/"observations.json").write_bytes(encoded(actual))
        (EVIDENCE/"node.stdin.json.gz").write_bytes(gzip.compress(stdin, mtime=0))
        (EVIDENCE/"node.stdout.json").write_bytes(stdout)
        (EVIDENCE/"node.stderr.txt").write_bytes(stderr)
        print("Created isolated JSON boundary evidence for36 vectors")
    else:
        frozen = json.loads((EVIDENCE/"observations.json").read_bytes())
        for key in ("scope", "behavior", "source_sha256", "node_dependency_sha256", "raw"):
            assert actual[key] == frozen[key], key
        assert gzip.decompress((EVIDENCE/"node.stdin.json.gz").read_bytes()) == stdin
        assert (EVIDENCE/"node.stdout.json").read_bytes() == stdout
        assert (EVIDENCE/"node.stderr.txt").read_bytes() == stderr
        print("JSON boundary replay PASS:36 vectors, exact historical and strict observations/raw hashes")
        print("Current runtime (informational): " + json.dumps(actual["runtime"], sort_keys=True))

if __name__ == "__main__":
    main()
