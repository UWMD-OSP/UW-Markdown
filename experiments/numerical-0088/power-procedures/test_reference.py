"""Bounded mathematical evidence; not UWMD financial conformance tests."""
from fractions import Fraction
import hashlib
import json
from pathlib import Path
import unittest

from freeze import document
from reference import INF, MAX, ONE, SIGN, GRAPHS, classify, mathematical_power, nearest, rational, word

ROOT = Path(__file__).resolve().parent


class ReferenceTests(unittest.TestCase):
    def test_frozen_source_inputs_and_exact_reference(self):
        frozen = json.loads((ROOT / "evidence.json").read_bytes())
        self.assertEqual(frozen, document())
        self.assertEqual(len(frozen["cases"]), 40)
        self.assertEqual(frozen["input_sha256"], hashlib.sha256((ROOT / "inputs.json").read_bytes()).hexdigest())

    def test_hand_specified_binary64_rounding_ties_and_neighbors(self):
        tiny = Fraction(1, 1 << 1074)
        # Independent exact identities: even low significands win every tie.
        cases = [(tiny / 2, 0), (3 * tiny / 2, 2), (5 * tiny / 2, 2),
                 (1 + Fraction(1, 1 << 53), ONE),
                 (1 + Fraction(3, 1 << 53), ONE + 2),
                 (rational(MAX) + (1 << 970), INF),
                 (rational(MAX) + (1 << 970) - 1, MAX)]
        for exact, expected in cases:
            with self.subTest(expected=f"{expected:016x}"):
                self.assertEqual(nearest(exact), expected)
                self.assertEqual(nearest(-exact), expected | SIGN)
        self.assertEqual(nearest(Fraction(0)), 0)
        self.assertEqual(nearest(Fraction(0), negative_zero=True), SIGN)
        self.assertEqual(rational(1), tiny)
        self.assertEqual(rational(0x0010000000000000), Fraction(1, 1 << 1022))

    def test_exact_power_roots_and_signed_underflow(self):
        known = [("0000000000000001", "3fe0000000000000", "1e60000000000000"),
                 ("1e60000000000000", "4000000000000000", "0000000000000001"),
                 ("3280000000000000", "4014000000000000", "0000000000000000"),
                 ("b280000000000000", "4014000000000000", "8000000000000000"),
                 ("c000000000000000", "c008000000000000", "bfc0000000000000")]
        for x, y, answer in known:
            with self.subTest(x=x, y=y):
                self.assertEqual(mathematical_power(word(x), word(y))["bits"], answer)

    def test_every_nonexact_root_has_exact_neighbor_midpoint_certificate(self):
        inputs = json.loads((ROOT / "inputs.json").read_bytes())["cases"]
        evidence = json.loads((ROOT / "evidence.json").read_bytes())["cases"]
        certificates = 0
        for given, record in zip(inputs, evidence):
            answer = record["mathematical"]
            proof = answer.get("proof", {})
            if "upper" not in proof:
                continue
            exponent = rational(word(given["y"]))
            target = abs(rational(word(given["x"]))) ** exponent.numerator
            low, high = word(proof["lower"]), word(proof["upper"])
            self.assertEqual(high, low + 1)
            self.assertLess(rational(low) ** exponent.denominator, target)
            self.assertGreater(rational(high) ** exponent.denominator, target)
            comparison = target - ((rational(low) + rational(high)) / 2) ** exponent.denominator
            expected = low if comparison < 0 or comparison == 0 and low % 2 == 0 else high
            self.assertEqual(word(answer["bits"]) & (SIGN - 1), expected)
            certificates += 1
        self.assertGreaterEqual(certificates, 10)

    def test_integer_parity_domain_and_oracle_limit_are_explicit(self):
        self.assertTrue(classify(word("bff0000000000000"), word("433fffffffffffff"))["odd"])
        self.assertFalse(classify(word("bff0000000000000"), word("4340000000000000"))["odd"])
        self.assertEqual(classify(ONE, word("3fefffffffffffff"))["kind"], "fractional")
        self.assertEqual(mathematical_power(word("4000000000000000"), word("3ff199999999999a")),
                         {"status": "outside_oracle_scope"})
        self.assertEqual(mathematical_power(word("7ff8000000000001"), 0), {"status": "nonfinite_input"})

    def test_graph_differences_and_finite_range_counterexample_are_frozen(self):
        records = {c["id"]: c for c in json.loads((ROOT / "evidence.json").read_bytes())["cases"]}
        case = records["large-base-negative-two"]
        self.assertEqual(case["mathematical"]["status"], "finite")
        self.assertNotEqual(word(case["mathematical"]["bits"]), 0)
        self.assertEqual(case["graphs"]["binary-late"]["status"], "intermediate_nonfinite")
        self.assertEqual(case["graphs"]["binary-early"]["status"], "finite")
        different = [c for c in records.values() if c["graphs"]["sequential-late"].get("bits") != c["graphs"]["binary-late"].get("bits")]
        self.assertTrue(different)
        for record in records.values():
            category = record["classification"]
            for name in GRAPHS:
                count = record["graphs"][name]["operations"]
                self.assertLessEqual(count, 257 if name == "sequential-late" else 18)
            if category["kind"] == "fractional" and record["mathematical"]["status"] == "finite":
                # No invented fractional implementation hides behind oracle agreement.
                self.assertIn(record["graphs"]["binary-early"]["status"], ("finite", "fractional_kernel_required"))


if __name__ == "__main__":
    unittest.main()
