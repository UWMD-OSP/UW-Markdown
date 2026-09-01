// verifyLeaseUpSchedule — the RFC 0008 state-and-verify trajectory.
//
// The schedule is stated data over a fixed, closed recompute vocabulary:
// per-period net_cash_flow from its components, and the stabilized summary
// against the final period. Three-state like verifyCapitalStack: disagree →
// failed, missing input → unverifiable, otherwise verified.

import { describe, expect, it } from 'vitest';
import {
  verifyLeaseUpSchedule,
  leaseUpContext,
  leaseUpPeriodOrdinal,
  LEASE_UP_STABILIZED_TOLERANCE,
} from './lease-up.js';
import type { LeaseUpSchedule } from './lease-up.js';
import { parseUWFile } from './parser.js';

const SCHEDULE: LeaseUpSchedule = {
  model_type: 'natural_turnover',
  period_granularity: 'quarterly',
  stabilization_target: '2027-Q4',
  schedule: [
    { period: '2026-Q3', occupied_sf: 31000, rent_revenue: 166375, concessions: -5400, ti_lc_capex: -42500, net_cash_flow: 118475 },
    { period: '2026-Q4', occupied_sf: 40500, rent_revenue: 184025, concessions: -8100, ti_lc_capex: -52500, net_cash_flow: 123425 },
  ],
  stabilized_summary: { occupied_sf: 40500, occupancy_rate: 0.9529, annualized_noi: 478000 },
};

const CTX = { total_sf: 42500 };

describe('verifyLeaseUpSchedule — verified', () => {
  it('verifies when every stated figure recomputes equal at its quantum', () => {
    const v = verifyLeaseUpSchedule(SCHEDULE, CTX);
    expect(v.issues).toEqual([]);
    expect(v.verdict).toBe('verified');
  });

  it('has nothing to verify on a schedule with no stated aggregates', () => {
    const bare: LeaseUpSchedule = {
      ...SCHEDULE,
      schedule: [{ period: '2026-Q3', occupied_sf: 31000 }],
      stabilized_summary: null,
    };
    expect(verifyLeaseUpSchedule(bare, { total_sf: null }).verdict).toBe('verified');
  });
});

describe('verifyLeaseUpSchedule — failed', () => {
  it('fails a period whose net_cash_flow is off by one cent post-quantization', () => {
    const bad: LeaseUpSchedule = {
      ...SCHEDULE,
      schedule: [
        { ...SCHEDULE.schedule[0]! },
        { ...SCHEDULE.schedule[1]!, net_cash_flow: 123425.01 },
      ],
    };
    const v = verifyLeaseUpSchedule(bad, CTX);
    expect(v.verdict).toBe('failed');
    expect(v.issues.map((i) => i.code)).toContain('LU-NCF-DISAGREES');
    expect(v.issues.find((i) => i.code === 'LU-NCF-DISAGREES')!.period).toBe('2026-Q4');
  });

  it('fails a summary occupied_sf that disagrees with the final period', () => {
    const bad: LeaseUpSchedule = {
      ...SCHEDULE,
      stabilized_summary: { ...SCHEDULE.stabilized_summary, occupied_sf: 39000, occupancy_rate: undefined },
    };
    const v = verifyLeaseUpSchedule(bad, CTX);
    expect(v.verdict).toBe('failed');
    expect(v.issues.map((i) => i.code)).toContain('LU-SUMMARY-DISAGREES');
  });

  it('fails an occupancy_rate that disagrees with sf ÷ denominator at 4 places', () => {
    const bad: LeaseUpSchedule = {
      ...SCHEDULE,
      stabilized_summary: { occupied_sf: 40500, occupancy_rate: 0.94 },
    };
    expect(verifyLeaseUpSchedule(bad, CTX).verdict).toBe('failed');
  });
});

describe('verifyLeaseUpSchedule — unverifiable', () => {
  it('is unverifiable (not failed) when a period omits a stated component', () => {
    const partial: LeaseUpSchedule = {
      ...SCHEDULE,
      schedule: [{ period: '2026-Q3', rent_revenue: 166375, net_cash_flow: 118475 }],
      stabilized_summary: null,
    };
    const v = verifyLeaseUpSchedule(partial, CTX);
    expect(v.verdict).toBe('unverifiable');
    expect(v.issues[0]!.code).toBe('LU-UNEVALUABLE');
  });

  it('is unverifiable when occupancy_rate has no square-foot denominator', () => {
    const v = verifyLeaseUpSchedule(SCHEDULE, { total_sf: null });
    expect(v.verdict).toBe('unverifiable');
    expect(v.issues.map((i) => i.code)).toContain('LU-UNEVALUABLE');
  });

  it('failure outranks indeterminate in the verdict', () => {
    const mixed: LeaseUpSchedule = {
      ...SCHEDULE,
      schedule: [
        { period: '2026-Q3', rent_revenue: 1, net_cash_flow: 5 }, // unverifiable row
        { ...SCHEDULE.schedule[1]!, net_cash_flow: 999999 },      // failing row
      ],
    };
    expect(verifyLeaseUpSchedule(mixed, CTX).verdict).toBe('failed');
  });
});

describe('leaseUpContext — the §XIII denominator', () => {
  const doc = (propertyJson: string, assetClass = 'office') => parseUWFile(`---
uw_version: "1.1"
deal_id: TEST-LU-CTX
asset_class: ${assetClass}
---

\`\`\`json uw:section=property source=manual ts=2026-09-01T00:00:00Z v=1
${propertyJson}
\`\`\`
`);

  it('resolves an office RSF through the registry', () => {
    expect(leaseUpContext(doc('{ "rentable_square_feet": 42500 }'))).toEqual({ total_sf: 42500 });
  });

  it('falls back to a multifamily secondary total_nra_sqft', () => {
    expect(leaseUpContext(doc('{ "total_units": 120, "total_nra_sqft": 98000 }', 'multifamily')))
      .toEqual({ total_sf: 98000 });
  });

  it('is null — never a guess — when no sqft basis is stated', () => {
    expect(leaseUpContext(doc('{ "keys": 150 }', 'hospitality'))).toEqual({ total_sf: null });
  });
});

describe('leaseUpPeriodOrdinal — the period grammar', () => {
  it('makes consecutive quarters differ by exactly one, across year ends', () => {
    expect(leaseUpPeriodOrdinal('2027-Q1', 'quarterly')! - leaseUpPeriodOrdinal('2026-Q4', 'quarterly')!).toBe(1);
  });

  it('makes consecutive months differ by exactly one, across year ends', () => {
    expect(leaseUpPeriodOrdinal('2027-01', 'monthly')! - leaseUpPeriodOrdinal('2026-12', 'monthly')!).toBe(1);
  });

  it('rejects the wrong grammar for the declared granularity', () => {
    expect(leaseUpPeriodOrdinal('2026-07', 'quarterly')).toBeNull();
    expect(leaseUpPeriodOrdinal('2026-Q3', 'monthly')).toBeNull();
    expect(leaseUpPeriodOrdinal('2026-13', 'monthly')).toBeNull();
    expect(leaseUpPeriodOrdinal('2026-Q5', 'quarterly')).toBeNull();
  });
});

describe('the named tolerance', () => {
  it('is 2%, exported for CC-15', () => {
    expect(LEASE_UP_STABILIZED_TOLERANCE).toBe(0.02);
  });
});
