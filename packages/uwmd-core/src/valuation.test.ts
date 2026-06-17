import { describe, it, expect } from 'vitest';
import { deriveValuation } from './valuation.js';

function field(d: ReturnType<typeof deriveValuation>, path: string): number | undefined {
  return d.fields.find((f) => f.path === path)?.value;
}

describe('deriveValuation — income approach', () => {
  it('foots indicated value as NOI / cap rate', () => {
    // Parkview: $396,635 NOI at a 5.51% cap → $7,198,457.
    const d = deriveValuation({
      purchase_price: 7_200_000,
      income_approach: { noi_used: 396_635, cap_rate_applied: 0.0551 },
    });
    expect(field(d, 'income_approach.indicated_value')).toBe(7_198_457);
  });

  it('foots the delta to purchase price as a fraction', () => {
    const d = deriveValuation({
      purchase_price: 7_200_000,
      income_approach: { noi_used: 396_635, cap_rate_applied: 0.0551 },
    });
    // 7,198,457 / 7,200,000 − 1 = −0.0002 (rounded to 4 places).
    expect(field(d, 'uw_value_vs_purchase_price_pct')).toBe(-0.0002);
  });

  it('omits the delta when there is no purchase price', () => {
    const d = deriveValuation({ income_approach: { noi_used: 500_000, cap_rate_applied: 0.05 } });
    expect(field(d, 'income_approach.indicated_value')).toBe(10_000_000);
    expect(field(d, 'uw_value_vs_purchase_price_pct')).toBeUndefined();
  });
});

describe('deriveValuation — out of scope / empty', () => {
  it('foots nothing without an income_approach block', () => {
    expect(deriveValuation({ purchase_price: 5_000_000, going_in_cap_rate: 0.06 }).fields).toHaveLength(0);
  });

  it('foots nothing with a missing or zero cap rate', () => {
    expect(deriveValuation({ income_approach: { noi_used: 500_000 } }).fields).toHaveLength(0);
    expect(deriveValuation({ income_approach: { noi_used: 500_000, cap_rate_applied: 0 } }).fields).toHaveLength(0);
  });
});
