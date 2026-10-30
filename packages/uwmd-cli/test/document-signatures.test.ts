import { runProcess } from '../../../test/cli.mjs';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.setConfig({ testTimeout: 30_000 });
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const bin = resolve(root, 'packages/uwmd-cli/bin/uwmd.mjs');
const fixture = resolve(root, 'conformance/document-signatures/01-valid');
const signer = resolve(root, 'conformance/document-signatures/keys/signer.json');
const store = resolve(root, 'conformance/document-signatures/keys/keystore.json');
const cli = (...args: string[]) => runProcess(process.execPath, [bin, ...args], { encoding: 'utf8' });
describe('document authentication CLI', () => {
  let temp: string;
  let source: string;
  let output: string;
  beforeEach(() => {
    temp = mkdtempSync(resolve(tmpdir(), 'uwmd-document-signature-'));
    source = resolve(temp, 'deal.uwx.md');
    output = resolve(temp, 'signature.json');
    writeFileSync(source, readFileSync(resolve(fixture, 'deal.uwx.md')));
  });
  afterEach(() => rmSync(temp, { recursive: true, force: true }));
  it('signs and authenticates without financial validation or changing source bytes', async () => {
    const before = readFileSync(source, 'utf8');
    const signed = await cli('sign-document', source, `--key=${signer}`, `--out=${output}`, '--signed-at=2026-10-14T00:00:00Z');
    expect(signed.status).toBe(0);
    expect(readFileSync(source, 'utf8')).toBe(before);
    expect(JSON.parse(readFileSync(output, 'utf8'))).toEqual(JSON.parse(readFileSync(resolve(fixture, 'signature.json'), 'utf8')));
    const result = await cli('verify', source, '--integrity', `--document-signature=${output}`, `--keystore=${store}`, '--json');
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ ok: true, integrity: {
      signatures_present: 3, signatures_verified: 0, document_signature: { state: 'verified' },
    }, signature_checks: {
      embedded_blocks: { requested: false, state: 'not_checked', present: 3, verified: 0 },
      detached_document: { requested: true, state: 'verified' },
    } });
  });
  it('keeps real block attribution but fails a relabeled authenticated snapshot', async () => {
    const changed = resolve(root, 'conformance/document-signatures/02-relabel');
    const result = await cli('verify', resolve(changed, 'deal.uwx.md'), '--integrity', '--signing',
      `--document-signature=${resolve(changed, 'signature.json')}`, `--keystore=${store}`, '--json');
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({ ok: false, integrity: {
      signatures_verified: 3, document_signature: { state: 'failed', reason: 'subject_mismatch' },
    } });
  });
  it('refuses absent, unreadable and malformed requested artifacts', async () => {
    const missing = await cli('verify', source, '--integrity', `--document-signature=${output}`, `--keystore=${store}`, '--json');
    expect(missing.status).toBe(1);
    writeFileSync(output, 'null');
    const unsigned = await cli('verify', source, '--integrity', `--document-signature=${output}`, `--keystore=${store}`, '--json');
    expect(unsigned.status).toBe(1);
    expect(JSON.parse(unsigned.stdout)).toMatchObject({ integrity: { document_signature: { state: 'unsigned' } } });
    writeFileSync(output, '{');
    expect((await cli('verify', source, '--integrity', `--document-signature=${output}`, `--keystore=${store}`, '--json')).status).toBe(1);
  });
  it('refuses missing option values, absent key stores and resolved composition', async () => {
    expect((await cli('sign-document', source)).status).toBe(1);
    expect((await cli('verify', source, '--document-signature')).status).toBe(1);
    expect((await cli('verify', source, `--document-signature=${output}`)).status).toBe(1);
    expect((await cli('verify', source, `--document-signature=${output}`, `--keystore=${store}`, '--resolved')).status).toBe(1);
  });
  it('refuses overwriting source, key or an existing output', async () => {
    for (const target of [source, signer]) {
      const before = readFileSync(target, 'utf8');
      expect((await cli('sign-document', source, `--key=${signer}`, `--out=${target}`)).status).toBe(1);
      expect(readFileSync(target, 'utf8')).toBe(before);
    }
    writeFileSync(output, 'preserve');
    expect((await cli('sign-document', source, `--key=${signer}`, `--out=${output}`)).status).toBe(1);
    expect(readFileSync(output, 'utf8')).toBe('preserve');
  });
  it('human output identifies document scope separately from block attribution', async () => {
    const result = await cli('verify', source, '--integrity', `--document-signature=${resolve(fixture, 'signature.json')}`, `--keystore=${store}`);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Document snapshot authentication: verified');
    expect(result.stdout).toContain('(detached document signature)');
    expect(result.stdout).toContain('Embedded block signatures: not_checked — 3 present, 0 verified');
    expect((await cli('verify', source, '--integrity')).stdout).toContain('Document snapshot authentication: not checked');
  });
  it('distinguishes verified block attribution from present but unverifiable keys', async () => {
    const verified = await cli('verify', source, '--integrity', '--signing', `--keystore=${store}`, '--json');
    expect(verified.status).toBe(0);
    expect(JSON.parse(verified.stdout).signature_checks).toMatchObject({
      embedded_blocks: { requested: true, state: 'verified', present: 3, verified: 3 },
      detached_document: { requested: false, state: 'not_checked' },
    });
    const empty = resolve(temp, 'trusted-keys.json');
    writeFileSync(empty, JSON.stringify({ keystore_version: '1', keys: [] }));
    const unknown = await cli('verify', source, '--integrity', '--signing', `--keystore=${empty}`, '--json');
    expect(unknown.status).toBe(1);
    expect(JSON.parse(unknown.stdout).signature_checks.embedded_blocks).toMatchObject({
      requested: true, state: 'unverifiable', present: 3, verified: 0,
    });
    const text = await cli('verify', source, '--integrity', '--signing', `--keystore=${empty}`);
    expect(text.stdout).toContain('Embedded block signatures: unverifiable — 3 present, 0 verified');
    expect(text.stdout).toContain('Present but unverifiable');
    const detached = await cli('verify', source, '--integrity', `--document-signature=${resolve(fixture, 'signature.json')}`, `--keystore=${empty}`, '--json');
    expect(detached.status).toBe(1);
    expect(JSON.parse(detached.stdout).signature_checks).toMatchObject({
      embedded_blocks: { requested: false, state: 'not_checked' },
      detached_document: { requested: true, state: 'unverifiable', reason: 'unknown_kid' },
    });
  });
});
