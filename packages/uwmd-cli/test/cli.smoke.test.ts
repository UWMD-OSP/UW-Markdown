import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
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

  it('lists registered representations for API discovery', () => {
    const r = runCli(['formats', '--json']);
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout)).toContainEqual(
      expect.objectContaining({ id: 'uw-json', fidelity: 'model' }),
    );
  });
  it('exits non-zero on a missing file', () => {
    const r = runCli(['parse', resolve(__dirname, 'this-file-does-not-exist.uw.md')]);
    expect(r.status).not.toBe(0);
  });
});
