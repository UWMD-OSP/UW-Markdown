---
rfc: 0060
title: The four tranche-class candidates — a decision, not an enum opening
status: decided
accepted: 2026-09-19
author: claude
created: 2026-09-19
depends_on:
  - 0026
  - 0033
  - 0050
affects:
  - documentation
---

# RFC 0060: The four tranche-class candidates

## Summary

The roadmap carried four proposed `capital_stack` tranche classes —
`ground_lease`, `pace`, `tax_credit_equity`, `soft_debt` — with the instruction
that if accepted they be handled "in one bounded RFC rather than four
uncoordinated changes." This RFC is that bounded change, and it **opens the enum
for none of them**.

`TrancheClass` stays exactly as RFC 0026 defined it:

```
senior_debt | mezzanine_debt | preferred_equity | common_equity
            | bridge | seller_financing | other_debt
```

This RFC defines no fields, changes no schema, and ships no code. Its deliverable
is the decision and the reasoning, so that these four stop resurfacing as
apparent roadmap debt. It is `decided` (terminal) under the "Status values"
vocabulary in the RFC index.

## What a tranche class actually buys

A class is not a label. It is the discriminator for every class-sensitive branch
in the verifier, and adding one means answering all of these deterministically —
in `@uwmd/core` **and** in the Excel emitter, identically, or invariant 4 breaks:

| Surface | Where | What the class decides |
|---|---|---|
| `DEBT_CLASSES` → `isDebtTranche` | `capital-stack.ts` | Whether the amount enters the numerator of `debt_yield_through`, `ltc_through`, `ltv_through` |
| `trancheAnnualDebtService` | `capital-stack.ts` | `common_equity` → 0; `preferred_equity` → `amount × rate` with no amortization; otherwise the amortizing annuity. Feeds `coverage` and `blended_coverage` |
| `RATE_BEARING_CLASSES` | `validator.ts` (`CS-02`) | Whether a `rate` is required |
| `common_equity` rate ban | `validator.ts` (`CS-02`) | Whether a `rate` is forbidden |
| `split` accrual | `validator.ts` (`CS-02b`, RFC 0050) | Restricted to `preferred_equity` |
| `debtServiceFormula` | `@uwmd/excel` `capital-stack.ts` | The emitted cell formula, mirroring the core branch by class name |

`weighted_cost` is the one sizing verb that is class-insensitive: it weights
every tranche that states a rate.

So the test for a new class is not "is this a recognizable financing product." It
is: **does this communicate economically material semantics that the closed
vocabulary cannot honestly state, and does it have a deterministic answer for
every row above?** A class that answers "treat it exactly like `other_debt`" is a
synonym, and `id` is already document-local and free precisely so that synonyms
need no protocol change (RFC 0026 §A).

## Decision matrix

| Candidate | Existing representation | Material information lost today | Belongs in capital stack? | Proposed treatment | Decision |
|---|---|---|---|---|---|
| `ground_lease` | `operating_statement.expenses` (ground rent, upstream of NOI) | None — and a tranche would *create* an error | **No** | Keep the obligation upstream of NOI | **DO NOT ADD — wrong conceptual layer** |
| `pace` | `other_debt` + `id: "pace"` + `position` | Nothing the verifier computes | Yes, as `other_debt` | `other_debt` | **DO NOT ADD — existing class sufficient** |
| `tax_credit_equity` | `sources_uses.sources.tax_credit_equity` + an equity tranche | The credit economics — which need mechanics this model lacks | Yes, as the equity position it is | Existing equity class | **DEFER — mechanics required** |
| `soft_debt` | `other_debt` + `rate: 0` / `accrual: "accrued"` + subordinate `position` | Residual-receipts and forgiveness — which need mechanics this model lacks | Yes, as `other_debt` | `other_debt` | **DO NOT ADD — existing class sufficient** |

## `ground_lease` — wrong conceptual layer

The roadmap's phrasing, "reserve `ground_lease` as a tranche concept," conflates
two different objects:

1. **The leasehold estate and its ground-rent obligation.** Tenure and
   encumbrance, not capital. Nobody contributed a dollar of capital to the
   leasehold borrower; the lessee owes periodic rent. That obligation already has
   an honest home **upstream of NOI**, in § 4.4
   `operating_statement.expenses`.
2. **Financing products secured by a leasehold,** and the leased-fee position
   itself. A leasehold mortgage is already `senior_debt`. The fee position
   belongs to a different party and is not in this borrower's stack at all.

Stating (1) as a tranche is not a labeling preference — it **double-counts**.
Ground rent already reduces `noi_model.net_operating_income`, which is the
numerator of every coverage and debt-yield verb. Adding the same obligation as a
debt-class balance would also inflate the denominator side of
`debt_yield_through` and the numerator of `ltc_through` / `ltv_through`. One
obligation would degrade three sizing figures at once.

There is also no honest `amount`. RFC 0026 defines `amount` as "the committed
dollar amount." A ground lease's notional would be a capitalized value of future
rent — a valuation judgment that varies with the discount rate chosen, not a
stated contribution.

**The roadmap proposal is conceptually wrong and is corrected rather than
implemented.** If a future adopter needs the leasehold *structure* expressed —
remaining term, reset dates, subordination of the fee — that is a property/tenure
contract, not a capital-stack class, and it needs its own RFC and a demonstrated
consumer.

## `pace` — `other_debt` is sufficient

PACE is debt: money advanced and repaid with interest over a term. Stated as
`class: "other_debt"`, `id: "pace"`, with `position`, `amount`, `rate`,
`term_months` and `amortization_months`, every verifier treatment is already
correct — it counts in debt yield, LTC and LTV, and its service enters coverage.

The three things that make PACE distinctive do not survive contact with a
point-in-time verifier:

- **Repayment through the property tax bill.** Genuinely material to
  underwriting, but it is a question of *where the payment sits* — in debt
  service or in the tax expense line — and the author already decides that by
  where they state it. UWMD cannot enforce a convention it has no field for, and
  the enum value would not create one.
- **Lien priority.** Varies by program and jurisdiction. `position` already
  carries the author's stated seniority, and inventing a universal priority would
  be a fiction the format cannot back.
- **The assessment running with the land.** A transfer and maturity concept; at
  one point in time it changes nothing the verifier computes.

Adding the enum value would move a name into the protocol while changing no
behavior — and would imply UWMD models the tax-bill collection mechanism, which
it does not. If an adopter later needs the tax-collected payment excluded from
`coverage` and counted as an expense instead, that is a **mechanics** change (a
field stating where the obligation is serviced), not an enum change, and it needs
its own RFC.

Note that the roadmap already lists PACE a second time, under Wave 3, as
demand-gated and requiring "a concrete engine scope and module/RFC pair." That
row was the more accurate one.

## `tax_credit_equity` — defer, mechanics required

`sources_uses.sources.tax_credit_equity` already exists and records the amount as
a funding bucket. RFC 0033 makes the distinction that decides this: the
`capital_stack` is not a list of funding sources, it is **the capitalization
contemporaneous with the NOI the sizing verbs read**. At stabilization the credit
investor holds an equity interest, which the existing equity classes state.

The class would have nothing honest to say. A credit investor's return is
delivered as tax credits, not as a rate on a balance:

- put it in `RATE_BEARING_CLASSES` and `CS-02` would demand a `rate` that does
  not exist;
- forbid the rate as with `common_equity`, and the class communicates nothing any
  sizing verb consumes — it would be a synonym for `common_equity` in every
  computation.

Everything that makes tax-credit equity *different* — pay-in installments, credit
delivery schedules, compliance periods, adjusters, recapture — is in this RFC's
explicit non-goals, and belongs to a LIHTC profile or module with its own
contract. **Those mechanics are prerequisites for the class meaning anything, so
the class defers with them.**

## `soft_debt` — `other_debt` is sufficient

The existing `Tranche` expresses more "softness" than it first appears, and this
was verified against the shipped verifier rather than assumed:

| Soft feature | How it is stated today | Verifier effect |
|---|---|---|
| Subordination | `position` below the senior | Correct attachment in every `*_through` verb |
| Zero / below-market interest | `rate: 0` | Debt service `0` when IO; straight-line when amortizing — both branches already exist in core *and* in the Excel emitter |
| Deferred payment | `accrual: "accrued"` | Debt service `0`, so it is excluded from `coverage` while still counting in `debt_yield_through` and LTC/LTV — which is the correct treatment |

What the model cannot state is residual-receipts payment, forgiveness,
subordinate-payment triggers and balloon-on-sale. Those are exactly this RFC's
non-goals. A `soft_debt` enum would therefore be **actively misleading**: it would
name a category whose defining mechanics UWMD does not model, inviting producers
to believe a residual-receipts note is being underwritten as one.

## Non-goals

This RFC deliberately does not add, and no accepted candidate would have been
permitted to add: draw schedules, tax-credit delivery schedules, recapture,
compliance-period modeling, PACE jurisdiction rules, ground-rent escalation
schedules, residual-receipts waterfalls, forgiveness logic, subordinate-payment
triggers, construction-to-permanent sequencing, new Tier-3 grammar, collection
primitives, or generalized multi-period capital-stack state.

## Compatibility

Nothing changes. No schema, no `TrancheClass`, no classification set, no sizing
function, no validator rule, no Excel emission, no conformance fixture. Every
existing document verifies exactly as before, and `other_debt`,
`preferred_equity` and `common_equity` keep their current meaning — no existing
document is reinterpreted.

## What would reopen this

Each rejection names its own reversal condition, so a future proposer has a
standard to meet rather than a preference to re-litigate:

- **`pace`** — an adopter needs the tax-collected payment treated differently
  from ordinary debt service in `coverage`. That is a mechanics RFC; the class
  would follow from it, not precede it.
- **`tax_credit_equity`** — a LIHTC profile or module specifies pay-in and credit
  delivery. The class becomes meaningful once there is something for it to key.
- **`soft_debt`** — a residual-receipts or forgiveness contract exists to key off
  the class.
- **`ground_lease`** — does not reopen as a tranche class. A leasehold/tenure
  contract is a different RFC against a different section.

In every case the mechanics come first and the class follows. A class added ahead
of its mechanics is a label that lies about what the format verifies.
