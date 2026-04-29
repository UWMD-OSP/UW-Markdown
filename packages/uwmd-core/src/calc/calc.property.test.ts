// Property-based tests for the Tier-3 calc engine.
//
// These complement the example-based tests in calc.test.ts. The contract being
// asserted here is total/typed-error behavior across a much broader input
// surface than handwritten cases can cover:
//
//   1. Parser totality — for any reasonable string input, parseExpression
//      either returns a valid AST or throws a typed CalcError. Never an
//      uncaught generic Error, never an infinite loop, never undefined.
//
//   2. Evaluator null-safety — for any AST produced by the constrained
//      grammar generator, evaluating against an empty context returns a value
//      whose runtime type is in the declared CalcValue union (number | string
//      | boolean | null), or throws a typed CalcError.
//
//   3. Parser/Excel-emit grammar parity — for any AST the constrained
//      generator can produce, emitFromAst returns a string. Calls restricted
//      to the FUNCTION_MAP keys; identifiers restricted to the supplied
//      namedRanges.

import fc from 'fast-check';
import { describe, it } from 'vitest';

import type { ParsedUWFile } from '../types.js';
import { CalcError } from './errors.js';
import { evaluate } from './evaluator.js';
import { parseExpression, type Expr } from './parser.js';
import { emitFromAst } from '../packs/excel-emit.js';

// ─── Empty context for evaluator ─────────────────────────────────────────────

const EMPTY_PARSED: ParsedUWFile = {
  frontmatter: {} as never,
  sections: {},
  prose: {},
  pipeline_log: [],
  custom_calculations: [],
  custom_scenarios: [],
  extensions: {},
  superseded: {},
  raw: '',
};

const EMPTY_CTX = {
  parsed: EMPTY_PARSED,
  prior_results: {},
  locale: 'en-US' as const,
};

// ─── AST grammar generator ───────────────────────────────────────────────────

const IDENT_POOL = ['a', 'b', 'c', 'x', 'y'];
const FUNCTION_POOL = [
  'sum', 'min', 'max', 'if', 'round', 'abs', 'floor', 'ceil', 'sqrt',
  'pow', 'log', 'exp',
] as const;
const BINARY_OPS = [
  '+', '-', '*', '/', '%',
  '==', '!=', '<', '<=', '>', '>=',
  '&&', '||',
] as const;

const literalArb: fc.Arbitrary<Expr> = fc.oneof(
  fc.integer({ min: -1_000, max: 1_000 }).map((n): Expr => ({ kind: 'literal', value: n })),
  fc.float({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true })
    .map((n): Expr => ({ kind: 'literal', value: n })),
  fc.boolean().map((b): Expr => ({ kind: 'literal', value: b })),
  fc.constant({ kind: 'literal', value: null } as Expr),
  // Strings are restricted to ASCII printable so the round-trip via the parser
  // (which the Excel emitter also must accept) stays clean.
  fc.string({ minLength: 0, maxLength: 8, unit: 'grapheme-ascii' })
    .filter((s) => !s.includes("'"))
    .map((s): Expr => ({ kind: 'literal', value: s })),
);

const identArb: fc.Arbitrary<Expr> = fc.constantFrom(...IDENT_POOL).map(
  (name): Expr => ({ kind: 'ident', name }),
);

function exprArb(): fc.Arbitrary<Expr> {
  return fc.letrec<{ expr: Expr }>((tie) => ({
    expr: fc.oneof(
      { maxDepth: 4, depthIdentifier: 'calcExpr' },
      { arbitrary: literalArb, weight: 4 },
      { arbitrary: identArb, weight: 2 },
      {
        arbitrary: fc
          .tuple(fc.constantFrom('-' as const, '!' as const), tie('expr'))
          .map(([op, operand]): Expr => ({ kind: 'unary', op, operand })),
        weight: 1,
      },
      {
        arbitrary: fc
          .tuple(fc.constantFrom(...BINARY_OPS), tie('expr'), tie('expr'))
          .map(([op, left, right]): Expr => ({ kind: 'binary', op, left, right })),
        weight: 3,
      },
      {
        arbitrary: fc
          .tuple(tie('expr'), tie('expr'), tie('expr'))
          .map(([test, consequent, els]): Expr => ({
            kind: 'cond',
            test,
            consequent,
            else: els,
          })),
        weight: 1,
      },
      {
        arbitrary: fc
          .tuple(fc.constantFrom(...FUNCTION_POOL), fc.array(tie('expr'), { minLength: 0, maxLength: 4 }))
          .map(([name, args]): Expr => ({ kind: 'call', name, args })),
        weight: 1,
      },
    ),
  })).expr;
}

// ─── Property 1: parser totality ─────────────────────────────────────────────

describe('calc parser — totality', () => {
  it('either returns an AST or throws a typed CalcError for any short ASCII input', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 256, unit: 'grapheme-ascii' }),
        (input) => {
          try {
            const ast = parseExpression(input);
            // Success path: the AST must be a non-null object with a `kind`.
            return typeof ast === 'object' && ast !== null && typeof (ast as Expr).kind === 'string';
          } catch (e) {
            // Failure path: must be a typed CalcError, not a generic Error.
            return e instanceof CalcError;
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it('rejects input over MAX_INPUT_LEN with CALC-LIMIT-001', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 4097, max: 5000 }),
        (n) => {
          const big = '1'.repeat(n);
          try {
            parseExpression(big);
            return false; // should have thrown
          } catch (e) {
            return e instanceof CalcError && e.proto.code === 'CALC-LIMIT-001';
          }
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ─── Property 2: evaluator null-safety ───────────────────────────────────────

const CALC_VALUE_TYPES = new Set(['number', 'string', 'boolean']);

function isCalcValue(v: unknown): boolean {
  if (v === null) return true;
  // Numbers, strings, booleans are all in the declared CalcValue union.
  // NaN and ±Infinity are still typeof 'number' and are accepted here —
  // they're degenerate but the union allows them; the evaluator's job is to
  // surface them as values, not reject them.
  return CALC_VALUE_TYPES.has(typeof v);
}

describe('calc evaluator — null-safety', () => {
  it('returns a CalcValue scalar or throws CalcError for any generated AST', () => {
    fc.assert(
      fc.property(exprArb(), (ast) => {
        try {
          const result = evaluate(ast, EMPTY_CTX);
          return isCalcValue(result);
        } catch (e) {
          return e instanceof CalcError;
        }
      }),
      { numRuns: 300 },
    );
  });
});

// ─── Property 3: parser/Excel-emit grammar parity ────────────────────────────

describe('Excel emitter — grammar parity', () => {
  it('emits a string for any AST the generator can produce', () => {
    // The emitter requires every identifier and path to be in namedRanges.
    // Map every generator-pool ident to itself so emission cannot fail with
    // EXCEL-EMIT-PATH on a generated identifier.
    const namedRanges = new Map<string, string>(IDENT_POOL.map((n) => [n, n]));

    fc.assert(
      fc.property(exprArb(), (ast) => {
        const out = emitFromAst(ast, { namedRanges });
        return typeof out === 'string' && out.length > 0;
      }),
      { numRuns: 300 },
    );
  });
});
