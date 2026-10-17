"""Independent mathematical certificate checks, not financial conformance."""
from fractions import Fraction
import importlib.util
import json
from pathlib import Path
import unittest
from math_reference import P, answer, exp_interval, log_interval
ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("freeze_fdlibm_math", ROOT / "freeze-math.py")
freeze = importlib.util.module_from_spec(spec)
spec.loader.exec_module(freeze)


class MathematicalReferenceTests(unittest.TestCase):
    def test_all_frozen_inputs_sources_and_exact_certificates_recompute(self):
        expected = json.loads((ROOT / "math-evidence.json").read_bytes())
        self.assertEqual(expected, freeze.document())
        self.assertEqual(len(expected["cases"]), 178)

    def test_exact_exp_one_enclosure_and_binary64_answer(self):
        lower, upper = exp_interval(Fraction(1), 80)
        self.assertGreater(lower, Fraction("2.7182818284590452353602874713526624977572"))
        self.assertLess(upper, Fraction("2.7182818284590452353602874713526624977573"))
        self.assertEqual(P.nearest(lower), 0x4005bf0a8b145769)
        self.assertEqual(P.nearest(upper), 0x4005bf0a8b145769)
        self.assertEqual(exp_interval(Fraction(0), 80), (Fraction(1), Fraction(1)))
        a, b = exp_interval(Fraction(-1), 80)
        self.assertEqual((a, b), (1 / upper, 1 / lower))

    def test_log_two_and_range_reduction_have_certified_enclosures(self):
        a, b, k = log_interval(Fraction(2), 80)
        self.assertEqual(k, 1)
        self.assertEqual(P.nearest(a), 0x3fe62e42fefa39ef)
        self.assertEqual(P.nearest(b), 0x3fe62e42fefa39ef)
        c, d, k = log_interval(Fraction(1, 2), 80)
        self.assertEqual((c, d, k), (-b, -a, -1))
        self.assertEqual(log_interval(Fraction(1), 80), (Fraction(0), Fraction(0), 0))

    def test_every_log_exp_interval_certifies_a_unique_word(self):
        evidence = json.loads((ROOT / "math-evidence.json").read_bytes())["cases"]
        count = 0
        for record in evidence:
            reference = record["reference"]
            proof = reference.get("proof")
            if not isinstance(proof, dict) or "lower" not in proof or "upper" not in proof or "method" not in proof:
                continue
            a, b = Fraction(proof["lower"]), Fraction(proof["upper"])
            self.assertLessEqual(a, b)
            self.assertEqual(P.hexword(P.nearest(a)), reference["bits"])
            self.assertEqual(P.hexword(P.nearest(b)), reference["bits"])
            count += 1
        self.assertEqual(count, 24)

    def test_accuracy_oracle_limits_are_explicit_and_distinct_from_candidate_domain(self):
        with self.assertRaises(ValueError):
            exp_interval(Fraction(2), 80)
        with self.assertRaises(ValueError):
            answer({"op": "log", "x": "0000000000000000"})
        self.assertEqual(answer({"op": "pow", "x": "4000000000000000", "y": "3ff199999999999a"}),
                         {"status": "outside_oracle_scope"})
        # Exact scaling final values at signed32 extremes need no giant shift.
        self.assertEqual(answer({"op": "scalbn", "x": "bff0000000000000", "n": -2147483648})["bits"], "8000000000000000")
        self.assertEqual(answer({"op": "scalbn", "x": "3ff0000000000000", "n": 2147483647})["bits"], "7ff0000000000000")


if __name__ == "__main__":
    unittest.main()
