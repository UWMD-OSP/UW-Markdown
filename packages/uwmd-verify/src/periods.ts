import { getPathSegment } from './parser.js';
import { parseISODate } from './calc/day-count.js';
import type { PeriodKey, PeriodSeriesEntry } from './protocol.js';

function positiveYear(value: unknown): PeriodKey | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 ? { kind: 'year', index: value } : null;
}

/** Gregorian calendar identities; no row positions or implicit holding-year conversions. */
export function parsePeriodSelector(value: string): PeriodKey | null {
  if (/^Y[1-9][0-9]*$/.test(value)) return positiveYear(Number(value.slice(1)));
  let match = /^([0-9]{4})-Q([1-4])$/.exec(value);
  if (match) return { kind: 'quarter', year: Number(match[1]), quarter: Number(match[2]) };
  match = /^([0-9]{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (match) return { kind: 'month', year: Number(match[1]), month: Number(match[2]) };
  if (parseISODate(value)) return { kind: 'date', date: value };
  return null;
}

export function canonicalPeriod(entry: PeriodSeriesEntry, value: unknown): PeriodKey | null {
  if (entry.grammar === 'year_index') {
    if (entry.shape === 'keyed' && typeof value === 'string') {
      const match = /^year_([0-9]+)$/.exec(value);
      return match ? positiveYear(Number(match[1])) : null;
    }
    return positiveYear(value);
  }
  if (typeof value !== 'string') return null;
  const key = parsePeriodSelector(value);
  if (!key) return null;
  if (entry.grammar === 'iso_date') return key.kind === 'date' ? key : null;
  return key.kind === 'quarter' || key.kind === 'month' ? key : null;
}

export function periodKeyIdentity(key: PeriodKey): string {
  switch (key.kind) {
    case 'year': return `year:${key.index}`;
    case 'quarter': return `quarter:${key.year}:${key.quarter}`;
    case 'month': return `month:${key.year}:${key.month}`;
    case 'date': return `date:${key.date}`;
  }
}

export interface PeriodSeriesScan {
  rows: ReadonlyMap<string, { key: PeriodKey; value: unknown }>;
  invalid: string[];
  duplicates: string[];
}

/** Inspect a whole series before choosing a row; validation is not a prerequisite. */
export function scanPeriodSeries(entry: PeriodSeriesEntry, value: unknown, payload: unknown): PeriodSeriesScan {
  const rows = new Map<string, { key: PeriodKey; value: unknown }>();
  const invalid: string[] = [];
  const duplicates: string[] = [];
  if (value === null || value === undefined) return { rows, invalid, duplicates };
  const pairs: Array<[string, unknown]> = [];
  if (entry.shape === 'rows') {
    if (!Array.isArray(value)) return { rows, invalid: ['series must be an array'], duplicates };
    for (let i = 0; i < value.length; i++) pairs.push([String(i), getPathSegment(value, String(i))]);
  } else {
    if (typeof value !== 'object' || Array.isArray(value)) return { rows, invalid: ['series must be a keyed object'], duplicates };
    pairs.push(...Object.entries(value));
  }
  const cadence = entry.cadence_field ? getPathSegment(payload, entry.cadence_field) : undefined;
  if (entry.grammar === 'calendar_period' && cadence !== 'monthly' && cadence !== 'quarterly') invalid.push('period_granularity must be monthly or quarterly');
  for (const [position, row] of pairs) {
    const raw = entry.shape === 'keyed' ? position : getPathSegment(row, entry.period_field!);
    const key = canonicalPeriod(entry, raw);
    if (!key || row === null || typeof row !== 'object' || Array.isArray(row)
      || (entry.grammar === 'calendar_period' && ((cadence === 'monthly' && key.kind !== 'month') || (cadence === 'quarterly' && key.kind !== 'quarter')))) {
      invalid.push(position);
      continue;
    }
    const identity = periodKeyIdentity(key);
    if (rows.has(identity)) duplicates.push(identity);
    else rows.set(identity, { key, value: row });
  }
  return { rows, invalid, duplicates: [...new Set(duplicates)].sort() };
}

export function periodKindMatches(entry: PeriodSeriesEntry, key: PeriodKey, payload?: unknown): boolean {
  if (entry.grammar === 'year_index') return key.kind === 'year';
  if (entry.grammar === 'iso_date') return key.kind === 'date';
  const cadence = getPathSegment(payload, entry.cadence_field ?? 'period_granularity');
  return cadence === 'monthly' ? key.kind === 'month' : cadence === 'quarterly' ? key.kind === 'quarter'
    : key.kind === 'month' || key.kind === 'quarter';
}
