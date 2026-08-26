// The Protocol §XIII size-intensive registry (RFC 0027): the per-class
// selection table, its agreement with the calc packs, and resolveDealSize.

import { describe, expect, it } from 'vitest';
import { SIZE_INTENSIVES, getSizeIntensive, resolveDealSize } from './protocol.js';
import { getPackForAssetClass } from './packs/index.js';
import type { ParsedUWFile, UWBlock } from './types.js';

const REGISTERED_CLASSES = [
  'multifamily', 'office', 'industrial', 'retail', 'self_storage',
  'hospitality', 'student_housing', 'senior_housing', 'land',
] as const;

function block(section: string, content: Record<string, unknown>): UWBlock {
  return {
    annotation: { section },
    content,
    meta: {
      section, version: 1, superseded: false, source: 'manual', agent_id: null, agent_version: null,
      actor: 'test', timestamp: '2026-08-25T00:00:00Z', confidence: 'high', human_review_required: false,
      flags: [], input_hash: null, notes: null,
    },
    prose: '', rawJson: JSON.stringify(content), lineStart: 1, lineEnd: 1,
  };
}

function file(sections: Record<string, UWBlock>, assetClass?: string): ParsedUWFile {
  return {
    frontmatter: (assetClass ? { asset_class: assetClass } : {}) as ParsedUWFile['frontmatter'],
    sections, prose: {}, pipeline_log: [], custom_calculations: [], custom_scenarios: [],
    extensions: {}, superseded: {}, raw: '',
  };
}

describe('SIZE_INTENSIVES — the §XIII table', () => {
  it('covers exactly the nine classes with a property-level size', () => {
    expect(Object.keys(SIZE_INTENSIVES).sort()).toEqual([...REGISTERED_CLASSES].sort());
  });

  it('mixed_use has no entry (§XIII.2) and an unrecognized class none (§XIII.3)', () => {
    expect(getSizeIntensive('mixed_use')).toBeNull();
    expect(getSizeIntensive('data_center')).toBeNull();
    expect(getSizeIntensive('')).toBeNull();
  });

  it('every entry carries a path, label, unit, and secondary list', () => {
    for (const cls of REGISTERED_CLASSES) {
      const entry = getSizeIntensive(cls);
      expect(entry, cls).not.toBeNull();
      expect(entry!.path.length, cls).toBeGreaterThan(0);
      expect(entry!.label.length, cls).toBeGreaterThan(0);
      expect(entry!.unit.length, cls).toBeGreaterThan(0);
      expect(Array.isArray(entry!.secondary), cls).toBe(true);
    }
  });
});

describe('SIZE_INTENSIVES — agreement with the calc packs', () => {
  // §XIII.1 defines the primary as the denominator the class's pack uses, so
  // the registry may never drift from the packs. This is a coverage assertion,
  // not an equality: senior and student housing each state a secondary count
  // their pack never divides by, which is legitimate.
  it('each class\'s primary path appears in its pack\'s formulas', () => {
    for (const cls of REGISTERED_CLASSES) {
      const pack = getPackForAssetClass(cls);
      expect(pack, cls).not.toBeNull();
      const source = JSON.stringify(pack);
      const primary = SIZE_INTENSIVES[cls]!.path;
      expect(source, `${cls} pack must divide by property.${primary}`).toContain(
        `property.${primary}`,
      );
    }
  });

  it('every size path a pack reads is that class\'s primary or a secondary', () => {
    for (const cls of REGISTERED_CLASSES) {
      const entry = SIZE_INTENSIVES[cls]!;
      const known = new Set([entry.path, ...entry.secondary]);
      const source = JSON.stringify(getPackForAssetClass(cls));
      const sizePaths = [...source.matchAll(/property\.([a-z_]+)/g)].map((m) => m[1]!);
      for (const p of new Set(sizePaths)) {
        expect(known.has(p), `${cls} pack reads property.${p}, missing from its registry entry`).toBe(true);
      }
    }
  });
});

describe('resolveDealSize', () => {
  it('selects through the registry, not total_units', () => {
    const hotel = file(
      { property: block('property', { total_units: 999, keys: 142 }) },
      'hospitality',
    );
    expect(resolveDealSize(hotel)).toEqual({
      basis: 'keys', label: 'Keys', unit: 'keys', quantity: 142,
    });
  });

  it('returns the multifamily unit count unchanged', () => {
    const mf = file({ property: block('property', { total_units: 48 }) }, 'multifamily');
    expect(resolveDealSize(mf)).toEqual({
      basis: 'total_units', label: 'Units', unit: 'units', quantity: 48,
    });
  });

  it('is null for mixed_use — a bed and a square foot do not add (§XIII.2)', () => {
    const mu = file({ property: block('property', { total_units: 60 }) }, 'mixed_use');
    expect(resolveDealSize(mu)).toBeNull();
  });

  it('is null without a property section, an asset class, or a numeric value', () => {
    expect(resolveDealSize(file({}, 'office'))).toBeNull();
    expect(resolveDealSize(file({ property: block('property', { keys: 10 }) }))).toBeNull();
    expect(
      resolveDealSize(file({ property: block('property', { keys: null } as Record<string, unknown>) }, 'hospitality')),
    ).toBeNull();
    expect(
      resolveDealSize(file({ property: block('property', { keys: '142' } as Record<string, unknown>) }, 'hospitality')),
    ).toBeNull();
  });

  it('reads the raw document, never a default — a stated size only', () => {
    // RFC 0027 unresolved question 4: a deal's size is a fact about the
    // asset. An office document that never states RSF resolves to null even
    // though class defaults exist for other fields.
    const office = file({ property: block('property', { year_built: 1990 }) }, 'office');
    expect(resolveDealSize(office)).toBeNull();
  });
});
