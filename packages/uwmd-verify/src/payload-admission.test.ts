import { describe, expect, it } from 'vitest';
import { parseUWFile } from './parser.js';
import { validateUWFile } from './validator.js';
import { checkPayloadAdmission } from './payload-admission.js';
import type { UWBlock, ValidationMessage } from './types.js';

const codes = new Set(['LU-05', 'REC-11', 'CS-03', 'WF-16']);
const classes = new Set(['office', 'retail']);
const header = '---\nuw_version: "3.0"\nasset_class: mixed_use\ndeal_id: payload0096\n---\n';
function doc(section: string, body: unknown, suffix = '') { return header + fence(section, body, suffix); }
function fence(section: string, body: unknown, suffix = '') { return '```json uw:section=' + section + suffix + '\n' + JSON.stringify(body) + '\n```\n'; }
function assess(section: string, body: Record<string, unknown>): ValidationMessage[] {
  const parsed = parseUWFile(doc(section, {})); (parsed.sections[section] as UWBlock).content = body;
  const issues: ValidationMessage[] = []; checkPayloadAdmission(parsed, issues, classes); return issues;
}
function fields(section: string, body: Record<string, unknown>) { return assess(section, body).map(i => i.field); }
const lu = (extra = {}) => ({ model_type: 'absorption_curve', period_granularity: 'monthly', schedule: [{ period: '2026-01' }], ...extra });
const rec = (terms: unknown, rows?: unknown) => ({ tenants: [{ recovery_terms: terms, ...(rows === undefined ? {} : { recovery_true_up: rows }) }] });
const figure = (extra = {}) => ({ id: 'size', fn: 'coverage', over: 'senior', value: 0, ...extra });
const wf = (extra = {}) => ({ ...extra });

describe('RFC0096 LU05 closed predicates', () => {
  it.each([undefined, null, false, '', 'unknown'])('requires a closed model identity %s', model_type => {
    expect(fields('lease_up_schedule', lu({ model_type }))).toEqual(['model_type']);
  });
  it.each(['occupied_sf', 'leased_sf', 'in_place_rent_psf', 'market_rent_psf', 'vacancy_rate', 'rent_revenue', 'concessions', 'ti_lc_capex', 'net_cash_flow'])('checks row %s independently of period', field => {
    expect(fields('lease_up_schedule', lu({ schedule: [{ period: 'bad', [field]: false }] }))).toEqual([`schedule[0].${field}`]);
  });
  it.each(['monthly_turnover_rate', 'market_rent_psf_at_stabilization', 'vacancy_during_lease_up', 'concession_months_per_lease', 'tenant_improvement_psf', 'leasing_commission_rate'])('checks assumption %s', field => {
    expect(fields('lease_up_schedule', lu({ assumptions: { [field]: false } }))).toEqual([`assumptions.${field}`]);
  });
  it.each(['occupied_sf', 'occupancy_rate', 'annualized_egi', 'annualized_noi'])('checks summary %s', field => {
    expect(fields('lease_up_schedule', lu({ stabilized_summary: { [field]: false } }))).toEqual([`stabilized_summary.${field}`]);
  });
  it('preserves nullable/signed/boundary values and imposes no inferred sign', () => {
    expect(fields('lease_up_schedule', lu({ stabilization_target: null, assumptions: { monthly_turnover_rate: 0, vacancy_during_lease_up: 1 }, schedule: [{ period: '2026-01', occupied_sf: 0, concessions: 5, ti_lc_capex: -2, net_cash_flow: null }], stabilized_summary: { occupancy_rate: 1, annualized_noi: -10 }, _notes: { opaque: true } }))).toEqual([]);
  });
  it('checks target type independently but grammar only under own admitted cadence', () => {
    for (const cadence of [undefined, null, 'bad']) {
      expect(fields('lease_up_schedule', lu({ period_granularity: cadence, stabilization_target: 'bad' }))).toEqual([]);
      expect(fields('lease_up_schedule', lu({ period_granularity: cadence, stabilization_target: false }))).toEqual(['stabilization_target']);
    }
    for (const target of ['2026-Q1', '2026-01\n', '２０２６-01', '2026-13']) expect(fields('lease_up_schedule', lu({ stabilization_target: target }))).toEqual(['stabilization_target']);
    expect(fields('lease_up_schedule', lu({ period_granularity: 'quarterly', stabilization_target: '0000-Q4' }))).toEqual([]);
  });
  it('stops failed parents, retains siblings and orders known fields then extra code points', () => {
    expect(fields('lease_up_schedule', lu({ model_type: false, assumptions: false, schedule: [null, { period: '2026-01', occupied_sf: -1, z: 1 }], stabilized_summary: false, '😀': 1, '\ue000': 1 }))).toEqual(['model_type', 'assumptions', 'schedule[1].occupied_sf', 'schedule[1].z', 'stabilized_summary', '\ue000', '😀']);
  });
});

describe('RFC0096 REC11 leaves and existing owners', () => {
  it.each(['share_basis', 'base_year', 'expense_stop_per_sqft', 'fixed_recovery_annual', 'admin_fee_pct', 'gross_up_pct'])('checks term %s', field => {
    expect(fields('rent_roll', rec({ method: 'net', [field]: false }))).toEqual([`tenants[0].recovery_terms.${field}`]);
  });
  it.each(['pool_actual', 'tenant_share_uncapped', 'tenant_share_capped', 'estimated_billed', 'true_up_amount'])('checks true-up %s', field => {
    expect(fields('rent_roll', rec({}, [{ [field]: false }]))).toEqual([`tenants[0].recovery_true_up[0].${field}`]);
  });
  it.each([
    [{}, { pct: .05 }, []], [{}, { pct: .05, accumulation: null }, []],
    [{}, { pct: .05, accumulation: 'bad' }, ['REC-11']], [{}, { pct: null, accumulation: 'bad' }, ['REC-11']],
    [{ method: 'net' }, { pct: .05 }, ['REC-02']], [{ method: 'net' }, { pct: .05, accumulation: null }, ['REC-02']],
    [{ method: null }, { pct: .05, accumulation: null }, ['REC-02']],
    [{ method: 'net' }, { pct: null, accumulation: 'bad' }, ['REC-11']],
    [{ method: 'net' }, { pct: false, accumulation: null }, ['REC-01', 'REC-02']],
  ])('pins exact M/P null ownership %j %j', (terms, cap, expected) => {
    const all = validateUWFile(doc('rent_roll', rec({ ...terms, cap }))).issues;
    expect(all.filter(i => ['REC-01', 'REC-02', 'REC-11'].includes(i.code)).map(i => i.code)).toEqual(expected);
  });
  it('null companions do not require method; method null remains its own error', () => {
    const body = rec({ pro_rata_share: null, base_year: null, admin_fee_pct: null });
    expect(validateUWFile(doc('rent_roll', body)).issues.filter(i => i.code.startsWith('REC-'))).toEqual([]);
    expect(validateUWFile(doc('rent_roll', rec({ method: null }))).issues.filter(i => i.code === 'REC-02').map(i => i.field)).toEqual(['tenants[0].recovery_terms.method']);
  });
  it('admits exact numeric bounds/signed results and unbounded finite integers', () => {
    expect(fields('rent_roll', rec({ share_basis: 'nra', base_year: Number.MAX_SAFE_INTEGER + 1, expense_stop_per_sqft: 0, fixed_recovery_annual: null, admin_fee_pct: 0, gross_up_pct: 1, cap: { over: null, accumulation: null } }, [{ pool_actual: 0, tenant_share_uncapped: null, true_up_amount: -20 }]))).toEqual([]);
    expect(fields('rent_roll', rec({ admin_fee_pct: 1, gross_up_pct: 0, cap: { over: false, accumulation: false, z: 1 }, z: 1 }, [{ estimated_billed: -1, z: 1 }]))).toEqual(['tenants[0].recovery_terms.admin_fee_pct','tenants[0].recovery_terms.gross_up_pct','tenants[0].recovery_terms.cap.over','tenants[0].recovery_terms.cap.accumulation','tenants[0].recovery_terms.cap.z','tenants[0].recovery_terms.z','tenants[0].recovery_true_up[0].estimated_billed','tenants[0].recovery_true_up[0].z']);
  });
  it('does not steal malformed parent/date/reference ownership', () => {
    expect(fields('rent_roll', rec(false, [null, { period_start: false, cash_flow_ref: false }]))).toEqual([]);
    expect(fields('rent_roll', rec({ cap: false }))).toEqual([]);
  });
  it('checks unselected current peer owners without expanding financial arithmetic or LSE checks', () => {
    const source = header + fence('rent_roll', rec({ method: 'net' }, [{ period_start: '2025-01-01', period_end: '2025-12-31', pool_actual: 100, tenant_share_uncapped: 9, tenant_share_capped: 10, estimated_billed: 0, true_up_amount: 3 }]), ' variant=base') + fence('rent_roll', rec({ method: 'net', cap: { pct: .05 }, admin_fee_pct: false }, [{ period_start: 'bad', period_end: 'bad' }]), ' variant=other');
    const all = validateUWFile(source).issues;
    expect(all.some(i => i.code === 'REC-02' && i.field === 'tenants[0].recovery_terms.cap.accumulation')).toBe(true);
    expect(all.some(i => i.code === 'REC-04')).toBe(true);
    expect(all.filter(i => i.code === 'REC-11').map(i => i.field)).toEqual(['tenants[0].recovery_terms.admin_fee_pct']);
  });
});

describe('RFC0096 CS03 declarations and components', () => {
  it.each([null, false, 'bad', {}])('rejects stated sizing carrier %s', sizing => expect(fields('capital_stack', { sizing })).toEqual(['sizing']));
  it('admits absent/empty sizing and signed zero claim without resolving its selector', () => {
    expect(fields('capital_stack', {})).toEqual([]); expect(fields('capital_stack', { sizing: [] })).toEqual([]);
    expect(fields('capital_stack', { sizing: [figure({ over: 'nonexistent', value: -1 }), { id: ' ', fn: 'ltv_through', through: Number.MAX_SAFE_INTEGER + 1, value: 0 }] })).toEqual([]);
  });
  it('orders required members, selector union, value and extras without cascading selectors', () => {
    expect(fields('capital_stack', { sizing: [null, { id: '', fn: false, over: null, through: false, value: false, z: 1 }, { id: 'i', fn: 'coverage', over: null, value: 0 }] })).toEqual(['sizing[0]', 'sizing[1].id','sizing[1].fn','sizing[1]','sizing[1].value','sizing[1].z','sizing[2].over']);
  });
  it('limits component checks to mixed-use admitted declared classes and qualifies fields', () => {
    const content = { office: { component_class: 'office', capital_stack: { sizing: false } }, retail: { component_class: 'wrong', capital_stack: { sizing: false } }, x_private: { component_class: 'x_private', capital_stack: { sizing: false } } };
    expect(fields('components', content)).toEqual(['office.capital_stack.sizing']);
    const parsed = parseUWFile(doc('components', content)); parsed.frontmatter.asset_class = 'office';
    const issues: ValidationMessage[] = []; checkPayloadAdmission(parsed, issues, classes); expect(issues).toEqual([]);
  });
});

describe('RFC0096 WF16 claims and selected-floor exclusions', () => {
  it.each(['contributions','distributions','moic','xirr'])('checks party %s', field => expect(fields('distribution_waterfall', wf({ stated_outcomes: { lp: { [field]: false } } }))).toEqual([`stated_outcomes.lp.${field}`]));
  it('stops parents and preserves exact claim/row/tier order', () => {
    expect(fields('distribution_waterfall', wf({ clawback: { basis: 'lp_irr_floor', floor_rate: false, floor_multiple: false, z: 1 }, stated_outcomes: { lp: false, gp: { moic: -1, xirr: false, z: 1 }, promote_total: false, profit_total: false, clawback_amount: false, z: 1 }, stated_schedule: [{ date: false, by_tier: [false, { tier: false, lp: false, gp: false, z: 1 }], z: 1 }] }))).toEqual(['clawback.floor_multiple','clawback.z','stated_outcomes.lp','stated_outcomes.gp.moic','stated_outcomes.gp.xirr','stated_outcomes.gp.z','stated_outcomes.promote_total','stated_outcomes.profit_total','stated_outcomes.clawback_amount','stated_outcomes.z','stated_schedule[0].date','stated_schedule[0].by_tier[0]','stated_schedule[0].by_tier[1].tier','stated_schedule[0].by_tier[1].lp','stated_schedule[0].by_tier[1].gp','stated_schedule[0].by_tier[1].z','stated_schedule[0].z']);
  });
  it('uses lexical dates only, permits empty collections and leaves financial interpretation separate', () => {
    for (const date of ['0000-00-99', '2025-02-29']) expect(fields('distribution_waterfall', { stated_schedule: [{ date, by_tier: [] }], stated_outcomes: { lp: { contributions: -1, xirr: -2, moic: 0 }, clawback_amount: -1 } })).toEqual([]);
    for (const date of ['2025-01-01\n','２０２５-01-01','2025-1-01']) expect(fields('distribution_waterfall', { stated_schedule: [{ date, by_tier: [] }] })).toEqual(['stated_schedule[0].date']);
    expect(fields('distribution_waterfall', { stated_schedule: [], stated_outcomes: null, clawback: false })).toEqual([]);
  });
});

describe('RFC0096 current SOURCE/MODEL scope and full pass ordering', () => {
  it('uses all current variants in code-point order and excludes overwritten/history/extension peers', () => {
    const source = header + fence('lease_up_schedule', lu({ model_type: 'bad' }), ' variant=z v=1') + fence('lease_up_schedule', lu(), ' variant=z v=2') + fence('lease_up_schedule', lu({ model_type: 'bad' }), ' variant=😀') + fence('lease_up_schedule', lu({ model_type: 'bad' }), ' variant=\ue000') + fence('x_private', lu({ model_type: 'bad' }));
    const issues = validateUWFile(source).issues.filter(i => codes.has(i.code));
    expect(issues.map(i => i.field)).toEqual(['model_type','model_type']);
    expect(issues[0].message).toContain('\ue000'); expect(issues[1].message).toContain('😀');
  });
  it('uses current MODEL own members, not prototypes, convenience metadata or stale rawJson', () => {
    const parsed = parseUWFile(doc('lease_up_schedule', lu())); const block = parsed.sections.lease_up_schedule as UWBlock;
    block.content.model_type = false;
    expect(validateUWFile(parsed).issues.filter(i => codes.has(i.code)).map(i => i.field)).toEqual(['model_type']);
    expect(validateUWFile(doc('lease_up_schedule', lu())).issues.filter(i => codes.has(i.code))).toEqual([]);
    const inherited = Object.assign(Object.create({ model_type: 'natural_turnover', stabilization_target: false }), { period_granularity: 'monthly', schedule: [] });
    expect(fields('lease_up_schedule', inherited)).toEqual(['model_type']);
  });
  it('keeps complete family order, existing prefix order, partitions and readiness', () => {
    const source = header + fence('distribution_waterfall', { stated_outcomes: false }) + fence('capital_stack', { sizing: false }) + fence('rent_roll', rec({ method: 'net', admin_fee_pct: false })) + fence('lease_up_schedule', lu({ model_type: false }));
    const parsed = parseUWFile(source); const before = structuredClone(parsed); const result = validateUWFile(parsed);
    expect(result.issues.filter(i => codes.has(i.code)).map(i => i.code)).toEqual(['LU-05','REC-11','CS-03','WF-16']);
    expect(result.errors).toEqual(result.issues.filter(i => i.severity === 'error'));
    expect(result.overall_status).toBe('errors'); expect(result.stage_readiness).toHaveProperty('scope'); expect(parsed).toEqual(before);
    expect(result.issues.filter(i => codes.has(i.code)).every(i => i.remediation && i.spec_ref && !('category' in i))).toBe(true);
  });
});
