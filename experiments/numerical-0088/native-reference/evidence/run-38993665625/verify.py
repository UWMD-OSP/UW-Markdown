"""Read-only offline audit of actual archived CI artifacts; executes no C/JS.

This checks artifact identity and finite-corpus observations, not RFC acceptance,
mathematical correct rounding, current-program conformance or a new oracle.
"""
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import zipfile

HERE = Path(__file__).resolve().parent
NATIVE = HERE.parents[1]
CANDIDATE = NATIVE.parent / "pinned-fdlibm"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def classify(word):
    if not isinstance(word, str) or re.fullmatch("[0-9a-f]{16}", word) is None:
        raise ValueError("Expected complete binary64 word")
    bits = int(word, 16)
    exponent = (bits >> 52) & 2047
    fraction = bits & ((1 << 52) - 1)
    if exponent == 2047:
        return "nan" if fraction else "infinity"
    if bits == 0:
        return "positive_zero"
    if bits == 1 << 63:
        return "negative_zero"
    return "finite_nonzero"


def main():
    manifest = json.loads((HERE / "manifest.json").read_bytes())
    raw = (NATIVE / "inputs.json").read_bytes()
    if sha(raw) != manifest["inputs"]["sha256"]:
        raise ValueError("Input revision differs from frozen historical corpus")
    inputs = json.loads(raw)["cases"]
    assert len(inputs) == manifest["inputs"]["cases"] == 4204
    assert len({c["id"] for c in inputs}) == 4204
    assert dict(Counter(c["op"] for c in inputs)) == manifest["inputs"]["op_counts"]
    baseline = None
    counts = Counter()
    native_count = node_count = 0
    for artifact in manifest["artifacts"]:
        path = HERE / artifact["archive_file"]
        archive = path.read_bytes()
        assert len(archive) == artifact["archive_bytes"]
        assert "sha256:" + sha(archive) == artifact["github_digest"]
        with zipfile.ZipFile(path) as stream:
            assert sorted(stream.namelist()) == sorted(artifact["archive_members_sha256"])
            for name, digest in artifact["archive_members_sha256"].items():
                assert sha(stream.read(name)) == digest, (artifact["name"], name)
            provenance = json.loads(stream.read("provenance.json"))
            native = artifact["name"].startswith("native-")
            rows = json.loads(stream.read("results.json" if native else "candidate-results.json"))
            assert len(rows) == len(inputs)
            normalized = []
            for expected, row in zip(inputs, rows):
                assert row["id"] == expected["id"] and row["op"] == expected["op"]
                if native:
                    bits = row["native_bits"]
                    if row["native_class"] == "nan":
                        assert bits is None and row["js_bits"] is None
                        kind = "nan"
                    else:
                        assert row["native_class"] == "binary64"
                        kind = classify(bits)
                        assert kind != "nan" and row["js_bits"] == bits
                    assert row["equal"] is True
                else:
                    bits = row["bits"]
                    if row["kind"] == "nan":
                        assert bits is None
                        kind = "nan"
                    else:
                        kind = classify(bits)
                        assert kind != "nan"
                        assert row["kind"] == ("infinity" if kind == "infinity" else "finite")
                normalized.append([row["id"], row["op"], kind, bits])
            digest = sha(json.dumps(normalized, separators=(",", ":")).encode())
            assert digest == artifact["normalized_sha256"] == manifest["normalized_sha256"]
            assert baseline is None or normalized == baseline
            baseline = normalized
            counts = Counter(row[2] for row in normalized)
            if native:
                native_count += 1
                assert provenance["compile_exit"] == 0
                assert provenance["cases"] == 4204 and provenance["differences"] == []
                assert provenance["input_sha256"] == manifest["inputs"]["sha256"]
                assert provenance["source_hashes"] == manifest["upstream_sha256"]
                assert provenance["results_sha256"] == sha((json.dumps(rows, sort_keys=True) + "\n").encode())
                assert provenance["compiler"] == artifact["compiler"]
                assert provenance["sanitize"] == artifact["sanitize"]
                assert not stream.read("native.stderr.log") and not stream.read("js.stderr.log")
                assert len(stream.read("compiler.stderr.log")) == artifact["compiler_warning_bytes"]
                for missing in artifact["missing_original_report_fields"]:
                    assert missing not in provenance
            else:
                node_count += 1
                assert provenance["status"] == "passed_frozen_controls_only"
                assert provenance["mutated_paths"] == []
                assert provenance["checkout_commit"] == manifest["checkout_association"]["observed_by_all_six_node_reports"]
                assert provenance["checkout_tree"] == manifest["checkout_association"]["tree"]
                assert provenance["github"]["RESEARCH_HEAD_SHA"] == manifest["run"]["head_sha"]
                assert provenance["node"] == artifact["node"]
                assert provenance["tracked_hashes_before"] == provenance["tracked_hashes_after"]
                for command in provenance["commands"]:
                    assert command["complete"] and command["exit_code"] == 0
                for name, expected_hash in manifest["candidate_sha256"].items():
                    key = "experiments/numerical-0088/pinned-fdlibm/" + name
                    assert provenance["tracked_hashes_before"][key] == expected_hash
                    assert sha((CANDIDATE / name).read_bytes()) == expected_hash
                for name, expected_hash in manifest["historical_driver_sha256_from_published_git_tree_not_original_report"].items():
                    key = "experiments/numerical-0088/native-reference/" + name
                    assert provenance["tracked_hashes_before"][key] == expected_hash
    assert native_count == 3 and node_count == 6
    assert dict(counts) == manifest["class_counts"]
    math = json.loads((CANDIDATE / "accuracy-observations.json").read_bytes())
    observations = {c["id"]: c for c in math["cases"]}
    assert len(manifest["mathematical_countercases"]) == 5
    for case in manifest["mathematical_countercases"]:
        record = next(row for row in baseline if row[0] == case["input"]["id"])
        assert record[3] == case["native_and_all_node_word"]
        observed = observations[case["math_id"]]
        assert observed["candidate"]["bits"] == record[3]
        assert observed["reference_word"] == case["independent_mathematical_word"]
        assert observed["signed_ordered_word_distance"] == case["signed_ordered_word_distance"]
        assert abs(int(case["signed_ordered_word_distance"])) == 1
    print("Verified original ZIP digests, 3 native + 6 Node streams x 4204 cases, exact non-NaN words/NaN class, and 5 retained mathematical counterexamples")


if __name__ == "__main__":
    main()
