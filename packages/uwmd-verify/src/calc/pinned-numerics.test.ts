import { describe, expect, it, vi } from 'vitest';
import { CalcError } from './errors.js';
import { pinnedPow, pinnedExp, pinnedLog } from './pinned-numerics.js';
import * as api from '../index.js';
import * as browser from '../browser.js';

describe('public pinned primitive boundary', () => {
  it('exports the same functions through the package and browser entries', () => {
    for (const entry of [api, browser]) {
      expect(entry.pinnedPow).toBe(pinnedPow);
      expect(entry.pinnedExp).toBe(pinnedExp);
      expect(entry.pinnedLog).toBe(pinnedLog);
    }
  });
  it('uses one procedure for integral, fractional and negative powers', () => {
    expect(pinnedPow(-2, 3)).toBe(-8);
    expect(pinnedPow(4, .5)).toBe(2);
    expect(pinnedPow(2, -1074)).toBe(Number.MIN_VALUE);
    expect(Object.is(pinnedPow(-0, 3), -0)).toBe(true);
    expect(pinnedPow(Number.NaN, 0)).toBe(1);
    expect(pinnedPow(-4, .5)).toBeNaN();
  });
  it('preserves raw IEEE outcomes without quantization or intermediate refusal', () => {
    expect(pinnedExp(0)).toBe(1); expect(pinnedExp(Number.NEGATIVE_INFINITY)).toBe(0);
    expect(pinnedExp(1000)).toBe(Number.POSITIVE_INFINITY); expect(pinnedExp(Number.NaN)).toBeNaN();
    expect(pinnedLog(1)).toBe(0); expect(pinnedLog(0)).toBe(Number.NEGATIVE_INFINITY);
    expect(pinnedLog(-1)).toBeNaN(); expect(pinnedLog(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
    expect(pinnedPow(-0, -3)).toBe(Number.NEGATIVE_INFINITY);
    expect(1 / pinnedPow(1e155, 2)).toBe(0);
  });
  it('never delegates to a host transcendental', () => {
    const fail = () => { throw new Error('host transcendental reached'); };
    const spies = ['pow', 'exp', 'log', 'sqrt'].map(name => vi.spyOn(Math, name as 'pow').mockImplementation(fail));
    try {
      expect(pinnedPow(4, .5)).toBe(2); expect(pinnedPow(2, -3)).toBe(.125);
      expect(pinnedExp(0)).toBe(1); expect(pinnedLog(1)).toBe(0);
    } finally { spies.forEach(spy => spy.mockRestore()); }
  });
  it('rejects nonnumbers without invoking coercion', () => {
    let coerced = false;
    const object = { valueOf() { coerced = true; return 2; } };
    for (const value of [null, undefined, true, '2', object]) {
      const bad = value as unknown as number;
      expect(() => pinnedPow(bad, 2)).toThrow(CalcError);
      expect(() => pinnedPow(2, bad)).toThrow(CalcError);
      expect(() => pinnedExp(bad)).toThrow(CalcError);
      expect(() => pinnedLog(bad)).toThrow(CalcError);
    }
    expect(coerced).toBe(false);
  });
});
