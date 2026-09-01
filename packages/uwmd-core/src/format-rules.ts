// Per-locale display-formatting rules (RFC 0001, UW_FORMAT_SPEC Part III).
//
// A curated table, stated verbatim in the spec, NOT a runtime Intl/ICU
// lookup: ICU output varies across Node versions and platforms, and
// "deterministic per locale" cannot rest on whatever ICU shipped this
// morning. The rows are checked against CLDR conventions once, by a human,
// at registration time; new locales land via additive RFC amendments.
//
// Scope (the RFC's display-only boundary): these rules govern chat/summary/
// report display strings ONLY. Canonical JSON content, CSV renders, UW Lite
// canonical form, digests, and calc evaluation are locale-free and never
// consult this table. `en-US` display keeps its pre-0001 code path in
// format.ts byte-identical; its row here exists for completeness and for
// surfaces that want the rules as data.

import type { SupportedLocale } from './protocol.js';

/** One locale's display conventions. */
export interface LocaleFormatRules {
  locale: SupportedLocale;
  /** Separates integer and fractional digits ('.' or ','). */
  decimal_separator: string;
  /** Groups thousands ('.', ',', or a non-breaking space). */
  grouping_separator: string;
  currency: {
    symbol: string;
    /** Symbol before or after the amount. */
    position: 'prefix' | 'suffix';
    /** A space between amount and symbol (NBSP where the row says so). */
    space: boolean;
  };
  percent: {
    /** A space before the % sign (the French/German convention). */
    space: boolean;
  };
  /**
   * Display date pattern applied to ISO-8601 input. 'iso' = passthrough.
   * Applied textually to the date portion — no Date object, no timezone.
   */
  date_pattern: 'iso' | 'DD/MM/YYYY' | 'DD.MM.YYYY' | 'YYYY/MM/DD' | 'YYYY-MM-DD';
}

// U+00A0 non-breaking space, constructed from its code point so no tool
// can silently turn it into a plain space in transit.
const NBSP = String.fromCharCode(0x00a0);

/**
 * The Part III per-locale table (RFC 0001 first wave). `en-US` keeps its
 * historical conventions verbatim; the others follow each locale's standard
 * usage with NBSP where the convention separates figure from symbol.
 */
export const BUILTIN_FORMAT_RULES: Readonly<Record<SupportedLocale, LocaleFormatRules>> =
  Object.freeze({
    'en-US': Object.freeze({
      locale: 'en-US',
      decimal_separator: '.',
      grouping_separator: ',',
      currency: Object.freeze({ symbol: '$', position: 'prefix', space: false }),
      percent: Object.freeze({ space: false }),
      date_pattern: 'iso',
    }),
    'en-GB': Object.freeze({
      locale: 'en-GB',
      decimal_separator: '.',
      grouping_separator: ',',
      currency: Object.freeze({ symbol: '£', position: 'prefix', space: false }),
      percent: Object.freeze({ space: false }),
      date_pattern: 'DD/MM/YYYY',
    }),
    'de-DE': Object.freeze({
      locale: 'de-DE',
      decimal_separator: ',',
      grouping_separator: '.',
      currency: Object.freeze({ symbol: '€', position: 'suffix', space: true }),
      percent: Object.freeze({ space: true }),
      date_pattern: 'DD.MM.YYYY',
    }),
    'fr-FR': Object.freeze({
      locale: 'fr-FR',
      decimal_separator: ',',
      grouping_separator: NBSP,
      currency: Object.freeze({ symbol: '€', position: 'suffix', space: true }),
      percent: Object.freeze({ space: true }),
      date_pattern: 'DD/MM/YYYY',
    }),
    'ja-JP': Object.freeze({
      locale: 'ja-JP',
      decimal_separator: '.',
      grouping_separator: ',',
      currency: Object.freeze({ symbol: '¥', position: 'prefix', space: false }),
      percent: Object.freeze({ space: false }),
      date_pattern: 'YYYY/MM/DD',
    }),
    'zh-CN': Object.freeze({
      locale: 'zh-CN',
      decimal_separator: '.',
      grouping_separator: ',',
      currency: Object.freeze({ symbol: '¥', position: 'prefix', space: false }),
      percent: Object.freeze({ space: false }),
      date_pattern: 'YYYY-MM-DD',
    }),
  });

// ─── Rule-driven primitives (used by format.ts for non-en-US locales) ────────

/**
 * Format a finite number under a locale's separators. `decimals` fixes the
 * fraction length; undefined mirrors the en-US default behavior (up to 3
 * fractional digits, none when whole).
 */
export function formatNumberWithRules(n: number, rules: LocaleFormatRules, decimals?: number): string {
  const fixed = decimals != null ? n.toFixed(decimals) : trimToMax3(n);
  const negative = fixed.startsWith('-');
  const body = negative ? fixed.slice(1) : fixed;
  const [intPart, fracPart] = body.split('.') as [string, string?];
  const grouped = groupDigits(intPart, rules.grouping_separator);
  const out = fracPart !== undefined ? `${grouped}${rules.decimal_separator}${fracPart}` : grouped;
  return negative ? `-${out}` : out;
}

/** The NBSP-or-space between figure and symbol, per the row. */
export function currencyWithRules(n: number, rules: LocaleFormatRules, decimals?: number): string {
  const num = formatNumberWithRules(n, rules, decimals);
  const gap = rules.currency.space ? NBSP : '';
  return rules.currency.position === 'prefix'
    ? `${rules.currency.symbol}${gap}${num}`
    : `${num}${gap}${rules.currency.symbol}`;
}

/**
 * Rearrange an ISO-8601 date's `YYYY-MM-DD` prefix into the locale's display
 * pattern, textually. Input that does not start with an ISO date passes
 * through unchanged — never a guess, never a Date object.
 */
export function dateWithRules(iso: string, rules: LocaleFormatRules): string {
  if (rules.date_pattern === 'iso') return iso;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m as unknown as [string, string, string, string];
  switch (rules.date_pattern) {
    case 'DD/MM/YYYY': return `${d}/${mo}/${y}`;
    case 'DD.MM.YYYY': return `${d}.${mo}.${y}`;
    case 'YYYY/MM/DD': return `${y}/${mo}/${d}`;
    case 'YYYY-MM-DD': return `${y}-${mo}-${d}`;
  }
}

function groupDigits(digits: string, separator: string): string {
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += separator;
    out += digits[i];
  }
  return out;
}

/**
 * Mirror `toLocaleString('en-US')`'s default fraction behavior (at most 3
 * fractional digits, trailing zeros dropped, none when whole) so the
 * registry path and the historical en-US path agree about *which* digits
 * exist and differ only in separators.
 */
function trimToMax3(n: number): string {
  const fixed = n.toFixed(3);
  return fixed.replace(/\.?0+$/, '');
}
