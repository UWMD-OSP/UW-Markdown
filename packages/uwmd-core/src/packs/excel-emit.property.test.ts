// Property-based test for the AST→Excel emitter (a starter product).
//
// Parser/Excel-emit grammar parity — for any AST the constrained generator can
// produce, emitFromAst returns a string. Calls restricted to the FUNCTION_MAP
// keys; identifiers restricted to the supplied namedRanges.
//
// The generator is a copy of the one in @uwmd/verify's
// calc/calc.property.test.ts, where the parser and evaluator properties run
// (RFC 0083 split the two). Keep the two in step.

import fc from 'fast-check';
import { describe, it } from 'vitest';

import type { Expr } from '@uwmd/verify';
import { emitFromAst } from './excel-emit.js';

// Deterministic by default. An unseeded run draws a fresh seed every time, so
// a genuine defect surfaces as an intermittent CI red on whichever push is
// unlucky, and cannot be reproduced from the failure alone. That is how the
// RFC 0024 bisection regression hid: the same job passed on the push before.
// Set UWMD_FUZZ=1 to draw a random seed and hunt for new counterexamples —
// anything it finds should be pinned as an example in calc.test.ts.
if (!process.env.UWMD_FUZZ) {
  fc.configureGlobal({ seed: 0x5eed_1234 });
}

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

// ─── Property: parser/Excel-emit grammar parity ─────────────────────────────

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
