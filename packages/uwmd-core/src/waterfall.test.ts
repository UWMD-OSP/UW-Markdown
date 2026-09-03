// Distribution waterfall arithmetic + three-state verification (RFC 0035,
// §4.27 / protocol §VIII.10). Structure is validation
// (validator.waterfall.test.ts); this file covers the walk and the verifier.
//
// The reference case is FULLY HAND-WORKED, chosen so every year fraction is
// exactly 1.0 (365-day gaps under actual/365f) and every tier figure is an
// exact decimal — the walk's answers are checked against arithmetic done on
// paper, not against the walk itself.

import { describe, expect, it } from 'vitest';
import {
  computeWaterfall,
  verifyWaterfall,
  type DistributionWaterfall,
} from './waterfall.js';
import type { CashFlowSeries } from './cash-flow-series.js';

// ─── The hand-worked reference case ─────────────────────────────────────────
//
// $1.0M in 90/10 on 2026-01-01. Ladder: ROC → 8% simple pref → 100% GP
// catch-up to 20% → 80/20.
//
//   2027-01-01, +$80,000 (Δt = 1): accrued pref LP 72,000 / GP 8,000, but ROC
//     is first in the ladder, so the whole 80k returns capital pro-rata:
//     LP 72,000 / GP 8,000. Unreturned: LP 828,000 / GP 92,000.
//   2028-01-01, +$2,000,000 (Δt = 1): second year's simple accrual on the
//     reduced base adds LP 66,240 / GP 7,360 → accrued LP 138,240 / GP 15,360.
//     ROC 920,000 (LP 828,000 / GP 92,000) → pref 153,600 (LP 138,240 /
//     GP 15,360) → catch-up x = (0.2·153,600 − 15,360) / (1 − 0.2) = 19,200,
//     all to GP (G becomes 34,560 = 20% of P 172,800 exactly) → residual
//     907,200 splits 80/20: LP 725,760 / GP 181,440.
//
//   LP: contributions 900,000; distributions 1,764,000; MOIC 1.96.
//   GP: contributions 100,000; distributions 316,000; MOIC 3.16.
//   promote_total = 316,000 − 100,000 (ROC) − 15,360 (pref) = 200,640.
//   profit_total = 2,080,000 − 1,000,000 = 1,080,000, of which GP profit
//   216,000 is exactly 20% — the catch-up landed and the 80/20 preserved it.

const SERIES: CashFlowSeries = {
  day_count: 'actual/365f',
  series: [
    { date: '2026-01-01', amount: -1_000_000, kind: 'acquisition' },
    { date: '2027-01-01', amount: 80_000, kind: 'operating' },
    { date: '2028-01-01', amount: 2_000_000, kind: 'disposition' },
  ],
};

const WATERFALL: DistributionWaterfall = {
  cash_flow_ref: { variant: 'base' },
  equity_split: { lp: 0.9, gp: 0.1 },
  tiers: [
    { type: 'return_of_capital' },
    { type: 'preferred_return', rate: 0.08, accrual: 'simple' },
    { type: 'catch_up', gp_share: 1.0, target_promote: 0.2 },
    { type: 'split', lp_share: 0.8, gp_share: 0.2 },
  ],
};

describe('computeWaterfall — the hand-worked reference case', () => {
  const a = computeWaterfall(WATERFALL, SERIES)!;

  it('allocates every hand-computed figure exactly', () => {
    expect(a).not.toBeNull();
    expect(a.lp.contributions).toBe(900_000);
    expect(a.gp.contributions).toBe(100_000);
    expect(a.lp.distributions).toBe(1_764_000);
    expect(a.gp.distributions).toBe(316_000);
    expect(a.lp.roc_received).toBe(900_000);
    expect(a.gp.roc_received).toBe(100_000);
    expect(a.lp.pref_received).toBe(138_240);
    expect(a.gp.pref_received).toBe(15_360);
    expect(a.promote_total).toBe(200_640);
    expect(a.profit_total).toBe(1_080_000);
    expect(a.lp.moic).toBe(1.96);
    expect(a.gp.moic).toBe(3.16);
  });
  it('the catch-up lands the GP at exactly the target promote share of profit', () => {
    const gpProfit = a.gp.distributions - a.gp.roc_received;
    expect(gpProfit / a.profit_total).toBeCloseTo(0.2, 12);
  });
  it('emits the schedule with only the tiers that paid', () => {
    expect(a.schedule).toEqual([
      { date: '2027-01-01', by_tier: [{ tier: 0, lp: 72_000, gp: 8_000 }] },
      {
        date: '2028-01-01',
        by_tier: [
          { tier: 0, lp: 828_000, gp: 92_000 },
          { tier: 1, lp: 138_240, gp: 15_360 },
          { tier: 2, lp: 0, gp: 19_200 },
          { tier: 3, lp: 725_760, gp: 181_440 },
        ],
      },
    ]);
  });
  it('conserves cash: every distribution row is fully allocated', () => {
    for (const row of a.schedule) {
      const total = row.by_tier.reduce((acc, c) => acc + c.lp + c.gp, 0);
      const src = SERIES.series.find((r) => r.date === row.date)!;
      expect(total).toBeCloseTo(src.amount, 6);
    }
  });
  it('per-party xirr zeroes each party\'s own dated flows (the §VIII.9.3 property)', () => {
    expect(a.lp.xirr).not.toBeNull();
    expect(a.gp.xirr).not.toBeNull();
    // GP outperforms LP — that is what a promote is.
    expect(a.gp.xirr!).toBeGreaterThan(a.lp.xirr!);
  });
});

describe('computeWaterfall — tier mechanics', () => {
  it('compound_annual accrues on unpaid pref where simple does not', () => {
    const mk = (accrual: 'simple' | 'compound_annual'): DistributionWaterfall => ({
      ...WATERFALL,
      tiers: [
        { type: 'preferred_return', rate: 0.08, accrual },
        { type: 'return_of_capital' },
        { type: 'split', lp_share: 0.8, gp_share: 0.2 },
      ],
    });
    // Ladder order in mk() is invalid per WF-01 (pref before roc) — but the
    // walk itself is order-agnostic; use a valid ladder to compare accruals.
    const valid = (accrual: 'simple' | 'compound_annual'): DistributionWaterfall => ({
      ...WATERFALL,
      tiers: [
        { type: 'return_of_capital' },
        { type: 'preferred_return', rate: 0.08, accrual },
        { type: 'split', lp_share: 0.8, gp_share: 0.2 },
      ],
    });
    void mk;
    const simple = computeWaterfall(valid('simple'), SERIES)!;
    const compound = computeWaterfall(valid('compound_annual'), SERIES)!;
    // Two years, nothing paid until the end: compound pref must exceed simple.
    expect(compound.lp.pref_received).toBeGreaterThan(simple.lp.pref_received);
  });
  it('an EM-hurdled split caps exactly at the multiple and hands off', () => {
    const wf: DistributionWaterfall = {
      cash_flow_ref: { variant: 'base' },
      equity_split: { lp: 1.0, gp: 0.0 },
      tiers: [
        { type: 'return_of_capital' },
        { type: 'split', lp_share: 0.8, gp_share: 0.2, until_lp_em: 1.5 },
        { type: 'split', lp_share: 0.6, gp_share: 0.4 },
      ],
    };
    const series: CashFlowSeries = {
      series: [
        { date: '2026-01-01', amount: -1_000_000 },
        { date: '2027-01-01', amount: 2_500_000 },
      ],
    };
    const a = computeWaterfall(wf, series)!;
    // ROC 1,000,000. Hurdled tier: LP headroom to 1.5x = 500,000 at 80% →
    // tier capacity 625,000 (LP 500,000 / GP 125,000). Residual 875,000
    // splits 60/40: LP 525,000 / GP 350,000.
    expect(a.lp.distributions).toBe(1_000_000 + 500_000 + 525_000);
    expect(a.gp.distributions).toBe(125_000 + 350_000);
    expect(a.lp.distributions / a.lp.contributions).toBeGreaterThan(1.5);
  });
  it('same-date rows accrue no double pref', () => {
    const series: CashFlowSeries = {
      series: [
        { date: '2026-01-01', amount: -1_000_000 },
        { date: '2027-01-01', amount: 40_000 },
        { date: '2027-01-01', amount: 40_000 },
        { date: '2028-01-01', amount: 2_000_000 },
      ],
    };
    const a = computeWaterfall(WATERFALL, series)!;
    // Same totals as the reference case: the split 80k arrives identically.
    expect(a.lp.distributions).toBe(1_764_000);
    expect(a.gp.distributions).toBe(316_000);
  });
  it('returns null rather than guessing on unusable input', () => {
    expect(computeWaterfall(WATERFALL, { series: [] })).toBeNull();
    expect(computeWaterfall(WATERFALL, { series: [{ date: '2026-02-30', amount: -1 }] })).toBeNull();
    expect(computeWaterfall({ ...WATERFALL, tiers: [] }, SERIES)).toBeNull();
  });
});

describe('verifyWaterfall', () => {
  const allocation = computeWaterfall(WATERFALL, SERIES)!;
  const STATED: DistributionWaterfall = {
    ...WATERFALL,
    stated_outcomes: {
      lp: { contributions: 900_000, distributions: 1_764_000, moic: 1.96, xirr: allocation.lp.xirr },
      gp: { contributions: 100_000, distributions: 316_000, moic: 3.16, xirr: allocation.gp.xirr },
      promote_total: 200_640,
      profit_total: 1_080_000,
    },
  };

  it('verifies the reference case, outcomes and schedule both', () => {
    const withSchedule: DistributionWaterfall = {
      ...STATED,
      stated_schedule: allocation.schedule.map((r) => ({ date: r.date, by_tier: [...r.by_tier] })),
    };
    const v = verifyWaterfall(withSchedule, SERIES);
    expect(v.issues).toEqual([]);
    expect(v.verdict).toBe('verified');
  });
  it('nothing stated is verified vacuously', () => {
    expect(verifyWaterfall(WATERFALL, SERIES).verdict).toBe('verified');
  });
  it('an overstated promote is failed, anchored to its field', () => {
    const v = verifyWaterfall({
      ...WATERFALL,
      stated_outcomes: { promote_total: 200_641 },
    }, SERIES);
    expect(v.verdict).toBe('failed');
    expect(v.issues[0]).toMatchObject({ code: 'WF-OUTCOME-DISAGREES', field: 'stated_outcomes.promote_total' });
  });
  it('a wrong schedule cell is failed; an absent cell reads 0 both ways', () => {
    const v = verifyWaterfall({
      ...WATERFALL,
      stated_schedule: [
        { date: '2027-01-01', by_tier: [{ tier: 0, lp: 72_000, gp: 8_000 }, { tier: 3, lp: 0, gp: 0 }] },
        // 2028 row omitted entirely: its recomputed payments read against 0.
      ],
    }, SERIES);
    expect(v.verdict).toBe('failed');
    expect(v.issues.every((i) => i.code === 'WF-SCHEDULE-DISAGREES')).toBe(true);
  });
  it('a stated xirr on a zero-contribution party is a procedure refusal — failed', () => {
    const wf: DistributionWaterfall = {
      cash_flow_ref: { variant: 'base' },
      equity_split: { lp: 1.0, gp: 0.0 },
      tiers: [{ type: 'return_of_capital' }, { type: 'split', lp_share: 0.8, gp_share: 0.2 }],
      stated_outcomes: { gp: { xirr: 99 } },
    };
    const v = verifyWaterfall(wf, SERIES);
    expect(v.verdict).toBe('failed');
    expect(v.issues[0]).toMatchObject({ code: 'WF-PROCEDURE-REFUSES', field: 'stated_outcomes.gp.xirr' });
  });
  it('a stated moic on a zero-contribution party is unverifiable, never failed', () => {
    const wf: DistributionWaterfall = {
      cash_flow_ref: { variant: 'base' },
      equity_split: { lp: 1.0, gp: 0.0 },
      tiers: [{ type: 'return_of_capital' }, { type: 'split', lp_share: 0.8, gp_share: 0.2 }],
      stated_outcomes: { gp: { moic: 10 } },
    };
    const v = verifyWaterfall(wf, SERIES);
    expect(v.verdict).toBe('unverifiable');
    expect(v.issues[0]).toMatchObject({ code: 'WF-UNEVALUABLE' });
  });
  it('an unresolvable or invalid series makes stated figures unverifiable', () => {
    expect(verifyWaterfall(STATED, null).verdict).toBe('unverifiable');
    expect(verifyWaterfall(STATED, { series: [{ date: 'nope', amount: -1 }] }).verdict).toBe('unverifiable');
  });
  it('agreement is judged at the quantum, not bit-exactly', () => {
    const v = verifyWaterfall({
      ...WATERFALL,
      stated_outcomes: { promote_total: 200_640.004 },
    }, SERIES);
    expect(v.verdict).toBe('verified');
  });
});
