import { expect, it } from 'vitest';
import { PRO_FORMA_IDENTITIES, PRO_FORMA_FAMILIES, PRO_FORMA_REGISTRY } from './pro-forma-types.js';
import { REFERENCE_IMPLEMENTATION_MANIFEST } from './protocol.js';
it('freezes the exact fifteen governed entries without adding a land method', () => {
  expect(PRO_FORMA_REGISTRY).toBe('uwmd.pro-forma.l1.1');
  expect(PRO_FORMA_IDENTITIES).toEqual(['total_net','moic','xnpv','xirr','coverage','blended_coverage','debt_yield_through','ltc_through','ltv_through','weighted_cost','net_cash_flow','final_occupied_sf','final_occupancy_rate','ltv','declared_ledger_membership']);
  expect(PRO_FORMA_FAMILIES).toHaveLength(19);
  expect(REFERENCE_IMPLEMENTATION_MANIFEST.profiles).not.toContain('pro-forma');
  expect(REFERENCE_IMPLEMENTATION_MANIFEST.capabilities).not.toContain('pro-forma-verify');
});
