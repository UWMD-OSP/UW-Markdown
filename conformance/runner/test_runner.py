# Historical tier names below are intentionally refused negative inputs.
import contextlib
import io
import unittest
import json
import tempfile
from pathlib import Path
from unittest.mock import patch
from copy import deepcopy
import runner


class SelectionTests(unittest.TestCase):
    def setUp(self):
        self.cases = [{"id": target, "target": target, "format_version": "3.0"} for target in runner.VOCABULARY["targets"]]

    def test_cumulative_tiers_and_explicit_profiles(self):
        self.assertEqual([c["target"] for c in runner.select_cases(deepcopy(self.cases), "verifier")], ["reader", "verifier"])
        self.assertEqual([c["target"] for c in runner.select_cases(deepcopy(self.cases), profiles="module")], ["module"])
        self.assertEqual([c["target"] for c in runner.select_cases(deepcopy(self.cases), starter=True)], ["starter-products"])

    def test_only_the_two_tiers_are_read(self):
        self.assertEqual(runner.VOCABULARY["tiers"], ["reader", "verifier"])
        for value in ["tier-1-reader", "tier-3-calc-host", "3", "Reader", "calc-host"]:
            with self.assertRaises(ValueError):
                runner.select_cases(deepcopy(self.cases), value)

    def test_unknown_cases_duplicates_and_selectors_refused(self):
        for cases, kwargs in [([{"id": "x", "target": "unknown", "format_version": "3.0"}], {}), ([self.cases[0]] * 2, {}), (self.cases, {"tiers": "unknown"}), (self.cases, {"profiles": "unknown"})]:
            with self.assertRaises(ValueError):
                runner.select_cases(deepcopy(cases), **kwargs)

    def test_cases_select_by_the_format_version_they_were_written_for(self):
        # RFC 0111 D6: a Verifier runs the cases of every rule set it keeps.
        cases = [{"id": "a", "target": "verifier", "format_version": "3.0"},
                 {"id": "b", "target": "verifier", "format_version": "3.1"}]
        self.assertEqual([c["id"] for c in runner.select_cases(deepcopy(cases))], ["a", "b"])
        self.assertEqual([c["id"] for c in runner.select_cases(deepcopy(cases), format_versions="3.0")], ["a"])
        self.assertEqual([c["id"] for c in runner.select_cases(deepcopy(cases), format_versions="3.0, 3.1")], ["a", "b"])
        self.assertEqual(runner.select_cases(deepcopy(cases), format_versions="3.2"), [])

    def test_a_case_without_a_format_version_or_a_bad_selector_is_refused(self):
        for version in [None, "", "3", 3.0, "v3.0"]:
            case = {"id": "x", "target": "verifier"} | ({} if version is None else {"format_version": version})
            with self.assertRaises(ValueError):
                runner.select_cases([case])
        with self.assertRaises(ValueError):
            runner.select_cases(deepcopy(self.cases), format_versions="latest")

    def test_profile_requires_explicit_claim(self):
        case = {"target": "module"}
        for manifest in [None, {}, {"tier": "verifier"}, {"profiles": []}, {"capabilities": ["module-load", "calc-evaluate"]}]:
            self.assertEqual(runner.missing_profiles(case, manifest), ["module"])
        self.assertEqual(runner.missing_profiles(case, {"profiles": ["module"]}), [])
        self.assertEqual(runner.missing_profiles({"target": "verifier"}, {}), [])

    def test_capability_omission_still_fails_closed(self):
        for manifest in [None, {}, {"capabilities": []}]:
            self.assertIsNone(runner.claimed_capabilities(manifest))
            self.assertEqual(runner.missing_capabilities({"requires_capabilities": ["parse"]}, runner.claimed_capabilities(manifest)), [])
        self.assertEqual(runner.missing_capabilities({"requires_capabilities": ["parse", "validate"]}, {"parse"}), ["validate"])

    def test_result_ownership_does_not_claim_a_tier_for_products(self):
        self.assertNotIn("tier", runner.result_owner({"target": "starter-products", "format_version": "3.0"}))
        self.assertNotIn("tier", runner.result_owner({"target": "module", "format_version": "3.0"}))
        self.assertEqual(runner.result_owner({"target": "reader", "format_version": "3.0"}),
                         {"target": "reader", "tier": "reader", "format_version": "3.0"})


class ReportingTests(unittest.TestCase):
    def test_unclaimed_profile_is_neither_passed_nor_failed_and_no_skip_refuses(self):
        with tempfile.TemporaryDirectory() as directory:
            case_dir = Path(directory)
            (case_dir / "module.case.json").write_text(json.dumps({"id": "custom", "target": "module", "format_version": "3.0"}), encoding="utf-8")
            output = case_dir / "report.json"
            for no_skip, expected_exit in [(False, 0), (True, 1)]:
                args = ["runner.py", "--cases", directory, "--manifest-out", str(output)] + (["--no-skip"] if no_skip else [])
                with patch("sys.argv", args), patch.object(runner, "read_manifest", return_value={"tier": "verifier", "capabilities": ["calc-evaluate"]}), patch.object(runner, "run_case") as run, contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                    self.assertEqual(runner.main(), expected_exit)
                    run.assert_not_called()
                report = json.loads(output.read_text(encoding="utf-8"))
                self.assertEqual(report["summary"]["passed"], 0)
                self.assertEqual(report["summary"]["failed"], 0)
                self.assertEqual(report["summary"]["unverifiable"], 1)
                self.assertEqual(report["summary"]["skipped"], 0)
                self.assertEqual(report["by_target"]["module"]["unverifiable"], 1)

    def test_a_retired_manifest_tier_is_refused(self):
        with tempfile.TemporaryDirectory() as directory:
            (Path(directory) / "verifier.case.json").write_text(json.dumps({"id": "v", "target": "verifier", "format_version": "3.0"}), encoding="utf-8")
            for manifest_tier in ["tier-3-calc-host", "tier-4-agent-host"]:
                stderr = io.StringIO()
                args = ["runner.py", "--cases", directory]
                with patch("sys.argv", args), patch.object(runner, "read_manifest", return_value={"tier": manifest_tier}), patch.object(runner, "run_case", return_value=(0.0, [])), contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(stderr):
                    self.assertEqual(runner.main(), 2)
                self.assertIn(f"unknown tier: {manifest_tier}", stderr.getvalue())



class VerifierComparatorTests(unittest.TestCase):
    """RFC 0115: the verdict, statement and assembly comparisons."""

    def test_verdict_codes_reads_only_the_named_fields(self):
        report = {"section": "capital_stack", "variant": None, "status": "failed",
                  "verification": {"verdict": "failed", "issues": [{"code": "CS-SIZING-DISAGREES"}]}}
        projected = runner.project(report, "section-verification")
        self.assertEqual(projected, {"verdict": "failed", "codes": ["CS-SIZING-DISAGREES"]})
        self.assertEqual(runner.verdict_codes({"verdict": "failed", "expected_code": "CS-SIZING-DISAGREES"}, projected, ["verdict", "expected_code"]), [])
        self.assertTrue(runner.verdict_codes({"verdict": "verified"}, projected, ["verdict"]))
        self.assertTrue(runner.verdict_codes({"expected_code": "CS-OTHER"}, projected, ["expected_code"]))
        # A document fixture's validator codes are not verifier codes: unnamed fields are not read.
        self.assertEqual(runner.verdict_codes({"verdict": "failed", "expected_codes": ["CS-04"]}, projected, ["verdict"]), [])
        with self.assertRaises(runner.Failure):
            runner.verdict_codes({}, projected, ["state"])

    def test_not_applicable_is_never_a_verdict(self):
        projected = runner.project({"status": "not_applicable", "verification": None}, "section-verification")
        self.assertTrue(runner.verdict_codes({"verdict": "verified"}, projected, ["verdict"]))

    def test_receipt_refusal_and_verdict(self):
        self.assertEqual(runner.project({"error": {"code": "RCP_MALFORMED"}}, "receipt-verification"), {"refused_code": "RCP_MALFORMED"})
        projected = runner.project({"verdict": "unverifiable", "issues": [{"code": "RCP-05"}, {"code": "RCP-08"}]}, "receipt-verification")
        self.assertEqual(runner.verdict_codes({"verdict": "unverifiable", "expected_codes": ["RCP-08"]}, projected, ["verdict", "expected_codes"]), [])

    def test_statement_states_checks_each_address_absence_and_count(self):
        report = {"counts": {"failed": 1}, "evidence": [
            {"path": "valuation.going_in_cap_rate", "state": "failed"},
            {"path": "quick_metrics.cap_rate", "state": "verified"}]}
        want = {"expect": [{"path": "valuation.going_in_cap_rate", "state": "failed"}], "absent": ["valuation.x"], "failed": 1}
        self.assertEqual(runner.statement_states(want, report), [])
        self.assertTrue(runner.statement_states({**want, "absent": ["quick_metrics.cap_rate"]}, report))
        self.assertTrue(runner.statement_states({**want, "failed": 0}, report))
        self.assertTrue(runner.statement_states({"expect": [{"path": "valuation.y", "state": "verified"}]}, report))

    def test_assembly_projection_and_pointer(self):
        result = {"series": {"series": [{"date": "2026-01-01", "amount": -1}, {"date": "2027-01-01", "amount": 2}]},
                  "cells": [{"slot": "acquisition"}, {"slot": "2026-Q1"}, {"slot": "2026-Q1"}, {"slot": "disposition"}],
                  "bindings": [{"source_path": "a"}, {"source_path": "b"}]}
        projected = runner.project(result, "property-cash-flow-assembly")
        self.assertEqual((projected["amounts"], projected["dates"], projected["cell_count"], projected["source_periods"], projected["source_paths"]),
                         ([-1, 2], ["2026-01-01", "2027-01-01"], 4, ["2026-Q1"], ["a", "b"]))
        refusal = runner.project({"error": {"code": "CALC-CF-ASSEMBLY", "reason": "verification", "pointer": "p",
                                            "evidence": {"lease_up": {"evidence": {"verification": {"verdict": "failed"}}}}}}, "property-cash-flow-assembly")
        self.assertEqual(refusal, {"error_code": "CALC-CF-ASSEMBLY", "reason": "verification", "pointer": "p", "lease_up_verdict": "failed"})
        self.assertEqual(runner.json_pointer({"cases": [{"a": 1}, {"a/b": 2}]}, "/cases/1/a~1b"), 2)
