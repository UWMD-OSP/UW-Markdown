// Capital-stack verifier tests — per-tranche debt service, the closed sizing
// vocabulary, and the three-state verdict. RFC 0026 §4.24.

import { describe, expect, it } from 'vitest';
import {
  trancheAnnualDebtService,
  recomputeSizing,
  verifyCapitalStack,
  isDebtTranche,
  type Tranche,
  type CapitalStack,
  type CapitalStackContext,
} from './capital-stack.js';

const senior = (): Tranche => ({ id: 'senior', class: 'senior_debt', position: 1, amount: 20_000_000, rate: 0.05, io_months: 24, amortization_months: 0, accrual: 'cash' });
const mezz = (): Tranche => ({ id: 'mezz', class: 'mezzanine_debt', position: 2, amount: 5_000_000, rate: 0.1, amortization_months: 0, accrual: 'cash' });
const prefAccrued = (): Tranche => ({ id: 'pref', class: 'preferred_equity', position: 3, amount: 3_000_000, rate: 0.09, accrual: 'accrued' });
const common = (): Tranche => ({ id: 'common', class: 'common_equity', position: 4, amount: 2_000_000 });

// NOI 2,000,000; senior IO DS 1,000,000; mezz IO DS 500,000; pref accrued (0 cash).
const ctx: CapitalStackContext = { noi: 2_000_000, total_cost: 30_000_000, total_value: 32_000_000 };

function stack(sizing: CapitalStack['sizing']): CapitalStack {
  return { tranches: [senior(), mezz(), prefAccrued(), common()], sizing };
}

describe('trancheAnnualDebtService', () => {
  it('interest-only debt is amount × rate', () => {
    expect(trancheAnnualDebtService(senior())).toBe(1_000_000);
    expect(trancheAnnualDebtService(mezz())).toBe(500_000);
  });

  it('amortizing debt is the fully-amortizing annual constant', () => {
    const t: Tranche = { id: 'a', class: 'senior_debt', position: 1, amount: 10_000_000, rate: 0.06, amortization_months: 360 };
    // 10M at 6% over 360 months ≈ $719,460.6/yr
    expect(trancheAnnualDebtService(t)).toBeCloseTo(719_460.6, 0);
  });

  it('an accrued (PIK) tranche pays no cash service', () => {
    expect(trancheAnnualDebtService(prefAccrued())).toBe(0);
    const accruedDebt: Tranche = { ...mezz(), accrual: 'accrued' };
    expect(trancheAnnualDebtService(accruedDebt)).toBe(0);
  });

  it('a cash-pay preferred contributes its current return', () => {
    const cashPref: Tranche = { ...prefAccrued(), accrual: 'cash' };
    expect(trancheAnnualDebtService(cashPref)).toBe(270_000);
  });

  it('common equity has no debt service; a rate-less debt tranche is uncomputable', () => {
    expect(trancheAnnualDebtService(common())).toBe(0);
    const noRate: Tranche = { id: 'x', class: 'mezzanine_debt', position: 2, amount: 1_000_000 };
    expect(trancheAnnualDebtService(noRate)).toBeNull();
  });
});

describe('recomputeSizing', () => {
  const tranches = [senior(), mezz(), prefAccrued(), common()];

  it('coverage over a single tranche', () => {
    expect(recomputeSizing({ id: 's', fn: 'coverage', over: 'senior', value: 0 }, tranches, ctx)).toBe(2);
  });

  it('blended_coverage excludes the accrued pref (cash-pay only)', () => {
    // through 3 includes senior + mezz cash service only; accrued pref contributes 0.
    const r = recomputeSizing({ id: 'b', fn: 'blended_coverage', through: 3, value: 0 }, tranches, ctx);
    expect(r).toBeCloseTo(2_000_000 / 1_500_000, 9);
  });

  it('a cash-pay pref DOES enter blended_coverage', () => {
    const cashPref = [senior(), mezz(), { ...prefAccrued(), accrual: 'cash' as const }, common()];
    const r = recomputeSizing({ id: 'b', fn: 'blended_coverage', through: 3, value: 0 }, cashPref, ctx);
    expect(r).toBeCloseTo(2_000_000 / 1_770_000, 9);
  });

  it('debt_yield_through counts debt balance regardless of accrual', () => {
    expect(recomputeSizing({ id: 'd', fn: 'debt_yield_through', through: 2, value: 0 }, tranches, ctx)).toBe(0.08);
    expect(recomputeSizing({ id: 'd', fn: 'debt_yield_through', through: 1, value: 0 }, tranches, ctx)).toBe(0.1);
  });

  it('weighted_cost is amount-weighted over rate-bearing tranches (common excluded)', () => {
    const r = recomputeSizing({ id: 'w', fn: 'weighted_cost', over: '*', value: 0 }, tranches, ctx);
    expect(r).toBeCloseTo(1_770_000 / 28_000_000, 9);
  });

  it('ltc/ltv divide cumulative debt balance by cost/value', () => {
    expect(recomputeSizing({ id: 'c', fn: 'ltc_through', through: 2, value: 0 }, tranches, ctx)).toBeCloseTo(25 / 30, 9);
    expect(recomputeSizing({ id: 'v', fn: 'ltv_through', through: 2, value: 0 }, tranches, ctx)).toBeCloseTo(25 / 32, 9);
  });

  it('a figure needing an absent input recomputes to null, never zero', () => {
    const noNoi: CapitalStackContext = { noi: null };
    expect(recomputeSizing({ id: 's', fn: 'coverage', over: 'senior', value: 0 }, tranches, noNoi)).toBeNull();
    const noValue: CapitalStackContext = { noi: 2_000_000 };
    expect(recomputeSizing({ id: 'v', fn: 'ltv_through', through: 2, value: 0 }, tranches, noValue)).toBeNull();
  });

  it('isDebtTranche classifies pref and common as non-debt', () => {
    expect(isDebtTranche(senior())).toBe(true);
    expect(isDebtTranche(mezz())).toBe(true);
    expect(isDebtTranche(prefAccrued())).toBe(false);
    expect(isDebtTranche(common())).toBe(false);
  });
});

describe('verifyCapitalStack', () => {
  it('a stack of correctly-stated figures is verified', () => {
    const v = verifyCapitalStack(
      stack([
        { id: 'senior_dscr', fn: 'coverage', over: 'senior', value: 2.0 },
        { id: 'combined_dscr', fn: 'blended_coverage', through: 2, value: 1.33 },
        { id: 'mezz_debt_yield', fn: 'debt_yield_through', through: 2, value: 0.08 },
        { id: 'wacc', fn: 'weighted_cost', over: '*', value: 0.0632 },
        { id: 'ltc', fn: 'ltc_through', through: 2, value: 0.8333 },
      ]),
      ctx,
    );
    expect(v.verdict).toBe('verified');
    expect(v.issues).toHaveLength(0);
    expect(v.sizing.every((s) => s.agrees)).toBe(true);
  });

  it('a disagreeing figure fails with CS-SIZING-DISAGREES', () => {
    const v = verifyCapitalStack(
      stack([{ id: 'combined_dscr', fn: 'blended_coverage', through: 2, value: 1.85 }]),
      ctx,
    );
    expect(v.verdict).toBe('failed');
    expect(v.issues[0]!.code).toBe('CS-SIZING-DISAGREES');
    expect(v.sizing[0]!.agrees).toBe(false);
  });

  it('an unevaluable figure is unverifiable, not zero', () => {
    const v = verifyCapitalStack(
      stack([{ id: 'ltv', fn: 'ltv_through', through: 2, value: 0.78 }]),
      { noi: 2_000_000 }, // no total_value
    );
    expect(v.verdict).toBe('unverifiable');
    expect(v.issues[0]!.code).toBe('CS-SIZING-UNEVALUABLE');
    expect(v.sizing[0]!.recomputed).toBeNull();
  });

  it('a failure outranks an unevaluable figure in the verdict', () => {
    const v = verifyCapitalStack(
      stack([
        { id: 'ltv', fn: 'ltv_through', through: 2, value: 0.78 }, // unevaluable (no value)
        { id: 'senior_dscr', fn: 'coverage', over: 'senior', value: 9.9 }, // wrong
      ]),
      { noi: 2_000_000 },
    );
    expect(v.verdict).toBe('failed');
  });

  it('a stack with no sizing figures is trivially verified', () => {
    expect(verifyCapitalStack({ tranches: [senior(), mezz()] }, ctx).verdict).toBe('verified');
  });
});
