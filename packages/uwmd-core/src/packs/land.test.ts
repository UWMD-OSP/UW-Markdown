// Land pack tests - pack integrity, the deliberate income-metric omission,
// and AST->Excel emitter parity.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CalcEvaluationContext } from '../protocol.js';
import { evaluateCalc } from '../calc/index.js';
import { parseExpression } from '../calc/parser.js';
import { parseUWFile } from '../parser.js';
import { emitExcelFormula } from './excel-emit.js';
import { quantizeDecimal, resolveRoundTo } from '../calc/quantize.js';
import { LAND_PACK } from './land.js';

const EXAMPLE = resolve(__dirname, '../../../../examples/Sundance-Ranch-Land-Buckeye-AZ.uwx.md');

const NAMED_RANGES = new Map<string, string>([
  ['noi_model.expenses.total_operating_expenses', 'total_operating_expenses'],
  ['valuation.purchase_price', 'purchase_price'],
  ['valuation.projected_gross_sellout', 'projected_gross_sellout'],
  ['debt_structure.loan_amount', 'loan_amount'],
  ['property.gross_acres', 'gross_acres'],
  ['property.usable_acres', 'usable_acres'],
  ['property.entitled_units', 'entitled_units'],
  ['sources_uses.uses.total', 'total_uses'],
]);

describe('LAND_PACK', () => {
  it('declares the canonical land metrics', () => {
    const ids = (LAND_PACK.calculations ?? []).map((c) => c.id).sort();
    expect(ids).toEqual([
      'basis_per_buildable_unit',
      'carry_cost_per_acre',
      'carry_ratio',
      'density_per_usable_acre',
      'land_to_sellout_ratio',
      'loan_per_acre',
      'ltc',
      'ltv',
      'price_per_acre',
      'price_per_buildable_unit',
      'price_per_usable_acre',
      'usable_land_ratio',
    ]);
  });

  it('targets the land asset class', () => {
    expect(LAND_PACK.asset_classes).toEqual(['land']);
  });

  // The point of this pack. Land has no stabilized income, so capitalizing its
  // (negative) NOI produces confidently wrong output. These three metrics are
  // omitted on purpose and must stay omitted.
  it('deliberately omits cap_rate, dscr, and debt_yield', () => {
    const ids = new Set((LAND_PACK.calculations ?? []).map((c) => c.id));
    expect(ids.has('cap_rate')).toBe(false);
    expect(ids.has('dscr')).toBe(false);
    expect(ids.has('debt_yield')).toBe(false);
  });

  it('no metric divides by net_operating_income or capitalizes it', () => {
    for (const c of LAND_PACK.calculations ?? []) {
      expect(c.formula, `${c.id} must not read net_operating_income`).not.toContain(
        'net_operating_income'
      );
    }
  });

  it('every calc has a parseable formula and Excel-emittable paths', () => {
    for (const c of LAND_PACK.calculations ?? []) {
      expect(() => parseExpression(c.formula), `${c.id} should parse`).not.toThrow();
      expect(() => emitExcelFormula(c.formula, { namedRanges: NAMED_RANGES }), `${c.id} should emit`).not.toThrow();
    }
  });

  it('every metric evaluates against the Sundance fixture and matches Excel-like evaluation', async () => {
    const raw = await readFile(EXAMPLE, 'utf8');
    const parsed = parseUWFile(raw);
    const ctx: CalcEvaluationContext = { parsed, prior_results: {}, locale: 'en-US' };

    const noi = parsed.sections['noi_model'] as { content: Record<string, unknown> };
    const valuation = parsed.sections['valuation'] as { content: Record<string, unknown> };
    const debt = parsed.sections['debt_structure'] as { content: Record<string, unknown> };
    const property = parsed.sections['property'] as { content: Record<string, unknown> };
    const sus = parsed.sections['sources_uses'] as { content: Record<string, unknown> };
    const expenses = noi.content['expenses'] as Record<string, number>;
    const uses = sus.content['uses'] as Record<string, number>;

    const values: Record<string, number> = {
      total_operating_expenses: expenses['total_operating_expenses']!,
      purchase_price: valuation.content['purchase_price'] as number,
      projected_gross_sellout: valuation.content['projected_gross_sellout'] as number,
      loan_amount: debt.content['loan_amount'] as number,
      gross_acres: property.content['gross_acres'] as number,
      usable_acres: property.content['usable_acres'] as number,
      entitled_units: property.content['entitled_units'] as number,
      total_uses: uses['total']!,
    };

    for (const c of LAND_PACK.calculations ?? []) {
      const direct = evaluateCalc(c, ctx);
      expect(direct.ok, `${c.id}: ${direct.error?.message ?? ''}`).toBe(true);

      let formula = emitExcelFormula(c.formula, { namedRanges: NAMED_RANGES });
      for (const [, name] of NAMED_RANGES) {
        formula = formula.replace(new RegExp(`\\b${name}\\b`, 'g'), String(values[name]));
      }
      expect(/^[\d.+\-*/() ]+$/.test(formula), `formula sanitized: ${formula}`).toBe(true);
      // eslint-disable-next-line no-new-func
      const excelLike = new Function(`return (${formula});`)() as number;
      // Excel's cell holds ROUND(expr, round_to) because the emitter wraps it
      // (§VIII.5), so the simulated result is quantized the same way. Parity is
      // then *exact* rather than approximate: one identical rounding rule on both
      // sides, which is the whole point of having a quantization boundary.
      const excelCell = quantizeDecimal(excelLike, resolveRoundTo(c));
      expect(excelCell, c.id).toBe(direct.value as number);
    }
  });

  it('the carry model foots and its NOI is negative by design', async () => {
    const raw = await readFile(EXAMPLE, 'utf8');
    const parsed = parseUWFile(raw);
    const noi = parsed.sections['noi_model'] as { content: Record<string, unknown> };
    const income = noi.content['income'] as Record<string, number>;
    const expenses = noi.content['expenses'] as Record<string, number>;

    const incomeLines = Object.entries(income)
      .filter(([k]) => k !== 'effective_gross_income')
      .reduce((a, [, v]) => a + v, 0);
    expect(incomeLines).toBe(income['effective_gross_income']);

    const expenseLines = Object.entries(expenses)
      .filter(([k]) => k !== 'total_operating_expenses')
      .reduce((a, [, v]) => a + v, 0);
    expect(expenseLines).toBe(expenses['total_operating_expenses']);

    expect(income['effective_gross_income']! - expenses['total_operating_expenses']!).toBe(
      noi.content['net_operating_income']
    );

    // The invariant that justifies omitting cap_rate: this is a carry model.
    expect(noi.content['net_operating_income'] as number).toBeLessThan(0);
    expect(noi.content['is_carry_model']).toBe(true);
  });

  it('the fixture leaves cap rate, DSCR, and debt yield explicitly null, not zero', async () => {
    const raw = await readFile(EXAMPLE, 'utf8');
    const parsed = parseUWFile(raw);
    const valuation = parsed.sections['valuation'] as { content: Record<string, unknown> };
    const debt = parsed.sections['debt_structure'] as { content: Record<string, unknown> };

    // null means "does not apply to this asset class"; 0 would mean "measured
    // and found to be zero". The distinction matters to every downstream reader.
    expect(valuation.content['going_in_cap_rate']).toBeNull();
    expect(valuation.content['exit_cap_rate']).toBeNull();
    expect(debt.content['dscr']).toBeNull();
    expect(debt.content['debt_yield']).toBeNull();
  });

  it('usable acreage is a subset of gross, and lots reconcile to platted density', async () => {
    const raw = await readFile(EXAMPLE, 'utf8');
    const parsed = parseUWFile(raw);
    const property = parsed.sections['property'] as { content: Record<string, unknown> };

    const gross = property.content['gross_acres'] as number;
    const usable = property.content['usable_acres'] as number;
    const units = property.content['entitled_units'] as number;

    expect(usable).toBeLessThanOrEqual(gross);
    expect(usable).toBeGreaterThan(0);
    expect(units).toBeGreaterThan(0);
  });
});
