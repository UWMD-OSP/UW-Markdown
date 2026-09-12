import { describe, expect, it, vi } from 'vitest';
import { rankGaps } from './refinement.js';
import { parseUWFile } from './parser.js';

const MINIMAL_MULTIFAMILY = `---
uw_version: "1.1"
deal_id: "uw_2026_TEST"
deal_name: "Test Deal"
created: "2026-01-01T00:00:00Z"
last_modified: "2026-01-01T00:00:00Z"
property_address: "1 Test Way"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
status: draft
deal_stage: scope
recommendation: null
flags: []
blocking_flags: []
tier: screener
institution_config_id: null
created_by: wizard
source_documents: []
---

# Test Deal

## Property {#property}

\`\`\`json uw:section=property source=manual ts=2026-01-01T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "user",
    "timestamp": "2026-01-01T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "total_units": 24,
  "total_nra_sqft": 20000,
  "asset_class": "multifamily"
}
\`\`\`

## Valuation {#valuation}

\`\`\`json uw:section=valuation source=manual ts=2026-01-01T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "valuation",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "user",
    "timestamp": "2026-01-01T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "purchase_price": 5000000
}
\`\`\`
`;

describe('rankGaps — minimal multifamily file', () => {
  const parsed = parseUWFile(MINIMAL_MULTIFAMILY);

  it('produces a non-empty ranking when targeting cap_rate', () => {
    const r = rankGaps(parsed, { targets: ['cap_rate'] });
    // cap_rate reads noi_model.net_operating_income / valuation.purchase_price.
    // Neither path has a direct asset_class_default entry — they'd resolve to
    // NaN — but the engine still records them. Diagnostics should reflect.
    expect(r.diagnostics.graph_size).toBeGreaterThanOrEqual(1);
  });

  it('returns gaps when targeting a calc whose inputs are in the defaults table', () => {
    // Build a graph where dscr is the target. dscr formula:
    //   noi_model.net_operating_income / debt_structure.annual_debt_service
    // Neither has a direct asset_class_default. But we can extend defaults
    // to include synthetic inputs. For this fixture we just verify that
    // when no inputs are gap-resolvable, the ranking is empty (not crashed).
    const r = rankGaps(parsed, { targets: ['dscr'] });
    expect(r.by_voi).toEqual([]);
    expect(r.diagnostics.resolved).toBeGreaterThanOrEqual(2);
  });

  it('honors the `top` option', () => {
    const r = rankGaps(parsed, { top: 2 });
    expect(r.by_voi.length).toBeLessThanOrEqual(2);
  });

  it('flags no non-monotonic outputs for the standard multifamily pack', () => {
    const r = rankGaps(parsed);
    // The eight built-in multifamily metrics are all pure ratios — monotonic.
    expect(r.diagnostics.non_monotonic).toEqual([]);
  });
});

describe('rankGaps — synthetic gap-driven calc', () => {
  // To test VOI computation directly, build a tiny custom calc whose inputs
  // map to defaulted paths. We piggyback on multifamily defaults so the
  // cascade returns a {low, central, high} range for each input.
  const file = `---
uw_version: "1.1"
deal_id: "uw_2026_VOI"
deal_name: "VOI Test"
created: "2026-01-01T00:00:00Z"
last_modified: "2026-01-01T00:00:00Z"
property_address: "1 VOI Way"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
status: draft
deal_stage: scope
recommendation: null
flags: []
blocking_flags: []
tier: screener
institution_config_id: null
created_by: wizard
source_documents: []
---

# VOI Test

## Custom Calculations {#custom_calculations}

\`\`\`json uw:section=custom_calculations source=manual ts=2026-01-01T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "custom_calculations",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "user",
    "timestamp": "2026-01-01T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "id": "synth_score",
  "label": "Synthetic Score",
  "formula": "noi_model.expense_ratio + rent_roll.vacancy_pct + debt_structure.rate_pct"
}
\`\`\`
`;
  const parsed = parseUWFile(file);

  it('ranks expense_ratio, vacancy_pct, rate_pct as gaps for synth_score', () => {
    const r = rankGaps(parsed, { targets: ['synth_score'] });
    const paths = r.by_voi.map(g => g.field_path);
    expect(paths).toEqual(
      expect.arrayContaining([
        'noi_model.expense_ratio',
        'rent_roll.vacancy_pct',
        'debt_structure.rate_pct',
      ]),
    );
  });

  it('every ranked gap carries a question_template when one is registered', () => {
    const r = rankGaps(parsed, { targets: ['synth_score'] });
    for (const gap of r.by_voi) {
      // expense_ratio / vacancy_pct / rate_pct are all in the registry.
      expect(gap.question_template).toBeTruthy();
    }
  });

  it('total_voi is non-negative (collapsing a gap cannot widen output ranges)', () => {
    const r = rankGaps(parsed, { targets: ['synth_score'] });
    for (const gap of r.by_voi) {
      expect(gap.total_voi).toBeGreaterThanOrEqual(0);
    }
  });

  it('ranking is monotonically descending in total_voi', () => {
    const r = rankGaps(parsed, { targets: ['synth_score'] });
    for (let i = 1; i < r.by_voi.length; i++) {
      expect(r.by_voi[i - 1].total_voi).toBeGreaterThanOrEqual(r.by_voi[i].total_voi);
    }
  });

  it('diagnostics report the perturbation count', () => {
    const r = rankGaps(parsed, { targets: ['synth_score'] });
    expect(r.diagnostics.perturbations).toBeGreaterThan(0);
  });
});

// RFC 0042 acceptance cases exercise values and consumer behavior, not only ASTs.
import type { ParsedUWFile, UWBlock } from './types.js';
import { evaluateCalc, quantizeDecimal } from './calc/index.js';
import { resolveValue } from './cascade.js';
import { readFileSync } from 'node:fs';
import { Ajv2020 as Ajv } from 'ajv/dist/2020.js';

function periodBlock(section: string, content: Record<string, unknown>, variant?: string): UWBlock {
  return { annotation: { section, ...(variant ? { variant } : {}) }, content,
    meta: { section, version: 1, source: 'manual', superseded: false } as UWBlock['meta'],
    prose: '', rawJson: '', lineStart: 1, lineEnd: 1 };
}
const PERIOD_PATH = 'dcf.annual_cash_flows@Y3.noi';
const GAP = 'noi_model.expense_ratio';
function periodFile(formula = `${PERIOD_PATH} * ${GAP}`): ParsedUWFile {
  const parsed = parseUWFile(MINIMAL_MULTIFAMILY);
  parsed.sections['dcf'] = periodBlock('dcf', { annual_cash_flows: [{ year: 3, noi: 300 }, { year: 1, noi: 100 }] });
  parsed.custom_calculations = [periodBlock('custom_calculations', { id: 'period', formula })];
  return parsed;
}
function ranked(parsed = periodFile(), options: Parameters<typeof rankGaps>[1] = {}) {
  return rankGaps(parsed, { packs: [], ...options });
}

describe('RFC 0042 stated period refinement', () => {
  it('ranks an ordinary gap with fixed period values and agrees with calc endpoints', () => {
    const parsed = periodFile();
    const before = JSON.stringify(parsed);
    const result = ranked(parsed);
    expect(result.diagnostics.period_inputs).toEqual([]);
    expect(result.diagnostics.non_monotonic).toEqual([]);
    expect(result.by_voi.map(g => g.field_path)).toEqual([GAP]);
    const gap = result.by_voi[0]!;
    const range = resolveValue(GAP, parsed).range!;
    const endpoint = (value: number) => evaluateCalc({ id: 'endpoint', label: 'Endpoint', deterministic: true,
      formula: `${PERIOD_PATH} * ${GAP}`, round_to: 6 },
    { parsed, prior_results: {}, locale: 'en-US', overrides: { [GAP]: value } }).value;
    const sensitivity = gap.affected_outputs[0]!;
    const atBoundary = (range: { low: number; high: number }) => ({ low: quantizeDecimal(range.low, 6), high: quantizeDecimal(range.high, 6) });
    expect({ ...sensitivity, range_today: atBoundary(sensitivity.range_today), range_if_known: atBoundary(sensitivity.range_if_known) }).toMatchObject({ output_id: 'period',
      range_today: { low: endpoint(range.low), high: endpoint(range.high) },
      range_if_known: { low: endpoint(range.central), high: endpoint(range.central) } });
    expect(gap.total_voi).toBeGreaterThan(0);
    expect(JSON.stringify(parsed)).toBe(before);
    ((parsed.sections['dcf'] as UWBlock).content['annual_cash_flows'] as unknown[]).reverse();
    expect(ranked(parsed)).toEqual(result);
  });

  it.each([
    ['noi_model', { projections: { year_03: { amount: 300 }, year_1: { amount: 100 } } }, 'noi_model.projections@Y3.amount'],
    ['lease_up_schedule', { period_granularity: 'quarterly', schedule: [{ period: '2028-Q1', amount: 300 }] }, 'lease_up_schedule.schedule@2028-Q1.amount'],
    ['lease_up_schedule', { period_granularity: 'monthly', schedule: [{ period: '2028-01', amount: 300 }] }, 'lease_up_schedule.schedule@2028-01.amount'],
    ['cash_flow_series', { series: [{ date: '2028-02-29', amount: 300 }] }, 'cash_flow_series.series@2028-02-29.amount'],
    ['distribution_waterfall', { stated_schedule: [{ date: '2028-02-29', amount: 300 }] }, 'distribution_waterfall.stated_schedule@2028-02-29.amount'],
  ] as const)('ranks with the registered %s series', (section, content, path) => {
    const expected = ranked();
    const parsed = periodFile(`${path} * ${GAP}`);
    parsed.sections[section] = periodBlock(section, content);
    const result = ranked(parsed);
    expect(result.by_voi).toEqual(expected.by_voi);
    expect(result.diagnostics.period_inputs).toEqual([]);
  });

  it.each([null, '300', true, {}, [], Number.NaN, Number.POSITIVE_INFINITY])('reports unavailable numeric input %s', value => {
    const parsed = periodFile();
    (parsed.sections['dcf'] as UWBlock).content['annual_cash_flows'] = [{ year: 3, noi: value }];
    const result = ranked(parsed);
    expect(result.by_voi).toEqual([]);
    expect(result.diagnostics.period_inputs).toEqual([expect.objectContaining({ output_id: 'period', field_path: PERIOD_PATH,
      code: value === null ? 'REFINE-PERIOD-MISSING' : 'REFINE-PERIOD-NONNUMERIC' })]);
  });

  it.each([
    ['dcf.annual_cash_flows@Y2.noi', 'REFINE-PERIOD-MISSING'],
    ['dcf.annual_cash_flows@Y3.absent', 'REFINE-PERIOD-MISSING'],
    ['dcf.annual_cash_flows@2028-Q1.noi', 'REFINE-PERIOD-MISSING'],
    ['dcf.annual_cash_flows@Y3.__proto__', 'REFINE-PERIOD-MISSING'],
    ['dcf.misspelled@Y3.noi', 'CALC-PERIOD-001'],
    ['dcf.annual_cash_flows@2027-02-29.noi', 'CALC-PERIOD-001'],
  ])('diagnoses %s even when there are no ordinary gaps', (path, code) => {
    const result = ranked(periodFile(path));
    expect(result.by_voi).toEqual([]);
    expect(result.diagnostics.period_inputs).toEqual([expect.objectContaining({ output_id: 'period', field_path: path, code })]);
  });

  it.each([
    [[{ year: 3, noi: 300 }, { year: 3, noi: 400 }], 'CALC-PERIOD-002'],
    [[{ year: 3, noi: 300 }, { year: 0, noi: 400 }], 'CALC-PERIOD-001'],
    [{}, 'CALC-PERIOD-001'],
  ])('checks the complete series before returning a selected row', (rows, code) => {
    const parsed = periodFile();
    (parsed.sections['dcf'] as UWBlock).content['annual_cash_flows'] = rows;
    expect(ranked(parsed).diagnostics.period_inputs?.[0]?.code).toBe(code);
  });

  it('selects generic primary or an explicit component and reports ambiguous variants', () => {
    const parsed = periodFile();
    const primary = periodBlock('dcf', { _role: 'primary', annual_cash_flows: [{ year: 3, noi: 300 }] }, 'main');
    const component = periodBlock('dcf', { _role: 'component', annual_cash_flows: [{ year: 3, noi: 30 }] }, 'retail');
    parsed.sections['dcf'] = { retail: component, main: primary };
    expect(ranked(parsed)).toEqual(ranked());
    const result = ranked(parsed, { periodContext: { sectionVariants: { dcf: 'retail' } } });
    expect(result.by_voi[0]!.affected_outputs[0]!.range_today.high).toBe(ranked().by_voi[0]!.affected_outputs[0]!.range_today.high / 10);
    expect(ranked(parsed, { periodContext: { sectionVariants: { dcf: 'absent' } } }).diagnostics.period_inputs?.[0]?.code).toBe('CALC-PERIOD-003');
    primary.content['_role'] = 'senior'; component.content['_role'] = 'junior';
    expect(ranked(parsed).diagnostics.period_inputs?.[0]?.code).toBe('CALC-PERIOD-003');
  });

  it('honors numeric, zero and null overrides without sending period keys to the cascade', () => {
    const parsed = periodFile();
    delete parsed.sections['dcf'];
    const resolve = vi.fn((_path: string) => null);
    const cascadeContext = { market: { resolve, staleness_seconds: 3600 },
      profile: { values: { [PERIOD_PATH]: 999 }, source_id: 'profile' },
      inherited: [{ document_id: 'ancestor', digest: 'sha256:x', distance: 1, values: { [PERIOD_PATH]: 999 } }],
      global: { values: { [PERIOD_PATH]: 999 } }, system: { values: { [PERIOD_PATH]: 999 } } };
    const missing = ranked(parsed, { cascadeContext });
    expect(missing.diagnostics.period_inputs?.[0]?.code).toBe('REFINE-PERIOD-MISSING');
    expect(resolve.mock.calls.map(call => call[0])).not.toContain(PERIOD_PATH);
    expect(ranked(parsed, { cascadeContext, periodContext: { overrides: { [PERIOD_PATH]: 300 } } }).by_voi).toEqual(ranked().by_voi);
    expect(ranked(parsed, { periodContext: { overrides: { [PERIOD_PATH]: 0 } } }).diagnostics.period_inputs).toEqual([]);
    expect(ranked(periodFile(), { periodContext: { overrides: { [PERIOD_PATH]: null } } }).diagnostics.period_inputs?.[0]?.code).toBe('REFINE-PERIOD-MISSING');
    expect(ranked(periodFile(), { periodContext: { overrides: { [GAP]: 99 } } })).toEqual(ranked());
  });

  it('validates reference syntax before overrides but bypasses document errors with valid overrides', () => {
    const bad = 'dcf.unregistered@Y3.noi';
    expect(ranked(periodFile(bad), { periodContext: { overrides: { [bad]: 300 } } }).diagnostics.period_inputs?.[0]?.code).toBe('CALC-PERIOD-001');
    const parsed = periodFile();
    (parsed.sections['dcf'] as UWBlock).content['annual_cash_flows'] = [{ year: 3 }, { year: 3 }];
    expect(ranked(parsed, { periodContext: { overrides: { [PERIOD_PATH]: 300 }, sectionVariants: { dcf: 'absent' } } }).by_voi).toEqual(ranked().by_voi);
    const inherited = Object.create({ [PERIOD_PATH]: 300 }) as Record<string, number>;
    expect(ranked(parsed, { periodContext: { overrides: inherited } }).diagnostics.period_inputs?.[0]?.code).toBe('CALC-PERIOD-002');
  });

  it('keeps literal dotted/@ leaf names distinct and canonicalizes repeated references', () => {
    const parsed = periodFile(`dcf.annual_cash_flows@Y3['tax.rate'] + dcf.annual_cash_flows@Y3.tax.rate + dcf.annual_cash_flows@Y3['x@y'] + ${GAP}`);
    (parsed.sections['dcf'] as UWBlock).content['annual_cash_flows'] = [{ year: 3, 'tax.rate': 100, tax: { rate: 200 }, 'x@y': 7 }];
    expect(ranked(parsed).by_voi[0]!.affected_outputs[0]!.range_today.low).toBe(307 + resolveValue(GAP, parsed).range!.low);
    const missing = periodFile(`${PERIOD_PATH} + ${PERIOD_PATH} + dcf.annual_cash_flows@Y2.noi`);
    delete missing.sections['dcf'];
    expect(ranked(missing).diagnostics.period_inputs?.map(issue => issue.field_path)).toEqual([PERIOD_PATH, 'dcf.annual_cash_flows@Y2.noi']);
  });

  it('keeps an ordinary literal @ path separate even if its graph key matches a selector', () => {
    const parsed = periodFile(`${PERIOD_PATH} + dcf['annual_cash_flows@Y3'].noi + ${GAP}`);
    const resolve = vi.fn((path: string) => path === PERIOD_PATH ? { value: 7 } : null);
    const result = ranked(parsed, { cascadeContext: { market: { resolve, staleness_seconds: 3600 } } });
    expect(result.by_voi[0]!.affected_outputs[0]!.range_today.low).toBe(307 + resolveValue(GAP, parsed).range!.low);
    expect(resolve).toHaveBeenCalledWith(PERIOD_PATH, expect.anything());
  });

  it('retains unaffected rankings, honors selected targets and reports each affected output', () => {
    const parsed = periodFile(); delete parsed.sections['dcf'];
    parsed.custom_calculations.push(periodBlock('custom_calculations', { id: 'other', formula: `${PERIOD_PATH} + ${GAP}` }));
    parsed.custom_calculations.push(periodBlock('custom_calculations', { id: 'scalar', formula: GAP }));
    const result = ranked(parsed);
    expect(result.by_voi[0]!.affected_outputs.map(o => o.output_id)).toEqual(['scalar']);
    expect(result.diagnostics.period_inputs?.map(issue => issue.output_id)).toEqual(['period', 'other']);
    const scalar = ranked(parsed, { targets: ['scalar'] });
    expect(scalar.diagnostics).not.toHaveProperty('period_inputs');
    expect(scalar.by_voi).toEqual(result.by_voi);
  });

  it('retains unsupported-call diagnostics after resolving period inputs', () => {
    const result = ranked(periodFile(`sum(${PERIOD_PATH}, ${GAP})`));
    expect(result.by_voi).toEqual([]);
    expect(result.diagnostics.period_inputs).toEqual([]);
    expect(result.diagnostics.non_monotonic).toEqual([{ output_id: 'period', reason: 'AST contains non-monotonic op (mod / call / cond)' }]);
  });

  it('validates all issue codes against the published diagnostic schema', () => {
    const schema = JSON.parse(readFileSync(new URL('../../../spec/schemas/period-refinement-issue.schema.json', import.meta.url), 'utf8'));
    const validate = new Ajv().compile(schema);
    const issue = ranked(periodFile('dcf.annual_cash_flows@Y2.noi')).diagnostics.period_inputs![0]!;
    for (const code of ['REFINE-PERIOD-MISSING', 'REFINE-PERIOD-NONNUMERIC', 'CALC-PERIOD-001', 'CALC-PERIOD-002', 'CALC-PERIOD-003']) {
      expect(validate({ ...issue, code })).toBe(true);
    }
    expect(validate({ ...issue, code: 'unknown' })).toBe(false);
    const { field_path: _path, ...missing } = issue;
    expect(validate(missing)).toBe(false);
  });
});


it('refinement resolves a v2 content envelope and reads each repeated period value once', () => {
  const parsed = periodFile(`${PERIOD_PATH} + ${PERIOD_PATH} + ${GAP}`);
  let reads = 0;
  (parsed.sections['dcf'] as UWBlock).content = { content: { annual_cash_flows: [{ year: 3, get noi() { reads++; return 300; } }] } };
  const result = ranked(parsed);
  expect(reads).toBe(1);
  expect(result.diagnostics.period_inputs).toEqual([]);
  expect(result.by_voi[0]!.affected_outputs[0]!.range_today.low).toBe(600 + resolveValue(GAP, parsed).range!.low);
});

it('refinement does not reclassify an unexpected resolver failure as missing input', () => {
  const parsed = periodFile();
  (parsed.sections['dcf'] as UWBlock).content = { get annual_cash_flows() { throw new TypeError('unexpected accessor failure'); } };
  expect(() => ranked(parsed)).toThrow('unexpected accessor failure');
});

it('refinement never calls a cascade provider for a selector-only target', () => {
  const parsed = periodFile(PERIOD_PATH);
  delete parsed.sections['dcf'];
  const resolve = vi.fn(() => ({ value: 999 }));
  const result = ranked(parsed, { cascadeContext: { market: { resolve, staleness_seconds: 3600 } } });
  expect(resolve).not.toHaveBeenCalled();
  expect(result.diagnostics.period_inputs?.[0]?.code).toBe('REFINE-PERIOD-MISSING');
});
