// LSE-01…LSE-09 — the RFC 0055 commercial lease clause checks.
//
// RFC 0054 placed lease clauses on the lease record because they are attributes
// of a lease, not of a period. These rules check stated terms: nothing escalates
// a rent, exercises a break, applies a remedy or amortizes a balance.

import { describe, expect, it } from 'vitest';
import { validateUWFile } from './validator.js';
import { parseUWFile } from './parser.js';

const TERM = {
  tenant_id: 'T1',
  tenant_name: 'Anchor Co',
  lease_commencement: '2026-01-01',
  lease_expiration: '2031-12-31',
  escalation_type: 'fixed_pct',
};

const STEPS = [
  { effective_date: '2027-01-01', base_rent_annual: 103000 },
  { effective_date: '2028-01-01', base_rent_annual: 106090 },
  { effective_date: '2029-01-01', base_rent_annual: 109273 },
];

function doc(...tenants: Record<string, unknown>[]): string {
  return `---
uw_version: "1.1"
deal_id: TEST-LSE
asset_class: office
---

\`\`\`json uw:section=rent_roll variant=base source=manual ts=2026-09-15T00:00:00Z v=1
${JSON.stringify({ rent_roll_type: 'commercial', tenants }, null, 2)}
\`\`\`
`;
}

const codes = (...tenants: Record<string, unknown>[]): string[] =>
  validateUWFile(parseUWFile(doc(...tenants))).issues
    .filter(i => i.code.startsWith('LSE-')).map(i => i.code);

const tenant = (over: Record<string, unknown> = {}) => ({ ...TERM, ...over });

describe('RFC 0055 lease clauses — the quiet path', () => {
  it('accepts a tenant stating every clause', () => {
    expect(codes(tenant({
      escalation_schedule: STEPS,
      termination_option: {
        earliest_date: '2029-06-30', notice_months: 9, penalty: 250000,
        penalty_includes: ['unamortized_ti', 'unamortized_lc', 'fee'],
      },
      co_tenancy_clause: true,
      co_tenancy_details: {
        trigger: 'both', named_cotenants: ['Anchor Co'], occupancy_threshold: 0.7,
        remedy: 'rent_reduction', remedy_value: 0.5, cure_period_months: 12,
      },
      ti_allowance_original: 500000, ti_outstanding_balance: 300000,
      lc_original: 120000, lc_outstanding_balance: 80000,
    }))).toEqual([]);
  });

  it('leaves a tenant stating none of the new members untouched', () => {
    expect(codes(tenant())).toEqual([]);
  });

  it('leaves a multifamily rent roll alone', () => {
    const source = `---
uw_version: "1.1"
deal_id: TEST-LSE-MF
asset_class: multifamily
---

\`\`\`json uw:section=rent_roll variant=base source=manual ts=2026-09-15T00:00:00Z v=1
{ "rent_roll_type": "multifamily", "units": [ { "unit_id": "101", "monthly_rent": 1500 } ] }
\`\`\`
`;
    expect(validateUWFile(parseUWFile(source)).issues.filter(i => i.code.startsWith('LSE-'))).toEqual([]);
  });

  it('checks every tenant, not just the first', () => {
    expect(codes(tenant(), tenant({ ti_allowance_original: 100, ti_outstanding_balance: 200 })))
      .toEqual(['LSE-09']);
  });
});

describe('RFC 0055 escalation schedule', () => {
  it.each([
    ['out of order', [STEPS[1], STEPS[0]]],
    ['a duplicated date', [STEPS[0], STEPS[0]]],
  ])('LSE-01 refuses steps %s', (_n, escalation_schedule) => {
    expect(codes(tenant({ escalation_schedule }))).toContain('LSE-01');
  });

  it.each([
    ['a negative rent', [{ effective_date: '2027-01-01', base_rent_annual: -1 }]],
    ['a non-numeric rent', [{ effective_date: '2027-01-01', base_rent_annual: 'lots' }]],
    ['an impossible date', [{ effective_date: '2027-02-30', base_rent_annual: 1 }]],
    ['a missing date', [{ base_rent_annual: 1 }]],
    ['an empty array', []],
  ])('LSE-01 refuses %s', (_n, escalation_schedule) => {
    expect(codes(tenant({ escalation_schedule }))).toContain('LSE-01');
  });

  it.each([
    ['before commencement', '2025-01-01'],
    ['after expiration', '2032-01-01'],
  ])('LSE-02 refuses a step %s', (_n, effective_date) => {
    expect(codes(tenant({ escalation_schedule: [{ effective_date, base_rent_annual: 1 }] })))
      .toContain('LSE-02');
  });

  it('LSE-02 stays quiet when the term is not stated', () => {
    expect(codes({ tenant_id: 'T1', escalation_type: 'fixed_pct', escalation_schedule: STEPS }))
      .toEqual([]);
  });

  it('LSE-03 refuses a schedule on a lease that escalates by none', () => {
    expect(codes(tenant({ escalation_type: 'none', escalation_schedule: STEPS }))).toContain('LSE-03');
  });

  it('LSE-03 refuses a schedule with no escalation_type at all', () => {
    const t = tenant({ escalation_schedule: STEPS });
    delete (t as Record<string, unknown>)['escalation_type'];
    expect(codes(t)).toContain('LSE-03');
  });

  it('a first step after commencement is fine — one bump is one step', () => {
    expect(codes(tenant({ escalation_schedule: [STEPS[1]] }))).toEqual([]);
  });
});

describe('RFC 0055 termination option', () => {
  const opt = (over: Record<string, unknown> = {}) => ({
    earliest_date: '2029-06-30', notice_months: 9, penalty: 250000, ...over,
  });

  it('accepts a null penalty as genuinely none', () => {
    expect(codes(tenant({ termination_option: opt({ penalty: null }) }))).toEqual([]);
  });

  it.each([
    ['a break after expiration', { earliest_date: '2032-01-01' }],
    ['a break before commencement', { earliest_date: '2025-01-01' }],
    ['an impossible date', { earliest_date: '2029-02-30' }],
    ['a fractional notice period', { notice_months: 6.5 }],
    ['a negative notice period', { notice_months: -1 }],
    ['a negative penalty', { penalty: -5 }],
  ])('LSE-04 refuses %s', (_n, over) => {
    expect(codes(tenant({ termination_option: opt(over) }))).toContain('LSE-04');
  });

  it.each([
    ['an unknown component', ['moving_costs']],
    ['a duplicated component', ['fee', 'fee']],
    ['an empty list', []],
  ])('LSE-05 refuses %s', (_n, penalty_includes) => {
    expect(codes(tenant({ termination_option: opt({ penalty_includes }) }))).toContain('LSE-05');
  });

  it('LSE-05 accepts every component once', () => {
    expect(codes(tenant({
      termination_option: opt({ penalty_includes: ['unamortized_ti', 'unamortized_lc', 'free_rent', 'fee'] }),
    }))).toEqual([]);
  });
});

describe('RFC 0055 co-tenancy', () => {
  const details = (over: Record<string, unknown> = {}) => ({
    trigger: 'occupancy_threshold', occupancy_threshold: 0.7,
    remedy: 'termination_right', ...over,
  });

  it('LSE-06 refuses details without the boolean', () => {
    expect(codes(tenant({ co_tenancy_details: details() }))).toContain('LSE-06');
  });

  it('LSE-06 refuses the boolean without details', () => {
    expect(codes(tenant({ co_tenancy_clause: true }))).toContain('LSE-06');
  });

  it('LSE-06 is silent when neither is stated', () => {
    expect(codes(tenant({ co_tenancy_clause: false }))).toEqual([]);
  });

  it.each([
    ['a named trigger with no names', { trigger: 'named_tenant_departure' }],
    ['a named trigger with an empty list', { trigger: 'named_tenant_departure', named_cotenants: [] }],
    ['a threshold trigger with no threshold', { trigger: 'occupancy_threshold', occupancy_threshold: undefined }],
    ['a threshold at 0', { occupancy_threshold: 0 }],
    ['a threshold at 1', { occupancy_threshold: 1 }],
    ['a threshold above 1 — a percent, not a fraction', { occupancy_threshold: 70 }],
    ['both, missing the names', { trigger: 'both', occupancy_threshold: 0.7 }],
    ['an unknown trigger', { trigger: 'anchor_goes_dark' }],
    ['a fractional cure period', { cure_period_months: 1.5 }],
  ])('LSE-07 refuses %s', (_n, over) => {
    expect(codes(tenant({ co_tenancy_clause: true, co_tenancy_details: details(over) })))
      .toContain('LSE-07');
  });

  it.each([
    ['a termination_right carrying a value', { remedy: 'termination_right', remedy_value: 0.5 }],
    ['a rent_reduction with no value', { remedy: 'rent_reduction' }],
    ['a reduction above 1', { remedy: 'rent_reduction', remedy_value: 1.5 }],
    ['a reduction at 0', { remedy: 'rent_reduction', remedy_value: 0 }],
    ['an alternate_rent with no value', { remedy: 'alternate_rent' }],
    ['a negative alternate_rent', { remedy: 'alternate_rent', remedy_value: -1 }],
    ['an unknown remedy', { remedy: 'free_parking' }],
  ])('LSE-08 refuses %s', (_n, over) => {
    expect(codes(tenant({ co_tenancy_clause: true, co_tenancy_details: details(over) })))
      .toContain('LSE-08');
  });

  it('LSE-08 accepts a full reduction at exactly 1', () => {
    expect(codes(tenant({
      co_tenancy_clause: true,
      co_tenancy_details: details({ remedy: 'rent_reduction', remedy_value: 1 }),
    }))).toEqual([]);
  });

  it('LSE-08 accepts a zero alternate rent — free occupancy is a real remedy', () => {
    expect(codes(tenant({
      co_tenancy_clause: true,
      co_tenancy_details: details({ remedy: 'alternate_rent', remedy_value: 0 }),
    }))).toEqual([]);
  });
});

describe('RFC 0055 leasing capital', () => {
  it.each([
    ['TI', { ti_allowance_original: 100, ti_outstanding_balance: 200 }],
    ['LC', { lc_original: 100, lc_outstanding_balance: 200 }],
  ])('LSE-09 refuses an outstanding %s balance above its original', (_n, over) => {
    expect(codes(tenant(over))).toContain('LSE-09');
  });

  it.each([
    ['a negative original', { lc_original: -1 }],
    ['a negative balance', { ti_outstanding_balance: -1 }],
    ['a non-numeric amount', { lc_original: 'a lot' }],
  ])('LSE-09 refuses %s', (_n, over) => {
    expect(codes(tenant(over))).toContain('LSE-09');
  });

  it('accepts a fully amortized balance at zero', () => {
    expect(codes(tenant({ ti_allowance_original: 500000, ti_outstanding_balance: 0 }))).toEqual([]);
  });

  it('accepts an original with no balance stated yet', () => {
    expect(codes(tenant({ lc_original: 120000 }))).toEqual([]);
  });
});
