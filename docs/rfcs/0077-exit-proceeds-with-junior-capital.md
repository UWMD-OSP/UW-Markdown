---
rfc: 0077
title: Define exit proceeds to equity when the capital stack carries junior capital
status: accepted
accepted: 2026-10-07
author: claude-code (agent proposal)
created: 2026-10-07
depends_on:
  - 0026
  - 0033
  - 0050
  - 0052
affects:
  - format-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0077: Define exit proceeds to equity when the capital stack carries junior capital

**Accepted; implemented, not released.** A coding agent wrote this RFC from
issue #278 (StackUW UPSTREAM-025). Each decision below was answered from
existing contracts. On 2026-10-07 the owner accepted D1–D6 as recommended and
directed implementation (see the
[owner acceptance record](#owner-acceptance-record-2026-10-07)). The pull
request that carries the implementation records that acceptance when it
merges. The RFC stays `accepted` until a release ships it and publication is
verified.

## Summary

Format §4.9 lists `exit_analysis.net_proceeds_to_equity` and gives it no
definition. `@uwmd/core`'s `deriveDCF` foots it as
`exit_value_net − loan_balance_at_exit`. When the §4.24 capital stack carries a
`preferred_equity` tranche, a producer can reasonably mean either the whole
equity stack's proceeds or common equity's residual after the pref is
redeemed. Those two values differ by the redemption. The web editor then
**overwrites** a stated common residual with the footed total on the next
unrelated edit.

This RFC keeps the field's footed meaning and states it: proceeds to the whole
equity stack, preferred and common, after all debt is repaid. It adds two
optional fields. `preferred_equity_redemption_at_exit` is a stated amount,
never derived. `net_proceeds_to_common_equity` is footed from it. It also pins
`loan_balance_at_exit` to mean all debt repaid from the sale, so mezzanine
debt cannot leave the same gap.

## Motivation

### What the issue reports, verified

On `main` at `a74cae2`:

| Claim | Verified? |
|---|---|
| §4.9 states no identity for `net_proceeds_to_equity` | **Yes.** The field appears only in the template (`spec/UW_FORMAT_SPEC_v1.md`, §4.9). |
| `deriveDCF` foots it as `exit_value_net − loan_balance_at_exit` | **Yes.** `packages/uwmd-core/src/dcf.ts`. The issue's synthetic exit gives 3,800,000 beside a stated 2,300,000. |
| The validator raises nothing | **Yes.** No rule reads the field. |
| "the editor, CLI and Excel converter agree" | **Partly.** Only the web editor calls `deriveDCF`; the CLI and Excel converter never read the field. The report renders the stated value. |

### Two things the issue does not say

- **The editor rewrites the stated value.** `tools/web-editor`'s footed models
  re-derive the whole block on every edit and write each footed field over the
  stated one, unless `_meta.field_overrides` marks that path `overridden`. A
  document stating common's residual, 2,300,000, becomes 3,800,000 the first
  time anyone edits an unrelated DCF input.
- **Mezzanine debt has the same gap.** `dcf` depends on `debt_structure`
  (§4.7), which models one loan. With a §4.24 `mezzanine_debt` tranche,
  `loan_balance_at_exit` may or may not include the mezzanine payoff. Nothing
  says which, so "proceeds to equity" is ambiguous even with no preferred
  equity.

### What the stack can and cannot supply

§4.24 is one point in time (RFC 0033). It states each tranche's committed
`amount` and `rate`, but no balance at exit and no redemption. A preferred
redemption at sale is the committed amount plus whatever accrued, and accrual
needs a compounding and day-count convention UWMD does not define. RFC 0052
excluded "any levered exit treatment", and the financing-assembly brief
(2026-09-29) records that no payoff convention exists. So the redemption can
only be stated by the producer, never derived by UWMD.

## Proposed change

### Decisions

| # | Question | Answer (accepted) | Why |
|---|---|---|---|
| D1 | What does `net_proceeds_to_equity` mean? | Proceeds to the **whole equity stack** (§4.24 `preferred_equity` and `common_equity`) after all debt is repaid. Its footing is unchanged: `exit_value_net − loan_balance_at_exit`. This is the issue's option (b). | §4.24 classes preferred equity as equity. The §4.27 distribution waterfall is where the equity stack is split (§4.27: the stack "is the liability side at one point in time", the waterfall "the equity side over the hold"). It is today's implemented meaning, so no existing document or tool changes. A field's meaning does not depend on whether another field is present. |
| D2 | What does `loan_balance_at_exit` cover when a `capital_stack` is present? | Every **debt-class** tranche repaid from the sale: `senior_debt`, `mezzanine_debt`, `bridge`, `seller_financing`, `other_debt`. Equity-class tranches never. A single-loan document is unchanged. | Without it, D1's "after all debt" cannot hold when mezzanine exists. §4.24's class list already separates debt from equity, and `debt_yield_through` is "a debt-only attachment metric". The field name stays, with its scope stated. |
| D3 | Where does common's residual go? | A new optional `exit_analysis.net_proceeds_to_common_equity`, footed as `net_proceeds_to_equity − preferred_equity_redemption_at_exit`. | Gives the adopter's figure its own field with one meaning, so no tool contradicts it. Footing is an identity over the block's stored fields, the scope `deriveDCF` already keeps. |
| D4 | Where does the redemption come from? | A new optional, **stated** `exit_analysis.preferred_equity_redemption_at_exit`: the cash paid at the sale to retire every `preferred_equity` tranche, accrued return included. It is never derived. An agent MUST NOT invent it (§4.24's rule for tranche terms). Zero is a valid statement. | Accrued pref needs conventions UWMD does not define (above). A stated cash amount is the house pattern for exit figures (RFC 0052: stated payments, not recomputed percentages). |
| D5 | Is anything validated? | No new code. Both fields are optional. A `net_proceeds_to_common_equity` stated without its redemption is a figure `deriveDCF` cannot foot, so it is shown as stated, like any other unfooted input. | The validator's `dcf` rules (thresholds, CC-06/07, RT-01, TAX-*) assert none of the exit footing identities, and footing is not a validation rule. Adding the family's first would be a separate decision. |
| D6 | What is out of scope? | Which equity `returns.levered_irr` and `equity_multiple` describe when preferred equity exists; dated payoff cash; deriving any accrual. | Each needs its own contract: the first is a returns-basis question like RFC 0038, and the others are financing assembly. |

### Format §4.9

Add to the `exit_analysis` template, after `net_proceeds_to_equity`:

```json
"preferred_equity_redemption_at_exit": null,
"net_proceeds_to_common_equity": null,
```

Add after the template:

> **Exit proceeds (RFC 0077).** `exit_value_net` is the sale price less
> disposition costs. `loan_balance_at_exit` is the balance of every debt
> repaid from the sale. When a `capital_stack` (§4.24) is present, that is
> every `senior_debt`, `mezzanine_debt`, `bridge`, `seller_financing` and
> `other_debt` tranche, and never an equity-class tranche.
> `net_proceeds_to_equity` is the proceeds to the whole equity stack,
> preferred and common: `exit_value_net − loan_balance_at_exit`.
>
> `preferred_equity_redemption_at_exit` is OPTIONAL. It states the cash paid
> at the sale to retire every `preferred_equity` tranche, accrued return
> included. It is stated, never derived, and an agent MUST NOT invent it.
> `net_proceeds_to_common_equity` is OPTIONAL. When the redemption is stated,
> it is `net_proceeds_to_equity − preferred_equity_redemption_at_exit`.
> Without the redemption it is the producer's stated figure and is not
> footed. Splitting the equity stack's proceeds between partners belongs to
> `distribution_waterfall` (§4.27), not here.

### Library and tools

- `deriveDCF` foots `net_proceeds_to_common_equity` when
  `net_proceeds_to_equity` (stated or footed) and
  `preferred_equity_redemption_at_exit` are both numbers. Additive: the
  `DCFDerivation` type is unchanged, and it gains one possible field path.
- The web editor's DCF model makes the redemption an input row and the
  common residual a footed row.
- The report shows "Net proceeds to common equity" when it is stated or
  footed.
- No other export changes.

## Compatibility analysis

- **Existing documents:** unchanged. Every corpus document states a single
  loan, and each states `net_proceeds_to_equity` equal to its footing
  (checked: `02-full-multifamily` and both Parkview examples). The new fields
  are absent from all of them.
- **Producers stating common's residual in `net_proceeds_to_equity`**
  (StackUW from its next release) are misstating the field under D1. They
  move that figure to `net_proceeds_to_common_equity`, state the
  redemption, and keep `net_proceeds_to_equity` as the total. Until they do,
  the editor corrects the field to the total. That is today's behavior,
  now with a defined meaning behind it.
- **Producers stating `loan_balance_at_exit` as the senior loan only, beside
  a mezzanine tranche,** were undefined before. Under D2 they include the
  mezzanine payoff.
- **Tier-1 readers** display two more optional fields. **Tier-2 editors**
  preserve bytes; the footed-model write path already exists. **Tier-3
  calculations:** no pack reads these fields. **Tier-4 hosts:** an agent
  MUST NOT invent the redemption. **Modules:** no change.

No deprecation path is needed.

## Conformance impact

No existing fixture or baseline changes. `deriveDCF` is library behavior, not
a conformance tier, so the proof is unit tests plus one corpus document:

- `dcf.test.ts`:
  - the issue's synthetic exit with a 1,500,000 redemption foots
    `net_proceeds_to_equity` 3,800,000 and `net_proceeds_to_common_equity`
    2,300,000;
  - no redemption: no common footing, and no redemption is ever derived;
  - a zero redemption foots common equal to the total;
  - a stated total with no loan balance still foots common;
  - a stated common figure that disagrees with its inputs is re-footed;
  - `deriveDCF` foots exactly the figures fixture 17 states.
- `report.test.ts`: a single-loan report gains no rows; stated redemption and
  common proceeds render as stored.
- The web editor's `footed-model.test.tsx`: an unrelated edit keeps the
  stated redemption and re-foots common; editing the redemption re-foots
  common. Also checked by hand in the running editor.
- Tier-1 reader fixture `17-exit-proceeds-junior-capital`: a senior,
  mezzanine, preferred and common stack with every exit figure stated. It
  validates clean, and its four baselines and v2 cases are generated.

Against the previous `deriveDCF`, five of the new footing tests fail,
including the fixture-17 agreement test. The guard that no redemption is ever
derived passes on both.

## Reference implementation

- **Files affected:** `packages/uwmd-core/src/dcf.ts` and `report.ts` (and
  their tests), `tools/web-editor/src/components/DcfModel.tsx` (and its
  test), Format §4.9, and tier-1 fixture 17 with its baselines.
- **API surface:** none beyond one more footed field path.

## Owner acceptance record (2026-10-07)

The owner accepted D1–D6 as recommended on 2026-10-07 and directed
implementation. No decision was changed. Merging the implementation's pull
request records the acceptance.

## Alternatives considered

| Alternative | Reason not selected |
|---|---|
| **(a) Redefine `net_proceeds_to_equity` as common's residual**, subtracting a stated redemption when present (StackUW's reading) | The field's meaning would depend on whether another field is stated. Two documents with the same stack would disagree on what the field measures, the comparability failure RFC 0038 fixed for return bases. It also contradicts §4.24, which counts preferred equity as equity. |
| **(a′) Subtract the pref tranche's `amount` from the stack** | The committed amount is not the redemption: accrued return is missing, and computing it needs conventions UWMD does not define (RFC 0052, financing brief). It would also read §4.24 from `dcf`, against RFC 0033's point-in-time scope. |
| **(c) Make the field producer-defined when preferred equity exists, and stop footing it** | A field no reader can interpret. It also gives up the editor's consistency for every stack document. |
| **One `junior_capital_repaid_at_exit` covering mezzanine and pref** | Mezzanine is debt. D2 puts it in `loan_balance_at_exit`, so the equity line stays clean. Lumping the two would hide whether common's residual is after debt or after equity. |
| **A validation code when a pref tranche exists but no redemption is stated** | A new MUST for an optional, opt-in breakdown. The redemption is legitimately unknown in early underwriting. |

## Unresolved questions

None. D1–D6 are accepted.

Out of scope, recorded so it is not mistaken for decided: which equity the
`returns` metrics describe when preferred equity exists (D6).

## Prior art

- RFC 0038 (`returns.tax_basis`): one declared meaning per field, never
  inferred from context.
- RFC 0052: exit deductions are stated cash, not recomputed percentages.
- RFC 0033 and §4.27: the capital stack is one point in time, and the
  distribution waterfall splits the equity side.
- Common CRE models present "net sale proceeds", less the loan payoff, as
  proceeds "to equity", then split them through the equity waterfall.
