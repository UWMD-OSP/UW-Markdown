import { describe, expect, it } from 'vitest';
import { parseUWFile } from './parser.js';
import { checkSizeContract, meetsSizeContract, SIZE_CONTRACT } from './size-contract.js';
import type { ValidationMessage } from './types.js';
import { validateUWFile } from './validator.js';

const doc = (asset: string, blocks: Record<string, unknown>, variants: Record<string, string> = {}) =>
  ['---', 'uw_version: "3.0"', `asset_class: ${asset}`, '---', '',
    ...Object.entries(blocks).map(([key, body]) => {
      const section = key.split('#')[0];
      const variant = variants[key] ? ` variant=${variants[key]}` : '';
      return `\`\`\`json uw:section=${section}${variant} source=manual\n${JSON.stringify(body)}\n\`\`\`\n`;
    })].join('\n');

const sizeIssues = (source: string): ValidationMessage[] => {
  const issues: ValidationMessage[] = [];
  checkSizeContract(parseUWFile(source), issues);
  return issues;
};
const fields = (source: string) => sizeIssues(source).map(i => `${i.section}.${i.field}`);

describe('RFC 0100 size contract', () => {
  it('reads a count as an integer (1.0 is 1) and any finite measure as a measure', () => {
    expect(meetsSizeContract(1.0, 'count')).toBe(true);
    expect(meetsSizeContract(0, 'count')).toBe(true);
    expect(meetsSizeContract(10.5, 'count')).toBe(false);
    expect(meetsSizeContract(-1, 'count')).toBe(false);
    expect(meetsSizeContract(10.5, 'measure')).toBe(true);
    expect(meetsSizeContract(-0.01, 'measure')).toBe(false);
    expect(meetsSizeContract(true, 'measure')).toBe(false);
    expect(meetsSizeContract('100', 'count')).toBe(false);
    expect(meetsSizeContract(null, 'count')).toBe(true);
    expect(meetsSizeContract(undefined, 'measure')).toBe(true);
  });

  it('refuses one negative value of each kind (count, area, capacity, rent) at its field', () => {
    expect(fields(doc('multifamily', { property: { total_units: -180 } }))).toEqual(['property.total_units']);
    expect(fields(doc('office', { rent_roll: { total_rentable_sf: -5000 } }))).toEqual(['rent_roll.total_rentable_sf']);
    expect(fields(doc('data_center', { property: { critical_it_load_kw: -10 } }))).toEqual(['property.critical_it_load_kw']);
    expect(fields(doc('multifamily', { rent_roll: { units: [{ monthly_rent: 1200 }, { monthly_rent: -1 }] } }))).toEqual(['rent_roll.units[1].monthly_rent']);
  });

  it('refuses a fractional count', () => {
    const issues = sizeIssues(doc('multifamily', { rent_roll: { occupied_units: 10.5 } }));
    expect(issues.map(i => [i.code, i.severity, i.field, i.value])).toEqual([['SIZE-01', 'error', 'occupied_units', 10.5]]);
  });

  it('admits zero, null and absence; zero is a legitimate secondary size', () => {
    expect(fields(doc('land', { property: { gross_acres: 40, entitled_units: 0, usable_acres: null } }))).toEqual([]);
    expect(fields(doc('multifamily', { property: {} }))).toEqual([]);
  });

  it('leaves signed amounts alone', () => {
    expect(fields(doc('multifamily', { rent_roll: { concessions_monthly: -5400, loss_to_lease: -12000 } }))).toEqual([]);
  });

  it('judges the current block only; an earlier block a later one overwrites (Format §2.7) is not current', () => {
    expect(fields(doc('multifamily', { 'property#a': { total_units: -1 }, 'property#b': { total_units: 10 } }))).toEqual([]);
    expect(fields(doc('multifamily', { 'property#a': { total_units: 10 }, 'property#b': { total_units: -1 } }))).toEqual(['property.total_units']);
  });

  it('polices the generic twin of a class-checked field: rent_roll.total_sites beside a valid mhc_sites', () => {
    const source = doc('manufactured_housing', { mhc_sites: { total_sites: 200 }, rent_roll: { total_sites: -200 } });
    expect(validateUWFile(source).issues.filter(i => i.code === 'SIZE-01').map(i => `${i.section}.${i.field}`)).toEqual(['rent_roll.total_sites']);
  });

  it('is a closed table of property and rent_roll fields', () => {
    expect(Object.keys(SIZE_CONTRACT)).toEqual(['property', 'rent_roll']);
    expect(Object.isFrozen(SIZE_CONTRACT.property)).toBe(true);
  });
});
