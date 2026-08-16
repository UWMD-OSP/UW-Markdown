// Student-housing pack tests - pack integrity + AST->Excel emitter parity.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CalcEvaluationContext } from '../protocol.js';
import { evaluateCalc } from '../calc/index.js';
import { parseExpression } from '../calc/parser.js';
import { parseUWFile } from '../parser.js';
import { emitExcelFormula } from './excel-emit.js';
import { quantizeDecimal, resolveRoundTo } from '../calc/quantize.js';
import { STUDENT_HOUSING_PACK } from './student-housing.js';

const EXAMPLE = resolve(__dirname, '../../../../examples/Mill-Ave-Commons-Student-Tempe-AZ.uwx.md');

const NAMED_RANGES = new Map<string, string>([
  ['noi_model.net_operating_income', 'noi'],
  ['noi_model.income.effective_gross_income', 'effective_gross_income'],
  ['noi_model.income.gross_potential_rent', 'gross_potential_rent'],
  ['noi_model.expenses.total_operating_expenses', 'total_operating_expenses'],
  ['valuation.purchase_price', 'purchase_price'],
  ['debt_structure.loan_amount', 'loan_amount'],
  ['debt_structure.annual_debt_service', 'annual_debt_service'],
  ['property.total_beds', 'total_beds'],
  ['sources_uses.sources.sponsor_equity', 'sponsor_equity'],
  ['sources_uses.uses.total', 'total_uses'],
  ['rent_roll.occupied_beds', 'occupied_beds'],
  ['rent_roll.preleased_beds', 'preleased_beds'],
]);

describe('STUDENT_HOUSING_PACK', () => {
  it('declares the canonical student-housing metrics', () => {
    const ids = (STUDENT_HOUSING_PACK.calculations ?? []).map((c) => c.id).sort();
    expect(ids).toEqual([
      'cap_rate',
      'cash_on_cash',
      'debt_yield',
      'dscr',
      'expense_ratio',
      'loan_per_bed',
      'ltc',
      'ltv',
      'noi_per_bed',
      'occupancy',
      'pre_lease_rate',
      'price_per_bed',
      'rent_per_bed_monthly',
      'revenue_per_bed',
    ]);
  });

  it('targets the student_housing asset class', () => {
    expect(STUDENT_HOUSING_PACK.asset_classes).toEqual(['student_housing']);
  });

  it('sizes off beds, never units — no metric reads property.total_units', () => {
    for (const c of STUDENT_HOUSING_PACK.calculations ?? []) {
      expect(c.formula, `${c.id} must not size off units`).not.toContain('property.total_units');
    }
  });

  it('every calc has a parseable formula and Excel-emittable paths', () => {
    for (const c of STUDENT_HOUSING_PACK.calculations ?? []) {
      expect(() => parseExpression(c.formula), `${c.id} should parse`).not.toThrow();
      expect(() => emitExcelFormula(c.formula, { namedRanges: NAMED_RANGES }), `${c.id} should emit`).not.toThrow();
    }
  });

  it('every metric evaluates against the Mill Ave fixture and matches Excel-like evaluation', async () => {
    const raw = await readFile(EXAMPLE, 'utf8');
    const parsed = parseUWFile(raw);
    const ctx: CalcEvaluationContext = { parsed, prior_results: {}, locale: 'en-US' };

    const noi = parsed.sections['noi_model'] as { content: Record<string, unknown> };
    const valuation = parsed.sections['valuation'] as { content: Record<string, unknown> };
    const debt = parsed.sections['debt_structure'] as { content: Record<string, unknown> };
    const property = parsed.sections['property'] as { content: Record<string, unknown> };
    const sus = parsed.sections['sources_uses'] as { content: Record<string, unknown> };
    const rentRoll = parsed.sections['rent_roll'] as { content: Record<string, unknown> };
    const income = noi.content['income'] as Record<string, number>;
    const expenses = noi.content['expenses'] as Record<string, number>;
    const sources = sus.content['sources'] as Record<string, number>;
    const uses = sus.content['uses'] as Record<string, number>;

    const values: Record<string, number> = {
      noi: noi.content['net_operating_income'] as number,
      effective_gross_income: income['effective_gross_income']!,
      gross_potential_rent: income['gross_potential_rent']!,
      total_operating_expenses: expenses['total_operating_expenses']!,
      purchase_price: valuation.content['purchase_price'] as number,
      loan_amount: debt.content['loan_amount'] as number,
      annual_debt_service: debt.content['annual_debt_service'] as number,
      total_beds: property.content['total_beds'] as number,
      sponsor_equity: sources['sponsor_equity']!,
      total_uses: uses['total']!,
      occupied_beds: rentRoll.content['occupied_beds'] as number,
      preleased_beds: rentRoll.content['preleased_beds'] as number,
    };

    for (const c of STUDENT_HOUSING_PACK.calculations ?? []) {
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

  it('the operating statement foots to the stated NOI', async () => {
    const raw = await readFile(EXAMPLE, 'utf8');
    const parsed = parseUWFile(raw);
    const noi = parsed.sections['noi_model'] as { content: Record<string, unknown> };
    const income = noi.content['income'] as Record<string, number>;
    const expenses = noi.content['expenses'] as Record<string, number>;

    // vacancy_credit_loss is stored positive and subtracted, matching the layout sign.
    const incomeLines = Object.entries(income)
      .filter(([k]) => k !== 'effective_gross_income')
      .reduce((a, [k, v]) => a + (k === 'vacancy_credit_loss' ? -v : v), 0);
    expect(incomeLines).toBe(income['effective_gross_income']);

    const expenseLines = Object.entries(expenses)
      .filter(([k]) => k !== 'total_operating_expenses')
      .reduce((a, [, v]) => a + v, 0);
    expect(expenseLines).toBe(expenses['total_operating_expenses']);

    expect(income['effective_gross_income']! - expenses['total_operating_expenses']!).toBe(
      noi.content['net_operating_income']
    );
  });

  it('pre-lease and in-place occupancy are independent counts, not derived from each other', async () => {
    const raw = await readFile(EXAMPLE, 'utf8');
    const parsed = parseUWFile(raw);
    const rentRoll = parsed.sections['rent_roll'] as { content: Record<string, unknown> };
    const property = parsed.sections['property'] as { content: Record<string, unknown> };

    const beds = property.content['total_beds'] as number;
    const occupied = rentRoll.content['occupied_beds'] as number;
    const preleased = rentRoll.content['preleased_beds'] as number;

    // Both are bed counts bounded by the property, and the fixture deliberately
    // carries a pre-lease figure that differs from in-place occupancy — the two
    // are measured on different dates and must not be collapsed into one field.
    expect(occupied).toBeLessThanOrEqual(beds);
    expect(preleased).toBeLessThanOrEqual(beds);
    expect(preleased).not.toBe(occupied);
  });
});
