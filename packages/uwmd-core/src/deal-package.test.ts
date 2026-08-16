// UW Deal Package tests (RFC 0018 §3–§5).

import { describe, expect, it } from 'vitest';
import {
  BUILTIN_EDGE_TYPES,
  isEdgeTypeValidOnLayer,
  lookupDocumentProfile,
  lookupEdgeType,
} from './protocol.js';
import {
  UWPackageError,
  assertUWDealPackageManifest,
  edgeTypesForLayer,
  isSafeMemberPath,
  projectPackageLinksToEntityEdges,
  validateUWDealPackageManifest,
  type UWDealPackageManifest,
} from './deal-package.js';
import {
  decodeUWDealPackageZip,
  encodeUWDealPackageZip,
  verifyUWDealPackage,
} from './deal-package-zip.js';
import {
  projectUWDealPackageContext,
  validateUWDealPackageContext,
  verifyContextContentDigests,
} from './deal-package-context.js';
import { sha256BytesHex } from './integrity.js';

const encoder = new TextEncoder();
const DEAL_TEXT = '---\nuw_version: "1.1"\ndeal_id: d1\n---\n';
const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0xff, 0xfe, 0x80, 0x00, 0x7f]);

async function buildManifest(): Promise<UWDealPackageManifest> {
  return {
    package_version: '1.0',
    package_id: 'pkg:test:1',
    members: [
      {
        id: 'deal:d1',
        path: 'records/deal.uwx.md',
        role: 'underwriting',
        media_type: 'text/vnd.uwmd.extended+markdown',
        sha256: `sha256:${await sha256BytesHex(encoder.encode(DEAL_TEXT))}`,
        document_profile: 'deal-underwriting-v1',
      },
      {
        id: 'source:lease',
        path: 'sources/lease.pdf',
        role: 'source_evidence',
        media_type: 'application/pdf',
        sha256: `sha256:${await sha256BytesHex(PDF_BYTES)}`,
      },
    ],
    links: [{ type: 'contributes_to', from: 'source:lease', to: 'deal:d1' }],
  };
}

async function buildPayloads() {
  return {
    'records/deal.uwx.md': encoder.encode(DEAL_TEXT),
    'sources/lease.pdf': PDF_BYTES,
  };
}

describe('edge registry', () => {
  it('keeps guarantees and supports as single types valid on both layers', () => {
    for (const type of ['guarantees', 'supports']) {
      const def = lookupEdgeType(type);
      expect(def?.layers).toEqual(expect.arrayContaining(['entity', 'member']));
    }
    // One registry, not two — the whole point of RFC 0018 §5.
    expect(BUILTIN_EDGE_TYPES.filter((d) => d.type === 'guarantees')).toHaveLength(1);
  });

  it('rejects an entity-only type on the member layer', () => {
    expect(isEdgeTypeValidOnLayer('owns', 'entity')).toBe(true);
    expect(isEdgeTypeValidOnLayer('owns', 'member')).toBe(false);
    expect(isEdgeTypeValidOnLayer('abstracts', 'entity')).toBe(false);
  });

  it('preserves unknown extension types rather than rejecting them', () => {
    expect(lookupEdgeType('org.example.custom')).toBeUndefined();
    expect(isEdgeTypeValidOnLayer('org.example.custom', 'member')).toBe(true);
    expect(isEdgeTypeValidOnLayer('org.example.custom', 'entity')).toBe(true);
  });

  it('exposes the per-layer type lists', () => {
    expect(edgeTypesForLayer('member')).toEqual(
      expect.arrayContaining(['abstracts', 'amends', 'supersedes', 'contributes_to']),
    );
    expect(edgeTypesForLayer('entity')).toEqual(
      expect.arrayContaining(['owns', 'borrows_against', 'secures', 'related_to']),
    );
  });
});

describe('document profiles', () => {
  it('resolves the three built-in profiles and preserves unknown ones', () => {
    expect(lookupDocumentProfile('lease-abstract-v1')?.financial_role).toBe('descriptive');
    expect(lookupDocumentProfile('deal-underwriting-v1')?.financial_role).toBe('underwriting');
    expect(lookupDocumentProfile('source-note-v1')?.financial_role).toBe('evidence');
    // Unknown ≠ invalid: producers must preserve it.
    expect(lookupDocumentProfile('org.example.future-v1')).toBeUndefined();
  });
});

describe('manifest validation', () => {
  it('accepts a well-formed manifest', async () => {
    expect(validateUWDealPackageManifest(await buildManifest())).toEqual([]);
  });

  it('rejects unsafe and duplicate paths', async () => {
    expect(isSafeMemberPath('../escape.md')).toBe(false);
    expect(isSafeMemberPath('/abs.md')).toBe(false);
    expect(isSafeMemberPath('C:/win.md')).toBe(false);
    expect(isSafeMemberPath('records/ok.md')).toBe(true);

    const m = await buildManifest();
    m.members[1]!.path = '../escape.pdf';
    expect(validateUWDealPackageManifest(m).some((e) => e.code === 'PKG-009')).toBe(true);
  });

  it('rejects a dangling link endpoint', async () => {
    const m = await buildManifest();
    m.links = [{ type: 'contributes_to', from: 'source:lease', to: 'deal:missing' }];
    expect(validateUWDealPackageManifest(m).some((e) => e.code === 'PKG-016')).toBe(true);
  });

  it('rejects a known edge type used on the wrong layer', async () => {
    const m = await buildManifest();
    m.links = [{ type: 'owns', from: 'source:lease', to: 'deal:d1' }];
    const errors = validateUWDealPackageManifest(m);
    expect(errors.some((e) => e.code === 'PKG-017')).toBe(true);
  });

  it('preserves an unknown link type', async () => {
    const m = await buildManifest();
    m.links = [{ type: 'org.example.custom', from: 'source:lease', to: 'deal:d1' }];
    expect(validateUWDealPackageManifest(m)).toEqual([]);
  });

  it('rejects duplicate member ids', async () => {
    const m = await buildManifest();
    m.members.push({ ...m.members[0]! });
    expect(validateUWDealPackageManifest(m).some((e) => e.code === 'PKG-008')).toBe(true);
  });
});

describe('link projection', () => {
  it('synthesizes provenance naming the package when projecting to the entity layer', async () => {
    const m = await buildManifest();
    m.links = [{ type: 'guarantees', from: 'source:lease', to: 'deal:d1' }];
    const edges = projectPackageLinksToEntityEdges(m);
    expect(edges).toHaveLength(1);
    // No edge reaches the entity layer without attributable provenance.
    expect(edges[0]!.provenance[0]!.source).toBe('pkg:test:1');
    expect(edges[0]!.provenance.length).toBeGreaterThan(0);
  });

  it('does not project member-only types upward', async () => {
    const m = await buildManifest();
    m.links = [
      { type: 'abstracts', from: 'deal:d1', to: 'source:lease' },
      { type: 'contributes_to', from: 'source:lease', to: 'deal:d1' },
    ];
    // These describe documents; they have no entity-layer meaning.
    expect(projectPackageLinksToEntityEdges(m)).toEqual([]);
  });
});

describe('ZIP codec', () => {
  it('round-trips a package including binary members', async () => {
    const zip = await encodeUWDealPackageZip({
      manifest: await buildManifest(),
      payloads: await buildPayloads(),
    });
    const decoded = decodeUWDealPackageZip(zip);
    expect(decoded.manifest.package_id).toBe('pkg:test:1');
    // The PDF must survive byte-for-byte — high bytes included.
    expect(Array.from(decoded.payloads['sources/lease.pdf']!)).toEqual(Array.from(PDF_BYTES));
  });

  it('encodes deterministically', async () => {
    const input = { manifest: await buildManifest(), payloads: await buildPayloads() };
    const a = await encodeUWDealPackageZip(input);
    const b = await encodeUWDealPackageZip(input);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('refuses to encode a manifest that disagrees with its payload', async () => {
    const manifest = await buildManifest();
    manifest.members[0]!.sha256 = `sha256:${'0'.repeat(64)}`;
    await expect(
      encodeUWDealPackageZip({ manifest, payloads: await buildPayloads() }),
    ).rejects.toThrow(UWPackageError);
  });

  it('detects a tampered member on verification', async () => {
    const zip = await encodeUWDealPackageZip({
      manifest: await buildManifest(),
      payloads: await buildPayloads(),
    });
    const decoded = decodeUWDealPackageZip(zip);
    decoded.payloads['records/deal.uwx.md'] = encoder.encode('---\ntampered: true\n---\n');
    const result = await verifyUWDealPackage(decoded);
    expect(result.status).toBe('failed');
    expect(result.errors.some((e) => e.code === 'PKGVER-002')).toBe(true);
  });

  it('reports unverifiable rather than failed for an uncheckable semantic digest', async () => {
    const manifest = await buildManifest();
    manifest.members[0]!.semantic_digest = `sha256:${'a'.repeat(64)}`;
    const zip = await encodeUWDealPackageZip({ manifest, payloads: await buildPayloads() });
    const decoded = decodeUWDealPackageZip(zip);
    // No semanticDigestOf supplied → cannot check → unverifiable, NOT failed.
    const result = await verifyUWDealPackage(decoded);
    expect(result.status).toBe('unverifiable');
    expect(result.errors).toEqual([]);
    expect(result.unverifiable_members).toContain('deal:d1');
  });
});

describe('JSON context view', () => {
  it('inlines UW documents and never source evidence', async () => {
    const manifest = await buildManifest();
    const ctx = projectUWDealPackageContext(manifest, {
      contents: { 'deal:d1': DEAL_TEXT, 'source:lease': 'THIS MUST NOT APPEAR' },
    });
    expect(ctx.contents['deal:d1']?.text).toBe(DEAL_TEXT);
    // The rule the whole view exists to enforce.
    expect(ctx.contents['source:lease']).toBeUndefined();
    expect(ctx.source_evidence['source:lease']).toEqual({ status: 'not_transferred' });
    expect(ctx.incomplete_evidence_context).toBe(true);
    expect(JSON.stringify(ctx)).not.toContain('THIS MUST NOT APPEAR');
  });

  it('records reference handles without resolving them', async () => {
    const manifest = await buildManifest();
    const ctx = projectUWDealPackageContext(manifest, {
      references: { 'source:lease': [{ scheme: 'connector', authority: 'acme', value: 'file/123' }] },
    });
    expect(ctx.source_evidence['source:lease']).toEqual({
      status: 'reference',
      reference: [{ scheme: 'connector', authority: 'acme', value: 'file/123' }],
    });
  });

  it('rejects a context that inlines source evidence', async () => {
    const manifest = await buildManifest();
    const ctx = projectUWDealPackageContext(manifest, { contents: { 'deal:d1': DEAL_TEXT } });
    (ctx.contents as Record<string, unknown>)['source:lease'] = { kind: 'utf8', text: 'leaked' };
    expect(validateUWDealPackageContext(ctx).some((e) => e.code === 'PKGCTX-006')).toBe(true);
  });

  it('rejects a content key for an unlisted member', async () => {
    const manifest = await buildManifest();
    const ctx = projectUWDealPackageContext(manifest, { contents: { 'deal:d1': DEAL_TEXT } });
    (ctx.contents as Record<string, unknown>)['ghost'] = { kind: 'utf8', text: 'x' };
    expect(validateUWDealPackageContext(ctx).some((e) => e.code === 'PKGCTX-005')).toBe(true);
  });

  it('verifies inline payloads against the manifest digest', async () => {
    const manifest = await buildManifest();
    const ctx = projectUWDealPackageContext(manifest, { contents: { 'deal:d1': DEAL_TEXT } });
    expect(await verifyContextContentDigests(ctx, sha256BytesHex)).toEqual([]);

    ctx.contents['deal:d1'] = { kind: 'utf8', text: 'different bytes' };
    const errors = await verifyContextContentDigests(ctx, sha256BytesHex);
    expect(errors.some((e) => e.code === 'PKGCTX-011')).toBe(true);
  });

  it('requires the incomplete-evidence declaration', async () => {
    const ctx = projectUWDealPackageContext(await buildManifest());
    // Deliberately writing a value the type forbids — the point of the test is
    // that the runtime validator catches what a caller in plain JS could do.
    (ctx as unknown as Record<string, unknown>)['incomplete_evidence_context'] = false;
    expect(validateUWDealPackageContext(ctx).some((e) => e.code === 'PKGCTX-004')).toBe(true);
  });
});

describe('assertUWDealPackageManifest', () => {
  it('throws a typed error', () => {
    expect(() => assertUWDealPackageManifest({ package_version: '9.9' })).toThrow(UWPackageError);
  });
});
