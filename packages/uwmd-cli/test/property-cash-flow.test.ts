import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const path = (p: string) => fileURLToPath(new URL(`../../../${p}`, import.meta.url));
const cli = path('packages/uwmd-cli/bin/uwmd.mjs');
const source = path('docs/examples/property-cash-flow-synthetic.uwx.md');
const plan = path('docs/examples/property-cash-flow-plan.json');
const run = (args: string[]) => spawnSync(process.execPath, [cli, 'assemble-property', ...args], { encoding: 'utf8' });
describe('property cash-flow assembly CLI', () => {
  it('verifies the synthetic workflow against pinned existing-engine metric outputs', () => {
    const result = spawnSync(process.execPath, [path('scripts/verify-property-cash-flow-workflow.mjs')], { encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout).metrics).toEqual(JSON.parse(readFileSync(path('docs/examples/property-cash-flow-metrics.json'), 'utf8')));
  });
  it('emits a complete declared candidate without changing source or plan', () => {
    const before = [readFileSync(source, 'utf8'), readFileSync(plan, 'utf8')];
    const result = run([source, plan, '--json']);
    expect(result.status, result.stderr).toBe(0);
    const value = JSON.parse(result.stdout);
    expect(value.coverage).toBe('declared_complete');
    expect(value.series.series).toHaveLength(12);
    expect(value.series.series[0]).toMatchObject({ date: '2026-07-01', amount: -1000000 });
    expect(value.plan).toMatchObject({ basis: 'unlevered', tax_basis: 'pre_tax', currency_code: 'USD' });
    expect([readFileSync(source, 'utf8'), readFileSync(plan, 'utf8')]).toEqual(before);
  });
  it('reports malformed plan JSON as a typed refusal', () => {
    const result = run([source, source, '--json']);
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).error).toMatchObject({ code: 'CALC-CF-ASSEMBLY', reason: 'plan', pointer: 'plan' });
  });
  it('preserves nested lease-up verification evidence', () => {
    const result = run([path('conformance/property-cash-flow-assembly/failed-lease-up/deal.uwx.md'), plan, '--json']);
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).error.evidence.lease_up.evidence.verification.verdict).toBe('failed');
  });
  it('prints a readable refusal without JSON mode', () => {
    const result = run([source, path('conformance/property-cash-flow-assembly/missing-coverage/plan.json')]);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('CALC-CF-ASSEMBLY');
    expect(result.stderr).toContain('plan.coverage');
  });
  it.each(['--in-place', '--output', '--calc-context'])('refuses unsupported %s', flag => {
    const result = run([source, plan, flag]);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
  });
});
