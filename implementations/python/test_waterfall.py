"""Nonportable waterfall conservation, identity and terminal-only clawback controls."""
import copy
import unittest
from uwmd_waterfall import allocate_waterfall,verify_waterfall

class WaterfallTests(unittest.TestCase):
    def sample(self):
        return dict(cash_flow_ref=dict(variant='base'),equity_split=dict(lp=.9,gp=.1),tiers=[dict(type='return_of_capital'),dict(type='preferred_return',rate=.08,accrual='simple'),dict(type='split',lp_share=.8,gp_share=.2)]),dict(day_count='actual/365f',series=[dict(date='2025-01-01',amount=-100),dict(date='2026-01-01',amount=150)])
    def test_conservation_snapshot_and_clawback_never_inserts_a_cash_row(self):
        waterfall,series=self.sample();before=copy.deepcopy((waterfall,series))
        ordinary=allocate_waterfall(waterfall,series)
        self.assertAlmostEqual(sum(c['lp']+c['gp'] for r in ordinary['schedule'] for c in r['by_tier']),sum(max(0,r['amount']) for r in series['series']))
        self.assertEqual((waterfall,series),before)
        waterfall['clawback']=dict(basis='lp_em_floor',floor_multiple=2,cap='promote_received')
        trueup=allocate_waterfall(waterfall,series)
        self.assertEqual(trueup['schedule'],ordinary['schedule'])
        self.assertIsNotNone(trueup['outcomes']['clawback_amount'])
    def test_same_day_rows_stay_distinct_and_stated_xirr_refusal_outranks_missing_moic(self):
        waterfall,series=self.sample();series['series'].insert(0,dict(date='2025-01-01',amount=0))
        series['series'].insert(2,dict(date='2025-01-01',amount=-50))
        allocated=allocate_waterfall(waterfall,series)
        self.assertEqual(len(allocated['schedule']),1)
        waterfall['equity_split']=dict(lp=1,gp=0)
        waterfall['tiers']=[dict(type='return_of_capital'),dict(type='split',lp_share=1,gp_share=0)]
        waterfall['stated_outcomes']=dict(gp=dict(xirr=.1,moic=1))
        report=verify_waterfall(waterfall,series)
        self.assertEqual(report['verdict'],'failed')
        self.assertEqual({i['code'] for i in report['issues']},{'WF-UNEVALUABLE','WF-PROCEDURE-REFUSES'})

    def test_invalid_terms_never_become_a_verified_allocation(self):
        waterfall,series=self.sample();waterfall['equity_split']['lp']=.99
        self.assertEqual(verify_waterfall(waterfall,series)['verdict'],'unverifiable')
        waterfall,series=self.sample();waterfall['tiers'][0]={'type':'unknown'}
        self.assertEqual(verify_waterfall(waterfall,series)['verdict'],'unverifiable')
