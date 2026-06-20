// Tests for the editable-field catalog's pure path/number helpers.
//
// These are UI-side conveniences (edits still go through applyEdit), but the
// wrapper-aware getNumeric/setNumeric carry the noi_model `{ value, … }`
// provenance convention — getting that wrong silently drops rationale/source,
// so it's worth pinning.

import { describe, it, expect } from 'vitest';
import {
  deepGet,
  deepSet,
  getNumeric,
  setNumeric,
  fieldsForSection,
  displayName,
} from './catalog.js';

describe('deepGet', () => {
  const obj = { a: { b: { c: 42 } }, x: 0, n: null };

  it('reads a nested path', () => {
    expect(deepGet(obj, 'a.b.c')).toBe(42);
  });

  it('reads a top-level falsy value without treating it as missing', () => {
    expect(deepGet(obj, 'x')).toBe(0);
  });

  it('returns undefined for a missing path', () => {
    expect(deepGet(obj, 'a.b.z')).toBeUndefined();
    expect(deepGet(obj, 'nope.deep.path')).toBeUndefined();
  });

  it('returns undefined when traversing through null', () => {
    expect(deepGet(obj, 'n.anything')).toBeUndefined();
  });
});

describe('deepSet', () => {
  it('sets a nested path, creating intermediate objects', () => {
    const obj: Record<string, unknown> = {};
    deepSet(obj, 'a.b.c', 7);
    expect(obj).toEqual({ a: { b: { c: 7 } } });
  });

  it('overwrites a non-object intermediate rather than throwing', () => {
    const obj: Record<string, unknown> = { a: 5 };
    deepSet(obj, 'a.b', 'x');
    expect(deepGet(obj, 'a.b')).toBe('x');
  });

  it('preserves sibling keys', () => {
    const obj: Record<string, unknown> = { a: { keep: 1 } };
    deepSet(obj, 'a.add', 2);
    expect(obj).toEqual({ a: { keep: 1, add: 2 } });
  });
});

describe('getNumeric', () => {
  it('reads a bare number', () => {
    expect(getNumeric({ noi: 1000 }, 'noi')).toBe(1000);
  });

  it('unwraps a { value, … } wrapper', () => {
    expect(getNumeric({ noi: { value: 1000, source: 'underwriter' } }, 'noi')).toBe(1000);
  });

  it('returns undefined for a non-numeric / missing field', () => {
    expect(getNumeric({ noi: 'n/a' }, 'noi')).toBeUndefined();
    expect(getNumeric({}, 'noi')).toBeUndefined();
    expect(getNumeric({ noi: { source: 'x' } }, 'noi')).toBeUndefined();
  });
});

describe('setNumeric', () => {
  it('writes a bare number when the field is bare', () => {
    const content: Record<string, unknown> = { noi: 1 };
    setNumeric(content, 'noi', 2500);
    expect(content.noi).toBe(2500);
  });

  it('updates .value and preserves siblings when the field is wrapped', () => {
    const content: Record<string, unknown> = {
      noi: { value: 1, source: 'underwriter', rationale: 'trailing-12' },
    };
    setNumeric(content, 'noi', 2500);
    expect(content.noi).toEqual({ value: 2500, source: 'underwriter', rationale: 'trailing-12' });
  });

  it('treats an array as a plain value, not a wrapper', () => {
    const content: Record<string, unknown> = { xs: [1, 2] };
    setNumeric(content, 'xs', 9);
    expect(content.xs).toBe(9);
  });
});

describe('fieldsForSection / displayName', () => {
  it('returns only the fields for the given section', () => {
    const dcf = fieldsForSection('dcf');
    expect(dcf.length).toBeGreaterThan(0);
    expect(dcf.every((f) => f.section_id === 'dcf')).toBe(true);
  });

  it('returns an empty list for a section with no editable numeric fields', () => {
    expect(fieldsForSection('no_such_section')).toEqual([]);
  });

  it('maps known section ids to display names and falls back to the id', () => {
    expect(displayName('rent_roll')).toBe('Rent Roll');
    expect(displayName('totally_unknown')).toBe('totally_unknown');
  });
});
