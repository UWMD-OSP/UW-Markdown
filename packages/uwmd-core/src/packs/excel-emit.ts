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

import {
  parseExpression,
  periodReferencePath,
  type Expr,
  resolveRoundTo,
  periodReferenceContract,
  periodKeyIdentity,
  type PeriodExcelBinding,
} from '@uwmd/verify';

export interface ExcelEmitOptions {
  /**
   * Map from calc-engine path (joined with dots, e.g. `noi_model.net_operating_income`)
   * to Excel named range (e.g. `noi`). Bare identifiers are looked up by name.
   */
  namedRanges: ReadonlyMap<string, string>;
  /** RFC 0043: canonical selector paths mapped to trusted contextual workbook names. */
  periodBindings?: ReadonlyMap<string, PeriodExcelBinding>;
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

    case 'period_path': {
      let identity: string;
      try { identity = periodKeyIdentity(periodReferenceContract(expr).key); }
      catch { throw new ExcelEmitError('EXCEL-EMIT-PATH', 'Invalid period selector or unregistered series.'); }
      const binding = opts.periodBindings?.get(periodReferencePath(expr));
      if (!binding) throw new ExcelEmitError('EXCEL-EMIT-PATH', 'Period selectors require contextual workbook bindings.');
      const name = (value: string) => {
        if (typeof value !== 'string' || value.length > 255 || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)
          || /^[A-Za-z]{1,3}[1-9][0-9]*$/.test(value) || /^[Rr][1-9][0-9]*[Cc][1-9][0-9]*$/.test(value) || /^[RrCc]$/.test(value)) {
          throw new ExcelEmitError('EXCEL-EMIT-PATH', 'A period binding must use explicit workbook names, not addresses or formulas.');
        }
        return value;
      };
      const numeric = (ref: string) => `IF(ISBLANK(${ref}),NA(),IF(ISNUMBER(${ref}),${ref},VALUE("Non-numeric period value")))`;
      if (binding.kind === 'override') return numeric(name(binding.value_range));
      if (binding.kind !== 'series') throw new ExcelEmitError('EXCEL-EMIT-PATH', 'Unknown period binding kind.');
      const keys = name(binding.keys_range);
      const values = name(binding.values_range);
      const valid = name(binding.valid_range);
      const key = `"${identity}"`;
      return `IF(${valid}<>1,VALUE("Invalid period identities"),IF(COUNTIF(${keys},${key})=0,NA(),${numeric(`INDEX(${values},MATCH(${key},${keys},0))`)}))`;
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

/** Convenience: parse + emit in one call. Emits the expression only. */
export function emitExcelFormula(formula: string, opts: ExcelEmitOptions): string {
  return emitFromAst(parseExpression(formula), opts);
}

// ─── Null-faithful emission (§VIII.2 null propagation; #487) ─────────────────
//
// `evaluateCalc` reads a missing input as null and propagates it: arithmetic and
// ordering comparisons on null are null, `x == null` is a boolean, `&&`/`||`
// short-circuit, `sum` counts null as 0 and `min`/`max` skip it. A blank Excel
// cell is 0 in arithmetic and `""` is text, so the bare emission above turns a
// missing input into a fabricated zero or `#VALUE!`. The declaration emitter
// below renders null as `#N/A` instead, the outcome the converter documents for
// a missing input:
//
//   - a blank named input reads as `NA()` (`IF(ISBLANK(x),NA(),x)`), and the
//     null literal is `NA()`, which every arithmetic operator, comparison and
//     `ROUND` propagates exactly as the evaluator propagates null;
//   - `e == null` is `ISNA(e)`; other equality tests are null-aware;
//   - `&&`/`||` short-circuit through `IF`, as the evaluator does;
//   - `sum` counts `#N/A` as 0 and `min`/`max` skip it;
//   - inputs whose absence makes the whole result null are tested once, outside
//     `ROUND`: `IF(OR(ISBLANK(a),ISBLANK(b)),NA(),ROUND(expr,n))`, so those
//     references stay bare inside the expression.
//
// A mapped value that is not a plain workbook name (a caller-guarded
// expression, as custom calculations bind) is used as given.

const PLAIN_NAME = /^[A-Za-z_][A-Za-z0-9_.]*$/;

function mappedRef(expr: Extract<Expr, { kind: 'ident' | 'path' }>, opts: ExcelEmitOptions): string {
  return emitFromAst(expr, opts);
}

/** The plain workbook name a reference maps to, or null; never throws. */
function plainName(expr: Expr, opts: ExcelEmitOptions): string | null {
  if (expr.kind !== 'ident' && expr.kind !== 'path') return null;
  const ref = opts.namedRanges.get(expr.kind === 'ident' ? expr.name : [expr.head, ...expr.segments].join('.'));
  return ref !== undefined && PLAIN_NAME.test(ref) ? ref : null;
}

function isNullLiteral(expr: Expr): boolean {
  return expr.kind === 'literal' && expr.value === null;
}

function intersect(sets: readonly ReadonlySet<string>[]): Set<string> {
  if (sets.length === 0) return new Set();
  const [first, ...rest] = sets;
  return new Set([...first!].filter((name) => rest.every((set) => set.has(name))));
}

/**
 * Plain-name inputs whose absence (a blank cell) makes `expr` null, or a
 * refusal, in `evaluateCalc`. Ordered by first appearance. Never throws:
 * emission reports unmapped paths and functions in its own order.
 */
function strictInputs(expr: Expr, opts: ExcelEmitOptions): Set<string> {
  switch (expr.kind) {
    case 'literal':
    case 'period_path':
      return new Set();
    case 'ident':
    case 'path': {
      const ref = plainName(expr, opts);
      return ref ? new Set([ref]) : new Set();
    }
    case 'unary':
      return strictInputs(expr.operand, opts);
    case 'binary':
      if (expr.op === '==' || expr.op === '!=') return new Set();
      if (expr.op === '&&' || expr.op === '||') return strictInputs(expr.left, opts);
      return new Set([...strictInputs(expr.left, opts), ...strictInputs(expr.right, opts)]);
    case 'cond':
      return new Set([
        ...strictInputs(expr.test, opts),
        ...intersect([strictInputs(expr.consequent, opts), strictInputs(expr.else, opts)]),
      ]);
    case 'call': {
      if (!FUNCTION_MAP[expr.name]) return new Set();
      const args = expr.args.map((a) => strictInputs(a, opts));
      switch (expr.name) {
        case 'sum': return new Set();
        case 'min': case 'max': return intersect(args);
        case 'if': return new Set([...(args[0] ?? []), ...intersect(args.slice(1, 3))]);
        default: return new Set(args.flatMap((a) => [...a]));
      }
    }
  }
}

/** A plain-name reference tested by `ref == null` / `ref != null`, if any. */
function nullTestedRef(expr: Expr, opts: ExcelEmitOptions): { ref: string; isNull: boolean } | null {
  if (expr.kind !== 'binary' || (expr.op !== '==' && expr.op !== '!=')) return null;
  const other = isNullLiteral(expr.right) ? expr.left : isNullLiteral(expr.left) ? expr.right : null;
  const ref = other ? plainName(other, opts) : null;
  return ref ? { ref, isNull: expr.op === '==' } : null;
}

/** True when the emitted expression is a boolean that can never be an error. */
function isTotalBoolean(expr: Expr): boolean {
  if (expr.kind === 'literal') return typeof expr.value === 'boolean';
  if (expr.kind === 'unary') return expr.op === '!' && isTotalBoolean(expr.operand);
  if (expr.kind !== 'binary') return false;
  if (expr.op === '==' || expr.op === '!=') return isNullLiteral(expr.left) || isNullLiteral(expr.right);
  if (expr.op === '&&' || expr.op === '||') return isTotalBoolean(expr.left) && isTotalBoolean(expr.right);
  return false;
}

/**
 * `known` holds plain names that cannot be blank or #N/A where this node is
 * evaluated: hoisted strict inputs, and a reference inside the branch of its
 * own null test.
 */
function emitNullFaithful(expr: Expr, opts: ExcelEmitOptions, known: ReadonlySet<string>): string {
  const emit = (e: Expr, k: ReadonlySet<string> = known) => emitNullFaithful(e, opts, k);
  switch (expr.kind) {
    case 'literal':
      return expr.value === null ? 'NA()' : emitFromAst(expr, opts);

    case 'ident':
    case 'path': {
      const ref = mappedRef(expr, opts);
      if (!PLAIN_NAME.test(ref) || known.has(ref)) return ref;
      return `IF(ISBLANK(${ref}),NA(),${ref})`;
    }

    case 'period_path':
      return emitFromAst(expr, opts);

    case 'unary': {
      const inner = emit(expr.operand);
      return expr.op === '-' ? `-(${inner})` : `NOT(${inner})`;
    }

    case 'binary': {
      if (expr.op === '==' || expr.op === '!=') {
        const tested = nullTestedRef(expr, opts);
        let test: string;
        if (isNullLiteral(expr.left) && isNullLiteral(expr.right)) test = 'TRUE';
        else if (tested) {
          test = known.has(tested.ref) ? `ISNA(${tested.ref})` : `OR(ISBLANK(${tested.ref}),ISNA(${tested.ref}))`;
        } else if (isNullLiteral(expr.left) || isNullLiteral(expr.right)) {
          test = `ISNA(${emit(isNullLiteral(expr.left) ? expr.right : expr.left)})`;
        } else {
          const left = emit(expr.left);
          const right = emit(expr.right);
          if (expr.right.kind === 'literal') test = `IF(ISNA(${left}),FALSE,(${left}=${right}))`;
          else if (expr.left.kind === 'literal') test = `IF(ISNA(${right}),FALSE,(${left}=${right}))`;
          else test = `IF(ISNA(${left}),ISNA(${right}),IF(ISNA(${right}),FALSE,(${left}=${right})))`;
        }
        return expr.op === '==' ? test : `NOT(${test})`;
      }
      const left = emit(expr.left);
      const right = emit(expr.right);
      switch (expr.op) {
        case '+': case '-': case '*': case '/':
        case '<': case '<=': case '>': case '>=':
          return `(${left}${expr.op}${right})`;
        case '%':
          return `MOD(${left},${right})`;
        case '&&':
          return isTotalBoolean(expr) ? `AND(${left},${right})` : `IF(${left},${right},FALSE)`;
        case '||':
          return isTotalBoolean(expr) ? `OR(${left},${right})` : `IF(${left},TRUE,${right})`;
      }
      throw new ExcelEmitError('EXCEL-EMIT-OP', 'Unreachable: unhandled binary operator.');
    }

    case 'cond': {
      const tested = nullTestedRef(expr.test, opts);
      const knownIn = (nonNull: boolean) => (tested && nonNull ? new Set([...known, tested.ref]) : known);
      const test = emit(expr.test);
      const consequent = emit(expr.consequent, knownIn(tested ? !tested.isNull : false));
      const alternate = emit(expr.else, knownIn(tested ? tested.isNull : false));
      return `IF(${test},${consequent},${alternate})`;
    }

    case 'call': {
      const xlName = FUNCTION_MAP[expr.name];
      if (!xlName) return emitFromAst(expr, opts); // EXCEL-EMIT-FN
      const args = expr.args.map((a) => emit(a));
      if (expr.name === 'sum') return `SUM(${args.map((a) => `IF(ISNA(${a}),0,${a})`).join(',')})`;
      if (expr.name === 'min' || expr.name === 'max') {
        if (args.length === 0) return 'NA()';
        return args.reduce((acc, a) => `IF(ISNA(${acc}),${a},IF(ISNA(${a}),${acc},${xlName}(${acc},${a})))`);
      }
      return `${xlName}(${args.join(',')})`;
    }
  }
}

/**
 * Emit the formula for a calculation *declaration*, wrapped in `ROUND` at the
 * declaration's effective `round_to` (§VIII.5), with the evaluator's null
 * outcome rendered as `#N/A` (see "Null-faithful emission" above).
 *
 * This is what converters should call. `emitExcelFormula` emits the bare
 * expression, which reads a blank input as Excel does and leaves the cell
 * holding Excel's own unquantized double while `evaluateCalc` reports a
 * quantized one — the two then agree only to within a tolerance. Applying the
 * same quantization on both sides makes the Excel↔evaluator invariant an
 * *exact* equality instead of an approximate one, because Excel's `ROUND` is
 * half-away-from-zero, the same rule `quantizeDecimal` implements.
 */
export function emitCalcExcelFormula(
  decl: { formula: string; unit?: string; round_to?: number },
  opts: ExcelEmitOptions,
): string {
  const expr = parseExpression(decl.formula);
  const strict = [...strictInputs(expr, opts)];
  const rounded = `ROUND(${emitNullFaithful(expr, opts, new Set(strict))},${resolveRoundTo(decl)})`;
  if (strict.length === 0) return rounded;
  const blank = strict.length === 1 ? `ISBLANK(${strict[0]})` : `OR(${strict.map((n) => `ISBLANK(${n})`).join(',')})`;
  return `IF(${blank},NA(),${rounded})`;
}
