import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as browserSurface from './browser.js';
import * as indexSurface from './index.js';
import { BUILTIN_METRIC_DICTIONARY } from './metric-dictionary.js';
import {
  jsonNumericTokens,
  jsonStatedDecimals,
  quickMetricDecimals,
  verifyStatedMetric,
  verifyStatedMetrics,
  type StatedMetricBindings,
  type StatedMetricEvidence,
} from './metric-verification.js';
import { parseUWFile } from './parser.js';
import type { ParsedUWFile, UWBlock } from './types.js';

const repo = (path: string): string => readFileSync(fileURLToPath(new URL(`../../../${path}`, import.meta.url)), 'utf8');
const CONFORMANCE_BINDINGS = JSON.parse(repo('conformance/metrics/statement-bindings.json')) as StatedMetricBindings;
const EXPECTED = JSON.parse(repo('conformance/metrics/expected.json')) as Array<{
  example: string; asset_class: string; counts: Record<string, number>; evidence: StatedMetricEvidence[];
}>;

const D = BUILTIN_METRIC_DICTIONARY;
const metric = (id: string, cls = 'multifamily') => {
  const found = D.calculations.find((m) => m.id === id && (m.asset_classes as readonly string[]).includes(cls));
  if (!found) throw new Error(`no ${id} for ${cls}`);
  return found;
};
const block = (section: string, content: Record<string, unknown>): UWBlock =>
  ({ annotation: { section }, meta: {}, content }) as unknown as UWBlock;
const deal = (sections: Record<string, UWBlock>): ParsedUWFile =>
  ({ ...parseUWFile(['---', 'uw_version: "3.0"', 'asset_class: multifamily', '---', ''].join('\n')), sections });
const simple = (): ParsedUWFile => deal({
  property: block('property', { total_units: 1 }),
  valuation: block('valuation', { purchase_price: 100000.21 }),
  noi_model: block('noi_model', { net_operating_income: 50000 }),
  debt_structure: block('debt_structure', { annual_debt_service: 25000, loan_amount: 75000 }),
});

describe('verifyStatedMetrics — the builtin examples', () => {
  const parkview = parseUWFile(repo('examples/Parkview-Apts-Glendale-AZ.uwx.md'));

  it('reproduces the conformance evidence for an example, address for address', () => {
    const recorded = EXPECTED.find((e) => e.example === 'Parkview-Apts-Glendale-AZ.uwx.md')!;
    const { example: _example, ...expected } = recorded;
    expect(verifyStatedMetrics(parkview, { dictionary: D, bindings: CONFORMANCE_BINDINGS })).toEqual(expected);
  });

  it('defaults to the builtin dictionary and canonical ids at the output sections, without aliases', () => {
    const report = verifyStatedMetrics(parkview);
    const recorded = EXPECTED.find((e) => e.example === 'Parkview-Apts-Glendale-AZ.uwx.md')!.evidence;
    expect(report.asset_class).toBe('multifamily');
    expect(report.counts.failed).toBe(0);
    expect(report.evidence.length).toBeGreaterThan(0);
    expect(report.evidence.length).toBeLessThan(recorded.length); // aliases are opt-in
    for (const item of report.evidence) expect(recorded).toContainEqual(item);
  });

  it('counts every state', () => {
    const p = simple();
    p.frontmatter.quick_metrics = { dscr: 2, ltv: 0.9 } as ParsedUWFile['frontmatter']['quick_metrics'];
    const report = verifyStatedMetrics(p, { statedDecimals: new Map() });
    // quick_metrics tokens are read from the source, which states none here.
    expect(report.counts).toEqual({ verified: 1, failed: 0, unverifiable: 2 });
  });
});

describe('verifyStatedMetric — one statement', () => {
  it('verifies the stated value and fails a tampered one', () => {
    expect(verifyStatedMetric(metric('dscr'), simple(), 2, undefined, 4).state).toBe('verified');
    expect(verifyStatedMetric(metric('dscr'), simple(), 2.0001, undefined, 4).state).toBe('failed');
  });

  it('never defaults a missing or null input', () => {
    const p = simple();
    delete (p.sections['debt_structure'] as UWBlock).content['annual_debt_service'];
    expect(verifyStatedMetric(metric('dscr'), p, 2, undefined, 4)).toEqual({ state: 'unverifiable', reason: 'missing_or_null_input', computed: null });
  });

  it('reports calc refusals by code', () => {
    const p = simple();
    (p.sections['debt_structure'] as UWBlock).content['annual_debt_service'] = 0;
    expect(verifyStatedMetric(metric('dscr'), p, 2, undefined, 4).reason).toBe('CALC-DIV-ZERO');
  });

  it('treats missing source precision as a caller error', () => {
    expect(verifyStatedMetric(metric('dscr'), simple(), 2).reason).toBe('CALC-TYPE-001');
  });

  it('compares a primary size raw, without rounding', () => {
    const size = D.size_intensives.find((s) => (s.asset_classes as readonly string[]).includes('land'))!;
    const p = simple();
    (p.sections['property'] as UWBlock).content = { gross_acres: 123.123456789 };
    expect(verifyStatedMetric(size, p, 123.123456789).state).toBe('verified');
    expect(verifyStatedMetric(size, p, 123.123457).state).toBe('failed');
    (p.sections['property'] as UWBlock).content = {};
    expect(verifyStatedMetric(size, p, 100).reason).toBe('missing_or_invalid_size');
  });

  it('leaves the definition and the document unchanged', () => {
    const m = metric('dscr');
    const p = simple();
    const before = JSON.stringify({ m, p });
    verifyStatedMetrics(p);
    verifyStatedMetric(m, p, 2, undefined, 4);
    expect(JSON.stringify({ m, p })).toBe(before);
  });
});

describe('verifyStatedMetrics — stated precision', () => {
  it('takes an explicit precision for an unvaried address over the source', () => {
    const p = simple();
    (p.sections['debt_structure'] as UWBlock).content['dscr'] = 2;
    const [statement] = verifyStatedMetrics(p, { statedDecimals: new Map([['debt_structure.dscr', 2]]) }).evidence;
    expect(statement).toMatchObject({ id: 'dscr', path: 'debt_structure.dscr', stated_decimals: 2, state: 'verified' });
  });

  it('reads JSON numeric tokens with trailing zeros, exponents and escaped keys', () => {
    const rawJson = '{"dscr":1.20,"other":{"dscr":1.2},"rows":[1.200e-2],"text":"1.2000","escaped\\u005fkey":2.00}';
    const tokens = jsonNumericTokens(rawJson);
    expect(tokens.get('["dscr"]')).toBe('1.20');
    expect(tokens.get('["other","dscr"]')).toBe('1.2');
    expect(tokens.get('["rows","0"]')).toBe('1.200e-2');
    expect(tokens.get('["escaped_key"]')).toBe('2.00');
    expect(jsonStatedDecimals({ rawJson }, 'dscr', 1.2)).toBe(2);
    expect(jsonStatedDecimals({ rawJson }, 'dscr', 1.25)).toBeUndefined();
    expect(jsonStatedDecimals({ rawJson: '' }, 'dscr', 1.2)).toBeUndefined();
  });

  it('reads plain frontmatter quick_metrics tokens only', () => {
    const yaml = ['---', 'quick_metrics:', '  dscr: 1.20 # comment', '  other: "1.2000"', '---', ''].join('\n');
    expect(quickMetricDecimals(yaml, 'dscr', 1.2)).toBe(2);
    expect(quickMetricDecimals(yaml, 'other', 1.2)).toBeUndefined();
    expect(quickMetricDecimals('no frontmatter', 'dscr', 1.2)).toBeUndefined();
  });
});

describe('verifyStatedMetrics — public surface', () => {
  it('is exported from both entry points', () => {
    expect(indexSurface.verifyStatedMetrics).toBe(verifyStatedMetrics);
    expect(browserSurface.verifyStatedMetrics).toBe(verifyStatedMetrics);
  });
});
