import { runProcess as spawnCli } from '../../../test/cli.mjs';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

// These tests exercise built executables, stdout/stderr and exit codes.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const path = (p: string) => fileURLToPath(new URL(`../../../${p}`, import.meta.url));
const cli = path('packages/uwmd-cli/bin/uwmd.mjs');
const source = path('docs/examples/property-cash-flow-synthetic.uwx.md');
const plan = path('docs/examples/property-cash-flow-plan.json');
const run = (args: string[]) => spawnCli(process.execPath, [cli, 'assemble-property', ...args], { encoding: 'utf8' });
const inspect = (args: string[]) => spawnCli(process.execPath, [cli, 'inspect-property-cash-flows', ...args], { encoding: 'utf8' });
describe('property cash-flow assembly CLI', () => {
  it('inventories source inputs without producing a plan or editing the deal', async () => {
    const before = readFileSync(source, 'utf8');
    const result = await inspect([source, '--json']);
    expect(result.status, result.stderr).toBe(0);
    const value = JSON.parse(result.stdout);
    expect(value.lease_up_schedule[0]).toMatchObject({ variant: 'base', shape: 'usable' });
    expect(value.cash_flow_series[0].rows.length).toBeGreaterThan(0);
    expect(value.notes.join(' ')).toContain('does not establish metric verification');
    expect(readFileSync(source, 'utf8')).toBe(before);
  });

  it('refuses unsupported inventory flags', async () => {
    const result = await inspect([source, '--output', 'plan.json']);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
  });

  it('verifies the synthetic workflow against pinned existing-engine metric outputs', async () => {
    const result = await spawnCli(process.execPath, [path('scripts/verify-property-cash-flow-workflow.mjs')], { encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout).metrics).toEqual(JSON.parse(readFileSync(path('docs/examples/property-cash-flow-metrics.json'), 'utf8')));
  });
  it('emits a complete declared candidate without changing source or plan', async () => {
    const before = [readFileSync(source, 'utf8'), readFileSync(plan, 'utf8')];
    const result = await run([source, plan, '--json']);
    expect(result.status, result.stderr).toBe(0);
    const value = JSON.parse(result.stdout);
    expect(value.coverage).toBe('declared_complete');
    expect(value.series.series).toHaveLength(12);
    expect(value.series.series[0]).toMatchObject({ date: '2026-07-01', amount: -1000000 });
    expect(value.plan).toMatchObject({ basis: 'unlevered', tax_basis: 'pre_tax', currency_code: 'USD' });
    expect([readFileSync(source, 'utf8'), readFileSync(plan, 'utf8')]).toEqual(before);
  });
  it('reports malformed plan JSON as a typed refusal', async () => {
    const result = await run([source, source, '--json']);
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).error).toMatchObject({ code: 'CALC-CF-ASSEMBLY', reason: 'plan', pointer: 'plan' });
  });
  it('preserves nested lease-up verification evidence', async () => {
    const result = await run([path('conformance/property-cash-flow-assembly/failed-lease-up/deal.uwx.md'), plan, '--json']);
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).error.evidence.lease_up.evidence.verification.verdict).toBe('failed');
  });
  it('prints a readable refusal without JSON mode', async () => {
    const result = await run([source, path('conformance/property-cash-flow-assembly/missing-coverage/plan.json')]);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('CALC-CF-ASSEMBLY');
    expect(result.stderr).toContain('plan.coverage');
  });
  it.each(['--in-place', '--output', '--calc-context'])('refuses unsupported %s', async flag => {
    const result = await run([source, plan, flag]);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
  });
});

describe('RFC 0063 assembly CLI plan member', () => {
  it.each(['monthly', 'quarterly'])('accepts explicit %s boundary via the existing plan-file command', async cadence => {
    const dir = `conformance/property-cash-flow-assembly/boundary-${cadence}-year-rollover`;
    const result = await run([path(`${dir}/deal.uwx.md`), path(`${dir}/plan.json`), '--json']);
    expect(result.status, result.stderr).toBe(0);
    const value = JSON.parse(result.stdout);
    expect(value.plan.disposition_period_rule).toBe('allow_exclusive_end');
    expect(value.series.series.at(-1).date).toBe('2028-01-01');
    expect(value.series.series).toHaveLength(12);
  });
  it('still refuses a boundary when the plan omits the option', async () => {
    const dir = 'conformance/property-cash-flow-assembly/boundary-monthly-boundary-absent';
    const result = await run([path(`${dir}/deal.uwx.md`), path(`${dir}/plan.json`), '--json']);
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).error).toMatchObject({ reason: 'date_horizon', pointer: 'plan' });
  });
});
