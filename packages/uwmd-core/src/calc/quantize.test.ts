import { describe, expect, it } from 'vitest';
import { CalcError } from './errors.js';
import {
  DEFAULT_ROUND_TO,
  DEFAULT_ROUND_TO_BY_UNIT,
  MAX_ROUND_TO,
  quantizeDecimal,
  resolveRoundTo,
} from './quantize.js';

describe('quantizeDecimal', () => {
  it('rounds half away from zero, symmetrically about zero', () => {
    expect(quantizeDecimal(2.5, 0)).toBe(3);
    expect(quantizeDecimal(-2.5, 0)).toBe(-3);
    expect(quantizeDecimal(0.5, 0)).toBe(1);
    expect(quantizeDecimal(-0.5, 0)).toBe(-1);
    expect(quantizeDecimal(1.4999, 0)).toBe(1);
  });

  // The regression this module exists for. `1.005 * 100` is 100.49999999999999,
  // so quantizing by scaling gives 1.00 where Excel's ROUND gives 1.01 — a
  // silent off-by-a-cent in the one direction the format promises agreement.
  it('does not inherit the binary artifact of scaling by a power of ten', () => {
    expect(1.005 * 100).toBe(100.49999999999999); // the artifact itself
    expect(quantizeDecimal(1.005, 2)).toBe(1.01);
    expect(quantizeDecimal(8.575, 2)).toBe(8.58);
    expect(quantizeDecimal(1.0049999, 2)).toBe(1);
    expect(quantizeDecimal(5e-7, 6)).toBe(1e-6);
    expect(quantizeDecimal(-5e-7, 6)).toBe(-1e-6);
  });

  it('removes the unquantized tail that made digests unreproducible', () => {
    // The tier-3 revpar fixture, ADR 145.50 at 72% occupancy. Its baseline used
    // to pin the tail; RevPAR is a dollar figure and 104.76 is the answer.
    expect(145.5 * 0.72).toBe(104.75999999999999);
    expect(quantizeDecimal(145.5 * 0.72, 2)).toBe(104.76);
    expect(quantizeDecimal(0.1 + 0.2, 6)).toBe(0.3);
  });

  it('is idempotent — quantizing an already-quantized value is a no-op', () => {
    for (const n of [1.01, 104.76, 0.055102, -1.2637, 97500]) {
      expect(quantizeDecimal(quantizeDecimal(n, 6), 6)).toBe(quantizeDecimal(n, 6));
    }
  });

  it('collapses negative zero, which canonicalizes to "0"', () => {
    expect(Object.is(quantizeDecimal(-0, 2), 0)).toBe(true);
    expect(Object.is(quantizeDecimal(-0.00001, 2), 0)).toBe(true);
  });

  it('accepts negative decimals, matching Excel ROUND(1234, -2)', () => {
    expect(quantizeDecimal(1234, -2)).toBe(1200);
    expect(quantizeDecimal(1250, -2)).toBe(1300);
    expect(quantizeDecimal(-1250, -2)).toBe(-1300);
  });

  // A noisy binary64 sum can shift to an exact integer. The value must still be
  // rebuilt from that integer, or the noise survives quantization. RFC 0064's
  // reserve verifier reported RSV-06 on a correctly stated balance this way.
  it('removes binary noise when the decimal shift lands on an integer', () => {
    const noisy = 537196.21 - 188848.11 + 107395.8;
    expect(noisy).toBe(455743.89999999997); // the artifact itself
    expect(quantizeDecimal(noisy, 2)).toBe(455743.9);
    expect(quantizeDecimal(285810.09 + 69669.14 + 62507.8 - 27431.81, 2)).toBe(390555.22);
    expect(quantizeDecimal(-noisy, 2)).toBe(-455743.9);
    expect(quantizeDecimal(1200.0000000000002, -2)).toBe(1200);
  });

  // Seeded so a failure reproduces. Every sum of cent amounts must quantize to
  // exactly the double nearest its exact integer-cent total.
  it('agrees with exact integer-cent arithmetic for sums of cent amounts', () => {
    let seed = 0x2f6e2b1;
    const next = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed;
    };
    const mismatches: string[] = [];
    for (let trial = 0; trial < 20000; trial++) {
      const terms = 2 + (next() % 9);
      let cents = 0;
      let sum = 0;
      for (let t = 0; t < terms; t++) {
        const c = (next() % 100_000_000) * (next() % 3 === 0 ? -1 : 1);
        cents += c;
        sum += c / 100;
      }
      const got = quantizeDecimal(sum, 2);
      if (got !== cents / 100) mismatches.push(`${sum} -> ${got}, want ${cents / 100}`);
    }
    expect(mismatches.slice(0, 5)).toEqual([]);
  });

  it('returns magnitudes past 2^53 unchanged — no fractional part remains', () => {
    expect(quantizeDecimal(1e21, 2)).toBe(1e21);
    expect(quantizeDecimal(-1e21, 2)).toBe(-1e21);
    expect(quantizeDecimal(Number.MAX_SAFE_INTEGER, 0)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('refuses decimals outside the representable band', () => {
    expect(() => quantizeDecimal(1, 1.5)).toThrow(CalcError);
    expect(() => quantizeDecimal(1, MAX_ROUND_TO + 1)).toThrow(/decimals must be an integer/);
    expect(() => quantizeDecimal(1, -MAX_ROUND_TO - 1)).toThrow(CalcError);
  });

  it('refuses non-finite input rather than emitting an unserializable value', () => {
    // canonicalizeExact throws on non-finite numbers, so catching it here keeps
    // the failure at the boundary that can name the calculation.
    expect(() => quantizeDecimal(Number.POSITIVE_INFINITY, 2)).toThrow(/non-finite/);
    expect(() => quantizeDecimal(Number.NaN, 2)).toThrow(/non-finite/);
  });
});

describe('resolveRoundTo', () => {
  it('prefers an explicit round_to over the unit default', () => {
    expect(resolveRoundTo({ unit: '$', round_to: 0 })).toBe(0);
    expect(resolveRoundTo({ unit: '%', round_to: 2 })).toBe(2);
  });

  it('falls back to the normative unit table', () => {
    expect(resolveRoundTo({ unit: '$' })).toBe(2);
    expect(resolveRoundTo({ unit: '%' })).toBe(6);
    expect(resolveRoundTo({ unit: 'x' })).toBe(4);
    expect(DEFAULT_ROUND_TO_BY_UNIT).toEqual({ $: 2, '%': 6, x: 4 });
  });

  it('is total — an absent or unregistered unit still resolves', () => {
    expect(resolveRoundTo({})).toBe(DEFAULT_ROUND_TO);
    expect(resolveRoundTo({ unit: 'units' })).toBe(DEFAULT_ROUND_TO);
    expect(resolveRoundTo({ unit: 'bps' })).toBe(DEFAULT_ROUND_TO);
  });

  it('treats round_to: 0 as stated, not as absent', () => {
    // A falsy-check bug here would silently promote dollars to 2 decimals.
    expect(resolveRoundTo({ unit: '$', round_to: 0 })).toBe(0);
  });
});
