// Cash-flow series arithmetic + three-state verification (RFC 0034, §4.26 /
// protocol §VIII.9). Structure is validation (validator.cash-flow.test.ts);
// this file covers the procedures and the verifier.

import { describe, expect, it } from 'vitest';
import {
  type CashFlowSeries,
  datedFlowsOf,
  xnpvOf,
  xirrOf,
  verifyCashFlowSeries,
  CASH_FLOW_VERIFY_DECIMALS,
} from './cash-flow-series.js';
import { CalcError } from './calc/errors.js';

// The §4.26 worked example — stated metrics computed by this module and
// pinned in the spec, so the two cannot drift silently.
const SPEC_EXAMPLE: CashFlowSeries = {
  label: 'Levered hold-period cash flow',
  day_count: 'actual/365f',
  series: [
    { date: '2026-03-17', amount: -14_250_000, kind: 'acquisition' },
    { date: '2026-09-30', amount: 412_000, kind: 'operating' },
    { date: '2027-03-31', amount: 431_000, kind: 'operating' },
    { date: '2027-06-15', amount: -350_000, kind: 'capex' },
    { date: '2031-03-17', amount: 19_800_000, kind: 'disposition' },
  ],
  stated_metrics: {
    total_net: 6_043_000,
    moic: 1.4139,
    xnpv: { rate: 0.06, value: 1_022_812.04 },
    xirr: 0.075239,
  },
};

describe('datedFlowsOf', () => {
  it('anchors year fractions on the first row', () => {
    const flows = datedFlowsOf(SPEC_EXAMPLE);
    expect(flows).not.toBeNull();
    expect(flows![0]).toEqual({ t: 0, amount: -14_250_000 });
    expect(flows![1]!.t).toBe(197 / 365);
    expect(flows![4]!.t).toBe(1826 / 365);
  });
  it('defaults the convention to actual/365f', () => {
    const { day_count: _dc, ...rest } = SPEC_EXAMPLE;
    expect(datedFlowsOf(rest as CashFlowSeries)).toEqual(datedFlowsOf(SPEC_EXAMPLE));
  });
  it('accepts same-day flows without merging them', () => {
    const flows = datedFlowsOf({
      series: [
        { date: '2026-03-17', amount: -100 },
        { date: '2026-03-17', amount: -50 },
        { date: '2027-03-17', amount: 200 },
      ],
    });
    expect(flows).toHaveLength(3);
    expect(flows![1]).toEqual({ t: 0, amount: -50 });
  });
  it('returns null for structural defects rather than throwing', () => {
    expect(datedFlowsOf({ series: [] })).toBeNull();
    expect(datedFlowsOf({ series: [{ date: '2026-02-30', amount: 1 }] })).toBeNull();
    expect(datedFlowsOf({ series: [{ date: '2026-03-17', amount: Number.NaN }] })).toBeNull();
    expect(
      datedFlowsOf({
        series: [
          { date: '2026-06-01', amount: -1 },
          { date: '2026-05-01', amount: 1 },
        ],
      }),
    ).toBeNull();
    expect(
      datedFlowsOf({
        day_count: 'actual/365' as never,
        series: [{ date: '2026-03-17', amount: 1 }],
      }),
    ).toBeNull();
  });
});

describe('xnpvOf (§VIII.9.2)', () => {
  const flows = datedFlowsOf(SPEC_EXAMPLE)!;
  it('discounts each flow by its year fraction', () => {
    // At rate 0 the xnpv is the plain sum.
    expect(xnpvOf(flows, 0)).toBe(6_043_000);
    // A one-period sanity anchor: -100 today, +110 in exactly 365 days at 10%.
    const simple = datedFlowsOf({
      series: [
        { date: '2026-01-01', amount: -100 },
        { date: '2027-01-01', amount: 110 },
      ],
    })!;
    expect(xnpvOf(simple, 0.1)).toBeCloseTo(0, 12);
  });
  it('refuses a rate at or below -1', () => {
    expect(() => xnpvOf(flows, -1)).toThrowError(CalcError);
    expect(() => xnpvOf(flows, -1.5)).toThrowError(/CALC-TYPE-001/);
  });
});

describe('xirrOf (§VIII.9.3)', () => {
  it('returns the root that zeroes xnpv — the RFC 0024 property', () => {
    const flows = datedFlowsOf(SPEC_EXAMPLE)!;
    const root = xirrOf(flows);
    // The interval stop (1e-12 half-width) can fire before the value stop on
    // eight-figure flows, so the residual scales with the series: bound it
    // relative to the gross magnitude, far below the 6dp rate quantum.
    const scale = flows.reduce((acc, f) => acc + Math.abs(f.amount), 0);
    expect(Math.abs(xnpvOf(flows, root))).toBeLessThan(scale * 1e-9);
    // Pinned at the rate quantum: the §4.26 worked-example value.
    expect(Math.round(root * 1e6) / 1e6).toBe(0.075239);
  });
  it('a one-year double is 100% exactly at the quantum', () => {
    const flows = datedFlowsOf({
      series: [
        { date: '2026-01-01', amount: -100 },
        { date: '2027-01-01', amount: 200 },
      ],
    })!;
    expect(Math.round(xirrOf(flows) * 1e6) / 1e6).toBe(1);
  });
  it('refuses when there is no sign change over the bracket', () => {
    const flows = datedFlowsOf({
      series: [
        { date: '2026-01-01', amount: 100 },
        { date: '2027-01-01', amount: 200 },
      ],
    })!;
    expect(() => xirrOf(flows)).toThrowError(/CALC-XIRR-DIVERGE/);
  });
  it('the day-count convention moves the root — dates are load-bearing', () => {
    // Jan 15 → Jul 15: 181 actual days vs 180 30/360 days, three denominators.
    const rows = [
      { date: '2026-01-15', amount: -100 },
      { date: '2026-07-15', amount: 105 },
    ];
    const a365 = xirrOf(datedFlowsOf({ day_count: 'actual/365f', series: rows })!);
    const a360 = xirrOf(datedFlowsOf({ day_count: 'actual/360', series: rows })!);
    const us = xirrOf(datedFlowsOf({ day_count: '30/360us', series: rows })!);
    expect(new Set([a365, a360, us]).size).toBe(3);
  });
});

describe('verifyCashFlowSeries', () => {
  it('verifies the spec worked example — all four metrics', () => {
    const v = verifyCashFlowSeries(SPEC_EXAMPLE);
    expect(v.issues).toEqual([]);
    expect(v.verdict).toBe('verified');
  });
  it('a series with nothing stated is verified vacuously', () => {
    expect(verifyCashFlowSeries({ series: SPEC_EXAMPLE.series }).verdict).toBe('verified');
    expect(
      verifyCashFlowSeries({ series: SPEC_EXAMPLE.series, stated_metrics: {} }).verdict,
    ).toBe('verified');
  });
  it('a stated metric off beyond its quantum is failed, with the metric named', () => {
    const v = verifyCashFlowSeries({
      ...SPEC_EXAMPLE,
      stated_metrics: { xirr: 0.0753 },
    });
    expect(v.verdict).toBe('failed');
    expect(v.issues).toHaveLength(1);
    expect(v.issues[0]).toMatchObject({ code: 'CF-METRIC-DISAGREES', metric: 'xirr' });
  });
  it('agreement is judged at the quantum, not bit-exactly', () => {
    // 6_043_000.004 rounds to the same cent as the recomputation.
    const v = verifyCashFlowSeries({
      ...SPEC_EXAMPLE,
      stated_metrics: { total_net: 6_043_000.004 },
    });
    expect(v.verdict).toBe('verified');
  });
  it('a stated xirr the procedure refuses is failed, not unverifiable', () => {
    const v = verifyCashFlowSeries({
      series: [
        { date: '2026-01-01', amount: 100 },
        { date: '2027-01-01', amount: 200 },
      ],
      stated_metrics: { xirr: 0.5 },
    });
    expect(v.verdict).toBe('failed');
    expect(v.issues[0]).toMatchObject({ code: 'CF-PROCEDURE-REFUSES', metric: 'xirr' });
  });
  it('moic on a series with no outflows is unverifiable, never failed', () => {
    const v = verifyCashFlowSeries({
      series: [
        { date: '2026-01-01', amount: 100 },
        { date: '2027-01-01', amount: 200 },
      ],
      stated_metrics: { moic: 2 },
    });
    expect(v.verdict).toBe('unverifiable');
    expect(v.issues[0]).toMatchObject({ code: 'CF-UNEVALUABLE', metric: 'moic' });
  });
  it('a structurally invalid series makes every stated metric unverifiable', () => {
    const v = verifyCashFlowSeries({
      series: [{ date: '2026-02-30', amount: -1 }],
      stated_metrics: { total_net: -1, xirr: 0.1 },
    });
    expect(v.verdict).toBe('unverifiable');
    expect(v.issues.map((i) => i.metric).sort()).toEqual(['total_net', 'xirr']);
  });
  it('an xnpv claim missing its rate or value is unverifiable', () => {
    const v = verifyCashFlowSeries({
      series: SPEC_EXAMPLE.series,
      stated_metrics: { xnpv: { rate: Number.NaN, value: 1 } },
    });
    expect(v.verdict).toBe('unverifiable');
    expect(v.issues[0]).toMatchObject({ code: 'CF-UNEVALUABLE', metric: 'xnpv' });
  });
  it('failure outranks indeterminacy in the verdict', () => {
    const v = verifyCashFlowSeries({
      series: [
        { date: '2026-01-01', amount: 100 },
        { date: '2027-01-01', amount: 200 },
      ],
      stated_metrics: { moic: 2, total_net: 999 }, // moic unverifiable, total wrong
    });
    expect(v.verdict).toBe('failed');
  });
  it('quantization is half away from zero on negatives — the §VIII.5 rule', () => {
    // -100.125 + 100 = -0.125 EXACTLY in binary64 (0.125 = 2^-3), so this
    // pins the tie rule itself: half away from zero gives -0.13, where
    // Math.round's half-up would give -0.12.
    const series = [
      { date: '2026-01-01', amount: -100.125 },
      { date: '2027-01-01', amount: 100 },
    ];
    expect(verifyCashFlowSeries({ series, stated_metrics: { total_net: -0.13 } }).verdict).toBe('verified');
    expect(verifyCashFlowSeries({ series, stated_metrics: { total_net: -0.12 } }).verdict).toBe('failed');
  });
  it('exports its quanta so emitting surfaces cannot drift', () => {
    expect(CASH_FLOW_VERIFY_DECIMALS).toEqual({ currency: 2, rate: 6, ratio: 4 });
  });
});
