import { readFileSync } from 'node:fs';
import type { ProFormaSelectors } from './pro-forma-types.js';
import { expect, it } from 'vitest';
import { PRO_FORMA_IDENTITIES, PRO_FORMA_FAMILIES, PRO_FORMA_REGISTRY } from './pro-forma-types.js';
it('freezes the exact fifteen governed entries without adding a land method', () => {
  expect(PRO_FORMA_REGISTRY).toBe('uwmd.pro-forma.l1.1');
  expect(PRO_FORMA_IDENTITIES).toEqual(['total_net','moic','xnpv','xirr','coverage','blended_coverage','debt_yield_through','ltc_through','ltv_through','weighted_cost','net_cash_flow','final_occupied_sf','final_occupancy_rate','ltv','declared_ledger_membership']);
  expect(PRO_FORMA_FAMILIES).toHaveLength(19);
});

it('pins RFC0128 public selector and money-currency wire admission', async () => {
  const { Ajv2020 } = await import('ajv/dist/2020.js');
  const schema = JSON.parse(readFileSync(new URL('../../../spec/schemas/pro-forma-claim.schema.json', import.meta.url), 'utf8'));
  const validate = new Ajv2020({ strict: false, allErrors: true }).compile(schema);
  const claim = (selectors: unknown, money = false, currency?: string) => ({
    profile: 'pro-forma', level: 'L1', convention_registry: PRO_FORMA_REGISTRY, rows: [],
    relationships: [{ identity: money ? 'total_net' : 'moic', procedure_version: '1',
      target: { section: 'dcf', variant: null, pointer: '/value' }, inputs: [],
      unit: money ? '$' : 'x', selectors, ...(currency === undefined ? {} : { currency }) }],
  });
  const publicSelectors: ProFormaSelectors = { over: '*', through: 1, period: 'Y1' };
  expect(validate(claim(publicSelectors))).toBe(true);
  // @ts-expect-error RFC0128 selects loans only through the loan input address.
  const unsupported: ProFormaSelectors = { loan: 'senior' };
  expect(validate(claim(unsupported))).toBe(false);
  expect(validate(claim({ loan: '["source",1,"debt_structure","senior"]' }))).toBe(false);
  expect(validate(claim({ through: '1' }))).toBe(false);
  expect(validate(claim({}, true))).toBe(false);
  expect(validate(claim({}, true, 'USD'))).toBe(true);
}, 30_000);
