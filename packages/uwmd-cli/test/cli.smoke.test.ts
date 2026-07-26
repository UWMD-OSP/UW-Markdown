import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { describe, it, expect } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_BIN = resolve(__dirname, '..', 'bin', 'uwmd.mjs');
const FIXTURE = resolve(__dirname, '..', '..', '..', 'examples', 'Parkview-Apts-Glendale-AZ.uw.md');

function runCli(args: string[]) {
  return spawnSync(process.execPath, [CLI_BIN, ...args], { encoding: 'utf8' });
}

describe('uwmd CLI', () => {
  it('prints help on --help with exit code 0', () => {
    const r = runCli(['--help']);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/uwmd/i);
  });

  it('parses the bundled Parkview fixture to JSON on stdout', () => {
    const r = runCli(['parse', FIXTURE]);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed).toMatchObject({
      frontmatter: expect.any(Object),
      sections: expect.any(Object),
    });
  });

  it('validates the bundled fixture without errors', () => {
    const r = runCli(['validate', FIXTURE]);
    expect(r.status).toBe(0);
  });
  it('exports a digested UW Document Envelope to stdout', () => {
    const r = runCli(['export', FIXTURE, '--stdout']);
    expect(r.status).toBe(0);
    const exported = JSON.parse(r.stdout);
    expect(exported.envelope_version).toBe('1.0');
    expect(exported.semantic_digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(exported).not.toHaveProperty('uwjson_version');
    expect(exported).not.toHaveProperty('prose');
  });

  it('converts Markdown to deterministic UW XML on stdout', () => {
    const r = runCli(['convert', FIXTURE, '--to', 'uw-xml', '--stdout']);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    expect(r.stdout).toContain('<uw:document xmlns:uw="https://uwmd.org/ns/document/1"');
    expect(r.stdout).toMatch(/<uw:semantic_digest uw:type="string">sha256:[0-9a-f]{64}<\/uw:semantic_digest>/);
  });

  it('converts verified UW XML back to UW JSON', () => {
    const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-cli-'));
    try {
      const xml = runCli(['convert', FIXTURE, '--to', 'xml', '--stdout']);
      expect(xml.status).toBe(0);
      const xmlPath = resolve(temp, 'deal.uw.xml');
      writeFileSync(xmlPath, xml.stdout, 'utf8');
      const json = runCli(['convert', xmlPath, '--to', 'json', '--stdout']);
      expect(json.status).toBe(0);
      const envelope = JSON.parse(json.stdout);
      expect(envelope.envelope_version).toBe('1.0');
      expect(envelope.semantic_digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });
  it('lists registered representations for API discovery', () => {
    const r = runCli(['formats', '--json']);
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout)).toContainEqual(
      expect.objectContaining({ id: 'uw-json', fidelity: 'model' }),
    );
    expect(JSON.parse(r.stdout)).toContainEqual(
      expect.objectContaining({ id: 'uw-xml', fidelity: 'model' }),
    );
  });
  it('exits non-zero on a missing file', () => {
    const r = runCli(['parse', resolve(__dirname, 'this-file-does-not-exist.uw.md')]);
    expect(r.status).not.toBe(0);
  });
});
