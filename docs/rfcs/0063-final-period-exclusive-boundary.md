---
rfc: 0063
title: Admit disposition at the final calendar period's exclusive boundary
status: implemented
accepted: 2026-09-24
implemented: 2026-10-02
author: codex
created: 2026-09-24
affects:
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0063: Final-period exclusive-boundary admission

## Summary

Add an optional `disposition_period_rule` to the RFC 0045 property cash-flow
assembly plan. Its value `allow_exclusive_end` admits economic disposition
either inside the final source calendar period, as today, or exactly on that
period's exclusive upper boundary. The rule covers both existing monthly and
quarterly cadences. The absent/default rule remains `within_final_period`.
Every cash date still lies inside the closed acquisition/disposition interval;
there is no post-sale settlement horizon, new operating period or proration.

**Implemented; released in 2.14.0.** Jared accepted this RFC's final text at
`f04b34ab5606264424bddc02b09ced256a09bbcc` on 2026-09-24 and authorized
implementation. The capability shipped in core/CLI **2.14.0**, published from
the `v2.14.0` tag on 2026-10-02. The preceding [design review](../reviews/2026-09-24-terminal-boundary-design.md)
was integrated in canonical `main` at `22d993b5c5d6d3710a60af1ab9e5e0cf987cdda4`.
The implementation integrated on canonical `main` at `413a645` is Protocol
**2.18.0**, including the RFC 0062 errata selected as 2.17.1. Format is
unchanged; the 2.14.0 package generation was merged to `main` by PR #218.

## Motivation

[Protocol VIII.9.6.5](../../spec/UW_PROTOCOL_v1.md) requires disposition inside
the last source period. That intentional rule rejects a sale on the first day
following a complete final calendar period, even when every selected cash item
settles on or before the economic sale date.

The [completed-corpus review](../reviews/2026-09-24-completed-golden-corpus-validation.md)
and subsequent design review document multiple private monthly workflows with
this boundary convention. No reviewed investment stream demonstrates cash after
economic disposition. Their successful stated-series metrics and projections
do not establish complete model or assembly parity. One workflow also fails an
independent reserve assertion; this proposal cannot make that case eligible.
Private identities, values and source locators are unnecessary for the contract.

A synthetic example is a final period `2027-12` and explicitly stated economic
sale `2028-01-01`. December remains the final operating period, while its
authored cash and separately stated sale components can occur on January 1.
For `2027-Q4`, the same January 1 boundary follows the complete final quarter.
No January operation is inferred in either case.

## Proposed change

RFC 2119 terms below describe the **accepted** contract. Only the final-source-period admission test changes. RFC 0045's
other source, cash, coverage, basis, sign, provenance and refusal rules remain.

### 1. Explicit plan member

Proposed addition to the existing public `PropertyCashFlowPlan` interface:

```ts
disposition_period_rule?: 'within_final_period' | 'allow_exclusive_end';
```

This is a top-level plan member, alongside `disposition_date`, not an economic
assertion inside `assertions`. The API remains
`assemblePropertyCashFlows(parsed, plan)`; no new function, CLI flag, exported
helper or general date-policy object is proposed. The existing CLI plan JSON
carries the member when the caller opts in:

```json
{ "disposition_period_rule": "allow_exclusive_end" }
```

The fragment is not a complete assembly plan. All existing required members
remain required.

| Member state | Proposed semantics |
|---|---|
| Absent | Exactly today's `within_final_period` behavior, output and refusals. Do not insert a default into the input or copied result plan. |
| `within_final_period` | Explicitly requests the existing inside-final-period rule. Preserve this supplied member in the copied result plan. |
| `allow_exclusive_end` | Allows the existing inside-final-period case **or** equality with the derived exclusive upper boundary. Equality is an additional allowed date, not a required date. |
| Anything else, including `null`, booleans, an empty string, objects or unknown strings | Refuse `CALC-CF-ASSEMBLY` with reason `plan` at `plan.disposition_period_rule`. No coercion or fallback. |

At a JavaScript API boundary, an own property with value `undefined` is not
absence and MUST refuse. Unknown other plan/assertion members remain refused.
The plan JSON Schema would add one optional string enum property with these
two values, leaving `required` unchanged and `additionalProperties: false`.
The schema MUST NOT declare a `default` for this member, and hosts MUST NOT
materialize one. Shape validation alone does not prove the source-period/date
relationship.

The assembler MUST copy the caller's valid plan member verbatim into
`result.plan`, using the existing deep-copy/snapshot rules. An absent member
MUST remain absent. No new result-level date, completion state, digest or cash
row is introduced. An explicit legacy value can therefore differ from an
absent value in the echoed plan only; the assembled series and all other
evidence remain the same for otherwise identical inputs.

### 2. One calendar concept for both cadences

After existing source selection and structural/financial verification, identify
the final period from the complete selected source schedule. It is the greatest
canonical period in its already validated, strictly increasing, gap-free
monthly or quarterly sequence. Use its stated `period` identity and declared
cadence. A row's position, the number of rows, acquisition date, a label, or the
cash-date map MUST NOT be used to manufacture the calendar identity.

Define the exclusive upper boundary as the first calendar date after that
period. The following integer calendar derivation is normative; its helper name
and code organization are implementation details:

1. Parse the existing canonical `YYYY-MM` or `YYYY-Qn` identity. Let `y` be its
   stated year. For a month, let `m` be its month and `width = 1`. For a quarter,
   let `m = 3 * (n - 1) + 1` and `width = 3`.
2. Set `nextMonth = m + width`. If it exceeds 12, set `nextYear = y + 1` and
   subtract 12 from `nextMonth`; otherwise `nextYear = y`.
3. The boundary is `nextYear-nextMonth-01`, with the existing four-digit year
   and two-digit month/day padding. Use calendar integers, with no local time,
   timezone, elapsed-day approximation or financial day-count calculation.

The public Golden Deal review directly demonstrates the monthly boundary
case only. RFC 0045 already accepts monthly and quarterly source schedules;
both use canonical calendar-period identities and have a deterministically
derivable exclusive upper boundary. The same period-start-plus-cadence rule
therefore covers both, with no different financial arithmetic or economic
assumption. Quarterly inclusion is an architectural generalization to an
already-supported cadence, not a claim that a Golden Deal demonstrated a
quarterly boundary case. Inspection found no semantic difference relevant to
this admission rule beyond calendar arithmetic.

| Final source period | Exclusive upper boundary |
|---|---|
| `2027-11` | `2027-12-01` |
| `2027-12` | `2028-01-01` |
| `2028-02` | `2028-03-01` |
| `2027-Q1` | `2027-04-01` |
| `2027-Q3` | `2027-10-01` |
| `2027-Q4` | `2028-01-01` |

Malformed periods, cadence mismatches, gaps, duplicates and disorder retain
their existing source refusals; the new rule MUST NOT normalize them. The
existing four-digit date grammar is not widened. If the mathematical boundary
would require year 10000 (`9999-12` or `9999-Q4`), no representable exclusive
boundary is newly admissible. A valid inside-period disposition remains
eligible under either value. Implementations MUST NOT wrap, truncate or clamp
the year, or reject an otherwise valid inside-period case merely because its
unused exclusive boundary is not representable. Leading-zero years retain
their literal calendar identity; no two-digit-year pivot is allowed.

### 3. Replacement disposition-admission rule

Replace only the inside-final-period requirement in Protocol VIII.9.6.5 with:

> The plan MUST state an acquisition date inside the first source period and
> acquisition MUST be strictly before disposition. If
> `disposition_period_rule` is absent or `within_final_period`, disposition
> MUST lie inside the final source calendar period under the existing rule.
> If it is `allow_exclusive_end`, disposition MUST either lie inside that
> final period or equal its exact exclusive upper calendar boundary as derived
> from its stated canonical period identity. No other date is admitted by
> this option. In particular, one day after the boundary MUST refuse; no
> intermediate grace window is introduced.

In predicate form, with `P` the validated final source period and `D` the
already validated disposition date:

```text
insideFinalPeriod(D, P)
OR (disposition_period_rule == "allow_exclusive_end"
    AND exclusiveUpperBoundary(P) is representable
    AND D == exclusiveUpperBoundary(P))
```

An invalid or out-of-range disposition continues to refuse
`CALC-CF-ASSEMBLY`, reason `date_horizon`, pointer `plan`. Existing refusal
ordering remains: plan and economic assertion checks, selection/source checks,
then hold-horizon/coverage/closing/sign checks in the existing order. The new
member's value validation belongs to plan validation. It MUST NOT bypass an
earlier refusal such as `reserve_spending_excluded: false`. No new error code
or issue-schema reason is required.

### 4. Economic and cash boundaries remain separate

`disposition_date` MUST remain the economic/property disposition date. This RFC
introduces no settlement date, settlement end, second sale date or deferred
closing period. A disposition on the exclusive boundary is the sale itself,
not a post-sale settlement.

All assembled cash MUST continue to satisfy:

```text
acquisition_date <= cash_date <= disposition_date
```

Acquisition-slot rows MUST occur on acquisition. Disposition-slot rows,
including stated `gross_sale`, transaction costs and any independently valid
`reserve_net` release, MUST occur on disposition. Period-slot rows retain their
explicitly authored cash dates under RFCs 0044/0045 and their existing coverage
ownership. They MAY occur on the exclusive-boundary disposition when within
the unchanged closed interval. The assembler MUST NOT move, infer or rewrite
any cash date, insert an anchor row, or duplicate a terminal component.

No cash after disposition becomes legal, including a row labeled receivable,
payable, reserve, escrow, tax true-up or delayed closing cost. RFC 0052 deduction
ownership, reserved financing names and net-sale verification remain unchanged;
gross sale excludes reserve return and MUST NOT become eventual net receipts.

### 5. Complete periods, explicit amounts and operating cutoff

The complete, gap-free selected source schedule remains mandatory. For the new
equality case, its final source period is the complete final operating/accrual
calendar period, ending immediately before economic disposition. The exclusive
boundary is a date boundary, not a new source period. The option MUST NOT
synthesize an extra month or quarter, invent a lease-up row, add a period
coverage cell, create a post-sale operating period, extend leasing, import
forward exit-NOI support as seller cash, prorate amounts, or infer
partial-period economics.

Existing inside-period dispositions continue to follow existing rules,
including explicitly authored amounts for partial-period economics. Opting in
does not force such a case to move to period end or reclassify its amounts.

The assembler MUST validate the entire selected source and require one cash-date
mapping per source period. It MUST NOT silently append or ignore a period or
extra mapping to satisfy the option. If an author changes the source schedule,
the actual final period is determined again and all source, horizon, cash and
coverage checks run again. There is no separate caller-provided final-period
override. This rule does not newly reject an inside-period plan solely because
an author supplied a different complete schedule that meets existing rules.

Calendar and cash cutoffs are mechanically checkable. Whether a stated amount
really represents only the declared hold remains an explicit author assertion.
Dates and labels do not prove that purported final-period cash excludes hidden
post-sale rent, OpEx, capex or leasing. `hold_only_and_exit_settled` remains true
and unchanged; no new economic verification claim is made.

### 6. Reserve, financing, arithmetic and row identity

Every existing reserve assertion remains required and literal `true`. Timing
admission MUST NOT cure any reserve refusal: a Golden Deal that fails
`reserve_spending_excluded` or another existing reserve assertion still fails.
This RFC adds no reserve roll-forward model for opening balance, contributions,
funded draws, internal reserve spending, reconciliation or ending balance, and
no inferred release. Existing explicitly stated external transfers remain
subject to RFC 0045 unchanged.
`reserve_net` remains an owner external-transfer boundary. A valid same-date
release can occur on boundary disposition, but this RFC MUST NOT calculate a
balance, infer a release, net reserve-funded spending against the lease-up
bundle, or assume an unknown/restricted terminal balance is zero. Funding,
contributions, draws, releases and balance reconciliation require a separate
reserve roll-forward contract. The reserve-dependent private workflow remains
unsupported by this proposal alone.

The assembly remains one-property, one-currency, unlevered and pre-tax. Debt
service, payoff, refinance, prepayment, defeasance, financing fees/reserves,
levered sale proceeds, investor distributions and investor tax remain excluded.
Generic verification of a separately stated levered stream does not authorize
financing assembly here.

Copy signed amounts exactly, preserve each row and its bindings, and retain the
existing deterministic sort and tie ordering. Use RFC 0034's existing explicit
dates, first actual cash-date anchor, day count, XIRR/XNPV/MOIC/total-net
algorithms, refusal conditions and quantization. No financial formula changes.
Same-day cash rows remain separate under accepted RFC 0062, including final
operating cash and sale rows sharing disposition. They MUST NOT be merged or
netted, and their deterministic tie ordering remains unchanged. No PS-02 arises
solely from their shared date; ambiguous requested dates refuse
`CALC-PERIOD-002`, unique dates select, and duplicate protection on other
registered series remains.
No numeric-index expression syntax or other calc-grammar change is authorized.

### Existing RFC interactions

| RFC | Preserved contract / narrow interaction |
|---|---|
| [0008](0008-lease-up-modeling.md) | Complete stated monthly/quarterly lease-up schedule, canonical period grammar, structural checks and stated-amount verification remain. No forecast generation or new cadence. |
| [0034](0034-calendar-anchored-cash-flows.md) | Existing dated series and metric arithmetic consume the copied dates/amounts. No synthetic anchor, new math or Excel XIRR parity promise. |
| [0041](0041-period-indexed-addressing.md) | Absolute canonical period identity supplies the boundary. No row-index-derived dates, new selector, implicit cadence conversion or change to period duplicate checks. Its cash-date duplicate interaction remains reconciled by RFC 0062. |
| [0044](0044-explicit-lease-up-cash-flow-projection.md) | Explicit dates can differ from accrual periods; complete projection and exact copying remain. The option belongs to assembly and MUST NOT be forwarded as a new projection-plan member. |
| [0045](0045-explicit-property-cash-flow-assembly.md) | Only final-period disposition admission expands on opt-in; acquisition, closed cash horizon, slots, signs, coverage, assertions, snapshots and provenance remain. |
| [0052](0052-named-exit-sale-deductions.md) | Named cost rows remain disposition-date cash; verify stated net proceeds without an extra cash row. No late costs or financing exception. |
| [0062](0062-same-day-cash-flow-selection.md) | Unchanged; shipped with this RFC in 2.14.0. Same-day legality, ambiguous-selector refusal, unique selection and other-series protections remain. |

## Compatibility analysis

- **Existing plans:** An absent member MUST preserve validation, serialized
  assembly output, source bytes, `_meta`, ordering, digests and refusals exactly.
  Do not emit a default field, normalize legacy plans or move their dates.
  No previously refused legacy plan becomes accepted and no existing result
  changes. Explicit `within_final_period` MUST have the same validation,
  admission, assembly and refusal semantics as omission, with only the
  supplied member additionally echoed in `result.plan` under the existing
  plan-copy rule. That representation difference adds no behavioral difference.
- **Newly admissible plans:** `allow_exclusive_end` changes only the final-date
  admission predicate. Otherwise valid boundary plans can succeed; dates after
  that boundary, cash after disposition and all independent failures still
  refuse. An already valid inside-period plan produces the same series and
  evidence except for the copied opt-in member. Published core/CLI 2.13.0 reject
  the new field, including the explicit legacy value, as an unknown member;
  callers need an implementation of Protocol 2.18.0 to use it.
- **Persisted documents / Format:** Existing Lite/UWX documents and §4.25/4.26
  content remain unchanged and valid. The member is invocation-plan metadata,
  not a new persisted UW section property. Format stays **2.0**. This RFC does
  not introduce persistence of the assembly wrapper or mutate any source file.
- **Schemas / public types:** Add the optional enum to
  `property-cash-flow-plan.schema.json` and `PropertyCashFlowPlan` in
  `protocol.ts`. The assembly schema already references the plan schema, so it
  inherits the member without a duplicated result property. No issue-schema
  change. Existing `index.ts` and `browser.ts` type exports carry the additive
  member; no new public helper or type export is needed.
- **Implementer tiers / modules:** Tier-1 document validity, Tier-2 editing,
  module manifests and declared financial calculations are unchanged. An
  implementation claiming the future assembly contract must support both
  cadence cases; old implementations remain conforming to their old protocol,
  not to the new opt-in behavior. Tier-3 metrics are unchanged. Tier-4 hosts may
  explicitly request the option but MUST NOT infer it from cash dates, source
  cadence or a failed attempt, or silently retry a refused legacy plan with it.
- **Version treatment:** This is an additive **Protocol minor**, because it
  expands what an explicit opt-in assembly plan may legally request. With no
  intervening protocol change, the implementation prepares **2.18.0** after
  the unreleased **2.17.1** RFC 0062 normative errata. That errata decision and
  RFC 0062's accepted status are unchanged. Format remains **2.0**, package
  versions remain unchanged, and RFC 0063 remains accepted until shipped.
  Package release versions and scheduling require later release planning.
- **Excel:** This adds no workbook shape, live dated-metric formula or new
  emitter capability. Existing same-day whole-column safeguards and RFC 0034's
  deferred cash-flow metric export remain. No new engine/Excel parity claim.

## Conformance impact

The implementation adds synthetic boundary fixtures while retaining every
existing `conformance/property-cash-flow-assembly/` fixture unchanged, including
`valid-quarterly`, `valid-monthly-leap`, `valid-same-day`, `valid-map-order`,
`valid-no-reserves`, `post-sale-cash`, `false-reserve-assertion`,
`valid-named-sale-deductions` and the reserved-deduction refusals. Preserve the
RFC 0062 cash-series/selector and other-series regression cases unchanged.

Synthetic fixtures use complete otherwise valid sources and all
unchanged assertions/coverage in the existing assembly suite. The matrix below
is exercised by `boundary-*` fixtures. Unit/schema tests supplement fixtures
for API-only values and serialization. Pair each cadence through the same
acceptance matrix rather than inventing separate semantics.

| Conformance case | Required behavior |
|---|---|
| Legacy absent | Existing valid and invalid plans retain exact outputs/refusal evidence; input/document bytes unchanged; no default member appears. |
| Explicit legacy value | Same decisions/series as absent; echoed plan retains `within_final_period`; boundary still refuses. |
| Monthly inside | An inside-final-month disposition succeeds with either value or absence when otherwise valid; explicitly authored partial-period amounts unchanged. |
| Monthly exact boundary | Final `2027-11`, disposition `2027-12-01`: succeeds with `allow_exclusive_end`; absent/explicit legacy refuses `date_horizon` at `plan`. |
| Monthly too late | Same final month, disposition `2027-12-02`: refuses `date_horizon` even when opted in. Later month boundaries also refuse. |
| Quarterly inside | Inside-final-quarter disposition succeeds with either value or absence when otherwise valid. |
| Quarterly exact boundary | Final `2027-Q3`, disposition `2027-10-01`: succeeds only with `allow_exclusive_end`; absent/explicit legacy refuses `date_horizon`. |
| Quarterly too late | Same final quarter, disposition `2027-10-02`: refuses with opt-in. No next-quarter operating period is created. |
| Monthly year rollover | Final `2027-12`: opt-in admits `2028-01-01`; absence/explicit legacy refuses it. `2028-01-02` refuses even with opt-in. No January source period is synthesized. |
| Quarterly year rollover | Independently use final `2027-Q4`: opt-in admits `2028-01-01`; absence/explicit legacy refuses it. `2028-01-02` refuses even with opt-in. No Q1 source period is synthesized. |
| Other calendar boundaries | Leap/non-leap February derive March 1. Leading-zero-year rollover preserves year identity; year-10000 overflow grants no additional date and does not invalidate a valid inside-period plan. |
| Invalid opt-in | Unknown enum, wrong type, `null`, API own `undefined` and attempted nested assertion fail plan validation. Absent stays distinct from an invalid value. |
| Source identity | Gaps, duplicates, malformed/mixed cadence or reordered source periods retain existing source refusals. Shuffling the cash-date map cannot manufacture a different final period or boundary. |
| Acquisition invariants | Acquisition outside the first period or acquisition >= disposition refuses unchanged, with opt-in present. |
| No new source period | Successful monthly and quarterly exact-boundary cases preserve the entire source schedule and exact period coverage cells. No extra month/quarter, lease-up row, post-sale operating period or prorated amount is created; copied operating amounts and bindings are unchanged. |
| Operating cutoff / extra period | Extra cash-date mapping not in the selected source retains projection refusal; no period is appended automatically. A following source period with cash after disposition refuses. A complete schedule ending wholly after disposition fails final-period admission. A different otherwise legacy-valid inside-period source is not made invalid by this RFC. |
| Cash horizon | Independently test projected and supplemental cash after disposition and before acquisition: `date_horizon` retains the original offending-source pointer. Includes a row mislabeled as settlement; no grace day. |
| Closing anchors / sale deductions | Gross sale, transaction costs or reserve rows assigned to disposition but dated earlier within the hold refuse closing timing. Acquisition-slot timing remains strict. Correct boundary sale plus RFC 0052 costs verifies stated net proceeds, excluding reserve return. |
| Reserve | Independently valid disposition-date external release coexists with boundary sale. False reserve-funded-spending or no-terminal-restricted-reserve assertion, missing coverage, and an unknown/missing/nonfinite terminal amount still refuse via the existing checks. No balance or release is inferred. |
| Financing | False no-financing assertion and reserved payoff/prepayment/defeasance deductions remain refused; opt-in is not a basis change. Hidden mislabeling is not claimed mechanically detectable. |
| Metrics | Pin synthetic XIRR, XNPV, MOIC and total-net results using the existing deterministic engine and declared day count. Verify exact copied dates/amounts, unchanged quantization/anchor and existing metric refusal behavior. |
| Same-day / evidence | Preserve boundary-day row count, source tie ordering, source bindings/digest, deep-copy snapshots and `declared_complete`. Cash rows produce no PS-02 for equal dates; ambiguous requested date refuses CALC-PERIOD-002; unique date selects; other-series duplicate protections and Excel guard remain. |

There is deliberately no positive post-disposition settlement fixture: such cash
is still forbidden. Do not reuse proprietary Golden Deal rows as engineering
fixtures or claim a reserve-dependent source qualifies merely from timing.

## Reference implementation

The implementation is integrated on canonical `main` at `413a645` in the
required spec/schema/type lockstep. It has not shipped. Changed surfaces:

- `spec/UW_PROTOCOL_v1.md`, VIII.9.6 plan shape and date-admission language;
  `packages/uwmd-core/src/protocol.ts`, additive plan member; and
  `spec/schemas/property-cash-flow-plan.schema.json`, optional enum. The
  assembly schema's existing `$ref` supplies result-plan validation.
- `packages/uwmd-core/src/property-cash-flows.ts`, accept the optional member
  in closed shape validation, validate its value, and broaden only the final
  disposition predicate. Reuse source verification and calendar grammar.
  Keep one internal boundary concept for both existing cadences; do not expose
  a new helper or change `lease-up.ts` financial verification/day-count math.
- `packages/uwmd-core/src/property-cash-flows.test.ts`, schema checks and
  existing conformance runner coverage for the matrix above. Verify both
  Node and browser-safe entries and existing CLI plan-file behavior. Update
  runner cases only as needed to register fixtures, not to weaken old results.
- Update `docs/PROPERTY_CASH_FLOW_WORKFLOW.md`, living status, and version
  documentation only when the accepted behavior is actually prepared; retain
  the distinction between accepted implementation work and a shipped release.

No new dependency, capability, error code, math pack, financial formula,
calendar cadence or source-section field is required. Implementation gates
include build, tests, schema/default/profile conformance, lint, indexes, codes,
package/lockfile/version/release guards and docs build. Existing code cannot be
claimed to implement this contract merely because it verifies a generic dated
series containing the same rows.

## Alternatives considered

| Alternative | Reason not selected |
|---|---|
| Boolean assertion, such as `assertions.allow_final_period_boundary: true` | Existing assertions attest economic facts and are all mandatory literal true. An optional validation policy there conflates intent with truth and complicates their closed shape. A top-level boolean would be smaller but less descriptive than two named terminal-period treatments. |
| Closed enum, proposed `disposition_period_rule` | Selected: names the validation rule explicitly, preserves current default behavior, and is closed to the two stated values. Unknown values refuse; no default is inserted and no economic settlement semantics are implied. Future values would need a separate RFC; none are proposed speculatively. |
| Generic date-policy object | Adds configuration beyond the two required validation rules and suggests independent timing dimensions without evidence or a contract. The closed enum expresses this bounded choice directly. |
| Existing `hold_only_and_exit_settled`, cash mappings or coverage slots | Those already express different facts and cannot distinguish legacy from expanded period admission. Reinterpreting them would silently change existing plans. Keep them unchanged. |
| Existing §4.26 series only | Sufficient for stated dates/metrics, but does not provide RFC 0045's verified-source assembly and coverage wrapper. The owner has directed the narrower assembly proposal. |
| Redefine/backdate disposition or cash | Hides the actual economic sale or changes authored timing. Keeping the sale date honest is the motivation. |
| Grace days, N-day window or post-sale settlement horizon | The evidence establishes one exact calendar boundary and no later seller cash. Additional dates need separate evidence and a contract. |
| Add another operating period or infer proration | Invents operating coverage/economics and breaks full-source identity; the boundary adds no accrual period or amount calculation. |
| Derive dates from row index/hold count | Loses absolute period identity and can move dates when rows or acquisition change. Use the stated canonical period only. |
| Infer policy from disposition date, make exclusive-end the default, or retry refused plans with opt-in | Changes existing refusals and author intent. Explicit opt-in and absent compatibility are required. |
| Monthly-only option or two cadence policies | Owner scope includes both existing cadences. The same calendar operation handles each; separate policies add complexity without a new financial distinction. |
| Reserve roll-forward or financing assembly in this RFC | Independent economic state/basis contracts. Timing eligibility cannot cure reserve overlap or admit debt/investor cash. |

## Unresolved questions

No unresolved semantic decision remains for this scope. Jared accepted the
public enum, both cadences, exact boundary, representability limit, unchanged
cash horizon and compatibility rules at `f04b34a` on 2026-09-24.

The implementation shipped in core/CLI 2.14.0, published from the `v2.14.0`
tag on 2026-10-02; RFC status is `implemented`. Reserve roll-forward, financing, investor tax, speculative
leasing and actual post-sale settlement remain separate future contracts.

## Prior art

RFC 0041 supplies absolute period identity; RFC 0044 distinguishes accrual
periods from explicit cash dates; RFC 0045 supplies the closed hold and evidence
wrapper. RFC 0052 provides the repository precedent for optional plan members
whose absence preserves prior behavior. Those existing contracts and the
public corpus/design reviews are the basis for this proposal; no external
financial convention or assumption is imported.
