"""RFC0093 source/model, ordering, ownership and real-command controls."""
import asyncio
import copy
from dataclasses import replace
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from test_reader import HEADER
from test_validation import ROOT, validate
from test_validation_cli import property_source
from uwmd import main, _validation_response
from uwmd_reader import parse
from uwmd_source_validation import (
    inspect_source_roles, _inspect_source_roles_source, _array_index_name)
from uwmd_validation import _validate_source
from uwmd_validation_provenance import metadata_assessment

OMITTED = object()


def body():
    return copy.deepcopy(parse(property_source()).source.blocks[0].parsed.value)


def fence(value, *, section="property", annotation=""):
    return (("```json uw:section=" + section + annotation + "\n")
            + json.dumps(value, ensure_ascii=True) + "\n```\n").encode()


def shapes(report):
    return [(i["context"]["block_index"], i["field"]) for i in report["issues"]
            if i["code"] == "META-01" and i["field"] in
            ("_meta", "_meta.section", "_meta.quality")]


class MetadataShape0093Tests(unittest.TestCase):
    def source(self, raw):
        before = bytes(raw)
        report = _inspect_source_roles_source(raw)
        self.assertEqual(raw, before)
        return report


    def test_decoded_meta_nested_keys_payload_and_absent_metadata(self):
        raw = HEADER + fence(body()).replace(b'"_meta"', b'"\\u005fmeta"', 1)
        self.assertEqual(shapes(self.source(raw)), [])
        value = body()
        value["content"] = {"_meta": {"section": "nested"}, "unknown": []}
        value["arbitrary"] = {"0": 1}
        self.assertEqual(shapes(self.source(HEADER + fence(value))), [])
        value = {"content": {"_meta": body()["_meta"]}}
        self.assertEqual(shapes(self.source(HEADER + fence(value))), [])
        report = asyncio.run(_validate_source(HEADER + fence(value)))
        self.assertIn("META_MISSING", [i["code"] for i in report["warnings"]])

    def test_section_exact_types_presence_unknown_identity_and_no_inference(self):
        for section in (None, "", False, 0, [], {}, "Property", " property", "x_other"):
            value = body(); value["_meta"]["section"] = section
            self.assertEqual(shapes(self.source(HEADER + fence(value))),
                             [(0, "_meta.section")])
        value = body(); del value["_meta"]["section"]
        report = asyncio.run(_validate_source(HEADER + fence(value)))
        self.assertEqual(shapes(report), [])
        self.assertIn("META_FIELD_MISSING_SECTION", [i["code"] for i in report["warnings"]])
        value = body(); value["_meta"]["section"] = "x_unknown"
        self.assertEqual(shapes(self.source(HEADER + fence(value, section="x_unknown"))), [])
        value["_meta"]["section"] = "property"
        self.assertEqual(shapes(self.source(HEADER + fence(value, section="x_unknown"))),
                         [(0, "_meta.section")])

    def test_quality_container_is_separate_from_both_child_flags_and_warnings(self):
        for quality in (OMITTED, None, False, 0, "", [], [False]):
            value = body()
            if quality is OMITTED: del value["_meta"]["quality"]
            else: value["_meta"]["quality"] = quality
            del value["_meta"]["provenance"]["actor"]
            value["_meta"]["lifecycle"]["superseded"] = None
            report = asyncio.run(_validate_source(HEADER + fence(value)))
            self.assertEqual([(i["code"], i["field"]) for i in report["errors"]], [
                ("META-01", "_meta.quality"), ("META-01", "_meta.provenance.actor"),
                ("META-03", "_meta.lifecycle.superseded")])
            self.assertIn("META_FIELD_MISSING_CONFIDENCE", [i["code"] for i in report["warnings"]])
            self.assertEqual(report["metadata_assessment"]["shape_findings"], [])
            response, status = _validation_response(report)
            self.assertEqual((status, response["overall_status"]), (1, "errors"))
            self.assertNotIn("error", response)
        value = body(); value["_meta"]["quality"] = {}
        report = asyncio.run(_validate_source(HEADER + fence(value)))
        self.assertEqual(shapes(report), [])
        self.assertEqual([(i["code"], i["field"]) for i in report["errors"]],
                         [("META-02", "_meta.quality.human_review_required")])





    def test_local_consumption_requires_exact_current_predicate_error_and_owner(self):
        value = {"before": 1, **body()}
        value["_meta"]["section"] = "wrong"; value["_meta"]["quality"] = None
        document = parse(HEADER + fence(value))
        original = inspect_source_roles(document)
        self.assertEqual(metadata_assessment(document, original)["shape_findings"], [])
        for kind in ("remove", "field", "severity", "section", "index", "actor"):
            inventory = copy.deepcopy(original)
            owner = next(i for i in inventory["issues"] if i["field"] == "_meta.section")
            if kind == "remove": inventory["issues"].remove(owner)
            if kind == "field": owner["field"] = "_meta.provenance.actor"
            if kind == "severity": owner["severity"] = "warning"
            if kind == "section": owner["section"] = "elsewhere"
            if kind == "index": owner["context"]["block_index"] = 999
            if kind == "actor": owner["code"] = "META-02"
            findings = metadata_assessment(document, inventory)["shape_findings"]
            self.assertEqual([f["field"] for f in findings], ["_meta.section"])
        # A source-order owner cannot consume a numeric-only model requirement.
        numeric = parse(HEADER + fence({"0": 1, **body()}))
        inventory = _inspect_source_roles_source(numeric.source.raw)
        self.assertEqual([f["field"] for f in
                          metadata_assessment(numeric, inventory)["shape_findings"]], ["_meta"])
        self.assertEqual(metadata_assessment(numeric, inventory, _source_order=True)["shape_findings"], [])

    def test_accepted_leaf_requirement_integrates_beside_registered_shapes(self):
        value = {"before": 1, **body()}
        value["_meta"]["section"] = "wrong"
        value["_meta"]["quality"]["confidence"] = "unknown"
        report = asyncio.run(_validate_source(HEADER + fence(value)))
        self.assertEqual(report["metadata_assessment"]["shape_findings"], [])
        response, status = _validation_response(report)
        self.assertEqual(status, 1)
        self.assertNotIn("error", response)
        self.assertEqual(response["overall_status"], "errors")
        self.assertEqual([(i["code"], i["field"]) for i in response["errors"]],
                         [("META-01", "_meta"), ("META-01", "_meta.section"),
                          ("META-04", "_meta.quality.confidence")])

    def test_real_cli_source_order_normal_invalid_wire_and_discovery(self):
        cases = [(body(), [], 0),
                 ({"0": 1, **body()}, ["_meta"], 1)]
        wrong = body(); wrong["_meta"]["section"] = None; wrong["_meta"]["quality"] = None
        cases.append((wrong, ["_meta.section", "_meta.quality"], 1))
        with tempfile.TemporaryDirectory(prefix="uwmd-python-0093-cli-") as folder:
            path = Path(folder) / "input.uwx.md"
            for value, expected, exit_code in cases:
                raw = HEADER + fence(value); path.write_bytes(raw)
                for command in ("validate", "inspect-source-roles"):
                    process = subprocess.run(
                        [sys.executable, "-B", str(ROOT / "implementations/python/uwmd.py"),
                         command, str(path), "--json"], capture_output=True, encoding="utf-8", timeout=60)
                    report = json.loads(process.stdout)
                    self.assertEqual(process.stderr, "")
                    self.assertEqual(process.returncode, exit_code)
                    self.assertEqual([field for _, field in shapes(report)], expected)
                    self.assertTrue(all("category" not in i for i in report["issues"]))
                    self.assertNotIn("error", report)
                    self.assertEqual(path.read_bytes(), raw)
                    if command == "validate":
                        self.assertEqual(len(report["stage_readiness"]), 7)
                        self.assertEqual(len(report["coverage"]), 16)
                        for member, severity in (("errors", "error"), ("warnings", "warning"), ("info", "info")):
                            self.assertEqual(report[member], [i for i in report["issues"] if i["severity"] == severity])
        self.assertEqual(main(["manifest"])[0]["capabilities"], ["parse", "calc-evaluate", "validate"])


if __name__ == "__main__":
    unittest.main()
