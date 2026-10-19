"""Accepted RFC0094 integration: exact owners, ordinary results, real CLI."""
import asyncio
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from test_reader import HEADER
from test_validation_cli import property_source
from test_source_metadata_shape import fence
from uwmd import _validation_response
from uwmd_reader import parse
from uwmd_source_validation import inspect_source_roles
from uwmd_validation import _validate_source, validate_document
from uwmd_validation_provenance import metadata_assessment, timestamp_shape

ROOT = Path(__file__).resolve().parents[2]
FIELDS = ("_meta.quality.confidence", "_meta.lifecycle.revision", "_meta.provenance.timestamp")


def valid_body():
    return parse(property_source()).source.blocks[0].parsed.value


def invalid_body():
    body = valid_body()
    for group, leaf in (("quality", "confidence"), ("lifecycle", "revision"), ("provenance", "timestamp")):
        body["_meta"][group][leaf] = None
    return body


def validate(raw):
    report = asyncio.run(_validate_source(raw))
    return report, _validation_response(report)


class MetadataLeaf0094Tests(unittest.TestCase):
    def test_three_present_invalid_leaves_are_registered_errors_without_partial_transport(self):
        report, (response, status) = validate(HEADER + fence(invalid_body()))
        self.assertEqual(status, 1)
        self.assertEqual(response["overall_status"], "errors")
        self.assertEqual([(i["code"], i["severity"], i["field"]) for i in response["errors"]],
                         [("META-04", "error", field) for field in FIELDS])
        self.assertEqual(report["metadata_assessment"]["shape_findings"], [])
        self.assertEqual([i["field"] for i in report["metadata_assessment"]["handled_shape_findings"]],
                         [FIELDS[2], FIELDS[0], FIELDS[1]])
        self.assertEqual(response["errors"], [i for i in response["issues"] if i["severity"] == "error"])
        self.assertEqual(len(response["stage_readiness"]), 7)
        self.assertEqual(len(response["coverage"]), 15)
        self.assertTrue(all("category" not in issue for issue in response["issues"]))

    def test_absent_members_keep_three_warnings_and_whole_missing_meta_is_unchanged(self):
        body = valid_body()
        for group, field in (("quality", "confidence"), ("lifecycle", "revision"), ("provenance", "timestamp")):
            del body["_meta"][group][field]
        report, (response, status) = validate(HEADER + fence(body))
        self.assertEqual((status, response["overall_status"]), (0, "warnings"))
        self.assertEqual([i["code"] for i in response["warnings"]],
                         ["META_FIELD_MISSING_VERSION", "META_FIELD_MISSING_TIMESTAMP", "META_FIELD_MISSING_CONFIDENCE"])
        self.assertEqual(report["metadata_assessment"]["shape_findings"], [])
        del body["_meta"]
        report, (response, status) = validate(HEADER + fence(body))
        self.assertEqual((status, [i["code"] for i in response["warnings"]]), (0, ["META_MISSING"]))
        self.assertEqual(response["errors"], [])

    def test_quality_parent_shape_keeps_revision_timestamp_and_old_completeness_population(self):
        body = invalid_body(); body["_meta"]["quality"] = None
        report, (response, status) = validate(HEADER + fence(body))
        self.assertEqual(status, 1)
        self.assertEqual([(i["code"], i["field"]) for i in response["errors"]],
                         [("META-01", "_meta.quality"), ("META-04", FIELDS[1]), ("META-04", FIELDS[2])])
        self.assertIn("META_FIELD_MISSING_CONFIDENCE", [i["code"] for i in response["warnings"]])
        self.assertEqual(report["metadata_assessment"]["shape_findings"], [])

    def test_consumption_requires_actual_exact_error_owner_and_current_predicate(self):
        document = parse(HEADER + fence(invalid_body()))
        inventory = inspect_source_roles(document)
        for mutation in ("absent", "code", "severity", "section", "field", "index", "bool_index"):
            changed = copy.deepcopy(inventory)
            if mutation == "absent":
                changed["issues"] = []
            else:
                for issue in changed["issues"]:
                    if issue["code"] != "META-04":
                        continue
                    if mutation == "code": issue["code"] = "META-01"
                    elif mutation == "severity": issue["severity"] = "warning"
                    elif mutation == "section": issue["section"] = "other"
                    elif mutation == "field": issue["field"] = "_meta.provenance.actor"
                    elif mutation == "index": issue["context"]["block_index"] = 99
                    else: issue["context"]["block_index"] = True
            with self.subTest(mutation=mutation):
                result = metadata_assessment(document, changed)
                self.assertEqual({f["field"] for f in result["shape_findings"]}, set(FIELDS))
        for group, name in (("quality", "confidence"), ("lifecycle", "revision"), ("provenance", "timestamp")):
            document.source.blocks[0].parsed.value["_meta"][group][name] = valid_body()["_meta"][group][name]
        stale = metadata_assessment(document, inventory)
        self.assertTrue(any(f["field"] == FIELDS[0] for f in stale["shape_findings"]))

    def test_same_field_different_requirement_and_another_physical_peer_remain_local(self):
        first, second = invalid_body(), invalid_body()
        document = parse(HEADER + fence(first) + fence(second))
        inventory = inspect_source_roles(document)
        inventory["issues"] = [i for i in inventory["issues"] if i["context"]["block_index"] == 1]
        result = metadata_assessment(document, inventory)
        self.assertEqual({f["context"]["block_index"] for f in result["shape_findings"]}, {0})
        inventory = inspect_source_roles(document)
        another = copy.deepcopy(inventory["shape_findings"][0])
        another["message"] = "Unallocated independent authority condition on this field"
        inventory["shape_findings"].append(another)
        result = metadata_assessment(document, inventory)
        self.assertEqual([f["message"] for f in result["shape_findings"]], [another["message"]])

    def test_history_errors_and_current_model_authority_preserve_source_bytes(self):
        original = HEADER + fence(invalid_body(), annotation=" superseded=true") + fence(valid_body())
        report, (response, status) = validate(original)
        self.assertEqual((status, len(response["errors"])), (1, 3))
        self.assertEqual([i["context"]["block_index"] for i in response["errors"]], [0, 0, 0])
        self.assertEqual(report["metadata_assessment"]["shape_findings"], [])
        document = parse(original)
        document.source.blocks[0].parsed.value["_meta"] = valid_body()["_meta"]
        before = copy.deepcopy(document)
        current = asyncio.run(validate_document(document))
        self.assertEqual(current["errors"], [])
        self.assertEqual(document, before)
        self.assertEqual(document.source.raw, original)
        self.assertEqual(len(asyncio.run(_validate_source(original))["errors"]), 3)

    def test_excluded_conditional_optional_and_annotation_requirements_stay_partial(self):
        for extra in ("inherited", "optional", "annotation"):
            body = invalid_body()
            if extra == "inherited":
                body["_meta"]["provenance"]["resolution"] = "inherited_assumption"
                expected = "_meta.provenance.inherited_from"
            elif extra == "optional":
                body["_meta"]["quality"]["partial"] = "yes"
                expected = "_meta.quality.partial"
            else:
                body["_overrides"] = [{"path": False}]
                expected = "_overrides[0].path"
            report, (response, status) = validate(HEADER + fence(body))
            self.assertEqual(status, 1)
            self.assertNotIn("code", response["error"])
            self.assertIn(expected, [f["field"] for f in report["metadata_assessment"]["shape_findings"]])
            self.assertEqual([i["field"] for i in response["partial_validation_result"]["errors"]], list(FIELDS))

    def test_timestamp_observer_is_exact_t1b_without_offset_or_leap_fallback(self):
        for timestamp in ("0000-02-29T23:59:59Z", "9999-12-31T23:59:59.0000001Z"):
            self.assertTrue(timestamp_shape(timestamp))
        for timestamp in ("2026-01-01t00:00:00Z", "2026-01-01T00:00:00z", "2026-01-01T00:00:00+00:00",
                          "2016-12-31T23:59:60Z", "2026-01-01T00:00:00Z\n", None):
            self.assertFalse(timestamp_shape(timestamp))

    def test_actual_validate_cli_ordinary_errors_good_profile_and_excluded_refusal(self):
        with tempfile.TemporaryDirectory(prefix="uwmd-meta04-validate-") as temporary:
            path = Path(temporary) / "source.uwx.md"
            excluded = invalid_body(); excluded["_meta"]["provenance"]["resolution"] = "inherited_assumption"
            valid = valid_body(); valid["_meta"]["provenance"]["timestamp"] = "0000-02-29T23:59:59.0000000000000001Z"
            for body, expected_exit, ordinary in ((invalid_body(), 1, True), (valid, 0, True), (excluded, 1, False)):
                original = HEADER + fence(body); path.write_bytes(original)
                process = subprocess.run([sys.executable, "-B", str(ROOT / "implementations/python/uwmd.py"),
                    "validate", str(path), "--json"], capture_output=True, encoding="utf-8", timeout=30)
                response = json.loads(process.stdout)
                self.assertEqual(process.returncode, expected_exit)
                self.assertEqual("overall_status" in response, ordinary, response)
                self.assertEqual(path.read_bytes(), original)


if __name__ == "__main__":
    unittest.main()
