import { describe, expect, it } from 'vitest';
import { getSection, parseUWFile } from './parser.js';
import { validateUWFile } from './validator.js';
import type { ParsedUWFile, UWBlock } from './types.js';
type Obj = Record<string, unknown>;
const header = '---\nuw_version: "3.0"\nasset_class: office\ndeal_id: recovery-own\n---\n';
const fence = (section: string, body: unknown, suffix = '') => `\`\`\`json uw:section=${section}${suffix}\n${JSON.stringify(body)}\n\`\`\`\n`;
const baseRow = { period_start: '2025-01-01', period_end: '2025-12-31' };
function parsed() {
  return parseUWFile(header + fence('rent_roll', { tenants: [{ recovery_terms: { method: 'net' }, recovery_true_up: [baseRow] }] }) + fence('cash_flow_series', { kind: 'property_unlevered', day_count: 'actual/365f', currency_code: 'USD', series: [{ date: '2025-12-31', amount: 1 }] }, ' variant=default'));
}
function tenant(p: ParsedUWFile): Obj { return (getSection(p, 'rent_roll')!.content.tenants as Obj[])[0]; }
function terms(p: ParsedUWFile): Obj { return tenant(p).recovery_terms as Obj; }
function row(p: ParsedUWFile): Obj { return (tenant(p).recovery_true_up as Obj[])[0]; }
const rec = (p: ParsedUWFile) => validateUWFile(p).issues.filter(i => i.code.startsWith('REC-')).map(i => [i.code, i.field]);

describe('RFC0096 existing recovery structural own-member authority', () => {
  it.each([
    ['terms carrier', (p: ParsedUWFile) => { delete tenant(p).recovery_terms; Object.setPrototypeOf(tenant(p), { recovery_terms: false }); }],
    ['share', (p: ParsedUWFile) => Object.setPrototypeOf(terms(p), { pro_rata_share: false })],
    ['pool', (p: ParsedUWFile) => Object.setPrototypeOf(terms(p), { recoverable_pool: false })],
    ['cap', (p: ParsedUWFile) => Object.setPrototypeOf(terms(p), { cap: false })],
    ['cap pct', (p: ParsedUWFile) => { terms(p).cap = Object.create({ pct: false }); }],
    ['true-up carrier', (p: ParsedUWFile) => { delete tenant(p).recovery_true_up; Object.setPrototypeOf(tenant(p), { recovery_true_up: false }); }],
    ['settlement', (p: ParsedUWFile) => Object.setPrototypeOf(row(p), { settlement: false })],
    ['cash reference', (p: ParsedUWFile) => Object.setPrototypeOf(row(p), { cash_flow_ref: false })],
  ] as const)('ignores prototype-only %s structural declarations', (_name, mutate) => {
    const p = parsed(); mutate(p); expect(rec(p)).toEqual([]);
  });
  it.each(['period_start','period_end'])('requires an own %s rather than a valid prototype date', field => {
    const p = parsed(); const r = row(p); const date = r[field]; delete r[field]; Object.setPrototypeOf(r, { [field]: date });
    expect(rec(p)).toEqual([['REC-04','tenants[0].recovery_true_up[0].period_start']]);
  });
  it('requires an own cash reference variant', () => {
    const p = parsed(); row(p).cash_flow_ref = Object.create({ variant: 'default' });
    expect(rec(p)).toEqual([['REC-09','tenants[0].recovery_true_up[0].cash_flow_ref']]);
  });
  it('does not resolve a prototype section or prototype variant target', () => {
    const p = parsed(); row(p).cash_flow_ref = { variant: 'default' };
    const entry = p.sections.cash_flow_series; delete p.sections.cash_flow_series;
    Object.setPrototypeOf(p.sections, { cash_flow_series: entry });
    expect(rec(p)).toEqual([['REC-09','tenants[0].recovery_true_up[0].cash_flow_ref.variant']]);
    const other = parsed(); row(other).cash_flow_ref = { variant: 'ghost' };
    Object.setPrototypeOf(other.sections.cash_flow_series, { ghost: Object.values(other.sections.cash_flow_series)[0] });
    expect(rec(other)).toEqual([['REC-09','tenants[0].recovery_true_up[0].cash_flow_ref.variant']]);
  });
  it.each([
    ['terms', (p: ParsedUWFile) => { tenant(p).recovery_terms = undefined; }, [['REC-02','tenants[0].recovery_terms']]],
    ['share', (p: ParsedUWFile) => { terms(p).pro_rata_share = undefined; }, [['REC-01','tenants[0].recovery_terms.pro_rata_share']]],
    ['pool', (p: ParsedUWFile) => { terms(p).recoverable_pool = undefined; }, [['REC-03','tenants[0].recovery_terms.recoverable_pool']]],
    ['cap', (p: ParsedUWFile) => { terms(p).cap = undefined; }, [['REC-02','tenants[0].recovery_terms.cap']]],
    ['pct', (p: ParsedUWFile) => { terms(p).cap = { pct: undefined }; }, [['REC-01','tenants[0].recovery_terms.cap.pct'], ['REC-02','tenants[0].recovery_terms.cap.accumulation']]],
    ['true-up', (p: ParsedUWFile) => { tenant(p).recovery_true_up = undefined; }, [['REC-04','tenants[0].recovery_true_up']]],
    ['settlement', (p: ParsedUWFile) => { row(p).settlement = undefined; }, [['REC-04','tenants[0].recovery_true_up[0].settlement']]],
    ['cash reference', (p: ParsedUWFile) => { row(p).cash_flow_ref = undefined; }, [['REC-09','tenants[0].recovery_true_up[0].cash_flow_ref']]],
  ] as const)('treats own undefined %s as present wrong type', (_name, mutate, expected) => {
    const p = parsed(); mutate(p); expect(rec(p)).toEqual(expected);
  });
  it.each([['absent', false, null, 'REC-02'],['null', true, null, 'REC-02'],['undefined', true, undefined, 'REC-11']] as const)('keeps required companion %s ownership precise', (_name, present, value, code) => {
    const p = parsed(); const t = terms(p); t.method = 'base_year_stop'; if (present) t.base_year = value;
    expect(rec(p)).toEqual([[code,'tenants[0].recovery_terms.base_year']]);
  });
  it.each(['toString','valueOf','hasOwnProperty','isPrototypeOf'])('actual SOURCE reference %s does not resolve through Object.prototype', variant => {
    const source = header + fence('rent_roll', { tenants: [{ recovery_true_up: [{ ...baseRow, cash_flow_ref: { variant } }] }] }) + fence('cash_flow_series', { kind: 'property_unlevered', day_count: 'actual/365f', series: [] }, ' variant=default');
    expect(validateUWFile(source).issues.filter(i => i.code === 'REC-09').map(i => i.field)).toEqual(['tenants[0].recovery_true_up[0].cash_flow_ref.variant']);
  });
  it('does not assess inherited tenants on an unselected current peer', () => {
    const p = parsed(); const prototype = getSection(p, 'rent_roll')!;
    const peer = { ...prototype, annotation: { ...prototype.annotation, variant: 'other' }, content: Object.create({ tenants: [{ recovery_terms: false }] }) };
    p.sections.rent_roll = { base: prototype, other: peer };
    expect(rec(p)).toEqual([]);
  });
  it('retains selected REC06–08 raw operand procedure and population in this bounded correction', () => {
    const p = parsed(); terms(p).pro_rata_share = .1;
    Object.assign(row(p), { pool_actual: 100, tenant_share_uncapped: 20, tenant_share_capped: 25, estimated_billed: 10, true_up_amount: 9 });
    const financial = () => rec(p).filter(([code]) => ['REC-06','REC-07','REC-08'].includes(code!));
    const before = financial(); expect(before.map(([code]) => code)).toEqual(['REC-06','REC-07','REC-08']);
    const t = tenant(p); const originalTerms = t.recovery_terms; delete t.recovery_terms; Object.setPrototypeOf(t, { recovery_terms: originalTerms });
    const r = row(p); const start = r.period_start; delete r.period_start; Object.setPrototypeOf(r, { period_start: start });
    expect(financial()).toEqual(before);
  });
});
