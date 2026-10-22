// The reference implementation's manifest (moved from protocol.test.ts with
// the manifest itself, RFC 0083).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import {
  CONFORMANCE_PROFILES,
  FORMAT_VERSION,
  PROTOCOL_VERSION,
  VALIDATOR_CODE_FAMILIES,
  VERIFIER_OBLIGATION_CAPABILITIES,
} from '@uwmd/verify';
import { REFERENCE_IMPLEMENTATION_MANIFEST } from './reference-implementation.js';
import { CORE_VERSION } from './version.js';

const repoFile = (path: string) => readFileSync(fileURLToPath(new URL(`../../../${path}`, import.meta.url)), 'utf8');

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

  it('claims the Protocol 3.0 Verifier tier with every profile (RFC 0078)', () => {
    // The reference implements every stated-figure verifier and every optional
    // profile. Editing is a starter-product capability now, not a tier.
    expect(REFERENCE_IMPLEMENTATION_MANIFEST.tier).toBe('verifier');
    expect(REFERENCE_IMPLEMENTATION_MANIFEST.profiles).toEqual([...CONFORMANCE_PROFILES]);
    expect(REFERENCE_IMPLEMENTATION_MANIFEST.capabilities).toEqual(
      expect.arrayContaining(['edit-supersede', 'render-chat']),
    );
  });

  it('claims every Verifier obligation flag its tier requires (RFC 0115, §II.5)', () => {
    expect(REFERENCE_IMPLEMENTATION_MANIFEST.capabilities).toEqual(
      expect.arrayContaining([...VERIFIER_OBLIGATION_CAPABILITIES]),
    );
  });

  it('does not claim agent hosting, which the toolkit no longer performs', () => {
    // RFC 0112 removed the `agent-host` capability from the vocabulary; this
    // implementation runs no agent, so it cannot claim it either.
    expect(REFERENCE_IMPLEMENTATION_MANIFEST.capabilities).not.toContain('agent-host');
  });
});

describe('the reference manifest and the normative schema', () => {
  const schema = JSON.parse(repoFile('spec/schemas/implementation-manifest.schema.json'));
  const validate = new Ajv2020({ strict: false, validateFormats: false }).compile(schema);

  it('the reference manifest validates against the normative schema', () => {
    // The mirror had drifted: protocol.ts claimed calc-cash-flow and
    // portfolio-relationships, which the schema's capability enum lacked, so
    // the reference implementation's own `uwmd manifest` output was invalid.
    expect(validate(REFERENCE_IMPLEMENTATION_MANIFEST), JSON.stringify(validate.errors)).toBe(true);
  });

  it('refuses a Verifier tier claim that omits an obligation flag (RFC 0115 D2)', () => {
    for (const omitted of VERIFIER_OBLIGATION_CAPABILITIES) {
      const partial = {
        ...REFERENCE_IMPLEMENTATION_MANIFEST,
        capabilities: REFERENCE_IMPLEMENTATION_MANIFEST.capabilities!.filter((c) => c !== omitted),
      };
      expect(validate(partial), omitted).toBe(false);
      // The same capabilities without a tier are an honest partial claim.
      const { tier: _tier, ...untiered } = partial;
      expect(validate(untiered), omitted).toBe(true);
    }
    // An absent or empty list claims every capability (§II.6a.5).
    const { capabilities: _capabilities, ...claimsAll } = REFERENCE_IMPLEMENTATION_MANIFEST;
    expect(validate(claimsAll)).toBe(true);
    expect(validate({ ...REFERENCE_IMPLEMENTATION_MANIFEST, capabilities: [] })).toBe(true);
  });
});

describe('the reference manifest and the validator code families', () => {
  it('claims every capability a code family names', () => {
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
});
