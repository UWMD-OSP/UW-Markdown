---
rfc: 0064
title: Verify property reserve-account roll-forwards without netting expenditure
status: draft
author: codex
created: 2026-09-27
affects:
  - format-spec
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

**Decision status.** One owner decision is recorded. On 2026-09-29 the owner
selected a direct, RFC-created standard section, `reserve_accounts` (Format
§4.28), as the statement carrier instead of an `x_*` extension (see
[Proposed layer and scope](#proposed-layer-and-scope) and the
[owner review](../reviews/2026-09-29-rfc-0064-owner-review.md)). That settles
the carrier only:

- **Carrier:** decided.
- **The RFC as a whole:** not accepted. Status remains `draft`.
- **Implementation:** not authorized. No Protocol or Format version is
  selected, and no released generation (through 2.17.0) contains RFC 0064.

The normative proposal on PR #219 (a Protocol 2.19.0 label, schema, `RSV-NN`
codes, verifier API and conformance) is not part of this decision.

**PR #219 is closed, unmerged (2026-10-04).** The owner confirmed the same
day that closing it neither rejected nor withdrew this RFC: #219 is an
abandoned, stale implementation attempt. Its branch
`feat/rfc-0064-reserve-accounts` (`f78fc54`) remains only as a reference and
is not to be revived as is. Its provisional Protocol 2.19.0 label has since
shipped with RFC 0066, so any implementation after acceptance starts from
current `main`. This RFC stays `draft`, and RFC 0065 stays blocked on it.

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

**Carrier (owner decision, 2026-09-29).** The statement is carried by a new
optional standard section, `reserve_accounts` (Format §4.28), created directly
by this RFC. The section is asset-class-independent: reserve-account state does
not vary by asset class.

- **Appendix C.7 does not block it.** C.7's five-deal threshold governs the
  *promotion of an existing `x_` extension*. It does not prohibit a standard
  section created directly by RFC.
- **Precedent.** §4.24–§4.27 were each created this way, by RFCs 0026, 0008,
  0034 and 0035.
- **Why not `x_*`.** A portable account-state contract needs one schema,
  validator, conformance and verifier meaning. Ordinary `x_*` sections (Format
  §4.21) are deliberately skipped by validators and cross-checks.

Any `x_*` block a producer already uses stays parseable and is not promoted by
this RFC. `lender_reserve` remains outside this property-reserve contract.

The verifier checks only an explicitly stated, attributable property-account
statement and returns a source digest and item-level evidence. The carrier
decision settles where the statement lives and nothing more. These remain part
of whole-RFC acceptance:

- the section's field shape;
- the verifier's public API name;
- whether its rules also run as an ordinary document-validation family;
- every open point under
  [Unresolved owner decisions](#unresolved-owner-decisions).

PR #219 proposes answers to each; they remain proposals until the RFC is
accepted.

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
The selected carrier also adds a §4.28 entry to the Format Part IV registry.
How that addition is versioned is part of acceptance, not of the carrier
decision.

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
conformance, then update the Format §4.28 section, Protocol prose, executable
types, the section schema and documentation in one normative commit. Preserve
the entire source snapshot, source digest, row identity and `_meta`; neither
verifier nor CLI edits the document. Do not add a calc collection primitive,
Excel formula or forecast.
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
| Carry the statement in an `x_*` extension with a companion verifier | Not selected by the owner on 2026-09-29. Validators and cross-checks deliberately skip `x_*` sections, so a normative verifier would sit over a non-normative carrier. Standardizing later would then need C.7 promotion evidence, migration and conformance for both carriers. Appendix C.7 does not require this route for a section created directly by RFC. |
| Use only `cash_flow_series` with `reserve_net` | A dated net row cannot prove an account balance or distinguish contribution, draw and release. |
| Net a draw against gross TI/LC or capex to satisfy RFC 0045 | Hides gross economics and can double count or erase property costs. |
| Expand RFC 0045 or 0063 directly | Timing admission and account custody are separate decisions; the existing assembler cannot split the lease-up bundle. |
| Include lender financing reserves in one generic account class | The reviewed evidence distinguishes property and financing boundaries; no shared cash owner or mapping is established. |

## Unresolved owner decisions

What is and is not decided:

| Question | State |
|---|---|
| Statement carrier | **Decided 2026-09-29:** a direct, RFC-created standard section, `reserve_accounts` (Format §4.28). It is asset-class-independent, and `lender_reserve` remains outside this property-reserve contract. |
| Acceptance of the RFC as a whole | **Not decided.** Status remains `draft`. |
| Implementation | **Not authorized.** No normative text, schema, code, export, conformance fixture or version change may merge on the strength of this RFC. |
| Version | **None selected.** No Protocol or Format version is chosen. No released generation (through 2.17.0) contains RFC 0064. |

The carrier decision does not resolve RFC 0045. Verifying a reserve account
does not cure its `reserve_spending_excluded` refusal. It also does not
authorize netting draws against gross expenditure.

Still unresolved before acceptance:

- the statement's field shape and source provenance;
- the monetary comparison point;
- at least one source-backed classification for each of contribution,
  internal draw and external release.

In particular, a movement whose source does not establish whether it is
external property cash, an internal custody transfer, a financing cash flow or
a gross expenditure must remain unclassified and refused. The public review
does not settle that mapping for every movement. This RFC therefore makes no
claim that the reserve-dependent Golden Deal is assembly-eligible and does not
authorize implementation of a normative reserve contract.

Binding a draw to the gross expenditure row it funded, and choosing one
auditable owner-cash treatment, remain later contracts. Only those contracts
could relax RFC 0045.

## Prior art

RFC 0045's explicit coverage plan and source bindings show how to preserve
row identity and refuse unproven economics. RFC 0057 verifies a stated balance
without silently deriving the authored fact. Format §4.21 and Appendix C.7
describe the extension path and the promotion of an existing extension.
§4.24–§4.27 (RFCs 0026, 0008, 0034 and 0035) are the direct-RFC precedent for
the selected standard carrier.
