import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const path = (p: string) => fileURLToPath(new URL(`../../../${p}`, import.meta.url));
const cli = path('packages/uwmd-cli/bin/uwmd.mjs');
const source = path('conformance/cash-flow/valid-hold-period/deal.uwx.md');
const directory = mkdtempSync(join(tmpdir(), 'uwmd-cf-cli-'));
afterAll(() => rmSync(directory, { recursive: true, force: true }));
const run = (args: string[]) => spawnSync(process.execPath, [cli, 'verify-cash-flows', ...args], { encoding: 'utf8' });

describe('cash-flow verification command', () => {
  it('verifies the existing fixture without changing bytes', () => {
    const before = readFileSync(source);
    const result = run(['--json', source, '--variant=base']);
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ status: 'verified', variant: 'base',
      checked_metrics: ['total_net', 'moic', 'xnpv', 'xirr'], verification: { verdict: 'verified' } });
    expect(readFileSync(source)).toEqual(before);
  });
  it('prints a qualified human-readable result', () => {
    const result = run([source]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('4 stated metrics');
    expect(result.stdout).toContain('does not establish economic completeness');
  });
  it('returns disagreement and no-claim exit codes', () => {
    const fixture = readFileSync(source, 'utf8');
    const bad = join(directory, 'bad.uwx.md');
    writeFileSync(bad, fixture.replace('6043000', '1'));
    const failed = run([bad, '--json']);
    expect(failed.status).toBe(1);
    expect(JSON.parse(failed.stdout).verification.verdict).toBe('failed');
    const noClaims = path('docs/examples/property-cash-flow-synthetic.uwx.md');
    const empty = run([noClaims, '--json']);
    expect(empty.status, empty.stderr).toBe(3);
    expect(JSON.parse(empty.stdout)).toMatchObject({ status: 'no_stated_metrics', verification: null });
  });
  it('reports missing files and malformed JSON as machine-readable errors', () => {
    const bad = join(directory, 'malformed.uwx.md');
    writeFileSync(bad, '\n```json uw:section=cash_flow_series\n{broken\n```');
    for (const file of [join(directory, 'absent.uwx.md'), bad]) {
      const result = run([file, '--json']);
      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout).error.code).toBe('CALC-CF-SERIES');
      expect(result.stderr).toBe('');
    }
  });
  it.each(['--in-place', '--output=copy', '--calc-context=overrides', '--json=false'])('refuses %s', flag => {
    const result = run([source, flag, '--json']);
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).error.pointer).toBe('arguments');
  });
});
