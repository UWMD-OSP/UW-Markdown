import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { canonicalize } from './integrity-canonical.js';

describe('canonicalize — RFC 8785 (JCS)', () => {
  it('sorts object keys by code-unit comparison', () => {
    expect(canonicalize({ b: 1, a: 2, c: 3 })).toBe('{"a":2,"b":1,"c":3}');
  });

  it('produces identical output regardless of key insertion order', () => {
    const a = { foo: 1, bar: { y: 2, x: 1 } };
    const b = { bar: { x: 1, y: 2 }, foo: 1 };
    expect(canonicalize(a)).toBe(canonicalize(b));
  });

  it('serializes booleans, null, and integers per RFC 8785', () => {
    expect(canonicalize({ a: true, b: false, c: null, d: 0, e: -0, f: 42 })).toBe(
      '{"a":true,"b":false,"c":null,"d":0,"e":0,"f":42}',
    );
  });

  it('throws on non-finite numbers', () => {
    expect(() => canonicalize({ x: Number.NaN })).toThrow(/non-finite/);
    expect(() => canonicalize({ x: Number.POSITIVE_INFINITY })).toThrow(/non-finite/);
  });

  it('escapes JSON control characters', () => {
    expect(canonicalize({ s: 'a\nb\t"c"' })).toBe('{"s":"a\\nb\\t\\"c\\""}');
  });

  it('drops undefined object values (matches JSON.stringify)', () => {
    expect(canonicalize({ a: 1, b: undefined, c: 3 })).toBe('{"a":1,"c":3}');
  });

  it('handles arrays in document order', () => {
    expect(canonicalize([3, 1, { b: 2, a: 1 }])).toBe('[3,1,{"a":1,"b":2}]');
  });

  it('strips nothing: integrity members serialize like any other (RFC 0081 §3)', () => {
    const meta = { section: 'property', lifecycle: { revision: 1 }, provenance: { source: 'manual', actor: 'tester' }, integrity: { content_hash: 'deadbeef', signature: 'sig...' } };
    const out = canonicalize({ _meta: meta, payload: { content_hash: 'abc' } });
    expect(out).toContain('"content_hash":"deadbeef"');
    expect(out).toContain('"signature":"sig..."');
    expect(out).toContain('"payload":{"content_hash":"abc"}');
  });

  it.each(['\ud800', '\ud801', '\udbff', '\udc00', '\udfff', 'x\ud800y'])(
    'rejects unpaired surrogate strings in values and member names: %j', (value) => {
      expect(() => canonicalize(value)).toThrow(/unpaired/);
      expect(() => canonicalize({ value })).toThrow(/unpaired/);
      expect(() => canonicalize({ [value]: 1 })).toThrow(/unpaired/);
      expect(() => canonicalize([{ nested: value }])).toThrow(/unpaired/);
    },
  );

  it('preserves paired surrogates, replacement characters and NUL escaping', () => {
    expect(canonicalize({ pair: '\ud83d\ude00', replacement: '\ufffd', nul: '\u0000' }))
      .toBe('{"nul":"\\u0000","pair":"\ud83d\ude00","replacement":"\ufffd"}');
  });

  it('retains UTF-16 ordering and does not normalize valid Unicode', () => {
    expect(canonicalize({ '\ue000': 2, '\ud83d\ude00': 1 }))
      .toBe('{"\ud83d\ude00":1,"\ue000":2}');
    expect(canonicalize('\u00e9')).not.toBe(canonicalize('e\u0301'));
  });
});


describe('seeded canonicalization adversarial properties', () => {
  it('ignores object insertion order recursively while preserving arrays and every JSON value', () => {
    const reverse = (value: unknown): unknown => Array.isArray(value) ? value.map(reverse)
      : value !== null && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reverse(item)])) : value;
    fc.assert(fc.property(fc.jsonValue({ maxDepth: 3 }), value => {
      const before = JSON.stringify(value);
      expect(canonicalize(value)).toBe(canonicalize(reverse(value)));
      expect(JSON.stringify(value)).toBe(before);
    }), { seed: 128005, numRuns: 250 });
  });
  it('retains finite binary64 values through canonical JSON, including subnormals and exponent boundaries', () => {
    fc.assert(fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), value => {
      const decoded = JSON.parse(canonicalize(value)) as number;
      expect(decoded).toBe(value === 0 ? 0 : value);
    }), { seed: 128006, numRuns: 500, examples: [[Number.MIN_VALUE], [Number.MAX_VALUE], [1e-7], [1e21], [-0]] });
  });
});
