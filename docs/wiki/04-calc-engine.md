# 04 — Calc engine (Tier-3)

The calc engine evaluates **safe expressions** (formulas) against a parsed
`.uw.md` file. It is the deterministic counterpart to the AI agents: agents put
data *in*, the calc engine derives metrics *out*, with no AI involved.

- **Location:** [`packages/uwmd-core/src/calc/`](../../packages/uwmd-core/src/calc/)
- **Normative grammar/semantics:** `UW_PROTOCOL_v1.md` §VIII.
- **Public API (via `index.ts`):** `evaluateCalc`, `parseExpression`, `evaluate`,
  `BUILTINS`, `CalcError`, `calcError`; types `CalcValue`, `Builtin`, `CalcErrorCode`.

## File layout

File | Role
---|---
`calc/index.ts` | Entry point: `evaluateCalc(decl, ctx)` — parse → evaluate → format → `CalcResult`
`calc/parser.ts` | Tokenizer + recursive-descent parser → `Expr` AST
`calc/evaluator.ts` | AST walker; variable resolution + null propagation
`calc/builtins.ts` | The `BUILTINS` function table (math + financial)
`calc/errors.ts` | `CalcError` class + `CalcErrorCode` taxonomy
`calc/quantize.ts` | The §VIII.5 quantization boundary: `quantizeDecimal`, `resolveRoundTo`
`calc/dependencies.ts` | Walk an AST → input field paths (feeds refinement/VOI)

## The public call: `evaluateCalc`

```ts
evaluateCalc(decl: ModuleCalcDecl, ctx: CalcEvaluationContext): CalcResult
```

- `ModuleCalcDecl` = `{ id, label, formula, unit?, round_to?, deterministic }`.
- `CalcEvaluationContext` = `{ parsed: ParsedUWFile, prior_results, locale: 'en-US' }`.
- **Never throws.** Engine exceptions are captured into `CalcResult.error`
  (a `ProtocolError`); `ok` is `false` and `value` is `null` on failure.
- On success, returns `{ calc_id, ok: true, value, unit?, round_to, display }`
  where `display` is formatted per the `unit` (`%`→percent, `$`→currency,
  `x`→ratio).
- **This is the quantization boundary** — see the next section. `value` is
  already rounded when you get it.

## Quantization (§VIII.5, `calc/quantize.ts`)

Evaluation runs in unrounded binary64. The *reported* value is quantized once,
here, half away from zero — the rule `round()` uses and the rule Excel's `ROUND`
uses, which is what makes the two comparable.

Effective decimal places come from `resolveRoundTo(decl)`: the declaration's
`round_to` when stated, otherwise the normative default for its `unit`
(`$`→2, `%`→6, `x`→4, anything else→6). The table is total on purpose —
there is no "unspecified precision" mode, because an unspecified precision is an
unspecified interoperability contract.

**Why one boundary and not several.** Before [RFC 0023](../rfcs/0023-numeric-determinism.md)
there was none, and `receipts.ts` ran two checks over the same numbers that
could not both be right: a 1e-6 tolerance comparison *and* a bit-exact
`results_digest`. A last-ULP difference passed the first and failed the second,
and the verdict said *corruption*. Quantized results have no tail for the two to
disagree about.

**Do not quantize by scaling.** `Math.floor(n * 10 ** d + 0.5) / 10 ** d`
reintroduces the artifact it removes: `1.005 * 100` is `100.49999999999999`, so
that form gives `1.00` where Excel gives `1.01`. `quantizeDecimal` shifts through
a decimal string (`Number('1.005e2')` → `100.5`) instead. If you need to round a
number anywhere in this repo, call `quantizeDecimal` rather than writing it
again.

**Quantization is not display.** `display` is presentation and may round
differently. Digests, equality, and Excel parity are defined over `value`.

## The grammar (recursive descent)

`parseExpression(input) → Expr`. Precedence (low → high): ternary `?:`, `||`,
`&&`, comparison (`== != < <= > >=`), additive (`+ -`), multiplicative (`* / %`),
unary (`- !`), primary. Primary = literal | identifier | function call | member
path | parenthesized expression.

`Expr` node kinds: `literal`, `ident`, `path` (`head` + `segments`), `call`,
`unary`, `binary`, `cond`.

Member access supports dotted paths and bracket-string keys:
`dcf.annual_cash_flows` and `unit_mix['2BR']`. Strings use single quotes.

## Variable resolution (`evaluator.ts`)

An `ident` / `path` `head` resolves in this order:
1. **Frontmatter** key of the same name.
2. **Section** of the same name — returns the block's *inner user data* (the
   parser stores the full envelope at `block.content`; user fields live at
   `block.content.content`). Path segments then drill into that object.
3. **`prior_results`** (results of earlier calcs in the same batch).
4. Otherwise `null`.

This is why a multifamily formula like
`noi_model.net_operating_income / valuation.purchase_price` works: `noi_model`
resolves to the section's data, `.net_operating_income` drills in.

## Null propagation and operator semantics

- **Null propagates.** Any arithmetic/comparison with a `null` operand yields
  `null` (missing data never throws — it flows through as "unknown").
- **Division/modulo by zero** → `CALC-DIV-ZERO`.
- **`+`** works for number+number or string+string (concatenation); mixed →
  `CALC-TYPE-001`.
- **`&&` / `||`** require booleans, short-circuit, and propagate null.
- **Comparisons** require operands of the same type (number or string).
- **Ternary** condition must be boolean (or null → null result).

## Sandbox guarantees (why this is safe to run on untrusted formulas)

The evaluator is a closed sandbox — no globals, no I/O, no host access — with two
hard caps:
- `MAX_INPUT_LEN = 4096` characters (tokenizer) → `CALC-LIMIT-001`.
- `MAX_NODES = 1024` AST nodes evaluated → `CALC-LIMIT-001`.

These bounds, plus the lack of loops/recursion in the grammar, guarantee
termination. Property tests (`calc.property.test.ts`) assert *totality*: any
input either parses to a valid AST or throws a typed `CalcError` — never a generic
`Error`, never a hang.

**The prototype chain is not reachable.** A formula names its own path segments,
and both `a.b` and `a['b']` reach the same walker, so navigation resolves *own
properties only* and refuses the three segments that lead back to JS internals:
`__proto__`, `constructor`, and `prototype`. A blocked or inherited segment
resolves to `null` — the answer §VIII.2 already gives for a missing path — so
`quick_metrics.constructor.prototype` dead-ends rather than handing a formula a
function object. The guard lives in `parser.ts` (`getPathSegment`,
`isBlockedSegment`) and is shared with `deepGet`, which every path-addressed
consumer (cascade, gaps, context, renderer, view models) resolves through. An
array's own `length` still resolves; an inherited `map` does not.

## Built-in functions (`BUILTINS`)

`type Builtin = (args: CalcValue[]) => CalcValue` where
`CalcValue = number | string | boolean | null`. The table is `Object.freeze`d.

**Aggregation / logic:** `sum` (nulls→0), `avg` (null if no inputs), `min`, `max`,
`coalesce` (first non-null), `if(cond, then, else)`, `round(num, dec)`
(half-away-from-zero).

**Math:** `abs`, `floor`, `ceil`, `sqrt` (negative→error), `pow`, `log`
(natural; non-positive→error), `exp`. All propagate null.

**Financial:**
- `pmt(rate, n, pv)` — periodic amortizing payment; positive convention; `n>0`
  required; `rate=0 → pv/n`.
- `npv(rate, ...flows)` — flow at index 0 is at t=0 (undiscounted).
- `fv(rate, n, pmt, pv?)` — future value of a payment series + initial pv.
- `pv(rate, n, pmt, fv?)` — present value (inverse of `fv`).
- `nper(rate, pmt, pv, fv?)` — periods to amortize; throws if no real solution.
  Closed-form, and **normatively so** since protocol 1.4.0: some formulations
  solve it numerically, which would reintroduce exactly the reproducibility
  problem `irr` was pinned to remove.
- `irr(...flows)` — **bracket, then bisect. No Newton polish.** Protocol §VIII.3
  is normative here as of 1.4.0 ([RFC 0024](../rfcs/0024-iterative-function-determinism.md)),
  so the procedure is not an implementation detail: bracket over `[-0.999, 10]`
  (-99.9% to 1000%), return an exact endpoint root, then bisect to
  `|npv| < 1e-9` or a half-interval below `1e-12`, capped at 200 iterations.
  Anything else raises `CALC-IRR-DIVERGE`.

> **`irr` refuses in two cases where it used to answer.** A root outside the
> bracket is an error, not a result — `irr(-1, 20)` was `18.999…`, a 1900%
> return from a search documented as stopping at 1000%. And a cash flow with an
> *even* number of roots inside the bracket raises, because `npv` then shares a
> sign at both endpoints and no bracket exists: `irr(-100, 230, -132)` was `0.1`
> purely because Newton's seed was `0.1`, while `0.2` zeroes the same NPV.
> Neither is a regression. A cash flow with several sign changes has no single
> internal rate of return, and an error says so where a number does not.
>
> Bisection is the whole point: its steps are `(lo + hi) / 2` and comparisons of
> products, which IEEE 754 requires to be correctly rounded, in an order the
> spec fixes — so two conforming engines return the same `binary64` root and the
> same receipt digest. Newton's iterates depend on the association order of a
> derivative sum no document pins.

> Argument counts are validated; type mismatches raise `CALC-TYPE-001`. See
> `calc/builtins.ts` for exact per-function rules.

## Error taxonomy (`CalcErrorCode`)

Code | Meaning
---|---
`CALC-PARSE-001` | Tokenizer/parser rejected the input
`CALC-RESOLVE-001` | Unknown function name
`CALC-TYPE-001` | Type/arity error in an operator or builtin
`CALC-DIV-ZERO` | Division or modulo by zero
`CALC-IRR-DIVERGE` | `irr` found no sign-change bracket in `[-0.999, 10]` (including a root outside it, and any even number of roots inside it), or bisection hit 200 iterations
`CALC-LIMIT-001` | Input exceeded length or AST-node cap
`CALC-TYPE-001` | (also) `round_to` outside `[-12, 12]`, or non-finite input to `quantizeDecimal`

`CalcError` (in `errors.ts`) wraps a `ProtocolError` (`category: 'calc'`) on its
`.proto` field, so engine errors flow cleanly into `CalcResult.error`.

## Dependency extraction

`extractDependencyGraph(parsed, { packs })` and `getExprDependencies(ast)` walk
formulas to produce `{ outputs, inputs, formulas }` maps. This is **descriptive,
not prescriptive** — a formula referencing a non-existent path is still recorded.
It powers `refinement.ts` (VOI gap ranking) and the Tier-3 refinement conformance
fixtures.

## The determinism boundary (do not cross)

Every calc is declared `deterministic: true`. The engine has no randomness, no
clock, no network. Same inputs → same output, always. This is what makes deals
auditable and reproducible, and it is what lets `@uwmd/excel` re-emit the *same*
formulas as Excel and get the *same* numbers. **Agents may populate the inputs a
formula reads (e.g. write `annual_debt_service`), but the derived metric itself is
always computed here, never by an LLM.** See
[10 — Conventions & invariants](10-conventions-invariants.md).

## Sensitivity tables (RFC 0007, §VIII.7)

Two-axis grids: one base formula, evaluated once per (row, column) pair with
the two axis variables overridden.

**Declared in JSON, not written in the grammar.** RFC 0007 proposed a
`sensitivity_table(expr, {…}, {…})` builtin; that would need object literals,
array literals, and a string argument executed as a program — three extensions
to a sandbox whose narrowness is why it can run on untrusted input at all. The
axis data is already JSON one level up. `SensitivityDecl` carries the axes,
`base_formula` is an ordinary safe expression, and **the grammar is
unchanged**.

`evaluateSensitivity(decl, ctx)` returns a `SensitivityResult` — its own type,
never smuggled through `CalcResult.value`, which stays
`number | string | boolean | null` because receipts pin it, the CLI renders it,
and Excel emits from it.

### Overrides

`CalcEvaluationContext.overrides` is the underlying primitive and is general —
scenario sweeps and stress tests want it too. Values are keyed by **full dotted
path** exactly as an expression writes them (`dcf.exit_cap_rate`, not
`exit_cap_rate`), consulted ahead of frontmatter, sections, and prior results.

Two properties are normative and both are pinned by tests:

- **Overrides shadow; they never write.** After a sweep the document reads
  exactly as before. A sweep that mutated it would silently change the deal.
- **`null` is a value, not an absence.** `undefined` means no override; `null`
  means "treat this path as absent", which is how you ask what a formula does
  when an input goes missing.

### Grids and refusals

A failed cell is recorded in place and does **not** fail the table —
`failed_cells` reports how many. A grid where one combination divides by zero
is still useful, and refusing the whole thing would hide the cells that worked.

Declarations are refused before any cell runs: `CALC-SENS-001` (missing axis),
`-002` (fewer than two values, or non-finite), `-003` (over 256 cells or 64 per
axis), `-004` (both axes on one variable — a trap, since the second silently
wins for every cell), `-005` (bad `round_to`).

Excel emit is deferred; `SensitivityResult` hands an emitter the grid structure
whenever one is written.

## Stochastic calculations (RFC 0005, §VIII.8)

Distributions instead of point estimates. Same shape as sensitivity tables: a
JSON `StochasticDecl` declares which paths vary and from what distribution, and
each draw is an ordinary evaluation with `overrides`. **The grammar and the
built-ins are untouched** — the RFC's proposed `uniform()` / `monte_carlo()`
built-ins would have made a builtin stateful (killing purity, which is what
makes a formula auditable), needed a lazy argument the eager evaluator cannot
give, and made legality depend on the enclosing declaration.

`evaluateStochastic(decl, ctx)` returns a `StochasticResult` — again its own
type, never routed through `CalcResult.value`.

### The determinism that actually matters

Specifying the PRNG is necessary and **not sufficient**. IEEE 754 exactly
specifies `+ − × ÷` and `sqrt`; it does not specify `log`, `exp`, `sin`, `cos`.
Box-Muller needs `log` and `cos`; Marsaglia polar needs `log`. Either would
give two hosts with the same seed samples that agree to fifteen digits and
disagree in the sixteenth.

So everything is sampled by inverse CDF:

| Kind | Exactness |
|---|---|
| `uniform` | **Exact** — arithmetic only. |
| `triangular` | **Exact** — arithmetic and `sqrt`. |
| `normal` | Central 95% exact; **tails need `log`** and are compared at a tolerance. |

`triangular`'s parameters are exactly the `low`/`central`/`high` the
asset-class default tables already carry.

Percentiles are **nearest-rank**, never interpolated — a percentile is an
observed sample, so it is exactly reproducible whenever the samples are.
`stddev` is the sample (`n−1`) form. A failed draw is counted in
`failed_samples` and excluded, not folded in as zero.

### Known gap

`prng.ts` implements PCG-XSL-RR-128/64 from the published algorithm, but its
test vector was **generated by that implementation**. It proves
self-consistency, not agreement with the reference C code at pcg-random.org.
Port the TypeScript rather than re-deriving pcg64 from the paper until that
check is done.
