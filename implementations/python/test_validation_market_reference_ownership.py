"""Exact RFC0022 missing-reference ownership at the integrated validate boundary."""
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
        issue = dict(code="DQ-06", severity="error", section="property", field=FIELD)
        def assess(index=1, owner=None):
            return metadata_assessment(parsed, inventory,
                missing_market_reference_owners=[(index, issue if owner is None else owner)])
        # Earlier same-section peer is overwritten, yet its local evidence remains.
        good = assess()
        self.assertEqual([f["context"]["block_index"] for f in good["shape_findings"]], [0])
        self.assertEqual([f["context"]["block_index"] for f in good["handled_shape_findings"]], [1])
        for index in (0, True, -1, 2):
            self.assertEqual([f["context"]["block_index"] for f in assess(index)["shape_findings"]], [0, 1])
        for key, value in (("code", "DQ-05"), ("severity", "info"),
                           ("field", "market_data_ref"), ("section", "other")):
            with self.subTest(key=key, value=value):
                self.assertEqual([f["context"]["block_index"] for f in
                    assess(owner={**issue, key: value})["shape_findings"]], [0, 1])
        self.assertEqual(len(metadata_assessment(parsed, inventory)["shape_findings"]), 2)

    def test_present_typed_or_member_failures_and_independent_fields_remain_local(self):
        for value in (None, False, 0, "", [], {}, {"document_id": "market"}):
            with self.subTest(value=value):
                authored = promoted(); authored["_meta"]["provenance"]["market_data_ref"] = value
                result = validate(parse(HEADER + fence(authored)))
                self.assertIn(FIELD, [f["field"] for f in result["metadata_assessment"]["shape_findings"]])
        authored = promoted()
        authored["_meta"]["provenance"]["timestamp"] = "invalid"
        authored["_overrides"] = [{"path": None}]
        parsed = parse(HEADER + fence(authored)); before = copy.deepcopy(parsed)
        result = validate(parsed)
        self.assertEqual({f["field"] for f in result["metadata_assessment"]["shape_findings"]},
                         {"_meta.provenance.timestamp", "_overrides[0].path"})
        self.assertEqual([f["registered_code"] for f in
            result["metadata_assessment"]["handled_shape_findings"]], ["DQ-06"])
        self.assertEqual(parsed, before)
        # A reference may be required by a leaf without a block-level resolution.
        authored = body(); authored["_overrides"] = [dict(path="units", resolution="market_data_accepted")]
        result = validate(parse(HEADER + fence(authored)))
        self.assertEqual(result["metadata_assessment"]["shape_findings"], [])
        self.assertEqual([i["code"] for i in result["errors"]], ["DQ-06"])

    def test_all_current_variants_but_not_append_extensions_or_history_are_owned(self):
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
            result["metadata_assessment"]["shape_findings"]], [0, 1, 2])
        self.assertEqual([f["context"]["block_index"] for f in
            result["metadata_assessment"]["handled_shape_findings"]], [3, 4])
        self.assertEqual([i["section"] for i in result["errors"]],
                         ["operating_statement", "operating_statement"])
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
                self.assertEqual(done.returncode, int(kind != "valid"))
                if kind in ("null", "bad_member", "independent"):
                    self.assertNotIn("overall_status", output)
                    self.assertNotIn("code", output["error"])
                    result = output["partial_validation_result"]
                else:
                    self.assertNotIn("partial_validation_result", output)
                    self.assertEqual(output["overall_status"], "clean" if kind == "valid" else "errors")
                    result = output
                self.assertEqual(result["errors"], [i for i in result["issues"] if i["severity"] == "error"])
                self.assertEqual(len(result["stage_readiness"]), 7)
                self.assertEqual(len(result["coverage"]), 15)


if __name__ == "__main__":
    unittest.main()
