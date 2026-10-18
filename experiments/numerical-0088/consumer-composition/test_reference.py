"""Focused consumer identities and refusal/reporting controls, not old matrices."""
import copy,json,math,unittest
from pathlib import Path
from reference import rounded,annual_service,capital,waterfall,normal_value,normal,uniforms,recovery,prior,raw,yearfrac
INPUTS=json.loads((Path(__file__).resolve().parent/'inputs.json').read_bytes())
class ConsumerControls(unittest.TestCase):
    def test_scaled_half_away_and_signed_zero_are_not_decimal_quantizer(self):
        self.assertEqual(rounded(.125,2),.13);self.assertEqual(rounded(-.125,2),-.13)
        self.assertEqual(raw.to_bits(rounded(-.0001,2)),'8000000000000000')
        self.assertEqual(rounded(raw.from_bits('3fbfffffffffffff'),2),.12)
    def test_stabilized_annual_service_keeps_declared_branches_and_states(self):
        base=INPUTS['capital'][0]['stack']['tranches'][0]
        self.assertEqual(annual_service({**base,'rate':0},prior.Trace()),(base['amount']/360)*12)
        self.assertIsNone(annual_service({**base,'rate':None},prior.Trace()))
        self.assertEqual(annual_service({**base,'accrual':'accrued'},prior.Trace()),0)
        self.assertTrue(math.isinf(annual_service({**base,'rate':2**-53},prior.Trace())))
        outcomes={c['id']:capital(c)['verification']['verdict'] for c in INPUTS['capital']}
        self.assertEqual(outcomes['capital/accepted'],'verified');self.assertEqual(outcomes['capital/claim-disagrees'],'failed');self.assertEqual(outcomes['capital/missing-rate'],'failed');self.assertEqual(outcomes['capital/missing-noi-only'],'unverifiable')
    def test_waterfall_calendar_pairwise_and_closed_form_boundaries(self):
        a,b,c='2026-02-28','2026-03-31','2026-04-30';t=prior.Trace()
        self.assertNotEqual(yearfrac(b,c,'30/360us',t),yearfrac(a,c,'30/360us',t)-yearfrac(a,b,'30/360us',t))
        value=waterfall(INPUTS['waterfall'][0]);self.assertEqual(value['allocation']['profit_total'],2000000)
        self.assertEqual(value['allocation']['lp']['contributions'],900000);self.assertEqual(value['allocation']['gp']['contributions'],100000)
        self.assertEqual(value['verification']['verdict'],'verified')
        missing=waterfall(next(c for c in INPUTS['waterfall'] if c['series'] is None));self.assertEqual(missing['verification']['verdict'],'unverifiable')
    def test_normal_tail_and_central_symmetry_are_independent_of_host_log(self):
        self.assertEqual(normal_value(.5,prior.Trace()),0.)
        for p in (.015625,.125):self.assertEqual(raw.to_bits(-normal_value(p,prior.Trace())),raw.to_bits(normal_value(1-p,prior.Trace())))
        states=[normal(c)['result']['status'] for c in INPUTS['normal']];self.assertEqual(states.count('returned'),9);self.assertEqual(states.count('refused'),6)
    def test_seeded_normal_inputs_are_bounded_and_include_both_tail_sites(self):
        values=uniforms(INPUTS['stochastic']['seed'],INPUTS['stochastic']['samples']);self.assertEqual(len(values),64)
        self.assertTrue(all(0<=u<1 for u in values));self.assertTrue(any(u<.02425 for u in values));self.assertTrue(any(u>1-.02425 for u in values))
    def test_recovery_findings_keep_field_attribution_and_independent_order(self):
        results={c['id']:recovery(c) for c in INPUTS['recovery']}
        self.assertEqual(results['recovery/accepted']['issues'],[]);self.assertEqual(results['recovery/negative-trueup']['issues'],[])
        all_issues=results['recovery/multiple-errors']['issues'];self.assertEqual([x['code'] for x in all_issues],['REC-06','REC-07','REC-08'])
        self.assertEqual([x['field'].split('.')[-1] for x in all_issues],['tenant_share_uncapped','tenant_share_capped','true_up_amount'])
if __name__=='__main__':unittest.main()
