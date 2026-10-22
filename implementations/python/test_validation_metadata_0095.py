"""RFC0095 integrated developing validate controls; parse-only discovery."""
import asyncio
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from test_source_metadata_optional import body, fence, DIGEST
from test_validation_cli import property_source
from test_validation import ROOT
from uwmd import _validation_response
from uwmd_reader import parse
from uwmd_source_validation import inspect_source_roles
from uwmd_validation import _validate_source, validate_document
from uwmd_validation_provenance import metadata_assessment


def assess(value):
    raw = property_source() + fence(value)
    result = asyncio.run(_validate_source(raw))
    return raw, result, _validation_response(result)


def allocated(result):
    return [(i["code"], i["field"]) for i in result["issues"] if i["code"] in ("META-05", "META-06")]


class Metadata0095ValidationTests(unittest.TestCase):
    def test_all_new_closed_predicates_produce_ordinary_partitions_and_exit(self):
        value = body(); value["_meta"]["provenance"].update(notes=False, resolution="market_data_accepted")
        value["_meta"]["quality"].update(flags=[False], partial="yes")
        value["_overrides"] = [None, dict(resolution="inherited_assumption")]
        raw, report, (wire, status) = assess(value)
        self.assertEqual(status, 1)
        self.assertNotIn("error", wire)
        self.assertEqual(wire["overall_status"], "errors")
        self.assertEqual(report["metadata_assessment"]["shape_findings"], [])
        self.assertEqual(allocated(wire), [("META-05", path) for path in (
            "_meta.provenance.notes", "_meta.quality.flags[0]", "_meta.quality.partial", "_overrides[0]", "_overrides[1].path")]
            + [("META-06", "_meta.provenance.inherited_from"), ("META-06", "_meta.provenance.market_data_ref")])
        for severity, key in (("error", "errors"), ("warning", "warnings"), ("info", "info")):
            self.assertEqual(wire[key], [i for i in wire["issues"] if i["severity"] == severity])
        self.assertFalse(any(i["code"] == "DQ-06" and i["severity"] == "error" for i in wire["issues"]))
        self.assertTrue(all("category" not in i for i in wire["issues"]))

    def test_reference_children_exact_order_and_no_unallocated_parent_duplicate(self):
        value = body(); value["_meta"]["provenance"].update(inherited_from={}, market_data_ref={"as_of": None, "rationale": False})
        _, report, (wire, status) = assess(value)
        self.assertEqual((status, report["metadata_assessment"]["shape_findings"]), (1, []))
        self.assertEqual([field for _, field in allocated(wire)], ["_meta.provenance." + p for p in (
            "inherited_from.document_id", "inherited_from.digest", "inherited_from.distance",
            "market_data_ref.document_id", "market_data_ref.as_of", "market_data_ref.digest", "market_data_ref.rationale")])

    def test_exact_actual_owner_code_severity_field_section_index_and_requirement(self):
        value = body(); value["_meta"]["quality"]["partial"] = "bad"
        document = parse(property_source() + fence(value)); inventory = inspect_source_roles(document)
        owner = next(i for i in inventory["issues"] if i["code"] == "META-05")
        self.assertEqual(metadata_assessment(document, inventory)["shape_findings"], [])
        for key, replacement in (("code", "META-06"), ("severity", "warning"), ("field", "_meta.quality.provisional"), ("section", "property")):
            wrong = copy.deepcopy(inventory); wrong_owner = next(i for i in wrong["issues"] if i["code"] == "META-05")
            wrong_owner[key] = replacement
            self.assertEqual([f["field"] for f in metadata_assessment(document, wrong)["shape_findings"]], ["_meta.quality.partial"])
        for index in (True, -1, 0, "1"):
            wrong = copy.deepcopy(inventory); next(i for i in wrong["issues"] if i["code"] == "META-05")["context"]["block_index"] = index
            self.assertTrue(metadata_assessment(document, wrong)["shape_findings"])
        wrong = copy.deepcopy(inventory); wrong["shape_findings"][0]["message"] = "A different unallocated requirement."
        self.assertTrue(metadata_assessment(document, wrong)["shape_findings"])
        document.source.blocks[1].parsed.value["_meta"]["quality"]["partial"] = False
        self.assertTrue(metadata_assessment(document, inventory)["shape_findings"])
        self.assertEqual(owner["context"]["block_index"], 1)

    def test_meta06_presence_owner_cannot_cover_other_carrier_child_or_peer(self):
        value = body(); value["_meta"]["provenance"]["resolution"] = "inherited_assumption"
        document = parse(property_source() + fence(value)); inventory = inspect_source_roles(document)
        self.assertEqual(metadata_assessment(document, inventory)["shape_findings"], [])
        for field in ("_meta.provenance.market_data_ref", "_meta.provenance.inherited_from.digest"):
            wrong = copy.deepcopy(inventory); next(i for i in wrong["issues"] if i["code"] == "META-06")["field"] = field
            self.assertTrue(metadata_assessment(document, wrong)["shape_findings"])
        wrong = copy.deepcopy(inventory); wrong["issues"] = [i for i in wrong["issues"] if i["code"] != "META-06"]
        self.assertTrue(metadata_assessment(document, wrong)["shape_findings"])

    def test_sibling_annotation_and_whole_missing_metadata_keep_both_owners(self):
        _, report, (wire, status) = assess({"_overrides": [None]})
        self.assertEqual((status, report["metadata_assessment"]["shape_findings"]), (1, []))
        self.assertEqual(allocated(wire), [("META-05", "_overrides[0]")])
        # The block is an extension (x_), outside the completeness-warning
        # population, as in the reference.
        self.assertNotIn("META_MISSING", [i["code"] for i in wire["issues"]])
        value = body(); value["_notes"] = {"never": [None]}; value["_meta"]["integrity"] = {"opaque": False}
        self.assertEqual(assess(value)[2][1], 0)

    def test_source_current_model_history_and_fresh_operation_remain_separate(self):
        historical = body(); historical["_meta"]["lifecycle"]["superseded"] = True
        historical["_meta"]["provenance"]["resolution"] = "inherited_assumption"
        raw = property_source() + fence(historical) + fence(body())
        document = parse(raw); report = asyncio.run(validate_document(document))
        self.assertEqual(allocated(report), [("META-06", "_meta.provenance.inherited_from")])
        document.source.blocks[1].parsed.value["_meta"]["provenance"].pop("resolution")
        before = copy.deepcopy(document)
        self.assertEqual(allocated(asyncio.run(validate_document(document))), [])
        self.assertEqual(document, before)
        self.assertEqual(len(allocated(asyncio.run(_validate_source(raw)))), 1)
        self.assertEqual(document.source.raw, raw)

    def test_actual_cli_ordinary_errors_source_identity_and_parse_only_discovery(self):
        value = body(); value["_meta"]["provenance"].update(notes=False, resolution="market_data_accepted")
        invalid_date = body(); invalid_date["_meta"]["provenance"]["market_data_ref"] = dict(document_id="", as_of="0000-02-29", digest=DIGEST)
        cases = [(body(), [], 0), (value, [("META-05", "_meta.provenance.notes"), ("META-06", "_meta.provenance.market_data_ref")], 1),
                 (invalid_date, [("META-06", "_meta.provenance.market_data_ref.as_of")], 1)]
        with tempfile.TemporaryDirectory(prefix="uwmd-metadata0095-cli-") as folder:
            path = Path(folder) / "input.uwx.md"
            for item, expected, expected_exit in cases:
                raw = property_source() + fence(item); path.write_bytes(raw)
                process = subprocess.run([sys.executable, "-B", str(ROOT / "implementations/python/uwmd.py"), "validate", str(path), "--json"],
                    capture_output=True, encoding="utf8", timeout=30)
                response = json.loads(process.stdout)
                self.assertEqual((process.returncode, process.stderr), (expected_exit, ""))
                self.assertNotIn("error", response)
                self.assertEqual(allocated(response), expected)
                self.assertEqual(path.read_bytes(), raw)
            manifest = subprocess.run([sys.executable, "-B", str(ROOT / "implementations/python/uwmd.py"), "manifest"],
                capture_output=True, encoding="utf8", timeout=30)
            self.assertEqual(json.loads(manifest.stdout)["capabilities"], ["parse", "calc-evaluate", "validate", "verify-reserve-accounts", "verify-reserve-draws"])


if __name__ == "__main__":
    unittest.main()
