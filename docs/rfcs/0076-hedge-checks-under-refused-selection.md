---
rfc: 0076
title: Refuse a stated rate hedge whose loan or cash lines cannot be selected
status: draft
author: claude-code (agent proposal)
created: 2026-10-06
depends_on:
  - 0040
  - 0056
  - 0070
  - 0075
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0076: Refuse a stated rate hedge whose loan or cash lines cannot be selected

**Draft for owner review.** A coding agent wrote this RFC. It answers
[RFC 0075](0075-hedge-senior-role-preference.md)'s one unresolved question,
which issue #266 also raised (its point 3). It changes no normative text,
code or fixture by being here. Every decision below has a recommended answer
drawn from existing contracts. The owner accepts, changes or rejects them.
The implementation follows acceptance.

## Summary

The rate-hedge rules read one `debt_structure` block, and ESC-04 and HDG-05
compare it with one `sources_uses` block. When either selection **refuses**
under format §5.3, today's hedge pass treats the unreadable side as absent.
Three things follow:

- a stated hedge, valid or malformed, goes unchecked, and nothing says so;
- ESC-04 **misreports** a lawful document, telling the author that a
  replacement escrow lacks `replace`, or that `replace` lacks an escrow, when
  the other side simply could not be read;
- whether the refusal is an error depends on whether
  `replacement_funding` happens to be stated.

This RFC applies RFC 0070's existing rule, "refuse; never treat it as
absence", to the whole hedge family. A stated hedge whose loan or cash lines
cannot be selected reports one `HDG-08`. No rule that needs the refused side
is evaluated. Absent sections, documents with no hedge, and every
resolvable document are unchanged. No new code, field or export.

## Motivation

### What happens today

Measured on `claude/hedge-senior-preference` (RFC 0075, PR #276). A
`debt_structure` selection refuses only when its blocks carry `_role`. A
role-free section is never a variant map, because the parser keeps one block.
These four refusal paths behave identically: two `senior`, two `primary`, two
`junior`, and only `component` blocks.

| Stated on a refused `debt_structure` | Findings | Verifier |
|---|---|---|
| hedge with `replacement_funding` (outright) | HDG-08, CC-16 | `unverifiable/unresolvable_source` |
| hedge with no funding, valid | CC-16 | `not_checked/not_applicable` |
| hedge with no funding, **malformed** (a string, a percent strike) | CC-16 | `not_checked/not_applicable` |
| hedge `replace`, with a lawful `rate_cap_replacement` escrow | **ESC-04**, CC-16 | `unverifiable/invalid_structure` |
| no hedge on any block, with a replacement escrow | ESC-04, CC-16 | `unverifiable/invalid_structure` |

The same hedges on a lone senior give the expected results: nothing, nothing,
HDG-01, HDG-01, nothing and ESC-04.

The cash side has the same defect. With one readable `replace` hedge and a
`sources_uses` of two `primary` blocks, **both of which state the
replacement escrow**:

| Hedge | Findings | Verifier |
|---|---|---|
| `replace`, no funding | **ESC-04**, CC-16 | `unverifiable/invalid_structure` |
| `replace`, escrow mode | HDG-08, **ESC-04**, CC-16 | `unverifiable/unresolvable_source` |
| `unhedged` | CC-16 | `not_checked/not_applicable` |

### Why it matters

- **ESC-04 tells the author something false.** Its message, "a
  rate_cap_replacement escrow requires replace … (found undefined)", sends
  the author to fix a hedge that already says `replace`. The real problem is
  the role collision.
- **A malformed hedge is silent.** CC-16 is `info` and names only the
  cross-checks (CC-02/03/05/09). Nothing points at the hedge.
- **RFC 0070 already decided this for one member.** Protocol §V.12.1 step 1:
  "If a selection needed for a stated new funding object is ambiguous or
  unresolvable, refuse; never treat it as absence." Today the presence of
  `replacement_funding` decides between an error and silence, though the
  hedge is equally unreadable either way.

## Proposed change

### Decisions

| # | Question | Recommended answer | Why |
|---|---|---|---|
| D1 | What does a stated hedge report when the `debt_structure` selection refuses? | One `HDG-08`, with field `rate_hedge`. No other HDG rule and no ESC-04 is evaluated. | HDG-08 already is "require unambiguous property-level debt/sources selection" (format §4.7). Step 1's "never treat it as absence" is the existing rule. Evaluating HDG-01–06 on an arbitrary block would be choosing by fence order, which step 1 forbids. |
| D2 | What counts as "stated" when no block is selected? | Any current `debt_structure` block with a non-null `rate_hedge`. | This is the scope today's HDG-08 already scans for `replacement_funding` (`sectionBlocks`, every current block), widened from the member to the object. One rule, one scope. |
| D3 | What does a readable hedge report when the `sources_uses` selection refuses? | The debt-only rules run (HDG-01–04, 06, 07). One `HDG-08` names `sources_uses`. HDG-05 and ESC-04 are not evaluated. | HDG-05 and ESC-04 compare the hedge with the cash lines. With the cash side unreadable, neither comparison can be made, so neither can pass or fail. RFC 0070 already reports this HDG-08 when funding is stated. |
| D4 | Severity? | `error`, HDG-08's existing severity. | A stated cap is a lender condition, and RFC 0056 (HDG-06) treats hiding its cliff as the failure to avoid. CC-16 is `info` because a cross-check that cannot run removes no stated fact. Here a stated fact goes unchecked and ESC-04 cannot be judged. |
| D5 | Does the verifier change? | It reports `unverifiable/unresolvable_source` whenever D1 or D3 applies, including a hedge that states no funding. | `unresolvable_source` is its existing reason for a refused selection. With the loan unknown, "no funding is stated on the hedge's loan" cannot be established, so `not_applicable` would overclaim. |
| D6 | Does CC-16 or the coverage record change? | No. | Coverage is keyed by `CROSS_CHECK_RULE_IDS`, the cross-checks (RFC 0037). Adding hedge rules would grow a public result surface for a condition HDG-08 already reports. |
| D7 | What stays unchanged? | Absent `sources_uses` or `uses` (ESC-04 still enforced); documents with no stated hedge, including ESC-04 for a replacement escrow beside no hedge; every resolvable document; ESC-01–03; the RFC 0075 selection. | Absence is not refusal. Format §4.8 ESC-04: "Missing sources_uses or uses is not an exemption". With no hedge stated anywhere, ESC-04's "a replacement escrow requires `replace`" is true whatever the selection. |

### Format §4.7 (`HDG-08` bullet)

Add:

> A stated `rate_hedge` (non-null, on any current `debt_structure` block when
> none is selected) whose `debt_structure` or `sources_uses` selection is
> ambiguous or unresolvable under §5.3 MUST report `HDG-08`, once. Rules that
> read the refused section are not evaluated. Absent sections are not
> refusals (§4.8 ESC-04). A section with no stated hedge reports nothing
> here (RFC 0076).

### Format §4.8 (`ESC-04` bullet)

Add:

> ESC-04 is not evaluated when a stated hedge's `debt_structure` or
> `sources_uses` selection refuses. `HDG-08` reports that instead (RFC 0076).

### Protocol §V.12.1 step 1

Before:

> If a selection needed for a stated new funding object is ambiguous or
> unresolvable, refuse; never treat it as absence or choose by fence order.

After:

> If a selection needed for a stated `rate_hedge`, with or without a funding
> object, is ambiguous or unresolvable, refuse with `HDG-08` and report
> `unverifiable/unresolvable_source`; never treat it as absence or choose by
> fence order (RFC 0076).

### Library

No export, type or parameter changes. `checkReplacementFundingStructure`
flags a refused selection for any stated hedge, not only a stated funding
object. The validator's hedge pass reads that flag and skips HDG-05 and
ESC-04. `HDG-08`'s remediation copy in `BUILTIN_REMEDIATIONS` gains the
general case.

## Compatibility analysis

- **Newly an error:** a stated hedge with no `replacement_funding` on a
  refused `debt_structure`, or with a refused `sources_uses`. Today these are
  silent apart from CC-16 `info`. Producers fix them the way they fix CC-16:
  resolve the role collision, or give the hedge's loan a unique `senior`
  (RFC 0075).
- **A different error:** a `replace` hedge with a lawful replacement escrow
  on either refused path reports `HDG-08` instead of a misleading `ESC-04`.
  In escrow mode on a refused `sources_uses`, `HDG-08, ESC-04` becomes
  `HDG-08`. The error count is unchanged or lower, and the code now names the
  real problem.
- **Verifier:** the newly covered documents move from `not_checked` to
  `unverifiable/unresolvable_source`. A consumer that claims complete
  outright verification already requires `verified`.
- **Pari-passu senior notes with one cap.** Two `senior` blocks with a hedge
  become an error. RFC 0040 already refuses to choose between them for every
  lender-side cross-check. One cap covering the whole loan belongs on one
  block that states the whole loan.
- **Unchanged:** every existing conformance fixture, including
  `0070-ambiguous-debt`, `0070-ambiguous-sources`,
  `0070-missing-sources-uses` and `0070-missing-uses`.
- **Tiers:** Tier-1 readers are unaffected. Tier-2 editors preserve bytes.
  Tier-3 calculations never inherit a check's selection (RFC 0041). Tier-4
  hosts see an existing code. **Modules:** no change.

## Conformance impact

No existing fixture changes. New `conformance/hedge/0076-*` cases, in the
RFC 0070 expected.json shape, derived from 0070/0075 cases by editing only
roles, keys and the hedge:

| Case | Codes today | Proposed | Verifier (proposed) |
|---|---|---|---|
| `0076-two-seniors-hedge-unfunded` | none | HDG-08 | `unverifiable/unresolvable_source` |
| `0076-two-seniors-hedge-malformed` | none | HDG-08 | `unverifiable/unresolvable_source` |
| `0076-two-seniors-replace-escrow` | ESC-04 | HDG-08 | `unverifiable/unresolvable_source` |
| `0076-components-only-hedge` | none | HDG-08 | `unverifiable/unresolvable_source` |
| `0076-sources-refused-replace` | ESC-04 | HDG-08 | `unverifiable/unresolvable_source` |
| `0076-sources-refused-escrow-mode` | HDG-08, ESC-04 | HDG-08 | `unverifiable/unresolvable_source` |
| `0076-sources-refused-malformed-hedge` | HDG-01 | HDG-01, HDG-08 | `unverifiable/unresolvable_source` |
| `0076-two-seniors-no-hedge-escrow` (control) | ESC-04 | ESC-04 | `unverifiable/invalid_structure` |

CC-16 still accompanies each refused case and is not part of the hedge
projection. The control pins D7. RFC 0075's two `undecided:` unit tests in
`validator.hedge.test.ts` are replaced by these cases.

## Reference implementation

- **Files affected:** `replacement-funding-structure.ts` (the refusal
  trigger), `validator.ts` (skip HDG-05 and ESC-04 on the flag), `protocol.ts`
  (HDG-08 remediation copy), tests and fixtures.
- **API surface:** none.
- **Test plan:**
  - the fixtures above, run by both drivers, with a negative control
    against the RFC 0075 code;
  - unit tests for D2's scope (a hedge on a component block when no block is
    eligible) and D3's split (debt-only rules still run);
  - a test that absence (D7) still reports ESC-04.

## Alternatives considered

| Alternative | Reason not selected |
|---|---|
| **Stay silent, but stop ESC-04 misreporting** | Fixes the false message only. A malformed or unreadable hedge still passes with nothing but an `info` that names other rules. It also keeps the error-or-silence split on `replacement_funding`. |
| **Join CC-16's skip record** (hedge rules in `coverage`, named in CC-16) | Grows the public coverage surface beyond the cross-checks (RFC 0037), and makes the outcome `info` where RFC 0070 already chose `error` for the same condition. |
| **A new `info` code** (for example `HDG-11`) | A second code for HDG-08's condition, split by whether funding is stated. Each new code also costs every adopter's remediation table. |
| **Let the hedge locate its loan**: if exactly one block states a hedge, read that one | Selection by content. RFC 0040 forbids it ("never … guess"), and step 1 forbids choosing by fence order. Two seniors are refused for every lender-side rule; the hedge should not quietly disagree. |
| **Evaluate the hedge rules on every block** | Per-tranche hedges, which RFC 0070 defers to a separate adopter-backed contract, and which ESC-04's single property-level escrow cannot express. |
| **Report a refused `sources_uses` only for `replace` hedges** | ESC-04 also judges the other direction: a replacement escrow under `unhedged` or `loan_matures_first`. HDG-05 needs the cash side for any hedge. A narrower trigger would leave those silently unjudged. |

## Unresolved questions

None for the owner, beyond accepting or changing D1–D7.

Out of scope, recorded so it is not mistaken for decided: when `sources_uses`
refuses and **no** hedge is stated, ESC-01–03 also go unevaluated and only
CC-16 reports. That is an escrow-only question, not a hedge question, and
this RFC leaves it as it is.

## Prior art

- RFC 0070, Protocol §V.12.1 step 1: refuse a needed selection; never treat
  it as absence.
- RFC 0040 / format §5.3: a consulted role collision refuses without
  fallback, and CC-16 records skipped cross-checks.
- JSON Schema's distinction between an absent property and an invalid one
  (`required` versus a failing subschema) mirrors D7's absence/refusal line.
