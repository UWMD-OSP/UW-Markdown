// RFC 0079: compare the unrounded dictionary result at source precision.
import { MAX_ROUND_TO, quantizeDecimal } from './quantize.js';
import { CalcError } from './errors.js';

export interface StatedMetricComparison {
  state: 'verified' | 'failed' | 'unverifiable';
  computed: number | null;
  comparison?: number;
  comparison_decimals?: number;
  reason?: 'no_numeric_statement' | 'unknown_stated_precision' | 'insufficient_stated_precision' | 'nonfinite_or_nonnumeric_result';
}

/** Decimal places of a numeric source token, including trailing zeros and exponents.
 * Do not pass String(parsedNumber): a numeric parser has already lost precision.
 * Rates use their stored fractional token, not a formatted display string.
 */
export function getStatedDecimals(token: string): number | undefined {
  const match = /^[+-]?(?:\d+(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/.exec(token);
  if (!match || !Number.isFinite(Number(token))) return undefined;
  const decimals = Math.max(0, (match[1] ?? match[2] ?? '').length - Number(match[3] ?? 0));
  return Number.isSafeInteger(decimals) ? decimals : undefined;
}

/** `unrounded` MUST come straight from expression evaluation, before round_to.
 * This checks a document statement; receipt result digests still use round_to.
 * Missing source precision cannot be reconstructed from a parsed number.
 */
export function compareStatedMetric(
  unrounded: number,
  stated: number,
  statedDecimals: number | undefined,
  metric: { round_to: number | null; minimum_stated_decimals: number },
): StatedMetricComparison {
  const minimum = metric.minimum_stated_decimals;
  const ceiling = metric.round_to;
  if (!Number.isInteger(minimum) || minimum < 0 ||
    (ceiling === null ? minimum !== 0 : !Number.isInteger(ceiling) || ceiling < minimum || ceiling > MAX_ROUND_TO)) {
    throw new CalcError('CALC-TYPE-001', 'Invalid dictionary minimum/round_to precision contract.');
  }
  if (!Number.isFinite(unrounded)) {
    return { state: 'unverifiable', reason: 'nonfinite_or_nonnumeric_result', computed: null };
  }
  if (!Number.isFinite(stated)) {
    return { state: 'unverifiable', reason: 'no_numeric_statement', computed: null };
  }
  if (metric.round_to === null) {
    return { state: unrounded === stated ? 'verified' : 'failed', computed: unrounded, comparison: stated };
  }
  if (statedDecimals === undefined || !Number.isSafeInteger(statedDecimals) || statedDecimals < 0) {
    return { state: 'unverifiable', reason: 'unknown_stated_precision', computed: null };
  }
  if (statedDecimals < metric.minimum_stated_decimals) {
    return { state: 'unverifiable', reason: 'insufficient_stated_precision', computed: null };
  }
  const decimals = Math.min(statedDecimals, metric.round_to);
  const computed = quantizeDecimal(unrounded, decimals);
  const comparison = statedDecimals > metric.round_to ? quantizeDecimal(stated, decimals) : stated;
  return { state: computed === comparison ? 'verified' : 'failed', computed, comparison, comparison_decimals: decimals };
}
