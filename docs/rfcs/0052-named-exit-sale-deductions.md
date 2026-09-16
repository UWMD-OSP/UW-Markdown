---
rfc: 0052
title: Name the deductions that turn a gross sale into net proceeds
status: implemented
accepted: 2026-09-15
author: claude
created: 2026-09-15
affects:
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0052: Named exit sale deductions

## Summary

RFC 0045 gives the disposition slot one `transaction_costs` category. Every cost
of sale — commission, transfer tax, title, legal — collapses into rows that
differ only by their author's free-text label, so no consumer can roll up
"what did the exit actually cost" across two producers.

This contract adds a closed `sale_deductions` vocabulary that names each
disposition-slot `transaction_costs` row, and a net-sale-proceeds verifier that
checks a stated net figure against gross sale less those named deductions. It
adds no new cash rows, no new economics, and no derived exit value.

## Motivation

The StackUW protocol brief asks for named exit deductions. Today an engine
emitting `-412,500` at the disposition date can say only that it is a
transaction cost. A reader cannot tell a 2.5% brokerage commission from a
municipal transfer tax, cannot compare deduction load across deals, and cannot
check a stated net-proceeds figure without re-reading prose.

Naming is also the only honest way to hold the RFC 0045 boundary. The assembly
is explicitly unlevered and pre-tax, but the deductions a seller actually pays
at closing include prepayment penalties and loan payoffs. Those are below-NOI,
levered amounts. While every deduction is anonymous, nothing stops one from
entering the unlevered stream and quietly making the candidate wrong.

## Proposed change

### 1. The vocabulary

Add a closed set of deduction names. The first six are ordinary unlevered costs
of sale:

| Name | Covers |
|---|---|
| `broker_commission` | Listing and buy-side brokerage fees. |
| `transfer_tax` | Documentary, transfer, stamp and recording taxes. |
| `title_and_escrow` | Title insurance, escrow and closing-agent fees. |
| `legal_and_closing` | Seller's legal, and closing costs not named above. |
| `seller_credits` | Credits and concessions granted to the buyer at closing. |
| `survey_and_diligence` | Seller-paid survey, environmental and diligence costs. |
| `other` | Anything else. REQUIRES a nonempty author `label` and provenance. |

`other` is a named escape hatch, not a default. It keeps the first real deal
with an unusual deduction from blocking on a spec change, while still forcing
the author to say what the amount is. An `other` row without a label refuses.

### 2. Reserved levered names

`prepayment_penalty`, `defeasance` and `loan_payoff` are reserved in the
vocabulary and **refused by this unlevered assembler**. Stating one refuses with
a message naming the basis conflict and pointing at the levered contract that
does not exist yet.

Reserving rather than omitting them does two things: it stops a later levered
RFC from colliding with a name an adopter has already used for something else,
and it turns a silent basis violation into an explicit, explained refusal. An
author who genuinely needs such an amount in a candidate stream must state it as
`other` with a label — which makes the choice visible in the evidence rather
than hidden in a generic cost row.

### 3. Binding names to rows

Add an optional `sale_deductions` member to `PropertyCashFlowPlan`:

```ts
type SaleDeductionName =
  | 'broker_commission' | 'transfer_tax' | 'title_and_escrow'
  | 'legal_and_closing' | 'seller_credits' | 'survey_and_diligence'
  | 'other'
  | 'prepayment_penalty' | 'defeasance' | 'loan_payoff'; // reserved; refused here

interface SaleDeduction {
  row: number;           // a supplemental row index covering (disposition, transaction_costs)
  name: SaleDeductionName;
  label?: string;        // required when name is 'other'
}
```

When `sale_deductions` is present it MUST name **every** row bound to the
`(disposition, transaction_costs)` cell, exactly once. A partial naming refuses:
a rollup over some of the deductions is worse than no rollup, because it looks
complete. Naming a row that the cell does not cover refuses. Duplicate rows
refuse. Omitting `sale_deductions` entirely remains valid and preserves today's
behavior.

Names carry no sign rule of their own; the existing rule that
`transaction_costs` rows are nonpositive already governs, `seller_credits`
included. Nothing about a name changes an amount, a date or a row's place in the
series. Each deduction remains its own dated §4.26 row.

### 4. Net sale proceeds

Add an optional `net_sale_proceeds` to the plan: a stated amount the assembler
verifies rather than derives.

Verification is `sum(gross_sale rows) + sum(transaction_costs rows)` at the
disposition slot. Both sides quantize at the §VIII.9.4 currency quantum — the
existing `CASH_FLOW_VERIFY_DECIMALS.currency`, two decimals — before comparison,
which is the §VIII.5 posture the cash-flow verifier already takes. Deduction
rows are nonpositive, so the sum is a subtraction. A mismatch refuses with both
figures in the message.

The verifier deliberately spans the whole `transaction_costs` cell, not only the
named rows, so it cannot be satisfied by leaving a deduction unnamed. It does
not touch `reserve_net`: a returned reserve is not sale proceeds, and RFC 0045
already requires gross sale to exclude it.

Stating `net_sale_proceeds` without a `gross_sale` row refuses. Omitting it
leaves the result's verification status `not_stated`, exactly as the existing
supplemental-metric evidence does.

### 5. Result evidence

`PropertyCashFlowAssembly` gains:

```ts
sale_deductions?: Array<{
  output_row_index: number;
  name: SaleDeductionName;
  label?: string;
  amount: number;
}>;
net_sale_proceeds: { status: 'verified'; stated: number; computed: number }
                 | { status: 'not_stated' };
```

`sale_deductions` is present only when the plan named them. As everywhere else
in RFC 0045, this is evidence about stated amounts, not proof that the
deductions are complete or that the exit is real.

### 6. Refusals

Extend the `PropertyCashFlowAssemblyIssue` reason enum with `sale_deduction`.
It covers partial or duplicate naming, a named row outside the cell, `other`
without a label, a reserved levered name, and a failed net-proceeds check.
Existing reasons are unchanged.

## Compatibility

Purely additive and opt-in. `sale_deductions` and `net_sale_proceeds` are
optional; a plan omitting both behaves exactly as it does today, and every
existing fixture stays valid. The reason-enum extension widens a union that only
appears in refusals. No released behavior changes, so this is a Protocol minor.

## Out of scope

Deriving net proceeds from a cap rate or NOI; any levered exit treatment;
capital-gains or depreciation-recapture tax; deduction-to-payee mapping;
percentage-stated deductions (RFC 0045 already requires stated cash payments,
not recomputed percentages); and acquisition-slot cost naming, which deserves
its own vocabulary decision rather than a mirrored guess.

## Conformance

- A positive case naming six deduction kinds with a verified net-proceeds figure.
- `other` with a label passes; `other` without one refuses.
- A partial naming refuses; a duplicate row refuses; an out-of-cell row refuses.
- Each reserved levered name refuses with the basis message.
- A net-proceeds figure off by one minor unit refuses at the currency quantum.
- An existing RFC 0045 fixture with neither member continues to pass unchanged.
