import { describe, it, expect } from 'vitest';
import { deriveDebt } from './debt.js';

function field(d: ReturnType<typeof deriveDebt>, path: string): number | undefined {
  return d.fields.find((f) => f.path === path)?.value;
}

describe('deriveDebt — amortizing', () => {
  it('foots monthly and annual debt service from the mortgage payment', () => {
    // $1,000,000 at 6.00% over 30 years: monthly pmt = 5,995.51 → $5,996 whole.
    const d = deriveDebt({ loan_amount: 1_000_000, interest_rate: 0.06, amortization_years: 30 });
    expect(d.interestOnly).toBe(false);
    expect(field(d, 'monthly_debt_service')).toBe(5996);
    // Annual is exactly 12 × the whole-dollar monthly payment.
    expect(field(d, 'annual_debt_service')).toBe(71952);
  });

  it('matches the calc-engine pmt convention (rate 0 → pv/n)', () => {
    const d = deriveDebt({ loan_amount: 360_000, interest_rate: 0, amortization_years: 30 });
    // n = 360 periods, rate 0 → 360000 / 360 = 1000/month.
    expect(field(d, 'monthly_debt_service')).toBe(1000);
    expect(field(d, 'annual_debt_service')).toBe(12000);
  });
});

describe('deriveDebt — interest-only', () => {
  it('foots debt service as loan × rate when amortization is interest_only', () => {
    // Riverside office bridge loan: $3,250,000 at 9.00% IO → $292,500/yr.
    const d = deriveDebt({
      loan_amount: 3_250_000,
      all_in_rate_at_close: 0.09,
      amortization: 'interest_only',
    });
    expect(d.interestOnly).toBe(true);
    expect(field(d, 'annual_debt_service')).toBe(292500);
    expect(field(d, 'monthly_debt_service')).toBe(24375);
  });

  it('treats a missing/zero amortization term as interest-only', () => {
    const d = deriveDebt({ loan_amount: 1_000_000, interest_rate: 0.05 });
    expect(d.interestOnly).toBe(true);
    expect(field(d, 'annual_debt_service')).toBe(50000);
  });
});

describe('deriveDebt — rate-key tolerance & empty', () => {
  it('reads the first present rate key', () => {
    const d = deriveDebt({ loan_amount: 1_000_000, note_rate_at_close: 0.05 });
    expect(field(d, 'annual_debt_service')).toBe(50000);
  });

  it('foots nothing without a loan amount or rate', () => {
    expect(deriveDebt({ loan_amount: 1_000_000 }).fields.find((f) => f.path === 'annual_debt_service')).toBeUndefined();
    expect(deriveDebt({ interest_rate: 0.05 }).fields).toHaveLength(0);
    expect(deriveDebt({}).fields).toHaveLength(0);
  });
});
