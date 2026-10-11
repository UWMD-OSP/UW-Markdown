import contextlib
import io
import unittest
from copy import deepcopy
import runner


class SelectionTests(unittest.TestCase):
    def setUp(self):
        self.cases = [{"id": target, "target": target} for target in runner.READINGS["targets"]]

    def test_cumulative_tiers_and_explicit_profiles(self):
        self.assertEqual([c["target"] for c in runner.select_cases(deepcopy(self.cases), "verifier")], ["reader", "verifier"])
        self.assertEqual([c["target"] for c in runner.select_cases(deepcopy(self.cases), profiles="module")], ["module"])
        self.assertEqual([c["target"] for c in runner.select_cases(deepcopy(self.cases), starter=True)], ["starter-products"])

    def test_legacy_mapping_is_generated_and_deprecated(self):
        for value, reading in runner.READINGS["tiers"].items():
            stderr = io.StringIO()
            with contextlib.redirect_stderr(stderr):
                selected = runner.select_cases(deepcopy(self.cases), value)
            self.assertEqual(selected, runner.select_cases(deepcopy(self.cases), reading["tier"]))
            self.assertEqual(bool(stderr.getvalue()), "legacy" in reading)

    def test_unknown_cases_duplicates_and_selectors_refused(self):
        for cases, kwargs in [([{"id": "x", "target": "unknown"}], {}), ([self.cases[0]] * 2, {}), (self.cases, {"tiers": "unknown"}), (self.cases, {"profiles": "unknown"})]:
            with self.assertRaises(ValueError):
                runner.select_cases(deepcopy(cases), **kwargs)

    def test_profile_requires_explicit_claim(self):
        case = {"target": "module"}
        for manifest in [None, {}, {"tier": "tier-3-calc-host"}, {"profiles": []}, {"capabilities": ["module-load", "calc-evaluate"]}]:
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
