"""Focused independently known date and complete financial-graph controls."""
import copy
import json
import unittest
from pathlib import Path
from python_graph import ordinal, fractions, evaluate, prior, raw
HERE=Path(__file__).resolve().parent
class Conventions(unittest.TestCase):
    def test_year_zero_and_century_calendar(self):
        self.assertEqual(ordinal((1,1,1))-ordinal((0,1,1)),366)
        self.assertEqual(ordinal((100,1,1))-ordinal((99,12,31)),1)
        self.assertEqual(ordinal((400,3,1))-ordinal((400,2,28)),2)
        self.assertEqual(ordinal((100,3,1))-ordinal((100,2,28)),1)
    def test_exact_clamp_and_no_february_special_case(self):
        for dates,expected in [(['2026-01-31','2026-03-31'],60),(['2026-02-28','2026-03-31'],33),(['2026-01-15','2026-01-31'],16)]:
            trace=prior.Trace(); values=fractions(dict(dates=dates,day_count='30/360us'),trace)
            self.assertEqual(values,[0.,expected/360])
    def test_three_conventions_and_same_date_preserve_rows(self):
        cases=json.loads((HERE/'inputs.json').read_bytes())['cases']
        self.assertEqual(len(cases),48)
        results={case['id']:evaluate(case) for case in cases}
        for convention in ['actual/365f','actual/360','30/360us']:
            c=results['leap_same/'+convention+'/xnpv']
            self.assertEqual(len([r for r in c['trace'] if r['kind']=='calendar']),4)
            self.assertEqual(c['trace'][2]['kind'],'calendar')
            self.assertEqual(c['result']['status'],'returned')
        self.assertNotEqual(results['irregular/actual/365f/xnpv']['result'],results['irregular/actual/360/xnpv']['result'])
    def test_actual_refusal_boundaries_and_full_solver(self):
        cases=json.loads((HERE/'inputs.json').read_bytes())['cases']
        for case in cases:
            value=evaluate(case)
            if case['id'].startswith('public_refusal'):
                self.assertEqual(value['result']['status'],'refused')
                self.assertEqual(value['result']['code'],'CALC-TYPE-001' if case['op']=='xnpv' else 'CALC-XIRR-DIVERGE')
            if case['id'].startswith('irregular/') and case['op']=='xirr':
                self.assertEqual(value['result']['status'],'returned')
                self.assertTrue(any(row['kind']=='iteration' for row in value['trace']))
    def test_convention_refuses_unknown_without_default(self):
        with self.assertRaises(ValueError):fractions(dict(dates=['2026-01-01'],day_count='30/360'),prior.Trace())
if __name__=='__main__':unittest.main()
