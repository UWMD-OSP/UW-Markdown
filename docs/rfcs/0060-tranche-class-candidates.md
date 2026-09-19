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
| `ground_lease` | Dollars only, as a generic operating expense / NOI inclusion. No typed object | **Identity and tenure mechanics**: ground rent as a named line, remaining term, resets, extension options, the fee/leasehold relationship, subordination | **No** | Keep the payment upstream of NOI; the structure needs a tenure contract | **DO NOT ADD — wrong conceptual layer** |
| `pace` | `other_debt` + `id: "pace"` + `position` | Assessment-specific servicing: whether the obligation is serviced above or below NOI, jurisdictional lien behaviour, transferability | Yes, where it is underwritten as a debt-service-bearing tranche | `other_debt` where the existing fields suffice | **DO NOT ADD ENUM — defer PACE-specific mechanics** |
| `tax_credit_equity` | `sources_uses.sources.tax_credit_equity` + an equity tranche | The credit economics — pay-in, delivery, compliance, adjusters, recapture | Yes, as the equity position it is | Existing equity class | **DEFER — mechanics required** |
| `soft_debt` | `other_debt` + `rate: 0` / `accrual: "accrued"` + subordinate `position` | Residual-receipts and contingent payment, forgiveness, maturity forgiveness, accrued-balance rollforward | Yes, for the subset reducible to the existing fields | `other_debt` for that subset | **DO NOT ADD ENUM — specialized mechanics deferred** |

Each row's "material information lost" is lost **whether or not** the enum
opens — naming a tranche does not model mechanics. That is the point: the enum
is not the instrument that would recover any of it.

## `ground_lease` — wrong conceptual layer

The roadmap's phrasing, "reserve `ground_lease` as a tranche concept," conflates
two different objects:

1. **The leasehold estate and its ground-rent obligation.** Tenure and
   encumbrance, not capital. Nobody contributed a dollar of capital to the
   leasehold borrower; the lessee owes periodic rent.
2. **Financing products secured by a leasehold,** and the leased-fee position
   itself. A leasehold mortgage is already `senior_debt`. The fee position
   belongs to a different party and is not in this borrower's stack at all.

A tranche is the wrong instrument for (1). `amount`, `rate`, `accrual`,
`position` and the amortization fields describe a capital layer with a balance
and a return; a ground lease has neither. There is also no honest `amount` to
state: RFC 0026 defines it as "the committed dollar amount," and a ground
lease's notional would be a capitalized value of future rent — a valuation
judgment that moves with the discount rate chosen, not a stated contribution.

And **when** the underwriting does include ground rent in operating expenses,
adding the same obligation as a debt-class tranche would double-count it: the
payment would reduce `noi_model.net_operating_income` — the numerator of every
coverage and debt-yield verb — while the invented balance also entered
`debt_yield_through`, `ltc_through` and `ltv_through`. Whether that inclusion
happened is the author's doing; the format does not compel it, which is exactly
the next point.

### What the format does *not* represent today

Nothing in this decision should be read as "ground leases are already modelled."
They are not, and the gap is wider than a missing enum value:

- **§ 4.4 `operating_statement.expenses`** has no `ground_rent` key. A historical
  payment can only be folded into the generic `other_expenses`.
- **§ 4.5 `noi_model.expenses`** — the underwritten expense set every sizing verb
  ultimately divides — has no `ground_rent` key **and no generic bucket at all**.
  Its keys are a fixed named list (taxes, insurance, management fees, payroll,
  utilities, repairs, contract services, marketing, administrative, professional
  fees, replacement reserves).
- No section anywhere in the format types the leasehold as an object.

So the dollars may be reflected in NOI, at the author's discretion and without a
named line, but **the identity and economics of a ground lease are not preserved
as a typed underwriting object.** Remaining term, rent resets and escalations,
extension options, the fee/leasehold relationship and subordination of the fee
are all absent.

That is a real gap. It is simply not a gap a tranche class would close — the
`Tranche` shape has no field for any of it. The correct future home is a
**demand-gated property/tenure or ground-lease contract against its own
section**, with its own RFC and a demonstrated consumer. **The roadmap's
"reserve `ground_lease` as a tranche concept" framing is corrected rather than
implemented**; the underlying underwriting need is preserved as tenure work, not
retired.

## `pace` — no enum; PACE-specific mechanics deferred

Two questions, and they have different answers.

**The enum question: no new class is needed.** PACE is debt — money advanced and
repaid with interest over a term. Where the underwriting treats the obligation as
a debt-service-bearing tranche whose terms are expressible by the existing
fields, `class: "other_debt"` with `id: "pace"`, `position`, `amount`, `rate`,
`term_months` and `amortization_months` is an **honest** representation: it
counts in debt yield, LTC and LTV, and its service enters coverage, which is what
that underwriting means. A dedicated enum value would change no verifier branch.

**The mechanics question: not everything about PACE is modelled.** These remain
outside the format, and `other_debt` does not represent them:

- **Assessment-specific servicing** — whether the obligation is serviced above or
  below NOI. Collected on the property tax bill, a PACE payment may belong in the
  tax expense line rather than in debt service, and that choice materially
  changes coverage. The author decides it today by where they state the payment;
  the format has no field that records or enforces the choice.
- **Jurisdictional lien behaviour.** Varies by program. `position` carries **the
  author's stated seniority and nothing more** — it must not be read as asserting
  a lien priority, and this RFC does not infer one from it. Inventing a universal
  priority would be a fiction the format cannot back.
- **Transferability** — the assessment running with the land on sale.

None of that is recovered by naming the tranche. Adding the enum value would move
a name into the protocol while changing no behaviour, and would imply UWMD models
the assessment mechanism, which it does not. If an adopter needs any of the
above, it is a **mechanics contract** — a field stating where the obligation is
serviced, and what else travels with it — with its own RFC and demonstrated
consumer. The class, if it were ever warranted, would follow that work rather
than precede it.

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

## `soft_debt` — no enum; specialized mechanics deferred

Again two questions. **The enum question: no.** A class should not be added
merely to label a financing source. **The mechanics question: UWMD models the
simple subset only**, and this section is careful not to claim more.

The subset `other_debt` represents honestly is the one whose terms reduce to
`amount`, `rate`, `accrual`, `position`, `amortization_months`, `io_months` and
`term_months`. Within that subset the existing shape expresses more "softness"
than it first appears — verified against the shipped verifier rather than
assumed:

| Soft feature | How it is stated today | Verifier effect |
|---|---|---|
| Subordination | `position` below the senior | Correct attachment in every `*_through` verb |
| Zero / below-market interest | `rate: 0` | Debt service `0` when IO; straight-line when amortizing — both branches already exist in core *and* in the Excel emitter |
| Deferred payment | `accrual: "accrued"` | Debt service `0`, so it is excluded from `coverage` while still counting in `debt_yield_through` and LTC/LTV — which is the correct treatment |

Outside that subset, the model states nothing: **residual-receipts and other
contingent payment, forgiveness, maturity forgiveness, accrued-balance
rollforward, subordinate-payment triggers and balloon-on-sale**. Naming the
tranche `other_debt` does not represent any of them, and neither would naming it
`soft_debt` — that is the whole point. An enum value would be **actively
misleading**: it would name a category whose defining mechanics UWMD does not
model, inviting producers to believe a residual-receipts note is being
underwritten as one.

So: `other_debt` for the simple subset, and the specialized mechanics stay
deferred as their own contract with a demonstrated consumer. **This RFC does not
claim UWMD models soft debt.**

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

## Scope of this decision, and what it preserves

**This RFC closes the enum-opening question only.** It does not declare any of
these underwriting domains completely modelled, and it must not be cited as
having done so.

The tranche-class item is closed and should not reopen. The genuine underwriting
needs behind it survive as **mechanics, profile and tenure work** — demand-gated,
each needing its own RFC and a demonstrated consumer:

| Preserved as | Why it is not tranche-class debt |
|---|---|
| **Ground-lease / leasehold tenure contract** | Ground rent has no named line in § 4.4 and no line *or* generic bucket in § 4.5; term, resets, options, fee relationship and subordination are untyped. A `Tranche` has no field for any of it. |
| **PACE-specific mechanics** | Assessment servicing above or below NOI, jurisdictional lien behaviour, transferability. A mechanics contract, not a label. |
| **Soft-debt contingent / forgiveness mechanics** | Residual receipts, contingent payment, forgiveness, maturity forgiveness, accrued-balance rollforward. |
| **Tax-credit equity profile / mechanics** | Pay-in installments, credit delivery, compliance period, adjusters, recapture. |

In every case the mechanics come first and a class, if ever warranted, follows.
A class added ahead of its mechanics is a label that lies about what the format
verifies — which is the failure this RFC exists to prevent, in both directions:
neither adding an empty class, nor pretending the absent mechanics are present.
