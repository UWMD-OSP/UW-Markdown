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
import { describe, expect, it } from 'vitest';

import type { ParsedUWFile } from '../types.js';
import { BUILTINS } from './builtins.js';
import { CalcError } from './errors.js';
import { evaluate } from './evaluator.js';
import { parseExpression, type Expr } from './parser.js';
import { emitFromAst } from '../packs/excel-emit.js';

// Deterministic by default. An unseeded run draws a fresh seed every time, so
// a genuine defect surfaces as an intermittent CI red on whichever push is
// unlucky, and cannot be reproduced from the failure alone. That is how the
// RFC 0024 bisection regression hid: the same job passed on the push before.
// Set UWMD_FUZZ=1 to draw a random seed and hunt for new counterexamples —
// anything it finds should be pinned as an example in calc.test.ts.
if (!process.env.UWMD_FUZZ) {
  fc.configureGlobal({ seed: 0x5eed_1234 });
}

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

// ─── Property 4: irr returns a root, not merely a reproducible number ────────
//
// Pinning an algorithm buys reproducibility, which is not the same as
// correctness: an engine that always returned 0.42 would be perfectly
// reproducible. This asserts the other half — for a conventional cash flow
// (exactly one sign change) with a root inside the bracket, the value `irr`
// returns actually zeroes the NPV. Protocol §VIII.3 / RFC 0024.

describe('irr — the returned value is a root', () => {
  const npvAt = (flows: number[], r: number): number => {
    let acc = 0;
    for (let t = 0; t < flows.length; t++) acc += flows[t]! / (1 + r) ** t;
    return acc;
  };

  it('zeroes the NPV for conventional cash flows', () => {
    fc.assert(
      fc.property(
        // One negative outlay at t=0, then positive inflows: exactly one sign
        // change, so the root is unique where it exists.
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.array(fc.integer({ min: 1, max: 1_000_000 }), { minLength: 2, maxLength: 12 }),
        (outlay, inflows) => {
          const flows = [-outlay, ...inflows];
          let root: number;
          try {
            root = evaluate(parseExpression(`irr(${flows.join(', ')})`), EMPTY_CTX) as number;
          } catch (e) {
            // A root outside [-0.999, 10] is a documented refusal, not a
            // failure — that is the whole point of the bracket.
            return e instanceof CalcError && /CALC-IRR-DIVERGE/.test(e.message);
          }
          if (root < -0.999 || root > 10) return false;
          // Scale-relative: NPV is denominated in the same units as the flows,
          // so a fixed 1e-9 would be unreachable for million-dollar outlays.
          const scale = Math.max(1, ...flows.map((f) => Math.abs(f)));
          return Math.abs(npvAt(flows, root)) <= 1e-9 * scale;
        },
      ),
      { numRuns: 300 },
    );
  });
});

// ─── RFC 0071: is_calendar_date against an independent oracle ───────────────
//
// The oracle reads character codes and does integer arithmetic. It shares no
// code with the implementation: it does not call `parseISODate`, and it does
// not touch `Date` at all — `Date.UTC` maps years 0–99 to 1900–1999, which is
// exactly the early-year range this predicate must get right.

function oracleIsCalendarDate(value: unknown): boolean {
  if (typeof value !== 'string' || value.length !== 10) return false;
  const digit = (i: number): number => {
    const c = value.charCodeAt(i);
    return c >= 48 && c <= 57 ? c - 48 : -1;
  };
  for (const i of [0, 1, 2, 3, 5, 6, 8, 9]) if (digit(i) < 0) return false;
  if (value.charCodeAt(4) !== 45 || value.charCodeAt(7) !== 45) return false;
  const y = digit(0) * 1000 + digit(1) * 100 + digit(2) * 10 + digit(3);
  const m = digit(5) * 10 + digit(6);
  const d = digit(8) * 10 + digit(9);
  if (m < 1 || m > 12 || d < 1) return false;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const length = m === 2 ? (leap ? 29 : 28) : [4, 6, 9, 11].includes(m) ? 30 : 31;
  return d <= length;
}

describe('is_calendar_date agrees with an independent calendar oracle (RFC 0071)', () => {
  const isCalendarDate = (v: unknown) => BUILTINS.is_calendar_date!([v as never]);

  it('on every YYYY-MM-DD string with year 0000–9999, month 00–13 and day 00–32', () => {
    const pad = (n: number, w: number) => String(n).padStart(w, '0');
    let checked = 0;
    let valid = 0;
    for (let y = 0; y <= 9999; y++) {
      const yy = pad(y, 4);
      for (let m = 0; m <= 13; m++) {
        const mm = pad(m, 2);
        for (let d = 0; d <= 32; d++) {
          const s = `${yy}-${mm}-${pad(d, 2)}`;
          const want = oracleIsCalendarDate(s);
          if (isCalendarDate(s) !== want) expect.fail(`is_calendar_date('${s}') should be ${want}`);
          if (want) valid++;
          checked++;
        }
      }
    }
    expect(checked).toBe(10_000 * 14 * 33);
    // 10,000 proleptic Gregorian years hold 2,425 leap years.
    expect(valid).toBe(10_000 * 365 + 2_425);
    // 4.62 million strings: about two seconds locally, given room for
    // instrumented coverage runs and slower CI hosts.
  }, 60_000);

  it('on arbitrary strings, including near-miss date shapes', () => {
    const chars = fc.constantFrom(
      '0', '1', '2', '9', '-', ' ', '\t', '\n', 'T', 'Z', ':', '+', '/', '\uFF10', '\u2010', '\u00A0',
    );
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(),
          fc.string({ unit: chars, minLength: 8, maxLength: 12 }),
          fc.date({ min: new Date('0000-01-01T00:00:00Z'), max: new Date('9999-12-31T00:00:00Z'), noInvalidDate: true })
            .map((dt) => dt.toISOString().slice(0, 10)),
        ),
        (s) => isCalendarDate(s) === oracleIsCalendarDate(s),
      ),
      { numRuns: 2000 },
    );
  });

  it('on non-string values of every JSON shape', () => {
    fc.assert(
      fc.property(fc.jsonValue().filter((v) => typeof v !== 'string'), (v) => isCalendarDate(v) === false),
      { numRuns: 500 },
    );
  });
});
