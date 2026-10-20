import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as browserSurface from './browser.js';
import * as indexSurface from './index.js';
import { fromUWEnvelope, toUWEnvelope } from './envelope.js';
import { BUILTIN_METRIC_DICTIONARY } from './metric-dictionary.js';
import {
  DEFAULT_STATED_METRIC_BINDINGS,
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
const SPEC_DICTIONARY = JSON.parse(repo('spec/metrics/builtin.json')) as { statement_bindings: StatedMetricBindings };
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
    expect(verifyStatedMetrics(parkview, { dictionary: D })).toEqual(expected);
  });

  it('defaults to the builtin dictionary and checks every bound home, aliases included (RFC 0099)', () => {
    const recorded = EXPECTED.find((e) => e.example === 'Parkview-Apts-Glendale-AZ.uwx.md')!;
    const report = verifyStatedMetrics(parkview);
    expect(report.counts).toEqual(recorded.counts);
    expect(report.evidence).toEqual(recorded.evidence);
    expect(report.evidence.map((e) => e.path)).toContain('debt_structure.sizing_metrics.dscr_underwritten');
  });

  it('defaults to the dictionary registry, which is the spec file member (one source)', () => {
    expect(DEFAULT_STATED_METRIC_BINDINGS).toBe(D.statement_bindings);
    expect(D.statement_bindings).toEqual(SPEC_DICTIONARY.statement_bindings);
  });

  it('fails a section-home statement that disagrees while quick_metrics agrees, reporting both', () => {
    const source = repo('examples/Parkview-Apts-Glendale-AZ.uwx.md');
    const at = source.indexOf('"dscr_underwritten": 1.109');
    expect(at).toBeGreaterThan(0);
    const tampered = parseUWFile(source.replace('"dscr_underwritten": 1.109', '"dscr_underwritten": 1.220'));
    const report = verifyStatedMetrics(tampered);
    const dscr = report.evidence.filter((e) => e.id === 'dscr');
    expect(dscr.find((e) => e.path === 'debt_structure.sizing_metrics.dscr_underwritten')?.state).toBe('failed');
    expect(dscr.find((e) => e.path === 'quick_metrics.dscr')?.state).toBe('verified');
    expect(report.counts.failed).toBe(1);
  });

  it('does not read a field the registry does not bind, whatever its name', () => {
    const p = simple();
    p.sections.valuation = block('valuation', { purchase_price: 100000.21, cap_rate_trailing: 0.9 });
    expect(verifyStatedMetrics(p).evidence.map((e) => e.path)).not.toContain('valuation.cap_rate_trailing');
  });

  it('counts every state', () => {
    const p = simple();
    p.frontmatter.quick_metrics = { dscr: 2, ltv: 0.9 } as ParsedUWFile['frontmatter']['quick_metrics'];
    const report = verifyStatedMetrics(p, { statedDecimals: new Map() });
    // quick_metrics tokens are read from the source, which states none here.
    expect(report.counts).toEqual({ verified: 1, failed: 0, unverifiable: 2 });
    expect(report.evidence.filter((e) => e.state === 'unverifiable').map((e) => e.reason))
      .toEqual(['missing_stated_precision', 'missing_stated_precision']);
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
  it('needs caller-supplied precision for an envelope-decoded document', () => {
    const source = parseUWFile(repo('examples/Parkview-Apts-Glendale-AZ.uwx.md'));
    const fromSource = verifyStatedMetrics(source);
    // Five quick_metrics/primary-size statements plus four section homes (RFC 0099).
    expect(fromSource.counts).toEqual({ verified: 9, failed: 0, unverifiable: 0 });

    // A decoded document has no rawJson or frontmatter source text, so the
    // rounded statements cannot be compared at their stated precision.
    const decoded = fromUWEnvelope(toUWEnvelope(source));
    const bare = verifyStatedMetrics(decoded);
    expect(bare.counts).toEqual({ verified: 5, failed: 0, unverifiable: 4 });
    for (const item of bare.evidence.filter((e) => e.state === 'unverifiable')) {
      expect(item).toEqual({ id: item.id, path: item.path, stated: item.stated, state: 'unverifiable', reason: 'missing_stated_precision', computed: null });
    }

    // Supplying the source decimals by address restores the source verdicts.
    const statedDecimals = new Map(fromSource.evidence
      .filter((e) => e.stated_decimals !== undefined)
      .map((e) => [e.path, e.stated_decimals as number] as const));
    expect(verifyStatedMetrics(decoded, { statedDecimals })).toEqual(fromSource);
  });

  it('treats unreadable block JSON as missing precision, not a thrown SyntaxError', () => {
    const p = simple();
    const debt = p.sections['debt_structure'] as UWBlock;
    debt.content['dscr'] = 2;
    debt.rawJson = '{"dscr": 2.00,';
    expect(jsonStatedDecimals(debt, 'dscr', 2)).toBeUndefined();
    expect(() => jsonNumericTokens(debt.rawJson)).toThrow(SyntaxError);
    const [statement] = verifyStatedMetrics(p).evidence;
    expect(statement).toMatchObject({ path: 'debt_structure.dscr', state: 'unverifiable', reason: 'missing_stated_precision' });
  });

  it('reads each statement at its own token when one block states several', () => {
    const p = simple();
    const debt = p.sections['debt_structure'] as UWBlock;
    Object.assign(debt.content, { dscr: 2, debt_yield: 0.6667 });
    debt.rawJson = '{"annual_debt_service":25000,"loan_amount":75000,"dscr":2.00,"debt_yield":0.6667}';
    const evidence = verifyStatedMetrics(p).evidence.filter((e) => e.path.startsWith('debt_structure.'));
    expect(evidence.map((e) => [e.path, e.stated_decimals, e.state])).toEqual([
      ['debt_structure.dscr', 2, 'verified'],
      ['debt_structure.debt_yield', 4, 'verified'],
    ]);
  });

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
