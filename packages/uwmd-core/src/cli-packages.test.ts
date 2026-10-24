// cli-packages.ts â€” the RFC 0018 CLI command wrappers (lease abstracts and
// deal packages). Unlike cli.ts these are plain exported functions, so they
// are directly importable; they just talk through console.log / console.error
// / process.exit, which the harness below captures. The heavy lifting they
// wrap (validation, zip codec, verification, projection) has its own suites â€”
// these tests pin the command-level contracts: what prints, what exits, and
// which flag selects which path.

import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cmdLeaseProject,
  cmdLeaseValidate,
  cmdPackageContextValidate,
  cmdPackageCreate,
  cmdPackageEdges,
  cmdPackageList,
  cmdPackageToContext,
  cmdPackageVerify,
  packageMemberSemanticDigest,
} from './cli-packages.js';
import {
  type UWDealPackageManifest,
  CORE_CODEC_REGISTRY,
  computeEnvelopeDigest,
  encodeUWDealPackageZip,
  parseUWFile,
  sha256BytesHex,
  toUWEnvelope,
} from '@uwmd/verify';

const encoder = new TextEncoder();
const DEAL_TEXT = "---\nuw_version: \"3.0\"\ndeal_id: d1\ndeal_name: Synthetic package carrier\n---\n";
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
    links: [
      { type: 'contributes_to', from: 'source:lease', to: 'deal:d1' },
      // Valid on both layers (registry), so it projects to an entity edge â€”
      // where contributes_to is member-only and must not.
      { type: 'supports', from: 'source:lease', to: 'deal:d1' },
    ],
  };
}

const validAbstract = () => ({
  document_id: 'doc:anchor',
  lease_id: 'lease:anchor',
  artifact_kind: 'executed_lease',
  tenant: 'Anchor Tenant LLC',
  premises: 'Suite 210',
  governing_documents: ['source:anchor-lease'],
  lease_context: {
    suite: { value: '210', source_ref: { source: 'source:anchor-lease', locator: 'Â§1.1, p. 2' } },
  },
  lease_term: {
    commencement: { value: '2024-03-01', source_ref: { source: 'source:anchor-lease', locator: 'Â§2.1' } },
    expiration: { value: '2034-02-28', source_ref: { source: 'source:anchor-lease', locator: 'Â§2.1' } },
  },
  lease_economics: {
    base_rent_annual: { value: 184800, source_ref: { source: 'source:anchor-lease', locator: 'Â§4.1' } },
  },
});

// process.exit is replaced with a thrower so exit paths are observable
// without killing the runner; console output is captured per call.
class ExitError extends Error {
  constructor(readonly code: number | undefined) { super(`exit(${code})`); }
}

const tmp = mkdtempSync(join(tmpdir(), 'uwmd-cli-packages-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

let logs: string[] = [];
let errs: string[] = [];
let out: string[] = [];
beforeEach(() => {
  logs = []; errs = []; out = [];
  vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new ExitError(code);
  }) as never);
  vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => { logs.push(a.join(' ')); });
  vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => { errs.push(a.join(' ')); });
  vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string) => {
    out.push(String(chunk));
    return true;
  }) as never);
});
afterEach(() => vi.restoreAllMocks());

const expectExit = async (fn: () => void | Promise<void>, code: number) => {
  try {
    await fn();
    expect.unreachable(`expected exit(${code})`);
  } catch (e) {
    expect(e).toBeInstanceOf(ExitError);
    expect((e as ExitError).code).toBe(code);
  }
};

describe('lease commands', () => {
  const validPath = join(tmp, 'abstract.json');
  const invalidPath = join(tmp, 'abstract-bad.json');
  writeFileSync(validPath, JSON.stringify(validAbstract()));
  writeFileSync(invalidPath, JSON.stringify({ ...validAbstract(), governing_documents: [] }));

  it('cmdLeaseValidate: a valid abstract prints OK and does not exit', () => {
    cmdLeaseValidate(validPath, {});
    expect(logs.join('\n')).toContain('OK - abstract.json');
  });

  it('cmdLeaseValidate --json exits 0 on valid, 1 on invalid, with a machine result', async () => {
    await expectExit(() => cmdLeaseValidate(validPath, { json: true }), 0);
    expect(JSON.parse(logs[0]!)).toMatchObject({ ok: true, errors: [] });

    logs = [];
    await expectExit(() => cmdLeaseValidate(invalidPath, { json: true }), 1);
    expect(JSON.parse(logs[0]!).ok).toBe(false);
  });

  it('cmdLeaseValidate: an invalid abstract prints the error codes and exits 1', async () => {
    await expectExit(() => cmdLeaseValidate(invalidPath, {}), 1);
    expect(logs.join('\n')).toContain('ERRORS - abstract-bad.json');
  });

  it('cmdLeaseProject emits the proposed row plus its loss report for a valid abstract', () => {
    cmdLeaseProject(validPath, {});
    const result = JSON.parse(logs.join('\n'));
    expect(result).toHaveProperty('row');
    expect(result).toHaveProperty('report');
  });

  it('cmdLeaseProject refuses an invalid abstract before projecting', async () => {
    await expectExit(() => cmdLeaseProject(invalidPath, {}), 1);
    expect(errs.join('\n')).toContain('Refusing to project');
  });
});

describe('package commands', () => {
  const manifestPath = join(tmp, 'manifest.json');
  const zipPath = join(tmp, 'pkg.uwpkg.zip');

  it('cmdPackageCreate writes the archive when the manifest and payloads are present', async () => {
    const manifest = await buildManifest();
    writeFileSync(manifestPath, JSON.stringify(manifest));
    mkdirSync(join(tmp, 'records'), { recursive: true });
    mkdirSync(join(tmp, 'sources'), { recursive: true });
    writeFileSync(join(tmp, 'records', 'deal.uwx.md'), DEAL_TEXT);
    writeFileSync(join(tmp, 'sources', 'lease.pdf'), PDF_BYTES);

    await cmdPackageCreate(manifestPath, { output: zipPath });
    expect(logs.join('\n')).toContain('2 member(s)');
    expect(readFileSync(zipPath).length).toBeGreaterThan(0);
  });

  it('cmdPackageCreate exits 1 on an invalid manifest and on a missing payload', async () => {
    const badManifestPath = join(tmp, 'manifest-bad.json');
    writeFileSync(badManifestPath, JSON.stringify({ package_version: '1.0' }));
    await expectExit(() => cmdPackageCreate(badManifestPath, {}), 1);
    expect(errs.join('\n')).toContain('Manifest is invalid');

    errs = [];
    const missingPath = join(tmp, 'manifest-missing.json');
    const manifest = await buildManifest();
    manifest.members[0]!.path = 'records/absent.uwx.md';
    writeFileSync(missingPath, JSON.stringify(manifest));
    await expectExit(() => cmdPackageCreate(missingPath, {}), 1);
    expect(errs.join('\n')).toContain('Missing member payload');
  });

  it('cmdPackageVerify reports the three-state verdict and only a failure exits non-zero', async () => {
    await cmdPackageVerify(zipPath, {});
    const text = logs.join('\n');
    expect(text).toMatch(/VERIFIED|UNVERIFIABLE/);
    expect(text).toContain('does not mean the inputs are true');

    logs = [];
    await cmdPackageVerify(zipPath, { json: true });
    const result = JSON.parse(logs[0]!);
    expect(['verified', 'unverifiable']).toContain(result.status);
  });

  it('cmdPackageCreate exits 1 when a payload does not match its declared sha â€” the codec refuses at encode time', async () => {
    // This is also why cmdPackageVerify's failed branch is unreachable through
    // our own tooling: a mismatched package cannot be produced by the encoder,
    // and safe extraction refuses a corrupted archive at decode. `failed` is
    // reserved for hostile archives built elsewhere.
    const manifest = await buildManifest();
    manifest.members[1]!.sha256 = `sha256:${'0'.repeat(64)}`;
    const mismatchPath = join(tmp, 'manifest-mismatch.json');
    writeFileSync(mismatchPath, JSON.stringify(manifest));
    await expectExit(() => cmdPackageCreate(mismatchPath, { output: join(tmp, 'never.uwpkg.zip') }), 1);
    expect(errs.join('\n')).toContain('PKGZIP-002');
  });

  it('cmdPackageList prints the members and links, and --json is machine-readable', () => {
    cmdPackageList(zipPath, {});
    const text = logs.join('\n');
    expect(text).toContain('pkg:test:1 â€” 2 member(s)');
    expect(text).toContain('source:lease --contributes_to--> deal:d1');

    logs = [];
    cmdPackageList(zipPath, { json: true });
    const result = JSON.parse(logs[0]!);
    expect(result.members.map((m: { id: string }) => m.id)).toEqual(['deal:d1', 'source:lease']);
  });

  it('cmdPackageToContext writes to stdout by default and never inlines source evidence', () => {
    cmdPackageToContext(zipPath, {});
    const context = JSON.parse(out.join(''));
    expect(context.contents ?? {}).not.toHaveProperty('source:lease');
    expect(JSON.stringify(context)).not.toContain('PDF');
  });

  it('cmdPackageToContext --output writes the file, and the context re-validates clean', async () => {
    const ctxPath = join(tmp, 'context.json');
    cmdPackageToContext(zipPath, { output: ctxPath });
    expect(logs.join('\n')).toContain('Wrote context.json');

    logs = [];
    cmdPackageContextValidate(ctxPath, {});
    expect(logs.join('\n')).toContain('OK - context.json');

    const badPath = join(tmp, 'context-bad.json');
    writeFileSync(badPath, JSON.stringify({ not: 'a context' }));
    await expectExit(() => cmdPackageContextValidate(badPath, {}), 1);
  });

  it('cmdPackageEdges projects only entity-layer links, with synthesized provenance', () => {
    cmdPackageEdges(zipPath);
    const edges = JSON.parse(logs.join('\n')) as Array<{ type: string; provenance: unknown[] }>;
    expect(edges.map((e) => e.type)).toEqual(['supports']);
    // member-only types (contributes_to) have no entity-layer meaning
    expect(JSON.stringify(edges)).not.toContain('contributes_to');
    expect(edges[0]!.provenance).toHaveLength(1);
  });
});

describe('package semantic digests (RFC 0018; launch audit D-10)', () => {
  // RFC 0018: a UW member's semantic_digest MUST verify when the implementation
  // supports its representation; otherwise the package is `unverifiable`.
  // Through 4.2.0 the CLI supplied no digest function, so every stated digest
  // was `unverifiable`, including one left stale after the member changed.
  const ALTERED = DEAL_TEXT.replace('deal_id: d1', 'deal_id: d1-altered');
  const semantic = async (text: string) => computeEnvelopeDigest(toUWEnvelope(parseUWFile(text)));
  const sha = async (bytes: Uint8Array) => `sha256:${await sha256BytesHex(bytes)}`;

  type Role = UWDealPackageManifest['members'][number]['role'];
  interface Member { id: string; path: string; media_type: string; bytes: Uint8Array; semantic_digest?: string; role?: Role }
  async function writePackage(name: string, members: Member[]): Promise<string> {
    const manifest: UWDealPackageManifest = {
      package_version: '1.0',
      package_id: `pkg:test:${name}`,
      members: await Promise.all(members.map(async (m) => {
        const entry: UWDealPackageManifest['members'][number] = {
          id: m.id,
          path: m.path,
          role: m.role ?? 'underwriting',
          media_type: m.media_type,
          sha256: await sha(m.bytes),
        };
        if (m.semantic_digest) entry.semantic_digest = m.semantic_digest;
        return entry;
      })),
      links: [],
    };
    const payloads = Object.fromEntries(members.map((m) => [m.path, m.bytes]));
    const path = join(tmp, `${name}.uwpkg.zip`);
    writeFileSync(path, await encodeUWDealPackageZip({ manifest, payloads }));
    return path;
  }

  describe('packageMemberSemanticDigest', () => {
    it('computes the uw-envelope-semantic digest of UWX and of each lossless model encoding', async () => {
      const expected = await semantic(DEAL_TEXT);
      expect(await packageMemberSemanticDigest('text/vnd.uwmd.extended+markdown', encoder.encode(DEAL_TEXT))).toBe(expected);
      expect(await packageMemberSemanticDigest('Text/VND.uwmd.extended+markdown; charset=utf-8', encoder.encode(DEAL_TEXT))).toBe(expected);
      const envelope = toUWEnvelope(parseUWFile(DEAL_TEXT));
      for (const [id, mediaType] of [
        ['uw-json', 'application/vnd.uwmd.document+json'],
        ['uw-xml', 'application/vnd.uwmd.document+xml'],
        ['uw-csv-bundle', 'application/vnd.uwmd.csv-bundle+zip'],
      ] as const) {
        const encoded = await CORE_CODEC_REGISTRY.encode<string | Uint8Array>(id, envelope);
        const bytes = typeof encoded === 'string' ? encoder.encode(encoded) : encoded;
        expect(await packageMemberSemanticDigest(mediaType, bytes), id).toBe(expected);
      }
    });

    it('returns null, never a digest, for what it cannot canonicalize', async () => {
      // UW Lite: RFC 0018 does not pin the canonicalization its digest uses.
      expect(await packageMemberSemanticDigest('text/vnd.uwmd.lite+markdown', encoder.encode('uw_version: 1.0\n'))).toBeNull();
      expect(await packageMemberSemanticDigest('application/pdf', PDF_BYTES)).toBeNull();
      // UWX bytes that are not UTF-8, or that the reader refuses.
      expect(await packageMemberSemanticDigest('text/vnd.uwmd.extended+markdown', PDF_BYTES)).toBeNull();
      expect(await packageMemberSemanticDigest('text/vnd.uwmd.extended+markdown', encoder.encode(DEAL_TEXT.replace('"3.0"', '"2.0"')))).toBeNull();
      expect(await packageMemberSemanticDigest('application/vnd.uwmd.document+json', encoder.encode('{not json'))).toBeNull();
    });
  });

  it('verifies a package whose stated semantic digests recompute, and does not exit', async () => {
    const envelope = toUWEnvelope(parseUWFile(DEAL_TEXT));
    const json = encoder.encode(await CORE_CODEC_REGISTRY.encode<string>('uw-json', envelope));
    const path = await writePackage('valid', [
      { id: 'deal:d1', path: 'records/deal.uwx.md', media_type: 'text/vnd.uwmd.extended+markdown', bytes: encoder.encode(DEAL_TEXT), semantic_digest: await semantic(DEAL_TEXT) },
      { id: 'model:d1', path: 'models/deal.uw.json', media_type: 'application/vnd.uwmd.document+json', bytes: json, semantic_digest: await semantic(DEAL_TEXT), role: 'model_encoding' },
      { id: 'source:lease', path: 'sources/lease.pdf', media_type: 'application/pdf', bytes: PDF_BYTES, role: 'source_evidence' },
    ]);
    await cmdPackageVerify(path, {});
    expect(logs.join('\n')).toContain('VERIFIED - valid.uwpkg.zip');
    logs = [];
    await cmdPackageVerify(path, { json: true });
    expect(JSON.parse(logs[0]!)).toEqual({ status: 'verified', errors: [], unverifiable_members: [] });
  });

  it('fails, exit 1, when a member changed under a refreshed byte digest and a stale semantic digest', async () => {
    const path = await writePackage('stale', [
      // sha256 is taken from the altered bytes; semantic_digest still names the original.
      { id: 'deal:d1', path: 'records/deal.uwx.md', media_type: 'text/vnd.uwmd.extended+markdown', bytes: encoder.encode(ALTERED), semantic_digest: await semantic(DEAL_TEXT) },
    ]);
    await expectExit(() => cmdPackageVerify(path, {}), 1);
    expect(logs.join('\n')).toContain('FAILED - stale.uwpkg.zip');
    expect(logs.join('\n')).toContain('PKGVER-003 [deal:d1]');
    logs = [];
    await expectExit(() => cmdPackageVerify(path, { json: true }), 1);
    const result = JSON.parse(logs[0]!);
    expect(result.status).toBe('failed');
    expect(result.errors.map((e: { code: string }) => e.code)).toEqual(['PKGVER-003']);
    expect(result.unverifiable_members).toEqual([]);
  });

  it('fails a stale semantic digest on a model encoding as well', async () => {
    const altered = encoder.encode(await CORE_CODEC_REGISTRY.encode<string>('uw-json', toUWEnvelope(parseUWFile(ALTERED))));
    const path = await writePackage('stale-json', [
      { id: 'model:d1', path: 'models/deal.uw.json', media_type: 'application/vnd.uwmd.document+json', bytes: altered, semantic_digest: await semantic(DEAL_TEXT), role: 'model_encoding' },
    ]);
    await expectExit(() => cmdPackageVerify(path, {}), 1);
    expect(logs.join('\n')).toContain('PKGVER-003 [model:d1]');
  });

  it('reports an unsupported representation as unverifiable, never failed, and does not exit', async () => {
    const lite = encoder.encode('---\nuw_lite: "1.0"\n---\n');
    const path = await writePackage('lite', [
      { id: 'deal:d1', path: 'records/deal.uwx.md', media_type: 'text/vnd.uwmd.extended+markdown', bytes: encoder.encode(DEAL_TEXT), semantic_digest: await semantic(DEAL_TEXT) },
      // Any digest: nothing here can compute a Lite member's, so it is not compared.
      { id: 'lease:lite', path: 'records/lease.uw.md', media_type: 'text/vnd.uwmd.lite+markdown', bytes: lite, semantic_digest: `sha256:${'a'.repeat(64)}`, role: 'lease_abstract' },
    ]);
    await cmdPackageVerify(path, {});
    const text = logs.join('\n');
    expect(text).toContain('UNVERIFIABLE - lite.uwpkg.zip');
    expect(text).toContain('(unverifiable) lease:lite â€” its text/vnd.uwmd.lite+markdown semantic digest cannot be computed here');
    expect(text).not.toContain('PKGVER-003');
    logs = [];
    await cmdPackageVerify(path, { json: true });
    expect(JSON.parse(logs[0]!)).toEqual({ status: 'unverifiable', errors: [], unverifiable_members: ['lease:lite'] });
  });

  it('reports a UW member the reader refuses as unverifiable, not as a mismatch', async () => {
    const refused = encoder.encode(DEAL_TEXT.replace('"3.0"', '"2.0"'));
    const path = await writePackage('refused', [
      { id: 'deal:d1', path: 'records/deal.uwx.md', media_type: 'text/vnd.uwmd.extended+markdown', bytes: refused, semantic_digest: await semantic(DEAL_TEXT) },
    ]);
    await cmdPackageVerify(path, {});
    expect(logs.join('\n')).toContain('UNVERIFIABLE - refused.uwpkg.zip');
    expect(logs.join('\n')).not.toContain('PKGVER-003');
  });

  it('checks bytes only where no semantic digest is stated', async () => {
    // No semantic_digest stated: there is no semantic evidence to check, so
    // the member verifies on its byte digest alone, neither failed nor unverifiable.
    const unstated = await writePackage('unstated', [
      { id: 'deal:d1', path: 'records/deal.uwx.md', media_type: 'text/vnd.uwmd.extended+markdown', bytes: encoder.encode(DEAL_TEXT) },
      { id: 'source:lease', path: 'sources/lease.pdf', media_type: 'application/pdf', bytes: PDF_BYTES, role: 'source_evidence' },
    ]);
    await cmdPackageVerify(unstated, { json: true });
    expect(JSON.parse(logs[0]!)).toEqual({ status: 'verified', errors: [], unverifiable_members: [] });
  });
});
