// Day-count registry — protocol §VIII.9.1 (RFC 0034).
//
// Three conventions, each with an exact pinned algorithm, because "30/360" is
// a family, not a convention (ISDA 2006 §4.16): two engines that each pick a
// plausible member disagree in a receipt digest. `30/360us` is EXACTLY the
// Excel DAYS360 U.S. method — day-of-month clamps only, no NASD
// end-of-February special-casing — chosen for the Excel-parity invariant and
// documented here rather than discovered in a mismatch.
//
// Dates are ISO-8601 `YYYY-MM-DD` strings on the proleptic Gregorian
// calendar. Day arithmetic runs on UTC epoch-day integers, so `yearfrac` is
// an exact integer divided last, in binary64, as §VIII.9.1 requires.
// Browser-safe; no I/O, no locale, no system clock.

import { CalcError } from './errors.js';

/** The closed §VIII.9.1 registry. An unknown convention refuses, never defaults. */
export const DAY_COUNT_CONVENTIONS = Object.freeze([
  'actual/365f',
  'actual/360',
  '30/360us',
] as const);

export type DayCountConvention = (typeof DAY_COUNT_CONVENTIONS)[number];

/** The convention §4.26 assumes when a series states none. */
export const DEFAULT_DAY_COUNT: DayCountConvention = 'actual/365f';

export function isDayCountConvention(v: unknown): v is DayCountConvention {
  return typeof v === 'string' && (DAY_COUNT_CONVENTIONS as readonly string[]).includes(v);
}

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface CalendarDate {
  year: number;
  month: number; // 1–12
  day: number; // 1–31, checked against the real month length
}

function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

function daysInMonth(y: number, m: number): number {
  return m === 2 && isLeapYear(y) ? 29 : MONTH_DAYS[m - 1]!;
}

/**
 * Parse `YYYY-MM-DD` to a calendar date, or `null` when the string is outside
 * the grammar or names a day that does not exist (`2026-02-30`). `null` rather
 * than a throw so the validator (CF-01) and the evaluator (CALC-CF-SERIES)
 * can each raise in their own vocabulary.
 */
export function parseISODate(s: string): CalendarDate | null {
  const m = ISO_DATE_RE.exec(s);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

/**
 * Epoch-day ordinal (days since 1970-01-01, negative before). Date.UTC handles
 * the proleptic Gregorian rules; the millisecond count divides exactly because
 * UTC days here carry no leap seconds or DST.
 */
function epochDay(d: CalendarDate): number {
  return Date.UTC(d.year, d.month - 1, d.day) / 86_400_000;
}

/** Calendar days from `d1` to `d2` (signed; positive when `d2` is later). */
export function actualDays(d1: CalendarDate, d2: CalendarDate): number {
  return epochDay(d2) - epochDay(d1);
}

/**
 * The year fraction from `d1` to `d2` under a registered convention
 * (protocol §VIII.9.1). The day count is an exact integer in every
 * convention; the division happens last.
 */
export function yearfrac(
  d1: CalendarDate,
  d2: CalendarDate,
  convention: DayCountConvention,
): number {
  switch (convention) {
    case 'actual/365f':
      return actualDays(d1, d2) / 365;
    case 'actual/360':
      return actualDays(d1, d2) / 360;
    case '30/360us': {
      // Excel DAYS360 U.S. method, exactly: clamp dd1 first, then dd2 only
      // when dd1 already sits at 30. No February adjustment, deliberately.
      let dd1 = d1.day;
      let dd2 = d2.day;
      if (dd1 === 31) dd1 = 30;
      if (dd2 === 31 && dd1 === 30) dd2 = 30;
      const days = (d2.year - d1.year) * 360 + (d2.month - d1.month) * 30 + (dd2 - dd1);
      return days / 360;
    }
    default: {
      // Unreachable through the public types; reachable from JSON at runtime.
      const c: never = convention;
      throw new CalcError('CALC-TYPE-001', `yearfrac: unknown day-count convention ${JSON.stringify(c)}.`);
    }
  }
}
