// Self-storage pack tests - pack integrity + AST->Excel emitter parity.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CalcEvaluationContext } from '../protocol.js';
import { evaluateCalc } from '../calc/index.js';
import { parseExpression } from '../calc/parser.js';
import { parseUWFile } from '../parser.js';
import { emitExcelFormula } from './excel-emit.js';
import { SELF_STORAGE_PACK } from './self-storage.js';

const EXAMPLE = resolve(__dirname, '../../../../examples/Sonoran-Self-Storage-Peoria-AZ.uwx.md');

const NAMED_RANGES = new Map<string, string>([
  ['noi_model.net_operating_income', 'noi'],
  ['noi_model.income.effective_gross_income', 'effective_gross_income'],
  ['noi_model.income.gross_potential_rent', 'gross_potential_rent'],
  ['noi_model.expenses.total_operating_expenses', 'total_operating_expenses'],
  ['valuation.purchase_price', 'purchase_price'],
  ['debt_structure.loan_amount', 'loan_amount'],
  ['debt_structure.annual_debt_service', 'annual_debt_service'],
  ['property.net_rentable_square_feet', 'net_rentable_square_feet'],
  ['property.rentable_units', 'rentable_units'],
  ['sources_uses.sources.sponsor_equity', 'sponsor_equity'],
  ['sources_uses.uses.total', 'total_uses'],
  ['rent_roll.occupied_units', 'occupied_units'],
]);

describe('SELF_STORAGE_PACK', () => {
  it('declares the canonical self-storage metrics', () => {
    const ids = (SELF_STORAGE_PACK.calculations ?? []).map((c) => c.id).sort();
    expect(ids).toEqual([
      'cap_rate',
      'cash_on_cash',
      'debt_yield',
      'dscr',
      'economic_occupancy',
      'expense_ratio',
      'loan_per_nrsf',
      'ltc',
      'ltv',
      'noi_per_nrsf',
      'physical_occupancy',
      'price_per_nrsf',
    ]);
  });

  it('targets the self_storage asset class', () => {
    expect(SELF_STORAGE_PACK.asset_classes).toEqual(['self_storage']);
  });

  it('every calc has a parseable formula and Excel-emittable paths', () => {
    for (const c of SELF_STORAGE_PACK.calculations ?? []) {
      expect(() => parseExpression(c.formula), `${c.id} should parse`).not.toThrow();
      expect(() => emitExcelFormula(c.formula, { namedRanges: NAMED_RANGES }), `${c.id} should emit`).not.toThrow();
    }
  });

  it('every metric evaluates against the Sonoran fixture and matches Excel-like evaluation', async () => {
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
      net_rentable_square_feet: property.content['net_rentable_square_feet'] as number,
      rentable_units: property.content['rentable_units'] as number,
      sponsor_equity: sources['sponsor_equity']!,
      total_uses: uses['total']!,
      occupied_units: rentRoll.content['occupied_units'] as number,
    };

    for (const c of SELF_STORAGE_PACK.calculations ?? []) {
      const direct = evaluateCalc(c, ctx);
      expect(direct.ok, `${c.id}: ${direct.error?.message ?? ''}`).toBe(true);

      let formula = emitExcelFormula(c.formula, { namedRanges: NAMED_RANGES });
      for (const [, name] of NAMED_RANGES) {
        formula = formula.replace(new RegExp(`\\b${name}\\b`, 'g'), String(values[name]));
      }
      expect(/^[\d.+\-*/() ]+$/.test(formula), `formula sanitized: ${formula}`).toBe(true);
      // eslint-disable-next-line no-new-func
      const excelLike = new Function(`return (${formula});`)() as number;
      expect(excelLike, c.id).toBeCloseTo(direct.value as number, 6);
    }
  });
});
