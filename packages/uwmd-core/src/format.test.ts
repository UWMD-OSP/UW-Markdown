import { describe, expect, it } from 'vitest';
import {
  formatCount,
  formatCurrency,
  formatDate,
  formatNull,
  formatNumberCsv,
  formatPercent,
  formatPercentCsv,
  formatRatio,
  formatValue,
} from './format.js';

describe('display formatters', () => {
  it('formats currency with defaults and explicit precision', () => {
    expect(formatCurrency(1234567.89)).toBe('$1,234,567.89');
    expect(formatCurrency(1234567, { decimals: 2, symbol: '€' })).toBe('€1,234,567.00');
  });

  it('uses configured null displays for invalid numeric values', () => {
    expect(formatCurrency(Number.POSITIVE_INFINITY, { nullDisplay: '—' })).toBe('—');
    expect(formatPercent('not a number', { nullDisplay: 'missing' })).toBe('missing');
    expect(formatRatio(null)).toBe('n/a');
    expect(formatCount(undefined)).toBe('n/a');
  });

  it('formats rates, ratios, and counts using their display conventions', () => {
    expect(formatPercent(0.0551)).toBe('5.51%');
    expect(formatPercent(5.5, { multiplier: 1, decimals: 1, suffix: ' pct' })).toBe('5.5 pct');
    expect(formatRatio(1.1094)).toBe('1.109x');
    expect(formatRatio(1.1094, { decimals: 2, suffix: '' })).toBe('1.11');
    expect(formatCount(12.9)).toBe('12');
  });

  it('keeps ISO dates intact and handles invalid or non-string values safely', () => {
    expect(formatDate('2026-08-12')).toBe('2026-08-12');
    expect(formatDate('not-a-date', { style: 'long' })).toBe('not-a-date');
    expect(formatDate(123, { nullDisplay: 'unknown' })).toBe('unknown');
  });

  it('uses raw numeric cells for CSV and coerces generic display values', () => {
    expect(formatPercentCsv(0.0551)).toBe('5.5100');
    expect(formatPercentCsv(null)).toBe('');
    expect(formatNumberCsv('1200.5')).toBe('1200.5');
    expect(formatNumberCsv(Number.NaN)).toBe('');
    expect(formatNull({ nullDisplay: 'none' })).toBe('none');
    expect(formatValue({ deal: 'Parkview' })).toBe('[object Object]');
    expect(formatValue(null, { nullDisplay: 'none' })).toBe('none');
  });
});
