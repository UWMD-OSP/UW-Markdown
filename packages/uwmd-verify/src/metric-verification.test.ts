import fc from 'fast-check';
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
  sizeDenominators,
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
  debt_structure: block('debt_structure', { annual_debt_service: 25000, loan_amount: 75000, ltv_basis: 'purchase-price' }),
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

  it('names the rule set the record declares and refuses one it does not keep (RFC 0111)', () => {
    expect(verifyStatedMetrics(parkview).rule_set).toBe('3.0');
    const model = { ...parkview, frontmatter: { ...parkview.frontmatter, uw_version: '3.1' } } as unknown as ParsedUWFile;
    expect(() => verifyStatedMetrics(model)).toThrow(/UNSUPPORTED_FORMAT_VERSION/);
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

describe('sizeDenominators — RFC 0100', () => {
  it('checks only the selected component variant (RFC 0117)', () => {
    const definition = metric('retail_price_psf', 'mixed_use');
    const p = simple();
    p.frontmatter.asset_class = 'mixed_use';
    p.sections.components = {
      base: { ...block('components', { retail: { nra_sqft: 1, allocation_pct: 1 } }), annotation: { section: 'components', variant: 'base' } },
      downside: { ...block('components', { retail: { nra_sqft: -1, allocation_pct: 1 } }), annotation: { section: 'components', variant: 'downside' } },
    };
    expect(verifyStatedMetric(definition, p, 123, { components: 'base' }, 2).state).toBe('failed');
    expect(verifyStatedMetric(definition, p, 123, { components: 'downside' }, 2).reason).toBe('negative_size_denominator');
  });

  it('guards all eight mixed-use size denominators (RFC 0117)', () => {
    for (const id of ['multifamily_price_per_unit', 'retail_price_psf', 'office_price_psf',
      'industrial_price_psf', 'self_storage_price_psf', 'student_housing_price_per_bed',
      'data_center_price_per_kw', 'manufactured_housing_price_per_site']) {
      const definition = metric(id, 'mixed_use');
      const [path] = sizeDenominators(definition.formula, ['mixed_use']);
      expect(path).toBeDefined();
      const [, slot, field] = path!.split('.');
      const p = simple();
      p.frontmatter.asset_class = 'mixed_use';
      p.sections.components = block('components', { [slot!]: { [field!]: -1, allocation_pct: 1 } });
      const before = JSON.stringify(p);
      expect(verifyStatedMetric(definition, p, 123, undefined, 2))
        .toEqual({ state: 'unverifiable', reason: 'negative_size_denominator', computed: null });
      expect(JSON.stringify(p)).toBe(before);
      (p.sections.components as UWBlock).content = { [slot!]: { [field!]: 0, allocation_pct: 1 } };
      expect(verifyStatedMetric(definition, p, 123, undefined, 2).reason).toBe('CALC-DIV-ZERO');
      (p.sections.components as UWBlock).content = { [slot!]: { [field!]: 1, allocation_pct: 1 } };
      expect(verifyStatedMetric(definition, p, 123, undefined, 2).state).toBe('failed');
    }
    expect(sizeDenominators('1 / components.retail.custom_size', ['mixed_use'])).toEqual([]);
    expect(sizeDenominators('1 / components.retail.nra_sqft', ['office'])).toEqual([]);
  });

  it('finds a registered size the formula divides by directly, for the class', () => {
    expect(sizeDenominators('valuation.purchase_price / property.total_units', ['multifamily'])).toEqual(['property.total_units']);
    expect(sizeDenominators('valuation.purchase_price / property.total_nra_sqft', ['multifamily'])).toEqual(['property.total_nra_sqft']);
    expect(sizeDenominators('round(noi_model.income.rooms_revenue, 2) / property.keys', ['hospitality'])).toEqual(['property.keys']);
  });

  it('ignores sizes another class registers, numerators and non-size divisors', () => {
    expect(sizeDenominators('valuation.purchase_price / property.keys', ['multifamily'])).toEqual([]);
    expect(sizeDenominators('property.total_units * 12', ['multifamily'])).toEqual([]);
    expect(sizeDenominators('noi_model.net_operating_income / debt_structure.annual_debt_service', ['multifamily'])).toEqual([]);
  });
});

describe('verifyStatedMetrics — stated precision', () => {
  it('needs caller-supplied precision for an envelope-decoded document', () => {
    const source = parseUWFile(repo('conformance/rfc-0089/fixtures/complete-current.uwx.md'));
    const fromSource = verifyStatedMetrics(source);
    // Five quick_metrics/primary-size statements plus four section homes (RFC 0099).
    expect(fromSource.counts).toEqual({ verified: 7, failed: 0, unverifiable: 2 });

    // A decoded document has no rawJson or frontmatter source text, so the
    // rounded statements cannot be compared at their stated precision.
    const decoded = fromUWEnvelope(toUWEnvelope(source));
    const bare = verifyStatedMetrics(decoded);
    expect(bare.counts).toEqual({ verified: 4, failed: 0, unverifiable: 5 });
    for (const item of bare.evidence.filter((e) => e.state === 'unverifiable')) {
      expect(item).toMatchObject({ id: item.id, path: item.path, stated: item.stated, state: 'unverifiable', reason: item.id === 'ltv' ? 'missing_or_null_input' : 'missing_stated_precision', computed: null });
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

// RFC 0125: the secondary area never falls back to power or another area.
describe('data-center price per explicit rentable SF', () => {
  const definition = () => metric('price_per_sqft', 'data_center');
  const source = () => {
    const p = simple();
    p.frontmatter.asset_class = 'data_center';
    p.sections.property = block('property', { rentable_square_feet: 3, critical_it_load_kw: 50, raised_floor_sf: 7 });
    p.sections.valuation = block('valuation', { purchase_price: 1000, price_per_sf: 333.33, purchase_price_per_sqft: 333.34 });
    return p;
  };
  it('checks every explicit home independently with existing cent precision', () => {
    const p = source();
    p.frontmatter.quick_metrics = { price_per_sqft: 333.33 };
    const statedDecimals = new Map([['quick_metrics.price_per_sqft', 2], ['valuation.price_per_sf', 2], ['valuation.purchase_price_per_sqft', 2]]);
    const outcomes = verifyStatedMetrics(p, { statedDecimals }).evidence.filter(e => e.id === 'price_per_sqft');
    expect(outcomes.map(e => [e.path, e.state])).toEqual([
      ['quick_metrics.price_per_sqft', 'verified'], ['valuation.price_per_sf', 'verified'], ['valuation.purchase_price_per_sqft', 'failed'],
    ]);
    expect(verifyStatedMetric(definition(), p, 333.33, undefined, 0).state).toBe('verified');
    (p.sections.property as UWBlock).content.critical_it_load_kw = 900;
    expect(verifyStatedMetric(definition(), p, 333.33, undefined, 2).state).toBe('verified');
  });
  it('never substitutes power or raised-floor area for an unusable rentable area', () => {
    for (const value of [undefined, null, 0, -3, '3']) {
      const p = source();
      (p.sections.property as UWBlock).content.rentable_square_feet = value;
      expect(verifyStatedMetric(definition(), p, 333.33, undefined, 2).state).toBe('unverifiable');
    }
    const p = source();
    (p.sections.property as UWBlock).content.rentable_square_feet = -3;
    expect(verifyStatedMetric(definition(), p, -333.33, undefined, 2).reason).toBe('negative_size_denominator');
  });
  it('locks an explicit variant and refuses ambiguity instead of selecting by order', () => {
    const p = source(); const a = block('property', { rentable_square_feet: 3 }); const b = block('property', { rentable_square_feet: 4 });
    p.sections.property = { first: a, second: b };
    expect(verifyStatedMetric(definition(), p, 333.33, undefined, 2).reason).toBe('CALC-RESOLVE-002');
    expect(verifyStatedMetric(definition(), p, 333.33, { property: 'first' }, 2).state).toBe('verified');
    expect(verifyStatedMetric(definition(), p, 333.33, { property: 'second' }, 2).state).toBe('failed');
  });
});

describe('RFC 0126 land carry NOI', () => {
  const definition = () => metric('land_carry_noi', 'land');
  const source = (egi: unknown, opex: unknown) => {
    const p = simple(); p.frontmatter.asset_class = 'land';
    p.sections.noi_model = block('noi_model', { income: { effective_gross_income: egi }, expenses: { total_operating_expenses: opex }, net_operating_income: -10 });
    return p;
  };
  it('verifies zero/negative/positive subtraction and existing negative cent rounding', () => {
    for (const [egi, opex, stated] of [[20, 30, -10], [30, 30, 0], [30, 20, 10], [0, 1.005, -1.01]]) {
      expect(verifyStatedMetric(definition(), source(egi, opex), stated, undefined, 2).state).toBe('verified');
    }
    expect(verifyStatedMetric(definition(), source(20, 30), -11, undefined, 0).state).toBe('failed');
    for (const value of [undefined, null, '20']) expect(verifyStatedMetric(definition(), source(value, 30), -10, undefined, 2).state).toBe('unverifiable');
  });
  it('checks the explicit NOI alias and quick metric independently without land income ratios', () => {
    const p = source(20, 30); p.frontmatter.quick_metrics = { land_carry_noi: -11 };
    const r = verifyStatedMetrics(p, { statedDecimals: new Map([['quick_metrics.land_carry_noi', 0], ['noi_model.net_operating_income', 0]]) });
    expect(r.evidence.filter(e => e.id === 'land_carry_noi').map(e => [e.path, e.state])).toEqual([['quick_metrics.land_carry_noi', 'failed'], ['noi_model.net_operating_income', 'verified']]);
    expect(r.evidence.some(e => ['cap_rate', 'dscr', 'debt_yield'].includes(e.id))).toBe(false);
  });
  it('keeps same-block operands per exact variant and never borrows a missing total', () => {
    const p = source(20, 30); const first = p.sections.noi_model as UWBlock;
    const second = block('noi_model', { income: { effective_gross_income: 5 }, expenses: { total_operating_expenses: 20 }, net_operating_income: -15 });
    p.sections.noi_model = { first, second };
    const precision = new Map([['noi_model.net_operating_income', 0]]);
    expect(verifyStatedMetrics(p, { statedDecimals: precision }).evidence.filter(e => e.id === 'land_carry_noi').map(e => [e.path, e.state])).toEqual([['noi_model[first].net_operating_income', 'verified'], ['noi_model[second].net_operating_income', 'verified']]);
    delete (first.content.expenses as Record<string, unknown>).total_operating_expenses;
    expect(verifyStatedMetrics(p, { statedDecimals: precision }).evidence.filter(e => e.id === 'land_carry_noi').map(e => e.state)).toEqual(['unverifiable', 'verified']);
    expect(verifyStatedMetric(definition(), p, -15, undefined, 0).reason).toBe('CALC-RESOLVE-002');
  });
  it('does not sum expense detail or use debt service/other blocks as inputs', () => {
    const p = source(20, 30); const payload = (p.sections.noi_model as UWBlock).content;
    (payload.expenses as Record<string, unknown>).a_detail = 999999;
    (p.sections.debt_structure as UWBlock).content.annual_debt_service = 999999;
    expect(verifyStatedMetric(definition(), p, -10, undefined, 0).state).toBe('verified');
  });
});

it('retains lexical value positions independently of numeric token spelling', () => {
  const positions = new Map<string,number>();
  const tokens = jsonNumericTokens('{"z":true,"10":"x","2":4.00}',positions);
  expect(positions.get('["z"]')!).toBeLessThan(positions.get('["10"]')!);
  expect(positions.get('["10"]')!).toBeLessThan(positions.get('["2"]')!);
  expect(tokens.get('["2"]')).toBe('4.00');
});


describe('seeded source verification adversarial properties', () => {
  it('keeps stated copies invariant under JSON member order and detects changed statements', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 1000000 }), units => {
      const front = '---\nuw_version: "3.0"\nasset_class: multifamily\n---\n';
      const make = (stated: number, reverse: boolean) => {
        const content = { _meta: { section: 'property' }, total_units: 1 };
        const body = JSON.stringify(reverse ? Object.fromEntries(Object.entries(content).reverse()) : content);
        const header = front.replace('asset_class: multifamily', `asset_class: multifamily\nquick_metrics:\n  price_per_unit: ${stated}`);
        const valuation = JSON.stringify({ _meta: { section: 'valuation' }, purchase_price: units });
        return [header, '', '```json uw:section=property', body, '```', '', '```json uw:section=valuation', valuation, '```', ''].join('\n');
      };
      const first = verifyStatedMetrics(parseUWFile(make(units, false)));
      const reordered = verifyStatedMetrics(parseUWFile(make(units, true)));
      expect(reordered).toEqual(first);
      const changed = verifyStatedMetrics(parseUWFile(make(units + 1, false)));
      expect(changed.evidence.find(e => e.path === 'quick_metrics.price_per_unit')?.state).toBe('failed');
    }), { seed: 128016, numRuns: 150 });
  });
});
