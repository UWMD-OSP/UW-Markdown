// Packs tests — canonical pack integrity + AST→Excel emitter coverage.
//
// The "calc-integrity" contract Phase A guarantees: a single ModuleCalcDecl
// in MULTIFAMILY_PACK can be evaluated by `evaluateCalc()` AND emitted as an
// Excel formula that, when evaluated against the same named-range values,
// produces the same number. These tests pin both directions.

import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { blockPayload, parseUWFile } from '../parser.js';
import { evaluateCalc } from '../calc/index.js';
import { MULTIFAMILY_PACK } from './multifamily.js';
import {
  HOSPITALITY_PACK,
  INDUSTRIAL_PACK,
  LAND_PACK,
  MIXED_USE_PACK,
  OFFICE_PACK,
  RETAIL_PACK,
  SELF_STORAGE_PACK,
  SENIOR_HOUSING_PACK,
  STUDENT_HOUSING_PACK,
} from './index.js';
import { emitCalcExcelFormula, emitExcelFormula, ExcelEmitError, emitFromAst } from './excel-emit.js';
import { quantizeDecimal, resolveRoundTo } from '../calc/quantize.js';
import { parseExpression } from '../calc/parser.js';
import type { CalcEvaluationContext } from '../protocol.js';


// Evaluate only the emitted arithmetic/IF subset used by these pack tests.
// A blank named cell is represented by null; Excel distinguishes blank from 0.
function excelValue(formula: string): number | null {
  const expression = formula.replaceAll('<>""', '!==null').replaceAll('=""', '===null').replaceAll('""', 'null');
  expect(/^[\d. +\-*/(),!=>nullIF]+$/.test(expression), expression).toBe(true);
  // eslint-disable-next-line no-new-func
  return new Function('IF', `return (${expression});`)(
    (test: boolean, yes: number | null, no: number | null) => test ? yes : no,
  ) as number | null;
}

const PARKVIEW = resolve(__dirname, '../../../../examples/Parkview-Apts-Glendale-AZ.uwx.md');

describe('MULTIFAMILY_PACK', () => {
  it('declares the eight canonical multifamily metrics', () => {
    const ids = (MULTIFAMILY_PACK.calculations ?? []).map((c) => c.id).sort();
    expect(ids).toEqual([
      'cap_rate',
      'cash_on_cash',
      'debt_yield',
      'dscr',
      'loan_per_sqft',
      'loan_per_unit',
      'ltv',
      'price_per_unit',
    ]);
  });

  it('every calc has a parseable formula', () => {
    for (const c of MULTIFAMILY_PACK.calculations ?? []) {
      expect(() => parseExpression(c.formula), `${c.id} should parse`).not.toThrow();
    }
  });

  it('every calc evaluates against the Parkview fixture without error', async () => {
    const raw = await readFile(PARKVIEW, 'utf8');
    const parsed = parseUWFile(raw);
    const ctx: CalcEvaluationContext = { parsed, prior_results: {}, locale: 'en-US' };

    for (const c of MULTIFAMILY_PACK.calculations ?? []) {
      const r = evaluateCalc(c, ctx);
      expect(r.ok, `${c.id}: ${r.error?.message ?? ''}`).toBe(true);
      expect(typeof r.value).toBe('number');
    }
  });
});

describe('emitExcelFormula', () => {
  const namedRanges = new Map<string, string>([
    ['noi_model.net_operating_income', 'noi'],
    ['valuation.purchase_price', 'purchase_price'],
    ['debt_structure.loan_amount', 'loan_amount'],
    ['debt_structure.annual_debt_service', 'annual_debt_service'],
    ['property.total_units', 'total_units'],
    ['property.total_nra_sqft', 'total_nra_sqft'],
    ['sources_uses.equity_metrics.equity_total', 'equity_total'],
    ['dcf.annual_cash_flows.Y1.net_cash_flow_levered', 'levered_cash_flow_y1'],
  ]);

  it('emits arithmetic with named-range substitution', () => {
    const f = emitExcelFormula(
      'noi_model.net_operating_income / valuation.purchase_price',
      { namedRanges },
    );
    expect(f).toBe('(noi/purchase_price)');
  });

  it('emits cash-on-cash with parens around the subtraction', () => {
    const f = emitExcelFormula(
      MULTIFAMILY_PACK.calculations!.find((c) => c.id === 'cash_on_cash')!.formula,
      { namedRanges },
    );
    expect(f).toBe('IF((equity_total=""),"",(IF((levered_cash_flow_y1<>""),levered_cash_flow_y1,(noi-annual_debt_service))/equity_total))');
  });

  it('emits literals correctly', () => {
    expect(emitFromAst(parseExpression('42'), { namedRanges })).toBe('42');
    expect(emitFromAst(parseExpression('3.14'), { namedRanges })).toBe('3.14');
    expect(emitFromAst(parseExpression('true'), { namedRanges })).toBe('TRUE');
    expect(emitFromAst(parseExpression('false'), { namedRanges })).toBe('FALSE');
    expect(emitFromAst(parseExpression("'hi'"), { namedRanges })).toBe('"hi"');
  });

  it('emits ternary as IF()', () => {
    const f = emitExcelFormula(
      'noi_model.net_operating_income > 0 ? noi_model.net_operating_income : 0',
      { namedRanges },
    );
    expect(f).toBe('IF((noi>0),noi,0)');
  });

  it('emits modulo as MOD()', () => {
    const f = emitFromAst(parseExpression('5 % 3'), { namedRanges });
    expect(f).toBe('MOD(5,3)');
  });

  it('maps builtins to Excel function names', () => {
    const m = new Map<string, string>([['x', 'X']]);
    expect(emitFromAst(parseExpression('sum(x, x, x)'), { namedRanges: m })).toBe('SUM(X,X,X)');
    expect(emitFromAst(parseExpression('round(x, 2)'), { namedRanges: m })).toBe('ROUND(X,2)');
    expect(emitFromAst(parseExpression('pmt(x, 360, 100000)'), { namedRanges: m })).toBe('PMT(X,360,100000)');
  });

  it('throws EXCEL-EMIT-PATH when an identifier is unmapped', () => {
    try {
      emitExcelFormula('unknown_section.foo', { namedRanges });
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ExcelEmitError);
      expect((e as ExcelEmitError).code).toBe('EXCEL-EMIT-PATH');
    }
  });

  it('throws EXCEL-EMIT-FN for builtins without an Excel mapping', () => {
    try {
      emitFromAst(parseExpression('coalesce(1, 2)'), { namedRanges });
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ExcelEmitError);
      expect((e as ExcelEmitError).code).toBe('EXCEL-EMIT-FN');
    }
  });

  // RFC 0071: no Excel date function is locale-free, and Excel's 1900 date
  // system treats 1900-02-29 as a real day. The predicate has no FUNCTION_MAP
  // entry, so every emission path refuses it the way it refuses coalesce/avg.
  it('refuses is_calendar_date with EXCEL-EMIT-FN on every emission path', () => {
    const ranges = new Map([['deal.as_of_date', 'AsOfDate']]);
    const attempts = [
      () => emitFromAst(parseExpression('is_calendar_date(deal.as_of_date)'), { namedRanges: ranges }),
      () => emitExcelFormula("deal.as_of_date == null || is_calendar_date(deal.as_of_date)", { namedRanges: ranges }),
      () => emitCalcExcelFormula({ formula: 'if(is_calendar_date(deal.as_of_date), 1, 0)' }, { namedRanges: ranges }),
    ];
    for (const attempt of attempts) {
      expect(attempt).toThrowError(expect.objectContaining({ name: 'ExcelEmitError', code: 'EXCEL-EMIT-FN' }));
    }
  });
});

describe('Excel emit ↔ evaluateCalc parity', () => {
  it('every multifamily metric: Excel formula evaluated against named-range values matches evaluateCalc', async () => {
    const raw = await readFile(PARKVIEW, 'utf8');
    const parsed = parseUWFile(raw);
    const ctx: CalcEvaluationContext = { parsed, prior_results: {}, locale: 'en-US' };

    // Build the named-range value map by reading each input from Parkview.
    // This is a stand-in for what Excel would compute when it resolves
    // workbook-scope named ranges to their cell values.
    const namedRanges = new Map<string, string>([
      ['noi_model.net_operating_income', 'noi'],
      ['valuation.purchase_price', 'purchase_price'],
      ['debt_structure.loan_amount', 'loan_amount'],
      ['debt_structure.annual_debt_service', 'annual_debt_service'],
      ['property.total_units', 'total_units'],
      ['property.total_nra_sqft', 'total_nra_sqft'],
      ['sources_uses.equity_metrics.equity_total', 'equity_total'],
    ['dcf.annual_cash_flows.Y1.net_cash_flow_levered', 'levered_cash_flow_y1'],
    ]);

    // Resolve each named-range placeholder to its Parkview value.
    const valuationContent = parsed.sections['valuation'] as { content: Record<string, unknown> };
    const noiContent = parsed.sections['noi_model'] as { content: Record<string, unknown> };
    const debtContent = parsed.sections['debt_structure'] as { content: Record<string, unknown> };
    const propertyContent = parsed.sections['property'] as { content: Record<string, unknown> };
    const susContent = parsed.sections['sources_uses'] as { content: Record<string, unknown> };

    const values: Record<string, number> = {
      noi: noiContent.content['net_operating_income'] as number,
      purchase_price: valuationContent.content['purchase_price'] as number,
      loan_amount: debtContent.content['loan_amount'] as number,
      annual_debt_service: debtContent.content['annual_debt_service'] as number,
      total_units: propertyContent.content['total_units'] as number,
      total_nra_sqft: propertyContent.content['total_nra_sqft'] as number,
      equity_total: (susContent.content['equity_metrics'] as Record<string, number>)['equity_total']!,
      levered_cash_flow_y1: ((blockPayload(parsed.sections['dcf'] as import('../types.js').UWBlock) as Record<string, unknown>)['annual_cash_flows'] as Record<string, number>[]).find((row) => row['year'] === 1)!['net_cash_flow_levered']!,
    };

    for (const c of MULTIFAMILY_PACK.calculations ?? []) {
      const direct = evaluateCalc(c, ctx);
      expect(direct.ok, `${c.id} evaluateCalc`).toBe(true);

      // Substitute named ranges with their values, then eval as JS arithmetic
      // (the emitter only produces +-*/ and parens for the multifamily pack).
      let formula = emitExcelFormula(c.formula, { namedRanges });
      // Replace whole-word identifiers with their numeric values.
      for (const [, name] of namedRanges) {
        const re = new RegExp(`\\b${name}\\b`, 'g');
        formula = formula.replace(re, String(values[name]));
      }
      // Safe: at this point `formula` contains only digits, dots, parens, and +-*/.

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
});

describe('debt_structure role declarations (RFC 0066)', () => {
  const PACKS = [
    MULTIFAMILY_PACK, OFFICE_PACK, RETAIL_PACK, INDUSTRIAL_PACK, SELF_STORAGE_PACK,
    HOSPITALITY_PACK, SENIOR_HOUSING_PACK, STUDENT_HOUSING_PACK, LAND_PACK, MIXED_USE_PACK,
  ];
  const readers = PACKS.flatMap((pack) => (pack.calculations ?? [])
    .filter((calc) => calc.formula.includes('debt_structure.'))
    .map((calc) => ({ pack: pack.id, calc })));

  it('states senior on every lender-side metric that reads debt_structure', () => {
    const lender = readers.filter(({ calc }) => calc.id !== 'cash_on_cash');
    expect(lender).toHaveLength(46);
    for (const { pack, calc } of lender) {
      expect(calc.section_roles, `${pack}:${calc.id}`).toEqual({ debt_structure: 'senior' });
    }
  });

  it('states no role on cash_on_cash: equity cash flow deducts all debt service', () => {
    const coc = readers.filter(({ calc }) => calc.id === 'cash_on_cash');
    expect(coc).toHaveLength(9);
    for (const { pack, calc } of coc) expect(calc.section_roles, pack).toBeUndefined();
  });
});
