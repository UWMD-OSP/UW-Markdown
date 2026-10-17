"""Bounded log/quotient proof and exact NPER domain controls, not new conventions."""
from fractions import Fraction
import json
import unittest
from pathlib import Path
from reference import P, M, Ideal, interval_divide, mathematical, ordered
HERE = Path(__file__).resolve().parent


class NperReferenceControls(unittest.TestCase):
    @classmethod
    def setUpClass(cls): cls.cases = json.loads((HERE / 'inputs.json').read_bytes())['cases']

    def test_known_period_inputs_satisfy_exact_algebraic_identity(self):
        for item in self.cases:
            if 'known_real_periods' not in item: continue
            r, payment, pv, fv = [P.rational(P.word(word)) for word in item['args']]
            n = item['known_real_periods']
            if r == 0: self.assertEqual((pv - fv) / payment, n)
            else: self.assertEqual((payment - fv * r) / (payment - pv * r), (1 + r) ** n)
            result = mathematical(item)
            self.assertEqual(result['raw']['bits'], P.hexword(P.nearest(Fraction(n))))

    def test_certified_whole_quotient_is_inside_one_rounding_cell(self):
        count = 0
        for item in self.cases:
            answer = mathematical(item)
            if answer['status'] != 'certified' or answer['proof']['method'] != 'exact-input-rational-log-interval-quotient': continue
            proof = answer['proof']
            unpack = lambda value: Fraction(int(value['numerator_hex'], 16), int(value['denominator_hex'], 16))
            lo, hi = map(unpack, proof['quotient_bounds'])
            self.assertLessEqual(lo, hi)
            self.assertEqual(P.nearest(lo), P.nearest(hi))
            self.assertEqual(P.hexword(P.nearest(lo)), answer['raw']['bits'])
            count += 1
        self.assertEqual(count, 7)

    def test_interval_division_checks_all_signs_and_refuses_zero_denominator_interval(self):
        self.assertEqual(interval_divide((Fraction(-4), Fraction(-2)), (Fraction(-2), Fraction(-1))), (1, 4))
        self.assertEqual(interval_divide((Fraction(-2), Fraction(3)), (Fraction(1), Fraction(2))), (-2, 3))
        with self.assertRaises(AssertionError): interval_divide((Fraction(1), Fraction(2)), (Fraction(-1), Fraction(1)))

    def test_zero_and_denominator_guards_precede_log_execution(self):
        for name, reason in [('zero_payment', 'zero_payment'), ('denominator_zero', 'zero_denominator'), ('nonpositive_ratio', 'nonpositive_ratio')]:
            case = next(item for item in self.cases if item['id'] == name)
            graph = Ideal(); result = ordered(case, graph)
            self.assertEqual((result['status'], result['reason']), ('refused', reason))
            self.assertFalse(any(row.get('op') == 'log' for row in graph.trace))
            if name == 'denominator_zero': self.assertFalse(any(row.get('op') == 'divide' for row in graph.trace))

    def test_real_domain_is_separate_from_internal_ieee_and_public_final_refusal(self):
        case = next(item for item in self.cases if item['id'] == 'rate_minus_one')
        self.assertEqual(mathematical(case)['status'], 'undefined_real_log_base')
        graph = Ideal(); result = ordered(case, graph)
        self.assertEqual(result['raw']['bits'], '0000000000000000')
        calls = [row for row in graph.trace if row.get('op') == 'log']
        self.assertEqual(calls[1]['result']['bits'], 'fff0000000000000')
        self.assertEqual(len(self.cases), 14)


if __name__ == '__main__': unittest.main()
