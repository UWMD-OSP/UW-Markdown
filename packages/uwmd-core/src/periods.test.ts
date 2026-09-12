import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { PERIOD_SERIES } from './protocol.js';
import { canonicalPeriod, parsePeriodSelector, periodKeyIdentity, scanPeriodSeries } from './periods.js';

describe('RFC 0041 canonical period identities', () => {
  it.each([
    ['Y3', { kind: 'year', index: 3 }],
    ['2028-Q1', { kind: 'quarter', year: 2028, quarter: 1 }],
    ['2028-01', { kind: 'month', year: 2028, month: 1 }],
    ['2028-02-29', { kind: 'date', date: '2028-02-29' }],
  ])('canonicalizes %s without reference to a row index', (selector, expected) => {
    expect(parsePeriodSelector(selector as string)).toEqual(expected);
  });
  it.each(['Y0', 'Y01', 'Y9007199254740992', 'Q1', 'M2', '2028-Q5', '2028-13', '2027-02-29', '2028-01-00'])('refuses %s', selector => {
    expect(parsePeriodSelector(selector)).toBeNull();
  });
  it('keeps kinds and absolute calendar years distinct', () => {
    const keys = ['Y1', '2027-Q1', '2028-Q1', '2028-01', '2028-01-01'].map(value => periodKeyIdentity(parsePeriodSelector(value)!));
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('canonicalizes both year forms and detects padded keyed duplicates', () => {
    expect(canonicalPeriod(PERIOD_SERIES[0]!, 3)).toEqual(canonicalPeriod(PERIOD_SERIES[1]!, 'year_3'));
    expect(scanPeriodSeries(PERIOD_SERIES[1]!, { year_1: {}, year_01: {} }, {}).duplicates).toEqual(['year:1']);
  });
  it('reports malformed and mixed-cadence periods', () => {
    expect(scanPeriodSeries(PERIOD_SERIES[2]!, [{ period: '2028-Q1' }, { period: '2028-02' }, {}], { period_granularity: 'quarterly' }).invalid).toEqual(['1', '2']);
  });
  it('freezes the registry and each of its five entries', () => {
    expect(PERIOD_SERIES).toHaveLength(5);
    expect(Object.isFrozen(PERIOD_SERIES)).toBe(true);
    expect(PERIOD_SERIES.every(Object.isFrozen)).toBe(true);
  });
});

it('keeps the executable period registry, protocol table and schemas aligned', () => {
  const root = resolve(process.cwd(), '../..');
  const spec = readFileSync(resolve(root, 'spec/UW_PROTOCOL_v1.md'), 'utf8');
  const ajv = new Ajv2020({ strict: false });
  addFormats.default(ajv);
  const entrySchema = ajv.compile(JSON.parse(readFileSync(resolve(root, 'spec/schemas/period-series-entry.schema.json'), 'utf8')));
  const keySchema = ajv.compile(JSON.parse(readFileSync(resolve(root, 'spec/schemas/period-key.schema.json'), 'utf8')));
  for (const entry of PERIOD_SERIES) {
    const row = spec.split('\n').find(line => line.startsWith(`| \`${entry.path}\` |`));
    expect(row).toContain(`| ${entry.shape} |`);
    expect(row).toContain(`| ${entry.grammar} |`);
    expect(row).toContain(entry.period_field ?? entry.key_pattern!);
    if (entry.cadence_field) expect(row).toContain(entry.cadence_field);
    expect(entrySchema(entry), JSON.stringify(entrySchema.errors)).toBe(true);
  }
  for (const selector of ['Y1', '2028-Q1', '2028-01', '2028-02-29']) expect(keySchema(parsePeriodSelector(selector))).toBe(true);
  expect(keySchema({ kind: 'year', index: 0 })).toBe(false);
  expect(keySchema({ kind: 'quarter', year: 2028, quarter: 5 })).toBe(false);
});
