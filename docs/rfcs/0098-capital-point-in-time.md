---
rfc: 0098
title: Declare the point in time of the capital stack and senior loans, and reconcile CC-03 per point
status: accepted
author: UWMD maintainers
created: 2026-10-19
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0098: Declare the point in time of the capital stack and senior loans, and reconcile CC-03 per point

> **Accepted by the UWMD maintainers, 2026-10-19, as drafted** (owner: "RFC 0098 (#402) is
> accepted as drafted; implement it"). The Decisions table D1–D9 stands as
> written. This is a breaking format change (a newly required field); it opened
> alone as a draft, and the synchronized implementation follows in
> its own PR.

## Summary

`capital_stack` (§ 4.24) gains a **required** `point_in_time`, either `closing`
or `stabilization`. A `debt_structure` block (§ 4.7) MAY state the same field.
When a block omits it, the loan is outstanding at both points: one loan held
through the deal, which covers every single-loan record. § 4.8 states that
`sources_uses` is the closing statement. `CC-03` then compares only like-dated
figures. For each point it selects one senior `debt_structure` from the blocks
outstanding at that point, using the unchanged RFC 0040 order. It compares
`sources_uses` with the closing senior, and the stack's `senior_debt` tranche
with the senior outstanding at the stack's point. A leg with no figure for its
point is `not_applicable` in coverage, not an error. A construction-to-permanent
record whose figures are all correct passes `CC-03`. Arithmetic and the $100
tolerance do not change.

## Motivation

Issue #403, filed by an adopter, reports a correct
construction-to-permanent record that fails `CC-03` with an error:

- `capital_stack` is one point in time. [RFC 0033](./0033-capital-stack-point-in-time.md)
  makes it the stabilized stack for a deal underwritten to stabilization, so its
  `senior_debt` tranche is the permanent takeout.
- `sources_uses` states the closing. At closing the senior source is the
  construction facility, on its own line, and `sources.loan_amount` (the takeout)
  is 0.
- The record carries two senior `debt_structure` blocks, the construction facility
  and the takeout, both declaring `_role: senior`. RFC 0040 role selection finds a
  role collision, records `variant_unresolvable` and emits `CC-16`, so `CC-03`
  selects no `debt_structure`.
- With no `debt_structure` selected, the stack leg falls back to the closing figure
  (`validator.ts`, `reference = dsLoan ?? suLoan`). It compares the 18,000,000
  takeout with 0 and raises `CC-03` (error).

Every figure is right. No section says which date its senior figure describes, so
the check compares a stabilization amount with a closing amount. The adopter
refuses to sign such records today, and before RFC 0033 its predecessor suppressed
`capital_stack` on development deals altogether.

RFC 0033 anticipated this. It rejected a temporal marker in 2026-09 because
per-phase reconciliation had no defined semantics ("which phase does `CC-03` check
against `debt_structure`?"). It left open "whether `sources_uses` needs a matching
statement". This RFC answers both questions for the two points the standard
already reasons about, and only those two.

## Proposed change

### 1. Format § 4.24 `capital_stack`: a required `point_in_time`

Add to the section's top-level fields and normative rules:

> - `point_in_time` — REQUIRED. `closing` or `stabilization`. Non-extensible. It
>   names the one point in time the stack describes (RFC 0033): `closing` for
>   the capitalization funded at closing (including a deal underwritten during its
>   bridge period), and `stabilization` for the stabilized (permanent)
>   capitalization. A stack that omits it, or states any other value, MUST be
>   rejected (`CS-04`).

RFC 0033's rule is unchanged: the stack states one point, and facilities that do
not coexist at that point MUST NOT be concurrent tranches. RFC 0033 could not check
this mechanically. The declared point now lets `CC-03` read the right senior.

A mixed-use component stack (§ 4.23) has the same shape and carries the same
required field, with the same `CS-04` rule. `CC-03` still does not apply to it.

### 2. Format § 4.7 `debt_structure`: an optional `point_in_time`

> - `point_in_time` — OPTIONAL. `closing` or `stabilization`. Non-extensible.
>   It names the only point at which this loan is outstanding: `closing` for a
>   facility retired before stabilization (a construction loan, typically), and
>   `stabilization` for a facility first funded after closing (a permanent
>   takeout). A block that omits it states a loan outstanding at **both** points,
>   one loan for the hold. A stated value outside the vocabulary MUST be rejected
>   (`DS-01`).

The field describes when the loan exists. It does not change any `debt_structure`
figure, and `loan_purpose`/`loan_type` keep their meaning. A producer MUST NOT
infer `point_in_time` from `loan_purpose: construction`. A construction loan that
converts to permanent is one loan outstanding at both points and states no
`point_in_time`.

### 3. Format § 4.8 `sources_uses`: the closing statement

> `sources_uses` states the closing: the sources that fund the deal and the uses
> they pay for, at closing. Its senior bucket (`sources.loan_amount`, or
> `sources.debt_proceeds` when that is absent) is a **closing** figure.

No field is added. A facility funded at closing appears in sources however it is
retired later. This answers RFC 0033's second unresolved question.

### 4. Format § 5.3 `CC-03`: reconcile per point

Replace the `CC-03` description in the § 5.3 table and the § 4.24 bullet ("same
amount, same rate") with:

> **`CC-03` — senior loan reconciles at each point in time.** For a point *P*
> (`closing` or `stabilization`), the **senior candidates at *P*** are the current
> `debt_structure` blocks whose `point_in_time` is *P* or absent. `CC-03` selects
> at most one block per point by the unchanged § 5.3 resolution order (`CC-03`'s
> registered preference `senior`, then the RFC 0040 sequence its `via` values
> name), applied to the candidates at that point only. A standalone `debt_structure` is the single candidate at
> every point it is outstanding. Two legs:
>
> 1. **Closing leg.** The `sources_uses` senior bucket against the `loan_amount`
>    of the senior selected at `closing`.
> 2. **Stack leg.** When a top-level `capital_stack` is present, its `senior_debt`
>    tranche `amount` against the `loan_amount` of the senior selected at the
>    stack's `point_in_time`. When the stack is at `closing` and that senior
>    states no `loan_amount`, the reference is the `sources_uses` senior bucket,
>    as today. A `stabilization` stack never falls back to `sources_uses`, which
>    is a closing figure.
>
> Each leg compares within the existing $100 tolerance and reports `CC-03`
> (error) at the existing field. A leg that has no selected senior at its point,
> or no figure on either side, does not apply. The rule is `evaluated` when either
> leg compared. Otherwise it is `skipped` under the existing reasons:
> `variant_unresolvable` when the candidates at a point collide,
> `section_absent`, `field_absent`, or `not_applicable` with a detail naming the
> point (for example `no stabilization senior debt_structure`).

A role collision is now judged within one point's candidates. In #403's record,
the construction facility (`closing`) and the takeout (`stabilization`) are each
the sole `senior` candidate at their point, so neither collides. Two senior blocks
at the same point (or two that omit the field) still collide, exactly as today.

This RFC preserves the bullet's "same rate" clause per point and does not change
which figures `CC-03` compares; see *Unresolved questions*.

### 5. Protocol: role preference and coverage evidence

- `CROSS_CHECK_ROLE_PREFERENCE['CC-03']` is unchanged (`debt_structure: senior`).
  The Protocol's § 5.3 resolution text gains one sentence: a check that resolves
  per point (`CC-03` only, in this RFC) applies the order to each point's
  candidates separately.
- **Selection evidence (RFC 0040).** Coverage `resolutions` today maps a section
  id to one `{ variant?, via }`. `CC-03` can make two `debt_structure` selections.
  It records them under the keys `debt_structure@closing` and
  `debt_structure@stabilization`, one per point that resolved. No other check's
  keys change. The coverage schema admits the `@closing`/`@stabilization` suffix
  on `debt_structure` for `CC-03` only.
- Two diagnostics are added to the closed registry: `CS-04` (error, § 4.24:
  `capital_stack.point_in_time` absent or outside the vocabulary) and `DS-01`
  (error, § 4.7: a stated `debt_structure.point_in_time` outside the vocabulary).

### 6. Schemas

- `section-capital-stack.schema.json`: add `point_in_time`
  (`enum: ["closing", "stabilization"]`) to `properties` and to `required`. The
  schema stays closed.
- `debt_structure` has no section schema today. The field is validated in code
  (`DS-01`) and documented in § 4.7. No new schema file is added.
- The coverage `resolutions` key pattern widens as in § 5 above.

## Compatibility analysis

This is a **breaking** format change, deliberately: `point_in_time` is required on
every `capital_stack`.

- **Existing `.uw.md` files.** Every document that carries a `capital_stack`
  (top-level or a mixed-use component's) fails `CS-04` until it states
  `point_in_time`. The corpus and examples hold 10 such documents. Under RFC 0033
  their stacks are already one point in time, so each gains
  `point_in_time: stabilization` (or `closing` where it states a bridge-period
  stack) with no other change. A `debt_structure` without the field keeps its
  exact current meaning. A record with no `capital_stack` is unaffected.
- **Implementers.** A Reader is unaffected. A Verifier must implement `CS-04`,
  `DS-01`, per-point candidates and the widened `resolutions` keys. The
  independent Python implementation (Issue #354) follows in the same
  synchronized implementation, as RFCs 0090 to 0097 did.
- **Adopters.** Adopters state the field on emitted stacks. The reporting
  adopter can sign construction-to-permanent records once it lands.
- **Transition.** None, by the prelaunch rule: no grandfathering, default or deprecation period
  for the required field. Absence on `debt_structure` is not a compatibility
  default. It is the defined meaning "outstanding at both points" (see
  *Alternatives*).
- **Versions.** Following RFC 0091's D6, acceptance allocates no Format,
  Protocol or package version. Prelaunch work stays 4.x, and the coordinated 5.0
  launch is the owner's.

## Conformance impact

Existing inputs updated (expected findings unchanged unless noted):

- the seven `conformance/` documents that state a `capital_stack` gain
  `point_in_time: stabilization`:
  `capital-stack/reject-waterfall-in-v1/deal.uwx.md`,
  `capital-stack/senior-reconciles-debt-structure/{agree,mismatch}.uwx.md`,
  `capital-stack/split-coupon-bad-fields/deal.uwx.md`,
  `documents/fixtures/17-exit-proceeds-junior-capital.uwx.md`, and
  `documents/malformed/{46-payload-sizing,48-payload-lawful}.uwx.md`. The
  component stack in `46-payload-sizing` gets the field too. Any receipt or
  digest expectation over a changed input is regenerated from the unchanged
  procedure, and the PR names each one.
- `examples/Agave-Court-Apts-Scottsdale-AZ.uwx.md` and `examples/verification/*`:
  the same edit.

New cases, under `conformance/capital-stack/`, all synthetic with round amounts:

1. `construction-takeout-reconciles`: #403's example. A `stabilization` stack
   (senior 18,000,000, mezzanine 2,000,000), a `closing` construction block with
   no `loan_amount`, a `stabilization` takeout at 18,000,000, and `sources_uses`
   `sources.loan_amount` 0. Expect no `CC-03`, `CC-03` `evaluated`, no `CC-16`
   for `CC-03`, and both `resolutions` keys.
2. `construction-takeout-disagrees`: the same record with the takeout at
   18,500,000. Expect `CC-03` on `tranches.senior_debt.amount`.
3. `closing-leg-disagrees`: the construction block states 17,000,000 and
   `sources_uses` states 16,000,000. Expect `CC-03` on `sources.loan_amount`.
4. `single-loan-both-points`: one `debt_structure` with no `point_in_time` and a
   `stabilization` stack. Both legs compare the one loan, matching today's results.
5. `same-point-collision`: two `senior` blocks both at `stabilization`. Expect
   `variant_unresolvable` and `CC-16` as today.
6. `stabilization-no-fallback`: a `stabilization` stack, a `closing`-only senior
   and `sources_uses` 0. The stack leg is `not_applicable`, not compared with
   `sources_uses`.
7. `stack-point-in-time-absent` and `stack-point-in-time-unknown`: `CS-04`.
8. `debt-point-in-time-unknown`: `DS-01`.

Each case runs through the RFC 0004 runner, so the Python implementation is held
to it by the same corpus.

## Reference implementation

- **`@uwmd/verify` `validator.ts`:** `CC-03` builds candidates per point and
  resolves each with the existing `resolveCrossCheckSection` machinery restricted
  to those blocks. It adds `CS-04` beside `CS-01`/`CS-02` in `checkStackContent`
  (`CS-03` stays in `payload-admission.ts`) and adds `DS-01`. `protocol.ts` registers the two codes and the § 5.3 sentence
  and widens the coverage `resolutions` type. `index.ts` gains no new export.
- **Schemas:** `section-capital-stack.schema.json`, and the coverage pattern.
- **Python (`implementations/python`):** the same per-point candidates, codes and
  coverage keys in its validation modules. It is held by the corpus above.
- **Starter tools:** the web editor has no capital-stack surface, so nothing
  changes there; it shows `CS-04`/`DS-01` through its existing per-section issue
  list. Excel output is unchanged.
- **Tests:** a `validator.capital-stack.test.ts` block per new case, and a negative
  control showing that removing the per-point filter reproduces #403's false
  error.

## Alternatives considered

- **Additive and optional on both sections (#403's own shape).** Absent on the
  stack would mean "behave as today". It is equally sound for `CC-03`, but it
  keeps RFC 0033's one-point rule uncheckable for every stack that omits the
  field, and it adds a second, undated way to state a stack. With compatibility
  waived, requiring the field on the one section whose meaning is "one point in
  time" is cleaner.
- **Required on `debt_structure` too.** A single-valued required field cannot say
  "one loan held through both points", the most common record. That needs a third
  value (`both`) or an array (`[closing, stabilization]`). Both add a token to
  every single-loan record to restate what absence already says, and they invite
  the illegal pair of a `both` block beside a dated one. The rejection is recorded
  so the owner can overrule it at acceptance.
- **Infer the point from `loan_purpose: construction` / `loan_type: construction`.**
  This is inference, which the standard refuses: a construction loan that converts
  to permanent is outstanding at both points, and a bridge loan can be either.
  The producer knows the point and states it.
- **Field name `stage` (the issue's word).** The Format already uses "stage" for
  the pipeline (`deal_stage`, and "Required for pipeline stage" on every section),
  and `deal_stage` itself takes the value `closing`. `capital_stack.stage: closing`
  would read as a pipeline milestone. `point_in_time` is RFC 0033's own term for
  exactly this property.
- **Skip the `sources_uses` leg when the stack is stabilized.** `CC-03` would stop
  comparing instead of comparing like with like (rejected in #403).
- **Per-tranche dating (`active_from`/`retired_by`) or one stack per phase.** This
  is RFC 0033's deferred Phase 2 design. It needs the multi-period spine to verify
  sizing per phase. This RFC dates whole sections at two named points, which needs
  no spine and leaves that design open.

## Unresolved questions

- **CC-03's rate leg.** § 4.24 says the senior tranche reconciles in "same amount,
  same rate", but the TypeScript `CC-03` at `16cf18c3` compares amounts only. The
  independent Python ledger records a tranche `rate` against
  `debt_structure.interest_rate` comparison. That divergence predates this RFC and
  is filed separately as [#406](https://github.com/UWMD-OSP/UW-Markdown/issues/406). Whatever resolves it applies per point
  under this RFC.
- **Other senior-preferring checks.** `CC-02`, `CC-05`, `CC-09`, `HDG-01`–`HDG-10`
  and `ESC-04` keep their single selection. In a two-senior record they still meet
  the role collision, record `variant_unresolvable` and emit `CC-16` (`info`),
  which does not fail the record. Which point each should read (for example
  `CC-05`'s DSCR against stabilized NOI) is a separate question for its own RFC,
  together with #382 / RFC 0092's construction-and-takeout LTV basis.
- **Points beyond two.** As-is / as-stabilized dual sizing and draw-period points
  stay with the Phase 2 multi-period spine (RFC 0026 § D; RFC 0033).

## Decisions (accepted)

| # | Question | Proposal | Why (precedent) |
|---|---|---|---|
| D1 | Field name | `point_in_time` | RFC 0033's term; `stage`/`closing` collide with `deal_stage` |
| D2 | Required where | Required on `capital_stack`; optional on `debt_structure` with absence = both points | RFC 0033 makes every stack one point; absence is a defined meaning, not a default |
| D3 | Vocabulary | Closed: `closing`, `stabilization` | The two points `sources_uses` and RFC 0033 already name; closed vocabularies refuse unknown values |
| D4 | `sources_uses` | Defined as the closing statement; no field | Answers RFC 0033's unresolved question without a shape change |
| D5 | Selection | RFC 0040 order applied within each point's candidates; collisions judged per point | No new selection order; same-point collisions unchanged |
| D6 | Fallback | Stack leg falls back to `sources_uses` only for a `closing` stack | Keeps today's fallback where it is like-dated |
| D7 | Coverage | Existing four skip reasons; `resolutions` keys `debt_structure@<point>` for `CC-03` | No new reason; two selections need two keys |
| D8 | Diagnostics | `CS-04` (stack field), `DS-01` (debt field), both errors | Admission codes separate from reconciliation (RFC 0096 precedent) |
| D9 | Versions | None allocated; prelaunch 4.x | RFC 0091 D6 |

## Prior art

- Lender practice dates each facility. A construction loan agreement and a
  permanent loan commitment are separate instruments with separate funding
  dates, and a takeout commitment is underwritten to stabilization. The closing
  statement (settlement statement) lists only what funds at closing. This RFC
  states those two documents' dates on the sections that mirror them.
- RFC 0033 and RFC 0026 § D of this project, which fixed the stack to one point
  and deferred phased stacks.
