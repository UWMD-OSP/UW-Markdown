"""Independent signed-component, endpoint and dimensional lease-up controls."""
import copy
import unittest
from uwmd_lease_up import verify_lease_up_schedule

class LeaseUpTests(unittest.TestCase):
    def test_signed_components_and_own_quantum(self):
        payload=dict(schedule=[dict(period='2026-01',rent_revenue=1.005,concessions=0,ti_lc_capex=0,net_cash_flow=1.01,occupied_sf=25)],
                     stabilized_summary=dict(occupied_sf=25,occupancy_rate=.25004))
        before=copy.deepcopy(payload)
        self.assertEqual(verify_lease_up_schedule(payload,dict(total_sf=100))['verdict'],'verified')
        self.assertEqual(payload,before)
    def test_summary_fallback_retains_independent_missing_endpoint(self):
        payload=dict(schedule=[dict(period='2026-01')],stabilized_summary=dict(occupied_sf=25,occupancy_rate=.25))
        report=verify_lease_up_schedule(payload,dict(total_sf=100))
        self.assertEqual(report['verdict'],'unverifiable')
        self.assertEqual(len(report['issues']),1)
    def test_unstated_is_not_asserted_and_missing_component_is_unavailable(self):
        self.assertEqual(verify_lease_up_schedule(dict(schedule=[dict(period='2026-01')]),{})['verdict'],'verified')
        self.assertEqual(verify_lease_up_schedule(dict(schedule=[dict(period='2026-01',net_cash_flow=0)]),{})['verdict'],'unverifiable')
