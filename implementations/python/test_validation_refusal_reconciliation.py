"""Exact registered-condition reconciliation; no new diagnostic allocation."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from test_reader import HEADER
from test_validation import ROOT, validate, well_formed
import test_validation_cli as cli
from test_validation_cli import property_source, fence
from uwmd import _validation_response
from uwmd_reader import parse
from uwmd_source_validation import inspect_source_roles


class RefusalReconciliationTests(unittest.TestCase):
    def assess(self, raw):
        source = parse(raw)
        before = copy.deepcopy(source)
        result = validate(source)
        self.assertEqual(source, before)
        self.assertEqual(source.source.raw, raw)
        return source, result

    def recoveries(self, tenants):
        return property_source() + well_formed("rent_roll", tenants=tenants)

    def test_recovery_ownership_is_exact_physical_row_field_and_constraint(self):
        terms = [dict(method="net", pro_rata_share=12),
                 dict(method="net", cap=dict(pct=.05)),
                 dict(pro_rata_share=.1),
                 dict(method="net", pro_rata_share=False, admin_fee_pct="bad")]
        source, result = self.assess(self.recoveries([dict(recovery_terms=t) for t in terms]))
        assessment = result["section_assessment"]["lease_recoveries"]
        self.assertEqual([f["field"] for f in assessment["shape_findings"]],
                         ["tenants[3].recovery_terms.admin_fee_pct"])
        handled = assessment["handled_shape_findings"]
        self.assertEqual([(f["field"], f["registered_code"]) for f in handled], [
            ("tenants[0].recovery_terms.pro_rata_share", "REC-01"),
            ("tenants[1].recovery_terms.cap.accumulation", "REC-02"),
            ("tenants[2].recovery_terms.method", "REC-02"),
            ("tenants[3].recovery_terms.pro_rata_share", "REC-01")])
        self.assertTrue(all(f["context"]["block_index"] == 1 for f in handled))
        self.assertTrue(all("code" not in f and "severity" not in f for f in handled))
        handled[0]["context"]["block_index"] = 999
        self.assertEqual(source.source.blocks[1].parsed.value["tenants"][0]["recovery_terms"]["pro_rata_share"], 12)
        fresh = validate(source)["section_assessment"]["lease_recoveries"]
        self.assertEqual(fresh["handled_shape_findings"][0]["context"]["block_index"], 1)

    def test_same_generic_recovery_code_does_not_cover_other_constraints_or_fields(self):
        for terms, field in (
            (dict(method=None, pro_rata_share=.1), "method"),
            (dict(method="net", pro_rata_share=12, cap=[]), "cap"),
            (dict(method="net", cap=dict(pct=.05, accumulation="unknown")), "cap.accumulation")):
            _, result = self.assess(self.recoveries([dict(recovery_terms=terms)]))
            assessment = result["section_assessment"]["lease_recoveries"]
            self.assertIn("tenants[0].recovery_terms." + field,
                          [f["field"] for f in assessment["shape_findings"]])
            self.assertTrue(any(i["code"].startswith("REC-") for i in result["errors"]))
            response, status = _validation_response(result)
            self.assertEqual(status, 1)
            self.assertNotIn("code", response["error"])
        # A future schema bound must not be consumed by the present REC-01 rule.
        with tempfile.TemporaryDirectory(prefix="uwmd-rec-constraint-") as folder:
            provider = Path(folder)
            schema = json.loads((ROOT/"spec/schemas/lease-recovery-terms.schema.json").read_text(encoding="utf-8"))
            schema["properties"]["pro_rata_share"]["maximum"] = .5
            (provider/"lease-recovery-terms.schema.json").write_text(json.dumps(schema), encoding="utf-8")
            with patch("uwmd_validation_optional_shapes._SCHEMAS", provider):
                _, result = self.assess(self.recoveries([dict(recovery_terms=dict(method="net", pro_rata_share=2))]))
            findings = result["section_assessment"]["lease_recoveries"]["shape_findings"]
            self.assertEqual([f["field"] for f in findings], ["tenants[0].recovery_terms.pro_rata_share"])
            self.assertTrue(any(i["code"] == "REC-01" for i in result["errors"]))

    def test_registered_metadata_container_precondition_retains_raw_and_independent_evidence(self):
        body = parse(property_source()).source.blocks[0].parsed.value
        body["_meta"]["provenance"] = None
        body["_meta"]["quality"]["human_review_required"] = "bad"
        body["_overrides"] = [dict(path=False, source="not-an-actor")]
        source, result = self.assess(HEADER + fence(body))
        assessment = result["metadata_assessment"]
        self.assertEqual([f["field"] for f in assessment["shape_findings"]], ["_overrides[0].path"])
        self.assertIn("_meta.quality.human_review_required",
                      [f["field"] for f in assessment["handled_shape_findings"]])
        self.assertEqual(result["errors"], inspect_source_roles(source)["issues"])
        self.assertTrue(any(i["code"] == "SRC-01" for i in result["errors"]))
        self.assertTrue(all(f["disposition"] == "blocked_by_registered_metadata_shape"
                            for f in assessment["handled_shape_findings"]))
        assessment["handled_shape_findings"][0]["message"] = "consumer edit"
        self.assertNotEqual(validate(source)["metadata_assessment"]["handled_shape_findings"][0]["message"],
                            "consumer edit")

    def test_valid_nested_shape_late_section_quality_and_actor_only_errors_remain_local(self):
        good = parse(property_source()).source.blocks[0].parsed.value
        late = dict(value=1, **good)
        wrong = copy.deepcopy(good); wrong["_meta"]["section"] = "wrong"
        quality = copy.deepcopy(good); del quality["_meta"]["quality"]
        actor = copy.deepcopy(good)
        del actor["_meta"]["provenance"]["actor"]
        del actor["_meta"]["quality"]["human_review_required"]
        del actor["_meta"]["lifecycle"]["superseded"]
        for body, fields in ((late, ["_meta"]), (wrong, ["_meta.section"]),
                             (quality, ["_meta.quality"]),
                             (actor, ["_meta.quality.human_review_required", "_meta.lifecycle.superseded"])):
            _, result = self.assess(HEADER + fence(body))
            assessment = result["metadata_assessment"]
            self.assertEqual([f["field"] for f in assessment["shape_findings"]], fields)
            self.assertNotIn("handled_shape_findings", assessment)
            response, status = _validation_response(result)
            self.assertEqual(status, 1)
            self.assertNotIn("code", response["error"])
            self.assertNotIn("overall_status", response)

    def test_history_container_does_not_expand_active_local_checks_or_hide_other_actor(self):
        good = parse(property_source()).source.blocks[0].parsed.value
        historical = dict(section_id="property", _meta=dict(provenance={}, lifecycle={}))
        actor = copy.deepcopy(good); actor["_meta"]["provenance"]["actor"] = ""
        source, result = self.assess(HEADER + fence(historical, historical=True) + fence(actor))
        self.assertEqual(result["metadata_assessment"]["shape_findings"], [])
        self.assertNotIn("handled_shape_findings", result["metadata_assessment"])
        self.assertEqual([(i["field"], i["context"]["block_index"]) for i in result["errors"]],
                         [("_meta", 0), ("_meta.provenance.actor", 1)])
        response, status = _validation_response(result)
        self.assertEqual((status, response["overall_status"]), (1, "errors"))
        self.assertEqual(len(source.source.blocks), 2)


class FrozenRefusalReconciliationCLI(unittest.TestCase):
    def test_exact_nine_sources_retain_registered_results_and_six_return_normal_invalid(self):
        # Reuse only the CLI execution utility; these are native source/code
        # assertions, not an assertion of a whole native conformance case pass.
        utility = cli.ValidationCLITests()
        utility.setUp()
        self.addCleanup(utility.doCleanups)
        for directory, partial in (
            ("recoveries/reject-cap-without-accumulation", False),
            ("recoveries/reject-share-as-percent", False),
            ("recoveries/reject-member-without-method", False),
            ("documents/malformed/02-low-confidence-no-review", True),
            ("documents/malformed/03-sources-uses-mismatch", True),
            ("documents/malformed/10-property-section-missing", True),
            ("documents/malformed/20-flat-meta", False),
            ("documents/malformed/21-section-id-wrapper", False),
            ("documents/malformed/29-actor-shape-precedence", False)):
            with self.subTest(directory=directory):
                if directory.startswith("recoveries/"):
                    source = ROOT/"conformance"/directory/"deal.uwx.md"
                    expected = json.loads((source.parent/"expected.json").read_text(encoding="utf-8"))
                else:
                    source = ROOT/"conformance"/(directory + ".uwx.md")
                    expected = json.loads(source.with_name(source.name.removesuffix(".uwx.md") + ".expected.json").read_text(encoding="utf-8"))
                raw = source.read_bytes()
                document = parse(raw)
                result = validate(document)
                response, status = utility.command(raw)
                self.assertEqual(status, 1)
                self.assertEqual("partial_validation_result" in response, partial)
                emitted = response["partial_validation_result"] if partial else response
                self.assertEqual(emitted["issues"], result["issues"])
                self.assertEqual(emitted["errors"], result["errors"])
                self.assertEqual(emitted["warnings"], result["warnings"])
                self.assertEqual(emitted["info"], result["info"])
                self.assertEqual(emitted["stage_readiness"], result["stage_readiness"])
                self.assertEqual(emitted["coverage"], result["coverage"])
                if directory.startswith("recoveries/"):
                    self.assertEqual([i["code"] for i in emitted["errors"]], expected["codes"])
                else:
                    # Frozen files use issue subsets; retain their original
                    # registered presence checks without assuming exact counts.
                    self.assertTrue(set(expected["expected_codes"]) <= {i["code"] for i in emitted["issues"]})
                    self.assertTrue(any(i["code"] == "META-01" for i in emitted["errors"]))
                if partial:
                    self.assertEqual([f["field"] for f in response["metadata_assessment"]["shape_findings"]],
                        ["_meta.quality.human_review_required", "_meta.lifecycle.superseded"])
                else:
                    self.assertEqual(response["overall_status"], "errors")
                self.assertEqual(source.read_bytes(), raw)


if __name__ == "__main__":
    unittest.main()
