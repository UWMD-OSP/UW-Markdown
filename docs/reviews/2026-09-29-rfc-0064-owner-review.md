# RFC 0064 owner review: statement carrier

The owner made this decision on 2026-09-29. It was recorded on PR #219
(branch `feat/rfc-0064-reserve-accounts`, commit `f78fc54`). On 2026-10-01 it
was ported to canonical `main` (`182176c`) **without** PR #219's normative
implementation. RFC 0064 remains **draft**.

The decision settles one question: where the account statement lives. It does
not accept the RFC as a whole, authorize its implementation, select a Protocol
or Format version, or place RFC 0064 in the 2.14.0 release candidate. Canonical
`main` carries accepted, unreleased Protocol 2.18.0 and the prepared, untagged
core/CLI 2.14.0 candidate.

## Appendix C.7 and precedent

Checked against `spec/UW_FORMAT_SPEC_v1.md` on `main`.

1. **Exact rule.** Format Appendix C.7 ("Spec Evolution Protocol") calls an
   extension section that stabilizes a *candidate for promotion* to a standard
   section. The criteria are:
   - use across at least five distinct deals with a consistent schema;
   - a semver `schema_version`;
   - a spec change proposal with the schema, a use case, at least three
     examples and a proposed standard section ID.

   A promoted section is numbered in the next spec minor, and its `x_` form
   continues to parse.
2. **Reach of the rule.** C.7 is a procedure for promoting an *existing*
   adopter extension. It does not forbid a new standard section created
   directly by RFC. Reading it as the only gate for every new section would
   conflict with the repository's direct-RFC precedent. The owner selected the
   narrower reading for RFC 0064 on 2026-09-29.
3. **Precedent.** Four standard sections were created directly by RFC. None
   documents promotion of an established `x_` carrier under C.7.

   | Section | Created by |
   |---|---|
   | `capital_stack` (§4.24) | RFC 0026, later scoped to one point in time by RFC 0033 |
   | `lease_up_schedule` (§4.25) | RFC 0008 |
   | `cash_flow_series` (§4.26) | RFC 0034 |
   | `distribution_waterfall` (§4.27) | RFC 0035 |

## Carrier choice

| Choice | Interoperability now | Later cost |
|---|---|---|
| Standard `reserve_accounts` §4.28 | Every conforming validator can apply one closed rule set to a registered section. Readers and browser tools see the section, and the schema and protocol carry one portable meaning. | Format readers and a future Protocol minor commit to a common shape before five-deal extension evidence exists. Corrections require ordinary spec evolution. |
| `x_*` statement plus companion verifier | Existing readers preserve the unknown block. A selected verifier can check one explicit profile without touching the standard section registry. Ordinary validation skips its semantics, so adopters must agree on the profile and invoke the verifier separately. | Standardizing later requires a stable `schema_version`, C.7 promotion evidence (five deals, three examples), a section ID in a format minor, migration guidance or dual-carrier support, and conformance for both carriers without counting one account twice. |

The [completed Golden Deal review](../reviews/2026-09-24-completed-golden-corpus-validation.md)
identifies account funding, draws, releases and balances in two source roles.
For the proposed consumer, that evidence requires an attributable statement and
deterministic account verification. It permits a standard section, but it does
not meet C.7's extension-promotion threshold and does not by itself require
standard-section discovery. Neither carrier alone proves the owner-cash
boundary or cures RFC 0045's `reserve_spending_excluded` refusal.

## Owner decision, 2026-09-29

- **Carrier.** Use a direct, RFC-created standard section,
  `reserve_accounts` (Format §4.28), rather than an `x_*` extension.
- **Appendix C.7.** The five-deal rule is a promotion path for an existing
  extension. It does not prohibit a standard section created directly by RFC;
  §4.24–§4.27 are the precedent.
- **Asset class.** `reserve_accounts` is asset-class-independent.
- **Why standard.** Portable schema, validator, conformance and verifier
  behavior need a standard carrier, because validators and cross-checks
  deliberately skip ordinary `x_*` sections.
- **Lender reserves.** `lender_reserve` remains outside this property-reserve
  contract.
- **RFC 0045.** Verifying a reserve account does not by itself cure RFC 0045's
  `reserve_spending_excluded` refusal. It does not authorize netting draws
  against gross expenditure.

## What this decision does not decide

| Question | State |
|---|---|
| Acceptance of RFC 0064 as a whole | Not decided. Requires an explicit owner decision under the process in `docs/rfcs/README.md`. Status remains `draft`. |
| Implementation | Not authorized. PR #219's normative implementation needs a separately authorized merge after acceptance. |
| Version | None selected. PR #219's Protocol 2.19.0 label and package candidate are provisional. RFC 0064 is outside the 2.14.0 release candidate. After 2.14.0 is actually published, the implementation must rebase on the released state; it must never republish `@uwmd/core@2.14.0`. |
| Section fields, verifier API, validation family | Proposals only. PR #219 proposes a field shape, the `RSV-01`–`RSV-07` family, `verifyReserveAccounts`, and a currency-quantum comparison reusing the shared §VIII.5 decimal-shift quantizer. A prior review judged these internally coherent as a custodial verifier. They stand or fall with the whole-RFC acceptance. |
| Movement classification and the owner-cash boundary | Unresolved. A verified statement establishes that the authored arithmetic and continuity hold, not that a movement crosses the owner/property boundary. Binding a draw to its gross expenditure row and choosing one owner-cash treatment are later economic contracts. |

## Not carried over from PR #219

This port is documentation only. It deliberately leaves on PR #219:

- Format §4.28 and Protocol §VIII.9.7 text;
- the `section-reserve-accounts` schema;
- `reserve-accounts.ts`, the validator family and the public exports;
- the `conformance/reserves/` suite and the assembly fixture;
- receipt-baseline and version changes;
- the `VERSIONS.md` and CHANGELOG entries;
- the release-candidate note edits.

It also leaves behind PR #219's technical audit. That audit verifies the branch
against an earlier `main` (`356c2a1`) and predates this decision, so it is not
current evidence.
