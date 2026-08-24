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
  ASSET_CLASSES,
  NUMERIC_SECTION_FIELDS,
} from './catalog.js';
import {
  ASSET_CLASSES as CORE_ASSET_CLASSES,
  getPackForAssetClass,
} from '@uwmd/core/browser';

describe('catalog — asset classes have not drifted from the format', () => {
  it('offers exactly the asset classes the format defines', () => {
    // The editor keeps its own ordered list because the dropdown's order is a
    // presentation choice core has no opinion on. The *set* is not a choice:
    // an entry missing here silently makes a valid asset class unselectable,
    // and an extra one offers a class no pack or defaults table can serve.
    // Compared as sets so the editor stays free to reorder.
    expect([...ASSET_CLASSES].sort()).toEqual([...CORE_ASSET_CLASSES].sort());
  });
});

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

  it('reads and writes through numeric array indices (the DCF per-year path form)', () => {
    const obj: Record<string, unknown> = { rows: [{ noi: 100 }, { noi: 200 }] };
    expect(deepGet(obj, 'rows.1.noi')).toBe(200);
    deepSet(obj, 'rows.0.levered', 60);
    expect((obj.rows as Array<Record<string, unknown>>)[0]).toEqual({ noi: 100, levered: 60 });
    // The array stays an array — index assignment must not turn it into an object.
    expect(Array.isArray(obj.rows)).toBe(true);
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
    // property keeps a flat numeric grid (total_units, year_built, …); the
    // calc-bearing sections like dcf are owned by footed model surfaces instead.
    const fields = fieldsForSection('property');
    expect(fields.length).toBeGreaterThan(0);
    expect(fields.every((f) => f.section_id === 'property')).toBe(true);
  });

  it('returns an empty list for a section with no editable numeric fields', () => {
    expect(fieldsForSection('no_such_section')).toEqual([]);
  });

  it('offers each class its own size intensive and not another class’s', () => {
    const paths = (id: string, cls: string) => fieldsForSection(id, cls).map((f) => f.path);

    expect(paths('property', 'office')).toContain('rentable_square_feet');
    expect(paths('property', 'office')).not.toContain('total_units');
    expect(paths('property', 'land')).toEqual(
      expect.arrayContaining(['gross_acres', 'usable_acres', 'entitled_units']),
    );
    expect(paths('property', 'land')).not.toContain('total_units');
    expect(paths('property', 'hospitality')).toContain('keys');
    expect(paths('property', 'student_housing')).toContain('total_beds');
    expect(paths('property', 'self_storage')).toEqual(
      expect.arrayContaining(['net_rentable_square_feet', 'rentable_units']),
    );
    expect(paths('property', 'retail')).toContain('gross_leasable_area');
  });

  it('keeps class-independent fields in every class’s grid', () => {
    for (const cls of ASSET_CLASSES) {
      const paths = fieldsForSection('property', cls).map((f) => f.path);
      expect(paths).toContain('year_built');
      expect(paths).toContain('parking_spaces');
    }
  });

  it('falls back to the full list when the class is unset, unknown, or mixed', () => {
    // Opt-out by design: showing a spare input is a smaller harm than hiding
    // one the analyst needs, and a mixed-use record may carry any use's
    // intensive. Anything filtered out is still reachable in the generic
    // all-fields editor.
    const all = fieldsForSection('property').map((f) => f.path);
    expect(all.length).toBe(NUMERIC_SECTION_FIELDS.filter((f) => f.section_id === 'property').length);
    expect(fieldsForSection('property', '').map((f) => f.path)).toEqual(all);
    expect(fieldsForSection('property', 'spaceport').map((f) => f.path)).toEqual(all);
    expect(fieldsForSection('property', 'mixed_use').map((f) => f.path)).toEqual(all);
  });

  it('offers every property field its class’s calc pack actually reads', () => {
    // The invariant that matters: the quick-edit grid must never omit an input
    // the metric strip divides by. (The converse is not required — senior
    // housing states beds alongside the units its pack uses.)
    let checked = 0;
    for (const cls of ASSET_CLASSES) {
      const pack = getPackForAssetClass(cls);
      if (!pack) continue;
      const read = new Set<string>();
      for (const calc of pack.calculations ?? []) {
        for (const m of calc.formula.matchAll(/\bproperty\.([a-z_]+)/g)) read.add(m[1]);
      }
      const offered = new Set(fieldsForSection('property', cls).map((f) => f.path));
      for (const path of read) {
        expect(
          offered.has(path),
          `${cls}: pack reads property.${path} but the ${cls} field grid does not offer it`,
        ).toBe(true);
        checked += 1;
      }
    }
    // Guards the loop against passing vacuously if the packs stop naming
    // property paths (or the formula scan silently stops matching).
    expect(checked).toBeGreaterThanOrEqual(8);
  });

  it('maps known section ids to display names and falls back to the id', () => {
    expect(displayName('rent_roll')).toBe('Rent Roll');
    expect(displayName('totally_unknown')).toBe('totally_unknown');
  });
});
