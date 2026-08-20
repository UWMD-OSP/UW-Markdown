// Mixed-use pack tests — pack integrity, the deliberate property-denominator
// omissions, per-component NOI shares, allocation-gated intensives, and
// AST→Excel emitter parity. RFC 0019.

import { describe, expect, it } from 'vitest';
import type { CalcEvaluationContext, ModuleCalcDecl } from '../protocol.js';
import { evaluateCalc } from '../calc/index.js';
import { parseExpression } from '../calc/parser.js';
import { parseUWFile } from '../parser.js';
import { emitExcelFormula } from './excel-emit.js';
import { quantizeDecimal, resolveRoundTo } from '../calc/quantize.js';
import { MIXED_USE_PACK } from './mixed-use.js';

const CALCS = MIXED_USE_PACK.calculations ?? [];
const byId = (id: string): ModuleCalcDecl => {
  const c = CALCS.find((x) => x.id === id);
  if (!c) throw new Error(`no calc ${id}`);
  return c;
};

// Standard block-provenance envelope so parseUWFile accepts each section.
function block(id: string, content: Record<string, unknown>): string {
  const meta = {
    section: id,
    version: 1,
    superseded: false,
    source: 'manual',
    agent_id: null,
    agent_version: null,
    actor: 'test-fixture',
    timestamp: '2026-08-18T00:00:00Z',
    confidence: 'high',
    human_review_required: false,
    flags: [],
    input_hash: null,
    notes: null,
  };
  return [
    `## ${id} {#${id}}`,
    '',
    `\`\`\`json uw:section=${id} source=manual ts=2026-08-18T00:00:00Z v=1 confidence=high`,
    JSON.stringify({ _meta: meta, ...content }, null, 2),
    '```',
    '',
  ].join('\n');
}

// An apartments-over-retail-over-hotel property. Three of the eight admissible
// component classes are present; the other five are absent (→ their metrics are
// null). Component NOIs sum to the property NOI, and allocations sum to 1.0.
function fixture(opts: { multifamilyAllocation?: number | null } = {}): string {
  const mfAlloc = opts.multifamilyAllocation === undefined ? 0.55 : opts.multifamilyAllocation;
  const multifamily: Record<string, unknown> = {
    component_class: 'multifamily',
    effective_gross_income: 2_180_000,
    operating_expenses: 880_000,
    net_operating_income: 1_300_000,
    total_units: 120,
    nra_sqft: 96_000,
  };
  if (mfAlloc !== null) multifamily['allocation_pct'] = mfAlloc;

  return [
    '---',
    'uw_version: "1.1"',
    'deal_id: "uw_2026_mixed_001"',
    'deal_name: "Cactus Corners Mixed-Use — Tempe, AZ"',
    'asset_class: "mixed_use"',
    'deal_stage: "full_underwrite"',
    '---',
    '',
    '# Cactus Corners Mixed-Use',
    '',
    block('valuation', { purchase_price: 40_000_000 }),
    block('debt_structure', { loan_amount: 26_000_000, annual_debt_service: 1_900_000 }),
    block('sources_uses', { sources: { equity_sponsor: 14_000_000 } }),
    block('noi_model', { net_operating_income: 2_572_000 }),
    block('components', {
      multifamily,
      retail: {
        component_class: 'retail',
        effective_gross_income: 520_000,
        operating_expenses: 148_000,
        net_operating_income: 372_000,
        nra_sqft: 18_000,
        allocation_pct: 0.15,
      },
      hospitality: {
        component_class: 'hospitality',
        effective_gross_income: 6_900_000,
        operating_expenses: 6_000_000,
        net_operating_income: 900_000,
        gross_operating_profit: 1_400_000,
        allocation_pct: 0.3,
      },
    }),
  ].join('\n');
}

// Every input path across all 21 metrics → a named-range identifier (dots → _),
// so emitExcelFormula can emit every formula and the parity substitution is a
// plain word-boundary replace.
const ALL_PATHS = [
  'noi_model.net_operating_income',
  'valuation.purchase_price',
  'debt_structure.loan_amount',
  'debt_structure.annual_debt_service',
  'sources_uses.sources.equity_sponsor',
  'components.multifamily.net_operating_income',
  'components.retail.net_operating_income',
  'components.office.net_operating_income',
  'components.industrial.net_operating_income',
  'components.self_storage.net_operating_income',
  'components.hospitality.net_operating_income',
  'components.senior_housing.net_operating_income',
  'components.student_housing.net_operating_income',
  'components.multifamily.allocation_pct',
  'components.multifamily.total_units',
  'components.retail.allocation_pct',
  'components.retail.nra_sqft',
  'components.office.allocation_pct',
  'components.office.nra_sqft',
  'components.industrial.allocation_pct',
  'components.industrial.nra_sqft',
  'components.self_storage.allocation_pct',
  'components.self_storage.nra_sqft',
  'components.student_housing.allocation_pct',
  'components.student_housing.total_beds',
  'components.hospitality.gross_operating_profit',
  'components.senior_housing.total_labor_expense',
];
const NAMED_RANGES = new Map<string, string>(ALL_PATHS.map((p) => [p, p.replace(/\./g, '_')]));

// Values only for the paths the *present* components supply, keyed by the
// sanitized named-range identifier.
const VALUES: Record<string, number> = {
  noi_model_net_operating_income: 2_572_000,
  valuation_purchase_price: 40_000_000,
  debt_structure_loan_amount: 26_000_000,
  debt_structure_annual_debt_service: 1_900_000,
  sources_uses_sources_equity_sponsor: 14_000_000,
  components_multifamily_net_operating_income: 1_300_000,
  components_retail_net_operating_income: 372_000,
  components_hospitality_net_operating_income: 900_000,
  components_multifamily_allocation_pct: 0.55,
  components_multifamily_total_units: 120,
  components_retail_allocation_pct: 0.15,
  components_retail_nra_sqft: 18_000,
  components_hospitality_gross_operating_profit: 1_400_000,
};

// Metrics the fixture's present components make non-null — the ones to parity-check.
const PRESENT_METRIC_IDS = [
  'cap_rate',
  'ltv',
  'dscr',
  'debt_yield',
  'cash_on_cash',
  'multifamily_noi_share',
  'retail_noi_share',
  'hospitality_noi_share',
  'multifamily_price_per_unit',
  'retail_price_psf',
  'hospitality_gross_operating_profit',
];

describe('MIXED_USE_PACK', () => {
  it('declares the canonical mixed-use metrics', () => {
    const ids = CALCS.map((c) => c.id).sort();
    expect(ids).toEqual([
      'cap_rate',
      'cash_on_cash',
      'debt_yield',
      'dscr',
      'hospitality_gross_operating_profit',
      'hospitality_noi_share',
      'industrial_noi_share',
      'industrial_price_psf',
      'ltv',
      'multifamily_noi_share',
      'multifamily_price_per_unit',
      'office_noi_share',
      'office_price_psf',
      'retail_noi_share',
      'retail_price_psf',
      'self_storage_noi_share',
      'self_storage_price_psf',
      'senior_housing_noi_share',
      'senior_housing_total_labor_expense',
      'student_housing_noi_share',
      'student_housing_price_per_bed',
    ]);
  });

  it('targets the mixed_use asset class', () => {
    expect(MIXED_USE_PACK.asset_classes).toEqual(['mixed_use']);
  });

  it('every calc is deterministic', () => {
    for (const c of CALCS) expect(c.deterministic, c.id).toBe(true);
  });

  // The point of this pack (RFC 0019 §4). A mixed-use property is not all
  // residential, so a property-level price/unit or loan/unit is the misleading
  // "number that looks like a metric" this design exists to eliminate; and there
  // is no honest blended market cap rate. No metric may read a property-level
  // denominator — every use-level intensive divides a component subtotal instead.
  it('deliberately omits property price/unit, loan/unit, and any blended cap rate', () => {
    const ids = new Set(CALCS.map((c) => c.id));
    expect(ids.has('price_per_unit')).toBe(false);
    expect(ids.has('loan_per_unit')).toBe(false);
    expect(ids.has('loan_per_sqft')).toBe(false);
    expect(ids.has('blended_cap_rate')).toBe(false);
    for (const c of CALCS) {
      expect(c.formula, `${c.id} must not read a property-level denominator`).not.toContain(
        'property.',
      );
    }
  });

  it('every calc has a parseable formula and Excel-emittable paths', () => {
    for (const c of CALCS) {
      expect(() => parseExpression(c.formula), `${c.id} should parse`).not.toThrow();
      expect(
        () => emitExcelFormula(c.formula, { namedRanges: NAMED_RANGES }),
        `${c.id} should emit`,
      ).not.toThrow();
    }
  });

  it('present-component metrics evaluate and match Excel-like evaluation exactly', () => {
    const parsed = parseUWFile(fixture());
    const ctx: CalcEvaluationContext = { parsed, prior_results: {}, locale: 'en-US' };

    for (const id of PRESENT_METRIC_IDS) {
      const c = byId(id);
      const direct = evaluateCalc(c, ctx);
      expect(direct.ok, `${id}: ${direct.error?.message ?? ''}`).toBe(true);
      expect(direct.value, `${id} should be non-null in the fixture`).not.toBeNull();

      let formula = emitExcelFormula(c.formula, { namedRanges: NAMED_RANGES });
      for (const [, name] of NAMED_RANGES) {
        if (VALUES[name] === undefined) continue;
        formula = formula.replace(new RegExp(`\\b${name}\\b`, 'g'), String(VALUES[name]));
      }
      expect(/^[\d.+\-*/() ]+$/.test(formula), `formula sanitized: ${formula}`).toBe(true);
      // eslint-disable-next-line no-new-func
      const excelLike = new Function(`return (${formula});`)() as number;
      const excelCell = quantizeDecimal(excelLike, resolveRoundTo(c));
      expect(excelCell, id).toBe(direct.value as number);
    }
  });

  it('metrics for absent component classes evaluate to null, not zero or error', () => {
    const parsed = parseUWFile(fixture());
    const ctx: CalcEvaluationContext = { parsed, prior_results: {}, locale: 'en-US' };
    for (const id of [
      'office_noi_share',
      'industrial_noi_share',
      'self_storage_price_psf',
      'student_housing_price_per_bed',
      'senior_housing_total_labor_expense',
    ]) {
      const direct = evaluateCalc(byId(id), ctx);
      expect(direct.value, `${id} should be null for an absent component`).toBeNull();
    }
  });

  it('a use-level intensive is null without allocation_pct, never an area-share guess', () => {
    const withAlloc = parseUWFile(fixture({ multifamilyAllocation: 0.55 }));
    const withoutAlloc = parseUWFile(fixture({ multifamilyAllocation: null }));
    const metric = byId('multifamily_price_per_unit');

    const on = evaluateCalc(metric, { parsed: withAlloc, prior_results: {}, locale: 'en-US' });
    expect(on.value, 'with allocation the metric is present').not.toBeNull();

    const off = evaluateCalc(metric, { parsed: withoutAlloc, prior_results: {}, locale: 'en-US' });
    expect(off.value, 'without allocation the metric is null').toBeNull();
  });

  it('the fixture foots: property NOI equals the sum of component NOIs (CC-12)', () => {
    const parsed = parseUWFile(fixture());
    const noi = parsed.sections['noi_model'] as { content: Record<string, unknown> };
    const comps = parsed.sections['components'] as {
      content: Record<string, { net_operating_income: number }>;
    };
    const sum =
      comps.content['multifamily']!.net_operating_income +
      comps.content['retail']!.net_operating_income +
      comps.content['hospitality']!.net_operating_income;
    expect(sum).toBe(noi.content['net_operating_income']);
  });
});
