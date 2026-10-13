// RFC 0041 contextual references in refinement (a starter product). The
// references themselves are @uwmd/verify's (period-path.test.ts there); this
// case moved here with refinement (RFC 0083).
import { expect, it } from 'vitest';
import type { ParsedUWFile, UWBlock } from '@uwmd/verify';
import { rankGaps } from './refinement.js';

function block(section: string, content: Record<string, unknown>, variant?: string): UWBlock {
  return { annotation: { section, ...(variant ? { variant } : {}) }, content, meta: { section, lifecycle: { revision: 1, superseded: false }, provenance: { source: 'manual' } } as UWBlock['meta'], prose: '', rawJson: '', lineStart: 1, lineEnd: 1 };
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

it('accepts finite period inputs in refinement without inventing a gap', () => {
  const parsed = doc();
  parsed.custom_calculations.push(block('custom_calculations', { id: 'period_refinement', formula: 'dcf.annual_cash_flows@Y3.noi' }));
  const result = rankGaps(parsed, { packs: [], targets: ['period_refinement'] });
  expect(result.diagnostics.non_monotonic).toEqual([]);
  expect(result.diagnostics.period_inputs).toEqual([]);
  expect(result.by_voi).toEqual([]);
});
