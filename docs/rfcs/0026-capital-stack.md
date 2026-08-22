---
rfc: 0026
title: A typed capital stack — tranches, preferred equity, and stack-aware sizing
status: implemented
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

> **Accepted 2026-08-20** by the project owner under owner-led governance, with
> the four open questions the stub left resolved the same day (see Decisions).
> The scope is deliberately **split**: a buildable **v1** (tranche representation
> + stack-aware sizing + preferred-equity return/accrual + a placeable bridge
> slot) and a **documented, deferred Phase 2** (the multi-period distribution
> waterfall — promote, hurdles, tiers, catch-up). Phase 2 is captured here so its
> shape is not lost, but it is **not specified in normative detail and not built**
> by this RFC; it needs a multi-period distribution engine the format does not yet
> have. Spun out of RFC 0019 (mixed-use composition), which deferred
> component-level debt here (0019 Decision 3).
>
> **Implemented 2026-08-22:** the `capital_stack` format section (§4.24) +
> `section-capital-stack.schema.json`; `verifyCapitalStack` and the `CS-*`
> validator rules with the generalized `CC-03`; the Excel **Capital Stack**
> sheet (per-tranche debt-service and sizing formulas quantized at the
> verifier's own `CAPITAL_STACK_SIZING_DECIMALS`); the seven conformance
> scenarios under `conformance/capital-stack/`; the §4.23 MU-06 relaxation
> (a mixed-use component MAY carry its own stack); and the worked example
> (`examples/Agave-Court-Apts-Scottsdale-AZ.uwx.md`) whose stack foots and
> whose sizing verifies. Phase 2 (the distribution waterfall) remains
> documented and deferred, its boundary enforced by
> `CS-WATERFALL-UNSUPPORTED`.

## Summary

UW Markdown models exactly one loan. `debt_structure` is a single flat object,
and every deterministic debt metric — DSCR, LTV, debt yield, cash-on-cash —
reads that one loan's `loan_amount` and `annual_debt_service`. Real deals stack
capital: a senior loan under a mezzanine tranche under preferred equity under
common equity, sometimes two mezz notes (A/B), sometimes bridge financing. Today
the format can *name* a mezzanine or preferred-equity **dollar amount** in
`sources_uses`, but it cannot state that tranche's rate, position, or terms, and
no math is stack-aware.

This RFC adds a typed, ordered `capital_stack` as a **state-and-verify**
structure (RFC 0021 §6): the document *states* the tranches and the sizing
figures a lender underwrites to — per-tranche and blended DSCR, attachment-point
debt yield, LTC/LTV by layer, weighted cost of capital — and a deterministic
verifier recomputes them over a fixed, closed function vocabulary. This is the
one representation that expresses an **arbitrary number of tranches** and (in
Phase 2) a **multi-period waterfall** without touching the sandboxed Tier-3 calc
engine, which has no iteration. Preferred equity gains a return rate and a
cash-versus-accrued mode in v1. The full distribution waterfall is scoped out and
documented (Phase 2). The capital stack is **asset-class independent** — every
income class benefits — and it is the primitive from which RFC 0019's
component-level debt falls out.

## Decisions (2026-08-20)

The stub named four decisions; each is now resolved.

1. **Representation — state-and-verify (A2), not fixed slots (A1).** The stack is
   an ordered array of typed tranches plus stated sizing aggregates, recomputed by
   a verifier modeled on RFC 0021 §6 (`verifyRollup`). A1's fixed one-slot-per-
   position model was rejected because it cannot express two mezzanine notes
   (A/B), and — decisively — it routes sizing through static-path *pack formulas*,
   which cannot iterate over a variable tranche count and could never express the
   Phase 2 waterfall. State-and-verify already solved exactly this
   no-iteration problem for portfolio rollups; the capital stack is the same shape
   of problem (an aggregate over a variable member set) and takes the same answer.

2. **Sizing metrics — a fixed, closed capital-stack verifier vocabulary** (§B),
   parallel to the rollup `fn` set but stack-specific (cumulative attachment,
   cash-pay-only blended coverage). Stated in the document, recomputed by the
   verifier, three-state verdict (`verified` / `failed` / `unverifiable`) like
   every other verified surface. **No pack formula and no calc-engine primitive
   changes.**

3. **Preferred equity — return and accrual in v1; the distribution waterfall is
   Phase 2, documented and deferred** (§C). Pref gets a `rate` and an `accrual`
   mode (`cash` enters coverage, `accrued`/PIK compounds and does not). Promote,
   IRR hurdles, distribution tiers, and catch-up are **in the RFC's vision but out
   of v1's build**: they require a multi-period distribution engine the format
   lacks, and modeling them is larger than the debt stack they sit on. §E
   documents their shape and the boundary so Phase 2 can pick them up cleanly.

4. **Bridge — a placeable slot in v1; staged funding deferred** (§D). v1 admits a
   `bridge` tranche with rate and term so it can sit in the stack and carry
   coverage math. As-is/as-stabilized dual sizing, future-funding holdbacks, and a
   stabilization-date DSCR test are a second axis of complexity, deferred with the
   waterfall.

## Motivation

The single-loan assumption is woven through the library, verified as of
`@uwmd/core` 1.5.0 and re-checked at 2026-08-20:

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
- **No math is stack-aware, and there is no shared place to add it.** Each of the
  ten packs *independently* declares `dscr` as
  `noi_model.net_operating_income / debt_structure.annual_debt_service` against
  the one loan (`packs/*.ts`, one hand-written declaration per pack — there is no
  shared pack-metric machinery to extend). There is no senior-only DSCR, no
  combined DSCR across senior + mezz, and no attachment-point (cumulative) debt
  yield. Consistency check `CC-03` actively *ties* `sources_uses` senior loan to
  `debt_structure.loan_amount` (`validator.ts`; matches on `sources.loan_amount`
  or `sources.debt_proceeds`), hard-coding the one-loan world.

The cost is that a substantial share of institutional deals — anything with mezz,
pref, or bridge-to-perm structure — cannot be underwritten honestly. A user can
state the dollar amounts, but the DSCR the tool computes is the senior-only DSCR
mislabeled as *the* DSCR, and the per-layer risk that is the entire reason the
stack exists is invisible. The failure mode is not a crash; it is a confidently
wrong coverage number in exactly the deals where per-layer risk matters most.

RFC 0019 hit this directly: a mixed-use property with separately-financed
commercial and residential components needs component-level debt, and there was
no primitive to attach it to. 0019 chose to refuse component debt rather than
fake it, and named this RFC as where the primitive belongs.

## Proposed change

### A — Representation: state-and-verify, an ordered tranche array

Add an optional `capital_stack` section. It has two parts:

```json uw:section=capital_stack source=manual ts=2026-08-20T00:00:00Z v=1 confidence=high
{
  "section_id": "capital_stack",
  "content": {
    "tranches": [
      { "id": "senior",    "class": "senior_debt",       "position": 1, "amount": 26000000, "rate": 0.0625, "amortization_months": 360, "io_months": 24, "term_months": 120, "accrual": "cash" },
      { "id": "mezz_a",     "class": "mezzanine_debt",    "position": 2, "amount": 6000000,  "rate": 0.11,   "amortization_months": 0,   "io_months": 120, "term_months": 120, "accrual": "cash" },
      { "id": "pref",       "class": "preferred_equity",  "position": 3, "amount": 4000000,  "rate": 0.09,   "accrual": "accrued" },
      { "id": "common",     "class": "common_equity",     "position": 4, "amount": 4000000 }
    ],
    "sizing": [
      { "id": "senior_dscr",        "fn": "coverage",            "over": "senior",  "value": 1.85 },
      { "id": "combined_dscr",      "fn": "blended_coverage",    "through": "mezz_a", "value": 1.14 },
      { "id": "mezz_debt_yield",    "fn": "debt_yield_through",  "through": "mezz_a", "value": 0.080 },
      { "id": "wacc",               "fn": "weighted_cost",       "over": "*",       "value": 0.0731 }
    ]
  }
}
```

- **`tranches`** — an ordered array. Each tranche is a typed object keyed by a
  document-local `id`, with a `class` drawn from a closed enum (`senior_debt`,
  `mezzanine_debt`, `preferred_equity`, `common_equity`, `bridge`,
  `seller_financing`, `other_debt`), a `position` (1 = most senior), an `amount`,
  and — for anything with a return — a `rate` and `accrual`. Debt tranches carry
  amortization/IO/term. **`id` is document-local and free**, so two mezz notes are
  just two tranches (`mezz_a`, `mezz_b`); the A/B case the fixed-slot model could
  not express is trivial here.
- **`sizing`** — stated aggregate figures, each recomputed by the verifier over a
  **fixed, closed `fn` vocabulary** (§B). This mirrors `uw-rollup.schema.json`'s
  `aggregates` exactly: `id`, `fn`, a member selector (`over` a single tranche, or
  `through` a position for cumulative metrics, or `*` for the whole stack), and a
  stated `value`. A verifier recomputes `fn` and compares; disagreement is a
  typed `CS-*` failure and the result is `failed`, never a silent pass.

Why an array is safe here when RFC 0019 needed fixed slots: **the calc engine
never touches `capital_stack`.** RFC 0019's `components` had to be pack-formula-
addressable (static paths), which forced fixed slots. Capital-stack sizing is
**not** a pack formula — it is a verifier recomputation over the array, the same
way `verifyRollup` walks a variable member list without the sandbox iterating.
The no-iteration constraint applies to the Tier-3 expression language, not to a
deterministic TypeScript verifier (cf. `receipts.ts`, `composition.ts`).

`debt_structure` remains valid and becomes the **senior/primary view**: when a
`capital_stack` is present, its `senior_debt` tranche MUST reconcile with
`debt_structure` (amount and rate), and **`CC-03` is generalized** from "sources
senior loan == `debt_structure.loan_amount`" to "the stack's senior tranche, the
`sources_uses` senior bucket, and `debt_structure` all agree." A document with no
`capital_stack` behaves exactly as today.

### B — Stack-aware sizing: a fixed verifier vocabulary

The `sizing` `fn` set is closed and non-extensible — a verifier vocabulary, not
an extension of the calc language (the same discipline `uw-rollup` states for its
`fn`). v1 defines:

| `fn` | selector | recomputation |
|---|---|---|
| `coverage` | `over` a tranche | `noi_model.net_operating_income` ÷ that tranche's annual debt service |
| `blended_coverage` | `through` a position | NOI ÷ Σ **cash-pay** debt service of all debt tranches at or above that position (accrued/PIK excluded) |
| `debt_yield_through` | `through` a position | NOI ÷ cumulative debt balance up to and including that position — the attachment-point yield a mezz lender sizes to |
| `ltc_through` / `ltv_through` | `through` a position | cumulative balance through the layer ÷ total cost / value |
| `weighted_cost` | `*` | amount-weighted average `rate` across the stack (a WACC) |

Each tranche's annual debt service is itself derived deterministically from
`amount`, `rate`, `amortization_months`, and `io_months` (a standard amortizing-
or IO-payment computation the verifier owns — the same math `debt_structure`
already implies, now per tranche). Accrued/PIK tranches contribute **zero** cash
debt service to `blended_coverage` but their balance still counts in
`debt_yield_through` — accrual changes cash coverage, not the amount of capital
ahead of you.

Excel emission is *easier* here than for a pack formula: the workbook renders one
row per tranche and the sizing figures as `SUM`/ratio formulas over that variable
row range — Excel iterates ranges natively. Parity is checked the standard way:
the verifier's value and the workbook's computed value agree to the numeric-model
quantum.

### C — Preferred equity: return and accrual (v1)

A `preferred_equity` tranche carries `rate` (the preferred return) and `accrual`:

- `cash` — current-pay; its coverage obligation enters `blended_coverage`.
- `accrued` — PIK; compounds on its balance, does **not** enter cash coverage,
  and its balance is disclosed but its return is not a cash claim in the period.

This is the minimum needed to place pref in the stack honestly. What v1 does
**not** do — promote, distribution tiers, IRR hurdles, catch-up — is §E.

### D — Bridge: a placeable slot (v1)

A `bridge` tranche is a debt tranche with `rate` and `term_months`, so it can be
placed in the stack and carry `coverage` / `debt_yield_through` math. v1 does
**not** model staged funding (future-funding holdbacks), as-is/as-stabilized dual
sizing, or a stabilization-date DSCR test — these travel with the Phase 2 work
because they need the same multi-period spine.

### E — Deferred and documented: the distribution waterfall (Phase 2)

This is the part scoped **out of the build** and captured here so it is not lost.

A distribution waterfall answers "given period-by-period cash available, how is it
split among the tranches and the sponsor promote?" It requires, at minimum:

- a **multi-period cash-flow vector** (the format today has no first-class hold-
  period cash-flow series; the web editor has a DCF surface but the core format
  stores a single stabilized year),
- **tiered rules** — return-of-capital, preferred return, an LP/GP split, one or
  more IRR or equity-multiple **hurdles**, a **catch-up**, and a residual
  **promote**, in either an American (deal-by-deal) or European (whole-fund) form,
- **crystallization and clawback** semantics across periods.

When Phase 2 is taken up, it should follow the **same state-and-verify shape**:
the document states each period's distribution by tier and the resulting LP/GP
IRRs, promote, and multiples; a `verifyWaterfall` recomputes them from the stated
tranche terms, tier definitions, and cash-flow vector. That keeps it off the calc
engine exactly as v1's sizing is. But it needs the multi-period cash-flow
primitive first, and that primitive is itself RFC-sized. **v1 must refuse** a
`capital_stack` that tries to encode distribution tiers or promote, with a typed
error pointing at `x_partnership_structure` and this section — so the boundary is
enforced, not merely described.

A likely sequencing: (1) this RFC — stack + sizing + pref return/accrual;
(2) a hold-period cash-flow RFC that gives the format a multi-period series;
(3) the waterfall RFC that states-and-verifies distributions over it. Each is
independently useful and independently reviewable.

## Compatibility analysis

- **Existing `.uw.md` / `.uwx.md` files** — none become invalid. `capital_stack`
  is new and optional; a file with only `debt_structure` behaves exactly as
  today. No existing file can contain it.
- **Tier-1 Reader** — unaffected; an unknown section renders as a block.
- **Tier-2 Editor** — additive; byte preservation is untouched.
- **Tier-3 Calc Host** — additive and, notably, **the calc engine is untouched**.
  Stack sizing is a verifier surface, not pack formulas; the ten packs keep their
  single-loan `dscr` unchanged. A host that does not implement this RFC still
  reads `debt_structure` and computes single-loan metrics; a host that does gains
  the verified stack surface.
- **Tier-4 Agent Host** — additive, with one prohibition mirroring RFC 0019's
  `allocation_pct`: an agent MUST NOT invent tranche rates, amounts, or the stated
  sizing values; they are user-supplied capital terms and lender figures.
- **Receipts (RFC 0016) / Rollups (RFC 0021)** — the stack `sizing` block is a
  natural fit for the receipt verifier: `verifyCapitalStack` is a sibling of
  `verifyRollup`, three-state, and a stack figure can be bound into a receipt like
  any other deterministic output.
- **Modules** — no manifest schema change.
- **RFC 0019** — this RFC supplies the primitive 0019 deferred. Once landed, a
  mixed-use component MAY carry a `capital_stack`, and 0019's refusal of
  component-level `debt_structure` (MU-06) relaxes to accept a component stack.
  That relaxation is a one-line follow-up to 0019, not part of this RFC.

The one behavior change to an existing surface is the generalized `CC-03`
(senior tranche ⇔ `sources_uses` senior bucket ⇔ `debt_structure`, when a stack
is present); single-loan documents see no change.

## Conformance impact

No existing fixture requires changing — `capital_stack` is additive and the
single-loan path is untouched.

New fixtures (v1):

- `capital-stack/senior-mezz-pref-verified/` — a three-tranche stack whose stated
  `coverage`, `blended_coverage`, and `debt_yield_through` all recompute equal:
  `verified`.
- `capital-stack/sizing-disagrees/` — one stated sizing value perturbed; the
  verifier returns `failed` with the `CS-*` code, not a silent pass.
- `capital-stack/pref-cash-vs-accrued/` — two documents identical but for the pref
  `accrual` mode; the `cash` one includes pref in `blended_coverage`, the
  `accrued` one excludes it, and both agree on `debt_yield_through` (balance
  counts regardless of accrual).
- `capital-stack/ab-mezz-notes/` — a stack with `mezz_a` and `mezz_b`; proves the
  array expresses what fixed slots could not.
- `capital-stack/senior-reconciles-debt-structure/` — stack `senior_debt` present
  alongside `debt_structure`; equal ⇒ accepted, mismatched ⇒ generalized `CC-03`.
- `capital-stack/no-stack-single-loan/` — no `capital_stack`; every metric equals
  the pre-RFC single-loan result (a regression pin).
- `capital-stack/reject-waterfall-in-v1/` — a `capital_stack` attempting to encode
  distribution tiers / promote; rejected with a typed error pointing at
  `x_partnership_structure` and §E (the Phase 2 boundary, enforced).

## Reference implementation

**Files affected**

- `spec/UW_FORMAT_SPEC_v1.md` — a new `capital_stack` section (tranches + sizing);
  generalize the `CC-03` consistency rule. **Normative; this is why it needs an
  RFC.**
- `spec/schemas/section-capital-stack.schema.json` (new) — the tranche array and
  the closed sizing `fn` vocabulary, modeled on `uw-rollup.schema.json`. Schema
  corpus 15 → 16.
- `packages/uwmd-core/src/capital-stack.ts` (new) — `verifyCapitalStack` (three-
  state, a sibling of `verifyRollup`), the per-tranche debt-service computation,
  and the closed sizing vocabulary; browser-safe, no I/O. Exported from
  `index.ts` and `browser.ts`.
- `packages/uwmd-core/src/validator.ts` — the generalized `CC-03`, the tranche/
  sizing structural rules, and the §E Phase-2-boundary refusal, as typed `CS-*`
  errors with `BUILTIN_REMEDIATIONS` entries.
- `packages/uwmd-core/src/packs/*.ts` — **unchanged.** Single-loan `dscr` stays;
  the stack is a separate verified surface, not a pack metric. (This corrects the
  stub, which assumed a shared pack-metric machinery that does not exist.)
- `packages/uwmd-excel/` — one debt row per tranche plus a sizing block; the
  variable tranche count is a native Excel `SUM` range, so named ranges over the
  block stay well-defined.
- `examples/` — a worked senior + mezz + pref deal whose stack foots and whose
  sizing verifies.

**API surface** — additive: a `CapitalStack` / `Tranche` type, `verifyCapitalStack`,
and the `CS-*` codes. No signature changes to existing exports.

**Test plan**

- `verifyCapitalStack` three-state coverage: `verified`, `failed`
  (`CS-SIZING-DISAGREES`), `unverifiable` (a sizing figure over a tranche field
  the document does not supply — unevaluable, never zero, per the rollup rule).
- A footing test: Σ tranche `amount` == total capitalization == `sources_uses`
  total.
- Single-loan regression: with no stack, every metric is byte-identical to 1.5.0.
- Pref cash-vs-accrued moves `blended_coverage` in exactly the expected direction
  and leaves `debt_yield_through` unchanged.
- Excel↔verifier parity to the numeric-model quantum for every sizing figure.
- The §E boundary: a waterfall-bearing `capital_stack` is refused with the typed
  code.

## Alternatives considered

1. **A1 — fixed position-keyed slots.** One typed slot per position
   (`senior`/`mezzanine`/`preferred_equity`/`common_equity`), addressed by static
   pack-formula paths. Rejected: it cannot express two mezz notes (A/B), and it
   binds sizing to the calc engine, which has no iteration — so it could never
   carry the Phase 2 waterfall and would force a second, incompatible
   representation later. State-and-verify (A2) subsumes it.
2. **A free-length tranche array read by a *new calc primitive*.** The natural
   data model, made addressable by adding iteration/aggregation to the Tier-3
   engine. Rejected on the RFC 0019 §1 / RFC 0021 reasoning: it touches the most
   safety-critical, sandboxed component in the library, its `MAX_NODES` bound, and
   the Excel emitter's static-range assumption, for a benefit state-and-verify
   already delivers with no engine change.
3. **Keep everything in `sources_uses` and just add rate fields.** Cheapest, but
   `sources_uses` is a *balancing* section (sources == uses), not a *sizing* one;
   overloading it with per-tranche terms and coverage math conflates two jobs and
   leaves the metrics homeless.
4. **Model the full waterfall now (promote, hurdles, catch-up).** In the RFC's
   vision but out of v1's build (Decision 3, §E): it requires a multi-period
   distribution engine the format does not have, and it is a larger problem than
   the debt stack it sits on. Pref return/accrual is the honest v1 stopping point;
   the waterfall is documented and sequenced, not abandoned.
5. **Do nothing; leave stacks to `x_partnership_structure`.** The status quo. It
   makes the computed DSCR silently senior-only and mislabeled — a confidently
   wrong number in exactly the deals where per-layer risk matters most.

## Unresolved questions

- **The multi-period cash-flow primitive (Phase 2 prerequisite).** The waterfall
  cannot be built until the core format has a first-class hold-period cash-flow
  series. Whether that is its own RFC (likely) or a section of the waterfall RFC
  is open. The web editor's DCF surface is a starting reference.
- **American vs European waterfall, and clawback.** A Phase 2 concern, listed so
  it is on the record: deal-by-deal vs whole-fund promote and cross-period
  clawback are materially different models and may need to be selectable.
- **Interaction with RFC 0015 portfolio relationships and RFC 0021 composites.** A
  fund-level composite over deals with their own stacks may want a rolled-up cost
  of capital; whether that rollup lives here or in 0021's receipt machinery is
  open.
- **Cross-collateralization and intercreditor terms** (standstill, cure rights)
  are documentation, not sizing math, and are almost certainly out of scope — but
  worth stating explicitly.

## Prior art

The CRE capital stack itself is the domain prior art: senior/mezz/pref/common is a
standard institutional structure, and lenders size to attachment-point debt yield
and per-tranche coverage exactly as §B describes. ARGUS and standard institutional
Excel models represent the stack as typed, position-keyed rows and the waterfall
as a period grid. On the format side, RFC 0021 §6's state-and-verify rollup
(`uw-rollup.schema.json`, `verifyRollup`) is the direct ancestor of this RFC's
`sizing` block — the same answer to the same no-iteration constraint — and
OpenAPI's discriminated unions inform typing each tranche by its `class`.
