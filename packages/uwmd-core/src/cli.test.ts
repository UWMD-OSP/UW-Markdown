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
