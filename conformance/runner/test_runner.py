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
        self.cases = [{"id": target, "target": target} for target in runner.VOCABULARY["targets"]]

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
        for cases, kwargs in [([{"id": "x", "target": "unknown"}], {}), ([self.cases[0]] * 2, {}), (self.cases, {"tiers": "unknown"}), (self.cases, {"profiles": "unknown"})]:
            with self.assertRaises(ValueError):
                runner.select_cases(deepcopy(cases), **kwargs)

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
        self.assertNotIn("tier", runner.result_owner({"target": "starter-products"}))
        self.assertNotIn("tier", runner.result_owner({"target": "module"}))
        self.assertEqual(runner.result_owner({"target": "reader"}), {"target": "reader", "tier": "reader"})


class ReportingTests(unittest.TestCase):
    def test_unclaimed_profile_is_neither_passed_nor_failed_and_no_skip_refuses(self):
        with tempfile.TemporaryDirectory() as directory:
            case_dir = Path(directory)
            (case_dir / "module.case.json").write_text(json.dumps({"id": "custom", "target": "module"}), encoding="utf-8")
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
            (Path(directory) / "verifier.case.json").write_text(json.dumps({"id": "v", "target": "verifier"}), encoding="utf-8")
            for manifest_tier in ["tier-3-calc-host", "tier-4-agent-host"]:
                stderr = io.StringIO()
                args = ["runner.py", "--cases", directory]
                with patch("sys.argv", args), patch.object(runner, "read_manifest", return_value={"tier": manifest_tier}), patch.object(runner, "run_case", return_value=(0.0, [])), contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(stderr):
                    self.assertEqual(runner.main(), 2)
                self.assertIn(f"unknown tier: {manifest_tier}", stderr.getvalue())

