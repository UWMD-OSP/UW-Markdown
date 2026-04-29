// AST → Excel formula emitter.
//
// Takes a Tier-3 safe expression (parsed by @uwmd/core's calc parser) and a
// map from calc-engine identifier paths to Excel named ranges. Emits an Excel
// formula string (without the leading "=") that produces the same number Excel
// would compute via its own engine.
//
// This is what unlocks "write a calc once, consume it everywhere": the web
// editor evaluates the expression directly via `evaluateCalc()`, while
// @uwmd/excel emits the same expression as an Excel formula that references
// workbook-scope named ranges. Both produce identical numbers by construction.
//
// Identifier mapping rules:
//   - A calc-engine path like `noi_model.net_operating_income` maps to a
//     named range like `noi`. The map is keyed on the joined path
//     (`section.field.subfield`) and supplied by the caller.
//   - Bare identifiers (no dot path) also look up directly in the map.
//   - If a path isn't in the map, emission fails with EXCEL-EMIT-PATH.
//
// Operator / function coverage:
//   - Arithmetic +, -, *, / and parentheses → identical syntax in Excel.
//   - Modulo (%) → MOD(left, right).
//   - Comparison and ternary → IF(test, then, else).
//   - Builtins map to their Excel equivalents (SUM, AVERAGE, MIN, MAX, IF,
//     ROUND, PMT, NPV, IRR). Functions without a clean Excel equivalent
//     (`coalesce`, `avg` with null handling) raise EXCEL-EMIT-FN.

import { parseExpression, type Expr } from '../calc/parser.js';

export interface ExcelEmitOptions {
  /**
   * Map from calc-engine path (joined with dots, e.g. `noi_model.net_operating_income`)
   * to Excel named range (e.g. `noi`). Bare identifiers are looked up by name.
   */
  namedRanges: ReadonlyMap<string, string>;
}

export class ExcelEmitError extends Error {
  constructor(
    public code: 'EXCEL-EMIT-PATH' | 'EXCEL-EMIT-FN' | 'EXCEL-EMIT-OP',
    message: string,
  ) {
    super(message);
    this.name = 'ExcelEmitError';
  }
}

const FUNCTION_MAP: Record<string, string> = {
  sum: 'SUM',
  min: 'MIN',
  max: 'MAX',
  if: 'IF',
  round: 'ROUND',
  pmt: 'PMT',
  npv: 'NPV',
  irr: 'IRR',
  abs: 'ABS',
  floor: 'FLOOR',
  ceil: 'CEILING',
  sqrt: 'SQRT',
  pow: 'POWER',
  log: 'LN',
  exp: 'EXP',
  fv: 'FV',
  pv: 'PV',
  nper: 'NPER',
};

/**
 * Emit an Excel formula (without leading `=`) for a parsed expression.
 * Throws ExcelEmitError if the expression references a path not in the map
 * or uses a builtin without a clean Excel equivalent.
 */
export function emitFromAst(expr: Expr, opts: ExcelEmitOptions): string {
  switch (expr.kind) {
    case 'literal':
      if (expr.value === null) return '""';
      if (typeof expr.value === 'boolean') return expr.value ? 'TRUE' : 'FALSE';
      if (typeof expr.value === 'string') return `"${expr.value.replace(/"/g, '""')}"`;
      return String(expr.value);

    case 'ident': {
      const mapped = opts.namedRanges.get(expr.name);
      if (!mapped) {
        throw new ExcelEmitError(
          'EXCEL-EMIT-PATH',
          `No Excel named range for identifier '${expr.name}'.`,
        );
      }
      return mapped;
    }

    case 'path': {
      const joined = [expr.head, ...expr.segments].join('.');
      const mapped = opts.namedRanges.get(joined);
      if (!mapped) {
        throw new ExcelEmitError(
          'EXCEL-EMIT-PATH',
          `No Excel named range for path '${joined}'.`,
        );
      }
      return mapped;
    }

    case 'unary': {
      const inner = emitFromAst(expr.operand, opts);
      if (expr.op === '-') return `-(${inner})`;
      return `NOT(${inner})`;
    }

    case 'binary': {
      const left = emitFromAst(expr.left, opts);
      const right = emitFromAst(expr.right, opts);
      switch (expr.op) {
        case '+': case '-': case '*': case '/':
          return `(${left}${expr.op}${right})`;
        case '%':
          return `MOD(${left},${right})`;
        case '==': return `(${left}=${right})`;
        case '!=': return `(${left}<>${right})`;
        case '<': case '<=': case '>': case '>=':
          return `(${left}${expr.op}${right})`;
        case '&&': return `AND(${left},${right})`;
        case '||': return `OR(${left},${right})`;
      }
      throw new ExcelEmitError('EXCEL-EMIT-OP', 'Unreachable: unhandled binary operator.');
    }

    case 'cond': {
      const test = emitFromAst(expr.test, opts);
      const consequent = emitFromAst(expr.consequent, opts);
      const alternate = emitFromAst(expr.else, opts);
      return `IF(${test},${consequent},${alternate})`;
    }

    case 'call': {
      const xlName = FUNCTION_MAP[expr.name];
      if (!xlName) {
        throw new ExcelEmitError(
          'EXCEL-EMIT-FN',
          `No Excel mapping for function '${expr.name}'.`,
        );
      }
      const args = expr.args.map((a) => emitFromAst(a, opts)).join(',');
      return `${xlName}(${args})`;
    }
  }
}

/** Convenience: parse + emit in one call. */
export function emitExcelFormula(formula: string, opts: ExcelEmitOptions): string {
  return emitFromAst(parseExpression(formula), opts);
}
