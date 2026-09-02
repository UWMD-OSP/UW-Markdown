// RFC 0009 — shape detection, the structural reshape (both directions), and
// the digest normalization that makes the two accepted shapes hash alike.

import { describe, expect, it } from 'vitest';
import {
  canonicalV2BlockContent,
  detectMetaShape,
  isV2File,
  reshapeMetaV1toV2,
  reshapeMetaV2toV1,
  uwVersionMajor,
} from './meta-shape.js';
import type { UWMetaV2 } from './meta-shape.js';
import { canonicalizeV2 } from './integrity-canonical.js';
import type { UWFrontmatter, UWMeta } from './types.js';

const FLAT: UWMeta = {
  section: 'rent_roll',
  version: 2,
  superseded: false,
  source: 'agent/L2-01',
  resolution: 'ai_extracted',
  agent_id: 'L2-01',
  agent_version: '1.0.0',
  actor: 'jared',
  timestamp: '2026-08-31T00:00:00Z',
  confidence: 'medium',
  human_review_required: true,
  flags: ['check_rents'],
  input_hash: null,
  notes: 'extracted from OM',
};

describe('detectMetaShape / uwVersionMajor / isV2File', () => {
  it('reads flat, nested, and absent metas', () => {
    expect(detectMetaShape(FLAT as unknown as Record<string, unknown>)).toBe('v1');
    expect(detectMetaShape(undefined)).toBe('v1');
    expect(detectMetaShape({})).toBe('v1');
    expect(
      detectMetaShape({ provenance: {}, lifecycle: { revision: 1, superseded: false } }),
    ).toBe('v2');
    // Arrays and scalars in those keys do not count.
    expect(detectMetaShape({ provenance: [], lifecycle: 'x' })).toBe('v1');
  });

  it('parses uw_version majors and defaults to 1', () => {
    expect(uwVersionMajor('1.1')).toBe(1);
    expect(uwVersionMajor('2.0')).toBe(2);
    expect(uwVersionMajor('10.3')).toBe(10);
    expect(uwVersionMajor(undefined)).toBe(1);
    expect(uwVersionMajor('garbage')).toBe(1);
    expect(isV2File({ uw_version: '2.0' } as UWFrontmatter)).toBe(true);
    expect(isV2File({ uw_version: '1.1' } as UWFrontmatter)).toBe(false);
    expect(isV2File(undefined)).toBe(false);
  });
});

describe('reshapeMetaV1toV2', () => {
  it('routes every field to its sub-object', () => {
    const v2 = reshapeMetaV1toV2(FLAT);
    expect(v2.section).toBe('rent_roll');
    expect(v2.provenance.source).toBe('agent/L2-01');
    expect(v2.provenance.resolution).toBe('ai_extracted');
    expect(v2.provenance.agent_id).toBe('L2-01');
    expect(v2.quality.confidence).toBe('medium');
    expect(v2.quality.flags).toEqual(['check_rents']);
    expect(v2.lifecycle.revision).toBe(2);
    expect(v2.lifecycle.superseded).toBe(false);
    // No hash fields → no integrity object at all.
    expect(v2.integrity).toBeUndefined();
  });

  it('applies the RFC 0031 legacy-tag rule: resolution set, source ABSENT', () => {
    const v2 = reshapeMetaV1toV2({ ...FLAT, source: 'market_data', resolution: undefined });
    expect(v2.provenance.resolution).toBe('market_data');
    expect('source' in v2.provenance).toBe(false); // absent, not invented
  });

  it('a producer-stamped resolution wins over the legacy spelling', () => {
    const v2 = reshapeMetaV1toV2({ ...FLAT, source: 'market_data', resolution: 'user_input' });
    expect(v2.provenance.resolution).toBe('user_input');
  });

  it('manual is an actor, never reinterpreted', () => {
    const v2 = reshapeMetaV1toV2({ ...FLAT, source: 'manual', resolution: undefined });
    expect(v2.provenance.source).toBe('manual');
    expect(v2.provenance.resolution).toBeUndefined();
  });

  it('reads the on-disk section_id spelling', () => {
    const onDisk = { ...FLAT } as unknown as Record<string, unknown>;
    delete onDisk['section'];
    onDisk['section_id'] = 'rent_roll';
    expect(reshapeMetaV1toV2(onDisk as unknown as UWMeta).section).toBe('rent_roll');
  });

  it('carries hashes into integrity', () => {
    const v2 = reshapeMetaV1toV2({ ...FLAT, content_hash: 'abc', parent_hash: null });
    expect(v2.integrity?.content_hash).toBe('abc');
    expect(v2.integrity?.parent_hash).toBeNull();
  });
});

describe('reshapeMetaV2toV1 (the flat parse view)', () => {
  it('round-trips the shim output back to semantically identical flat', () => {
    const flat2 = reshapeMetaV2toV1(reshapeMetaV1toV2(FLAT));
    expect(flat2.section).toBe(FLAT.section);
    expect(flat2.version).toBe(FLAT.version);
    expect(flat2.superseded).toBe(FLAT.superseded);
    expect(flat2.source).toBe(FLAT.source);
    expect(flat2.resolution).toBe(FLAT.resolution);
    expect(flat2.actor).toBe(FLAT.actor);
    expect(flat2.confidence).toBe(FLAT.confidence);
    expect(flat2.flags).toEqual(FLAT.flags);
    expect(flat2.notes).toBe(FLAT.notes);
  });

  it('surfaces lifecycle.revision as version and _overrides as field_overrides', () => {
    const nested = reshapeMetaV1toV2(FLAT);
    const overrides = [{ path: 'units[0].rent', confidence: 'low' as const }];
    const flat = reshapeMetaV2toV1(nested, overrides);
    expect(flat.version).toBe(2);
    expect(flat.field_overrides).toEqual(overrides);
  });
});

describe('canonicalV2BlockContent + canonicalizeV2 — digest shape-insensitivity', () => {
  const flatContent = {
    _meta: { ...FLAT, field_overrides: [{ path: 'x', confidence: 'low' }] },
    total_units: 10,
  } as unknown as Record<string, unknown>;

  it('flat and nested inputs digest identically', () => {
    const nestedMeta = reshapeMetaV1toV2(FLAT) as unknown as Record<string, unknown>;
    const nestedContent = {
      _meta: nestedMeta,
      _overrides: [{ path: 'x', confidence: 'low' }],
      total_units: 10,
    };
    const a = canonicalizeV2(canonicalV2BlockContent(flatContent));
    const b = canonicalizeV2(canonicalV2BlockContent(nestedContent));
    expect(a).toBe(b);
  });

  it('a nested block omitting defaulted quality fields digests like a flat one omitting them', () => {
    const flatSparse = {
      _meta: { ...FLAT },
      total_units: 10,
    } as unknown as Record<string, unknown>;
    const nested = reshapeMetaV1toV2(FLAT) as unknown as UWMetaV2;
    const sparseNested = {
      ...nested,
      quality: { confidence: 'medium', human_review_required: true, flags: ['check_rents'] },
    } as unknown as Record<string, unknown>;
    const a = canonicalizeV2(canonicalV2BlockContent(flatSparse));
    const b = canonicalizeV2(canonicalV2BlockContent({ _meta: sparseNested, total_units: 10 }));
    expect(a).toBe(b);
  });

  it('excludes integrity.content_hash / signature, and a DEFAULTED algorithm', () => {
    const base = { _meta: { ...FLAT }, total_units: 10 } as unknown as Record<string, unknown>;
    const hashed = {
      _meta: {
        ...FLAT,
        content_hash: 'deadbeef',
        parent_hash: null,
        signature: { alg: 'ed25519', kid: 'k', sig: 's', signed_at: '2026-01-01T00:00:00Z' },
      },
      total_units: 10,
    } as unknown as Record<string, unknown>;
    // Wait — parent_hash IS part of the digest. Compare hashed against a base
    // that carries the same parent_hash but no content_hash/signature.
    const baseWithParent = {
      _meta: { ...FLAT, parent_hash: null },
      total_units: 10,
    } as unknown as Record<string, unknown>;
    expect(canonicalizeV2(canonicalV2BlockContent(hashed))).toBe(
      canonicalizeV2(canonicalV2BlockContent(baseWithParent)),
    );
    expect(canonicalizeV2(canonicalV2BlockContent(base))).not.toBe(
      canonicalizeV2(canonicalV2BlockContent(baseWithParent)),
    );

    // Spelling out the default algorithm moves nothing.
    const nested = canonicalV2BlockContent(baseWithParent);
    const meta = nested['_meta'] as UWMetaV2;
    const withAlg = {
      ...nested,
      _meta: { ...meta, integrity: { ...(meta.integrity ?? {}), algorithm: 'sha256' } },
    };
    expect(canonicalizeV2(withAlg)).toBe(canonicalizeV2(nested));
  });
});
