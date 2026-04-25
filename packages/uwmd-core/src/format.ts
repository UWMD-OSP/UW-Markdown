// Canonical display-formatting helpers for the .uw.md format.
// Pure functions, no I/O. The single source of truth referenced by the renderer
// and by Part III of UW_PROTOCOL_v1.md (Display Conventions).
//
// Conformance rationale: the protocol freezes 'en-US' as the v1 locale and
// fixes default precision per kind so any conforming implementer renders the
// same string for the same value.

export interface CurrencyOptions {
  decimals?: number;        // default: undefined → toLocaleString default (no fractional digits for whole numbers)
  symbol?: string;          // default: '$'
  nullDisplay?: string;     // default: 'n/a'
}

export interface PercentOptions {
  decimals?: number;        // default: 2
  multiplier?: number;      // default: 100 (assumes input is a decimal: 0.0551 → "5.51%")
  suffix?: string;          // default: '%'
  nullDisplay?: string;     // default: 'n/a'
}

export interface RatioOptions {
  decimals?: number;        // default: 3
  suffix?: string;          // default: 'x'
  nullDisplay?: string;     // default: 'n/a'
}

export interface CountOptions {
  nullDisplay?: string;     // default: 'n/a'
}

export interface DateOptions {
  style?: 'iso' | 'short' | 'medium' | 'long';   // default: 'iso' (passthrough)
  nullDisplay?: string;     // default: 'n/a'
  locale?: string;          // default: 'en-US'
}

export interface NullOptions {
  nullDisplay?: string;     // default: 'n/a'
}

const DEFAULT_NULL = 'n/a';

function toFiniteNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Format a currency value. Default: $1,234,567 (no fractional digits).
 * Pass `decimals: 2` for $1,234,567.00.
 */
export function formatCurrency(value: unknown, opts?: CurrencyOptions): string {
  const n = toFiniteNumber(value);
  if (n === null) return opts?.nullDisplay ?? DEFAULT_NULL;
  const symbol = opts?.symbol ?? '$';
  if (opts?.decimals != null) {
    return `${symbol}${n.toLocaleString('en-US', {
      minimumFractionDigits: opts.decimals,
      maximumFractionDigits: opts.decimals,
    })}`;
  }
  return `${symbol}${n.toLocaleString('en-US')}`;
}

/**
 * Format a percentage. Default: input is a decimal (0.0551), output is "5.51%".
 * Pass `multiplier: 1` if the input is already in percentage units.
 */
export function formatPercent(value: unknown, opts?: PercentOptions): string {
  const n = toFiniteNumber(value);
  if (n === null) return opts?.nullDisplay ?? DEFAULT_NULL;
  const multiplier = opts?.multiplier ?? 100;
  const decimals = opts?.decimals ?? 2;
  const suffix = opts?.suffix ?? '%';
  return `${(n * multiplier).toFixed(decimals)}${suffix}`;
}

/**
 * Format a ratio/multiple. Default: 3 decimals + 'x' suffix → "1.109x".
 * Pass `suffix: ''` for a plain decimal string with no suffix.
 */
export function formatRatio(value: unknown, opts?: RatioOptions): string {
  const n = toFiniteNumber(value);
  if (n === null) return opts?.nullDisplay ?? DEFAULT_NULL;
  const decimals = opts?.decimals ?? 3;
  const suffix = opts?.suffix ?? 'x';
  return `${n.toFixed(decimals)}${suffix}`;
}

/**
 * Format an integer count. No locale separators by default.
 */
export function formatCount(value: unknown, opts?: CountOptions): string {
  const n = toFiniteNumber(value);
  if (n === null) return opts?.nullDisplay ?? DEFAULT_NULL;
  return String(Math.trunc(n));
}

/**
 * Format an ISO-8601 date string. Default style 'iso' returns the input unchanged.
 * Other styles convert to a locale-formatted date.
 */
export function formatDate(value: unknown, opts?: DateOptions): string {
  if (value == null) return opts?.nullDisplay ?? DEFAULT_NULL;
  if (typeof value !== 'string') return opts?.nullDisplay ?? DEFAULT_NULL;
  const style = opts?.style ?? 'iso';
  if (style === 'iso') return value;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return value;
  const locale = opts?.locale ?? 'en-US';
  const dtfOpts: Intl.DateTimeFormatOptions =
    style === 'short' ? { dateStyle: 'short' } :
    style === 'medium' ? { dateStyle: 'medium' } :
    { dateStyle: 'long' };
  return d.toLocaleDateString(locale, dtfOpts);
}

/** Returns the configured null-display string. */
export function formatNull(opts?: NullOptions): string {
  return opts?.nullDisplay ?? DEFAULT_NULL;
}

// ─── CSV-mode helpers ────────────────────────────────────────────────────────
// CSV cells use empty strings for null (not 'n/a') and emit raw numbers
// without currency symbols, percent signs, or ratio suffixes.

/** Format a percent for CSV: raw decimal × 100 with N digits, empty on null. */
export function formatPercentCsv(value: unknown, decimals = 4): string {
  const n = toFiniteNumber(value);
  if (n === null) return '';
  return (n * 100).toFixed(decimals);
}

/** Format a number for CSV: raw value, empty on null. */
export function formatNumberCsv(value: unknown): string {
  const n = toFiniteNumber(value);
  if (n === null) return '';
  return String(n);
}

// ─── Generic value coercion ──────────────────────────────────────────────────

/** Coerce any value to a display string with null fallback. */
export function formatValue(value: unknown, opts?: NullOptions): string {
  if (value == null) return opts?.nullDisplay ?? DEFAULT_NULL;
  return String(value);
}
