// Day-count registry (protocol §VIII.9.1, RFC 0034) — each convention pinned
// against hand-worked dates, including the DAYS360 U.S. clamp table and a
// leap-February pair proving actual/365f keeps its fixed denominator.

import { describe, expect, it } from 'vitest';
import {
  DAY_COUNT_CONVENTIONS,
  DEFAULT_DAY_COUNT,
  isDayCountConvention,
  parseISODate,
  actualDays,
  yearfrac,
} from './day-count.js';

const d = (s: string) => {
  const parsed = parseISODate(s);
  if (!parsed) throw new Error(`test date ${s} failed to parse`);
  return parsed;
};

describe('parseISODate', () => {
  it('parses a real calendar day', () => {
    expect(parseISODate('2026-03-17')).toEqual({ year: 2026, month: 3, day: 17 });
  });
  it('accepts Feb 29 in a leap year and refuses it otherwise', () => {
    expect(parseISODate('2028-02-29')).toEqual({ year: 2028, month: 2, day: 29 });
    expect(parseISODate('2026-02-29')).toBeNull();
  });
  it('refuses days that do not exist', () => {
    expect(parseISODate('2026-02-30')).toBeNull();
    expect(parseISODate('2026-04-31')).toBeNull();
    expect(parseISODate('2026-13-01')).toBeNull();
    expect(parseISODate('2026-00-10')).toBeNull();
  });
  it('refuses non-ISO spellings', () => {
    expect(parseISODate('03/17/2026')).toBeNull();
    expect(parseISODate('2026-3-17')).toBeNull();
    expect(parseISODate('2026-03-17T00:00:00Z')).toBeNull();
  });
  it('century leap rules are Gregorian: 1900 is not a leap year, 2000 is', () => {
    expect(parseISODate('1900-02-29')).toBeNull();
    expect(parseISODate('2000-02-29')).not.toBeNull();
  });
});

describe('actualDays', () => {
  it('counts calendar days, leap day included', () => {
    expect(actualDays(d('2026-03-17'), d('2026-09-30'))).toBe(197);
    expect(actualDays(d('2028-02-01'), d('2028-03-01'))).toBe(29); // leap Feb
    expect(actualDays(d('2026-02-01'), d('2026-03-01'))).toBe(28);
  });
  it('is signed', () => {
    expect(actualDays(d('2026-09-30'), d('2026-03-17'))).toBe(-197);
    expect(actualDays(d('2026-03-17'), d('2026-03-17'))).toBe(0);
  });
});

describe('yearfrac', () => {
  it('actual/365f divides the actual count by a fixed 365', () => {
    expect(yearfrac(d('2026-03-17'), d('2026-09-30'), 'actual/365f')).toBe(197 / 365);
    // Five years spanning leap 2028: 1826 actual days, denominator still 365.
    expect(yearfrac(d('2026-03-17'), d('2031-03-17'), 'actual/365f')).toBe(1826 / 365);
  });
  it('actual/360 divides the same count by 360', () => {
    expect(yearfrac(d('2026-03-17'), d('2026-09-30'), 'actual/360')).toBe(197 / 360);
  });
  it('30/360us matches the Excel DAYS360 U.S. clamps', () => {
    // Plain month arithmetic.
    expect(yearfrac(d('2026-01-15'), d('2026-07-15'), '30/360us')).toBe(180 / 360);
    // dd1=31 clamps to 30: Jan 31 → Mar 31 is (2)*30 + (30-30) = 60 days.
    expect(yearfrac(d('2026-01-31'), d('2026-03-31'), '30/360us')).toBe(60 / 360);
    // dd2=31 with dd1<30 does NOT clamp: Jan 15 → Jan 31 is 16 days.
    expect(yearfrac(d('2026-01-15'), d('2026-01-31'), '30/360us')).toBe(16 / 360);
    // dd2=31 with dd1=30 clamps: Jan 30 → Mar 31 is 60 days.
    expect(yearfrac(d('2026-01-30'), d('2026-03-31'), '30/360us')).toBe(60 / 360);
    // No February special-casing: Feb 28 (non-leap) → Mar 31 stays 33 days.
    expect(yearfrac(d('2026-02-28'), d('2026-03-31'), '30/360us')).toBe(33 / 360);
  });
  it('the three conventions disagree on the same pair — which is why the registry exists', () => {
    // Jan 15 → Jul 15: 181 actual days, 180 30/360 days, three denominators.
    const results = DAY_COUNT_CONVENTIONS.map((c) => yearfrac(d('2026-01-15'), d('2026-07-15'), c));
    expect(new Set(results).size).toBe(3);
  });
});

describe('the registry', () => {
  it('is closed and the default is a member', () => {
    expect(DAY_COUNT_CONVENTIONS).toEqual(['actual/365f', 'actual/360', '30/360us']);
    expect(isDayCountConvention(DEFAULT_DAY_COUNT)).toBe(true);
  });
  it('rejects near-miss spellings — an unknown convention refuses, never defaults', () => {
    for (const bad of ['actual/365', '30/360', '30E/360', 'ACT/365F', '']) {
      expect(isDayCountConvention(bad)).toBe(false);
    }
  });
});
