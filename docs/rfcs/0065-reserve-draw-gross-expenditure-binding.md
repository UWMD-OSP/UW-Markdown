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
draw activity. Draft RFC 0064 can verify custody balances but cannot say
**which draw funded which already-stated gross expenditure**. No private deal
values, identities or paths belong in public fixtures.

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

## Proposed narrow layer, pending owner decisions

A **read-only, document-digested binding plan** should name a reserve movement
and a pre-existing gross expenditure cell or row, state the funded magnitude,
and return item-level evidence. It would not create a second expense, change
the expenditure's authored gross amount, modify a §4.26 source row, or alter
RFC 0045 eligibility in this RFC. The proposed verifier would be a Protocol
companion to the RFC 0064 carrier, whichever carrier the owner chooses. No
calc grammar, collection primitive, AI calculation, Excel formula or implicit
date/amount matching is proposed.

Candidate reference shape, **not yet normative**:

```ts
interface ReserveExpenditureBinding {
  reserve: {
    carrier: 'reserve_accounts' | 'x_...'; // fixed after RFC 0064 decision
    account_id: string;
    statement_index: number;
    movement_index: number;
  };
  expenditure:
    | { source_section: 'lease_up_schedule'; variant: string;
        period: string; cell: 'ti_lc' }
    | { source_section: 'cash_flow_series'; variant: string;
        row_index: number; category: 'other_capex' | 'operating_expenses' };
  funded_amount: number; // positive stated magnitude; partial funding explicit
}
```

The binding plan would carry the canonical source envelope digest and explicit
source variant. Indices are addresses into that immutable snapshot, as in RFC
0045; an edit invalidates the digest. An `account_id` alone is insufficient
because one account has many draws. An equal amount, label or same date is
never a binding. A lease-up `ti_lc` cell is a gross period component, even
though RFC 0044 emits a bundled cash row; a plan cannot pretend the whole
bundle is only TI/LC. Other gross expenditure categories need named source
cells or separately stated supplemental rows; an undifferentiated total
refuses. The final reference shape depends on RFC 0064's carrier decision and
on confirming exact source path/variant representation.

## Proposed verification limits

- Referenced movement must exist, be a `draw`, and belong to a verified
  property reserve statement. A lender reserve refuses. Referenced expenditure
  must exist as a gross, signed expenditure in the digested source snapshot;
  the verifier must preserve its amount, date, category and source identity.
- `funded_amount` must be finite and positive at the established currency
  quantum. Every draw and expenditure may have multiple explicit edges, but
  duplicate identical edges refuse. The sum of edges from a draw must equal
  the stated draw if the plan claims complete allocation; the sum into an
  expenditure cannot exceed its gross magnitude. Missing references, stale
  digests, mismatched currency, duplicate use, overbinding, unbound portions
  claimed complete, and sign/category mismatches refuse with source pointers.
  Whether partial allocation may remain intentionally unbound needs an
  explicit completeness flag or an all-or-nothing first scope; no default.
- Preserve the gross expenditure and the draw separately in evidence. The
  edge proves funding identity only; it never subtracts the draw from the
  expenditure, adds it as a second expense, or synthesizes owner cash.
- Source block `_meta` remains host-owned and append-only. The plan/result
  carry document digest, canonical paths, authored dates and amounts; source
  identities are not rewritten or merged.
- Absence is inert: documents and RFC 0045 plans without this binding retain
  their current behavior, including reserve refusals. A valid binding alone
  does not change `reserve_spending_excluded` or prove whole-plan completeness.

## Cash boundary to settle before any assembly change

RFC 0045 already states a broad owner-cash rule: funding a restricted property
reserve is an outflow; release to the owner is an inflow; spending inside a
funded reserve is not another owner outflow. That rule covers acquisition
contributions, periodic contributions, internal draws and disposition releases
at the transfer level. It also requires gross sale to exclude returned
reserves and no restricted balance after disposition. RFC 0064's proposed
statement records custody, not the §4.26 `reserve_net` owner transfer.

What remains **unsettled** is the output representation when the gross
expenditure is in a cash-flow source that RFC 0045 would otherwise copy into
its owner-cash series. The standard does not yet specify whether a successor
must produce a separate gross-economic ledger and owner-cash series, or a
single dated series with explicitly paired, non-expense funding offsets. It
also does not establish how to prove each acquisition contribution, periodic
contribution and disposition release is the same transfer as one §4.26
`reserve_net` row, or how mixed owner/property custody is classified. Guessing
these would double-count owner cash or hide gross cost. **Owner decision is
required before drafting the assembly effect or changing RFC 0045.** This RFC
can be reviewed as a binding-only verifier, but it cannot claim the Golden
Deal has become assembly-eligible.

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
cell; a partial draw with explicit split edges; a supplemental `other_capex`
row; same-day distinct gross rows under RFC 0062; a final-boundary case under
RFC 0063; missing/stale account, movement and expenditure references; duplicate
edge; amount and currency mismatch; overbinding; unbound remainder; lender
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

## Decisions before acceptance

1. RFC 0064 carrier: standard §4.28 or `x_*` companion profile.
2. Whether the first verifier requires full allocation of each draw and permits
   split/partial funding; the Golden Deal evidence does not decide a universal
   completeness policy.
3. The later owner-cash output treatment and transfer-to-`reserve_net`
   evidence, before any RFC 0045 successor changes assembly behavior.
