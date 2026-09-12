// Exercise the worked example and production projection CLI through built artifacts.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('lease-up dated cash-flow worked example', () => {
  it('verifies every authored binding and reports the explicit partial-stream scope', () => {
    const script = fileURLToPath(
      new URL('../../../scripts/verify-lease-up-workflow.mjs', import.meta.url)
    );
    const result = spawnSync(process.execPath, [script], { encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.source_envelope_digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(report.source_verification).toBe('verified');
    expect(report.binding_checks).toHaveLength(2);
    expect(report.binding_checks.every((row: { matched: boolean }) => row.matched)).toBe(true);
    expect(report.series.series.map((row: { date: string }) => row.date)).toEqual([
      '2026-09-30',
      '2026-12-31',
    ]);
    expect(report.present_value).toMatchObject({
      anchor: '2026-09-30',
      rate: 0.08,
      day_count: 'actual/365f',
      round_to: 2,
    });
    // Pin the engine-generated value quoted in the guide so the example cannot silently drift.
    expect(report.present_value.value).toBe(239528.83);
    expect(report.investment_returns).toContain('Not computed');
  });
});

describe('project-lease-up CLI', () => {
  const cli = fileURLToPath(new URL('../bin/uwmd.mjs', import.meta.url));
  const source = fileURLToPath(
    new URL('../../../conformance/lease-up/valid-value-add-turnover/deal.uwx.md', import.meta.url)
  );
  const plan = fileURLToPath(
    new URL('../../../docs/examples/lease-up-cash-dates.json', import.meta.url)
  );
  const run = (args: string[]) =>
    spawnSync(process.execPath, [cli, 'project-lease-up', ...args], { encoding: 'utf8' });
  it('prints a reviewable candidate and preserves both input files', () => {
    const before = [readFileSync(source, 'utf8'), readFileSync(plan, 'utf8')];
    const result = run([source, plan, '--json']);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    const projection = JSON.parse(result.stdout);
    expect(projection.source_envelope_digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(projection.bindings.map((row: { amount: number }) => row.amount)).toEqual([
      118475, 123425,
    ]);
    expect([readFileSync(source, 'utf8'), readFileSync(plan, 'utf8')]).toEqual(before);
  });
  it('returns typed JSON for malformed plan JSON', () => {
    const result = run([source, source, '--json']);
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).error).toMatchObject({
      code: 'CALC-LU-PROJECTION',
      pointer: 'plan',
    });
  });
  it('retains verifier evidence in CLI refusal JSON', () => {
    const invalid = fileURLToPath(
      new URL('../../../conformance/lease-up-projection/failed/deal.uwx.md', import.meta.url)
    );
    const result = run([invalid, plan, '--json']);
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).error.evidence.verification.verdict).toBe('failed');
  });
  it('refuses unsupported write flags', () => {
    const result = run([source, plan, '--in-place']);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
  });
});
