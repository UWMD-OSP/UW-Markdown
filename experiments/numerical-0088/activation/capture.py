"""Direct production boundaries versus existing independent Python references.

No loader, substitution, host oracle, archived runtime replay or expected rewrite.
"""
import argparse
import gzip
import hashlib
import importlib.util
import json
import os
import platform
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
LAB = HERE.parent
ROOT = LAB.parents[1]
FAMILIES = ("consumer-composition", "financial-trajectories", "dated-conventions", "nper-log-quotient", "cancellation-accuracy")

def sha(data): return hashlib.sha256(data).hexdigest()

def normalized(value):
    if isinstance(value, list): return [normalized(item) for item in value]
    if isinstance(value, dict): return {key: normalized(item) for key, item in value.items() if not (value.get("kind") == "nan" and key == "bits")}
    return value

def equal(actual, expected, label):
    if normalized(actual) != normalized(expected): raise AssertionError(label)

def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def frozen(family):
    folder = LAB / family / "evidence"
    manifest = json.loads((folder / "manifest.json").read_bytes())
    for item in manifest["artifacts"]:
        packed = (folder / item["path"]).read_bytes()
        assert sha(packed) == item["sha256"], family + "/" + item["path"]
        raw = gzip.decompress(packed)
        assert len(raw) == item["raw_bytes"] and sha(raw) == item["raw_sha256"], item["path"]
    return json.loads(gzip.decompress((folder / "python.json.gz").read_bytes()))

def compare_rows(expected, actual, dated=False):
    assert len(expected) == len(actual), "row count"
    for independent, observed in zip(expected, actual):
        assert independent["id"] == observed["id"], "row identity"
        label = independent["id"]
        want, got = independent["result"], observed["result"]
        assert want["status"] == got["status"], label + " return/refusal"
        if want["status"] == "refused":
            assert want["code"] == got["code"], label + " refusal code"
        else:
            equal(got["raw"], want["raw"], label + " raw word/class")
            if want["reporting"]["status"] == "reported":
                assert got["quantized"]["bits"] == want["reporting"]["bits"], label + " reporting"
            else: assert got["quantization_refusal"] == "CALC-TYPE-001", label + " nonfinite quantizer"
        if dated:
            fractions = [row["result"] for row in independent["trace"] if row["kind"] == "operation" and row["context"].startswith("calendar/")]
            equal(observed["fractions"], fractions, label + " date fractions")

def identities():
    paths = []
    for package in ("uwmd-verify", "uwmd-core"):
        for folder, suffix in (("src", "*.ts"), ("dist", "*.js")):
            paths.extend((ROOT / "packages" / package / folder).rglob(suffix))
    paths.extend(path for path in (ROOT / "conformance").rglob("*") if path.is_file() and path.suffix in (".md", ".json", ".py", ".mjs"))
    for suffix in ("*.py", "*.mjs", "*.json"):
        paths.extend(LAB.rglob(suffix))
    consumer = json.loads((LAB / "consumer-composition/inputs.json").read_bytes())
    paths.extend(ROOT / name for name in consumer["origins"])
    paths.append(ROOT / "conformance/receipts/issue/01-uwx-multifamily/deal.uwx.md")
    return {path.relative_to(ROOT).as_posix(): sha(path.read_bytes()) for path in sorted(set(paths))}

def capture(destination):
    if destination.exists(): raise FileExistsError("New output directory required: " + str(destination))
    for key, value in os.environ.items():
        if (key == "NODE_OPTIONS" or key.startswith("RESEARCH_")) and value:
            raise RuntimeError("Direct production proof refuses injected environment: " + key)
    assert (ROOT / "packages/uwmd-verify/dist/index.js").is_file(), "Fresh own build required"
    destination.mkdir(parents=True)
    before = identities()
    head_before = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    tree_before = subprocess.check_output(["git", "rev-parse", "HEAD^{tree}"], cwd=ROOT, text=True).strip()
    origins = json.loads((HERE / "conformance-origins.json").read_bytes())
    for record in origins["cases"]:
        fixture = ROOT / "conformance/calc/fixtures" / record["name"]
        for name, digest in record["fixture_sha256"].items():
            assert sha((fixture / name).read_bytes()) == digest, record["name"] + "/" + name
    for name, digest in origins["reference_sha256"].items():
        assert sha((ROOT / name).read_bytes()) == digest, name
    commands = []
    def run(name, command, extra=None):
        env = {**os.environ, **(extra or {})}
        result = subprocess.run(command, cwd=ROOT, env=env, capture_output=True, timeout=240)
        (destination / (name + ".stdout")).write_bytes(result.stdout)
        (destination / (name + ".stderr")).write_bytes(result.stderr)
        commands.append(dict(id=name, argv=[str(x).replace(str(ROOT), "<repo>").replace(str(destination), "<output>") for x in command], exit=result.returncode))
        if result.returncode: raise RuntimeError(name + ": " + result.stderr.decode("utf8", errors="replace"))
    independent = {}
    observations = {}
    for family in FAMILIES:
        old = frozen(family)
        source = LAB / family
        output = destination / (family + ".json")
        if family == "consumer-composition":
            reference = destination / "consumer-python.json"
            run("consumer-python", [sys.executable, "-B", str(source / "reference.py"), str(reference)])
            fresh = json.loads(reference.read_bytes())
            equal(fresh, old, "frozen consumer reference changed")
            run(family, ["node", str(source / "boundary.mjs"), str(output)])
            observed = json.loads(output.read_bytes())
            equal(observed["comparison"], fresh["comparison"], "44 consumers/64 samples production mismatch")
            independent[family] = fresh
        elif family in ("financial-trajectories", "dated-conventions"):
            module = load("activation_" + family.replace("-", "_"), source / "python_graph.py")
            inputs = json.loads((source / "inputs.json").read_bytes())
            cases = [module.evaluate(case) for case in inputs["cases"]]
            equal(cases, old["cases"], family + " frozen independent graph changed")
            run(family, ["node", str(source / "boundary.mjs")], {"TRAJECTORY_BOUNDARY_OUTPUT": str(output)})
            observed = json.loads(output.read_bytes())
            compare_rows(cases, observed["rows"], family == "dated-conventions")
            if family == "financial-trajectories":
                expected = [{"id": item["id"], "value": module.encoded(module.raw.from_bits(module.reporting(item["bits"], item["places"])["bits"]))} for item in inputs["reporting_controls"]]
                equal(observed["reporting"], expected, "decimal-string reporting controls")
            independent[family] = {"cases": cases}
        else:
            reference = destination / (family + "-python.json")
            run(family + "-python", [sys.executable, "-B", str(source / "python_graph.py"), str(reference)])
            fresh = json.loads(reference.read_bytes())
            equal(fresh["candidate"], old["candidate"], family + " frozen independent graph changed")
            equal(fresh["references"], old["references"], family + " frozen accuracy certificate changed")
            run(family, ["node", str(source / "run.mjs"), str(output)])
            observed = json.loads(output.read_bytes())
            if family == "nper-log-quotient": compare_rows(fresh["candidate"], observed["boundaries"])
            else:
                assert len(fresh["candidate"]) == len(observed["boundaries"]) == 36
                for want, got in zip(fresh["candidate"], observed["boundaries"]):
                    assert want["id"] == got["id"]
                    equal(want["raw"], got["raw"], want["id"])
                    if want["reporting"]["status"] == "reported": assert want["reporting"]["bits"] == got["quantized"]["bits"]
                    else: assert got["quantization_refusal"] == "CALC-TYPE-001"
            independent[family] = fresh
        observations[family] = observed
    run("receipt-precedence", ["node", "--test", str(HERE / "receipts.test.mjs")], {"ACTIVATION_RECEIPT_OUTPUT": str(destination / "receipt-precedence.json")})
    (destination / "independent-graphs.json").write_text(json.dumps(independent, separators=(",", ":")) + "\n", encoding="utf8")
    assert identities() == before, "Source/input/reference/dist mutation during proof"
    assert subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip() == head_before, "Checkout HEAD changed during proof"
    artifacts = [{"path": path.name, "sha256": sha(path.read_bytes()), "bytes": path.stat().st_size} for path in sorted(destination.iterdir())]
    counts = {"consumer_cases": 44, "seeded_samples": 64, "financial": len(independent["financial-trajectories"]["cases"]), "dated": len(independent["dated-conventions"]["cases"]), "nper": 14, "cancellation": 36}
    manifest = dict(scope="Accepted RFC0088 direct production APIs versus independently structured frozen Python procedure references", checkout_commit=head_before, checkout_tree=tree_before, python=sys.version, platform=platform.platform(), architecture=platform.machine(), node={key: observations["consumer-composition"][key] for key in ("node", "v8")}, source_input_dist_before_and_after=before, commands=commands, counts=counts, artifacts=artifacts, limits=["No loader, source transformation or production function substitution.", "Raw production result words/refusals/reporting compared; production internal trajectories are not instrumented.", "Independent Python full graphs and rational certificates are retained separately; whole-formula correct rounding is not promised.", "Only NaN class is portable; original NaN words are retained in the raw outputs.", "Frozen preactivation identities describe historical runs only; no old-production source replay."])
    (destination / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf8")
    print(json.dumps({"output": str(destination), "counts": counts, "sha256": sha((destination / "manifest.json").read_bytes())}))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    capture(parser.parse_args().output)
