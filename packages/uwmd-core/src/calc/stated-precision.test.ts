import { describe, expect, it } from 'vitest';
import { compareStatedMetric, getStatedDecimals } from './stated-precision.js';
import { quantizeDecimal } from './quantize.js';

const ratio = { round_to: 4, minimum_stated_decimals: 2 };
const compare = (raw: number, token: string) => compareStatedMetric(raw, Number(token), getStatedDecimals(token), ratio);

describe('RFC 0079 stated precision', () => {
  it.each([['1.20', 2], ['1.2', 1], ['0.0550', 4], ['1.200e-2', 5], ['120e-2', 2], ['-0.00', 2], ['1E+2', 0], ['.50', 2]])('preserves source precision of %s', (token, places) => {
    expect(getStatedDecimals(token)).toBe(places);
  });
  it.each(['1.25x', '5.50%', 'null', 'NaN', 'Infinity', '1e999', '1.2.3', ' 1.20 '])('rejects nonnumeric token %s', token => {
    expect(getStatedDecimals(token)).toBeUndefined();
  });
  it('does not double round the dictionary result', () => {
    expect(quantizeDecimal(quantizeDecimal(1.24495, 4), 2)).toBe(1.25);
    expect(compare(1.24495, '1.24')).toMatchObject({ state: 'verified', computed: 1.24, comparison_decimals: 2 });
    expect(compare(1.24495, '1.25').state).toBe('failed');
  });
  it('accepts adequate coarse precision and caps excessive precision at round_to', () => {
    expect(compare(1.5139, '1.514').state).toBe('verified');
    expect(compare(1.51394, '1.513940000').computed).toBe(1.5139);
    expect(compare(1.51394, '1.513940000').state).toBe('verified');
    expect(compare(1.51394, '1.514040000').state).toBe('failed');
  });
  it('refuses insufficient or unavailable precision, even when values agree', () => {
    expect(compare(1.2, '1.2').reason).toBe('insufficient_stated_precision');
    expect(compare(1.2, '1.20').state).toBe('verified');
    for (const places of [undefined, -1, 1.5, Number.POSITIVE_INFINITY]) {
      expect(compareStatedMetric(1.2, 1.2, places, ratio).reason).toBe('unknown_stated_precision');
    }
  });
  it('does not round a stated value falsely labeled with fewer decimals', () => {
    expect(compareStatedMetric(1.245, 1.245, 2, ratio).state).toBe('failed');
  });
  it('uses the shared half-away quantizer, including cent noise and negative ties', () => {
    const money = { round_to: 2, minimum_stated_decimals: 0 };
    expect(compareStatedMetric(537196.21 - 188848.11 + 107395.80, 455743.90, 2, money).state).toBe('verified');
    expect(compareStatedMetric(537196.21 - 188848.11 + 107395.80, 455743.91, 2, money).state).toBe('failed');
    expect(compare(-1.245, '-1.25').state).toBe('verified');
    expect(compare(-1.245, '-1.24').state).toBe('failed');
  });
  it('refuses malformed dictionary precision contracts instead of inventing a floor', () => {
    for (const metric of [
      { round_to: 2, minimum_stated_decimals: -1 },
      { round_to: 2, minimum_stated_decimals: 3 },
      { round_to: 13, minimum_stated_decimals: 2 },
      { round_to: 2.5, minimum_stated_decimals: 2 },
      { round_to: null, minimum_stated_decimals: 1 },
      { round_to: 2, minimum_stated_decimals: Number.NaN },
    ]) expect(() => compareStatedMetric(1, 1, 2, metric)).toThrow('CALC-TYPE-001');
  });
  it('preserves raw size identity and refuses nonfinite evidence', () => {
    const size = { round_to: null, minimum_stated_decimals: 0 };
    expect(compareStatedMetric(123.123456789, 123.123456789, 9, size).state).toBe('verified');
    expect(compareStatedMetric(123.123456789, 123.123457, 6, size).state).toBe('failed');
    expect(compareStatedMetric(Number.POSITIVE_INFINITY, 1, 0, size).state).toBe('unverifiable');
    expect(compareStatedMetric(1, Number.NaN, 0, size).state).toBe('unverifiable');
  });
});
