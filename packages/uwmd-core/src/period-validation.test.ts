import { describe, expect, it } from 'vitest';
import { parseUWFile } from './parser.js';
import { validateUWFile } from './validator.js';

const doc = (blocks: Array<[string, Record<string, unknown>, string?]>) => parseUWFile(`---
uw_version: "1.1"
asset_class: multifamily
---
${blocks.map(([section, content, variant]) => `\`\`\`json uw:section=${section}${variant ? ` variant=${variant}` : ''}
${JSON.stringify({ _meta: { section, version: 1, source: 'manual' }, ...content })}
\`\`\``).join('\n')}`);
describe('RFC 0041 period validation', () => {
  it('checks malformed periods in unselected variants and reports duplicate identities', () => {
    const parsed = doc([
      ['dcf', { _role: 'primary', annual_cash_flows: [{ year: 1, noi: 10 }] }, 'a'],
      ['dcf', { annual_cash_flows: [{ year: 2 }, { year: 2 }, { noi: 3 }] }, 'b'],
    ]);
    const issues = validateUWFile(parsed).issues.filter(issue => issue.code.startsWith('PS-'));
    expect(issues.map(issue => issue.code)).toEqual(['PS-01', 'PS-02']);
    expect(issues.every(issue => issue.message.includes('variant=b'))).toBe(true);
  });
  it('warns for static kind mismatches in calculations and nested scenarios', () => {
    const parsed = doc([
      ['custom_calculations', { formula: 'dcf.annual_cash_flows@2028-01-01.noi' }],
      ['custom_scenarios', { cases: [{ base_formula: 'cash_flow_series.series@Y3.amount' }] }],
    ]);
    expect(validateUWFile(parsed).issues.filter(issue => issue.code === 'PS-03')).toHaveLength(2);
  });
  it('does not interpret a quoted literal @ as a selector', () => {
    expect(validateUWFile(doc([['custom_calculations', { formula: "dcf['annual_cash_flows@Y1']" }]])).issues.filter(issue => issue.code.startsWith('PS-'))).toEqual([]);
  });
});

describe('RFC 0062 cash-flow document validity', () => {
  it('permits same-day rows in every active cash-flow variant without mutation', () => {
    const series = [
      { date: '2027-06-30', amount: -100, kind: 'acquisition' },
      { date: '2027-06-30', amount: -20, kind: 'capex' },
      { date: '2028-06-30', amount: 150, kind: 'disposition' },
    ];
    const parsed = doc([
      ['cash_flow_series', { series }, 'base'],
      ['cash_flow_series', { series }, 'upside'],
    ]);
    const before = JSON.stringify(parsed);
    expect(validateUWFile(parsed).issues.filter(issue => /^(PS-|CF-)/.test(issue.code))).toEqual([]);
    expect(JSON.stringify(parsed)).toBe(before);
  });
  it.each([
    ['dcf', { annual_cash_flows: [{ year: 1 }, { year: 1 }] }],
    ['noi_model', { projections: { year_1: {}, year_01: {} } }],
    ['lease_up_schedule', { period_granularity: 'monthly', schedule: [{ period: '2027-06' }, { period: '2027-06' }] }],
    ['distribution_waterfall', { stated_schedule: [{ date: '2027-06-30' }, { date: '2027-06-30' }] }],
  ] as Array<[string, Record<string, unknown>]>)('retains duplicate errors for %s', (section, payload) => {
    expect(validateUWFile(doc([[section, payload]])).issues.filter(issue => issue.code === 'PS-02'))
      .toMatchObject([{ severity: 'error', section }]);
  });
  it('retains malformed-date and cash-flow ordering diagnostics', () => {
    const parsed = doc([['cash_flow_series', { series: [
      { date: '2027-06-30', amount: -100 },
      { date: '2027-06-30', amount: -20 },
      { date: '2027-02-30', amount: 150 },
    ] }]]);
    const codes = validateUWFile(parsed).issues.map(issue => issue.code);
    expect(codes).toContain('PS-01');
    expect(codes).toContain('CF-01');
    expect(codes).not.toContain('PS-02');
    const unordered = doc([['cash_flow_series', { series: [
      { date: '2028-06-30', amount: 150 }, { date: '2027-06-30', amount: -100 },
    ] }]]);
    expect(validateUWFile(unordered).issues.map(issue => issue.code)).toContain('CF-02');
  });
});
