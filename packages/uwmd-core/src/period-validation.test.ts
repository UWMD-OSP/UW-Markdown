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
