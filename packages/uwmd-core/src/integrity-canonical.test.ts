import { describe, expect, it } from 'vitest';
import { canonicalize, canonicalizeExact } from './integrity-canonical.js';

describe('canonicalize — RFC 8785 (JCS) with uwmd exclusions', () => {
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

  it('strips _meta.content_hash and _meta.signature from meta-shaped sub-objects', () => {
    const meta = {
      section: 'property',
      version: 1,
      source: 'manual',
      content_hash: 'deadbeef',
      signature: 'sig...',
      actor: 'tester',
    };
    const out = canonicalize({ _meta: meta, content: { x: 1 } });
    expect(out).not.toContain('content_hash');
    expect(out).not.toContain('signature');
    expect(out).toContain('"actor":"tester"');
  });

  it('does NOT strip content_hash from non-meta objects', () => {
    const out = canonicalize({ payload: { content_hash: 'abc' } });
    expect(out).toBe('{"payload":{"content_hash":"abc"}}');
  });
});

describe('canonicalizeExact', () => {
  it('preserves integrity fields for document-level semantic digests', () => {
    const value = { _meta: { section: 'x', version: 1, source: 'manual', content_hash: 'abc' } };
    expect(canonicalizeExact(value)).toContain('content_hash');
    expect(canonicalize(value)).not.toContain('content_hash');
  });
});