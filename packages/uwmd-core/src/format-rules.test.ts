// BUILTIN_FORMAT_RULES — the RFC 0001 per-locale display registry, and the
// locale dispatch in format.ts. The en-US path must stay byte-identical to
// its pre-0001 output; every other locale formats from the registry rows,
// never runtime Intl.

import { describe, expect, it } from 'vitest';
import { BUILTIN_FORMAT_RULES, dateWithRules, formatNumberWithRules } from './format-rules.js';
import { formatCurrency, formatDate, formatPercent, formatRatio } from './format.js';
import { SUPPORTED_LOCALES } from './protocol.js';

const NBSP = String.fromCharCode(0x00a0);

describe('the NBSP constant defends itself', () => {
  it('is U+00A0, not a plain space', () => {
    expect(NBSP.charCodeAt(0)).toBe(0x00a0);
    expect(BUILTIN_FORMAT_RULES['fr-FR'].grouping_separator.charCodeAt(0)).toBe(0x00a0);
  });
});

describe('the registry', () => {
  it('carries exactly one row per registered locale', () => {
    expect(Object.keys(BUILTIN_FORMAT_RULES).sort()).toEqual([...SUPPORTED_LOCALES].sort());
    for (const locale of SUPPORTED_LOCALES) {
      expect(BUILTIN_FORMAT_RULES[locale].locale).toBe(locale);
    }
  });
});

describe('en-US stays byte-identical to the historical path', () => {
  it('renders the Part III examples unchanged', () => {
    expect(formatCurrency(1234567, { locale: 'en-US' })).toBe('$1,234,567');
    expect(formatCurrency(1234567)).toBe('$1,234,567');
    expect(formatPercent(0.0551, { locale: 'en-US' })).toBe('5.51%');
    expect(formatRatio(1.234567, { locale: 'en-US' })).toBe('1.235x');
    expect(formatDate('2026-04-15', { locale: 'en-US' })).toBe('2026-04-15');
  });
});

describe('registry-driven locales', () => {
  it('de-DE: swapped separators, suffix € with NBSP, NBSP percent, dotted date', () => {
    expect(formatCurrency(1234567, { locale: 'de-DE' })).toBe(`1.234.567${NBSP}€`);
    expect(formatCurrency(1234567.5, { locale: 'de-DE', decimals: 2 })).toBe(`1.234.567,50${NBSP}€`);
    expect(formatPercent(0.0551, { locale: 'de-DE' })).toBe(`5,51${NBSP}%`);
    expect(formatRatio(1.234567, { locale: 'de-DE' })).toBe('1,235x');
    expect(formatDate('2026-04-15', { locale: 'de-DE' })).toBe('15.04.2026');
  });

  it('fr-FR: NBSP grouping, comma decimal', () => {
    expect(formatCurrency(1234567, { locale: 'fr-FR' })).toBe(`1${NBSP}234${NBSP}567${NBSP}€`);
    expect(formatPercent(0.0551, { locale: 'fr-FR' })).toBe(`5,51${NBSP}%`);
    expect(formatDate('2026-04-15', { locale: 'fr-FR' })).toBe('15/04/2026');
  });

  it('en-GB: £ prefix, DD/MM/YYYY', () => {
    expect(formatCurrency(1234567, { locale: 'en-GB' })).toBe('£1,234,567');
    expect(formatDate('2026-04-15', { locale: 'en-GB' })).toBe('15/04/2026');
  });

  it('ja-JP and zh-CN: ¥ prefix, their date orders', () => {
    expect(formatCurrency(1234567, { locale: 'ja-JP' })).toBe('¥1,234,567');
    expect(formatDate('2026-04-15', { locale: 'ja-JP' })).toBe('2026/04/15');
    expect(formatCurrency(1234567, { locale: 'zh-CN' })).toBe('¥1,234,567');
    expect(formatDate('2026-04-15', { locale: 'zh-CN' })).toBe('2026-04-15');
  });

  it('an explicit symbol overrides the registry symbol, keeping locale placement', () => {
    expect(formatCurrency(1000, { locale: 'de-DE', symbol: 'CHF' })).toBe(`1.000${NBSP}CHF`);
  });
});

describe('formatNumberWithRules', () => {
  const de = BUILTIN_FORMAT_RULES['de-DE'];

  it('mirrors the en-US default fraction behavior (max 3, trailing zeros dropped)', () => {
    expect(formatNumberWithRules(1234.5678, de)).toBe('1.234,568');
    expect(formatNumberWithRules(1234.5, de)).toBe('1.234,5');
    expect(formatNumberWithRules(1234, de)).toBe('1.234');
  });

  it('handles negatives and fixed decimals', () => {
    expect(formatNumberWithRules(-1234567.891, de, 2)).toBe('-1.234.567,89');
  });
});

describe('dateWithRules', () => {
  it('passes non-ISO input through unchanged — never a guess', () => {
    expect(dateWithRules('Q3 2026', BUILTIN_FORMAT_RULES['de-DE'])).toBe('Q3 2026');
  });

  it('rearranges only the date portion of a timestamp textually', () => {
    expect(dateWithRules('2026-04-15T10:00:00Z', BUILTIN_FORMAT_RULES['de-DE'])).toBe('15.04.2026');
  });
});
