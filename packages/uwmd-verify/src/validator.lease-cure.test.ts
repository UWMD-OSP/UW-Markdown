import { describe, expect, it } from 'vitest';
import { buildMeta } from './metadata.js';
import { parseUWFile } from './parser.js';
import { validateUWFile } from './validator.js';
import type { UWBlock, ParsedUWFile } from './types.js';

const tenant = (cure: unknown) => ({
  tenant_id: 'T1', lease_commencement: '2026-01-01', lease_expiration: '2031-12-31',
  co_tenancy_clause: true,
  co_tenancy_details: { trigger: 'occupancy_threshold', occupancy_threshold: .7, remedy: 'termination_right', cure_period_months: cure },
});
function source(...tenants: Record<string, unknown>[]): string {
  const meta = buildMeta('rent_roll', 1, { source: 'manual', actor: 'test', timestamp: '2026-10-19T00:00:00Z' });
  return `---
uw_version: "3.0"
asset_class: office
---
\`\`\`json uw:section=rent_roll
${JSON.stringify({ _meta: meta, rent_roll_type: 'commercial', tenants })}
\`\`\`
`;
}
const clauses = (input: string | ParsedUWFile) => validateUWFile(input).issues
  .filter(issue => issue.code.startsWith('LSE-')).map(({ code, severity, section, field }) => ({ code, severity, section, field }));
const cureError = (index = 0) => ({ code: 'LSE-07', severity: 'error', section: 'rent_roll', field: `tenants[${index}].co_tenancy_details.cure_period_months` });
function modelTenant(model: ParsedUWFile): Record<string, unknown> {
  return ((model.sections.rent_roll as UWBlock).content.tenants as Record<string, unknown>[])[0]!;
}

describe('RFC0055 cure whole-number admission distinct from safe termination notice', () => {
  it.each([0, 1, Number.MAX_SAFE_INTEGER, 9007199254740992, 1e100, Number.MAX_VALUE])('admits finite nonnegative whole cure %s in SOURCE and MODEL without writes', cure => {
    const raw = source(tenant(cure)); const model = parseUWFile(raw); const before = structuredClone(model);
    expect(clauses(raw)).toEqual([]); expect(clauses(model)).toEqual([]);
    expect(model).toEqual(before); expect(model.raw).toBe(raw);
  });
  it.each([-1, -.5, 1.5, true, false, '1', '9007199254740992', [], {}].map(cure => ({ cure })))('refuses wrong-type/negative/fractional cure ($cure) at the existing exact field', ({ cure }) => {
    const raw = source(tenant(cure)); const model = parseUWFile(raw); const before = structuredClone(model);
    expect(clauses(raw)).toEqual([cureError()]); expect(clauses(model)).toEqual([cureError()]);
    expect(model).toEqual(before); expect(model.raw).toBe(raw);
  });
  it('preserves optional absent/null cure and exact negative-zero source admission', () => {
    const absent = tenant(null); delete (absent.co_tenancy_details as Record<string, unknown>).cure_period_months;
    expect(clauses(source(absent, tenant(null)))).toEqual([]);
    const raw = source(tenant(0)).replace('"cure_period_months":0', '"cure_period_months":-0');
    const model = parseUWFile(raw);
    expect(Object.is((modelTenant(model).co_tenancy_details as Record<string, unknown>).cure_period_months, -0)).toBe(true);
    expect(clauses(raw)).toEqual([]); expect(clauses(model)).toEqual([]); expect(model.raw).toBe(raw);
  });
  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])('refuses mutable MODEL nonfinite cure %s under LSE07 without changing source evidence', cure => {
    const raw = source(tenant(1)); const model = parseUWFile(raw);
    (modelTenant(model).co_tenancy_details as Record<string, unknown>).cure_period_months = cure;
    const before = structuredClone(model);
    expect(clauses(model)).toEqual([cureError()]); expect(model).toEqual(before); expect(model.raw).toBe(raw);
    expect(clauses(raw)).toEqual([]);
  });
  it.each(['1e309', '-1e309'])('refuses decoded nonfinite SOURCE cure %s without rewriting its lexeme', lexeme => {
    const raw = source(tenant(0)).replace('"cure_period_months":0', `"cure_period_months":${lexeme}`);
    const model = parseUWFile(raw); const before = structuredClone(model);
    expect(clauses(raw)).toEqual([cureError()]); expect(clauses(model)).toEqual([cureError()]);
    expect(model).toEqual(before); expect(model.raw).toBe(raw);
  });
  it('reads live MODEL cure and checks every tenant with existing exact index attribution', () => {
    const raw = source(tenant(1), tenant(1.5)); const model = parseUWFile(raw);
    const details = modelTenant(model).co_tenancy_details as Record<string, unknown>;
    details.cure_period_months = 9007199254740992;
    expect(clauses(model)).toEqual([cureError(1)]);
    details.cure_period_months = .5;
    expect(clauses(model)).toEqual([cureError(0), cureError(1)]);
    expect(model.raw).toBe(raw);
  });
  it('retains explicit safe notice ceiling and unrelated diagnostic ordering', () => {
    const item = { ...tenant(9007199254740992), termination_option: { earliest_date: '2029-06-30', notice_months: Number.MAX_SAFE_INTEGER, penalty: null } };
    expect(clauses(source(item))).toEqual([]);
    item.termination_option.notice_months = 9007199254740992;
    item.co_tenancy_details.occupancy_threshold = 0;
    const details = item.co_tenancy_details as Record<string, unknown>;
    details.remedy_value = .5; details.cure_period_months = 1.5;
    expect(clauses(source(item))).toEqual([
      { code: 'LSE-04', severity: 'error', section: 'rent_roll', field: 'tenants[0].termination_option.notice_months' },
      { code: 'LSE-07', severity: 'error', section: 'rent_roll', field: 'tenants[0].co_tenancy_details.occupancy_threshold' },
      { code: 'LSE-08', severity: 'error', section: 'rent_roll', field: 'tenants[0].co_tenancy_details.remedy_value' },
      cureError(),
    ]);
  });
});
