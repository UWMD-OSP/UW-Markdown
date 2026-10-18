import { describe, expect, it } from 'vitest';
import * as W from './words.js';

describe('pinned binary64 and word operations', () => {
  it('preserves complete normal, subnormal, zero and infinity words', () => {
    for (const word of ['0000000000000000', '8000000000000000', '0000000000000001',
      '0010000000000000', '7fefffffffffffff', '7ff0000000000000', 'fff0000000000000']) {
      const value = W.fromBits(word);
      expect(W.toBits(value)).toBe(word);
      expect(W.toBits(W.fromWords(W.hi(value), W.lo(value)))).toBe(word);
      expect(W.toBits(W.withHi(value, W.hu(value)))).toBe(word);
      expect(W.toBits(W.withLo(value, W.lo(value)))).toBe(word);
    }
    expect(W.hi(-0)).toBe(-2147483648);
    expect(W.hu(-0)).toBe(2147483648);
    expect(W.lo(W.fromBits('3ff0000000000001'))).toBe(1);
  });
  it('pins modulo arithmetic, sign shifts and the explicit count32 rule', () => {
    expect(W.s32(0xffffffff)).toBe(-1); expect(W.u32(-1)).toBe(0xffffffff);
    expect(W.add32(0x7fffffff, 1)).toBe(-2147483648);
    expect(W.sub32(-2147483648, 1)).toBe(2147483647);
    expect(W.uadd32(0xffffffff, 1)).toBe(0); expect(W.usub32(0, 1)).toBe(0xffffffff);
    expect(W.shl(-1, 0)).toBe(-1); expect(W.shl(-1, 32)).toBe(0);
    expect(W.sar(-1, 32)).toBe(-1); expect(W.sar(1, 32)).toBe(0);
    expect(W.shr(-1, 0)).toBe(0xffffffff); expect(W.shr(-1, 32)).toBe(0);
    expect(W.sar(-8, 1)).toBe(-4); expect(W.shl(1, 31)).toBe(-2147483648);
  });
  it('refuses invalid internal word APIs rather than coerce or mask them', () => {
    for (const count of [-1, 33, 1.5, NaN]) {
      expect(() => W.shl(1, count)).toThrow(RangeError);
      expect(() => W.sar(1, count)).toThrow(RangeError);
      expect(() => W.shr(1, count)).toThrow(RangeError);
    }
    for (const bad of ['', 'FFFFFFFFFFFFFFFF', '0', 'gggggggggggggggg']) {
      expect(() => W.fromBits(bad)).toThrow(RangeError);
    }
    expect(() => W.toBits(null as unknown as number)).toThrow(TypeError);
    for (const bad of [-2147483649, 2147483648, 1.5, NaN]) expect(() => W.signedInt(bad)).toThrow(RangeError);
    expect(W.signedInt(-2147483648)).toBe(-2147483648);
    expect(W.signedInt(2147483647)).toBe(2147483647);
  });
});
