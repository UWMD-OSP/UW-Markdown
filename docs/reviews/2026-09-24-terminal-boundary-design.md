# Terminal-boundary cash flows: evidence and owner decision brief

Date: 2026-09-24 UTC

Status: advisory design review; no normative proposal or implementation authorized

## Recommendation and demonstrated problem

Recommend an **optional admission rule for disposition exactly at the final
monthly source period's exclusive end**, while retaining RFC 0045's closed
acquisition/disposition cash interval. The evidence does **not** establish a
need for cash after the economic sale date. A separate settlement horizon is
premature. Jared decides whether to pursue this narrow extension or retain
existing dated-series verification alone.

The [completed corpus review](../reviews/2026-09-24-completed-golden-corpus-validation.md)
was integrated and pushed to canonical `main` at
`dd3029d6125c9d1c7509b9906099bf93af11c034` before this design pass. Its 640/640
registered comparisons, 20/20 existing refusals and separate stale-workbook
integrity refusal remain the baseline. Stated-value agreement does not prove
complete forecasting or property-assembly equivalence.

This pass inspected all ten frozen workbook sources, their timing declarations,
selected investment ranges and relevant formula precedents. All ten SHA-256
hashes still match the private source anchors. Exact workbook/revision/cell
locators and classifications are retained privately in
`harness/TERMINAL-BOUNDARY-EVIDENCE-2026-09-24.md` and its JSON companion.
No proprietary amounts, property identities or original source dates are
reproduced here. The examples below use relative dates.

| Evidence case | Economic sale and final cash | What the evidence supports | Current assembly boundary |
|---|---|---|---|
| A: monthly value-add property | Final operating month ends on its last calendar day. The model explicitly declares sale on the next month's first day; final operating cash, gross sale and sale costs share that sale date. | Zero days after disposition; one day after the inclusive source-period end. Reserve cells are declared zero. This is an end-of-period dating convention, not documented collection delay. | Reproduced `CALC-CF-ASSEMBLY`, `date_horizon`, at `plan`: disposition is outside the final calendar source period. No projected or supplemental cash is later than disposition. |
| B: monthly interim leasing with land exit | Final operating month likewise ends immediately before declared sale. Final operating cash, gross sale, costs and remaining property-reserve return occur on sale. The native workbook and explicit assembly view describe one underlying workflow. | Zero days after disposition. A same-date reserve return is demonstrated; a delayed release is not. Gross TI/LC and funded reserve releases elsewhere in the hold require separate reserve treatment. | First reproduced refusal is `coverage` at `plan.assertions.reserve_spending_excluded`; the truthful assertion is false. The same final-period date restriction is an additional, later boundary, not a second observed error from that run. |
| C: development source, an exclusion control | Selected investment cash ends on sale. Twelve later forecast months support forward exit NOI; nonzero support-sheet rows are outside the selected investment ranges. | These are forecast operations used in valuation, not seller settlement receipts. A financing takeout before sale is not property disposition. | No new assembly qualification claim or probe. Mixed-grain investment timing and reserve/financing construction remain outside this narrow proposal. Post-sale forecast rows cannot be relabeled settlement. |

The six remaining annual workbook sources do not supply eligible monthly or
quarterly assembly schedules. Their selected return builds end at declared
hold-end disposition; forward-year NOI and later lease dates are valuation or
lease support, not evidence of cash collected by the seller after sale. The
annual parent of case A is not independent evidence for a second cash lag.

Across the reviewed selected investment streams, **no trailing receivable,
accrued payable, seller tax true-up, delayed sale cost, escrow return or reserve
release after disposition was demonstrated**. There is therefore no evidenced
number of post-sale days or months to authorize. This conclusion concerns the
reviewed models and declarations; it does not prove actual transactions have no
unrecorded obligations. Their source assumptions remain assumptions.

## Existing normative boundary

The governing texts are [RFC 0045](../rfcs/0045-explicit-property-cash-flow-assembly.md)
and [Protocol VIII.9.6](../../spec/UW_PROTOCOL_v1.md). VIII.9.5 is the distinct
RFC 0044 lease-up projection surface. The following requirements are deliberate:

| Distinction | Existing requirement preserved by this recommendation |
|---|---|
| Acquisition / disposition | Explicit real dates; acquisition strictly precedes disposition, lies inside the first source period, and disposition lies inside the last. All cash lies in the closed acquisition/disposition interval. |
| Source horizon / cash dates | Full selected monthly/quarterly lease-up schedule, with an explicit cash date for each period. Projection can date cash outside its accrual period; assembly adds the overall hold boundary. Neither adapter infers dates or creates a new period. |
| Acquisition slot | Purchase price, transaction costs and reserve transfer; assigned rows occur on acquisition. Purchase includes a negative row. |
| Disposition slot | Stated gross sale, transaction costs and reserve transfer; assigned rows occur on disposition. Gross sale excludes debt payoff, costs and reserve return. |
| Period slots | Rent, concessions and TI/LC stay in the verified lease-up bundle; supplemental other income, operating expenses, other capex and reserve transfers have explicit period coverage. Final-period operating cash does not become a sale cost because dates coincide. |
| Coverage | Each required cell has rows or an explicit explained zero; each supplemental row has exactly one owner. Preserve signs, amounts and row identities. No inferred missing cash, netting, proration or intermediate rounding. |
| Economic assertions | Cash-only amounts, no financing/investor tax, no economic overlap, reserve-funded spending excluded, gross sale excludes reserve release, no terminal restricted reserve, and hold-only economics settled by exit are explicit true assertions. Structural checks cannot establish their real-world truth. |
| Basis / result | One property, currency, unlevered and pre-tax. A candidate wrapper retains plan, coverage/cells, bindings, source checks and envelope digest. `declared_complete` is a checked declaration, not audited economic completeness. No source/document mutation. |

The current implementation makes two different horizon checks in
[`property-cash-flows.ts`](../../packages/uwmd-core/src/property-cash-flows.ts):
`dateInPeriod` and the plan test reject disposition outside the last monthly or
quarterly calendar period; subsequent row tests reject cash outside acquisition
through disposition. Closing-slot timing is checked separately. Case A fails
the **plan/source-period** test, not a post-sale row test. Case B's false reserve
assertion refuses earlier during plan validation.

[`property-cash-flows.test.ts`](../../packages/uwmd-core/src/property-cash-flows.test.ts)
covers late exits, post-hold cash, false reserve assertions, stable same-day
ordering, monthly/quarterly cases and optional sale deductions. Existing
[assembly conformance](https://github.com/UWMD-OSP/UW-Markdown/tree/dd3029d6125c9d1c7509b9906099bf93af11c034/conformance/property-cash-flow-assembly) includes
`post-sale-cash`: a synthetic reserve return one day after disposition correctly
refuses `date_horizon`. That engineering negative case is not Golden Deal
evidence for legalizing delayed reserves.

## Existing surfaces and non-problems

- [RFC 0034](../rfcs/0034-calendar-anchored-cash-flows.md) and Format §4.26
  already represent explicit dated rows and verify requested XIRR, XNPV, MOIC
  and total-net metrics. They do not establish a property hold, cash origin,
  completeness, financing basis or factual sale date.
- [RFC 0044](../rfcs/0044-explicit-lease-up-cash-flow-projection.md) copies
  verified rent/concession/TI-LC amounts with supplied dates and provenance.
  Both monthly projections still pass. Their cash dates need no repair.
- [RFC 0052](../rfcs/0052-named-exit-sale-deductions.md) names rows already
  owned by the disposition transaction-cost cell and optionally verifies gross
  sale plus signed costs against stated net sale proceeds. It supplies neither
  a second cash flow nor a later payment date. Reserved loan payoff,
  prepayment and defeasance names remain refused; calling financing `other`
  cannot make the no-financing assertion true.
- [RFC 0053](../rfcs/0053-tax-abatements-and-reassessment-basis.md) distinguishes
  terminal buyer tax and its treatment in exit NOI. It is not a seller's late
  tax payment schedule and does not solve valuation circularity.
- [RFC 0058](../rfcs/0058-expense-recoveries-and-cam-true-up.md) verifies stated
  closed-period recoveries and a dated-series handoff. `REC-09` resolves a
  referenced series variant; it does not match a specific settlement row's
  amount/date or authorize assembly beyond disposition. Closed-period checks
  and billing/settlement declarations are not a future collections engine.
- [Accepted RFC 0062](../rfcs/0062-same-day-cash-flow-selection.md) preserves
  separate same-day cash rows without PS-02. A requested date matching multiple
  rows refuses deterministically; unique dates select. Other registered series
  retain duplicate protection. No numeric row-index calc grammar is implied by
  assembly's existing source-index bindings.

The [property workflow](../PROPERTY_CASH_FLOW_WORKFLOW.md) correctly requires
retaining the result wrapper. Generic dated-series verification is already
sufficient when only stated stream metrics are needed. Replayed unchanged
probes pass both projections and all 14 metric claims across eight series;
the two assembly refusals above remain intact.

## Candidate designs

| Option | Assessment |
|---|---|
| **A. Make disposition the last cash date** | Reject as a general settlement solution. For a real lag it hides economic sale, may shift sale costs, reserve timing and the operating boundary, and still collides with the final-period test. In A/B the existing disposition already equals final cash, so renaming it solves nothing. Do not backdate cash, move sale, append a fictitious operating month or inflate the hold. |
| **B. Separate settlement end** | Conceptually honest for a proved lag: retain economic sale and use an explicit last permitted settlement date. It would also need a closed category list, unique source-row ownership, links to pre-sale rights/obligations, no-double-count declarations and a distinction between partial-at-exit and final completeness. Operating periods would stop at sale. Dates/references can be checked; economic origin and no continuing operations are only partly supported by declarations, not proved by labels. No demonstrated category or lag justifies this contract now. Adding only a horizon would not fix A/B's final-period rule. |
| **C. Separate settlement compositor** | Could preserve the base API and return one dated series with a new combined evidence wrapper: original candidate/digest, extra source identities, row ownership, basis/currency, horizon and deterministic ordering. However, a valid RFC 0045 candidate currently asserts all receivables/payables settled at exit and no terminal restricted reserve. A truthful unresolved settlement cannot simply be appended to that candidate. Composition needs a different base eligibility/completeness contract or a narrower independently evidenced use case; it is not automatically additive or able to consume A/B's refused candidates. |
| **D. Existing dated series only** | Viable today for all demonstrated stated cash dates and metrics, including separately identified levered streams. No protocol change is necessary for representation. What remains missing is assembly's verified-source copying, exactly-owned coverage cells and complete evidence wrapper for case A. Manual authoring plus generic metric verification does not provide those guarantees. Choose D if that assembly benefit does not justify a new admission rule. |
| **E. Optional exclusive final-period boundary** | Recommended narrow assembly path. Keep actual disposition unchanged, allow it exactly at the final monthly period's exclusive end when explicitly opted in, and retain every cash date at or before disposition. No later settlement interval or new cash categories. This addresses A's demonstrated date restriction while leaving B's independent reserve refusal intact. |

## Recommended scope for owner review

These are design constraints for a possible later RFC, not new requirements on
current implementations. No field name, schema, API or protocol number is chosen.

1. **Boundary identity.** Disposition remains economic/property sale. For the
   proposed monthly mode, the only newly admitted date is the first calendar
   day immediately following the final source month. There is no separate
   settlement-end date: all selected cash is settled by disposition. A later
   real settlement would require B/C evidence and a separate owner decision.
2. **Cash and operating cutoff.** Retain existing period and closing categories.
   A final rent/concession/TI-LC bundle and supplemental period cash can land on
   disposition under their existing period ownership; gross sale/costs/reserve
   return remain separate disposition rows. Admit no cash after disposition,
   even if labeled receivable, payable, escrow, tax, fee or reserve release.
   No extra operating period, future rent, new leasing or post-sale capex enters
   the source horizon. Date and period cutoffs are mechanical. That amounts
   actually represent pre-sale operations remains an author assertion, as today.
3. **Source periods.** Preserve the complete source schedule and all existing
   RFC 0044 mappings. The final month's accrual span ends just before the
   disposition boundary; cash at that boundary does not extend accrual. Limit
   the initial scope to the demonstrated monthly grain. An analogous quarterly
   boundary is plausible but not demonstrated by these deals; it needs explicit
   scope acceptance and its own engineering tests. Existing quarterly behavior
   stays unchanged under this recommendation.
4. **Sale and transaction costs.** Copy stated gross sale on disposition without
   deriving exit price or converting it into eventual net receipts. RFC 0052
   still owns/names only the disposition cost rows and excludes reserve return
   from net sale proceeds. Later transaction-cost payment remains refused.
   B/C would need an explicit decision about which dated costs participate in
   the sale reconciliation and how each is counted once; labels alone cannot
   bypass the existing timing rule.
5. **Reserves.** Case B demonstrates return of a remaining property balance on
   disposition, not later settlement. Timing eligibility alone does not prove
   the balance, authorize funded draws or cure overlapping gross TI/LC. Keep
   `reserve_net` at the owner external-transfer boundary, all reserve assertions
   and the no-terminal-restricted-reserve constraint. Do not net gross spending
   against internal releases to force admission. Opening balances,
   contributions, draws, releases, closing balances and reconciliation form a
   separate reserve contract. B depends on that work in addition to timing.
6. **Financing and tax.** Debt service, refinance, payoff, prepayment, lender
   fees, financing reserves, investor tax and distributions remain outside
   property assembly. Source property transfer taxes can remain stated sale
   costs; that does not admit investor income tax. Existing verification of
   stated levered streams is not deterministic financing assembly.
7. **Metrics and identity.** Copy each finite signed amount unchanged. Keep
   existing first-row valuation anchor, explicit day count, root-finding
   refusals and 2/6/4 quantization. Additional eligible rows, if any, feed the
   existing RFC 0034 engine; no new financial arithmetic is needed. Preserve
   date ordering and stable same-date source ordering, separate rows, bindings
   and ambiguous-selector refusal under RFC 0062. No new selection grammar.

## Compatibility assessment

Existing documents can remain valid in every additive design; candidate-plan
acceptance and result compatibility are separate questions. The following
assessments assume an eventual explicit opt-in, except A's literal redefinition.

| Option | Existing/default behavior and new acceptance | Plans, results and schemas | Likely version / Format / Excel impact |
|---|---|---|---|
| A | Literal redefinition changes the meaning of existing disposition and assertions; unsafe as a default. No admission of A/B without another period-rule change. A separate opt-in becomes a different design. | Might keep wire shape but changes its meaning; unchanged shape does not make it compatible. | Breaking semantic treatment may be necessary, not an erratum. Document-shape change is not inherently needed; no metric arithmetic change or Excel parity claim. |
| B | Absent extension preserves old plans, outputs and refusals. Explicit qualifying later settlements would become accepted; A/B still need source-boundary treatment. | Optional plan fields, coverage categories/assertions and matching closed plan/result schemas; wrapper needs settlement provenance and completion meaning. Old readers reject unknown new plan fields. | Likely additive Protocol minor if defaults are exact. Format could stay unchanged if all extra evidence stays in plans/wrappers; new stored section content would require separate Format review. No live Excel XIRR guarantee. |
| C | Existing API can stay byte/behavior identical. Only a separately eligible input/composition gains acceptance; current candidates cannot falsely attest settlement. | New opt-in operation/plan/result and schemas. A coherent bare series is possible, but the combined wrapper must not pretend the original coverage/digest covers appended cash. | Likely Protocol minor for a truly additive API; resolving base eligibility may expand scope. Format need depends on persistence; Excel output requires its own contract. |
| D | No change to any document, plan, output or refusal. Already accepts stated dated streams for metric verification. | No fields or result/schema changes. Missing assembly evidence remains missing. | No version or Format change; existing Excel limitations remain. |
| E | Absent option preserves old serialized results, accepted cases and refusals exactly. Explicit monthly boundary plans become date-eligible; other failures still refuse. Accepted legacy cases do not move amounts or dates. | An optional explicit plan mode and corresponding closed plan/result-plan schema updates would be needed. Retain existing result fields and bindings; omit the mode when absent rather than materializing a default. | Likely additive Protocol minor, not RFC 0062-style errata: this expands a deliberate rule. No new Format section/row shape is required. No Excel financial-formula change; schema/type/spec updates would land together in a future RFC. |

No version is selected or changed here. Format remains 2.0; prepared Protocol
2.17.1 remains unreleased; RFC 0062 remains accepted; package versions remain
unchanged. RFC 0034 deliberately defers live Excel cash-flow metric emission
because Excel XIRR does not promise the engine's root-finding parity. A future
boundary mode must not silently add that export capability or weaken the
existing duplicate-date whole-column Excel guard.

## Future conformance plan

No fixtures are created in this task. Use minimal synthetic engineering data,
never private workbook rows. If E is accepted, the minimal plan is:

| Case | Intended future check |
|---|---|
| Legacy / absent extension | Retain current no-settlement valid cases, schema validity, refusal reasons and exact serialized candidate behavior; source bytes and `_meta` unchanged. Unknown/invalid mode refuses. |
| Exclusive monthly boundary | Explicitly opted-in final-month operating cash plus separate sale and costs on the next first day succeeds when every other condition holds. Same plan without the option keeps today's refusal. Include year rollover and leap-February boundaries. |
| Beyond boundary | Disposition a day beyond the permitted exclusive boundary refuses. Any cash after disposition refuses, including an otherwise correctly labeled pre-sale receivable. No generic grace period. |
| Continued operations | A source operating period starting on/after sale, or operating cash after sale, refuses. An assertion cannot convert an extra month into settlement. False economic labeling cannot be claimed mechanically detectable. |
| Financing | False no-financing assertion and RFC 0052 reserved debt names still refuse, including with boundary opt-in. Dates alone never qualify financing. |
| Sale and costs | Gross sale and transaction-cost rows off disposition refuse. Named deductions own each cost once; net sale calculation excludes reserve return. |
| Reserve timing | An otherwise eligible external reserve return on disposition preserves existing treatment. A late return still refuses. A truthful reserve-funded-spending assertion remains false and refuses even when the date is eligible. No account roll-forward fixture in this scope. |
| Metrics / same-day identity | Existing dated engine computes pinned synthetic metrics from exact copied rows; unchanged day count/quantization. Stable ties preserve row count and bindings; no PS-02 for cash rows; duplicated requested date refuses; unique date selects; other series duplicate checks remain. |
| Quarterly exclusion | Existing quarterly accepted cases unchanged; an exclusive quarterly boundary is not admitted by a monthly-only option. |

The requested **legal post-disposition settlement** case and **settlement beyond
an explicit settlement horizon** case are conditional on later acceptance of
B/C. They cannot be positive E fixtures because E admits no post-sale cash.
Before designing them, obtain evidence of a specific pre-sale right/obligation,
its actual later cash date, classification, overlap controls and completion
meaning. Then add permitted-category success, economic-origin/assertion
refusals, post-sale operations and financing negatives, late-horizon refusal,
sale anchoring, metric and same-day cases. A late reserve success needs its own
evidence and reserve dependency decision. Do not manufacture a positive case
just to fill a fixture checklist.

## Owner decisions

1. **Pursue E or stay with D?** Recommend E if verified component assembly is
   needed for the demonstrated monthly source convention. D already satisfies
   stated-series representation/metric needs without a protocol change.
2. **If pursuing E, monthly only or monthly and quarterly?** Recommend monthly
   only initially; extending the identical calendar-boundary concept to
   quarterly sources is a defensible scope choice but lacks direct corpus
   evidence. Neither choice permits cash after disposition.

No choice of arbitrary settlement duration, post-sale category list, new math,
reserve netting or financing treatment is justified by this evidence. Actual
post-sale settlement, reserve roll-forward, financing assembly, investor tax,
speculative leasing and general post-sale operations remain separate.

## Verification record

Phase 0 passed lint, indexes, codes, versions, release guards and the docs build
before fast-forwarding and pushing the completed review. Its subsequent
[CI run](https://github.com/UWMD-OSP/UW-Markdown/actions/runs/35962946403)
also passed. This pass repeats the
existing read-only monthly projection, dated-metric and assembly probes and
checks source hashes without editing workbooks or expectations. Design
verification covers build, tests, test typechecking, default/profile conformance,
schemas, lint, indexes, codes, versions, packages, workspace links, release guards
and docs build. Outputs and exact private source locators remain in local
evidence. Public changes are limited to this brief, review/status/roadmap links
and docs-site routing. No RFC, normative spec/schema, package, conformance
fixture, formula or version change is part of this task.
