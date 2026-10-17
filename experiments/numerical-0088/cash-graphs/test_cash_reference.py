"""New cash/endpoint controls only; no prior audit or full-lab repetition."""
import hashlib
import json
from pathlib import Path
import unittest
from cash_reference import evidence, LO, POWER, rational, word, quantize, shortest

ROOT = Path(__file__).resolve().parent


class CashReferenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.given = json.loads((ROOT / "inputs.json").read_bytes())
        cls.frozen = json.loads((ROOT / "evidence.json").read_bytes())
        cls.cases = {item["id"]: item["graphs"] for item in cls.frozen["cases"]}

    def test_exact_frozen_cash_reference_and_sources(self):
        self.assertEqual(self.frozen, evidence())
        self.assertEqual(len(self.cases), 10)
        self.assertEqual(self.frozen["input_sha256"], hashlib.sha256((ROOT / "inputs.json").read_bytes()).hexdigest())

    def test_money_ties_survive_existing_quantization_and_results_digest(self):
        for case, left, right in (("money-tie-positive", "1", "1.01"), ("money-tie-negative", "-1", "-1.01")):
            graphs = self.cases[case]
            a, b = graphs["sequential-late"]["reporting"], graphs["binary-late"]["reporting"]
            self.assertEqual(a["quantization"]["number_token"], left)
            self.assertEqual(b["quantization"]["number_token"], right)
            self.assertNotEqual(a["results_digest"], b["results_digest"])
            for result in (a, b):
                self.assertEqual(result["results_digest"], "sha256:"+hashlib.sha256(result["results_preimage"].encode()).hexdigest())

    def test_endpoint_precedence_and_no_bisection_or_outside_root(self):
        a, b = self.cases["upper-sequential-root"], self.cases["upper-binary-root"]
        self.assertEqual(a["sequential-late"]["status"], "endpoint_root")
        self.assertEqual(a["binary-late"]["status"], "no_bracket")
        self.assertEqual(a["binary-late"]["prospective_error"], "CALC-IRR-DIVERGE")
        self.assertNotIn("reporting", a["binary-late"])
        self.assertEqual(b["sequential-late"]["status"], "bisection_required")
        self.assertNotIn("bits", b["sequential-late"])
        self.assertNotIn("reporting", b["sequential-late"])
        for name in POWER.GRAPHS:
            self.assertEqual(self.cases["zero-endpoint-precedence"][name]["bits"], f"{LO:016x}")
            self.assertEqual(self.cases["root-outside-bracket"][name]["status"], "no_bracket")

    def test_source_order_and_missing_fractional_procedure_are_explicit(self):
        for name in POWER.GRAPHS:
            self.assertEqual(self.cases["ordered-cancellation"][name]["bits"], "0000000000000000")
            self.assertEqual(self.cases["reordered-cancellation"][name]["bits"], "3ff0000000000000")
            missing = self.cases["dated-fractional-missing"][name]
            self.assertEqual(missing["reason"], "fractional_kernel_required")
            self.assertNotIn("reporting", missing)
        ranged = self.cases["dated-reciprocal-range"]
        self.assertEqual(ranged["binary-late"]["reason"], "intermediate_nonfinite")
        self.assertEqual(ranged["binary-early"]["bits"], "000012688b70e62b")
        self.assertEqual(ranged["binary-early"]["reporting"]["quantization"]["number_token"], "0")

    def test_decimal_shift_is_not_rounding_exact_binary_input_or_repr(self):
        bits = word("3ff0147ae147ae14")
        self.assertEqual(shortest(bits), (1005, -3))
        exact_scaled = rational(bits) * 100
        exact_halfaway = (exact_scaled + POWER.Fraction(1, 2)).numerator // (exact_scaled + POWER.Fraction(1, 2)).denominator
        self.assertEqual(exact_halfaway, 100)
        self.assertEqual(quantize(bits, 2)["rounded_integer"], "101")
        controls = {c["id"]: c["boundary"]["number_token"] for c in self.frozen["quantization_controls"]}
        self.assertEqual(controls["positive-half"], "3")
        self.assertEqual(controls["negative-half"], "-3")
        self.assertEqual(controls["negative-zero"], "0")


if __name__ == "__main__":
    unittest.main()
