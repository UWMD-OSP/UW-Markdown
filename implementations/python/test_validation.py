"""Integrated validation development evidence; not a validate capability claim."""
import asyncio
import copy
import importlib.util
import json
from pathlib import Path
import unittest

from test_reader import HEADER, block
from uwmd_reader import parse
from uwmd_validation import validate_document
from uwmd_validation_core import CC_IDS, STAGES, sections_required, stage_readiness

ROOT = Path(__file__).resolve().parents[2]


def validate(document, **options):
    return asyncio.run(validate_document(document, now="2026-10-16T00:00:00Z", **options))


def codes(result):
    return [(i["code"], i["severity"]) for i in result["issues"]]


def well_formed(section, **payload):
    meta = dict(section=section, provenance=dict(source="manual", actor="tester",
                timestamp="2026-01-01T00:00:00Z"),
                quality=dict(confidence="high", human_review_required=False),
                lifecycle=dict(revision=1, superseded=False))
    return block(section, {"_meta": meta, **payload})


class ValidationTests(unittest.TestCase):
    def test_111_existing_projection_assertions_direct_api_not_cli_or_capability(self):
        spec = importlib.util.spec_from_file_location("shared_validation_comparison", ROOT / "conformance/runner/runner.py")
        driver = importlib.util.module_from_spec(spec); spec.loader.exec_module(driver)
        paths = sorted((ROOT / "conformance/runner/cases").glob("*__validate.case.json"))
        self.assertEqual(len(paths), 111)
        for path in paths:
            case = json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual(case["requires_capabilities"], ["validate"])
            source = ROOT / case["fixture_dir"] / case["args"][0]
            expected_path = ROOT / case["expect"]["file"] if "/" in case["expect"]["file"] else source.parent / case["expect"]["file"]
            expected = json.loads(expected_path.read_text(encoding="utf-8"))
            with self.subTest(case=case["id"]):
                before = source.read_bytes()
                document = parse(before)
                actual = validate(document)
                projected = driver.project(actual, case["expect"].get("project"))
                self.assertEqual(driver.json_subset(expected, projected), [])
                self.assertEqual(source.read_bytes(), before)
                self.assertEqual(document.source.raw, before)
                self.assertEqual(set(actual["coverage"]), set(CC_IDS))
                self.assertEqual(set(actual["stage_readiness"]), set(STAGES))
        # This directly compares existing frozen API projections. No command
        # adaptation, capability selection, stdout/exit or tier pass is claimed.

    def test_result_partitions_and_coverage_are_complete_and_source_is_read_only(self):
        raw = HEADER + well_formed("property", total_units=12)
        document = parse(raw); original = copy.deepcopy(document)
        result = validate(document)
        self.assertEqual(set(result["coverage"]), set(CC_IDS))
        self.assertEqual(set(result["stage_readiness"]), set(STAGES))
        self.assertTrue(all(isinstance(v, bool) for v in result["stage_readiness"].values()))
        for severity, key in (("error", "errors"), ("warning", "warnings"), ("info", "info")):
            self.assertEqual(result[key], [i for i in result["issues"] if i["severity"] == severity])
        self.assertEqual(document, original)
        if result["issues"]:result["issues"][0]["message"] = "mutated result"
        self.assertEqual(document, original)

    def test_registered_metadata_domains_and_warning_info_severities(self):
        missing = parse(HEADER + b'~~~json uw:section=property\n{"value":1}\n~~~\n')
        result = validate(missing)
        self.assertIn(("META_MISSING", "warning"), codes(result))
        self.assertNotIn(("META-01", "error"), codes(result))
        partial = dict(section="property", provenance={}, quality={"confidence":"low"},
                       lifecycle={"superseded":False})
        result = validate(parse(HEADER + block("property", {"_meta":partial})))
        self.assertTrue({("META_FIELD_MISSING_VERSION","warning"),("META_FIELD_MISSING_SOURCE","warning"),
                         ("META_FIELD_MISSING_TIMESTAMP","warning"),("META_LOW_CONFIDENCE_NO_REVIEW_FLAG","info")} <= set(codes(result)))
        self.assertNotIn(("META_FIELD_MISSING_CONFIDENCE","warning"),codes(result))
        malformed = validate(parse(HEADER + block("property", {"_meta":None})))
        self.assertIn(("META-01","error"),codes(malformed))
        self.assertNotIn(("META_MISSING","warning"),codes(malformed))

    def test_stage_overlays_share_readiness_and_declared_gaps(self):
        for asset in ("multifamily","land","mixed_use","data_center","unknown"):
            raw = HEADER.replace(b"asset_class: multifamily", ("asset_class: "+asset).encode())
            raw = raw.replace(b"---\n",b"---\n",1)
            raw = raw.replace(b"unknown_key: retained",b"deal_stage: full_underwrite")
            needed = sections_required("full_underwrite",asset)
            for section in needed:
                raw += well_formed(section, **({"address":"A","asset_class":asset,"units":0} if section=="property" else {}))
            document=parse(raw);readiness=stage_readiness(document)
            self.assertTrue(readiness["full_underwrite"],asset)
            self.assertTrue(readiness["scope"],asset)  # Explicit zero remains present.
            result=validate(document)
            self.assertFalse(any(i["code"]=="DQ-06" for i in result["issues"]),asset)
            raw=raw[:document.source.blocks[-1].fence_span.start]
            result=validate(parse(raw))
            self.assertFalse(result["stage_readiness"]["full_underwrite"])
            self.assertIn(("DQ-06","info"),codes(result))

    def test_source_role_checks_include_unselected_active_but_not_history(self):
        raw=HEADER+well_formed("property",total_units=1)
        raw+=block("debt_structure", {"_role":"invalid"},variant="unused")
        raw+=block("debt_structure", {"loan_amount":1},variant="selected",role="senior")
        raw+=block("x_history", {"_role":"invalid"},superseded=True)
        result=validate(parse(raw))
        roles=[i for i in result["issues"] if i["code"]=="ROLE-01"]
        self.assertEqual(len(roles),1)
        self.assertEqual(roles[0]["section"],"debt_structure")

    def test_cross_check_roles_capture_skip_evidence_without_changing_status(self):
        raw=HEADER+well_formed("property",total_units=1)
        for variant in ("a","b"):
            raw+=block("debt_structure",{"loan_amount":10},variant=variant,role="senior")
        raw+=well_formed("valuation",purchase_price=100)
        result=validate(parse(raw))
        self.assertEqual(result["coverage"]["CC-02"]["reason"],"variant_unresolvable")
        issue=next(i for i in result["issues"] if i["code"]=="CC-16" and i["section"]=="debt_structure")
        self.assertEqual(issue["severity"],"info")
        self.assertNotIn(("CC-02","warning"),codes(result))
        self.assertNotIn(("CC-03","error"),codes(result))

    def test_static_period_kind_check_is_not_short_circuit_evaluation(self):
        raw=HEADER+well_formed("property",total_units=1)+well_formed("dcf",annual_cash_flows=[{"year":1}])
        raw+=well_formed("custom_calculations",formula="true || dcf.annual_cash_flows@2026-01-01.noi")
        result=validate(parse(raw))
        self.assertIn(("PS-03","warning"),codes(result))
        self.assertFalse(any(i["code"].startswith("CALC-") for i in result["issues"]))

    def test_all_fourteen_fv_codes_thresholds_and_no_recalculation(self):
        cases = (
            ("valuation", {"going_in_cap_rate":.01}, "FV-01", "warning"),
            ("valuation", {"going_in_cap_rate":.16}, "FV-02", "warning"),
            ("debt_structure", {"sizing_metrics":{"debt_yield":.01}}, "FV-03", "warning"),
            ("debt_structure", {"sizing_metrics":{"dscr_underwritten":.9}}, "FV-04", "error"),
            ("dcf", {"returns":{"equity_multiple":.8}}, "FV-05", "warning"),
            ("dcf", {"returns":{"equity_multiple":6}}, "FV-06", "warning"),
            ("dcf", {"returns":{"levered_irr":.01}}, "FV-07", "warning"),
            ("dcf", {"returns":{"levered_irr":.5}}, "FV-08", "warning"),
            ("debt_structure", {"sizing_metrics":{"ltv":.9}}, "FV-09", "error"),
            ("noi_model", {"expenses":{"expense_ratio":.1}}, "FV-10", "warning"),
            ("noi_model", {"expenses":{"expense_ratio":.8}}, "FV-11", "warning"),
            ("dcf", {"assumptions":{"revenue_growth_rate":.1}}, "FV-12", "warning"),
            ("noi_model", {"income":{"vacancy_credit_loss":{"rate_applied":.01}}}, "FV-13", "warning"),
            ("noi_model", {"income":{"vacancy_credit_loss":{"rate_applied":.5}}}, "FV-14", "warning"))
        for section,payload,code,severity in cases:
            with self.subTest(code=code):
                parsed=parse(HEADER+well_formed(section,**payload));before=copy.deepcopy(parsed)
                self.assertIn((code,severity),codes(validate(parsed)))
                self.assertEqual(parsed,before)
        # These exercise accepted canonical paths and thresholds; no financial
        # metric or model is recomputed to perform plausibility validation.

    def test_fv_warning_error_boundaries_institution_override_and_unknown_values(self):
        for value,expected in ((1.0,("FV-04","warning")),(1.2,None),(.99,("FV-04","error")),
                               (None,None),(False,None),("0.1",None)):
            with self.subTest(value=value):
                parsed=parse(HEADER+well_formed("debt_structure",sizing_metrics={"dscr_underwritten":value}))
                emitted=[c for c in codes(validate(parsed)) if c[0].startswith("FV-")]
                self.assertEqual(emitted,[expected] if expected else [])
        parsed=parse(HEADER+well_formed("debt_structure",sizing_metrics={"dscr_underwritten":1.2}))
        result=validate(parsed,thresholds={"dscr":{"warning_below":1.3,"error_below":1.1}})
        self.assertIn(("FV-04","warning"),codes(result))
        self.assertEqual(parsed.source.blocks[0].parsed.value["sizing_metrics"]["dscr_underwritten"],1.2)

    def test_separate_async_v12_mismatch_never_becomes_structural_hdg09(self):
        path=ROOT/"conformance/hedge/0070-stale-amount/deal.uwx.md"
        result=validate(parse(path.read_bytes()))
        self.assertFalse(any(i["code"]=="HDG-09" for i in result["issues"]))
        self.assertEqual(result["replacement_funding_verification"]["state"],"failed")
        self.assertEqual(result["replacement_funding_verification"]["reason"],"stale_binding")
        self.assertEqual([i["code"] for i in result["replacement_funding_verification"]["issues"]],["HDG-09"])


if __name__ == "__main__":
    unittest.main()
