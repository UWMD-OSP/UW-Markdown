import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { BUILTIN_REMEDIATIONS, validatorCodeFamily } from './protocol.js';
const ajv = new Ajv2020.default({ strict: false, validateFormats: false, allowUnionTypes: true });
const schema = (name: string) => JSON.parse(readFileSync(resolve(process.cwd(), `../../spec/schemas/${name}.schema.json`), 'utf8'));
const lu = ajv.compile(schema('section-lease-up-schedule'));
const terms = ajv.compile(schema('lease-recovery-terms'));
const trueUp = ajv.compile(schema('lease-recovery-true-up'));
const stack = ajv.compile(schema('section-capital-stack'));
const waterfall = ajv.compile(schema('section-distribution-waterfall'));
const schedule = ajv.compile(schema('section-distribution-waterfall').properties.stated_schedule);
const baseLu = { model_type: 'absorption_curve', period_granularity: 'monthly', schedule: [{ period: '2026-01' }] };

describe('RFC0096 executable registry and five synchronized schemas', () => {
  it.each(['LU-05','REC-11','CS-03','WF-16'])('registers %s once as validate/error with remediation', code => {
    const records = BUILTIN_REMEDIATIONS.filter(r => r.code === code);
    expect(records).toHaveLength(1); expect(records[0].severity).toBe('error');
    expect(records[0].remediation).toBeTruthy(); expect(validatorCodeFamily(code)?.capabilities).toEqual(['validate']);
  });
  it('asserts cadence-qualified target grammar with no invalid-cadence fallback', () => {
    expect(lu({ ...baseLu, stabilization_target: '2026-01' })).toBe(true);
    for (const target of ['2026-Q1','2026-01\n','２０２６-01',false]) expect(lu({ ...baseLu, stabilization_target: target })).toBe(false);
    expect(lu({ ...baseLu, period_granularity: 'quarterly', schedule: [{ period: '2026-Q1' }], stabilization_target: '2026-Q4' })).toBe(true);
    // Invalid cadence itself is refused; the conditional target assertion does not invent a grammar.
    const fragment = { type: 'object', properties: { stabilization_target: schema('section-lease-up-schedule').properties.stabilization_target }, allOf: schema('section-lease-up-schedule').allOf };
    const conditional = ajv.compile(fragment);
    for (const period_granularity of [undefined, null, 'bad']) expect(conditional({ period_granularity, stabilization_target: 'bad' })).toBe(true);
    expect(conditional({ stabilization_target: false })).toBe(false);
  });
  it.each([
    [{ cap: { pct: .05 } }, true], [{ cap: { pct: .05, accumulation: null } }, true],
    [{ cap: { pct: .05, accumulation: 'bad' } }, false], [{ cap: { pct: null, accumulation: 'bad' } }, false],
    [{ method: 'net', cap: { pct: .05 } }, false], [{ method: 'net', cap: { pct: .05, accumulation: null } }, false],
    [{ method: null, cap: { pct: .05, accumulation: null } }, false],
    [{ method: 'net', cap: { pct: null, accumulation: 'bad' } }, false],
    [{ method: 'net', cap: { pct: false, accumulation: null } }, false],
  ])('asserts exact recovery conditional %j', (input, valid) => expect(terms(input)).toBe(valid));
  it('preserves nullable companions while rejecting non-nullable null method', () => {
    expect(terms({ pro_rata_share: null, admin_fee_pct: null })).toBe(true);
    expect(terms({ method: null })).toBe(false);
    expect(terms({ method: 'net', admin_fee_pct: false })).toBe(false);
    expect(trueUp([{ period_start: '2025-01-01', period_end: '2025-12-31', true_up_amount: -1 }])).toBe(true);
    expect(trueUp([{ period_start: '2025-01-01', period_end: '2025-12-31', pool_actual: -1 }])).toBe(false);
  });
  it('asserts sizing selector union without interpreting financial selector association', () => {
    const base = { point_in_time: 'stabilization', tranches: [{ id: 's', class: 'senior_debt', position: 1, amount: 1, rate: .05 }], sizing: [{ id: 'x', fn: 'coverage', over: 'absent', value: -1 }] };
    expect(stack(base)).toBe(true);
    expect(stack({ ...base, sizing: [{ ...base.sizing[0], through: 1 }] })).toBe(false);
    expect(stack({ ...base, sizing: null })).toBe(false);
    expect(stack({ ...base, sizing: [] })).toBe(true);
  });
  it('asserts whole-input lexical waterfall dates without calendar or format-plugin authority', () => {
    for (const date of ['0000-00-99','2025-02-29']) expect(schedule([{ date, by_tier: [] }])).toBe(true);
    for (const date of ['2025-01-01\n','2025-01-01\r','２０２５-01-01',null]) expect(schedule([{ date, by_tier: [] }])).toBe(false);
    expect(schedule([])).toBe(true);
    expect(waterfall({})).toBe(false); // independent required financial ladder fields remain owned elsewhere
  });
});
