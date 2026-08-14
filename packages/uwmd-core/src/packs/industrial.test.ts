// Industrial pack tests — pack integrity + AST→Excel emitter parity.
//
// Mirrors office.test.ts / retail.test.ts for the industrial asset class. The
// same calc-integrity contract holds: a single ModuleCalcDecl in
// INDUSTRIAL_PACK can be evaluated by `evaluateCalc()` AND emitted as an Excel
// formula that, evaluated against the same named-range values, produces the same
// number. Tested against the Ironwood Logistics worked example.

import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseUWFile } from '../parser.js';
import { evaluateCalc } from '../calc/index.js';
import { INDUSTRIAL_PACK } from './industrial.js';
import { emitExcelFormula } from './excel-emit.js';
import { quantizeDecimal, resolveRoundTo } from '../calc/quantize.js';
import { parseExpression } from '../calc/parser.js';
import type { CalcEvaluationContext } from '../protocol.js';

const IRONWOOD = resolve(
  __dirname,
  '../../../../examples/Ironwood-Logistics-Industrial-Tolleson-AZ.uwx.md',
);

// Full dotted path → workbook-scope named range. Keys mirror the industrial
// field paths the pack references; values stand in for Excel named ranges.
const NAMED_RANGES = new Map<string, string>([
  ['noi_model.net_operating_income', 'noi'],
  ['noi_model.income.effective_gross_income', 'effective_gross_income'],
  ['noi_model.income.expense_reimbursements', 'expense_reimbursements'],
  ['noi_model.expenses.total_operating_expenses', 'total_operating_expenses'],
  ['valuation.purchase_price', 'purchase_price'],
  ['debt_structure.loan_amount', 'loan_amount'],
  ['debt_structure.annual_debt_service', 'annual_debt_service'],
  ['property.rentable_square_feet', 'rentable_square_feet'],
  ['sources_uses.sources.sponsor_equity', 'sponsor_equity'],
  ['sources_uses.uses.total', 'total_uses'],
  ['rent_roll.occupied_sf', 'occupied_sf'],
  ['rent_roll.total_rentable_sf', 'total_rentable_sf'],
]);

describe('INDUSTRIAL_PACK', () => {
  it('declares the canonical industrial metrics', () => {
    const ids = (INDUSTRIAL_PACK.calculations ?? []).map((c) => c.id).sort();
    expect(ids).toEqual([
      'cap_rate',
      'cash_on_cash',
      'debt_yield',
      'dscr',
      'expense_ratio',
      'expense_recovery_ratio',
      'loan_per_sqft',
      'ltc',
      'ltv',
      'noi_per_sqft',
      'occupancy',
      'price_per_sqft',
    ]);
  });

  it('targets the industrial asset class', () => {
    expect(INDUSTRIAL_PACK.asset_classes).toEqual(['industrial']);
  });

  it('every calc has a parseable formula', () => {
    for (const c of INDUSTRIAL_PACK.calculations ?? []) {
      expect(() => parseExpression(c.formula), `${c.id} should parse`).not.toThrow();
    }
  });

  it('every calc evaluates against the Ironwood fixture without error', async () => {
    const raw = await readFile(IRONWOOD, 'utf8');
    const parsed = parseUWFile(raw);
    const ctx: CalcEvaluationContext = { parsed, prior_results: {}, locale: 'en-US' };

    for (const c of INDUSTRIAL_PACK.calculations ?? []) {
      const r = evaluateCalc(c, ctx);
      expect(r.ok, `${c.id}: ${r.error?.message ?? ''}`).toBe(true);
      expect(typeof r.value).toBe('number');
    }
  });

  it('every formula path has a named range (Excel-emittable)', () => {
    for (const c of INDUSTRIAL_PACK.calculations ?? []) {
      expect(
        () => emitExcelFormula(c.formula, { namedRanges: NAMED_RANGES }),
        `${c.id} should emit`,
      ).not.toThrow();
    }
  });
});

describe('Industrial Excel emit ↔ evaluateCalc parity', () => {
  it('every industrial metric: Excel formula evaluated against named-range values matches evaluateCalc', async () => {
    const raw = await readFile(IRONWOOD, 'utf8');
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
      expense_reimbursements: income['expense_reimbursements']!,
      total_operating_expenses: expenses['total_operating_expenses']!,
      purchase_price: valuation.content['purchase_price'] as number,
      loan_amount: debt.content['loan_amount'] as number,
      annual_debt_service: debt.content['annual_debt_service'] as number,
      rentable_square_feet: property.content['rentable_square_feet'] as number,
      sponsor_equity: sources['sponsor_equity']!,
      total_uses: uses['total']!,
      occupied_sf: rentRoll.content['occupied_sf'] as number,
      total_rentable_sf: rentRoll.content['total_rentable_sf'] as number,
    };

    for (const c of INDUSTRIAL_PACK.calculations ?? []) {
      const direct = evaluateCalc(c, ctx);
      expect(direct.ok, `${c.id} evaluateCalc`).toBe(true);

      let formula = emitExcelFormula(c.formula, { namedRanges: NAMED_RANGES });
      for (const [, name] of NAMED_RANGES) {
        const re = new RegExp(`\\b${name}\\b`, 'g');
        formula = formula.replace(re, String(values[name]));
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
});
