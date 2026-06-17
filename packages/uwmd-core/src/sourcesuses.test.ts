import { describe, it, expect } from 'vitest';
import { deriveSourcesUses } from './sourcesuses.js';

function field(d: ReturnType<typeof deriveSourcesUses>, path: string): number | undefined {
  return d.fields.find((f) => f.path === path)?.value;
}

describe('deriveSourcesUses — multifamily (nested closing costs, project-cost mirror)', () => {
  // Parkview shape: itemized closing_costs, total_project_cost mirror.
  const content = {
    total_project_cost: 0,
    sources: { senior_loan: 5_040_000, mezzanine_debt: null, equity_sponsor: 2_400_000, total: 0 },
    uses: {
      purchase_price: 7_200_000,
      closing_costs: {
        title_insurance: 28_000,
        transfer_taxes: 21_600,
        legal_fees: 15_000,
        due_diligence: 12_000,
        loan_origination_fee: 50_400,
        appraisal: 4_500,
        environmental: 2_800,
        survey: 2_500,
        inspection: 2_200,
        broker_commission: 0,
        other: 0,
        total: 0,
      },
      operating_reserves: 96_000,
      other_reserves: 5_000,
      total: 0,
    },
  };
  const d = deriveSourcesUses(content);

  it('foots the nested closing-costs total', () => {
    expect(field(d, 'uses.closing_costs.total')).toBe(139_000);
  });

  it('foots sources, uses, and the project-cost mirror to the same balanced figure', () => {
    expect(field(d, 'sources.total')).toBe(7_440_000);
    expect(field(d, 'uses.total')).toBe(7_440_000);
    expect(field(d, 'total_project_cost')).toBe(7_440_000);
    expect(d.balanced).toBe(true);
    expect(d.gap).toBe(0);
  });
});

describe('deriveSourcesUses — office (flat closing costs, top-level mirrors)', () => {
  const content = {
    sources: { loan_amount: 3_250_000, sponsor_equity: 2_150_000, total: 0 },
    uses: { purchase_price: 5_000_000, closing_costs: 150_000, interest_reserve: 250_000, total: 0 },
    total_sources: 0,
    total_uses: 0,
  };
  const d = deriveSourcesUses(content);

  it('foots flat buckets and the top-level mirrors', () => {
    expect(field(d, 'sources.total')).toBe(5_400_000);
    expect(field(d, 'uses.total')).toBe(5_400_000);
    expect(field(d, 'total_sources')).toBe(5_400_000);
    expect(field(d, 'total_uses')).toBe(5_400_000);
    expect(d.balanced).toBe(true);
  });

  it('does not foot a closing-costs sub-total when closing_costs is a scalar', () => {
    expect(field(d, 'uses.closing_costs.total')).toBeUndefined();
  });
});

describe('deriveSourcesUses — imbalance & empty', () => {
  it('reports the gap when sources do not equal uses', () => {
    const d = deriveSourcesUses({ sources: { loan: 100 }, uses: { cost: 150 } });
    expect(d.sourcesTotal).toBe(100);
    expect(d.usesTotal).toBe(150);
    expect(d.gap).toBe(-50);
    expect(d.balanced).toBe(false);
  });

  it('foots nothing for an empty block', () => {
    const d = deriveSourcesUses({});
    expect(d.fields).toHaveLength(0);
    expect(d.balanced).toBe(true);
  });
});
