// Hospitality pack tests - pack integrity + AST->Excel emitter parity.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CalcEvaluationContext } from '../protocol.js';
import { evaluateCalc } from '../calc/index.js';
import { parseExpression } from '../calc/parser.js';
import { parseUWFile } from '../parser.js';
import { emitExcelFormula } from '../packs/excel-emit.js';
import { quantizeDecimal, resolveRoundTo } from '../calc/quantize.js';
import { HOSPITALITY_PACK } from './hospitality.js';

function excelValue(formula: string): number | null {
  const expression = formula.replaceAll('<>""', '!==null').replaceAll('=""', '===null').replaceAll('""', 'null');
  expect(/^[\d. +\-*/(),!=>nullIFORANDU]+$/.test(expression), expression).toBe(true);
  // eslint-disable-next-line no-new-func
  return new Function('IF', 'OR', 'AND', 'ROUND', `return (${expression});`)(
    (test: boolean, yes: number | null, no: number | null) => test ? yes : no,
    (...values: boolean[]) => values.some(Boolean),
    (...values: boolean[]) => values.every(Boolean),
    (value: number, decimals: number) => quantizeDecimal(value, decimals),
  ) as number | null;
}

const EXAMPLE = resolve(__dirname, '../../../../examples/Saguaro-Select-Hotel-Tempe-AZ.uwx.md');

const NAMED_RANGES = new Map<string, string>([
  ['noi_model.net_operating_income', 'noi'],
  ['hotel_metrics.adr', 'hotel_metrics_adr'],
  ['hotel_metrics.occupancy', 'hotel_metrics_occupancy'],
  ['hotel_metrics.available_room_nights', 'hotel_metrics_available_room_nights'],
  ['hotel_metrics.key_count', 'hotel_metrics_key_count'],
  ['hotel_metrics.market_revpar', 'hotel_metrics_market_revpar'],
  ['hotel_food_beverage.fb_revenue', 'hotel_food_beverage_fb_revenue'],
  ['hotel_food_beverage.fb_cogs', 'hotel_food_beverage_fb_cogs'],
  ['hotel_food_beverage.fb_labor', 'hotel_food_beverage_fb_labor'],

  ['noi_model.gross_operating_profit', 'gross_operating_profit'],
  ['noi_model.income.effective_gross_income', 'effective_gross_income'],
  ['noi_model.income.rooms_revenue', 'rooms_revenue'],
  ['noi_model.expenses.total_operating_expenses', 'total_operating_expenses'],
  ['valuation.purchase_price', 'purchase_price'],
      ['valuation.underwritten_value', 'underwritten_value'],
  ['debt_structure.loan_amount', 'loan_amount'],
  ['debt_structure.annual_debt_service', 'annual_debt_service'],
  ['property.keys', 'keys'],
  ['rent_roll.adr', 'stated_adr'],
  ['rent_roll.occupancy', 'stated_occupancy'],
  ['sources_uses.equity_metrics.equity_total', 'equity_total'],
  ['dcf.annual_cash_flows.Y1.net_cash_flow_levered', 'levered_cash_flow_y1'],
  ['sources_uses.uses.total', 'total_uses'],
  ['rent_roll.occupied_room_nights', 'occupied_room_nights'],
  ['rent_roll.available_room_nights', 'available_room_nights'],
]);

describe('HOSPITALITY_PACK', () => {
  it('declares the canonical hospitality metrics', () => {
    const ids = (HOSPITALITY_PACK.calculations ?? []).map((c) => c.id).sort();
    expect(ids).toEqual([
      'adr',
      'cap_rate',
      'cash_on_cash',
      'debt_yield',
      'dscr',
      'expense_ratio',
      'fb_gross_margin',
      'gop_margin',
      'loan_per_key',
      'ltc',
      'ltv',
      'noi_per_key',
      'occupancy',
      'price_per_key',
      'revpar',
      'revpar_index',
      'room_revenue_per_key',
      'total_room_revenue',
    ]);
  });

  it('targets the hospitality asset class', () => {
    expect(HOSPITALITY_PACK.asset_classes).toEqual(['hospitality']);
  });

  it('every calc has a parseable formula and Excel-emittable paths', () => {
    for (const c of HOSPITALITY_PACK.calculations ?? []) {
      expect(() => parseExpression(c.formula), `${c.id} should parse`).not.toThrow();
      expect(() => emitExcelFormula(c.formula, { namedRanges: NAMED_RANGES }), `${c.id} should emit`).not.toThrow();
    }
  });

  it('every metric evaluates against the Saguaro fixture and matches Excel-like evaluation', async () => {
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
    const uses = sus.content['uses'] as Record<string, number>;

    const values: Record<string, number | null> = {
      noi: noi.content['net_operating_income'] as number,
      gross_operating_profit: noi.content['gross_operating_profit'] as number,
      effective_gross_income: income['effective_gross_income']!,
      rooms_revenue: income['rooms_revenue']!,
      total_operating_expenses: expenses['total_operating_expenses']!,
      purchase_price: valuation.content['purchase_price'] as number,
      underwritten_value: (valuation.content['underwritten_value'] as number | undefined) ?? null,
      loan_amount: debt.content['loan_amount'] as number,
      annual_debt_service: debt.content['annual_debt_service'] as number,
      keys: property.content['keys'] as number,
      equity_total: ((parsed.sections['sources_uses'] as { content: Record<string, unknown> }).content['equity_metrics'] as Record<string, number>)['equity_total'],
      levered_cash_flow_y1: null,
      total_uses: uses['total']!,
      occupied_room_nights: rentRoll.content['occupied_room_nights'] as number,
      available_room_nights: rentRoll.content['available_room_nights'] as number,
      stated_adr: rentRoll.content['adr'] as number,
      stated_occupancy: rentRoll.content['occupancy'] as number,
    };

    for (const c of HOSPITALITY_PACK.calculations ?? []) {
      const direct = evaluateCalc(c, ctx);
      expect(direct.ok, `${c.id}: ${direct.error?.message ?? ''}`).toBe(true);

      if (['revpar_index', 'fb_gross_margin'].includes(c.id)) {
        expect(direct.value, c.id).toBeNull();
        expect(emitExcelFormula(c.formula, { namedRanges: NAMED_RANGES })).toBeTruthy();
        continue;
      }
      let formula = emitExcelFormula(c.formula, { namedRanges: NAMED_RANGES });
      for (const [, name] of NAMED_RANGES) {
        formula = formula.replace(new RegExp(`\\b${name}\\b`, 'g'), String(values[name]));
      }
      if (!['cash_on_cash', 'ltv', 'total_room_revenue', 'room_revenue_per_key'].includes(c.id)) expect(/^[\d.+\-*/() ]+$/.test(formula), `formula sanitized: ${formula}`).toBe(true);
      // eslint-disable-next-line no-new-func
      const excelLike = excelValue(formula);
      // Excel's cell holds ROUND(expr, round_to) because the emitter wraps it
      // (§VIII.5), so the simulated result is quantized the same way. Parity is
      // then *exact* rather than approximate: one identical rounding rule on both
      // sides, which is the whole point of having a quantization boundary.
      const excelCell = excelLike === null ? null : quantizeDecimal(excelLike, resolveRoundTo(c));
      expect(excelCell, c.id).toBe(direct.value as number);
    }
  });

  it('the operating statement foots to the stated NOI and GOP', async () => {
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

    // GOP is struck above the management fee, fixed charges, and the FF&E reserve.
    const belowGop =
      expenses['management_fee']! +
      expenses['property_taxes']! +
      expenses['insurance']! +
      expenses['ffe_reserve']!;
    expect(income['effective_gross_income']! - (expenses['total_operating_expenses']! - belowGop)).toBe(
      noi.content['gross_operating_profit']
    );
  });
});
