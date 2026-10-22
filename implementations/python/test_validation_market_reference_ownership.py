"""Accepted RFC0095 provenance-reference ownership at the integrated validate boundary."""
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from test_reader import HEADER
from test_validation import ROOT, validate
from test_validation_metadata_admission import body, fence, reference
from uwmd_reader import parse
from uwmd_source_validation import inspect_source_roles
from uwmd_validation_provenance import metadata_assessment

FIELD = "_meta.provenance.market_data_ref"


def promoted():
    value = body()
    value["_meta"]["provenance"]["resolution"] = "market_data_accepted"
    return value


class MarketReferenceOwnershipTests(unittest.TestCase):
    def test_actual_error_and_current_physical_identity_are_required(self):
        parsed = parse(HEADER + fence(promoted()) + fence(promoted()))
        inventory = inspect_source_roles(parsed)
        issue = dict(code="META-06", severity="error", section="property", field=FIELD)
        def assess(index=1, owner=None):
            supplied = copy.deepcopy(inventory)
            supplied["issues"] = [{**(issue if owner is None else owner), "context": {"block_index": index}}]
            return metadata_assessment(parsed, supplied)
        self.assertEqual([f["context"]["block_index"] for f in assess()["shape_findings"]], [0])
        self.assertEqual([f["context"]["block_index"] for f in assess(0)["shape_findings"]], [1])
        for index in (True, -1, 2):
            self.assertEqual([f["context"]["block_index"] for f in assess(index)["shape_findings"]], [0, 1])
        for key, value in (("code", "DQ-06"), ("severity", "info"), ("field", "market_data_ref"), ("section", "other")):
            self.assertEqual([f["context"]["block_index"] for f in assess(owner={**issue, key: value})["shape_findings"]], [0, 1])
        self.assertEqual(metadata_assessment(parsed, inventory)["shape_findings"], [])

    def test_present_carrier_and_child_failures_use_exact_registered_predicates(self):
        for value in (None, False, 0, "", [], {}, {"document_id": "market"}):
            with self.subTest(value=value):
                authored = promoted(); authored["_meta"]["provenance"]["market_data_ref"] = value
                result = validate(parse(HEADER + fence(authored)))
                self.assertEqual(result["metadata_assessment"]["shape_findings"], [])
                expected = [FIELD] if not isinstance(value, dict) else [FIELD + "." + name for name in ("document_id", "as_of", "digest") if name not in value]
                self.assertEqual([i["field"] for i in result["errors"] if i["code"] == "META-06"], expected)
        authored = promoted(); authored["_meta"]["provenance"]["timestamp"] = "invalid"
        authored["_overrides"] = [{"path": None}]
        parsed = parse(HEADER + fence(authored)); before = copy.deepcopy(parsed); result = validate(parsed)
        self.assertEqual(result["metadata_assessment"]["shape_findings"], [])
        self.assertEqual([(i["code"], i["field"]) for i in result["errors"]],
                         [("META-04", "_meta.provenance.timestamp"), ("META-05", "_overrides[0].path"), ("META-06", FIELD)])
        self.assertEqual(parsed, before)
        authored = body(); authored["_overrides"] = [dict(path="units", resolution="market_data_accepted")]
        result = validate(parse(HEADER + fence(authored)))
        self.assertEqual(result["metadata_assessment"]["shape_findings"], [])
        self.assertEqual([i["code"] for i in result["errors"]], ["META-06"])

    def test_all_retained_variants_append_extensions_and_history_are_owned(self):
        raw = HEADER
        for section in ("pipeline_log", "x_private"):
            authored = promoted(); authored["_meta"]["section"] = section
            raw += fence(authored, section)
        for variant in ("a", "a", "b"):
            authored = promoted(); authored["_meta"]["section"] = "operating_statement"
            authored["_role"] = "component"
            raw += fence(authored, "operating_statement", " variant=" + variant)
        historical = promoted(); historical["_meta"]["lifecycle"]["superseded"] = True
        raw += fence(historical)
        parsed = parse(raw); before = copy.deepcopy(parsed); result = validate(parsed)
        self.assertEqual([f["context"]["block_index"] for f in
            result["metadata_assessment"]["shape_findings"]], [])
        self.assertEqual([f["context"]["block_index"] for f in
            result["metadata_assessment"]["handled_shape_findings"]], [0, 1, 2, 3, 4])
        self.assertEqual([i["section"] for i in result["errors"]],
                         ["pipeline_log", "x_private", "operating_statement", "operating_statement", "operating_statement", "property"])
        self.assertEqual(parsed, before)

    def test_real_cli_result_refusal_partitions_readiness_and_source_are_preserved(self):
        with tempfile.TemporaryDirectory(prefix="uwmd-python-dq06-cli-") as folder:
            path = Path(folder) / "input.uwx.md"
            for kind in ("block", "leaf", "null", "bad_member", "independent", "valid"):
                authored = promoted()
                if kind == "leaf":
                    del authored["_meta"]["provenance"]["resolution"]
                    authored["_overrides"] = [dict(path="units", resolution="market_data_accepted")]
                if kind == "null": authored["_meta"]["provenance"]["market_data_ref"] = None
                if kind in ("bad_member", "valid"):
                    authored["_meta"]["provenance"]["market_data_ref"] = reference("market_data_ref")
                if kind == "bad_member": authored["_meta"]["provenance"]["market_data_ref"]["digest"] = "bad"
                if kind == "independent": authored["_meta"]["quality"] = None
                raw = HEADER + fence(authored); path.write_bytes(raw)
                done = subprocess.run([sys.executable, "-B", str(ROOT / "implementations/python/uwmd.py"),
                    "validate", str(path), "--json"], capture_output=True, encoding="utf8", timeout=30)
                output = json.loads(done.stdout)
                self.assertEqual(done.stderr, ""); self.assertEqual(path.read_bytes(), raw)
                # Keep the old authored-vintage literal unchanged: under U3
                # the case formerly named valid now has its exact as_of error.
                self.assertEqual(done.returncode, 1)
                self.assertNotIn("partial_validation_result", output)
                self.assertEqual(output["overall_status"], "errors")
                result = output
                expected = ([FIELD + ".as_of", FIELD + ".digest"] if kind == "bad_member" else
                            [FIELD + ".as_of"] if kind == "valid" else [FIELD])
                self.assertEqual([i["field"] for i in result["errors"] if i["code"] == "META-06"], expected)
                self.assertEqual(result["errors"], [i for i in result["issues"] if i["severity"] == "error"])
                self.assertEqual(len(result["stage_readiness"]), 7)
                self.assertEqual(len(result["coverage"]), 16)


if __name__ == "__main__":
    unittest.main()
