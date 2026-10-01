---
rfc: 0065
title: Bind a stated reserve draw to an already-stated gross expenditure
status: draft
author: codex
created: 2026-09-29
depends_on:
  - 0045
  - 0062
  - 0063
  - 0064
affects:
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0065: Bind reserve draws to gross expenditure (draft)

## Demonstrated consumer and missing semantic

The [completed Golden Deal review](../reviews/2026-09-24-completed-golden-corpus-validation.md)
found a reserve-dependent monthly source that still correctly refuses RFC
0045's `reserve_spending_excluded` assertion after the RFC 0063 final-boundary
option. It has gross TI/LC or applicable capital/expense spending and reserve
draw activity. Draft RFC 0064 proposes a verifier for custody balances. Even
once accepted and implemented, that verifier would not say **which draw
funded which already-stated gross expenditure**. No private deal values,
identities or paths belong in public fixtures.

**What this RFC relies on, and what it does not.**

- **Relied on:** the RFC 0064 statement carrier, a direct, RFC-created
  standard `reserve_accounts` section (Format §4.28). The owner selected it on
  2026-09-29; the decision record is
  `docs/reviews/2026-09-29-rfc-0064-owner-review.md`.
- **Not settled by that decision:**
  - RFC 0064 is still `draft`: not accepted, not implemented, and not part of
    the 2.14.0 release candidate.
  - No reserve-account section, schema or verifier exists on released or
    canonical `main`.
  - RFC 0045's `reserve_spending_excluded` refusal is unchanged.

This RFC cannot be implemented before RFC 0064 is accepted and its section
exists.

This is a different relationship from RFC 0045's existing bindings. Its
`coverage` maps a supplemental §4.26 row to one `(slot, category)` and its
result `bindings` trace an output row to a §4.25/§4.26 source path. Neither
names an account movement or an expenditure funding source. §4.26
`reserve_net` is the owner-side transfer row, not a draw/expenditure edge.
Source IDs and `_meta` establish provenance; matching sources do not prove two
amounts are the same economic event. RFC 0056 escrows state funding without a
draw ledger, and RFC 0057's renovation `drawn_to_date` is a budget-to-date
fact, not a reserve-account movement. Thus an additive protocol binding and
verifier are needed; no existing reference honestly expresses this edge.

## Proposed narrow layer

A **read-only, document-digested binding plan** should name a reserve movement
and a pre-existing gross expenditure cell or row, state the funded magnitude,
and return item-level evidence. It would not create a second expense, change
the expenditure's authored gross amount, modify a §4.26 source row, or alter
RFC 0045 eligibility in this RFC. The proposed verifier is a Protocol
companion to RFC 0064's owner-selected standard §4.28 `reserve_accounts`
carrier. No calc grammar, collection primitive, AI calculation, Excel formula
or implicit date/amount matching is proposed.

Candidate reference shape, **not yet normative**:

```ts
interface ReserveExpenditureBinding {
  reserve: {
    carrier: 'reserve_accounts';
    account_id: string;
    statement_index: number;
    movement_index: number;
  };
  expenditure:
    | { source_section: 'lease_up_schedule'; variant: string;
        period: string; cell: 'ti_lc_capex' }
    | { source_section: 'cash_flow_series'; variant: string;
        row_index: number; category: 'other_capex' | 'operating_expenses' };
  funded_amount: number; // positive stated magnitude; partial funding explicit
}
```

The `reserve` address presumes the `accounts[].statements[].movements[]` shape
proposed on PR #219. RFC 0064 has not settled its field shape, so this address
moves with it.

The lease-up address names the §4.25 schedule field `ti_lc_capex`. It is stated
negative, and RFC 0045 assigns it to that period's `ti_lc` coverage cell. A
§4.26 row has no category field: `category` names the RFC 0045 coverage cell
the plan assigns that row to, and the verifier must check it against that
coverage.

The binding plan must declare the selected draws and an auditable completeness
scope: **every selected draw is fully allocated** through explicit edges. This
does not assert that the external source omitted no other account or movement.
It must carry the canonical document/source digest and explicit source variant.
Indices are addresses into that immutable snapshot, as in RFC 0045; an edit
invalidates the digest. An `account_id` alone is insufficient
because one account has many draws. An equal amount, label or same date is
never a binding. A lease-up `ti_lc` cell is a gross period component, even
though RFC 0044 emits a bundled cash row; a plan cannot pretend the whole
bundle is only TI/LC; the binding addresses the `ti_lc_capex` component, never
the bundled row. Other gross expenditure categories need named source
cells or separately stated supplemental rows; an undifferentiated total
refuses. The final reference shape still needs exact source path/variant
representation pinned before acceptance.

## Proposed verification limits

- Referenced movement must exist, be a `draw`, and belong to a property
  reserve statement that verifies under RFC 0064's verifier. That verifier does
  not exist until RFC 0064 is accepted and implemented. A lender reserve
  refuses. Referenced expenditure
  must exist as a gross, signed expenditure in the digested source snapshot;
  the verifier must preserve its gross amount, authored date, category, currency,
  exact source identity and provenance.
- `funded_amount` must be finite and positive at the established currency
  quantum. A draw may fund multiple expenditures, and an expenditure may
  receive multiple draws. Duplicate identical edges refuse. For **every
  selected draw**, the sum of its binding edges must equal the stated draw;
  no unallocated remainder is allowed in the first verifier scope. The sum
  of reserve funding into one expenditure must not exceed the absolute gross
  expenditure. An expenditure may be partially funded when explicitly stated;
  the unfunded remainder is retained for a later owner-cash contract. Missing
  references, stale digests, mismatched currency, duplicate use, overbinding,
  incomplete selected draws, and sign/category mismatches refuse with source
  pointers.
- Preserve the gross expenditure and the draw separately in evidence. The
  edge proves funding identity only; it never changes the gross source amount,
  subtracts the draw from the expenditure, adds it as a second expense, or
  synthesizes owner cash. Result evidence must retain the explicit funded
  amount, document/source digest, exact source identity, currency, authored
  date and provenance.
- Source block `_meta` remains host-owned and append-only. The plan/result
  carry document digest, canonical paths, authored dates and amounts; source
  identities are not rewritten or merged.
- Absence is inert: documents and RFC 0045 plans without this binding retain
  their current behavior, including reserve refusals. A valid binding alone
  does not change `reserve_spending_excluded` or prove whole-plan completeness.

## Separate verification and assembly boundaries

RFC 0045 already states the owner-cash transfer rule normatively, in Protocol
§VIII.9.6.4 ("Reserve treatment and limits of double-count checks"):

- funding a restricted reserve is an owner outflow;
- releasing cash to the owner is an owner inflow;
- `reserve_net` carries those external transfers;
- spending inside the funded reserve is not another owner outflow.

That rule covers acquisition contributions, periodic contributions, internal
draws and disposition releases at the transfer level. RFC 0045 also requires
gross sale to exclude returned reserves and no restricted balance to remain
after disposition. This RFC changes none of it.

RFC 0064's proposed statement records custody, not the §4.26 `reserve_net`
owner transfer.

1. **This RFC: draw-to-gross-expenditure verification.** Bind each selected
   internal draw to one or more existing gross expenditures, with complete
   allocation of that draw and an explicit funded share of each expenditure.
   Verification does not create owner-cash rows or change RFC 0045.
2. **Separate external-transfer verification.** Every external contribution
   from the owner or release to the owner used for future assembly eligibility
   must be explicitly bound to its applicable §4.26 `reserve_net` row. Date,
   label, equal amount or shared provenance cannot substitute for an edge.
   This relationship is distinct from a draw/expenditure edge and is not
   verified by the first binding scope.
3. **Later RFC 0045 successor: owner-cash assembly.** Owner cash records cash
   crossing the owner/property boundary.
   - Owner contributions are outflows; releases to the owner are inflows.
   - A reserve draw is internal custody. It is neither an owner receipt nor a
     second expense.
   - Gross expenditure remains gross in source and audit evidence.
   - No assembler may add a positive "reserve draw offset" row to cancel that
     expenditure in owner cash.

   This draft proposes, for that later contract, that the reserve-funded
   expenditure's incremental owner-cash effect is the explicitly unfunded
   remainder: zero when fully reserve-funded, the remainder when partially
   funded. That later contract must pin representation and non-overlap checks
   before changing admission.
4. **Separate financing assembly.** Debt proceeds, interest, principal, fees,
   payoff and lender-held reserves belong to a separate financing-assembly
   contract (see the design brief
   `docs/reviews/2026-09-29-financing-assembly-owner-brief.md`).
   A `lender_reserve` is outside RFC 0064's property-reserve contract and is
   refused here.

Complete allocation of selected draws is an auditable scope declaration, not
proof that the external source omitted nothing. Even a verifying binding plan
does not make the Golden Deal assembly-eligible while RFC 0045 still refuses
reserve-dependent spending and external transfers lack their own binding.

## Timing and compatibility

RFC 0062 permits separate same-day §4.26 rows; bindings must use source row
identity, never date equality, and must not collapse same-day movements.
RFC 0063 admits only the explicit final monthly/quarterly exclusive boundary;
the binding does not extend that horizon, turn a later release into sale
proceeds, or infer a post-sale interval. A draw on a final boundary must still
resolve to an eligible stated gross expenditure and pass ordinary date rules.
Acquisition funding and disposition release remain separate from internal
draws. RFC 0045's existing refusal and gross-sale assertions remain intact
until a later, separately accepted assembly contract has complete evidence.

## Public synthetic conformance plan

Use invented accounts and amounts only: one draw fully funding one gross TI/LC
cell; one draw split across expenditures; multiple draws funding one expenditure;
a partially funded expenditure with complete allocation of each selected draw;
a supplemental `other_capex`
row; same-day distinct gross rows under RFC 0062; a final-boundary case under
RFC 0063; missing/stale account, movement and expenditure references; duplicate
edge; amount and currency mismatch; overbinding; unbound selected draw; lender
reserve refusal; absent plan compatibility; and a valid binding that still
does **not** cure RFC 0045's `reserve_spending_excluded` refusal. Pin source
digest, source path, gross amount and movement identity in each result.

## Rejected alternatives

| Alternative | Why rejected |
|---|---|
| Match draw to spend by date, label or equal amount | Coincidence is not an auditable relationship; same-day rows are legal. |
| Net draw against gross TI/LC, capex or expense | Erases gross economics and can double-count or hide owner cash. |
| Treat draw as a second negative §4.26 row | Counts one expenditure twice. |
| Treat `reserve_net` as the draw | It records external owner transfers, not internal account use. |
| Use `_meta.source_id` equality | Shared provenance is not a funding allocation and would rewrite source meaning. |
| Relax RFC 0045 immediately | A binding alone does not prove owner-cash transfers or whole-plan non-overlap. |

## Decisions and work remaining before acceptance

RFC 0065 remains `draft` and binding-only.

| Item | Source | State |
|---|---|---|
| Standard `reserve_accounts` §4.28 carrier | Owner decision, 2026-09-29, recorded for RFC 0064 | Decided for RFC 0064's carrier only. RFC 0064 itself is not accepted. |
| Owner-cash transfer rule (contribution out, release in, internal spending not another outflow) | Protocol §VIII.9.6.4 (RFC 0045) | Existing normative contract. Unchanged here. |
| Every selected draw fully allocated | This draft | Proposal. |
| Many-to-many draw/expenditure edges | This draft | Proposal. |
| Explicit partial funding of a gross expenditure | This draft | Proposal. |
| External contributions and releases bound to `reserve_net` in a separate contract | This draft | Proposal. |
| Unfunded remainder as the later owner-cash effect; no positive draw-offset row | This draft | Proposal for the later contract. |

Still open before acceptance:

- RFC 0064's acceptance and field shape, which the `reserve` address depends
  on;
- the exact source address representation;
- the completeness declaration;
- the refusal and result schema.

External-transfer verification, owner-cash assembly, financing assembly and any
RFC 0045 admission change each require their own explicit contract.
