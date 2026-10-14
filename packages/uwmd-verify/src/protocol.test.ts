// Historical tier names below are intentionally refused negative inputs.
import { describe, expect, it } from 'vitest';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BUILTIN_INCOMPLETE_DATA_POLICIES,
  lookupIncompleteDataPolicy,
  PROTOCOL_VERSION,
  FORMAT_VERSION,
  RESOLUTION_METHODS,
  SUPPORTED_FORMAT_VERSIONS,
  SUPPORTED_PROTOCOL_VERSIONS,
  CONFORMANCE_TARGETS,
  CONFORMANCE_PROFILES,
  isConformanceTier,
  BUILTIN_REMEDIATIONS,
  VALIDATOR_CODE_FAMILIES,
  validatorCodeFamily,
  ACTOR_NAMESPACES,
  ACTOR_SOURCE_RE,
  parseActorSource,
  type ProtocolErrorCategory,
} from './protocol.js';
import { validateUWDealPackageManifest } from './deal-package.js';
import { validatePortfolioProfile } from './portfolio.js';
import { VERIFY_VERSION } from './version.js';

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
  it('supports exactly one format and one protocol (RFC 0081 D1)', () => {
    expect(SUPPORTED_FORMAT_VERSIONS).toEqual(['3.0']);
    expect(SUPPORTED_PROTOCOL_VERSIONS).toEqual(['4.1.0']);
    const blockSchema = JSON.parse(readFileSync(resolve(__dirname, '../../../spec/schemas/uwmd-block.schema.json'), 'utf8'));
    expect(blockSchema.$defs.ResolutionTag.enum).toEqual([...RESOLUTION_METHODS]);
    expect(validatorCodeFamily('UNSUPPORTED_FORMAT_VERSION')?.capabilities).toEqual(['parse']);
    expect(BUILTIN_REMEDIATIONS.find(r => r.code === 'META-01')).toBeDefined();
    const spec = readFileSync(resolve(__dirname, '../../../spec/UW_PROTOCOL.md'), 'utf8');
    expect(spec).toContain(`— protocol **${SUPPORTED_PROTOCOL_VERSIONS[0]}**`);
  });
  it('publishes the current protocol version', () => {
    expect(PROTOCOL_VERSION).toBe('4.1.0');
  });

  it('labels the release with the one supported format and protocol (RFC 0081 D1)', () => {
    expect(FORMAT_VERSION).toBe(SUPPORTED_FORMAT_VERSIONS[0]);
    expect(PROTOCOL_VERSION).toBe(SUPPORTED_PROTOCOL_VERSIONS[0]);
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

  it('agrees with the @uwmd/verify row in VERSIONS.md too', () => {
    // Same lockstep invariant as the protocol row. `@uwmd/core`'s own row is
    // checked by core's version.test.ts.
    const versions = readFileSync(resolve(__dirname, '../../../VERSIONS.md'), 'utf8');
    const row = versions.match(/^\|\s*`@uwmd\/verify`\s*\|\s*\*\*([0-9]+\.[0-9]+\.[0-9]+)\*\*/m);
    expect(row?.[1]).toBe(VERIFY_VERSION);
  });
});
// ─── RFC 0078: tiers, profiles and the legacy tier mapping ───────────────────

describe('ImplementationManifest tiers and profiles (RFC 0078)', () => {
  const repoFile = (path: string) => readFileSync(fileURLToPath(new URL(`../../../${path}`, import.meta.url)), 'utf8');
  const schema = JSON.parse(repoFile('spec/schemas/implementation-manifest.schema.json'));
  const validate = new Ajv2020({ strict: false, validateFormats: false }).compile(schema);
  const LEGACY = ['tier-1-reader', 'tier-2-editor', 'tier-3-calc-host', 'tier-4-agent-host'] as const;
  const base = { id: 'org.example.verifier', name: 'Example', version: '1.0.0', protocol_version: '2.25.0', format_version: '2.0' };

  it('the schema tier and profile vocabularies mirror protocol.ts', () => {
    expect(schema.properties.tier.enum).toEqual(['reader', 'verifier']);
    expect(schema.properties.profiles.items.enum).toEqual([...CONFORMANCE_PROFILES]);
  });

  it('accepts the 3.0 tiers, with or without profiles', () => {
    expect(validate({ ...base, tier: 'reader' })).toBe(true);
    expect(validate({ ...base, tier: 'verifier', profiles: ['module', 'stochastic'] })).toBe(true);
    expect(validate({ ...base, profiles: ['integrity'] })).toBe(true);
  });

  it.each(LEGACY)('final schema refuses retired tier %s (RFC 0081)', (tier) => {
    expect(validate({ ...base, tier })).toBe(false);
  });

  it('refuses tiers and profiles outside the closed vocabularies', () => {
    expect(validate({ ...base, tier: 'tier-5-oracle' })).toBe(false);
    expect(validate({ ...base, tier: 'calc-host' })).toBe(false);
    expect(validate({ ...base, profiles: ['editor'] })).toBe(false);
    expect(validate({ ...base, profiles: ['module', 'module'] })).toBe(false);
  });

  it('recognizes exactly the two tiers, refusing every retired or unknown value', () => {
    expect(isConformanceTier('reader')).toBe(true);
    expect(isConformanceTier('verifier')).toBe(true);
    for (const tier of [...LEGACY, 'tier-5', 'Reader', '', null, undefined, 3, 'constructor', '__proto__']) {
      expect(isConformanceTier(tier)).toBe(false);
    }
  });

  it('final Protocol §II.5 admits no runtime tier aliases (RFC 0081)', () => {
    const section = repoFile('spec/UW_PROTOCOL.md').split('### II.5 Tier composition')[1]?.split('\n### ')[0] ?? '';
    expect(section).toContain('No legacy value or numeric alias is admitted');
    for (const tier of LEGACY) expect(section).not.toContain(tier);
  });

  it('names exactly the six profiles in the §II.3 table', () => {
    const section = repoFile('spec/UW_PROTOCOL.md').split('### II.3 Verification profiles')[1]?.split('\n### ')[0] ?? '';
    const profiles = [...section.matchAll(/^\| `([a-z]+)` \|/gm)].map((m) => m[1]);
    expect(profiles).toEqual([...CONFORMANCE_PROFILES]);
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
    // The schema's capability enum mirrors `ViewerCapability`, so a typo in a
    // family would otherwise sit unnoticed until a host tried to claim it.
    // `@uwmd/core`'s reference manifest claims every family capability too
    // (core's reference-implementation.test.ts).
    const schema = JSON.parse(readFileSync(fileURLToPath(new URL('../../../spec/schemas/implementation-manifest.schema.json', import.meta.url)), 'utf8'));
    const known = new Set<string>(schema.properties.capabilities.items.enum);
    for (const family of VALIDATOR_CODE_FAMILIES) {
      for (const capability of family.capabilities) {
        expect(known).toContain(capability);
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

// ─── RFC 0031: actor grammar for _meta.provenance.source ────────────────────────────────

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

  it('ships remediation copy for SRC-01 through SRC-03', () => {
    const codes = BUILTIN_REMEDIATIONS.filter((r) => r.code.startsWith('SRC-'));
    expect(codes.map((r) => r.code).sort()).toEqual(['SRC-01', 'SRC-02', 'SRC-03']);
    // Format 3.0 §2.6 makes all three errors. Until RFC 0081 Phase 4 deletes
    // the 1.x read path, the runtime still emits SRC-01/02 as warnings against
    // 1.x files; the registered severity is the highest any emission carries.
    for (const r of codes) expect(r.severity).toBe('error');
  });
});

describe('BUILTIN_REMEDIATIONS mirrors §5.3 (CC-01..CC-10)', () => {
  // Read the spec table rather than restating it. Until 2.6.2 the ten
  // cross-section entries described a quick_metrics-reconciliation draft that
  // never shipped (CC-01 "NOI mismatch" for a rule that compares rent-roll GPR
  // to the operating statement), and enrichWithRemediation attached that copy
  // to real issues. Nothing noticed because nothing compared the two.
  const specPath = fileURLToPath(new URL('../../../spec/UW_FORMAT_SPEC.md', import.meta.url));
  const spec = readFileSync(specPath, 'utf-8');
  const table = spec.slice(spec.indexOf('### 5.3 Cross-Section Consistency Checks'));
  const rows = [...table.matchAll(/^\| `(CC-\d\d)` \| (.+?) \| (.+?) \|$/gm)]
    .map((m) => ({ code: m[1]!, description: m[2]!, sections: [...m[3]!.matchAll(/`([a-z_]+)`/g)].map((s) => s[1]!) }));

  it('finds the table', () => {
    expect(rows.map((r) => r.code)).toEqual(
      Array.from({ length: 16 }, (_, i) => `CC-${String(i + 1).padStart(2, '0')}`),
    );
  });

  it('every entry names the sections its §5.3 row reads', () => {
    for (const row of rows.filter((r) => Number(r.code.slice(3)) <= 10)) {
      const entry = BUILTIN_REMEDIATIONS.find((r) => r.code === row.code);
      expect(entry, row.code).toBeDefined();
      for (const section of row.sections) {
        expect(entry!.description, `${row.code} description should name ${section}`).toContain(section);
      }
      expect(entry!.spec_ref).toBe(`§5.3 ${row.code}`);
    }
  });

  it('carries the default severity validator.ts emits', () => {
    // A hand mirror of the `severity:` literal on each rule's issues.push in
    // validator.ts. If a rule's severity moves, move it here too — the registry
    // is what renderers show next to the issue.
    const emitted: Record<string, string> = {
      'CC-01': 'warning', 'CC-02': 'warning', 'CC-03': 'error', 'CC-04': 'error', 'CC-05': 'warning',
      'CC-06': 'warning', 'CC-07': 'warning', 'CC-08': 'warning', 'CC-09': 'warning', 'CC-10': 'error',
    };
    for (const [code, severity] of Object.entries(emitted)) {
      expect(BUILTIN_REMEDIATIONS.find((r) => r.code === code)?.severity, code).toBe(severity);
    }
  });
});

// §XI and protocol-error.schema.json each describe themselves as a mirror of
// the `ProtocolError` interface. `package` (RFC 0018 deal packages) and
// `portfolio` (RFC 0015, released in 2.1.0 as a new error category) were
// emitted for releases while both mirrors still listed eight categories, so
// the reference implementation produced errors its own schema rejected. These
// tests hold the three copies, and real emitted errors, to each other.
describe('protocol — ProtocolError category lockstep (§XI)', () => {
  // Exhaustive over the union: adding or removing a member without updating
  // this map is a type error under `npm run typecheck:tests`.
  const TS_CATEGORIES: Record<ProtocolErrorCategory, true> = {
    parse: true,
    validate: true,
    render: true,
    edit: true,
    calc: true,
    agent: true,
    module: true,
    version: true,
    package: true,
    portfolio: true,
  };
  const repoFile = (path: string) => readFileSync(fileURLToPath(new URL(`../../../${path}`, import.meta.url)), 'utf8');
  const errorSchema = JSON.parse(repoFile('spec/schemas/protocol-error.schema.json'));
  const schemaCategories: string[] = errorSchema.properties.category.enum;

  it('the schema enum lists exactly the ProtocolErrorCategory members', () => {
    expect([...schemaCategories].sort()).toEqual(Object.keys(TS_CATEGORIES).sort());
  });

  it('the §XI interface lists exactly the schema enum', () => {
    const section = repoFile('spec/UW_PROTOCOL.md').split('## XI. Error Taxonomy')[1]?.split('\n## ')[0] ?? '';
    const union = section.match(/category:\s*((?:'[a-z]+'\s*\|?\s*)+),/)?.[1] ?? '';
    const specCategories = [...union.matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
    expect(specCategories.sort()).toEqual([...schemaCategories].sort());
  });

  it('package and portfolio refusals validate against the normative schema', () => {
    const ajv = new Ajv2020({ strict: false });
    const validate = ajv.compile(errorSchema);
    const emitted = [...validateUWDealPackageManifest({}), ...validatePortfolioProfile({})];
    expect(new Set(emitted.map((e) => e.category))).toEqual(new Set(['package', 'portfolio']));
    for (const error of emitted) {
      expect(validate(error), `${error.code}: ${JSON.stringify(validate.errors)}`).toBe(true);
    }
  });
});


describe('conformance corpus owners (RFC 0078 Phase 3)', () => {
  it('accepts exactly tiers, optional profiles and a separate starter owner', () => {
    expect(CONFORMANCE_TARGETS).toEqual(['reader', 'verifier', ...CONFORMANCE_PROFILES, 'starter-products']);
    expect(new Set(CONFORMANCE_TARGETS).size).toBe(CONFORMANCE_TARGETS.length);
    expect(Object.isFrozen(CONFORMANCE_TARGETS)).toBe(true);
  });
});
