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
  BUILTIN_REMEDIATIONS,
  VALIDATOR_CODE_FAMILIES,
  validatorCodeFamily,
  ACTOR_NAMESPACES,
  ACTOR_SOURCE_RE,
  parseActorSource,
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
    expect(PROTOCOL_VERSION).toBe('1.12.0');
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


describe('validator code families (§III.6a, RFC 0030)', () => {
  it('registers a family for every code in BUILTIN_REMEDIATIONS', () => {
    // The check that keeps §III.6a from going stale a second time. It once said
    // every code belonged to one of three families while the registry emitted
    // eighteen, and nothing noticed because the list lived in prose.
    const orphans = BUILTIN_REMEDIATIONS.map((r) => r.code).filter(
      (code) => validatorCodeFamily(code) === null,
    );
    expect(orphans).toEqual([]);
  });

  it('resolves by longest prefix, so a specific family beats a general one', () => {
    expect(validatorCodeFamily('CS-01')?.prefix).toBe('CS');
    expect(validatorCodeFamily('CS-WATERFALL-UNSUPPORTED')?.prefix).toBe('CS');
    expect(validatorCodeFamily('INVALID-ASSET-CLASS-001')?.prefix).toBe('INVALID-ASSET-CLASS');
  });

  it('matches a bare code with no suffix', () => {
    // UNSUPPORTED_YAML_FEATURE carries no numeric suffix; prefix-plus-dash
    // matching alone would orphan it.
    expect(validatorCodeFamily('UNSUPPORTED_YAML_FEATURE')?.capabilities).toEqual(['parse']);
  });

  it('does not match a code that merely starts with the same letters', () => {
    // 'CCX-01' is not a CC code. Without the dash boundary it would be.
    expect(validatorCodeFamily('CCX-01')).toBeNull();
  });

  it('names only capabilities that exist on the manifest type', () => {
    const claimed = new Set(REFERENCE_IMPLEMENTATION_MANIFEST.capabilities ?? []);
    for (const family of VALIDATOR_CODE_FAMILIES) {
      for (const capability of family.capabilities) {
        // The reference implementation claims everything, so any capability a
        // family names must appear there — a typo would otherwise sit unnoticed
        // until a host tried to claim the family.
        expect(claimed).toContain(capability);
      }
    }
  });

  it('owns INT and POL away from a read-only reader', () => {
    // The two families the first external adopter could not implement. If these
    // ever become unconditional, a reader-only host stops being conformant.
    expect(validatorCodeFamily('INT-01')?.capabilities).toEqual(['integrity']);
    expect(validatorCodeFamily('POL-02')?.capabilities).toEqual(['edit-replace', 'edit-supersede']);
  });
});

// ─── RFC 0031: actor grammar for _meta.source ────────────────────────────────

describe('parseActorSource (RFC 0031)', () => {
  it('accepts manual and every registered namespace', () => {
    expect(parseActorSource('manual')).toEqual({ kind: 'manual' });
    expect(parseActorSource('agent/L6-01')).toEqual({
      kind: 'namespaced', namespace: 'agent', id: 'L6-01',
    });
    expect(parseActorSource('document/rent_roll')).toEqual({
      kind: 'namespaced', namespace: 'document', id: 'rent_roll',
    });
    expect(parseActorSource('system/init')).toEqual({
      kind: 'namespaced', namespace: 'system', id: 'init',
    });
    expect(parseActorSource('institution/threshold-override')).toEqual({
      kind: 'namespaced', namespace: 'institution', id: 'threshold-override',
    });
    // Dots are legal id characters — `system/calculations.ts` is a real actor
    // the corpus migration produces.
    expect(parseActorSource('system/calculations.ts')).toEqual({
      kind: 'namespaced', namespace: 'system', id: 'calculations.ts',
    });
  });

  it('rejects everything outside the grammar as invalid, never as an actor', () => {
    for (const source of [
      'agent:L0-01',            // the retired format-§2.6 colon form
      'engine:calculations.ts', // ditto
      'user',                   // bare word
      'wizard',
      'market_data',            // a resolution tag in the actor field
      'ai_extracted',
      'alien/xyz',              // unregistered namespace
      'agent/',                 // empty id
      'agent/-leading-dash',    // id must start alphanumeric
      'Agent/L6',               // namespace is case-sensitive
      '',
    ]) {
      expect(parseActorSource(source).kind, source).toBe('invalid');
    }
  });

  it('agrees with ACTOR_SOURCE_RE on every probe', () => {
    // Two spellings of one grammar (the regex is what the JSON Schema
    // mirrors); they must never diverge.
    const probes = [
      'manual', 'agent/L6-01', 'document/rent_roll', 'system/uwmd',
      'institution/x', 'agent:L0-01', 'market_data', 'user', 'alien/xyz',
      'agent/', 'Agent/L6', '', 'system/calculations.ts',
    ];
    for (const p of probes) {
      expect(ACTOR_SOURCE_RE.test(p), p).toBe(parseActorSource(p).kind !== 'invalid');
    }
  });

  it('registers every namespace exactly once', () => {
    expect([...ACTOR_NAMESPACES]).toEqual(['agent', 'document', 'system', 'institution']);
  });
});

describe('SRC code family (RFC 0031)', () => {
  it('registers SRC under the validate capability', () => {
    expect(validatorCodeFamily('SRC-01')?.prefix).toBe('SRC');
    expect(validatorCodeFamily('SRC-01')?.capabilities).toEqual(['validate']);
  });

  it('ships remediation copy for SRC-01 and SRC-02', () => {
    const codes = BUILTIN_REMEDIATIONS.filter((r) => r.code.startsWith('SRC-'));
    expect(codes.map((r) => r.code).sort()).toEqual(['SRC-01', 'SRC-02']);
    for (const r of codes) expect(r.severity).toBe('warning');
  });
});
