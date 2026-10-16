"""VIII.11 verification evidence, explicitly separate from capability certification."""
import copy
import importlib.util
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

from test_reader import HEADER, block
from uwmd import main
from uwmd_reader import parse
from uwmd_reserves import reserve_structure, verify_reserve_accounts
from uwmd_text import nonblank

ROOT = Path(__file__).resolve().parents[2]
FOLDER = ROOT / "conformance/reserve-accounts"


def fixture(name="verified-source-classes"):
    return parse((FOLDER / name / "deal.uwx.md").read_bytes())


class ReserveTests(unittest.TestCase):
    def test_all_28_unchanged_cases_with_actual_shared_subprocess_comparison(self):
        # Invoke actual shared execution/comparison with each unchanged case.
        # run_case does not perform catalogue capability selection. This direct
        # case evidence is NOT a no-skip/tier/Verifier certification run.
        spec = importlib.util.spec_from_file_location("shared_driver", ROOT / "conformance/runner/runner.py")
        driver = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(driver)
        paths = sorted((ROOT / "conformance/runner/cases").glob("verifier__reserve-accounts__*__verify-reserve-accounts.case.json"))
        self.assertEqual(len(paths), 28)
        for path in paths:
            case = json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual(case["requires_capabilities"], ["parse", "calc-evaluate"])
            with self.subTest(case=case["id"]):
                _, problems = driver.run_case([sys.executable, "-B", str(ROOT / "implementations/python/uwmd.py")], case, 60)
                self.assertEqual(problems, [])
        self.assertEqual(main(["manifest"])[0]["capabilities"], ["parse"])
        self.assertNotEqual(main(["validate", "unused"])[1], 0)
        self.assertNotEqual(main(["calc", "unused"])[1], 0)

    def test_verified_evidence_schema_values_order_and_no_mutation(self):
        document = fixture()
        before = copy.deepcopy(document)
        result = verify_reserve_accounts(document)
        self.assertEqual(result["state"], "verified")
        self.assertNotIn("reason", result)
        self.assertRegex(result["source_digest"], r"^sha256:[0-9a-f]{64}$")
        self.assertEqual([row["period_id"] for row in result["evidence"]], ["jan", "feb"])
        self.assertEqual([row["computed_ending_balance"] for row in result["evidence"]], [150, 100])
        self.assertEqual(result["evidence"][0]["variant"], None)
        self.assertEqual(result["evidence"][0]["field"], "accounts[0].periods[0].ending_balance")
        self.assertEqual(document, before)
        result["evidence"][0]["movements"][0]["source"]["document"] = "result copy"
        self.assertEqual(document, before)

    def test_absence_structure_digest_and_nonfinite_precedence(self):
        absent = parse(HEADER + block("property", {"unrelated": "SURROGATE"}).replace(b'"SURROGATE"', b'"\\ud800"'))
        self.assertEqual(verify_reserve_accounts(absent), dict(state="not_checked", reason="not_applicable", source_digest=None, evidence=[], issues=[]))
        invalid = fixture("missing-source")
        with patch("uwmd_reserves.source_digest", side_effect=AssertionError("must not hash invalid structure")):
            self.assertEqual(verify_reserve_accounts(invalid)["reason"], "invalid_structure")
        valid = fixture()
        # Unrelated data, including metadata/notes, must reach whole-envelope JCS.
        for payload in ({"x": "SURROGATE"}, {"_notes": "SURROGATE"}, {"_meta": {"x": "SURROGATE"}}):
            encoded = block("x_opaque", payload).replace(b'"SURROGATE"', b'"\\ud800"')
            changed = parse(valid.source.raw + encoded)
            result = verify_reserve_accounts(changed)
            self.assertEqual((result["state"], result["reason"]), ("unverifiable", "digest_unavailable"))
            self.assertIsNone(result["source_digest"])
            self.assertEqual(result["evidence"], [])
        overflow = verify_reserve_accounts(fixture("overflow-then-finite-periods"))
        self.assertEqual((overflow["state"], overflow["reason"]), ("unverifiable", "nonfinite_arithmetic"))
        self.assertEqual([i["code"] for i in overflow["issues"]], ["RSV-08", "RSV-06"])
        self.assertEqual([e["period_id"] for e in overflow["evidence"]], ["feb", "mar"])
        json.dumps(overflow, allow_nan=False)

    def test_ecmascript_nonblank_schema_semantics(self):
        self.assertFalse(nonblank("\ufeff"))
        self.assertFalse(nonblank("\u00a0\u2007\u2028\u2029"))
        self.assertTrue(nonblank("\u0085"))
        self.assertTrue(nonblank(" x "))
        payload = copy.deepcopy(fixture().source.blocks[0].parsed.value)
        for field in ("owner", "account_id", "purpose"):
            changed = copy.deepcopy(payload)
            changed["accounts"][0][field] = "\ufeff"
            self.assertIn("RSV-01", [i["code"] for i in reserve_structure(changed, "USD")])
        payload["accounts"][0]["source"]["document"] = "\ufeff"
        self.assertIn("RSV-01", [i["code"] for i in reserve_structure(payload, "USD")])
        payload["accounts"][0]["source"]["document"] = "\u0085"
        self.assertEqual(reserve_structure(payload, "USD"), [])

    def test_every_active_variant_and_history_remain_independent(self):
        payload = fixture().source.blocks[0].parsed.value
        raw = HEADER + block("reserve_accounts", payload, variant="a")
        raw += block("reserve_accounts", payload, variant="b")
        raw += block("reserve_accounts", {"accounts": "not current"}, variant="old", superseded=True)
        document = parse(raw)
        result = verify_reserve_accounts(document)
        self.assertEqual(result["state"], "verified")
        self.assertEqual([e["variant"] for e in result["evidence"]], ["a", "a", "b", "b"])
        for suffix in (block("x_review", {"n": 0}, superseded=True),
                       block("x_review", {"n": 0}, superseded=True) + block("x_review", {"n": 1})):
            with_history = verify_reserve_accounts(parse(raw + suffix))
            self.assertEqual(with_history["state"], "verified")
            self.assertNotEqual(with_history["source_digest"], result["source_digest"])
            self.assertEqual(with_history["evidence"], result["evidence"])
        changed = parse(raw.replace(b'"not current"', b'"changed history"'))
        self.assertNotEqual(verify_reserve_accounts(changed)["source_digest"], result["source_digest"])
        self.assertEqual(verify_reserve_accounts(changed)["evidence"], result["evidence"])

    def test_structural_dates_orders_explicit_movements_and_closed_objects(self):
        payload = copy.deepcopy(fixture().source.blocks[0].parsed.value)
        account = payload["accounts"][0]
        # Shared boundaries are allowed; starts must still increase strictly.
        account["periods"][1]["start_date"] = "2026-01-31"
        self.assertEqual(reserve_structure(payload, "USD"), [])
        account["periods"][1]["start_date"] = "2026-01-30"
        self.assertEqual([i["code"] for i in reserve_structure(payload, "USD")], ["RSV-05"])
        payload = copy.deepcopy(fixture().source.blocks[0].parsed.value)
        payload["accounts"][0]["periods"][0]["movements"][0]["amount"] = True
        self.assertIn("RSV-01", [i["code"] for i in reserve_structure(payload, "USD")])
        payload = copy.deepcopy(fixture().source.blocks[0].parsed.value)
        movements = payload["accounts"][0]["periods"][0]["movements"]
        movements[0]["date"], movements[1]["date"] = "2026-01-15", "2025-12-31"
        self.assertEqual([i["code"] for i in reserve_structure(payload, "USD")], ["RSV-03", "RSV-05"])
        payload["accounts"][0]["periods"][0]["movements"] = None
        self.assertIn("RSV-01", [i["code"] for i in reserve_structure(payload, "USD")])

    def test_source_class_assertions_are_not_economic_authentication(self):
        payload = copy.deepcopy(fixture().source.blocks[0].parsed.value)
        # Source-established classification is the producer's assertion. The
        # verifier does not infer it from amounts or fetch evidence documents.
        movement = payload["accounts"][0]["periods"][0]["movements"][0]
        movement["kind"] = "bank_interest"
        self.assertEqual([i["code"] for i in reserve_structure(payload, "USD")], ["RSV-04"])
        movement.pop("kind")
        self.assertEqual([i["code"] for i in reserve_structure(payload, "USD")], ["RSV-04"])


if __name__ == "__main__":
    unittest.main()
