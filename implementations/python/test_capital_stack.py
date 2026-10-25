"""Independent known-answer controls for the accepted stabilized stack procedure."""
import copy
import unittest
from uwmd_capital_stack import annual_service,verify_capital_stack,sizing_value

class CapitalStackTests(unittest.TestCase):
    def test_zero_rate_amortization_and_io_is_not_a_schedule(self):
        tranche=dict(id='senior',class_='senior_debt',position=1,amount=1200,rate=0,amortization_months=12,io_months=6)
        tranche['class']=tranche.pop('class_')
        self.assertEqual(annual_service(tranche),1200)
        tranche['io_months']=120
        self.assertEqual(annual_service(tranche),1200)
        tranche['amortization_months']=0
        self.assertEqual(annual_service(tranche),0)
    def test_branch_order_and_split_full_rate(self):
        accrued={'class':'senior_debt','amount':100,'accrual':'accrued'}
        split={'class':'preferred_equity','amount':100,'rate':.1,'cash_rate':.04,'accrual':'split'}
        self.assertEqual(annual_service(accrued),0)
        self.assertEqual(annual_service(split),4)
        self.assertEqual(sizing_value({'tranches':[split]},dict(fn='weighted_cost',over='*'),{}),.1)
        self.assertIsNone(sizing_value({'tranches':[split]},dict(fn='weighted_cost',over='senior'),{}))
    def test_failure_priority_and_missing_are_not_zero(self):
        stack=dict(tranches=[{'id':'a','class':'senior_debt','position':1,'amount':100,'rate':.1}],sizing=[
            dict(id='coverage',fn='coverage',over='a',value=3),dict(id='value',fn='ltv_through',through=1,value=.5)])
        before=copy.deepcopy(stack)
        report=verify_capital_stack(stack,dict(noi=20,total_value=None))
        self.assertEqual(report['verdict'],'failed')
        self.assertEqual([s['recomputed'] for s in report['sizing']],[2,None])
        self.assertEqual(stack,before)
    def test_original_order_binary64_sum(self):
        rows=[{'class':'senior_debt','position':i+1,'amount':a,'rate':1} for i,a in enumerate([1e16,-1e16,1])]
        self.assertEqual(sizing_value({'tranches':rows},dict(fn='blended_coverage',through=3),dict(noi=2)),2)
