import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { issueReceipt, verifyReceipt } from './receipts.js';

const original = readFileSync(new URL('../../../examples/Parkview-Apts-Glendale-AZ.uwx.md', import.meta.url), 'utf8');
const options = { filename: 'payload.uwx.md', issued_at: '2026-10-19T00:00:00Z' };
function appended(section: string, body: unknown) {
  return `${original}\n\`\`\`json uw:section=${section} v=999\n${JSON.stringify(body)}\n\`\`\`\n`;
}
describe('RFC0096 receipt policy counts remain separate from financial verdicts', () => {
  it.each([
    ['lease_up_schedule', { model_type: 'absorption_curve', period_granularity: 'monthly', schedule: [{ period: '2026-01' }] }, 'model_type', false],
    ['rent_roll', { tenants: [{ recovery_terms: { method: 'net', admin_fee_pct: 0 } }] }, 'tenants', [{ recovery_terms: { method: 'net', admin_fee_pct: false } }]],
    ['capital_stack', { tranches: [], sizing: [] }, 'sizing', false],
    ['distribution_waterfall', { stated_outcomes: {} }, 'stated_outcomes', false],
  ] as const)('%s adds one policy error without changing computation or authentication rules', async (section, body, field, invalid) => {
    const beforeSource = appended(section, body); const afterSource = appended(section, { ...body, [field]: invalid });
    const before = await issueReceipt(beforeSource, options); const after = await issueReceipt(afterSource, options);
    expect(after.policy.validation).toEqual({ errors: before.policy.validation.errors + 1, warnings: before.policy.validation.warnings });
    expect(after.computation).toEqual(before.computation);
    expect(after.subject.digest).not.toBe(before.subject.digest);
    expect((await verifyReceipt(after, afterSource, options)).verdict).toBe('verified');
    expect((await verifyReceipt(after, beforeSource, options)).verdict).toBe('failed');
  });
});
