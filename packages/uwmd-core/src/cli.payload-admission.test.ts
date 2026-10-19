import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runProcess } from '../../../test/cli.mjs';
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });
const cli = resolve(process.cwd(), 'dist/cli.js');
const header = '---\nuw_version: "3.0"\nasset_class: multifamily\ndeal_id: payload0096-cli\n---\n';
describe('RFC0096 actual CLI structural error transport', () => {
  it.each([
    ['lease_up_schedule', { model_type: false, period_granularity: 'monthly', schedule: [{ period: '2026-01' }] }, 'LU-05','model_type'],
    ['rent_roll', { tenants: [{ recovery_terms: { method: 'net', admin_fee_pct: false } }] }, 'REC-11','tenants[0].recovery_terms.admin_fee_pct'],
    ['capital_stack', { tranches: [], sizing: false }, 'CS-03','sizing'],
    ['distribution_waterfall', { stated_outcomes: false }, 'WF-16','stated_outcomes'],
  ] as const)('%s produces registered errors with unchanged read-only source', async (section, body, code, field) => {
    const folder = mkdtempSync(resolve(tmpdir(), 'uwmd-payload0096-')); const file = resolve(folder, 'deal.uwx.md');
    const source = `${header}\`\`\`json uw:section=${section}\n${JSON.stringify(body)}\n\`\`\`\n`; writeFileSync(file, source);
    try {
      const observed = await runProcess(process.execPath, [cli, 'validate', file, '--json'], { encoding: 'utf8' });
      expect(observed.status).toBe(1); expect(observed.stderr).toBe('');
      const result = JSON.parse(observed.stdout);
      expect(result.errors.filter((i: {code:string}) => i.code === code).map((i: {field:string}) => i.field)).toEqual([field]);
      expect(result.errors).toEqual(result.issues.filter((i: {severity:string}) => i.severity === 'error'));
      expect(result.overall_status).toBe('errors'); expect(result.stage_readiness).toHaveProperty('scope');
      expect(readFileSync(file, 'utf8')).toBe(source);
    } finally { rmSync(folder, { recursive: true, force: true }); }
  });
});
