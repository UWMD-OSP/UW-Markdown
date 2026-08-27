// cli-packages.ts — the RFC 0018 CLI command wrappers (lease abstracts and
// deal packages). Unlike cli.ts these are plain exported functions, so they
// are directly importable; they just talk through console.log / console.error
// / process.exit, which the harness below captures. The heavy lifting they
// wrap (validation, zip codec, verification, projection) has its own suites —
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
} from './cli-packages.js';
import type { UWDealPackageManifest } from './deal-package.js';
import { encodeUWDealPackageZip } from './deal-package-zip.js';
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
    links: [
      { type: 'contributes_to', from: 'source:lease', to: 'deal:d1' },
      // Valid on both layers (registry), so it projects to an entity edge —
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
    suite: { value: '210', source_ref: { source: 'source:anchor-lease', locator: '§1.1, p. 2' } },
  },
  lease_term: {
    commencement: { value: '2024-03-01', source_ref: { source: 'source:anchor-lease', locator: '§2.1' } },
    expiration: { value: '2034-02-28', source_ref: { source: 'source:anchor-lease', locator: '§2.1' } },
  },
  lease_economics: {
    base_rent_annual: { value: 184800, source_ref: { source: 'source:anchor-lease', locator: '§4.1' } },
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

  it('cmdPackageCreate exits 1 when a payload does not match its declared sha — the codec refuses at encode time', async () => {
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

  it('cmdPackageVerify reports a stated semantic_digest it cannot check as unverifiable, without exiting', async () => {
    const manifest = await buildManifest();
    manifest.members[0]!.semantic_digest = `sha256:${'a'.repeat(64)}`;
    const bytes = await encodeUWDealPackageZip({
      manifest,
      payloads: {
        'records/deal.uwx.md': encoder.encode(DEAL_TEXT),
        'sources/lease.pdf': PDF_BYTES,
      },
    });
    const unverifiablePath = join(tmp, 'semantic.uwpkg.zip');
    writeFileSync(unverifiablePath, bytes);
    await cmdPackageVerify(unverifiablePath, {});
    const text = logs.join('\n');
    expect(text).toContain('UNVERIFIABLE');
    expect(text).toContain('(unverifiable) deal:d1');
  });

  it('cmdPackageList prints the members and links, and --json is machine-readable', () => {
    cmdPackageList(zipPath, {});
    const text = logs.join('\n');
    expect(text).toContain('pkg:test:1 — 2 member(s)');
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
