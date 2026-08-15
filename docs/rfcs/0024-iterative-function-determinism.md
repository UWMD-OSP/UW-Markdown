---
rfc: 0024
title: Pin the iterative solvers so two engines agree on a root
status: draft
author: UW Markdown Working Group
created: 2026-08-15
affects:
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0024: Pin the iterative solvers so two engines agree on a root

## Summary

RFC 0023 made a calculation's *reported* value reproducible by quantizing it at
one boundary. That fixed how a number is rounded, not how it is found. Every
closed-form builtin now agrees across engines because the arithmetic is the
same; `irr()` does not, because it is a root search, and its answer is a
function of the search — the seed, the order of methods, the bracket, the
stopping rule — none of which the protocol pins. This RFC makes `irr()`'s
algorithm normative, so that two conforming hosts given identical cash flows
return the identical `binary64` root, and therefore the identical receipt
digest. `xirr()` and day-count conventions are explicitly out of scope.

## Motivation

§VIII.3 currently carries a convergence note describing the reference
implementation's bracket, method order, and iteration cap, and states plainly
that these are "documented, not yet normative." Three things are wrong with
leaving it there, and the first two are worse than the note admits.

**1. The documented bracket does not bind the answer.** The note says the
implementation "brackets the root on `[-0.999, 10.0]` … refines with Newton's
method, falls back to bisection." `calc/builtins.ts` does the reverse: Newton
first, from a seed of `0.1`, capped at 100 iterations; the bracket and its
200-iteration bisection are the *fallback*. Newton is free to converge outside
the bracket, and does:

```
irr(-1, 20)  →  18.999999999994728
```

That is a 1900% return, returned by an engine whose specification says it
searches up to 1000%. An implementer who reads §VIII.3 and brackets first — the
obvious reading — computes `npv(-0.999)` and `npv(10)` with the same sign,
fails to bracket, and raises `CALC-IRR-DIVERGE`. Same input, same spec, one
engine returns a number and the other an error. The note is also simply
inaccurate as a description of the reference implementation, which this RFC
corrects as errata (see [Errata](#errata)).

**2. Where roots are not unique, the seed picks the answer.** A cash flow with
more than one sign change can have more than one real root, and both are
correct:

```
irr(-100, 230, -132)  →  0.1
```

`0.10` and `0.20` both zero this NPV. The engine returns `0.10` because the
seed is `0.1` — the answer is an artifact of the starting point, not of the cash
flows. An engine seeded at `0.15`, or one that bisects, returns `0.20`. Nothing
in the protocol makes either wrong.

**3. Quantization hides this rather than resolving it.** §VIII.5 rounds
`0.10` and `0.20` to six decimals independently and faithfully. The receipt then
records a `results_digest` over the quantized values, so two engines produce two
clean, well-formed, mutually contradictory receipts, and `verifyReceipt` reports
`RCP-04` — a corrupted record — for a document that is not corrupt. This is the
same failure mode RFC 0023 removed for closed-form calculations, still open for
the one builtin that searches.

The exposure is small in practice and sharp in principle: `irr` appears in the
multifamily and every other asset-class pack, so it reaches any deal with a DCF.
Conventional cash flows (one sign change) have a unique root and are unaffected
by problem 2 — but problem 1 needs no unusual cash flow at all, only a return
above 1000%, which a short-hold or highly-levered pro forma produces.

## Proposed change

Replace the non-normative note in §VIII.3 with a normative algorithm.

### Spec: §VIII.3, `irr` convergence

> **`irr` convergence (normative).** `irr(...flows)` MUST return the root
> computed by the following procedure, which is defined so that any
> implementation using IEEE 754 `binary64` arithmetic in the stated order
> produces bit-identical results.
>
> Let `npv(r) = Σ flows[t] / (1 + r)^t` for `t = 0 … n-1`.
>
> 1. **Domain.** The search interval is `lo = -0.999`, `hi = 10.0`. A root
>    outside it is not reported; see step 5.
> 2. **Bracket.** Evaluate `npv` at `lo` and `hi`. If either is non-finite, or
>    if `npv(lo) * npv(hi) > 0`, the procedure fails — see step 5.
> 3. **Bisection.** Bisect for exactly 200 iterations or until
>    `|npv(mid)| < 1e-9` or `(hi - lo) / 2 < 1e-12`, whichever comes first,
>    with `mid = (lo + hi) / 2` evaluated in `binary64`. Retain the half whose
>    endpoints bracket the sign change, comparing `npv(lo) * npv(mid) < 0`.
> 4. **No polish.** The bisection result is the answer. An implementation MUST
>    NOT refine it with Newton's method or any other step: Newton's iterates
>    depend on a derivative evaluation order that this document does not pin,
>    and the refinement it buys is below the quantization boundary of §VIII.5.
> 5. **Failure.** If step 2 fails to bracket, or step 3 exhausts its iterations
>    without meeting a stopping condition, raise `CALC-IRR-DIVERGE`. An engine
>    MUST NOT substitute a root found outside `[lo, hi]`.
>
> Where `npv` has more than one root in `[lo, hi]`, this procedure selects one
> of them deterministically as a consequence of the fixed interval and fixed
> iteration order. Which one is not otherwise specified, and callers MUST NOT
> depend on it having financial meaning: a cash flow with multiple sign changes
> has no single internal rate of return, and a host SHOULD surface that as a
> modeling problem rather than a number.

Bisection alone is bit-reproducible in a way Newton is not. Its iterates are
`(lo + hi) / 2` and comparisons of products — every step a `binary64` operation
IEEE 754 requires to be correctly rounded, in an order the text fixes. Newton
requires evaluating a derivative sum whose association order is not pinned, and
each iterate feeds the next, so a last-ULP difference in the derivative moves
the returned root by more than the tolerance.

### Library

`calc/builtins.ts` — `irr` is rewritten to the procedure above; the Newton block
is deleted, not reordered. Additive to the exported surface: nothing new. The
returned value changes for the inputs described under Compatibility.

## Compatibility analysis

**This is a breaking change to `irr`, deliberately.** The alternative is a
specification that says one thing and an implementation that does another.

- **Existing `.uw.md` files** — remain valid. Nothing about parsing or the
  document model changes. A file whose DCF implies an IRR above 1000% (or below
  -99.9%) computes today and raises `CALC-IRR-DIVERGE` after. That is the
  intended correction: the engine was answering outside the domain it claims.
- **Tier-1 Reader / Tier-2 Editor** — unaffected; neither evaluates.
- **Tier-3 Calc Host** — a host matching the current reference implementation
  becomes non-conforming. Two changes are needed: bracket before searching, and
  do not polish. Both are deletions.
- **Tier-4 Agent Host** — unaffected; agents never compute.
- **Modules** — no manifest change. A module declaring an `irr` calc gets the
  new behavior automatically.
- **Receipts** — a receipt issued before this change, over a document whose IRR
  moves, verifies as `unverifiable` through the existing `RCP-07`
  engine-version rule rather than `failed`, exactly as RFC 0023's receipts did.
  This is the second consecutive release to lean on that rule, which is an
  argument for shipping both in one protocol version rather than two.

**Deprecation path.** None is proposed, and the reason is worth stating: the
behavior being removed is a value returned from outside the stated domain. There
is no correct code depending on it — code that reads `irr(-1, 20)` as `19.0`
is relying on the spec being wrong. A warning period would preserve the
divergence between engines for the length of the warning, which is the thing
this RFC exists to close.

Protocol version: **1.4.0**. Under `VERSIONS.md` rule 2 this is a strengthening
of requirements — text that was explicitly non-normative becomes `MUST` — which
is a minor bump, not a major, even though a previously-conforming host has work
to do. Rule 2 already contemplates this: "New required behavior in a 1.x
protocol is opt-in for 1.0 tools and becomes normative at the next major."

## Conformance impact

**Existing fixtures.** No fixture currently exercises an out-of-bracket or
multi-root IRR, so none needs updating. Worth stating as a finding in its own
right: the corpus proved the implementation self-consistent, not correct against
its specification. Fixtures that compute an IRR on conventional cash flows
(`conformance/calc/**` and the Tier-3 pack suites) are unaffected — verified by
the property that a single-sign-change cash flow has a unique root, which
bisection and Newton both find to within the §VIII.5 quantum.

**New fixtures.**

| Path | Asserts |
|---|---|
| `conformance/calc/irr/01-out-of-bracket` | `irr(-1, 20)` raises `CALC-IRR-DIVERGE`, not `19.0` |
| `conformance/calc/irr/02-multi-root` | `irr(-100, 230, -132)` returns the bisection root, pinned exactly |
| `conformance/calc/irr/03-conventional` | A normal DCF's IRR is unchanged from the pre-RFC value |
| `conformance/calc/irr/04-boundary` | Roots at exactly `-0.999` and `10.0` are found, not rejected |
| `conformance/calc/irr/05-degenerate` | All-positive and all-negative flows raise, rather than returning a bracket endpoint |

Fixture 03 is the load-bearing one: it is what proves this RFC does not move the
numbers on real deals.

## Reference implementation

- **Files affected:** `packages/uwmd-core/src/calc/builtins.ts` (the `irr`
  body), `spec/UW_PROTOCOL_v1.md` §VIII.3, `packages/uwmd-core/src/protocol.ts`
  (`PROTOCOL_VERSION` → `1.4.0`), `VERSIONS.md`, `CHANGELOG.md`.
- **API surface:** unchanged. No new exports; `irr` keeps its signature and its
  error code.
- **Test plan:**
  - A table test over the five fixture cases above, in `calc/calc.test.ts`.
  - A property test (`calc.property.test.ts`) asserting that for any generated
    cash flow with exactly one sign change and a root inside the bracket,
    `|npv(irr(flows))| < 1e-9` — that the returned root is a root, not merely a
    reproducible number.
  - A regression test pinning `irr(-1, 20)` to `CALC-IRR-DIVERGE`, named for
    this RFC so the reason survives.
  - Excel parity: `IRR()` in Excel takes a `guess` and searches differently, so
    the pack's Excel emit path needs checking against fixture 02 — parity may
    have to be documented as approximate for multi-root inputs rather than
    asserted as exact. This is the one open implementation risk.

## Alternatives considered

**Require agreement only after quantization.** Instead of pinning the algorithm,
require that two engines agree to §VIII.5's decimal places. Weaker and cheaper:
any reasonable solver meets it for conventional flows. It fails exactly where
the problem is — `0.10` and `0.20` differ far above the sixth decimal, and an
out-of-bracket root differs by an order of magnitude. It would let the spec
claim interoperability it does not have.

**Pin Newton with a specified seed and evaluation order.** Keeps current
behavior for the multi-root case and is faster. Rejected because pinning
Newton means pinning the association order of the derivative sum, the
non-finite guards, and the divergence conditions, in enough detail that an
independent implementer could reproduce the iterate sequence exactly. That
specification is longer than the bisection one and harder to verify, for a
convergence speed advantage that is irrelevant at these input sizes.

**Widen the bracket instead of enforcing it.** Make `hi` large enough
(say `100.0`) that `irr(-1, 20)` stays inside, so nothing breaks. Rejected: it
relocates the cliff instead of removing it, and a 10,000% IRR reported without
comment is a worse outcome than an error that says the model is off.

**Return all roots, or a root set.** Honest about the mathematics — a
multiple-sign-change cash flow genuinely has several IRRs — but it changes
`irr`'s return type from `number | null` to a collection, which the value model
in §VIII.1 does not have, and every consumer of the result would need to choose
one anyway. Better addressed by a host-level validation that flags multi-sign
cash flows, which is a separate proposal.

**Do nothing until v2.** The status quo. The cost is that every receipt over a
document with an out-of-bracket IRR is a receipt whose digest is engine-specific
while claiming to be canonical.

## Unresolved questions

- **Excel parity for multi-root inputs.** Excel's `IRR` takes a `guess` and
  will return a different root than pinned bisection. Invariant 4
  (Excel↔calc-engine parity is exact) may need a documented exception for
  `irr` on non-conventional cash flows, or the emit path may need to write a
  literal rather than a formula. Resolving this may change the shape of the
  proposal and is the main reason this RFC is `draft` rather than `active`.
- **Should a multi-sign-change cash flow warn?** The spec text above says a host
  `SHOULD` surface it as a modeling problem, without saying how. A validation
  code (`CALC-IRR-AMBIGUOUS`, or a validator finding) would make it actionable.
  Deferred, because it is additive and does not block pinning the solver.
- **`nper()` is also iterative in some formulations.** The reference
  implementation uses the closed-form logarithm, so it is not affected — but the
  spec does not say it must, and an implementer who solves it numerically has
  the same class of problem. Worth an audit of every builtin for hidden
  iteration before this RFC is accepted.

## Out of scope

`xirr()` and day-count conventions (ACT/365F, ACT/ACT, 30/360, …) are **not**
proposed here, and are deferred to v2 as recorded in the RFC 0023 review. They
need a date model in the value system of §VIII.1, which does not have one, and
that is a larger change than pinning a solver. Adding an irregular-interval IRR
before the regular one is pinned would compound the divergence rather than
resolve it.

## Errata

The §VIII.3 note added in protocol 1.3.0 describes the reference implementation
as bracketing first, refining with Newton, and falling back to bisection at 200
iterations. The implementation runs Newton first from a seed of `0.1` capped at
100 iterations, and uses the bracket only as a fallback. The note is corrected
to describe what the code does. That correction did not wait for this RFC — it
landed with the change that introduced the note, since a non-normative note
which misdescribes the reference implementation is worse than no note: it is
exactly what a second implementer builds against. This RFC only adds the
pointer, and proposes replacing the note entirely with the normative procedure
above.

## Prior art

- **Excel `IRR`/`XIRR`** take a `guess` argument and document neither the
  method nor the tolerance — the reason spreadsheet IRRs are famously
  irreproducible across Excel, LibreOffice, and Google Sheets. This RFC's
  approach is the opposite trade: no `guess`, no choice, one answer.
- **IEEE 754-2019 §11** (reproducibility) is the model for the argument above:
  reproducibility follows from pinning the *operations and their order*, not
  from tightening tolerances.
- **ISDA 2006 Definitions §4.16** (day count fractions) is the reference the
  deferred `xirr` work will need, and the reason it is deferred: there are seven
  conventions in common use and picking one is a domain decision, not a numeric
  one.
- **RFC 8785 (JSON Canonicalization)**, already used for receipt digests, is
  the same principle applied to serialization: agreement comes from removing
  choices, not from comparing loosely.
