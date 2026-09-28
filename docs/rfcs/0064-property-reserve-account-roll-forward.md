---
rfc: 0064
title: Verify property reserve-account roll-forwards without netting expenditure
status: draft
author: codex
created: 2026-09-27
affects:
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0064: Verify property reserve-account roll-forwards without netting expenditure

## Summary

Propose a separately invoked, deterministic verifier for **property** reserve
account state: an identified account's opening balance, outside funding,
draws used to pay gross property expenditure, cash returned to the owner, and
ending balance by stated period. The account statement is evidence about cash
custody. It is not another economic expenditure ledger and does not make a
reserve-dependent RFC 0045 assembly plan eligible by itself. This is a draft
design for owner review; no normative text, schema, code, package version or
conformance baseline changes are authorized by this RFC's presence.

## Motivation and demonstrated consumer

The [completed Golden Deal review](../reviews/2026-09-24-completed-golden-corpus-validation.md)
identifies acquisition funding, periodic contributions, draws, releases and
ending balances in the covered-land and development sources. It distinguishes
these property account movements from replacement-reserve deductions in annual
NOI and from lender financing reserves. These are requirements observations,
not public fixture data or proof of a universal account model.

RFC 0045 / Protocol §VIII.9.6 covers `reserve_net` at acquisition, every
operating period and disposition, but requires
`reserve_spending_excluded`, `gross_sale_excludes_reserve_release` and
`no_terminal_restricted_reserve`. Its first scope refuses reserve-funded work
also counted in TI/LC, capex or expense cash. The [RFC 0063 implementation
record](../reviews/2026-09-24-rfc-0063-implementation.md) proves the monthly
timing-only case assembles with explicit boundary opt-in, while the separate
reserve-dependent case still refuses at
`plan.assertions.reserve_spending_excluded`. A verifier for account state is
the demonstrated next consumer. It must not turn that refusal into success by
silently netting gross expenditure against a reserve draw.

RFC 0056 / Format §4.8 types `sources_uses.uses.escrows` as `upfront` and
`monthly` funding declarations. It explicitly excludes escrow roll-forward;
those two fields do not identify actual account balances, draw dates or cash
returned. RFC 0057's renovation draw is a budget-to-date fact, not a custodial
account statement. Operating-statement or NOI replacement reserves can be an
expense or underwriting deduction without being cash held in this account.

## Proposed layer and scope

The proposed first layer is an **opt-in Protocol companion verification** of
an explicitly selected, attributable property-account statement. It should
not immediately add a 22nd standard Format section. Format §C.7 requires an
extension pattern across at least five distinct deals and three examples to
promote it; this review establishes two source roles, not that threshold. A
producer may preserve source facts in an `x_*` extension now. Tier-1 parsing and
ordinary document validation continue to preserve and skip such extensions
under Format §4.20. The new verifier would check only a caller-selected
statement/profile, and would return a source digest and item-level evidence.
Its exact extension carrier and public API name remain for owner acceptance.

The candidate profile MUST represent, without inferred defaults:

| Fact | Required meaning in this proposal |
|---|---|
| Account identity and class | Stable author-stated `account_id`, an explicit **property reserve** class, stated purpose, currency and source provenance. Lender-held financing reserves are outside this profile. |
| Period identity | A real opening and closing date or a registered monthly/quarterly identity with unambiguous calendar bounds. Preserve authored dates; do not derive cash dates from period position. |
| Opening balance | Cash held in this account at the period start. For consecutive statements of one account, the prior ending balance must agree with the next opening balance. |
| External contribution | Cash entering from outside the restricted account. Its source and economic owner must be explicit before any property-cash interpretation. |
| Internal draw | Cash leaving the account to fund a separately represented **gross** TI/LC, capex or other economic expenditure. The draw is account movement; the gross expenditure remains gross. |
| External release | Cash leaving the account and returned to the owner, separately from gross sale proceeds. |
| Ending balance | Stated cash held at period end, verified from the opening balance and movements. It is not silently computed as an authored fact. |

Amounts in the account profile are nonnegative magnitudes with a stated
movement kind. Account identity, period identity and movement order are
preserved. A statement must identify whether each movement crosses the owner
boundary or only transfers within account/property custody; a label or
`sources_uses.uses.escrows.monthly` alone cannot decide that. Unknown kinds,
ambiguous ownership, a financing reserve, or an unsupported movement such as
interest credited by the bank must refuse this first verifier rather than be
forced into a contribution, draw or release.

## Deterministic semantics and gross economics

For each account and stated period, the proposed balance identity is:

`ending = opening + external contributions - internal draws - external releases`.

The verifier MUST add every stated movement exactly once, compare the result
to the stated ending balance using the existing monetary quantum and §VIII.5
binary64/half-away-from-zero reporting rule, and report a typed mismatch with
account/period/source pointers. It MUST check finite nonnegative amounts, real
dates, unique account/period identities, ordered periods, and consecutive
opening/ending continuity where the source claims consecutive statements. It
MUST NOT create missing periods, infer zero movements, project a future draw,
derive an exit release, or treat a balance identity as proof of source
completeness. The owner must settle the exact comparison point and tolerance
before this rule becomes normative; no precision rule is changed in this draft.

The verifier reports account state separately from an economic cash stream.
A reserve-funded expenditure of $X remains a **gross $X** TI/LC, capex or
other applicable expense in its economic source. Its account draw is a funding
link, not another $X expense and not an offset that reduces the gross source.
Contributions and releases must not also be counted as investor/property cash
without a separately specified boundary mapping. A future assembler contract
must bind gross expenditure rows to account draws, and choose one auditable
owner-cash treatment before it can relax RFC 0045's
`reserve_spending_excluded` assertion. RFC 0045 coverage and refusal behavior
remain unchanged under this proposal; a verified roll-forward alone is not a
`declared_complete` assembly.

## Compatibility and absent behavior

This is additive and opt-in. Existing `.uw.md`/`.uwx.md` files, all four host
tiers, modules, RFC 0045 plans, `cash_flow_series` rows and metrics keep their
current behavior. Absent account data makes no account-state claim and emits no
synthetic zero or new document-validation diagnostic. Legacy `reserve_net`
rows retain their existing external-transfer meaning. Ordinary `x_*` blocks
remain parseable and are not promoted into standard sections by this RFC.
Neither the RFC 0062 same-day selector policy nor the RFC 0063 exact boundary
opt-in is changed. A later accepted implementation would need a Protocol minor
version and synchronized protocol/runtime/schema/conformance changes wherever
its final public API has a wire shape; this draft does not choose that version.

## Conformance impact

Implementation would add synthetic, de-identified fixtures with no private
workbook values or identities:

1. A one-account two-period statement with acquisition funding, contribution,
   gross capex funded by a draw, an owner release and matching ending balances.
   Verify the gross capex row is preserved at its full amount and the account
   movement is reported separately.
2. A mismatch in the arithmetic identity, a negative movement, duplicate
   account/period, invalid date and broken interperiod continuity, each with
   typed pointers and stable refusal order.
3. An ambiguous movement and an explicitly lender-held reserve, each refused
   rather than reclassified by labels.
4. Absent account data and a legacy RFC 0045 plan retain exact prior results.
   The reserve-dependent RFC 0045 plan still refuses even if its account
   statement verifies.
5. Same-day gross expenditure and account draw retain separate source rows;
   RFC 0062's selector ambiguity rules remain intact. RFC 0063's boundary
   option changes no account balance or reserve refusal.

Golden Deal evidence remains private and can be used only as a requirement
cross-check. Public conformance uses independently authored synthetic values.

## Reference implementation plan

After acceptance, define a closed candidate statement/schema and a typed
verifier/result in `@uwmd/core` with browser-safe exports and a read-only CLI
entry. Keep deterministic arithmetic in core; AI may extract, classify or
narrate evidence but never reconcile balances. Add focused unit tests and
conformance, then update Protocol prose, executable types, any schema and
documentation in one normative commit. Preserve the entire source snapshot,
source digest, row identity and `_meta`; neither verifier nor CLI edits the
document. Do not add a calc collection primitive, Excel formula or forecast.
Run the full repository gates and compare optional profile absence against the
legacy corpus before considering an RFC 0045 integration proposal.

## Interaction with nearby RFCs

- **0045:** keeps `reserve_net` and all three assertions/refusals. This draft
  verifies account state separately; relaxing assembly needs explicit
  cross-boundary mapping and another accepted contract.
- **0056:** escrow funding declarations may be evidence for an account, but
  `upfront` and `monthly` are not inferred as actual movements or balances.
  Lender financing escrows remain outside the property profile.
- **0057:** a renovation draw or capex project can supply a gross expenditure
  reference; its budget-to-date fields do not become account balances, and
  stated savings remain inert.
- **0063:** final-period admission applies only to disposition timing. The
  reserve-dependent monthly case keeps its independent refusal.

## Alternatives considered

| Alternative | Why rejected for this first scope |
|---|---|
| Put the roll-forward directly in `sources_uses.uses.escrows` | Conflates closing/monthly funding declarations with actual dated custody state and lender accounts; silently redefines RFC 0056. |
| Treat NOI `replacement_reserves` as a cash account | An operating deduction does not establish custody, opening/ending balances or cash returns. |
| Add a standard section immediately | Format §C.7's extension-promotion evidence threshold has not been demonstrated. |
| Use only `cash_flow_series` with `reserve_net` | A dated net row cannot prove an account balance or distinguish contribution, draw and release. |
| Net a draw against gross TI/LC or capex to satisfy RFC 0045 | Hides gross economics and can double count or erase property costs. |
| Expand RFC 0045 or 0063 directly | Timing admission and account custody are separate decisions; the existing assembler cannot split the lease-up bundle. |
| Include lender financing reserves in one generic account class | The reviewed evidence distinguishes property and financing boundaries; no shared cash owner or mapping is established. |

## Unresolved owner decisions

Before acceptance, the owner must confirm the statement carrier and source
provenance shape, the monetary comparison point, and at least one source-backed
classification for each of contribution, internal draw and external release.
In particular, a movement whose source does not establish whether it is
external property cash, an internal custody transfer, a financing cash flow or
a gross expenditure must remain unclassified and refused. The public review
does not settle that mapping for every movement. This RFC therefore makes no
claim that the reserve-dependent Golden Deal is assembly-eligible and does not
authorize implementation of a normative reserve contract.

## Prior art

RFC 0045's explicit coverage plan and source bindings show how to preserve
row identity and refuse unproven economics. RFC 0057 verifies a stated balance
without silently deriving the authored fact. Format §4.20 and §C.7 provide
the extension path and promotion threshold for evidence that is still young.
