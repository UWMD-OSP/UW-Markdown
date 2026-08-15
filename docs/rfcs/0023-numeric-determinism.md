---
rfc: 0023
title: Fix a numeric model and a single quantization boundary
status: implemented
author: UW Markdown Working Group
created: 2026-08-14
affects:
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0023: Fix a numeric model and a single quantization boundary

## Summary

UW Markdown promises verifiable determinism but never says how precise a
number is. This RFC adds §VIII.5 "Numeric model" to the protocol: evaluation
runs in unrounded IEEE 754 binary64, and a calculation's **reported** value is
quantized to a stated number of decimal places, half away from zero, at exactly
one boundary — `evaluateCalc()`. Calculations gain an optional `round_to`, with
a normative default table keyed on `unit`. The immediate payoff is that a
receipt's tolerant value check and its bit-exact digest can no longer disagree,
and that Excel↔evaluator parity becomes an exact equality instead of an
agreement to six decimals.

## Motivation

**A receipt applies two contradictory checks to the same numbers.**
`RECEIPT_RESULT_TOLERANCE = 1e-6` (`receipts.ts`) compares a stated result
against recomputation *tolerantly*, while `results_digest` is SHA-256 over the
RFC 8785 canonicalization of those same raw doubles — *bit-exactly*.
`computeReceiptResults` stored `evaluateCalc`'s value with no quantization
between them. A last-unit-in-the-last-place difference therefore passed the
tolerant check and failed the exact one, and `verifyReceipt` reported the
result as `RCP-04` — *corruption*. Verification pointing at the record when the
record is fine is the worst failure mode a receipt can have.

**Nothing normative stated a precision.** The six-decimal parity rule that the
entire Excel↔calc invariant rests on lived only as a test assertion in
`packages/uwmd-excel/src/toWorkbook.test.ts`. `calc-result.schema.json` shipped
an example carrying seventeen significant digits
(`"value": 1.3895781637717122`), and the tier-3 conformance baseline pinned
`"value": 104.75999999999999` for a RevPAR figure — a dollar amount whose
correct value is `104.76`. Two independent implementers reading the spec would
not have produced the same receipt digest, which for a standard is the whole
ballgame.

**The `round()` builtin diverged from its own documented contract.** It scaled
by `10 ** dec`, which reintroduces the binary artifact it exists to remove:
`1.005 * 100` is `100.49999999999999`, so `round(1.005, 2)` returned `1.00`
where spreadsheet `ROUND` returns `1.01`. §VIII.3 documents the function as
"half-away-from-zero," and half away from zero of `1.005` at two places is
`1.01`. This was a defect against the existing spec, not a change to it.

## Proposed change

### Spec — `UW_PROTOCOL_v1.md` §VIII.5 (new), taxonomy renumbered to §VIII.6

**Protocol 1.2.0 → 1.3.0.** §VIII.5 adds normative `MUST` requirements, and
`VERSIONS.md` compatibility rule 2 puts strengthened requirements at a minor
bump. Leaving it at 1.2.0 would mean two different documents both calling
themselves protocol 1.2.0 — precisely the drift the spec/schema/protocol
lockstep invariant exists to prevent. A Tier-3 host conforming to 1.2.0 as
previously published does not conform to §VIII.5.

- A host **MUST** evaluate in IEEE 754 binary64 and **MUST NOT** round
  intermediate values. Rounding inside an expression happens only where the
  author wrote `round(num, dec)`.
- The reported `value` **MUST** be quantized to the calculation's effective
  decimal places, **half away from zero** — the rule `round()` implements and
  the rule spreadsheet `ROUND` implements, which is what makes them comparable.
- Effective decimal places are `round_to` when stated, otherwise the default
  for `unit`:

  | `unit` | Default | Rationale |
  |---|---|---|
  | `$` | 2 | Money is quantized to cents. |
  | `%` | 6 | Rates are fractions (`0.0551`), so six places on the fraction is four on the percentage a reader sees. |
  | `x` | 4 | The precision term sheets quote DSCR at. |
  | absent / other | 6 | Residual; matches the rate default rather than adding a second convention. |

  The table is deliberately **total**. There is no "unspecified precision" mode,
  because an unspecified precision is an unspecified interoperability contract.
- `round_to` **MUST** be an integer in `[0, 12]`. Past roughly fifteen
  significant decimal digits a binary64 has no fractional information left.
- **Quantization is not display.** `display` stays a presentation concern.
  Digests, equality, and Excel parity are defined over `value`.
- Any digest over calc outputs — `results_digest` in particular — **MUST** be
  taken over quantized values.

### Library — additive

- `ModuleCalcDecl.round_to?: number`; `CalcResult.round_to?: number` (echoed so
  a consumer sees the contract it got, including when it came from the default).
- New `calc/quantize.ts`: `quantizeDecimal`, `resolveRoundTo`, `MAX_ROUND_TO`,
  `DEFAULT_ROUND_TO`, `DEFAULT_ROUND_TO_BY_UNIT`. Exported from both `index.ts`
  and `browser.ts` — a host that reports its own derived numbers alongside pack
  results must quantize them identically or its digest will not reproduce.
- `packs/excel-emit.ts` gains `emitCalcExcelFormula(decl, opts)`, which wraps
  the emitted expression in `ROUND(expr, round_to)`. `emitExcelFormula` keeps
  emitting the bare expression.
- New loader code `PROTO-MOD-067` for a malformed `round_to`.

## Compatibility analysis

- **Existing `.uwx.md` / `.uw.md` files** — unaffected. Quantization applies to
  computed outputs, never to stored input data. No file becomes invalid.
- **Tier-1 / Tier-2** — unaffected; neither computes.
- **Tier-3** — a conforming host's reported values change in the last few
  digits. This is the point of the RFC. `round_to` is optional, so every
  existing manifest stays valid.
- **Tier-4** — unaffected.
- **Modules** — additive property under `additionalProperties: false`, so the
  schema had to be extended; it was, in lockstep with `modules.ts`.
- **Existing receipts** — a receipt issued before this lands states unquantized
  values, so recomputation disagrees. It is **not** reported as corruption:
  `RCP-07` already covers "results disagree *and* the engine version differs,"
  and returns `unverifiable`, keeping the indeterminate case distinct from the
  failed one. `@uwmd/core` is bumped to **1.2.0**, which is what makes RCP-07
  fire. No new mechanism was needed — the three-state design already had the
  right answer.

  This is why the version bump is the migration path, and why bumping
  `subject.canonicalization_version` would have been wrong: that field names how
  the *document* was canonicalized, and the document canonicalization did not
  change.

  **`computation.protocol_version` (new, optional).** Relying on the engine
  version to signal quantization only works for receipts this engine issued —
  an engine version means nothing to a reader who does not know that engine's
  release history, which is exactly the position a verifier is in when handed a
  third-party receipt. A receipt now states the protocol version it computed
  under, so "are these values quantized per §VIII.5?" is answerable from the
  receipt alone. It is **optional**: a receipt issued before the field existed
  cannot retroactively claim a version, so absence means *unstated*, not
  *non-conforming*, and a verifier must not treat it as a failure. Pinned by
  test, and by `conformance/receipts/verify/01-clean`, whose receipt
  deliberately omits the field and still verifies.

## Conformance impact

Updated:

- `conformance/tier-3-calc-host/fixtures/revpar-basic/expected-result.json`
  (`104.75999999999999` → `104.76`)
- `conformance/tier-3-calc-host/fixtures/dscr-from-section/expected-result.json`
  (`1.3895781637717122` → `1.3896`)
- `conformance/receipts/issue/{01-uwx-multifamily,02-lite-industrial}/expected-receipt.json`
  — quantized results, new `results_digest`, engine `1.2.0`
- `conformance/receipts/verify/01-clean/receipt.json` — reissued
- `conformance/receipts/verify/03-result-disagrees/receipt.json` — reissued with
  the deliberate `dscr` overstatement preserved and `results_digest` recomputed
  over the doctored results, so the scenario still reaches `RCP-03` rather than
  tripping `RCP-04` first

Added (the `modules` suite runs each through both ajv and the hand-written
loader and fails when the two disagree, so these also prove no schema/loader
drift on the new key):

- `modules/accept/03-calc-round-to` — stated at `0` and `12`, and omitted so the
  unit default applies
- `modules/reject/10-calc-round-to-out-of-range` — `13` and `-1` → `PROTO-MOD-067`
- `modules/reject/11-calc-round-to-non-integer` — `2.5` → `PROTO-MOD-067`

Corpus: 147 → **153** assertions.

## Reference implementation

- **Files:** `calc/quantize.ts` (new), `calc/index.ts`, `calc/builtins.ts`,
  `calc/errors.ts`, `protocol.ts`, `modules.ts`, `packs/excel-emit.ts`,
  `packs/index.ts`, `index.ts`, `browser.ts`, `version.ts`,
  `packages/uwmd-excel/src/layout.ts`, both schemas, the protocol spec.
- **Test plan:** `calc/quantize.test.ts` (new, 13 assertions incl. the `1.005`
  regression, idempotence, `-0`, and the `MAX_SAFE_INTEGER` boundary); an
  `evaluateCalc — the quantization boundary` block in `calc/calc.test.ts`
  covering the unit defaults, explicit override, unrounded intermediates, and
  pass-through of non-numeric results; `round_to` accept/reject in
  `modules.test.ts`; and in `receipts.test.ts` a test asserting **no stated
  value carries more decimals than its contract allows** plus digest
  reproducibility across issuances.
- **Parity:** the nine pack parity tests and `toWorkbook.test.ts` now assert
  `toBe` rather than `toBeCloseTo(…, 6)` — the single strongest signal that one
  rounding rule is genuinely applied on both sides.

## Alternatives considered

**Arbitrary-precision decimals (decimal.js / `BigDecimal`).** Rejected. It is
disproportionate to the problem, adds a dependency to a package whose layering
invariant keeps it at one, and would make Excel parity *worse*, not better —
Excel is binary64, so exact decimal arithmetic would diverge from the target
this format has to interoperate with. The problem was never that binary64 is
inaccurate; it was that nothing said where accuracy stops mattering.

**Loosen the digest instead — hash rounded values only at comparison time.**
Rejected. A digest whose inputs are normalized at check time but not at issue
time is a digest of something the receipt does not actually state. Quantizing at
issuance means the receipt says what it means.

**Leave `round_to` absent = unquantized, packs opt in.** Rejected. It is
backward compatible and it leaves the defect in place for every declaration
that does not opt in, which would be all of them. A numeric model with a hole in
it is not a numeric model.

**Add explicit `round_to` to all 109 pack calculations.** Rejected during
implementation. Every pack calculation uses `$`, `%`, or `x`, so the normative
defaults already give each one exactly the precision it wants. Restating that
109 times would duplicate the normative table into a second place that can drift
from it. The packs stay on the defaults; `packs.test.ts` covers the resolution.

## Unresolved questions

Deliberately out of scope, raised and deferred:

- **Pinning `irr()` normatively.** §VIII.3 now *documents* the reference
  bracket (`[-0.999, 10.0]`), the Newton-then-bisection strategy, and the
  200-iteration cap, explicitly marked non-normative. Making them binding —
  along with `xirr` and day-count conventions, which do not exist at all — is
  deferred to a follow-up RFC. Worth stating plainly: quantization made receipts
  reproducible *for a given engine*, not *across engines*, and for iterative
  functions it hides the disagreement rather than resolving it.
- **Whether `%` should carry a distinct `bps` unit.** Six places on a fraction
  is adequate for rates, but basis-point spreads on large balances may want
  more. Deferred until a pack actually needs it.

## Prior art

IEEE 754-2019 §5.4 separates arithmetic from conversion-to-decimal, which is the
same split this RFC draws between evaluation and reporting. RFC 8785 (JCS)
specifies number serialization exactly because "the obvious thing" is
under-determined across implementations; this RFC is the same argument one layer
up, about the value rather than its serialization. IEEE 754 decimal64 and
SQL `NUMERIC(p, s)` both attach scale to the *declaration* rather than to the
value, which is why `round_to` lives on `ModuleCalcDecl`.
