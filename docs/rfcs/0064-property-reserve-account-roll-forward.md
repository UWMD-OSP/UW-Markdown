---
rfc: 0064
title: Verify property reserve-account roll-forwards without netting expenditure
status: implemented
accepted: 2026-10-09
implemented: 2026-10-10
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

Add optional, asset-class-independent `reserve_accounts` (Format §4.28),
closed stated property-custody facts and a separately invoked deterministic
balance verifier. It checks only `ending = opening + contributions - internal
 draws - external releases`, plus explicitly claimed opening/ending continuity.
It does not create economic cash flows or net draws against gross expenditure.
RFC 0045's `reserve_spending_excluded` refusal remains exactly as released.

**Implemented; released and independently verified.** The owner authorized
acceptance and implementation together on 2026-10-09. PR #290 carries the
implementation and recorded that acceptance when it merged. Format stays 2.0.
Release preparation paired it with Protocol 2.24.0 and core/CLI 2.20.0. The
`v2.20.0` release published it in core/CLI 2.20.0 with Stable Protocol 2.24.0,
and independent publication verification passed (see
[Publication and verification](#publication-and-verification-2026-10-10)).
PR #219 is abandoned, closed unmerged, and is not revived by this implementation.
The carrier and exclusion of lender reserves were settled on 2026-09-29.

## Motivation and scope

The [completed Golden Deal review](../reviews/2026-09-24-completed-golden-corpus-validation.md)
identified property custody opening balances, contributions, draws, releases
and ending balances. Public examples here are independently authored synthetic
facts. The verifier makes no claim of full assembly parity for those private deals.

RFC 0056 escrow `upfront`/`monthly` declarations are funding assumptions,
not account statements. RFC 0057 renovation drawn-to-date facts and NOI
replacement-reserve deductions do not establish custodial balances. RFC 0045
coverage and its reserve spending, gross sale and terminal reserve assertions
remain unchanged. RFC 0063's final-period timing opt-in does not cure reserve
spending refusal. `lender_reserve`, financing, interest accrual, projected
draws/releases and RFC 0065 draw-to-expenditure binding are outside this RFC.

## Decisions

| Question | Decision | Why (precedent) |
|---|---|---|
| Carrier and scope | Optional, asset-class-independent standard section `reserve_accounts` (Format §4.28); only `property_reserve`. Lender financing reserves remain outside it. | Owner decision 2026-09-29; §§4.24–4.27 were created directly by RFC. |
| Field shape and provenance | Closed accounts/periods/movements objects with explicit identities, owner, currency, dated balances and required source `{document, locator}` pointers. Movements require an explicit array, amount, counterparty and source establishing the class. | RFC 0070 uses closed stated funding objects and exact source identity; RFC 0059 verifies separately stated outcomes. Existing host-owned `_meta` and append-only provenance remain intact. |
| Comparison point and tolerance | Ordered binary64 arithmetic with no intermediate rounding; quantize stated and computed ending balances separately at the existing currency quantum (2dp), half-away-from-zero; require equality. Claimed continuity uses the same boundary. | Protocol §VIII.5/§VIII.9.4 and RFC 0059 clawback checks; no new tolerance or financial convention. |
| Movement classification | Closed `contribution`, `internal_draw`, `external_release`; absent, unknown or source-unestablished classification refuses. Synthetic source-shaped fixtures separately identify owner funding, a contractor invoice paid from custody, and unused cash returned to the owner. | RFC 0070's closed discriminated funding vocabulary and dedicated source meaning; RFC 0064's existing refusal of ambiguous movements. |
| API, validation and continuity | Browser-safe `verifyReserveAccounts` and read-only `verify-reserve-accounts` CLI. Ordinary validation checks structure only. The separately invoked verifier checks stated balance identities and continuity only where `previous_period_id` explicitly claims it; no missing periods are synthesized. | RFC 0059 state-and-verify outcomes and RFC 0070's structural/async verification separation; RFC 0045 snapshots source evidence. |
| Gross expenditure and assembly | Draws are custody movements; gross expenditure stays gross. RFC 0045's `reserve_spending_excluded` refusal is unchanged. RFC 0065 is out of scope. | RFC 0045 §VIII.9.6 and RFC 0063's reserve-dependent refusal. |
| Version | Format stays 2.0. Advance the Protocol label at release preparation to the next minor after released 2.23.0; leave package versions and current version matrix unchanged here. | RFC 0072 Decisions R8; independent surface versioning. |

## Normative contract

Format §4.28 and Protocol §VIII.11 are the synchronized normative text.
`protocol.ts` mirrors their public types; the content and result JSON schemas
mirror their wire shapes. All objects are closed except existing universal
metadata. Account facts require identity, purpose, economic owner, currency,
source and explicit periods. Period facts require identity, real opening and
closing dates, nonnegative stated balances, source and explicit movements.
Each movement requires identity, real date, closed kind, nonnegative amount,
counterparty and a source `{document, locator}` establishing that class.

Optional `previous_period_id` states continuity with the immediately preceding
stated period; it is not a period generator. Omission makes no continuity
claim. Empty movements mean an explicit zero-movement source statement;
missing or null movements refuse. Period bounds and movement order are authored,
with same-day rows retained. Ordinary validation checks structural facts only.

`verifyReserveAccounts` snapshots source before await, emits the existing
whole-envelope semantic SHA-256 source digest, and returns independent
account/period evidence and typed source pointers. It performs authored-order
binary64 arithmetic without intermediate rounding. Only the final comparison
quantizes stated and computed balances separately at 2dp, half-away-from-zero.
There is no new tolerance or currency convention. It does not edit `_meta`,
source rows, cash-flow series, gross expenditure or host provenance.

| Code | Surface | Meaning |
|---|---|---|
| `RSV-01` | structural error | Closed shape, source, amount or currency invalid. |
| `RSV-02` | structural error | Duplicate account, period or movement identity. |
| `RSV-03` | structural error | Invalid or out-of-bounds calendar date. |
| `RSV-04` | structural error | Unsupported class or unclassified/unknown movement. |
| `RSV-05` | structural error | Period/movement order or explicit predecessor invalid. |
| `RSV-06` | verifier error | Ending balance disagrees at the existing quantum. |
| `RSV-07` | verifier error | Explicitly claimed continuity disagrees at that quantum. |
| `RSV-08` | verifier error | Binary64 balance arithmetic is nonfinite. |

Results are `not_checked / not_applicable` on absence, `unverifiable` on
invalid structure, unavailable source digest or nonfinite arithmetic,
`failed` on finite balance disagreement, and `verified` on matching stated
identities. No completeness or authenticity claim follows from verification.
A source-unestablished movement stays unclassified and refuses; a string label,
source pointer or balanced account does not prove economic meaning. The producer
owns that source assertion, just as RFC 0070 owns its dedicated-payment assertion.

## Source-shaped public examples

`conformance/reserve-accounts/source-example.json` and
`verified-source-classes/deal.uwx.md` state independent synthetic source locators:

| Class | Synthetic evidence | Gross economics |
|---|---|---|
| Contribution | Owner transfers 80 from unrestricted cash into the property capital account. | Custody inflow only. |
| Internal draw | Account pays the contractor invoice for gross property work of 30. | Gross capex remains 30 in `sources_uses`; the draw is not another expense or an offset. |
| External release | Account returns unused 50 to owner unrestricted cash. | Separate from gross sale proceeds; no investor cash stream is derived. |

These locators are source-shaped producer assertions, not private-source data
or authentication. Unsupported interest credit, lender reserves and absent
classification have separate refusing fixtures.

## Compatibility and conformance

Existing documents without the optional section retain exactly their current
validation and calculation behavior. Both format generations admit the section.
No legacy `reserve_net`, escrow, NOI, pack, Excel or cash-flow rule changes.
The verifier is read-only and browser-safe; the CLI is separately invoked.

The default and portable conformance suites cover source-shaped classes,
v1/v2, absence, explicit empty movements, exact quantum/half-away behavior,
ending mismatch, continuity disagreement, duplicates, real dates, order,
missing source/amount/list facts, closed objects, unclassified movement,
unsupported interest/lender reserves and nonfinite arithmetic. Focused tests
check snapshot/digest evidence, source/schema parity, variant/superseded handling,
unchanged gross rows and unchanged RFC 0045 reserve refusal with verified accounts.
No calc collection primitive, Excel formula, new dependency or forecast is added.

## Alternatives and related contracts

An `x_*` carrier was not selected: ordinary extension validation is skipped;
a portable account contract requires a normative carrier. §§4.24–4.27 are the
direct-RFC precedent; Appendix C.7 governs promotion of existing extensions.
Escrow funding declarations, NOI deductions and net cash-flow rows cannot prove
custody. A general lender account class lacks a shared ownership/financing
contract. Netting against TI/LC or capex hides gross economics and remains refused.
RFC 0065 must separately specify exact draw-to-gross-expenditure identity and
owner-cash mapping before any later RFC could relax RFC 0045. This RFC does neither.

## Publication and verification (2026-10-10)

Annotated `v2.20.0` targets the release-prepared merge
`020e8b088307ac53a0023bfc0b881c31fb40db91` (PR #292).
[Release run 38064763014](https://github.com/UWMD-OSP/UW-Markdown/actions/runs/38064763014)
succeeded and published core/CLI 2.20.0, signing 0.2.24, batch 0.8.19 and
both modules 0.1.12. Independent registry, provenance, published-file,
delivered-CLI (279/279) and module-consumer checks passed; see
[the publication record](https://github.com/UWMD-OSP/UW-Markdown/blob/main/docs/releases/2.20.0-publication.md).
Publication verification precedes this separate `accepted` → `implemented`
reconciliation. The immutable release tag and every normative section above
remain unchanged.
