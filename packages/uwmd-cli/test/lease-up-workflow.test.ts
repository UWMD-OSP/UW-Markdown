// Keep the public worked example executable without adding a production adapter.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('lease-up dated cash-flow worked example', () => {
  it('verifies every authored binding and reports the explicit partial-stream scope', () => {
    const script = fileURLToPath(new URL('../../../scripts/verify-lease-up-workflow.mjs', import.meta.url));
    const result = spawnSync(process.execPath, [script], { encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.source_verification).toBe('verified');
    expect(report.binding_checks).toHaveLength(2);
    expect(report.binding_checks.every((row: { matched: boolean }) => row.matched)).toBe(true);
    expect(report.series.series.map((row: { date: string }) => row.date)).toEqual(['2026-09-30', '2026-12-31']);
    expect(report.present_value).toMatchObject({ anchor: '2026-09-30', rate: 0.08, day_count: 'actual/365f', round_to: 2 });
    // Pin the engine-generated value quoted in the guide so the example cannot silently drift.
    expect(report.present_value.value).toBe(239528.83);
    expect(report.investment_returns).toContain('Not computed');
  });
});
