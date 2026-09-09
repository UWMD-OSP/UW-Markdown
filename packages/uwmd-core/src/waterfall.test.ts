// Distribution waterfall arithmetic + three-state verification (RFC 0035 +
// RFC 0036, §4.27 / protocol §VIII.10). Structure is validation
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
  // ── IRR hurdles (RFC 0036): the closed-form hurdle balance ──────────────
  //
  // B = −xnpv(F, h) × (1 + h)^t_row. Single-shot, all-LP, one exact year:
  // F = {(0, −1,000,000)} after ROC pays the capital back at t = 1 the LP's
  // flows are −1,000,000 @0 and +1,000,000 @1, so
  //   xnpv(F, 0.12) = −1,000,000 + 1,000,000 / 1.12 = −107,142.857…
  //   B = 107,142.857… × 1.12 = 120,000 exactly.
  // The 80/20 tier's capacity is 120,000 / 0.8 = 150,000 (LP 120,000 /
  // GP 30,000) — the LP lands at 12% by construction, no solver involved.
  const IRR_LADDER: DistributionWaterfall = {
    cash_flow_ref: { variant: 'base' },
    equity_split: { lp: 1.0, gp: 0.0 },
    tiers: [
      { type: 'return_of_capital' },
      { type: 'split', lp_share: 0.8, gp_share: 0.2, until_lp_irr: 0.12 },
      { type: 'split', lp_share: 0.6, gp_share: 0.4 },
    ],
  };
  it('an IRR-hurdled split pays the hand-worked hurdle balance (B = 120,000 at h = 0.12, t = 1)', () => {
    const series: CashFlowSeries = {
      series: [
        { date: '2026-01-01', amount: -1_000_000 },
        { date: '2027-01-01', amount: 2_500_000 },
      ],
    };
    const a = computeWaterfall(IRR_LADDER, series)!;
    const row = a.schedule[0]!;
    // Evaluated in binary64, quantized at the reporting boundary (§VIII.5):
    // the balance lands at 120,000 to the cent, not bit-exactly.
    const cents = (c: { tier: number; lp: number; gp: number }) =>
      ({ tier: c.tier, lp: Math.round(c.lp * 100) / 100, gp: Math.round(c.gp * 100) / 100 });
    expect(cents(row.by_tier.find((c) => c.tier === 1)!)).toEqual({ tier: 1, lp: 120_000, gp: 30_000 });
    // The residual 1,350,000 goes 60/40.
    expect(cents(row.by_tier.find((c) => c.tier === 2)!)).toEqual({ tier: 2, lp: 810_000, gp: 540_000 });
    expect(Math.round(a.lp.distributions * 100) / 100).toBe(1_930_000);
    expect(Math.round(a.gp.distributions * 100) / 100).toBe(570_000);
  });
  it('a filled IRR boundary lands the LP xirr on the hurdle to 6 dp (boundary vs §VIII.9.3 agreement)', () => {
    // Exactly enough cash to fill the hurdled tier and nothing more.
    const series: CashFlowSeries = {
      series: [
        { date: '2026-01-01', amount: -1_000_000 },
        { date: '2027-01-01', amount: 1_150_000 },
      ],
    };
    const a = computeWaterfall(IRR_LADDER, series)!;
    expect(a.schedule[0]!.by_tier.map((c) =>
      ({ tier: c.tier, lp: Math.round(c.lp * 100) / 100, gp: Math.round(c.gp * 100) / 100 }))).toEqual([
      { tier: 0, lp: 1_000_000, gp: 0 },
      { tier: 1, lp: 120_000, gp: 30_000 },
    ]);
    // Asserted with toBe on the quantized value, not toBeCloseTo: the
    // boundary is closed-form and the solved xirr must agree at the quantum.
    expect(Math.round(a.lp.xirr! * 1e6) / 1e6).toBe(0.12);
  });
  it('an already-met IRR hurdle has capacity zero — the tier pays nothing and never appears', () => {
    // A 20% simple pref over one year puts the LP at 1,200,000 on 1,000,000
    // before the 12%-hurdled tier is reached: B = −(−1,000,000 +
    // 1,200,000 / 1.12) × 1.12 = −80,000 ≤ 0 → capacity 0.
    const wf: DistributionWaterfall = {
      cash_flow_ref: { variant: 'base' },
      equity_split: { lp: 1.0, gp: 0.0 },
      tiers: [
        { type: 'return_of_capital' },
        { type: 'preferred_return', rate: 0.2, accrual: 'simple' },
        { type: 'split', lp_share: 0.8, gp_share: 0.2, until_lp_irr: 0.12 },
        { type: 'split', lp_share: 0.6, gp_share: 0.4 },
      ],
    };
    const series: CashFlowSeries = {
      series: [
        { date: '2026-01-01', amount: -1_000_000 },
        { date: '2027-01-01', amount: 1_500_000 },
      ],
    };
    const a = computeWaterfall(wf, series)!;
    expect(a.schedule[0]!.by_tier.map((c) => c.tier)).toEqual([0, 1, 3]);
    expect(a.schedule[0]!.by_tier.find((c) => c.tier === 3)).toEqual({ tier: 3, lp: 180_000, gp: 120_000 });
  });
  it('combined hurdles: the tier ends only when both are met — the larger capacity governs', () => {
    const wf: DistributionWaterfall = {
      cash_flow_ref: { variant: 'base' },
      equity_split: { lp: 1.0, gp: 0.0 },
      tiers: [
        { type: 'return_of_capital' },
        { type: 'split', lp_share: 0.8, gp_share: 0.2, until_lp_em: 1.5, until_lp_irr: 0.12 },
        { type: 'split', lp_share: 0.6, gp_share: 0.4 },
      ],
    };
    // One year: EM headroom 500,000 (cap 625,000) beats the IRR balance
    // 120,000 (cap 150,000) — the multiple binds.
    const oneYear = computeWaterfall(wf, {
      series: [{ date: '2026-01-01', amount: -1_000_000 }, { date: '2027-01-01', amount: 3_000_000 }],
    })!;
    expect(oneYear.schedule[0]!.by_tier.find((c) => c.tier === 1)).toEqual({ tier: 1, lp: 500_000, gp: 125_000 });
    // Five exact years under 30/360 (t = 5): IRR balance 1,000,000 × 1.12^5
    // − 1,000,000 = 762,341.68 beats the 500,000 EM headroom — the IRR binds.
    const fiveYears = computeWaterfall(wf, {
      day_count: '30/360us',
      series: [{ date: '2026-01-01', amount: -1_000_000 }, { date: '2031-01-01', amount: 3_000_000 }],
    })!;
    const lpPay = fiveYears.schedule[0]!.by_tier.find((c) => c.tier === 1)!.lp;
    expect(Math.round(lpPay * 100) / 100).toBe(Math.round((1_000_000 * 1.12 ** 5 - 1_000_000) * 100) / 100);
    expect(lpPay).toBeGreaterThan(500_000);
  });
  it('the hurdle balance credits earlier tiers of the same row and earlier rows (interleaved capital call)', () => {
    const series: CashFlowSeries = {
      series: [
        { date: '2026-01-01', amount: -1_000_000 },
        { date: '2027-01-01', amount: 300_000 },
        { date: '2027-07-02', amount: -200_000 },
        { date: '2029-01-01', amount: 1_500_000 },
      ],
    };
    const a = computeWaterfall(IRR_LADDER, series)!;
    // Recompute B independently from the LP's flows before tier 1 pays at
    // the last row: contributions at t=0 and t=547/365, ROC receipts at
    // t=1 and t=1096/365 (the second ROC returns the 700,000 + 200,000
    // still unreturned).
    const h = 0.12;
    const flows = [
      { t: 0, amount: -1_000_000 },
      { t: 1, amount: 300_000 },
      { t: 547 / 365, amount: -200_000 },
      { t: 1096 / 365, amount: 900_000 },
    ];
    const xnpv = flows.reduce((acc, f) => acc + f.amount * (1 + h) ** -f.t, 0);
    const B = -xnpv * (1 + h) ** (1096 / 365);
    const last = a.schedule[a.schedule.length - 1]!;
    const lpPay = last.by_tier.find((c) => c.tier === 1)!.lp;
    expect(Math.round(lpPay * 100) / 100).toBe(Math.round(B * 100) / 100);
    expect(a.lp.contributions).toBe(1_200_000);
  });
  it('cash is conserved through an IRR-hurdled ladder (Σ tier payments = row amount)', () => {
    const wf: DistributionWaterfall = {
      cash_flow_ref: { variant: 'base' },
      equity_split: { lp: 0.9, gp: 0.1 },
      tiers: [
        { type: 'return_of_capital' },
        { type: 'preferred_return', rate: 0.08, accrual: 'compound_annual' },
        { type: 'catch_up', gp_share: 1.0, target_promote: 0.2 },
        { type: 'split', lp_share: 0.8, gp_share: 0.2, until_lp_irr: 0.10 },
        { type: 'split', lp_share: 0.7, gp_share: 0.3, until_lp_irr: 0.15 },
        { type: 'split', lp_share: 0.6, gp_share: 0.4 },
      ],
    };
    const series: CashFlowSeries = {
      series: [
        { date: '2026-01-01', amount: -1_000_000 },
        { date: '2027-01-01', amount: 100_000 },
        { date: '2028-01-01', amount: 100_000 },
        { date: '2029-01-01', amount: 100_000 },
        { date: '2030-01-01', amount: 2_000_000 },
      ],
    };
    const a = computeWaterfall(wf, series)!;
    for (const row of a.schedule) {
      const amount = series.series.find((r) => r.date === row.date)!.amount;
      const paid = row.by_tier.reduce((acc, c) => acc + c.lp + c.gp, 0);
      expect(Math.abs(paid - amount)).toBeLessThan(1e-6);
    }
    expect(a.lp.distributions + a.gp.distributions).toBeCloseTo(2_300_000, 6);
    expect(a.lp.xirr!).toBeGreaterThan(0.15);
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
