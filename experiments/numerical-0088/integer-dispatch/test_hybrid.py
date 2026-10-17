"""Bounded candidate evidence, not UWMD numerical or financial conformance."""
import json
from pathlib import Path
import unittest
from freeze import document
from hybrid_reference import P, classify, graph
ROOT = Path(__file__).resolve().parent


class HybridTests(unittest.TestCase):
    def test_frozen_exact_reference_and_limits(self):
        frozen = json.loads((ROOT / "evidence.json").read_bytes())
        self.assertEqual(frozen, document())
        self.assertEqual(len(frozen["cases"]), 24)
        for case in frozen["cases"]:
            self.assertLessEqual(case["graph"]["operations"], 1077)
            if case["classification"]["kind"] == "integer":
                self.assertLessEqual(case["graph"]["operations"], case["classification"]["basic_operation_bound"])

    def test_extremal_significands_across_all_finite_exponent_fields(self):
        # Classification only: no exponent-sized products or coercion to int32.
        # Every significand has <=53 ones, and its largest left shift is 971.
        for field in range(0x7ff):
            for tail in (0, 1, (1 << 52) - 1):
                bits = (field << 52) | tail
                category = classify(P.ONE, bits)
                if category["kind"] == "integer":
                    self.assertLessEqual(category["bit_length"], 1024)
                    self.assertLessEqual(category["popcount"], 53)
                    self.assertLessEqual(category["basic_operation_bound"], 1076)
                    opposite = classify(P.ONE, bits | P.SIGN)
                    self.assertEqual(opposite["basic_operation_bound"], category["basic_operation_bound"] + 1)
        self.assertTrue(classify(P.ONE, 0x433fffffffffffff)["odd"])
        self.assertFalse(classify(P.ONE, 0x4340000000000000)["odd"])
        self.assertEqual(classify(P.ONE, 1)["kind"], "fractional")

    def test_hand_specified_huge_underflow_signs_and_operation_counts(self):
        # Exact identities: (1/2)^N is below the half-minsub midpoint for N>1075.
        # MAX is even, whereas 2^53-1 is odd. Neither needs a huge real oracle.
        known = [(0x3fe0000000000000, P.MAX, 0, 1076),
                 (0x4000000000000000, P.MAX | P.SIGN, 0, 1077),
                 (0xbfe0000000000000, P.MAX, 0, 1076),
                 (0xbfe0000000000000, 0x433fffffffffffff, P.SIGN, 105)]
        for x, y, answer, count in known:
            with self.subTest(x=P.hexword(x), y=P.hexword(y)):
                result = graph(x, y)
                self.assertEqual(result["status"], "finite")
                self.assertEqual(result["bits"], P.hexword(answer))
                self.assertEqual(result["operations"], count)

    def test_range_and_one_rounded_counterexamples(self):
        cases = {c["id"]: c for c in json.loads((ROOT / "evidence.json").read_bytes())["cases"]}
        self.assertEqual(cases["negative-two-subnormal"]["graph"]["bits"], "000012688b70e62b")
        self.assertEqual(cases["unused-square-not-executed"]["graph"]["operations"], 1)
        self.assertEqual(cases["positive-two-overflow"]["graph"]["status"], "intermediate_nonfinite")
        difference = cases["one-rounded-power-difference"]
        self.assertEqual(difference["graph"]["bits"], "3faaacadc6ed30d0")
        self.assertEqual(difference["bounded_mathematical_reference"]["bits"], "3faaacadc6ed30ca")
        self.assertEqual(cases["beyond-old-lab-budget"]["graph"]["status"], "finite")
        self.assertEqual(cases["beyond-safe-integer-near-one"]["bounded_mathematical_reference"]["status"], "outside_oracle_scope")

    def test_53_bit_then_get_double_has_a_real_subnormal_double_rounding_trap(self):
        # Let u = 2^-1074. Exact input is just below the binary64 midpoint 1.5u.
        # An unbounded-exponent, 53-significand-bit intermediate rounds to 1.5u.
        # Its final ties-even conversion rounds up to 2u, although the exact
        # value rounds down to u. A true operation's ternary must survive.
        from fractions import Fraction
        u = Fraction(1, 1 << 1074)
        midpoint = 3 * u / 2
        epsilon = Fraction(1, 1 << 1128)
        precision53_ulp = Fraction(1, 1 << 1126)
        self.assertLess(epsilon, precision53_ulp / 2)
        self.assertEqual(midpoint / precision53_ulp, 3 * (1 << 51))
        self.assertEqual(P.nearest(midpoint - epsilon), 1)
        self.assertEqual(P.nearest(midpoint), 2)
        self.assertEqual(P.nearest(-(midpoint - epsilon)), P.SIGN | 1)
        self.assertEqual(P.nearest(-midpoint), P.SIGN | 2)

    def test_missing_kernel_and_special_admission_are_not_fabricated_answers(self):
        cases = {c["id"]: c for c in json.loads((ROOT / "evidence.json").read_bytes())["cases"]}
        for name in ("fractional-positive-unimplemented", "smallest-positive-fractional", "closest-fractional-below-one"):
            answer = cases[name]["graph"]
            self.assertEqual(answer["status"], "fdlibm_fractional_required")
            self.assertNotIn("bits", answer)
        self.assertEqual(cases["negative-fractional-domain"]["graph"]["status"], "negative_fractional_domain")
        self.assertEqual(cases["finite-admission-before-zero"]["graph"]["status"], "nonfinite_input")
        self.assertEqual(cases["negative-zero-last-odd"]["graph"]["bits"], "8000000000000000")
        self.assertEqual(cases["negative-zero-first-even"]["graph"]["bits"], "0000000000000000")
        self.assertEqual(cases["zero-negative-zero-exponent"]["graph"]["bits"], "3ff0000000000000")


if __name__ == "__main__":
    unittest.main()
