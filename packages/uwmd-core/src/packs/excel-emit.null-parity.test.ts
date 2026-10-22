// Excel ↔ evaluateCalc parity when inputs are missing (#487, invariant 4).
//
// `evaluateCalc` reads a missing input as null and propagates it; Excel reads a
// blank cell as 0 and `""` as text. For every builtin pack calculation, every
// combination of its inputs is blanked in turn, and the emitted declaration
// formula, evaluated with Excel's semantics (test/excel-formula.mts), must give
// the engine's outcome: the same number, `#N/A` where the engine gives null,
// and an error where the engine refuses. Never a fabricated zero or `#VALUE!`
// for a null.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  evaluate,
  evaluateCalc,
  parseExpression,
  parseUWFile,
  type CalcValue,
  type Expr,
  type ModuleCalcDecl,
  type ParsedUWFile,
} from '@uwmd/verify';
import {
  DATA_CENTER_PACK, HOSPITALITY_PACK, INDUSTRIAL_PACK, LAND_PACK, MANUFACTURED_HOUSING_PACK,
  MIXED_USE_PACK, MULTIFAMILY_PACK, OFFICE_PACK, RETAIL_PACK, SELF_STORAGE_PACK,
  SENIOR_HOUSING_PACK, STUDENT_HOUSING_PACK,
} from './index.js';
import { emitCalcExcelFormula, emitExcelFormula } from './excel-emit.js';
import { evaluateExcelFormula, isXlError, type XlValue } from '../../../../test/excel-formula.mjs';

const EXAMPLES = resolve(__dirname, '../../../../examples');
const CASES = [
  [MULTIFAMILY_PACK, 'Parkview-Apts-Glendale-AZ.uwx.md'],
  [OFFICE_PACK, 'Riverside-Office-Phoenix-AZ.uwx.md'],
  [RETAIL_PACK, 'Cactus-Crossing-Retail-Mesa-AZ.uwx.md'],
  [INDUSTRIAL_PACK, 'Ironwood-Logistics-Industrial-Tolleson-AZ.uwx.md'],
  [SELF_STORAGE_PACK, 'Sonoran-Self-Storage-Peoria-AZ.uwx.md'],
  [HOSPITALITY_PACK, 'Saguaro-Select-Hotel-Tempe-AZ.uwx.md'],
  [SENIOR_HOUSING_PACK, 'Ocotillo-Senior-Living-Chandler-AZ.uwx.md'],
  [STUDENT_HOUSING_PACK, 'Mill-Ave-Commons-Student-Tempe-AZ.uwx.md'],
  [LAND_PACK, 'Sundance-Ranch-Land-Buckeye-AZ.uwx.md'],
  [DATA_CENTER_PACK, 'Mesa-Gateway-Data-Center-Mesa-AZ.uwx.md'],
  [MANUFACTURED_HOUSING_PACK, 'Desert-Palms-MHC-Apache-Junction-AZ.uwx.md'],
  [MIXED_USE_PACK, 'Roosevelt-Row-MixedUse-Phoenix-AZ.uwx.md'],
] as const;

/** Every input path a formula reads, in first-appearance order. */
function inputPaths(expr: Expr, out: string[] = []): string[] {
  switch (expr.kind) {
    case 'path': {
      const path = [expr.head, ...expr.segments].join('.');
      if (!out.includes(path)) out.push(path);
      break;
    }
    case 'ident':
      if (!out.includes(expr.name)) out.push(expr.name);
      break;
    case 'unary': inputPaths(expr.operand, out); break;
    case 'binary': inputPaths(expr.left, out); inputPaths(expr.right, out); break;
    case 'cond': inputPaths(expr.test, out); inputPaths(expr.consequent, out); inputPaths(expr.else, out); break;
    case 'call': for (const a of expr.args) inputPaths(a, out); break;
    default: break;
  }
  return out;
}

const cellName = (path: string) => path.replace(/[^A-Za-z0-9_]/g, '_');

type Scalar = number | string | boolean | null;

function scalar(value: unknown): Scalar {
  return typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean' ? value : null;
}

/** The engine's outcome and the Excel cell's outcome agree, as invariant 4 requires. */
function expectSameOutcome(engine: ReturnType<typeof evaluateCalc>, excel: XlValue, label: string): void {
  if (!engine.ok) {
    expect(isXlError(excel), `${label}: engine refuses (${engine.error?.code}), Excel gives ${JSON.stringify(excel)}`).toBe(true);
  } else if (engine.value === null) {
    expect(excel, `${label}: engine null`).toEqual({ error: '#N/A' });
  } else {
    expect(excel, label).toBe(engine.value);
  }
}

function check(decl: ModuleCalcDecl, parsed: ParsedUWFile, base: Record<string, Scalar>): number {
  const paths = inputPaths(parseExpression(decl.formula));
  expect(paths.length, decl.id).toBeLessThanOrEqual(10);
  const namedRanges = new Map(paths.map((p) => [p, cellName(p)]));
  const formula = emitCalcExcelFormula(decl, { namedRanges });
  let checked = 0;
  for (let mask = 0; mask < 2 ** paths.length; mask++) {
    const overrides: Record<string, CalcValue> = {};
    const cells: Record<string, Scalar> = {};
    paths.forEach((p, i) => {
      const value = mask & (1 << i) ? null : base[p] ?? null;
      overrides[p] = value;
      cells[cellName(p)] = value;
    });
    const engine = evaluateCalc(decl, { parsed, prior_results: {}, locale: 'en-US', overrides });
    const blank = paths.filter((_, i) => mask & (1 << i));
    expectSameOutcome(engine, evaluateExcelFormula(formula, cells), `${decl.id} blank=[${blank.join(', ')}] ${formula}`);
    checked++;
  }
  return checked;
}

describe('emitCalcExcelFormula — missing inputs match evaluateCalc (#487)', () => {
  for (const [pack, file] of CASES) {
    it(`${pack.id}: every calculation, every combination of blank inputs`, () => {
      const parsed = parseUWFile(readFileSync(resolve(EXAMPLES, file), 'utf8'));
      const ctx = { parsed, prior_results: {}, locale: 'en-US' as const };
      let checked = 0;
      for (const decl of pack.calculations ?? []) {
        const paths = inputPaths(parseExpression(decl.formula));
        // The example's stated inputs, and a second base that fills the inputs
        // the example leaves out, so every branch sees both outcomes.
        const stated: Record<string, Scalar> = {};
        const filled: Record<string, Scalar> = {};
        paths.forEach((p, i) => {
          stated[p] = scalar(evaluate(parseExpression(p), ctx));
          filled[p] = stated[p] ?? 100 + 37 * i;
        });
        checked += check(decl, parsed, stated);
        checked += check(decl, parsed, filled);
      }
      expect(checked).toBeGreaterThan(0);
    });
  }

  it('renders a blank input as #N/A where the bare expression fabricates a zero (negative control)', () => {
    const decl = HOSPITALITY_PACK.calculations!.find((c) => c.id === 'total_room_revenue')!;
    const namedRanges = new Map([['noi_model.income.rooms_revenue', 'rooms_revenue']]);
    const cells = { rooms_revenue: null };
    const parsed = parseUWFile(readFileSync(resolve(EXAMPLES, CASES[5][1]), 'utf8'));
    const engine = evaluateCalc(decl, {
      parsed, prior_results: {}, locale: 'en-US', overrides: { 'noi_model.income.rooms_revenue': null },
    });
    expect(engine).toMatchObject({ ok: true, value: null });
    // The pre-#487 shape: ROUND over the bare expression reads the blank as 0.
    expect(evaluateExcelFormula(`ROUND(${emitExcelFormula(decl.formula, { namedRanges })},2)`, cells)).toBe(0);
    expect(evaluateExcelFormula(emitCalcExcelFormula(decl, { namedRanges }), cells)).toEqual({ error: '#N/A' });
  });

  it('renders a null branch as #N/A where the bare expression gives ROUND("") = #VALUE! (negative control)', () => {
    const decl = MULTIFAMILY_PACK.calculations!.find((c) => c.id === 'cash_on_cash')!;
    const namedRanges = new Map(inputPaths(parseExpression(decl.formula)).map((p) => [p, cellName(p)]));
    const cells = Object.fromEntries([...namedRanges.values()].map((n) => [n, n.includes('equity') ? null : 1000]));
    expect(evaluateExcelFormula(`ROUND(${emitExcelFormula(decl.formula, { namedRanges })},6)`, cells)).toEqual({ error: '#VALUE!' });
    expect(evaluateExcelFormula(emitCalcExcelFormula(decl, { namedRanges }), cells)).toEqual({ error: '#N/A' });
  });

  it('tests inputs whose absence nulls the result once, outside ROUND', () => {
    const decl = MULTIFAMILY_PACK.calculations!.find((c) => c.id === 'cap_rate')!;
    const namedRanges = new Map([
      ['noi_model.net_operating_income', 'noi'],
      ['valuation.purchase_price', 'purchase_price'],
    ]);
    expect(emitCalcExcelFormula(decl, { namedRanges }))
      .toBe('IF(OR(ISBLANK(noi),ISBLANK(purchase_price)),NA(),ROUND((noi/purchase_price),6))');
  });

  it('uses a caller-guarded binding as given', () => {
    const guarded = 'IF(ISBLANK(raw),NA(),raw)';
    expect(emitCalcExcelFormula({ formula: 'x * 2', round_to: 2 }, { namedRanges: new Map([['x', guarded]]) }))
      .toBe(`ROUND((${guarded}*2),2)`);
  });

  it('keeps sum null-as-zero and min/max null-skipping', () => {
    const namedRanges = new Map([['a', 'a'], ['b', 'b']]);
    const parsed = parseUWFile(readFileSync(resolve(EXAMPLES, CASES[0][1]), 'utf8'));
    for (const formula of [
      'sum(a, b)', 'min(a, b)', 'max(a, b)', 'a != null ? a : b', 'a == b ? 1 : 0', 'a != b ? 1 : 0',
      'a > 1 && b > 1 ? 1 : 0', 'a > 1 || b > 1 ? 1 : 0', 'a == 5 ? 1 : 0',
    ]) {
      const decl = { id: 't', label: 't', formula, round_to: 2 } as ModuleCalcDecl;
      for (const [a, b] of [[null, null], [null, 3], [5, null], [5, 3], [3, 3]] as const) {
        const engine = evaluateCalc(decl, { parsed, prior_results: {}, locale: 'en-US', overrides: { a, b } });
        const excel = evaluateExcelFormula(emitCalcExcelFormula(decl, { namedRanges }), { a, b });
        expectSameOutcome(engine, excel, `${formula} a=${a} b=${b}`);
      }
    }
  });
});
