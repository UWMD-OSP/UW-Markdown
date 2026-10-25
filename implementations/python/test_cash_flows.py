"""Independent dated known-answer, failure-priority and source-preservation controls."""
import copy
import math
import unittest
from uwmd_cash_flows import verify_cash_flow_series,xnpv,xirr
from uwmd_calc_errors import CalcError

class CashFlowTests(unittest.TestCase):
    def test_known_zero_rate_same_day_and_ordinal_identity(self):
        rows=[dict(date='2024-01-01',amount=-100),dict(date='2024-01-01',amount=20),dict(date='2024-12-31',amount=88)]
        snapshot=copy.deepcopy(rows)
        self.assertEqual(xnpv(0,rows),8)
        self.assertEqual(xnpv(.1,rows),0)
        self.assertAlmostEqual(xirr(rows),.1,places=10)
        self.assertEqual(rows,snapshot)
    def test_both_day_counts_and_no_host_exponential(self):
        rows=[dict(date='2025-01-01',amount=-100),dict(date='2025-12-27',amount=110)]
        self.assertEqual(xnpv(.1,rows,'actual/360'),0)
        with self.assertRaises(CalcError): xnpv(-1,rows)
    def test_missing_and_procedure_refusal_remain_distinct(self):
        payload=dict(series=[dict(date='2026-01-01',amount=10)],stated_metrics=dict(moic=2,xirr=.1))
        result,checked=verify_cash_flow_series(payload)
        self.assertEqual(checked,['moic','xirr'])
        self.assertEqual(result['verdict'],'failed')
        self.assertEqual([i['severity'] for i in result['issues']],['indeterminate','failure'])
    def test_no_double_rounding_or_mutation(self):
        payload=dict(series=[dict(date='2026-01-01',amount=1.005)],stated_metrics=dict(total_net=1.01))
        snapshot=copy.deepcopy(payload)
        self.assertEqual(verify_cash_flow_series(payload)[0]['verdict'],'verified')
        self.assertEqual(payload,snapshot)
    def test_invalid_series_is_unverifiable(self):
        payload=dict(series=[dict(date='2026-02-30',amount=1)],stated_metrics=dict(total_net=1))
        self.assertEqual(verify_cash_flow_series(payload)[0]['verdict'],'unverifiable')
