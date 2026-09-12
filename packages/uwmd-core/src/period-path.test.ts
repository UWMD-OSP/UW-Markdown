import { describe, expect, it } from 'vitest';
import type { CalcEvaluationContext } from './protocol.js';
import type { ParsedUWFile, UWBlock } from './types.js';
import { resolvePeriodPath } from './period-path.js';
import { evaluateCalc } from './calc/index.js';
import { parseExpression } from './calc/parser.js';
import { getExprDependencies } from './calc/dependencies.js';
import { emitFromAst } from './packs/excel-emit.js';
import { deepGet } from './parser.js';
import { rankGaps } from './refinement.js';

function block(section: string, content: Record<string, unknown>, variant?: string): UWBlock {
  return { annotation: { section, ...(variant ? { variant } : {}) }, content, meta: { section, version: 1, source: 'manual', superseded: false } as UWBlock['meta'], prose: '', rawJson: '', lineStart: 1, lineEnd: 1 };
}
function file(sections: ParsedUWFile['sections']): ParsedUWFile {
  return { frontmatter: {} as ParsedUWFile['frontmatter'], sections, prose: {}, superseded: {}, extensions: {}, pipeline_log: [], custom_calculations: [], custom_scenarios: [], raw: '' };
}
const doc = () => file({
  dcf: block('dcf', { annual_cash_flows: [{ year: 3, noi: 300, 'tax.rate': 0.03, 'x@y': 7 }, { year: 1, noi: 100 }] }),
  noi_model: block('noi_model', { projections: { year_3: { projected_noi: 300 }, year_1: { projected_noi: 100 } } }),
  lease_up_schedule: { base: block('lease_up_schedule', { period_granularity: 'quarterly', schedule: [{ period: '2028-Q1', noi: 300 }, { period: '2027-Q4', noi: 200 }] }, 'base') },
  cash_flow_series: { base: block('cash_flow_series', { series: [{ date: '2028-02-29', amount: 400 }] }, 'base') },
  distribution_waterfall: { base: block('distribution_waterfall', { stated_schedule: [{ date: '2028-02-29', lp_distribution: 500 }] }, 'base') },
});
const calc = (formula: string, parsed = doc(), extra: Partial<CalcEvaluationContext> = {}) => evaluateCalc({ id: 'period-test', label: 'Period test', formula, deterministic: true }, { parsed, prior_results: {}, locale: 'en-US', ...extra });

describe('RFC 0041 contextual references', () => {
  it.each([
    ['dcf.annual_cash_flows@Y3.noi', 300],
    ['noi_model.projections@Y3.projected_noi', 300],
    ['lease_up_schedule.schedule@2028-Q1.noi', 300],
    ['cash_flow_series.series@2028-02-29.amount', 400],
    ['distribution_waterfall.stated_schedule@2028-02-29.lp_distribution', 500],
  ])('resolves %s', (path, expected) => {
    expect(resolvePeriodPath(doc(), path as string)).toBe(expected);
    expect(calc(path as string)).toMatchObject({ ok: true, value: expected });
  });
  it('uses named years independently of row order', () => {
    const parsed = doc();
    const original = calc('dcf.annual_cash_flows@Y3.noi - dcf.annual_cash_flows@Y1.noi', parsed);
    ((parsed.sections['dcf'] as UWBlock).content['annual_cash_flows'] as unknown[]).reverse();
    expect(calc('dcf.annual_cash_flows@Y3.noi - dcf.annual_cash_flows@Y1.noi', parsed)).toEqual(original);
    expect(original).toMatchObject({ ok: true, value: 200 });
  });
  it('keeps calendar identity when schedules start in different years', () => {
    expect(calc('lease_up_schedule.schedule@2027-Q1.noi')).toMatchObject({ ok: true, value: null });
    expect(calc('dcf.annual_cash_flows@2028-01-01.noi')).toMatchObject({ ok: true, value: null });
    expect(calc('cash_flow_series.series@Y3.amount')).toMatchObject({ ok: true, value: null });
  });
  it('supports absolute monthly periods', () => {
    const parsed = file({ lease_up_schedule: block('lease_up_schedule', { period_granularity: 'monthly', schedule: [{ period: '2028-01', noi: 123 }] }) });
    expect(calc('lease_up_schedule.schedule@2028-01.noi', parsed)).toMatchObject({ ok: true, value: 123 });
    expect(calc('lease_up_schedule.schedule@2028-Q1.noi', parsed)).toMatchObject({ ok: true, value: null });
  });
  it.each(['dcf.annual_cash_flows@Y2.noi', 'dcf.annual_cash_flows@Y3.missing'])('returns null for missing %s', path => {
    expect(calc(path)).toMatchObject({ ok: true, value: null });
    expect(calc(path, file({}))).toMatchObject({ ok: true, value: null });
  });
  it('refuses duplicate years without prior validation', () => {
    const parsed = file({ dcf: block('dcf', { annual_cash_flows: [{ year: 3, noi: 300 }, { year: 3, noi: 301 }] }) });
    expect(calc('dcf.annual_cash_flows@Y3.noi', parsed)).toMatchObject({ ok: false, error: { code: 'CALC-PERIOD-002' } });
  });
  it.each(['dcf.misspelled@Y3.noi', 'dcf.annual_cash_flows@2027-02-29.noi'])('refuses invalid %s', path => {
    expect(calc(path)).toMatchObject({ ok: false, error: { code: 'CALC-PERIOD-001' } });
    expect(calc(path, doc(), { overrides: { [path]: 1 } }).ok).toBe(false);
  });
  it.each(['dcf.annual_cash_flows@Q3.noi', 'dcf.annual_cash_flows@M1.noi', 'dcf.annual_cash_flows@Y0.noi', 'dcf.annual_cash_flows@Y1.noi@Y2', 'dcf@Y1.noi'])('rejects unsupported syntax %s', path => {
    expect(calc(path)).toMatchObject({ ok: false, error: { code: 'CALC-PARSE-001' } });
  });
  it('refuses malformed series and malformed period rows', () => {
    for (const annual_cash_flows of [{}, [{ noi: 10 }], [{ year: 0, noi: 10 }], [null]]) {
      expect(calc('dcf.annual_cash_flows@Y1.noi', file({ dcf: block('dcf', { annual_cash_flows }) })))
        .toMatchObject({ ok: false, error: { code: 'CALC-PERIOD-001' } });
    }
  });
  it('supports explicit variants and generic primary while excluding implicit components', () => {
    const a = block('dcf', { _role: 'primary', annual_cash_flows: [{ year: 1, noi: 100 }] }, 'a');
    const b = block('dcf', { _role: 'component', annual_cash_flows: [{ year: 1, noi: 30 }] }, 'b');
    const parsed = file({ dcf: { a, b } });
    expect(calc('dcf.annual_cash_flows@Y1.noi', parsed)).toMatchObject({ ok: true, value: 100 });
    expect(calc('dcf.annual_cash_flows@Y1.noi', parsed, { sectionVariants: { dcf: 'b' } })).toMatchObject({ ok: true, value: 30 });
    expect(calc('dcf.annual_cash_flows@Y1.noi', parsed, { sectionVariants: { dcf: 'missing' } })).toMatchObject({ ok: false, error: { code: 'CALC-PERIOD-003' } });
    a.content['_role'] = 'senior'; b.content['_role'] = 'junior';
    expect(calc('dcf.annual_cash_flows@Y1.noi', parsed)).toMatchObject({ ok: false, error: { code: 'CALC-PERIOD-003' } });
  });
  it('applies full-path overrides including null without changing the document', () => {
    const parsed = doc(); const before = JSON.stringify(parsed); const path = 'dcf.annual_cash_flows@Y3.noi';
    expect(calc(path, parsed, { overrides: { [path]: 200 } }).value).toBe(200);
    expect(calc(path, parsed, { overrides: { [path]: null } }).value).toBeNull();
    expect(JSON.stringify(parsed)).toBe(before);
  });
  it('preserves literal dot/@ keys and distinguishes their dependency paths', () => {
    const path = "dcf.annual_cash_flows@Y3['tax.rate']";
    expect(calc(path).value).toBe(0.03);
    expect(getExprDependencies(parseExpression(`${path} + dcf.annual_cash_flows@Y3['x@y']`))).toEqual([path, "dcf.annual_cash_flows@Y3['x@y']"]);
    expect(calc(path, doc(), { overrides: { [path]: 0.04 } }).value).toBe(0.04);
    expect(deepGet({ 'series@Y3': { amount: 9 } }, 'series@Y3.amount')).toBe(9);
  });
  it.each(['constructor', 'prototype', '__proto__'])('cannot traverse %s', segment => {
    expect(calc(`dcf.annual_cash_flows@Y3.${segment}`).value).toBeNull();
  });
  it('does not reach inherited row fields', () => {
    const row = Object.assign(Object.create({ noi: 999 }), { year: 1 });
    expect(calc('dcf.annual_cash_flows@Y1.noi', file({ dcf: block('dcf', { annual_cash_flows: [row] }) })).value).toBeNull();
  });
  it('does not let frontmatter or prior results shadow a registered section', () => {
    const parsed = doc(); (parsed.frontmatter as unknown as Record<string, unknown>)['dcf'] = { annual_cash_flows: [{ year: 3, noi: 999 }] };
    expect(calc('dcf.annual_cash_flows@Y3.noi', parsed, { prior_results: { dcf: 999 } }).value).toBe(300);
  });
  it('refuses Excel emission explicitly even if a caller offers a static named range', () => {
    const path = 'dcf.annual_cash_flows@Y3.noi';
    expect(() => emitFromAst(parseExpression(path), { namedRanges: new Map([[path, 'noi_y3']]) })).toThrowError(expect.objectContaining({ code: 'EXCEL-EMIT-PATH' }));
  });
});

it('accepts finite period inputs in refinement without inventing a gap', () => {
  const parsed = doc();
  parsed.custom_calculations.push(block('custom_calculations', { id: 'period_refinement', formula: 'dcf.annual_cash_flows@Y3.noi' }));
  const result = rankGaps(parsed, { packs: [], targets: ['period_refinement'] });
  expect(result.diagnostics.non_monotonic).toEqual([]);
  expect(result.diagnostics.period_inputs).toEqual([]);
  expect(result.by_voi).toEqual([]);
});

it('retains bracket-string indexing after a selector', () => {
  const parsed = file({ dcf: block('dcf', { annual_cash_flows: [{ year: 1, tiers: [{ amount: 25 }] }] }) });
  expect(calc("dcf.annual_cash_flows@Y1.tiers['0'].amount", parsed)).toMatchObject({ ok: true, value: 25 });
});


import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { resolvePeriodColumn } from './period-path.js';
it('validates projected columns against the RFC 0043 schema', () => {
  const schema = JSON.parse(readFileSync(new URL('../../../spec/schemas/period-column-snapshot.schema.json', import.meta.url), 'utf8'));
  const validate = new Ajv2020().compile(schema);
  const projected = resolvePeriodColumn(doc(), 'dcf.annual_cash_flows@Y3.noi');
  expect(validate(projected)).toBe(true);
  expect(validate({ ...projected, rows: [{ value: 1 }] })).toBe(false);
});
it('validates trusted workbook bindings and refuses addresses/formulas in the RFC 0043 schema', () => {
  const schema = JSON.parse(readFileSync(new URL('../../../spec/schemas/period-excel-binding.schema.json', import.meta.url), 'utf8'));
  const validate = new Ajv2020().compile(schema);
  expect(validate({ kind: 'series', keys_range: 'uwp_keys', values_range: 'uwp_values', valid_range: 'uwp_valid' })).toBe(true);
  expect(validate({ kind: 'override', value_range: 'uwc_input' })).toBe(true);
  for (const value_range of ['A1', 'R1C1', 'R', 'Sheet!A1', '1+2', 'x'.repeat(256)]) {
    expect(validate({ kind: 'override', value_range })).toBe(false);
  }
});
