"""Independent mathematical identities and boundary proof controls, not normative answers."""
from fractions import Fraction
import json
import unittest
from pathlib import Path
from reference import P, IdealGraph, domain, ordered, real_value, reference
HERE = Path(__file__).resolve().parent


class CancellationControls(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cases = json.loads((HERE / 'inputs.json').read_bytes())['cases']

    def test_one_period_formulas_reduce_exactly_before_rounding(self):
        for case in self.cases:
            if case['n'] != 1: continue
            r = P.rational(P.word(case['rate']))
            expected = 1 + r if case['op'] == 'pmt' else 1 / (1 + r) if case['op'] == 'pv' else Fraction(1)
            with self.subTest(id=case['id']): self.assertEqual(real_value(case), expected)

    def test_zero_rate_is_exact_separate_branch(self):
        for op in ('pmt', 'pv', 'fv'):
            case = {'op': op, 'rate': '8000000000000000', 'n': 360, 'amount': '3ff0000000000000', 'other': '0000000000000000', 'places': 12}
            self.assertEqual(real_value(case), Fraction(1, 360) if op == 'pmt' else Fraction(360))
            graph = IdealGraph()
            self.assertTrue(P.finite(ordered(case, graph)))
            self.assertFalse(any(row['op'] == 'pow' for row in graph.rows))

    def test_halfway_rate_neighbors_have_distinct_rounded_bases(self):
        for rate, expected in [('3c9fffffffffffff', P.ONE), ('3ca0000000000000', P.ONE), ('3ca0000000000001', P.ONE + 1),
                               ('bc8fffffffffffff', P.ONE), ('bc90000000000000', P.ONE), ('bc90000000000001', P.ONE - 1)]:
            self.assertEqual(P.nearest(1 + P.rational(P.word(rate))), expected)

    def test_ideal_power_cannot_restore_a_lost_rate(self):
        for op in ('pmt', 'pv', 'fv'):
            case = next(item for item in self.cases if item['id'] == op + '_positive_half_ulp_one_n1')
            result = reference(case)
            ideal = result['ideal_power_ordered_graph']
            self.assertNotEqual(ideal['raw'], result['whole_formula_rn'])
            if op == 'pmt': self.assertEqual(ideal['reporting']['status'], 'refused_nonfinite')
            else: self.assertEqual(ideal['raw']['bits'], '0000000000000000')
            self.assertTrue(P.finite(P.word(result['whole_formula_rn']['bits'])))

    def test_reference_budget_is_explicit_not_a_production_domain(self):
        case = dict(self.cases[0], n=361)
        with self.assertRaises(AssertionError): domain(case)
        case = dict(self.cases[0], n=True)
        with self.assertRaises(AssertionError): domain(case)
        self.assertEqual(len(self.cases), 36)


if __name__ == '__main__':
    unittest.main()
