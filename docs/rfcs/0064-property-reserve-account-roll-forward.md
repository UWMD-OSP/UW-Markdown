---
rfc: 0064
title: Verify property reserve-account roll-forwards without netting expenditure
status: draft
author: codex, claude
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

Add an optional, single-variant **`reserve_accounts`** section (format §4.28)
that states, per owner-restricted property reserve account and per stated
period, the opening balance, every dated movement — `contribution` in, `draw`
out to fund a separately stated **gross** expenditure, `release` out to the
owner — and the stated ending balance. A deterministic verifier
(`verifyReserveAccounts`, protocol §VIII.9.7) recomputes every ending balance
from the one identity the section has and checks continuity across consecutive
statements; the validator registers the `RSV-NN` family. The statement is
evidence about **cash custody**. It is not a second expenditure ledger — a draw
never nets against the gross TI/LC, capex or expense it funded — and it does
not make an RFC 0045 reserve-dependent assembly plan eligible. `lender_reserve`
is reserved and refused.

**Draft, awaiting whole-RFC owner acceptance.** The owner selected the standard
`reserve_accounts` §4.28 carrier on 2026-09-29; this settles the carrier choice,
not the RFC's acceptance or permission to merge its normative implementation.
The branch proposes comparison, movement and API rules alongside a reference
implementation, synthetic conformance and spec text. Its Protocol **2.19.0**
label and package candidate are provisional. Canonical `main` remains at 2.18.0
and Format remains 2.0.

## Motivation

The [completed Golden Deal review](../reviews/2026-09-24-completed-golden-corpus-validation.md)
found two complete monthly sources outside RFC 0045 admission. RFC 0063
resolved the first (terminal cash on the final period's exclusive boundary).
The second still refuses at `plan.assertions.reserve_spending_excluded`: the
source funds work out of a restricted property reserve, and RFC 0045's first
scope cannot split that spending out of the lease-up bundle. The
[RFC 0063 implementation record](../reviews/2026-09-24-rfc-0063-implementation.md)
proves the timing-only case assembles and the reserve-dependent case still
refuses — correctly.

The review also found that the covered-land and development sources state
acquisition funding, periodic contributions, draws, releases and ending
balances for those accounts, and that these are distinct from the replacement
reserve deducted in annual NOI and from lender-held financing reserves. That
is the shape of a custodial account statement, and nothing in the format can
say it today:

- RFC 0056's §4.8 `escrows` declare *funding* (`upfront`, `monthly`) and
  explicitly exclude the roll-forward: two numbers cannot carry balances, draw
  dates or cash returned.
- RFC 0057's `uses.renovation` is a budget-to-date fact, not custody.
- §4.26 `reserve_net` is the *owner's* side of a contribution or release — a
  dated net row that cannot prove a balance or distinguish a draw from a
  release.
- An NOI `replacement_reserves` line is an operating deduction, not cash held.

The next consumer, therefore, is a verifier for account state that can be
trusted **before** anyone proposes relaxing RFC 0045. It must not turn the
existing refusal into a success by netting gross expenditure against a reserve
draw. That netting is the failure mode this RFC exists to make impossible.

## Proposed change

### Format: §4.28 `reserve_accounts`

A new optional, single-variant, asset-class-independent section — the fifth
state-and-verify structure after §4.24–§4.27. The owner selected this standard
carrier. Appendix C.7 governs *promotion of an existing adopter `x_`
extension*; it does not prohibit a section created directly by RFC.
Sections §4.24–§4.27 provide direct-RFC precedent. A portable account-state
contract needs a common schema, validator, conformance and verifier; ordinary
`x_*` sections are intentionally skipped by validation and cross-checks.
Homing the statement under §4.8 `escrows` (rejected by RFC 0056 and the draft),
under §4.26 (statements are facts, not scenarios; §4.26 is multi-variant), or
in an `x_` block (a normative verifier over a non-normative carrier) were each
worse.

Fields, all closed:

| Path | Meaning |
|---|---|
| `label` | Optional free text. |
| `accounts[].account_id` | Stable author-stated identity, unique within the section. |
| `accounts[].class` | Closed: `property_reserve`. `lender_reserve` is **reserved and refused**. |
| `accounts[].purpose` | What the account is for. Nonempty. |
| `accounts[].currency_code` | Optional uppercase three-letter identity (RFC 0046 posture: stated, never inferred). |
| `accounts[].statements[]` | Ordered, non-overlapping periods. |
| `…period_start`, `…period_end` | Real ISO dates, inclusive bounds, **authored** — never derived from a period position. |
| `…opening_balance` | Cash held at period start. Nonnegative. |
| `…movements[]` | Each: closed `kind` (`contribution` / `draw` / `release`), nonnegative `amount`, `date` inside the period, optional `label`. May be empty. |
| `…ending_balance` | Cash held at period end, **as stated**. Verified, never derived. |

Real opening and closing dates were chosen over an RFC 0041 `YYYY-MM` identity
because the evidence has them, because a statement need not align to a calendar
month, and because the continuity rule is then calendar arithmetic rather than
a second period grammar.

### Codes: the `RSV-NN` family

| Code | Severity | Rule |
|---|---|---|
| `RSV-01` | error | Structure: nonempty `accounts` and `statements`; nonempty `account_id` and `purpose`; closed `class` and `kind`; finite nonnegative balances and amounts; real dates; `currency_code` matching `^[A-Z]{3}$`. An unsupported movement — interest credited, a fee, a transfer between accounts — is refused, **never reclassified** as the nearest kind. |
| `RSV-02` | error | `lender_reserve` is reserved for a later financing contract and refused. A lender-held escrow is not property cash and cannot be verified as one. |
| `RSV-03` | error | `account_id` unique within the section; `period_end` not before `period_start`; each statement strictly after the prior. Order is identity — the roll-forward never sorts. |
| `RSV-04` | error | Every movement `date` lies within its statement's period. |
| `RSV-05` | error | `ending_balance = opening_balance + Σ contribution − Σ draw − Σ release`, both sides quantized at the currency quantum (2 decimals, §VIII.5 half-away-from-zero). Every movement added exactly once. Nothing inferred to make it hold. |
| `RSV-06` | error | When a statement begins the calendar day after the prior ends, its `opening_balance` equals the prior `ending_balance` at the quantum. |
| `RSV-07` | warning | Otherwise the roll-forward makes no claim across the gap and does not fill it. |

The relational rules (`RSV-03`–`RSV-06`) run only over statements `RSV-01`
accepted: an identity over a refused amount is noise, not a finding.

### Protocol: §VIII.9.7 and the verifier

`verifyReserveAccounts(section): ReserveAccountsVerification` is three-state
per statement, per account and overall, the shape of `verifyCashFlowSeries`:
`failed` on `RSV-BALANCE-DISAGREES` / `RSV-CONTINUITY-DISAGREES`,
`unverifiable` (`RSV-UNEVALUABLE`) when a statement cannot be rolled forward
from what it states, `verified` otherwise. It reports, per statement, the
opening balance, the three movement totals, computed and stated ending
balances and whether continuity applied. An `unverifiable` statement is
undecided, never zero, and the statement after it is not consecutive to it.
Unavailable numeric result fields are explicit `null`, not `NaN` or an inferred
zero, so the public result remains JSON-safe.

The identity is computed **once**, in `rollForwardEndingBalance`; the
validator's `RSV-05` and the verifier both call it, so the two surfaces cannot
disagree about a sum (invariant 4's lesson, applied to a verifier).

The comparison point the draft left open is the existing currency quantum —
the same `CASH_FLOW_VERIFY_DECIMALS.currency` and `quantizeAtDecimals` every
other currency comparison in the library uses. No new precision rule.

### Library surface (additive)

New exports from `@uwmd/core` and `@uwmd/core/browser`:
`verifyReserveAccounts`, `rollForwardEndingBalance`, `statementsConsecutive`,
`sumMovements`, `RESERVE_ACCOUNT_CLASSES`, `RESERVED_RESERVE_ACCOUNT_CLASSES`,
`RESERVE_MOVEMENT_KINDS`, and the `Reserve*` types. `reserve_accounts` joins
`STANDARD_SECTION_IDS` and `BUILTIN_VIEW_MODELS`. Schema
`section-reserve-accounts.schema.json`. The read-only CLI entry is
`uwmd validate`, which reports the family; no new command is added.

### The boundary, stated as rules

- A `draw` of X is an account movement of X. The expenditure it funded stays
  **gross** in its own section. No surface MAY use a verified draw to reduce a
  gross cash row.
- A verified roll-forward MUST NOT make an RFC 0045 plan eligible, cure any of
  the three reserve assertions, or supply a `reserve_net` row. §VIII.9.6 is
  unchanged. The conformance fixture
  `property-cash-flow-assembly/reserve-statement-does-not-cure` pins this: the
  reserve-dependent plan refuses at exactly the same pointer with a verifying
  statement in the document, and the document emits no `RSV-*` code.
- Movement classification is the author's, from the account statement, under
  the closed kinds. The draft asked for "source-backed classification" of each
  kind before acceptance; the answer is that the format asks the author to
  state the kind and refuses anything it cannot place, exactly as `CAPX-07`
  and `HDG-06` require a disclosure rather than defaulting one.

## Compatibility analysis

Additive and opt-in.

- **Existing `.uw.md` files** — none change. A document without the section
  emits nothing and validates, serializes, digests and refuses exactly as
  before. Legacy `reserve_net` rows keep their external-transfer meaning.
- **Tier-1 Reader** — a new standard section ID. Readers that key on
  `STANDARD_SECTION_IDS` see one more; readers that preserve unknown sections
  already do.
- **Tier-2 Editor** — no edit policy change; byte preservation unaffected.
- **Tier-3 Calc Host** — untouched. No pack reads the section; no builtin, no
  grammar, no Excel emission.
- **Tier-4 Agent Host** — an agent MAY transcribe a statement; it MUST NOT
  infer a balance, movement or period.
- **Modules** — manifest schema unchanged.
- **RFC 0045 / 0062 / 0063** — unchanged; pinned by fixture.

Protocol minor bump to 2.19.0 (new section, new code family, new verifier with
a wire shape). Format stays 2.0: the frontmatter and `_meta` contract are
untouched, and Part IV's registry has always grown by RFC without a format
bump.

This proposal is **outside the existing 2.14.0 release train**. After 2.14.0
is actually published, the implementation PR must rebase onto that released
state and advance its package/version candidate appropriately. It must never
attempt to publish `@uwmd/core@2.14.0` again. The next version is deliberately
unselected until publication truth fixes the semver base; the branch's current
labels are not release authority.

## Conformance impact

New suite `conformance/reserves/` (15 cases, synthetic, de-identified):

- `accept-two-period-rollforward`, `accept-quiet-period`, `accept-two-accounts`,
  `accept-absent-section` — clean.
- `warn-gap-between-statements` — `RSV-07` only; the differing opening balance
  across the gap is deliberately *not* `RSV-06`.
- `reject-balance-identity` (`RSV-05`), `reject-continuity-break` (`RSV-06`),
  `reject-negative-movement`, `reject-unknown-kind`, `reject-impossible-date`,
  `reject-empty-statements` (`RSV-01`), `reject-duplicate-account`,
  `reject-overlapping-periods` (`RSV-03`), `reject-movement-outside-period`
  (`RSV-04`), `reject-lender-reserve` (`RSV-02`).

New assembly fixture
`property-cash-flow-assembly/reserve-statement-does-not-cure`: the
`boundary-reserve-spending` document plus a verifying statement; same refusal,
same pointer, `absent_validation_codes` covering the whole `RSV` family.

Existing fixtures: the two receipt baselines that embed `protocol_version` move
to 2.19.0. Nothing else changes.

Unit tests: `reserve-accounts.test.ts` (identity, continuity, verdict ranking,
no mutation, the §4.28 worked example pinned) and
`validator.reserve-accounts.test.ts` (every code, plus what the validator
leaves alone).

## Reference implementation

`packages/uwmd-core/src/reserve-accounts.ts` (types, identity, verifier) and
the `checkReserveAccounts` family in `validator.ts`. Golden Deal evidence was
used only as a requirements cross-check; no private value, identity or path
appears in any public fixture.

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| Put the roll-forward in `sources_uses.uses.escrows` | Conflates funding declarations with dated custody state and lender accounts; silently redefines RFC 0056. |
| Treat NOI `replacement_reserves` as a cash account | An operating deduction establishes no custody, balance or return. |
| Keep it in an `x_` extension with a "companion" verifier | A normative verifier over a non-normative carrier: adopters could not know what shape to author, and the promotion path would re-litigate the same design. |
| Use only `cash_flow_series` with `reserve_net` | A dated net row cannot prove a balance or tell a draw from a release. |
| Net a draw against gross TI/LC or capex to satisfy RFC 0045 | Hides gross economics; double-counts or erases property cost. The one thing this contract forbids. |
| Expand RFC 0045 or 0063 directly | Timing admission and account custody are separate decisions. |
| One generic account class including lender reserves | The evidence keeps property and financing boundaries apart; no shared owner is established. |
| RFC 0041 period identities instead of dates | Statements need not align to calendar months, and the evidence carries real dates. |
| Add a `verify-reserves` CLI command | `uwmd validate` already reports the family; a second entry would duplicate it. |

## Unresolved questions

Deferred to later contracts, each with its own RFC:

- A cross-check tying a `contribution` / `release` to the §4.26 `reserve_net`
  row that is its owner-side twin.
- A binding from a `draw` to the gross expenditure row it funded — the fact an
  RFC 0045 successor would need before it could relax
  `reserve_spending_excluded` with one auditable owner-cash treatment.
- A `lender_reserve` class with financing semantics.
- Interest credited within the account.

## Prior art

RFC 0045's explicit coverage and refusal posture; RFC 0057's stated-and-verified
`contingency_remaining`; RFC 0056's reserved-and-refused `rate_swap`; RFC 0034's
state-and-verify shape and three-state verdicts.
