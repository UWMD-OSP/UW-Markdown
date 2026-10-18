"""Focused composed-trajectory controls, not the workspace/corpus suite."""
import copy
import json
import unittest
from pathlib import Path
from python_graph import evaluate, reporting
from capture import normalized
HERE = Path(__file__).resolve().parent
INPUTS = json.loads((HERE / 'inputs.json').read_bytes())


class TrajectoryControls(unittest.TestCase):
    def test_full_bisection_sequence_and_both_stopping_reasons(self):
        for name, reason in [('irr_ordinary', 'value_tolerance'), ('irr_interval_tolerance', 'interval_tolerance')]:
            result = evaluate(next(c for c in INPUTS['cases'] if c['id'] == name))
            rows = result['trace']
            self.assertEqual([row['sequence'] for row in rows], list(range(len(rows))))
            iterations = [row for row in rows if row['kind'] == 'iteration']
            self.assertGreater(len(iterations), 1)
            self.assertLessEqual(len(iterations), 200)
            self.assertEqual([r['iteration'] for r in iterations], list(range(len(iterations))))
            self.assertEqual(rows[-1]['reason'], reason)
            self.assertEqual(len([r for r in rows if r['kind'] == 'update']), len(iterations) - 1)
            for iteration in iterations:
                residual = [r for r in rows if r['kind'] == 'evaluation_result' and r['evaluation'] == 'iteration/' + str(iteration['iteration'])]
                self.assertEqual(len(residual), 1)
                self.assertEqual(residual[0]['value'], iteration['fmid'])

    def test_short_circuit_does_not_fabricate_unevaluated_operations(self):
        result = evaluate(next(c for c in INPUTS['cases'] if c['id'] == 'irr_nonfinite_endpoint'))
        bracket = next(row for row in result['trace'] if row['kind'] == 'bracket')
        self.assertIsNone(bracket['product'])
        self.assertFalse(any(row['kind'] == 'operation' and row['context'] == 'bracket' for row in result['trace']))
        ordinary = evaluate(next(c for c in INPUTS['cases'] if c['id'] == 'irr_ordinary'))
        last = [row for row in ordinary['trace'] if row['kind'] == 'iteration'][-1]
        self.assertTrue(last['value_stop'])
        self.assertIsNone(last['half_interval'])

    def test_date_fraction_order_and_dated_multiply_graph(self):
        result = evaluate(next(c for c in INPUTS['cases'] if c['id'] == 'xnpv_leap_same_date'))
        days = [row['actual_days'] for row in result['trace'] if row['kind'] == 'calendar']
        self.assertEqual(days, [0, 1, 1, 367])
        operations = [r for r in result['trace'] if r['kind'] == 'operation' and r['context'].startswith('direct/row/')]
        self.assertEqual([r['op'] for r in operations], ['add', 'negate', 'pow', 'multiply', 'add'] * 4)
        self.assertEqual(operations[1]['result']['bits'], '8000000000000000')

    def test_decimal_shift_reporting_and_nonfinite_raw_are_distinct(self):
        self.assertEqual(reporting('3ff0147ae147ae14', 2)['token'], '1.01')
        self.assertEqual(reporting('bff0147ae147ae14', 2)['token'], '-1.01')
        self.assertEqual(reporting('8000000000000000', 6)['bits'], '0000000000000000')
        result = evaluate(next(c for c in INPUTS['cases'] if c['id'] == 'npv_nan_raw'))
        self.assertEqual(result['result']['status'], 'returned')
        self.assertEqual(result['result']['raw']['kind'], 'nan')
        self.assertEqual(result['result']['reporting']['status'], 'refused_nonfinite')

    def test_only_nan_word_bits_normalize_and_trace_mutants_remain_visible(self):
        self.assertEqual(normalized({'kind': 'nan', 'bits': 'fff8000000000000'}), {'kind': 'nan'})
        self.assertNotEqual(normalized({'kind': 'finite', 'bits': '8000000000000000'}), normalized({'kind': 'finite', 'bits': '0000000000000000'}))
        original = evaluate(next(c for c in INPUTS['cases'] if c['id'] == 'irr_ordinary'))
        changed = copy.deepcopy(original)
        row = next(r for r in changed['trace'] if r['kind'] == 'operation')
        row['result']['bits'] = '0000000000000000'
        self.assertNotEqual(normalized(original), normalized(changed))
        changed = copy.deepcopy(original)
        next(r for r in changed['trace'] if r['kind'] == 'iteration')['value_stop'] = True
        self.assertNotEqual(normalized(original), normalized(changed))


if __name__ == '__main__': unittest.main()
