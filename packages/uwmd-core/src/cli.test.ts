import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const cli = resolve(process.cwd(), 'dist/cli.js');
const fixture = (name: string) =>
  resolve(process.cwd(), `../../conformance/hedge/0070-${name}/deal.uwx.md`);
describe('RFC 0070 CLI complete verification', () => {
  it.each([
    ['outright-payment', 0, 'verified'],
    ['stale-amount', 1, 'failed'],
    ['missing-sources-uses', 1, 'unverifiable'],
  ] as const)('%s JSON exposes independent state and exit', (name, status, state) => {
    const result = spawnSync(process.execPath, [cli, 'validate', fixture(name), '--json'], {
      encoding: 'utf8',
    });
    expect(result.status).toBe(status);
    const data = JSON.parse(result.stdout);
    expect(data.replacement_funding_verification.state).toBe(state);
    expect(data.errors.some((i: { code: string }) => i.code === 'HDG-09')).toBe(false);
  });
  it.each([
    ['outright-payment', 0, 'passed', 'verified'],
    ['stale-amount', 1, 'refused', 'failed'],
  ] as const)(
    '%s text distinguishes structural and complete verdicts',
    (name, status, complete, state) => {
      const result = spawnSync(process.execPath, [cli, 'validate', fixture(name)], {
        encoding: 'utf8',
      });
      expect(result.status).toBe(status);
      expect(result.stdout).toContain(`Complete validation: ${complete}`);
      expect(result.stdout).toContain(`Replacement funding verification: ${state}`);
      expect(result.stdout).toContain('Structural validation:');
      if (status === 1) expect(result.stdout).not.toContain('✓  CLEAN');
    }
  );
});

describe('RFC 0070 verify command', () => {
  it.each([
    ['outright-payment', 0, 'verified'],
    ['stale-amount', 1, 'failed'],
  ] as const)('verify --validate %s cannot skip bindings', (name, status, state) => {
    const result = spawnSync(
      process.execPath,
      [cli, 'verify', fixture(name), '--validate', '--json'],
      { encoding: 'utf8' }
    );
    expect(result.status).toBe(status);
    const data = JSON.parse(result.stdout);
    expect(data.ok).toBe(status === 0);
    expect(data.replacement_funding_verification.state).toBe(state);
    expect(data.validation.errors.some((i: { code: string }) => i.code === 'HDG-09')).toBe(false);
  });
  it('integrity-only verification explicitly leaves funding unchecked', () => {
    const result = spawnSync(
      process.execPath,
      [cli, 'verify', fixture('stale-amount'), '--integrity', '--json'],
      { encoding: 'utf8' }
    );
    expect(JSON.parse(result.stdout).replacement_funding_verification).toEqual({
      state: 'not_checked',
      reason: 'not_invoked',
      issues: [],
    });
  });
});

describe('uwmd --version', () => {
  const run = (...args: string[]) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  const manifest = JSON.parse(run('manifest').stdout);

  it.each(['--version', '-V', 'version'])('%s prints the manifest versions, not the help text', (flag) => {
    const result = run(flag);
    expect(result.status).toBe(0);
    expect(result.stdout.trim().split('\n')).toEqual([
      `@uwmd/core ${manifest.version}`,
      `Protocol ${manifest.protocol_version}`,
      `Format ${manifest.format_version}`,
    ]);
    expect(result.stdout).not.toContain('Commands:');
  });
});

describe('RFC 0064 read-only reserve CLI',()=>{
  it.each([{ flags: [] }, { flags: ['--json'] }])('reports a missing file without a stack trace ($flags)', ({ flags }) => {
    const missing = resolve(process.cwd(), 'missing-reserve-fixture.uwx.md');
    const result = spawnSync(process.execPath, [cli, 'verify-reserve-accounts', missing, ...flags], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr.trim()).toBe(`Error: file not found: ${missing}`);
  });
  it.each([['verified-source-classes',0,'verified'],['balance-mismatch',1,'failed'],['unclassified',1,'unverifiable'],['absent',0,'not_checked']] as const)('%s emits its independent result and exit status',(name,status,state)=>{
    const file=resolve(process.cwd(),`../../conformance/reserve-accounts/${name}/deal.uwx.md`);
    const result=spawnSync(process.execPath,[cli,'verify-reserve-accounts',file,'--json'],{encoding:'utf8'});
    expect(result.status,result.stderr).toBe(status); expect(JSON.parse(result.stdout).state).toBe(state);
  });
});

describe('RFC 0065 read-only binding CLI', () => {
  it('returns a typed JSON result for malformed plan JSON', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'uwmd-draw-json-'));
    const file = resolve(dir, 'plan.json');
    writeFileSync(file, '{ malformed');
    try {
      const deal = resolve(process.cwd(), '../../conformance/reserve-draw-bindings/one-to-one/deal.uwx.md');
      const result = spawnSync(process.execPath, [cli, 'verify-reserve-draws', deal, file, '--json'], { encoding: 'utf8' });
      expect(result.status).toBe(1);
      expect(result.stderr).toBe('');
      expect(JSON.parse(result.stdout)).toMatchObject({ state: 'unverifiable', reason: 'invalid_structure', issues: [{ code: 'RDB-01' }] });
    } finally { unlinkSync(file); rmdirSync(dir); }
  });
  it.each([['one-to-one', 0, 'verified'], ['incomplete-draw', 1, 'failed'], ['missing-account', 1, 'unverifiable'], ['absent', 0, 'not_checked']] as const)('%s exposes its independent result', (name, status, state) => {
    const dir = resolve(process.cwd(), `../../conformance/reserve-draw-bindings/${name}`);
    const args = [cli, 'verify-reserve-draws', resolve(dir, 'deal.uwx.md'), ...(name === 'absent' ? [] : [resolve(dir, 'plan.json')]), '--json'];
    const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(status);
    expect(JSON.parse(result.stdout).state).toBe(state);
  });
  it('handles a missing plan file without a stack trace', () => {
    const deal = resolve(process.cwd(), '../../conformance/reserve-draw-bindings/one-to-one/deal.uwx.md');
    const missing = resolve(process.cwd(), 'missing-binding-plan.json');
    const result = spawnSync(process.execPath, [cli, 'verify-reserve-draws', deal, missing, '--json'], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toBe(`Error: file not found: ${missing}`);
  });
});
