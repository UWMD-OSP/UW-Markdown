// Day-count registry (protocol §VIII.9.1, RFC 0034) — each convention pinned
// against hand-worked dates, including the DAYS360 U.S. clamp table and a
// leap-February pair proving actual/365f keeps its fixed denominator.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  DAY_COUNT_CONVENTIONS,
  DEFAULT_DAY_COUNT,
  isDayCountConvention,
  parseISODate,
  actualDays,
  dayOrdinal,
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

// Early years. `actualDays` once ran on `Date.UTC`, which ECMAScript defines to
// read a numeric year 0–99 as 1900–1999, so dates in 0000–0099 were counted
// nineteen centuries late. §VIII.9.1 says proleptic Gregorian, with no carve-out.
describe('actualDays in years 0000–0099 (proleptic Gregorian, no Date.UTC year remapping)', () => {
  it('counts year 0000 as a leap year', () => {
    expect(actualDays(d('0000-01-01'), d('0001-01-01'))).toBe(366);
    expect(actualDays(d('0000-02-28'), d('0000-03-01'))).toBe(2);
  });
  it('crosses the 0099/0100 boundary by one day', () => {
    expect(actualDays(d('0099-12-31'), d('0100-01-01'))).toBe(1);
  });
  it('is exactly antisymmetric', () => {
    expect(actualDays(d('0001-01-01'), d('0000-01-01'))).toBe(-366);
    expect(actualDays(d('0000-03-01'), d('0000-02-28'))).toBe(-2);
    expect(actualDays(d('0100-01-01'), d('0099-12-31'))).toBe(-1);
  });
  it('keeps the century rules: 1900 is common, 2000 is leap', () => {
    expect(actualDays(d('1900-02-28'), d('1900-03-01'))).toBe(1);
    expect(actualDays(d('2000-02-28'), d('2000-03-01'))).toBe(2);
  });
  it('anchors the ordinal: 0000-01-01 is 0 and 1970-01-01 is 719,528', () => {
    expect(dayOrdinal(d('0000-01-01'))).toBe(0);
    expect(dayOrdinal(d('0000-12-31'))).toBe(365);
    expect(dayOrdinal(d('1970-01-01'))).toBe(719_528);
  });
  it('feeds the corrected count to actual/365f and actual/360; 30/360us is untouched', () => {
    expect(yearfrac(d('0000-01-01'), d('0001-01-01'), 'actual/365f')).toBe(366 / 365);
    expect(yearfrac(d('0000-01-01'), d('0001-01-01'), 'actual/360')).toBe(366 / 360);
    expect(yearfrac(d('0099-12-31'), d('0100-01-01'), 'actual/365f')).toBe(1 / 365);
    expect(yearfrac(d('0099-12-31'), d('0100-01-01'), 'actual/360')).toBe(1 / 360);
    // 30/360us reads the date parts directly and never reached Date.UTC.
    expect(yearfrac(d('0000-01-01'), d('0001-01-01'), '30/360us')).toBe(360 / 360);
    expect(yearfrac(d('0099-12-31'), d('0100-01-01'), '30/360us')).toBe(1 / 360);
  });
});

// An independent oracle. It accumulates year and month lengths by iteration
// from its own leap rule and month table, and never calls `Date`,
// `dayOrdinal`, `actualDays` or `parseISODate`.
describe('actualDays agrees with an independent proleptic-Gregorian oracle', () => {
  const oracleLeap = (y: number) => y % 400 === 0 || (y % 4 === 0 && y % 100 !== 0);
  const ORACLE_MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const oracleMonthLength = (y: number, m: number) => (m === 2 && oracleLeap(y) ? 29 : ORACLE_MONTH_LENGTHS[m - 1]!);
  const yearStart: number[] = [0];
  for (let y = 0; y < 10_000; y++) yearStart.push(yearStart[y]! + (oracleLeap(y) ? 366 : 365));
  const oracleOrdinal = (y: number, m: number, day: number) => {
    let n = yearStart[y]!;
    for (let k = 1; k < m; k++) n += oracleMonthLength(y, k);
    return n + day - 1;
  };
  const date = (y: number, m: number, day: number) => ({ year: y, month: m, day });
  const origin = date(0, 1, 1);

  it('on every January 1 from 0000 to 9999', () => {
    for (let y = 0; y < 10_000; y++) {
      if (actualDays(origin, date(y, 1, 1)) !== yearStart[y]) expect.fail(`January 1, year ${y}`);
    }
  });

  it('on every day of the first 400-year cycle (0000–0399) and of 1899–2101', () => {
    for (const [from, to] of [[0, 399], [1899, 2101]] as const) {
      for (let y = from; y <= to; y++) {
        for (let m = 1; m <= 12; m++) {
          for (let day = 1; day <= oracleMonthLength(y, m); day++) {
            if (actualDays(origin, date(y, m, day)) !== oracleOrdinal(y, m, day)) {
              expect.fail(`${y}-${m}-${day}`);
            }
          }
        }
      }
    }
  });

  it('on seeded random pairs across the whole 0000–9999 domain', () => {
    const arbDate = fc
      .tuple(fc.integer({ min: 0, max: 9999 }), fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: 31 }))
      .map(([y, m, day]) => date(y, m, Math.min(day, oracleMonthLength(y, m))));
    fc.assert(
      fc.property(arbDate, arbDate, (a, b) =>
        actualDays(a, b) === oracleOrdinal(b.year, b.month, b.day) - oracleOrdinal(a.year, a.month, a.day),
      ),
      { numRuns: 2000, seed: 0x0071_da7e },
    );
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
