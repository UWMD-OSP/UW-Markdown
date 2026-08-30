import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BUILTIN_INCOMPLETE_DATA_POLICIES,
  CASCADE_ORDER,
  SOURCE_TAGS,
  lookupIncompleteDataPolicy,
  PROTOCOL_VERSION,
  FORMAT_VERSION,
  REFERENCE_IMPLEMENTATION_MANIFEST,
} from './protocol.js';
import { CORE_VERSION } from './version.js';

describe('protocol — CASCADE_ORDER', () => {
  it('lists exactly the eight cascade steps in the documented order', () => {
    // Seven until RFC 0021 §5 inserted `inherited_assumption` at protocol
    // 1.5.0. Its position is load-bearing in both directions: below
    // `user_input`, so a value entered on the deal always beats an inherited
    // default; above `investor_profile`, because a named ancestor in this
    // deal's composition DAG is more specific than an institution-wide
    // preference set.
    expect([...CASCADE_ORDER]).toEqual([
      'user_override',
      'user_input',
      'inherited_assumption',
      'investor_profile',
      'market_data',
      'asset_class_default',
      'global_default',
      'system_default',
    ]);
  });

  it('every cascade step is present in SOURCE_TAGS', () => {
    for (const step of CASCADE_ORDER) {
      expect(SOURCE_TAGS).toContain(step);
    }
  });
});

describe('protocol — lookupIncompleteDataPolicy', () => {
  it('returns null when no policy matches', () => {
    expect(lookupIncompleteDataPolicy('not-a-section', undefined, 'scope')).toBeNull();
  });

  it('matches section + stage', () => {
    const p = lookupIncompleteDataPolicy('rent_roll', undefined, 'scope');
    expect(p?.action.kind).toBe('substitute');
  });

  it('returns halt for full_underwrite rent_roll', () => {
    const p = lookupIncompleteDataPolicy('rent_roll', undefined, 'full_underwrite');
    expect(p?.action.kind).toBe('halt');
  });

  it('field-specific policy beats section-level when both match', () => {
    const p = lookupIncompleteDataPolicy('noi_model', 'expense_ratio', 'scope');
    expect(p?.field_path).toBe('expense_ratio');
    expect(p?.action.kind).toBe('substitute');
  });

  it('section-level policy still applies when no field-specific match exists', () => {
    const p = lookupIncompleteDataPolicy('noi_model', 'some_other_field', 'scope');
    expect(p?.field_path).toBeUndefined();
    expect(p?.action.kind).toBe('substitute');
  });

  it('explicit stage match wins over wildcard stage', () => {
    const policies = [
      { section: 'foo', action: { kind: 'defer' as const } },
      { section: 'foo', stage: 'scope' as const, action: { kind: 'halt' as const } },
    ];
    const hit = lookupIncompleteDataPolicy('foo', undefined, 'scope', policies);
    expect(hit?.action.kind).toBe('halt');
  });

  it('all builtin policies reference a real section name', () => {
    for (const p of BUILTIN_INCOMPLETE_DATA_POLICIES) {
      expect(p.section.length).toBeGreaterThan(0);
    }
  });
});

describe('protocol — version', () => {
  it('publishes the current protocol version', () => {
    expect(PROTOCOL_VERSION).toBe('1.8.0');
  });

  it('agrees with the compatibility matrix in VERSIONS.md', () => {
    // Invariant 7 is that spec, schema, and protocol move in lockstep, and a
    // bare pin above does not enforce it — the pin's own name said "1.2" while
    // it asserted "1.3.0", which is exactly the drift it was meant to catch.
    // VERSIONS.md is the authoritative matrix, so read it.
    const versions = readFileSync(resolve(__dirname, '../../../VERSIONS.md'), 'utf8');
    const row = versions.match(/^\|\s*UW Protocol\s*\|\s*\*\*([0-9]+\.[0-9]+\.[0-9]+)\*\*/m);
    expect(row?.[1]).toBe(PROTOCOL_VERSION);
  });

  it('agrees with the @uwmd/core row in VERSIONS.md too', () => {
    // The protocol pin above did not cover this row, and it silently went stale
    // through the 1.4.0 release: the matrix still read 1.3.0 while the package
    // manifest said 1.4.0. Same lockstep invariant, so same treatment.
    const versions = readFileSync(resolve(__dirname, '../../../VERSIONS.md'), 'utf8');
    const row = versions.match(/^\|\s*`@uwmd\/core`\s*\|\s*\*\*([0-9]+\.[0-9]+\.[0-9]+)\*\*/m);
    expect(row?.[1]).toBe(CORE_VERSION);
  });
});
describe('REFERENCE_IMPLEMENTATION_MANIFEST', () => {
  it('reports the versions this build actually is', () => {
    expect(REFERENCE_IMPLEMENTATION_MANIFEST.protocol_version).toBe(PROTOCOL_VERSION);
    expect(REFERENCE_IMPLEMENTATION_MANIFEST.format_version).toBe(FORMAT_VERSION);
    expect(REFERENCE_IMPLEMENTATION_MANIFEST.version).toBe(CORE_VERSION);
  });

  it('claims every capability the spec tells implementations to declare', () => {
    // §V.11.5 and §X.1.4 name these two by hand. A spec that instructs
    // implementations to declare a capability, against a type that has no such
    // member, is a promise nothing can keep.
    expect(REFERENCE_IMPLEMENTATION_MANIFEST.capabilities).toContain('signing');
    expect(REFERENCE_IMPLEMENTATION_MANIFEST.capabilities).toContain(
      'module-signature-verification',
    );
  });

  it('is frozen — the conformance driver treats it as the identity under test', () => {
    expect(Object.isFrozen(REFERENCE_IMPLEMENTATION_MANIFEST)).toBe(true);
    expect(() => {
      (REFERENCE_IMPLEMENTATION_MANIFEST as { id: string }).id = 'something.else';
    }).toThrow();
  });
});
