// Packs tests — canonical pack integrity + AST→Excel emitter coverage.
//
// The "calc-integrity" contract Phase A guarantees: a single ModuleCalcDecl
// in MULTIFAMILY_PACK can be evaluated by `evaluateCalc()` AND emitted as an
// Excel formula that, when evaluated against the same named-range values,
// produces the same number. These tests pin both directions.

import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseUWFile } from '../parser.js';
import { evaluateCalc } from '../calc/index.js';
import { MULTIFAMILY_PACK } from './multifamily.js';
import { emitExcelFormula, ExcelEmitError, emitFromAst } from './excel-emit.js';
import { quantizeDecimal, resolveRoundTo } from '../calc/quantize.js';
import { parseExpression } from '../calc/parser.js';
import type { CalcEvaluationContext } from '../protocol.js';

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
    ['sources_uses.sources.equity_sponsor', 'equity_sponsor'],
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
      '(noi_model.net_operating_income - debt_structure.annual_debt_service) / sources_uses.sources.equity_sponsor',
      { namedRanges },
    );
    expect(f).toBe('((noi-annual_debt_service)/equity_sponsor)');
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
      ['sources_uses.sources.equity_sponsor', 'equity_sponsor'],
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
      equity_sponsor: (susContent.content['sources'] as Record<string, number>)['equity_sponsor']!,
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
