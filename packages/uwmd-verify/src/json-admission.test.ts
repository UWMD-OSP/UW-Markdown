import { describe, expect, it } from 'vitest';
import { assertJSONValue, snapshotJSONValue } from './json-admission.js';

describe('JSON model descriptor admission', () => {
  it('refuses unsupported hidden members, accessors and array extras without getter calls', () => {
    let calls = 0;
    for (const value of [Object.defineProperty({}, 'x', { value: undefined }),
      Object.defineProperty({}, 'x', { value: () => 1 }),
      Object.defineProperty({}, 'x', { get() { calls++; return 1; } }),
      Object.assign([], { extra: 1 }), Array(1), [undefined], { x: Symbol('synthetic') }]) {
      expect(() => assertJSONValue(value)).toThrow(/JSON/);
    }
    expect(calls).toBe(0);
  });
  it('snapshots plain/frozen JSON and preserves null, negative zero and unusual own names', () => {
    const value = Object.freeze({ x: Object.freeze([null, -0, Object.freeze({ '': true })]) });
    const copy = snapshotJSONValue(value);
    expect(copy).toEqual(value); expect(copy).not.toBe(value); expect(copy.x).not.toBe(value.x);
    expect(Object.is(copy.x[1], -0)).toBe(true);
  });
});
