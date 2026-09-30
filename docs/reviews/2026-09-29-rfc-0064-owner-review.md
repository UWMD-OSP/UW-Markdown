# RFC 0064 owner review: statement carrier

RFC 0064 remains **draft**. PR #219 contains a proposed normative implementation;
passing gates do not accept it. Canonical `main` carries Protocol 2.18.0 and
the prepared, untagged core/CLI 2.14.0 candidate. The owner settled the
carrier choice on 2026-09-29 but has not accepted the whole RFC or authorized
this PR's merge.

## Appendix C.7 and precedent

1. **Exact rule.** Format Appendix C.7 calls a stabilized `x_` section a
   candidate for *promotion* after use across at least five distinct deals
   with a consistent schema, a semver `schema_version`, and a spec proposal
   containing the schema, use case, at least three examples and proposed
   standard ID. A promoted section receives a number in the next format minor;
   its old `x_` form continues to parse.
2. **Reach of the rule.** The text is a procedure for promoting an existing
   adopter extension. It does not expressly forbid a new standard section
   created directly by RFC. Reading it as an exclusive gate for all new
   sections would conflict with the repository's later direct-RFC precedent.
   The owner selected this reading for RFC 0064 on 2026-09-29.
3. **Precedent.** RFC 0026 introduced typed `capital_stack` (§4.24), later
   scoped to one point in time by RFC 0033. RFC 0008 introduced
   `lease_up_schedule` (§4.25). RFC 0034 introduced dated `cash_flow_series`
   (§4.26) and explicitly corrected its version treatment to follow the
   earlier section additions. RFC 0035 introduced `distribution_waterfall`
   (§4.27). None documents promotion of an established `x_` carrier under C.7.

## Carrier choice

| Choice | Interoperability now | Later cost |
|---|---|---|
| Standard `reserve_accounts` §4.28 | Every conforming validator can apply the closed `RSV-01`–`RSV-07` rules; readers and browser tools see a registered section; the schema and protocol have one portable meaning. | The new section commits Format readers and Protocol 2.19.0 hosts to a common shape before five-deal extension evidence exists. Corrections would require ordinary spec evolution. |
| `x_*` statement plus companion verifier | Existing readers preserve the unknown block; a selected verifier can check one explicit profile without changing the standard section registry. Ordinary validation skips its semantics, so adopters must agree on the profile and invoke the verifier separately. | Standardization later requires a stable `schema_version`, five-deal/three-example promotion evidence under C.7, an assigned section ID in a format minor, migration guidance or dual-carrier support, and conformance for both old `x_` and new standard records without duplicating one account. |

The completed Golden Deal review identifies account funding, draws, releases
and balances in two source roles. That evidence **requires an attributable
statement and deterministic account verification** for the proposed consumer.
It permits a standard section but does not itself satisfy C.7's extension
promotion threshold or require standard-section discovery. Neither carrier
alone proves the owner-cash boundary or cures RFC 0045's
`reserve_spending_excluded` refusal.

**Owner decision, 2026-09-29:** use the direct RFC-created standard
`reserve_accounts` §4.28 carrier. Reserve-account state is independent of asset
class. Portable schema, validator, conformance and verifier behavior require a
standard carrier because ordinary `x_*` sections are deliberately skipped by
validators and cross-checks. Appendix C.7's five-deal rule applies to promotion
of an existing extension, while §§4.24–§4.27 show direct-RFC precedent.
`lender_reserve` remains outside this property-reserve contract and refused.
Verification of an account alone does not cure RFC 0045's reserve refusal.

The remaining owner action is an explicit acceptance decision for the RFC as a
whole under `docs/rfcs/README.md`, followed by a separately authorized PR
merge. Keep PR #219 Draft and outside the 2.14.0 train. After 2.14.0 is
actually published, rebase this implementation on the released state and
advance its package/version candidate; do not republish core 2.14.0. No next
version is selected until publication truth fixes the semver base.

## Other proposed choices

The currency-quantum comparison reuses the shared §VIII.5 decimal-shift
quantizer; the three movement kinds are explicitly authored and closed;
`verifyReserveAccounts` follows other state-and-verify APIs; `uwmd validate`
already reaches validator families; and refusing `lender_reserve` preserves the
property/financing boundary. These choices are internally coherent as a
custodial verifier and need no separate owner decision for implementation
mechanics. They do **not** establish that any particular source movement
crosses the owner/property boundary. Draw-to-gross-expenditure binding and
owner-cash treatment remain a later economic contract.
