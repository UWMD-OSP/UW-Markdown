---
rfc: 0026
title: A typed capital stack — tranches, preferred equity, and stack-aware sizing
status: draft
author: jaredmaxey
created: 2026-08-18
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0026: A typed capital stack — tranches, preferred equity, and stack-aware sizing

> **Status: early draft / stub.** This RFC establishes the problem, the shape of
> the solution, and the four decisions it must make. The normative grammar,
> schemas, and metric definitions are sketched, not finalized. It is spun out of
> RFC 0019 (mixed-use composition), which deferred component-level debt to it
> (0019 Decision 3).

## Summary

UW Markdown models exactly one loan. `debt_structure` is a single flat object,
and every deterministic debt metric — DSCR, LTV, debt yield, cash-on-cash —
reads that one loan's `loan_amount` and `annual_debt_service`. Real deals stack
capital: a senior loan under a mezzanine tranche under preferred equity under
common equity, sometimes with bridge financing that funds in stages. Today the
format can *name* a mezzanine or preferred-equity **dollar amount** in
`sources_uses`, but it cannot state that tranche's rate, position, or terms, and
no math is stack-aware. This RFC proposes a typed, ordered capital stack: a
bounded set of position-keyed tranche slots, each carrying amount, rate, and
terms; stack-aware sizing metrics (per-tranche and blended DSCR, attachment-point
debt yield, LTC by layer); and preferred-equity return with cash-versus-accrued
handling. It stops short of promote/distribution waterfalls, which remain a
later RFC. The capital stack is **asset-class independent** — every income class
benefits — and it is the primitive from which RFC 0019's component-level debt
falls out.

## Motivation

The single-loan assumption is woven through the library, verified as of
`@uwmd/core` 1.5.0:

- **`debt_structure` is one loan.** `spec/UW_FORMAT_SPEC_v1.md` §4.7 defines a
  flat object: one `loan_amount`, one `interest_rate`, one amortization, one
  `sizing_metrics` sub-object. `bridge` and `mezzanine` exist only as enum
  *values* of the single `loan_type` field — you can label the one loan a bridge
  or a mezz loan, but you cannot model a senior **and** a mezz tranche.
- **`sources_uses.sources` is a closed set of scalar buckets.** `senior_loan`,
  `mezzanine_debt`, `preferred_equity`, `equity_sponsor`, `equity_lp`,
  `seller_financing`, `government_grant`, `tax_credit_equity`, `other` — each a
  dollar amount only. No rate, no position, no per-source terms, and not a
  repeatable array. Two mezz tranches, or a tertiary loan, cannot be represented.
- **Preferred equity is a single dollar line** with no return rate, no accrual
  (cash-pay versus PIK), and no waterfall. The spec explicitly punts these to the
  free-form `x_partnership_structure` extension.
- **No math is stack-aware.** Every pack computes `dscr` as
  `noi_model.net_operating_income / debt_structure.annual_debt_service` against
  the one loan. There is no senior-only DSCR, no combined DSCR across senior +
  mezz, and no attachment-point (cumulative) debt yield. Consistency check
  `CC-03` actively *ties* `sources_uses` senior loan to
  `debt_structure.loan_amount`, hard-coding the one-loan world.

The cost is that a substantial share of institutional deals — anything with mezz,
pref, or bridge-to-perm structure — cannot be underwritten honestly in the
format. A user can state the dollar amounts, but the DSCR the tool computes is
the senior-only DSCR mislabeled as *the* DSCR, and the per-layer risk that is the
entire reason the stack exists is invisible.

RFC 0019 hit this directly: a mixed-use property with separately-financed
commercial and residential components needs component-level debt, and there is no
primitive to attach it to. 0019 chose to refuse component debt rather than fake
it, and named this RFC as where the primitive belongs.

## Proposed change

Four decisions define this RFC. The sketch below is a starting point for each.

### Decision A — Representation: fixed position-keyed slots, not a free array

The Tier-3 calc engine has **no iteration and no array indexing** (`calc/parser.ts`
admits only static `path` and `call` expressions; `sum()` is variadic over
explicit arguments, not an aggregation over a collection). A variable-length
tranche array is therefore not addressable by a pack formula — the same wall
RFC 0019 and RFC 0021 both hit.

Two viable routes:

- **(A1) Fixed named slots.** A bounded `capital_stack` section with a closed set
  of position-keyed slots — `senior`, `mezzanine`, `preferred_equity`,
  `common_equity`, and a small number of extension slots — each a typed object
  `{ position, amount, rate, accrual, amortization_months, io_months, term_months }`.
  Static paths (`capital_stack.mezzanine.rate`) address every field. This extends
  the existing `sources_uses` design rather than replacing it, and it is what the
  calc engine can actually read today.
- **(A2) State-and-verify.** Following RFC 0021 §6 rollup receipts, the document
  *states* per-tranche and aggregate metrics and the verifier recomputes them
  over a fixed `fn` vocabulary, touching no engine primitive. More flexible on
  tranche count; heavier machinery.

**This RFC proposes A1** as the v1 representation, with A2 noted as the escape
hatch if real deals demand more than one slot per position. A1's bound (one slot
per named position, a capped number of positions) matches how underwriters
actually describe a stack — by layer, not by lender — and keeps `MAX_NODES`
static.

The single `debt_structure` remains valid and becomes the **senior/primary
view**: when a `capital_stack` is present, `debt_structure` MUST equal its
`senior` slot, and `CC-03` is generalized to that rule. A document with no
`capital_stack` behaves exactly as today.

### Decision B — Stack-aware sizing metrics

New metrics, computed from the slots:

- **Per-tranche DSCR** — NOI (or NOI net of senior debt service, for a mezz
  coverage view) over each tranche's debt service.
- **Blended/combined DSCR** — NOI over the sum of cash-pay debt service across
  all debt tranches.
- **Attachment-point debt yield** — NOI over cumulative debt balance *up to and
  including* each layer, the metric a mezz lender actually sizes to.
- **LTC / LTV by layer** — cumulative balance through each layer over cost / value.
- **Weighted average cost of capital** across the stack.

Each is a static-path formula over the fixed slots (Decision A1), so Excel
emission stays static and the Excel↔calc parity invariant holds unchanged.

### Decision C — Preferred equity: return and accrual, not waterfall

Preferred equity gains a `rate` (the preferred return) and an `accrual` mode:
`cash` (current-pay, enters cash-flow coverage) versus `accrued` (PIK, compounds,
does **not** enter DSCR). This is the minimum needed to place pref in the stack
honestly. **Promote, distribution tiers, IRR hurdles, and catch-up are explicitly
out of scope** — they are a genuinely hard, separate modeling problem, they need
a multi-period cash-flow engine the format does not have, and they stay in
`x_partnership_structure` until a dedicated RFC.

### Decision D — Bridge mechanics

Deferred within this RFC to a follow-on or a later section. A bridge loan's
distinguishing features — as-is versus as-stabilized sizing, future-funding /
holdback tranches, a stabilization-date DSCR test — are a second axis of
complexity orthogonal to the stack. v1 admits a `bridge` slot as a debt tranche
with a rate and term (so it can be *placed* in the stack) but does not model
staged funding or dual sizing. Flagged in Unresolved questions.

## Compatibility analysis

- **Existing `.uw.md` / `.uwx.md` files** — none become invalid. `capital_stack`
  is new and optional; a file with only `debt_structure` behaves exactly as
  today. No existing file can contain it.
- **Tier-1 Reader** — unaffected; an unknown section renders as a block.
- **Tier-2 Editor** — additive; byte preservation is untouched.
- **Tier-3 Calc Host** — additive. A host that does not implement this RFC
  continues to read `debt_structure` and compute single-loan metrics. A host that
  does gains the stack metrics. The generalized `CC-03` (senior slot ==
  `debt_structure` when both present) is the one new consistency rule.
- **Tier-4 Agent Host** — additive. As with allocation in RFC 0019, an agent MUST
  NOT invent tranche rates or amounts; they are user-supplied capital terms.
- **Modules** — no manifest schema change.
- **RFC 0019** — this RFC supplies the primitive 0019 deferred. Once landed, a
  mixed-use component MAY carry a `capital_stack`, and 0019's refusal of
  component-level `debt_structure` relaxes to accept it. That relaxation is a
  one-line follow-up to 0019, not part of this RFC.

The one behavior change to an existing surface is that packs gain stack-aware
metrics; the existing single-loan metrics are unchanged when no stack is present.

## Conformance impact

No existing fixture requires changing — `capital_stack` is additive and the
single-loan path is untouched.

New fixtures (sketch):

- `capital-stack/senior-mezz-pref/` — a three-layer stack; per-tranche DSCR,
  blended DSCR, and attachment-point debt yield all frozen.
- `capital-stack/senior-matches-debt-structure/` — `capital_stack.senior` and
  `debt_structure` present and equal; accepted. And a mismatched pair; rejected
  under the generalized `CC-03`.
- `capital-stack/pref-cash-vs-accrued/` — two documents identical but for the
  pref `accrual` mode; the cash-pay one includes pref in blended DSCR, the
  accrued one does not.
- `capital-stack/no-stack-single-loan/` — no `capital_stack`; every metric equals
  the pre-RFC single-loan result (a regression pin).
- `capital-stack/reject-promote-tiers/` — a document attempting to encode a
  distribution waterfall in `capital_stack`; rejected with guidance to use
  `x_partnership_structure` (Decision C boundary).

## Reference implementation

**Files affected (sketch)**

- `spec/UW_FORMAT_SPEC_v1.md` — a new `capital_stack` section; generalize the
  `CC-03` consistency rule. **Normative; this is why it needs an RFC.**
- `spec/schemas/` — a `capital_stack` schema (bounded, position-keyed slots).
- `packages/uwmd-core/src/capital-stack.ts` (new) — `deriveCapitalStack`, slot
  validation, the stack-aware metric helpers; browser-safe, no I/O.
- `packages/uwmd-core/src/packs/*.ts` — stack-aware metrics added to the shared
  pack machinery so every class inherits them; single-loan metrics unchanged.
- `packages/uwmd-core/src/validator.ts` — the Decision A/C rules as typed errors.
- `packages/uwmd-excel/` — one debt block per present tranche plus a stack
  consolidation block; slots are static, so named ranges stay static.
- `examples/` — a worked senior + mezz + pref deal whose stack foots.

**API surface** — additive: a `CapitalStack` type, `deriveCapitalStack`, the new
metric ids. No signature changes to existing exports.

**Test plan**

- Excel↔calc parity to the numeric-model quantum for every new metric.
- A footing test: Σ tranche amounts == total capitalization == `sources_uses` total.
- Single-loan regression: with no stack, every metric is byte-identical to 1.5.0.
- Pref cash-vs-accrued changes blended DSCR in exactly the expected direction.

## Alternatives considered

1. **A free-length tranche array.** The natural data model, but formulas address
   paths statically — "the third tranche" is not expressible without a new calc
   primitive touching the sandbox, its `MAX_NODES` bound, and the Excel emitter.
   Fixed position-keyed slots are what the engine can address, and stacking by
   named position is the underwriting convention anyway. (This is the same
   trade-off RFC 0019 §1 and RFC 0021 resolved the same way.)
2. **Keep everything in `sources_uses` and just add rate fields.** Cheapest, but
   `sources_uses` is a *balancing* section (sources == uses), not a *sizing* one;
   overloading it with per-tranche terms and coverage math conflates two jobs and
   leaves the metrics homeless.
3. **Model the full waterfall now (promote, hurdles, catch-up).** Rejected for
   v1: it requires a multi-period distribution engine the format does not have,
   and it is a larger problem than the debt stack it would sit on top of. Pref
   return/accrual (Decision C) is the honest stopping point.
4. **Do nothing; leave stacks to `x_partnership_structure`.** The status quo. It
   makes the computed DSCR silently senior-only and mislabeled — a confidently
   wrong number in exactly the deals where per-layer risk matters most.

## Unresolved questions

- **One slot per position, or a small fixed number?** Some stacks carry two mezz
  tranches (A/B notes). A1 with exactly one slot per position cannot express that;
  a capped `mezzanine_a`/`mezzanine_b` pair or the A2 state-and-verify route
  could. Decide against real deal tapes.
- **Bridge mechanics (Decision D).** As-is/as-stabilized dual sizing,
  future-funding holdbacks, and a stabilization-date DSCR test are deferred.
  Whether they belong in this RFC's next revision or their own is open.
- **Interaction with RFC 0015 portfolio relationships and RFC 0021 composites.**
  A fund-level composite over deals with their own stacks may want a rolled-up
  cost of capital; whether that rollup lives here or in 0021's receipt machinery
  is open.
- **Cross-collateralization and intercreditor terms** (standstill, cure rights)
  are documentation, not sizing math, and are almost certainly out of scope — but
  worth stating explicitly.

## Prior art

The CRE capital stack itself is the domain prior art: senior/mezz/pref/common is
a standard institutional structure, and lenders size to attachment-point debt
yield and per-tranche coverage exactly as Decision B describes. ARGUS and
standard institutional Excel models represent the stack as typed, position-keyed
rows. On the format side, OpenAPI's discriminated unions inform keying each slot
by its position/type, and RFC 0021 §6's state-and-verify rollup is the direct
ancestor of Decision A's A2 escape hatch — the same answer to the same
no-iteration constraint.
