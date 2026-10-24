---
rfc: 0092
title: Verify stated pro forma identities under declared conventions
status: draft
author: codex (owner-directed draft)
created: 2026-10-17
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0092: Verify stated pro forma identities under declared conventions

## Summary

Propose the optional `pro-forma` verification profile for bounded return
assertions, optional declared acquisition-ledger coverage and individually
justified named identities. The broad L1 table is a candidate inventory for
review, not accepted universal row verification. Producers state the selected
assertions, their derivation evidence and conventions; Verifiers report coverage. UWMD does not generate projections or choose assumptions.
RFC 0078 D1/D7 stand. The approved convention registry gains the owner's
2026-10-17 addition, per-loan `ltv_basis`. **Draft, docs only:** no implementation,
profile claim, schema, dictionary rule, diagnostic or receipt behavior activates.
The owner's 2026-10-23 ruling resolves U3–U7 for the bounded admissions in
section3a. U1 membership and U9 coverage/transport recommendations remain PENDING
owner, with independent composed-procedure/spreadsheet evidence and finding
closure required before final acceptance. The independent clause review found
bounded clarification needs; this revision proposes repairs, not acceptance.

## Owner ruling — 2026-10-23, U3–U7

Records declare conventions through the closed registry; each admitted option
has one exact procedure. L1 admits end-timed periodic returns and explicitly
dated flows, nominal annual/12 payment rates, full-term amortization after IO,
debt yield on the loan at close, and year-1 after-capex CoC over initial equity.
Beginning/mid-period timing, remaining-term amortization, current-balance debt
yield, before-capex CoC and later-year CoC are outside L1. Registered vocabulary
does not itself admit a financial procedure.

`reserves_placement` is declared per record. NCF subtracts only reserves not
already deducted above NOI. New identity comparison minima use the dictionary's
unit quanta: dollars2, fractional rates6, multiples4. Existing dictionary and
reused native identity contracts retain their own precision rules; there is no
blanket epsilon. Land debt service remains the scope input below.

The producer convention declaration supplies implementation evidence, not
normative authority for every producer variant. Section3a records the admitted
math and limits; the owner ruling does not accept this RFC or activate a profile.

## Land debt-service input — owner ruling, 2026-10-22 (fifth set)

The owner directs that pass-4's land debt-service restatement gap is an input
to this RFC and issue [#355](https://github.com/UWMD-OSP/UW-Markdown/issues/355),
**not a separate debt-service RFC**. This records scope input and adds no land
DSCR/cap-rate identity. The later U3–U7 ruling does not expand this assertion.

Sundance states `debt_structure.annual_debt_service` but no identified payment
stream. A numeric summary is not evidence of its own derivation. The candidate
bounded assertion is summary-to-stated-stream reconciliation for the exact loan,
period, currency, scope and variant, with explicit treatment of interest,
principal, fees, reserve-funded payments and balloon/payoff inclusion. Bind each
stated payment exactly once; account separately for missing/unbound evidence.
Neither negative land NOI nor reserve funding makes the debt-service assertion
inapplicable. An unavailable stream cannot produce verified coverage.

Recommendation: develop this assertion in U1's individually justified identity
scope, with U9's unique-address/verdict/family coverage accounting. Keep debt
schedule generation and unstated loan assumptions outside that assertion.
`loan_amount * interest_rate` must not silently replace the missing stream: it
would choose balance, accrual, timing and period conventions. The later U3–U7
resolution pins the bounded procedures below without admitting a generated land
schedule. No default fee/balloon exclusion or zero
payment is selected by this intake. The later U3–U7 resolutions constrain any
admitted procedure; land's stated-stream requirement remains. Proposed controls include wrong summary,
missing stream, mixed loan/period/variant, duplicated payments and explicit
reserve-funded IO service. Keep #355 open.

Current-main coordination: RFC 0088's pinned primitives are accepted; RFCs
0111/0124 require explicit kept rule-set identity, RFC 0120 carries exact
selected-source CF findings, and RFC 0123 recomputes authenticated dictionary
receipt claims without a starter pack. Reuse these contracts; none establishes
a new debt-service identity, a schedule procedure or complete profile coverage.
The independent Python implementation claims Reader plus selected calculation
and verification capabilities, not the full Verifier tier or this unaccepted
pro-forma profile.

## Motivation

At production main `495220e7fa569659aaadcab0f06574d09a570703`, the normative
[dictionary](../../spec/metrics/builtin.json) has 173 class-scoped calculations,
and no IRR, NPV, equity-multiple, debt-service, amortization or
exit-value metric. Its single-period ratios, amounts and intensives do not bind
a complete pro forma. Not every dictionary entry is literally a ratio.

Existing cash-flow, capital-stack, reserve and waterfall verifiers check their
own stated structures. The gap is the connection between pro forma rows:
`dcf.returns.*` is not generally checked against `dcf.annual_cash_flows`, and
`debt_structure.annual_debt_service` is not generally checked against that loan's
terms and schedule. Threshold and restatement checks are not derivation checks.
An audit found one producer using annual amortization in one calculation path
and monthly amortization in another. Two producers can state different unsupported
headline numbers from identical inputs without those unbound claims being checked.

A motivating development example reports takeout LTV on total project cost:
0.6 stated versus about 3.64 when compared against purchase price. This is a
reported basis mismatch, not an independently reproduced vendor fixture.
Current main already prefers `valuation.underwritten_value` with a purchase-price
fallback (RFC 0079); it is not purchase-price-only. Neither implicit choice
expresses an explicit total-cost basis. Future fixtures must be synthetic.

Sources:

- [#355](https://github.com/UWMD-OSP/UW-Markdown/issues/355), its
  [owner reframe](https://github.com/UWMD-OSP/UW-Markdown/issues/355#issuecomment-6206117924)
  and [approved registry](https://github.com/UWMD-OSP/UW-Markdown/issues/355#issuecomment-6205783023).
- The later [bounded-assurance scope reconciliation](https://github.com/UWMD-OSP/UW-Markdown/issues/355#issuecomment-6206344561)
  in the issue's current banner: every-row coverage is design input, not an
  accepted normative expansion. This draft supplies the newly requested L1
  candidate table while leaving its initial membership/assurance scope open.
- Owner direction, 2026-10-17: next free RFC number, no compatibility/bump
  proposal, and the three-option per-loan `ltv_basis` addition.
- [#356](https://github.com/UWMD-OSP/UW-Markdown/issues/356) and accepted RFC 0088
  [#357](https://github.com/UWMD-OSP/UW-Markdown/pull/357) own numerical procedures.
  RFC 0089 is accepted and implemented by
  [#368](https://github.com/UWMD-OSP/UW-Markdown/pull/368), production commit
  `495220e7fa569659aaadcab0f06574d09a570703`. Reuse its complete Envelope2.0
  and whole-source canonicalization2.0 boundaries; no financial-profile
  acceptance follows from that representation work.
- [#354](https://github.com/UWMD-OSP/UW-Markdown/issues/354) owns independent
  Python verification; its Reader and selected verification capabilities are
  not a full Verifier-tier or pro-forma profile claim.

## Proposed change

All RFC 2119 language here is proposed, subject to final acceptance and the
unresolved questions. It does not authorize production activation.

### 1. Verification boundary and claims

Reconcile the issue's current bounded direction before choosing L1 membership:
(1) bind headline assertions to exact streams, methods, periods, variants and
source subjects; (2) optionally account for a declared acquisition-ledger
universe; (3) add only individually justified normative identities. These are
assurance scopes, not new conformance tiers or numerical convention options.
The brief requests the complete candidate inventory below. The U1 disposition
selects the initial subset from accepted verification identities. U2 is resolved
by the owner on 2026-10-17: the profile verifies whatever
the document states and reports coverage; no minimum L1 row set is required to
claim it. A thin document receives a thin coverage report, not a refusal for
omitted rows. Neither this draft nor row counts certify undisclosed real-world
completeness or a producer's forecast assumptions.

Checking identities over a *stated* pro forma is internally consistent
verification under [RFC 0078](0078-protocol-is-verification.md) D1.
[Format](../../spec/UW_FORMAT_SPEC.md) 4.24 already verifies stated capital-stack
sizing: disagreement fails, missing inputs are unverifiable, never zero.
D7 leaves modeling with producers, D4 leaves defaults outside the standard,
and D9 supplies the optional-profile precedent with RFCs
[0005](0005-stochastic-calculations.md)/[0007](0007-sensitivity-tables.md).
D1 and D7 are unchanged.

A document would claim `profile: "pro-forma"` and `level: "L1"` explicitly in
proposed `dcf.pro_forma`, together with a convention-registry identifier, declared
conventions, timeline and row bindings. DCF/IRR presence alone MUST NOT infer a
claim. L2/L3 are future identity sets, not supported initial level values.

Full implementations would add `pro-forma` to `ImplementationManifest.profiles`
(Protocol I.4/II.3), plus proposed capability `pro-forma-verify`. The current six
optional profiles become seven. Partial implementations MUST NOT claim the
profile; an unsupported receiver reports its checks unverifiable, never passed.
That implementation-completeness requirement does not impose a minimum row set
on documents claiming the profile. The profile does not substitute for
unimplemented base Verifier obligations.
No module manifest, projection package or new conformance tier carries it.

Future synchronized changes cover Protocol counts/lists, `ConformanceProfile`,
implementation-manifest schema, capabilities, conformance target schema/index/
runner and discovery tests. No such contract file changes in this PR.

### 2. Authored evidence and field reuse

Every check MUST identify its target, exact input paths, period identity,
selected loan/section variant, unit, original numeric precision and conventions.
Missing/null inputs are not zero; missing rows are never generated or repaired.
No defaults or workflow assumptions fill gaps. Retain read-only source evidence.

Selection follows Protocol VIII.2/VIII.2a and RFC 0040/0066: period identity,
not array position; exact requested variant; existing duplicate/ambiguity typed
refusals. Unselected peers cannot supply missing inputs. Record bindings against
one admitted source/model snapshot using accepted [Envelope2.0](../../spec/UW_ENVELOPE.md).
The complete `uw-envelope-semantic` subject uses canonicalization2.0; portable
projections, V9/V11/V12, receipt results and signing inputs keep their separately
specified scopes. A selected-stream arithmetic result does not authenticate
unselected peers or the whole model. No new digest, receipt subject,
canonicalizer or signing admission is implied.

| L1 row/input | Existing home first | Missing detail |
|---|---|---|
| Hold, start, growth/cap/discount assumptions | `dcf.hold_period_years`, `analysis_start_date`, `assumptions.*`; `noi_model.projections.year_N` | Monthly/stub boundaries and per-line anchors. |
| GPR, EGI, opex, NOI | `dcf.annual_cash_flows@Y<n>.gross_potential_rent/effective_gross_income/total_expenses/net_operating_income`; `noi_model.income/expenses/net_operating_income/projections` | Per-period losses, other income and expense lines. |
| Loan terms/service | Each selected `debt_structure`: `loan_amount`, `interest_rate`, `amortization_years`, `io_period_months`, `loan_term_years`, `annual_debt_service`, `monthly_debt_service` | Payment dates and interest/principal/balance/IO transition. |
| Annual service, balance, balloon | `dcf.annual_cash_flows@Y<n>.annual_debt_service/loan_balance_eoy`; `debt_structure.balloon_payment_est` | Per-loan schedule bindings. Stabilized capital-stack service is not actual IO cash service. |
| DSCR, debt yield, LTV | `debt_structure.sizing_metrics.*`; distinct `capital_stack.sizing` verbs | Period claims and explicit bases. |
| Reserves, TI/LC, capex, NCF | NOI expense items, `sources_uses`, explicit `cash_flow_series` and reserve bindings under their own contracts | Full per-period derivation. |
| Exit | `dcf.exit_analysis.exit_noi/exit_cap_rate/exit_value_gross/disposition_costs/exit_value_net/loan_balance_at_exit/net_proceeds_to_equity` | Forward/trailing income and payoff bindings. |
| Flows and CoC | `dcf.annual_cash_flows@Y<n>.net_cash_flow_levered/net_cash_flow_unlevered/cash_on_cash_return/cumulative_equity_invested` | Initial/monthly flows and separate contributions/distributions. |
| Returns | `dcf.returns.levered_irr/unlevered_irr/equity_multiple/npv/discount_rate_used`; existing dated-series metrics | Exact flow bindings. No automatic new identity for average CoC or payback. |

Propose only these new field groups, with final schemas gated:

1. `dcf.pro_forma`: explicit profile/level/registry claim, global conventions,
   timeline and identity/target/input bindings; no existing field states that scope.
2. Timeline/line-detail members within it: monthly/stub boundaries, cash dates,
   expense classes and missing derivation cells. Bind annual values to their
   existing homes rather than duplicate them. Existing keyed NOI projections
   remain yearly, not a silently reinterpreted monthly series.
3. `debt_structure.pro_forma` per loan: convention declarations and schedule
   rows for payment, interest, principal, opening/closing balances and balloon.
   Format 4.7 models one loan; selected variants do not require a new loan array.
4. Direct `debt_structure.ltv_basis` per loan, beside `loan_amount`, below.

Document dictionary-owned `valuation.underwritten_value` consistently in the
Format at synchronization; do not create another value home. U1 below defines
the bounded initial identity scope; resolved U2 imposes no minimum document row set
and does not imply complete-model verification.

### 3. Closed convention registry

The registry is normative on acceptance, closed and versioned with the profile;
its identifier is assigned at governed activation, not here. Every convention an
identity uses MUST be declared. Undeclared/unknown choices refuse that identity,
never default, following VIII.9.1. Report it unverifiable with missing/unsupported
declaration evidence; distinguish typed structural refusal and finite disagreement.
No new diagnostic code is allocated in this draft.

Global declarations live in `dcf.pro_forma.conventions`, line choices on bound
lines, and loan choices in that loan's `debt_structure.pro_forma` declarations.
`ltv_basis` has its own direct field. No global fallback supplies a missing
per-line or per-loan choice. `debt_yield_basis` keeps its approved two-axis product.

**Contested** labels practitioner disagreement in registry/documentation. It is
not an invalidity verdict or permission to omit a choice. The table is the
registry vocabulary; section3a separately limits L1 admission. Only admitted
options are executable, and unsupported declarations remain visible/refused.
Paired positive fixtures apply when two options are admitted; a registered but
out-of-L1 option gets a refusal control, never a fabricated positive fixture.

| Group | Convention | Registry vocabulary | Scope |
|---|---|---|---|
| Timeline | `period_basis` | `monthly` · `annual` | Monthly rows with annual roll-ups, or annual rows. |
| Timeline | `first_period` | `full` · `stub` | Stub uses declared existing day count. |
| Timeline | `cash_flow_timing` | `end` · `dated` · `mid` · `beginning` | Owner adds explicit `dated`; only `end`/`dated` admitted to L1. |
| Revenue | `growth_application` | `anniversary-step` · `calendar-step` · `monthly-compound` | Bound growth identity. |
| Revenue | `growth_start` | `period-1` · `year-2` | Whether year-1 input is already grown. |
| Revenue | `vacancy_base` **(contested)** | `gross-potential-rent` · `gross-potential-revenue` | Latter includes other income. |
| Revenue | `credit_loss_base` | `gross-potential-rent` · `gross-potential-revenue` | Period loss input. |
| Revenue | `occupancy_method` | `percent-of-base` · `stated-occupancy-path` | Explicit rate/base or authored path. |
| Expenses | `line_class` | `fixed` · `per-unit` · `per-occupied-unit` · `per-sf` · `percent-of-egi` | Per expense line. |
| Expenses | `management_fee_base` | `egi` · `egi-excluding-reimbursements` | Bound management line. |
| NOI / NCF | `reserves_placement` **(contested)** | `below-noi` · `above-noi` | Per-record declaration; subtract only below-NOI reserves again at NCF. |
| Debt | `payment_frequency` | `monthly` · `annual` | Per loan, amortization basis. |
| Debt | `interest_accrual` | `30/360us` · `actual/360` · `actual/365f` | Exact VIII.9.1 procedures. |
| Debt | `amortization_after_io` **(contested)** | `full-term` · `remaining-term` | Only `full-term` admitted to L1. |
| Debt | `dscr_basis` **(contested)** | `noi` · `ncf` | Per loan. |
| Debt | `dscr_debt_service` **(contested)** | `actual` · `amortizing-constant` | IO cash service versus amortizing-payment basis throughout. |
| Debt | `debt_yield_basis` | (`noi` · `ncf`) × (`loan-at-close` · `balance-at-period`) | Both axes required; L1 admits only `loan-at-close`. |
| Debt | `ltv_basis` **(contested)** | `purchase-price` · `underwritten-value` · `total-project-cost` | **Owner addition, 2026-10-17; direct per-loan field.** |
| Exit | `exit_noi_basis` | `forward-12` · `trailing-12` | Year N+1/next twelve months versus year N/final twelve. |
| Exit | `exit_noi_measure` | `noi` · `ncf` | Measure bound to existing `exit_noi` target. |
| Exit | `disposition_cost_base` | `gross-sale-price` | One admitted value. |
| Returns | `irr_frequency` **(contested)** | `annual-periodic` · `monthly-compounded` · `xirr` | Annualize monthly m as `(1+m)^12-1`, never simple `m*12`. |
| Returns | `cash_on_cash_numerator` | `before-capex` · `after-capex` | Only year-1 `after-capex` over initial equity admitted to L1. |

The approved refined registry's 22 convention keys plus `ltv_basis`, with the
owner's explicit dated-flow admission and L1 restrictions recorded above.
The first-cut issue table's renamed choices and separate `exit_value` menu are
superseded and are not restored here.

Approved fixed rules: contributions negative, distributions positive; equity
multiple is total distributions / contribution magnitudes; CF0 is undiscounted
in NPV; financing costs at close enter equity at t0; exit is at the final hold
period's end and payoff reads outstanding balance; intermediates are unrounded.
Tax reassessment mechanics, further fees, prepayment/defeasance and floating-rate
accrual are L2 identity work, not inferred inputs. Existing accepted tax, hedge,
reserve and source-binding checks still apply to their own stated structures.

#### Per-loan LTV and the existing `ltv` id

For selected loan `L = debt_structure.loan_amount`, the existing single-period
`ltv` id MUST read that same loan's `debt_structure.ltv_basis`:

| Declaration | Denominator home | Identity |
|---|---|---|
| `purchase-price` | `valuation.purchase_price` | `L / valuation.purchase_price` |
| `underwritten-value` | `valuation.underwritten_value` | `L / valuation.underwritten_value` |
| `total-project-cost` | `sources_uses.total_project_cost` | `L / sources_uses.total_project_cost` |

Do not infer the basis from loan purpose, scenario, asset subtype or available
denominators. Undeclared/unknown basis MUST refuse LTV verification, reporting
unverifiable. A missing/null selected denominator is unverifiable; another
available denominator cannot rescue it. Existing typed arithmetic/zero-division
refusals remain; no new negative-value convention is chosen. Preserve `%`
(fraction), reporting `round_to: 6`, `minimum_stated_decimals: 2` and RFC 0079's
source-token comparison. There is no automatic price/value fallback.

This governs the existing id in every class-scoped definition, even outside a
document claiming the optional profile. It is the owner's explicit change to
LTV semantics, not a second metric beside the implicit rule. Future synchronization
includes same-loan CC-02, nested `sizing_metrics.ltv` bindings, dictionary/pack
expressions and their reference/export consumers. Distinct capital-stack
`ltv_through`/`ltc_through` retain their existing contracts; a cost-basis loan
statement is not silently substituted for a different stack verb. Nothing is
implemented here; downstream divergence is not resolved until implementation
and actual adoption.

### 3a. U3–U7 resolution — admitted procedures and boundaries

The owner resolves these convention decisions on 2026-10-23. This is an
admission ceiling for the initial profile, not acceptance of the entire section4
inventory. U1 must still select its initial identity vocabulary. A record MUST
declare each relevant registry choice and bind its actual inputs. A declaration
outside the admitted procedure is unsupported/unverifiable, not an invitation
to infer another convention from an asset class, producer or available fields.

**U3 — timing.** End-timed annual-periodic flows have explicit CF0 at t0 and
CFk at the end of full year k, k=1…N. Require `cash_flow_timing=end`,
`period_basis=annual`, `first_period=full` and `irr_frequency=annual-periodic`
for annual IRR. NPV accumulates `CFk / P(1+r,k)` from k=0 through N, left to
right from +0; IRR uses that exact NPV and the accepted VIII.3 solver.
CF0 is undiscounted. Do not replace P with a repeated-multiplication product.
Mid/beginning timing and inferred day stubs are not admitted.

For `cash_flow_timing=dated`, bind an explicit dated `cash_flow_series` and its
declared day count. The producer's evidenced dated option is `actual/365f`:
`t_i=actualDays(d0,d_i)/365`, d0 the first row's date. Reuse VIII.9.2's exact
`amount_i * P(1+r,-t_i)` terms in original series order, and VIII.9.3 for XIRR
with `irr_frequency=xirr`. Do not translate this to division by a positive
power or shift an event to a year end. Other already accepted native series
day counts remain native contracts; they are not additional producer-aligned
L1 timing options in this draft. A missing date/anchor/day count is not supplied
from a producer's default calendar.

The evidenced monthly-compounded option is a separately bound lender stream,
not an automatic deal-headline method. Require explicit full monthly periods
with end-indexed flows and `irr_frequency=monthly-compounded`; loan funding is
CF0, a stated month-m start draw belongs to CF(m−1), interest to CFm. Preserve
those authored bindings. Solve VIII.3 monthly IRR m, then `P(1+m,12)-1` in that
order. An annual deal stream cannot be relabelled to obtain this option.
Unspecified growth anchors, academic/month-overlap proration, occupancy-to-loss
conversions and revenue/expense variants in the broader inventory are outside
initial L1; stated rows remain in coverage. No universal procedure is inferred
from the existence of several different producer paths.

**U4 — fixed-rate monthly mortgage.** Require declared monthly payment frequency,
nominal annual rate r, original principal L, full amortization years A and
explicit loan-relative IO boundary K. Compute `i=r/12`,
`n=A*12`, required to be a positive integer, never `(A-IO_years)*12`.
The producer rounds fractional month counts; this narrower L1 procedure admits
whole-month amortization terms only. Basic L1 admits whole-year IO, K a
nonnegative multiple of12
months. For payment q=1…K interest-only applies; amortization starts at K+1.
Refinance/takeout resets, within-year transitions, floating paths, draws,
capitalized interest and cash sweeps need separately admitted procedures.

The first opening balance MUST equal that same loan's L at close; later
openings follow the explicit scheduled/payment/retirement distinction below. At amortization start
use that chained opening principal B and fix the payment once:
`PMT=B/n` if i=0, otherwise `(B*i)/(1-P(1+i,-n))`, in the written association.
This reuses UWMD VIII.3's **positive** PMT convention, not a producer calc
interface's signed PMT. The count is the full n after IO; it does not infer a
loan-term extension, payoff or continuation beyond supplied schedule rows.
For each monthly row, `I_q=B_open*i`; during IO `principal_q=0` and
`payment_q=I_q`; afterward `principal_q=min(PMT-I_q,B_open)` and
`payment_q=I_q+principal_q`. Then `B_close=B_open-principal_q` and the next
opening equals that close unless an explicitly bound payoff retires the loan
as below. Interest, principal and payments are positive
magnitudes subtracted from investor cash. Do not round monthly cash to cents.
Annual service sums the explicitly bound actual payments left to right from
+0. A constant-payment sizing figure remains a distinct binding, never silently
substituted for actual IO service. Named date-based loan accrual options in the
registry are not established by r/12 and are outside this monthly procedure.

Require finite nonnegative r/B, positive integer n and valid K for this new
schedule identity; missing/null inputs are unverifiable, and invalid domains or
nonfinite intermediate results retain typed arithmetic evidence. Do not import
a producer helper's zero fallback for invalid principal/count. A supplied
balloon/payoff binds explicitly to the post-scheduled-payment balance and its
own payment; count it once, not again as scheduled principal. No maturity flow
is generated. Land summary-to-stream intake retains its earlier scope and does
not assert that land has this mortgage schedule.

**Monthly horizon and retirement admission (proposed clarification, not U1
membership).** Bind the same selected loan's stated `loan_term_years` to maturity
month H=`loan_term_years*12`, a positive integer, and an explicitly stated
assessment horizon h (positive integer, h<=H). Missing maturity/horizon is
unverifiable for the complete schedule assertion; do not derive a new extension
from amortization n or an asset label. A shorter h verifies only that stated
interval, never the remaining loan term or an unstated payoff. A conflicting
supplied maturity identity is retained as contradictory evidence.

Payment identity is `(selected_loan_address, loan_relative_month q)`, with explicit
integer q and the corresponding full-month timeline binding. In the admitted
interval require exactly one scheduled-payment row per consecutive q starting
at1, through h or an earlier explicitly paid full retirement. Validate before
any deduplication. Repeated references to one physical event cannot double its
payment; two different rows declaring the same payment identity are ambiguous,
even when amounts agree. Gapped rows or a missing preceding balance make the
continuity-dependent assertion unverifiable; never fill a row or reset the
opening from the original loan. Rows outside the stated horizon, after H, or
contradicting a paid retirement cannot earn verification under this procedure.
Retain an independently decidable finite disagreement as failed evidence rather
than hiding it behind a missing/unsupported neighboring row.

Name the written recurrence's `B_close` **post-scheduled-payment balance**. A
separate payoff/balloon amount is not that row's scheduled principal again.
Bind its exact source event, loan, month and currency and an explicit declaration
that it is paid; an estimate/remaining balance alone is not a payment. For a
stated full retirement at q_R the separately paid principal payoff must equal
that row's post-scheduled-payment balance under U7, with disjoint payment-event
membership. Define the **post-payoff balance** as that balance minus the bound
paid principal payoff. Full retirement leaves zero, and there are no later
active scheduled-payment rows for that same loan. If no payoff occurs at a row,
its post-payoff balance equals its post-scheduled-payment balance. Any next
admitted opening chains from the preceding post-payoff balance, not the balance
before a paid retirement. A fully amortized zero balance likewise cannot support
a later active payment pretending the old loan is outstanding. A separate
zero-balance observation is not an additional scheduled payment.

Missing payoff remains missing. Scheduled rows through H can have independently
checked arithmetic while the maturity/payoff relationship remains unverifiable
if it asserts retirement without a payment. Do not fabricate a balloon, an
extension, refinance, curtailment policy or continuation after maturity. Partial
curtailments/continuations need separately admitted procedures; this clarification
supplies no new procedure for them. For the review witness L1200/r0/n24/K12/H12,
a stated full payoff1200 at q12 leaves post-payoff zero; q13 opening1200 is a
contradictory continuation, not another admissible payment of that retired loan.
Without that payoff, q13 is still outside H; neither case authorizes generating
or extending the stream. Nominal/12, full n after IO, whole-year K and the
written unrounded PMT/interest/principal associations above are unchanged.

Debt yield declares both basis axes. For L1, denominator is the same selected
loan's positive `loan_amount` at close, not a post/pre-payment balance or total
commitment inferred from draws. Numerator is the explicitly bound stated
period's NOI or admitted NCF, so `DY=selected_income/loan_at_close`; no
stabilized-period fallback. Current-balance lender/covenant variants remain
outside this admission. Existing point-in-time stack verbs stay separate.

**U5 — reserve placement.** Require `reserves_placement` on each record; no
asset-class/default inference. Bind each reserve component once with an
explicit above/below allocation in the same scope/period/variant. A mixed record
must bind separate components with their declarations, not collapse contradictory
placements for the same cost. Let R_above be the ordered sum already included
in OpEx and R_below the ordered sum not deducted above NOI; both start at +0.
Then `NOI=(EGI-OpEx_excluding_reserves)-R_above` and
`NCF=(((NOI-R_below)-TI)-LC)-capex`. Explicit zero is allowed; omission is not
zero. An above-NOI reserve is never subtracted again from NOI. A duplicate
component, unresolved allocation or missing bridge cannot verify. These are
NOI/NCF arithmetic measures; they do not replace VIII.9.6/11's owner-cash and
reserve-source membership rules. A reserve-funded expenditure/release needs
its explicit native cash bridge; NCF alone is not complete owner cash.

**U6 — CoC.** Only year1, `cash_on_cash_numerator=after-capex`, is admitted.
Bind the signed year-1 levered operating-cash stream after TI/LC, reserves not
already charged, capex, actual debt service and explicitly identified financing
events. Exclude sale proceeds. Sum its bound signed components in declared
order from +0, with each cash event once; require the bridge to the stated
year-1 levered cash target rather than verifying by copying that target.
Bind initial acquisition equity E and immediate repairs H without overlap;
`initial_equity=E+H`, the magnitude of the corresponding initial equity outflow,
and `CoC_1=cash_after_capex_1/initial_equity`, positive denominator required.
No later contribution, cumulative-equity fallback or denominator restatement
changes this initial base. Later-year and before-capex CoC are outside L1.
Use the same explicit reserve placement/cash membership evidence as U5.

**U7 — comparison and operation order.** New identities use minima m and
reporting ceilings r equal to the existing dictionary **unit quanta**:
`$`: m=r=2; `%` (stored fraction): m=r=6; `x`: m=r=4. These are decimal places,
not $2/6%/4x error allowances. Apply VIII.5.1 directly to the unrounded result
and original numeric token; no intermediate reporting rounding, double rounding,
absolute/relative epsilon or solver-tolerance reuse. Existing dictionary-owned
and reused native identities retain their exact current minima/ceilings and
refusal rules; this ruling does not rewrite their contracts.

The associations above are literal binary64 steps, with P the accepted RFC0088
primitive. Sums preserve explicitly bound order. No reassociation, fused
operation, alternate integer power or host pow is an equivalent procedure.
Missing source precision/selection remains typed evidence; missing usable
financial inputs cannot become zero. A finite comparable mismatch fails;
unsupported procedures are unverifiable; reused solver and domain refusals
retain their existing states. The producer declaration's running products,
host-math seam and local 1e-* guards are evidence of adoption work still needed,
not substitutes for this standard's procedure. Independent end-to-end composed
procedure evidence remains an acceptance/readiness gate, not an unresolved
choice of a new epsilon.

### 4. L1 identities and numerical admission

L1 lists candidate stabilized-acquisition identities, initially fixed-rate debt.
The U1 disposition selects the initial bounded return/method subset and optional
ledger scope; this is not universal period-by-period reproduction. L2/L3 remain future sets. Unknown/custom/vendor rows are retained and counted
unverifiable (`identity_not_defined`), never omitted or silently passed.

Notation: `t` is an explicit period, `j` a line, `q` a payment. Revenue/expense
magnitudes below must be explicitly bound as such; investor cash is signed.
Do not reinterpret an existing signed cash row by its label. Sums follow declared
source/line order left to right, and dependencies are explicit. No hidden iteration
solves a circularity. Algebra alone is not a binary64 reassociation license.

Precision: `M` = `$`, reporting r2; `R` = `%`, reporting r6; `X` = `x`, reporting
r4, per VIII.5. These are decimal reporting quanta, not epsilon allowances.
Dictionary-bound DSCR/debt-yield/LTV/CoC reuse that class entry's actual minima
and ceilings. Apply RFC 0079/VIII.5.1 once to the unrounded result at
`d = min(max(source_decimals,m),r)`, half away from zero, retaining numeric tokens,
trailing zeroes and exponents. No double rounding or relative epsilon.
New identities use the owner-resolved unit-quanta minima in section3a (U7).
Existing dated-series comparisons retain VIII.9.4's full reporting quantum when
that verifier is reused.

| Identity | Inputs / convention dependencies | Formal check, unit/precision and authority/gate |
|---|---|---|
| Growth | Prior line A, stated g, explicit application count; growth/start and timeline | Single step `A_t = A_previous*(1+g)`; general `A_t = A_base*P(1+g,k)`; monthly increment `P(1+g,1/12)-1`. M/R; algebra, timing U3 and accepted RFC0088 primitives. Never author missing intervening rows. |
| Vacancy, credit loss, EGI | GPR, other income, loss amounts/rates; selected vacancy/credit bases, occupancy | `GPRV = GPR+other_income`; `loss = rate*selected_base`; `EGI = GPRV-vacancy-credit_loss-concessions-loss_to_lease`. M; additive identity. Each deduction needs explicit binding/zero and no-double-count evidence. Occupancy-to-loss conversion U3. |
| Expenses | Stated amount/rate and units/occupied units/SF, EGI/reimbursements; line class and fee base | Fixed reads authored amount; quantity line `expense = rate*quantity`; percentage `expense = rate*selected_EGI`; sum exact bound lines. M; algebra, scaling/growth U3. No fixed-label default amount. |
| NOI | EGI, opex excluding reserves, reserve allocation; placement | `NOI = EGI-opex_excluding_reserves-R_above`, with explicit above-NOI allocation. M; additive identity, U5. |
| NCF | NOI, explicitly allocated reserves, TI, LC, capex | `NCF=(((NOI-R_below)-TI)-LC)-capex`; above-NOI reserves are already deducted. M; owner-resolved U5, section3a. |
| Debt service | Fixed monthly rate, full count, explicit IO boundary and original principal | Fix PMT once at amortization start; follow section3a U4 for payments and left-to-right actual-payment sum. M; no implicit annual/daily accrual or generated land schedule. |
| Interest/principal | Monthly opening balance, annual rate, explicit IO boundary | Admitted monthly mortgage uses `I_q=B_open*(r/12)` and the exact U4 payment/principal steps in section3a. M. Date-based accrual/stub variants are outside L1, not inferred from r/12. |
| Balance/balloon | Opening/closing balance, principal, explicit payoff binding | L1 monthly mortgage uses `B_close=B_open-principal`; draws and other paths remain broader inventory only. A supplied balloon binds post-payment outstanding balance once under section3a U4. M. |
| DSCR | NOI/NCF; actual service/amortizing constant; both DSCR choices | `DSCR_t = selected_income_t/selected_service_t`. X, existing dictionary precision; alternate income/constant semantics U4/U5. No silently substituted amortizing payment during IO. |
| Debt yield | NOI/NCF, loan at close; both declared basis axes | `DY_t=selected_income_t/loan_at_close`. R, current dictionary precision; U4 restricts L1 to loan-at-close, section3a. |
| LTV | Selected loan and declared denominator | The three identities above. R, current LTV precision; missing basis refuses. |
| Exit value/costs | Selected forward/trailing NOI/NCF, cap, gross sale, cost rate | `gross_sale = selected_income/cap`; `sale_cost = gross_sale*cost_rate`; `net_sale = gross_sale-sale_cost`. M; algebra. Forward input must be authored beyond the hold. No unapproved stated-price convention is introduced. |
| Equity sale proceeds | Net sale, stated outstanding debt payoff | `net_proceeds_to_equity = net_sale-debt_payoff` under Format4.9/RFC0077's aggregate-equity/junior-debt boundary. Common-only proceeds keep separate fields. M; payoff timing U4. |
| Unlevered/levered flows | Stated signed property cash, debt draws and positive interest/principal/fee magnitudes | `U_t = sum(bound property cash amounts)`; `E_t = U_t+debt_draws_t-interest_t-principal_t-financing_costs_t`. M; algebra with each acquisition/exit component once. Financing costs at t0 enter equity. Retain VIII.9.6 reserve/cash exclusions and explicit coverage; NCF is not automatically complete owner cash. |
| IRR | Signed flows, exact timing/dates, frequency, existing series day count | Annual `irr(CF0,...,CFn)` via VIII.3/RFC0024; monthly `m=irr(monthly_flows)`, annual report `P(1+m,12)-1`; dated VIII.9.3 `xirr`. R; unchanged solver/refusals, timing U3, accepted RFC0088 primitives. No Newton polish/new tolerance. |
| Equity multiple | Separate distributions D_t and contribution magnitudes C_t | `EM = sum(D_t)/sum(C_t)`. X; approved fixed rule/VIII.9 precedent. Do not net a same-period contribution/distribution or infer gross flows from a net row. Retain reused verifier's domain/refusal contract. |
| Year-1 CoC | After-capex signed cash bridge and explicit initial equity | `CoC_1=cash_after_capex_1/(E+H)`, exactly as section3a U6; R, existing dictionary CoC precision. Before-capex and later-year ratios are outside L1. |
| NPV | Exact ordered annual or dated stream and rate | Periodic terms use `CFk/P(1+r,k)`; dated terms use `amount_i*P(1+r,-t_i)`, each accumulated from +0 as section3a U3 prescribes. M; never conflate the two binary64 procedures. |

A supplied assumption or fixed line with no independent identity remains an
input-only, unverifiable row. Reading/copying it cannot earn a verified count;
a growth or build-up identity can verify its stated consequence.

`P` means RFC0088's accepted `pinnedPow`, not a convenient host pow. Section3a pins admitted composed operations/domains; independent end-to-end
evidence and final initial-scope review still precede acceptance. The other
inventory rows do not become executable by appearing in this table.

### 4a. U1 disposition — bounded initial identity scope

U1 is a concrete recommendation from accepted state-and-verify precedent,
**PENDING owner membership decision** and final evidence review. The initial L1 scope is **return/method binding first**, plus optional
declared-ledger coverage and individually enumerated identities below. It does
not activate every candidate in section4. U2 imposes no minimum document row set.
The implementation must support the entire accepted initial vocabulary even
when one document states only a small subset.

| Initial identity group | Exact existing authority and permitted binding | Boundary |
|---|---|---|
| Dated return/method binding | Format4.26 / Protocol VIII.9: `total_net`, `moic`, `xnpv`, `xirr` over one explicitly selected `cash_flow_series`, its ordered original rows, explicit day count (L1 admission actual/365f per section3a) and (for XNPV) stated rate. | Bind a headline to that exact stream and metric; preserve the existing metric's complete domain, comparison quantum, solver/refusal and verdict rules. A levered/unlevered label alone selects no stream or financial behavior. |
| Point-in-time stack figures | Format4.24 / RFCs0026 and0033: the closed `coverage`, `blended_coverage`, `debt_yield_through`, `ltc_through`, `ltv_through`, `weighted_cost` vocabulary and exact `over`/`through`/`*` selector. | Reuse accepted stabilized stack service and source dependencies. This does not construct an actual loan schedule, impose that service on IO cash flows, or reinterpret stack LTV as per-loan LTV. |
| Stated lease-up identities | Format4.25's period `net_cash_flow`, final `occupied_sf` and final `occupancy_rate`, using its current size context and signed components. | Reuse the existing verifier's quantum and missing-input behavior; do not invent an occupancy-to-rent-loss conversion or a stabilized annual extrapolation. |
| Explicit per-loan LTV | The owner's three-option `debt_structure.ltv_basis` direction in section3, with the current LTV dictionary comparison precision. | One explicitly selected loan and chosen denominator; no fallback or new precision minimum. Other dictionary definitions and pending metric decisions are outside this work. |
| Optional declared acquisition-ledger coverage | Existing explicit-coverage precedent in Protocol VIII.9.6 / RFC0045: inventory the producer's declared source rows and their explicit bindings/exclusions. | Account for membership and duplicates, not inferred completeness of the real transaction. Ledger monetary reconciliation requires its own enumerated procedure with section3a U7 precision; membership coverage alone is not arithmetic verification. |

A pro forma target is not verified merely because the referenced native section
has a verified headline: evaluate the same accepted identity against the actual
bound target, with the same exact inputs and comparison contract. Preserve its
native findings as evidence. No self-copy or input assumption becomes an
independent identity. If the selected method, target or timing is outside that
accepted identity's domain, retain the statement as unverifiable; do not adapt
it by new annualization, signs, cash assembly or model generation.

The owner has resolved U3–U7 for section3a's bounded procedures. Those
resolutions make the named contracts eligible for an explicit U1 scope decision;
they do not automatically activate every candidate row. Recommendation: retain
the bounded initial groups above; add each new periodic-return, monthly-loan,
NCF or year-1 CoC identity only by explicit enumeration with its independent
procedure evidence. Include the land summary-to-stated-stream assertion as that
individually justified intake, without schedule generation or land DSCR/cap rate.
Outside-scope statements remain visible as unverifiable, not omitted. U1 is an
acceptance gate on this proposed membership, not a reopened numerical convention.

### 4b. Exact proposed U1 vocabulary — PENDING owner

Recommend these fifteen entries: fourteen financial identity tokens plus one
non-arithmetic membership assessment. These are proposed profile relationship
tokens, not new dictionary metric ids, schema activation or a claim that an
implementation exists. Reused identities inherit their entire accepted native
contract, not only a formula. In particular stack and lease-up fixed comparison
quanta below are not overwritten by new-identity U7 minima. All named required
inputs, explicit selections and applicable declarations must be admitted before
a native helper can supply a default. A target is compared directly using the
same selected inputs, never accepted by copying a native section's verdict.

Common selectors: exact current section variant (unlabelled null remains distinct
from `default`), target pointer, admitted period identity and selected loan where
applicable, all resolved within one source/model snapshot. Bind currency and
source numeric precision where their identity requires them. A method label
cannot choose a stream, loan or missing context. Original ordered stream rows
remain distinct, including equal-date/equal-value rows. A completely absent
numeric target is not a fabricated zero assertion; declared-ledger obligations
are accounted separately. Evidence S1–S6 denotes the independent comparison
bundles described after the table, all still incomplete before acceptance.

| Proposed token | Exact bound inputs / selectors / applicable declarations | Unit and comparison | Domain, refusal and remaining evidence |
|---|---|---|---|
| `total_net` | One selected `cash_flow_series` original ordered finite amounts, dates and explicit `day_count=actual/365f`; `cash_flow_timing=dated`. | Series currency, native fixed2 decimals. | Native nonempty/valid/nondecreasing dated-row admission; ordered sum. Missing/invalid stream stays unverifiable, no inferred calendar. S1. |
| `moic` | Same exact selected original stream; separate positive inflows and negative outflows as native VIII.9, no inferred gross events from a different net stream. | x, native fixed4 decimals. | No outflows is unverifiable, not zero/infinite/failed by a new policy. Same-day distinct rows survive; signs/netting cannot be rewritten. S1. |
| `xnpv` | Same selected dated stream and explicit finite rate>-1; `actual/365f`, dated timing; compare the actual bound headline target. | Series currency, native fixed2 decimals. | Native negative-power multiplication, original order, domain/refusal states; no annual-positive-power division substitution. Missing rate/stream is unverifiable; native procedure refusal retains failed evidence. S1. |
| `xirr` | Same selected dated stream; dated timing, `irr_frequency=xirr`, explicit `actual/365f` and first-row anchor. | Fraction, native fixed6 decimals. | Exact VIII.9.3 bracket/endpoints/stopping/refusal behavior. Native no-bracket/procedure refusal is failed, not a new generic unavailable state. S1. |
| `coverage` | One exact `capital_stack.sizing` target with `fn=coverage`, `over` selecting one existing tranche id, selected stated NOI and that tranche's accepted cash-service inputs. | x, native fixed2 decimals. | Exact native stabilized annual cash-service contract; missing/zero service or missing NOI is unverifiable. Not an actual IO-payment schedule. S2. |
| `blended_coverage` | `fn=blended_coverage`, exact `through` position and ordered qualifying tranches, selected NOI and native service dependencies. | x, native fixed2 decimals. | Native through-selection/service sum and refusal behavior; no alternate tranche/period substitution. S2. |
| `debt_yield_through` | `fn=debt_yield_through`, exact `through`, selected NOI and native debt-tranche amounts at/above that position. | Fraction, native fixed4 decimals. | Missing/zero accepted denominator remains unavailable; not the new per-period NCF/current-balance candidate. S2. |
| `ltc_through` | `fn=ltc_through`, exact `through` debt membership and selected total project cost. | Fraction, native fixed4 decimals. | Native stack context/domain; no value/price fallback for missing/zero cost. Distinct from per-loan `ltv`. S2. |
| `ltv_through` | `fn=ltv_through`, exact `through` debt membership and selected native total value. | Fraction, native fixed4 decimals. | Native stack context/domain; no cost substitution or per-loan basis relabelling. S2. |
| `weighted_cost` | `fn=weighted_cost`, whole-stack `over=*` and exact original tranche order, amounts and native eligible stated rates. | Fraction, native fixed4 decimals. | Reuse native eligible-rate membership and amount-weighted association; zero eligible base is unverifiable. Do not infer a missing rate or select a different stack. S2. |
| `net_cash_flow` | Selected `lease_up_schedule`, admitted monthly/quarterly period key, exact target and signed `rent_revenue`, `concessions`, `ti_lc_capex`. | Currency, native fixed2 decimals. | Accepted ordered signed addition, all three components required. Missing component is unverifiable; do not change signs or annualize. S3. |
| `final_occupied_sf` | Selected lease-up `stabilized_summary.occupied_sf` target against its admitted final schedule period's `occupied_sf`. | sqft, native fixed2 decimals. | Exact ordered/valid period domain; missing final value is unverifiable. No invented occupancy path or size conversion. S3. |
| `final_occupancy_rate` | Selected lease-up summary rate; exact native occupied-SF source (final row, or explicitly stated summary fallback when native contract permits), and bound `leaseUpContext.total_sf` under the size registry. | Fraction, native fixed4 decimals. | Native missing/zero sqft-denominator behavior and dimensional limits. Retain summary/final dependency findings; never infer SF from kW/units or claim a trajectory achieved. S3. |
| `ltv` | The same selected loan's direct explicit `ltv_basis`, `loan_amount` and exactly one selected price/value/project-cost home in section3. | Fraction, existing dictionary m2/r6 and source-token comparison. | Three owner-directed denominator choices; missing/unknown basis or missing/null chosen denominator unverifiable, no fallback. Existing zero-division/domain evidence retained; no new negative-value policy. Changes the existing all-class id even outside profile claims; no parallel metric. S4. |
| `declared_ledger_membership` | Explicit optional acquisition-ledger universe, canonical source-event/row addresses, required roles and exact binding/exclusion declarations in this snapshot. | Membership only; no monetary quantum or extra numeric assertions. | No inferred transaction completeness. Required unbound/duplicate/conflicting membership produces visible gaps/findings; distinct equal-value events remain distinct. No monetary reconciliation. Proposed gap-sensitive exit is separately PENDING U9. S5. |

S1 requires independently authored dated-stream comparisons for all four metrics,
method/stream/target substitutions, same-day gross versus net, domain/refusal and
fixed quanta. S2 requires all six native stack verbs, selector/dependency and
zero/missing controls at their native2/4-place boundaries, including exact
service/eligible-rate composition. S3 requires all three native lease-up
identities, signed components, final-period and native summary fallback,
size-context/missing-input and2/4-place controls. S4 requires every LTV basis,
selected-loan/denominator binding, absence/no-fallback and m2/r6 token controls.
S5 requires independent declared-universe/role/address membership expectations,
collisions/gaps/exclusions and U9 paper vectors; it has no fictional spreadsheet
arithmetic positive. Independently review its membership mapping alongside each
complete numeric fixture. Existing arithmetic/API review is partial evidence
only; actual spreadsheet/composed evidence remains absent for these complete
fixtures. All evidence must record the provenance and recalculation listed in
Conformance impact before final acceptance.

No new annual-periodic IRR/NPV, lender monthly IRR, monthly mortgage schedule,
NOI/NCF bridge, per-period DSCR/DY, exit, gross-equity-multiple or year-1 CoC
identity enters this initial vocabulary merely through section3a or4. Unknown,
custom and input-only targets remain inventoried/unverifiable. A single empty
native result cannot turn zero inventoried target assertions into assurance.

### 4c. Explicit land stated-stream intake — separate pending U1 choice

Propose stable token `stated_debt_service_sum` for the owner-requested land
summary-to-authored-stream intake. It is **not admitted by the fifteen-entry
recommendation**. Recommend retaining this visible candidate and asking the
owner separately whether it is a sixteenth initial member, contingent on its
complete independent evidence S6 before final acceptance. Neither the original
intake nor the settled U3–U7 conventions implicitly makes that choice. Until an
explicit membership decision, retain the land statement as
`identity_not_defined`/unverifiable; do not omit it or earn a positive from a
numeric summary alone.

Its proposed exact target is one selected land loan's
`debt_structure.annual_debt_service`. Bind the original positive-magnitude
stated payment components in declared source order, a single exact loan address,
explicit annual interval boundaries/period key, currency, scope and current
variant. Each component binds a canonical event/row address and role
(interest, scheduled principal, separately paid principal payoff/balloon or fee).
The declared component universe and explicit included/excluded membership must
resolve fees and payoff treatment; there is no default inclusion/exclusion and
no inferred zero. A reserve-funded share is funding of an already bound payment,
not another service event. Reusing one payment via two aliases/roles is a conflict;
two distinct equal-date/equal-value events are not duplicates. Bind a required
component once or report its missing membership/stream explicitly.

For that declared component set, sum the bound payment magnitudes left to right
from +0 and compare the actual summary under new-identity U7 currency m=r2,
using its original numeric token. There is no loan-times-rate shortcut, generated
schedule, inferred accrual calendar or assumed maturity/fee policy. Mixed loan,
period, currency, scope or variant inputs cannot supply one positive; retain
local ambiguity/missing evidence and independently demonstrated disagreement.
A missing stream is unverifiable; negative/zero land NOI does not make service
inapplicable. This asserts only the stated stream/summary identity, no land
DSCR/cap rate or real-world completeness.

S6 needs an independently authored complete sum/membership spreadsheet and
composed-procedure evidence, with explicit loan/period/currency/variant and
interest/principal/fee/payoff/reserve-funded membership, wrong-summary, missing
stream, alias/duplicate and distinct-equal-event controls. The independent
1325.00 arithmetic witness is partial reference evidence, not a completed
spreadsheet, accepted vocabulary or profile execution. It cannot choose fee or
balloon treatment for another record.

### 5. Determinism dependency — U8 resolved

RFC0088 is accepted and merged in [#357](https://github.com/UWMD-OSP/UW-Markdown/pull/357)
at `8a646aa219620c143bb8439aa67cf010d9896a79`, with
[green exact-main CI](https://github.com/UWMD-OSP/UW-Markdown/actions/runs/39113501954).
The owner's 2026-10-18 direction closes U8 against that accepted contract.
Use the public `pinnedPow`, `pinnedExp` and `pinnedLog` implementation: one exact
pinned fdlibm procedure across every exponent class, including negative powers.
The historical #356 running-product proposal is not the selected procedure.

Accepted financial associations, reporting quantizer and solver behavior remain
authoritative, including endpoint, iteration and refusal rules. RFC0088's
accepted authenticate-first receipt precedence also remains authoritative; this
profile adds no receipt rule. Monthly compounding, annualization and integer or
fractional discounting use the accepted primitives whenever their identity is
admitted. No host-power fallback, competing integer-power procedure or
log1p/expm1 stability rearrangement is authorized here.

Closing the primitive dependency does not accept new composed profile identities.
Section3a now records the owner-resolved admissions, associations and comparison
minima. Independent composed-procedure evidence remains necessary; primitive
evidence alone does not establish it or accept U1 scope or U9 reporting.

### 6. Verdicts, coverage, receipts

Reuse `verified` / `failed` / `unverifiable` from Format4.24 and metric verification.
Finite comparable disagreement fails; missing usable input, unavailable accepted
procedure or undefined identity is unverifiable. A reused identity retains its
existing computation-refusal verdict (including dated XIRR failure), not a new
blanket refusal state. Structural/selection/arithmetic refusals retain typed
evidence; profile accounting/transport allocation follows section6a.
Do not reuse capital-stack codes for unrelated rows or add a generic fallback.

Count distinct **assertions**, not JSON cells, formula operations or repeated
checks on one target. Each assertion has one stable identity with exact
source/variant/period/method/target bindings, applicable assurance scope,
conventions, precision, verdict and reason/typed evidence. A row may expose
multiple named relationships, but their dependent operations do not multiply the
number of verified figures. Report relationship results separately from terminal
assertion counts, and group assertion counts by verdict and row family, including
rows stated with no defined identity. Those rows remain visible as unverifiable;
they cannot disappear from coverage because no identity can be evaluated.

Inventory the declared universe independently of the checks the implementation
supports. Inapplicable relationships are excluded with reasons, never counted
passed/failed. A claimed unsupported check remains unverifiable; it cannot become
an unclaimed statement. An explicitly inventoried assertion with no relationship
claimed is also unverifiable but has a distinct `relationship_not_claimed` reason.
Do not add a fourth `stated-only` verdict: retain that distinction in reasons and
claim status under the brief's required three-state vocabulary.

Missing inputs required by a stated assertion remain unverifiable. Missing
components of an explicitly declared ledger universe are coverage gaps even when
no numeric cell exists; section4a bounds that optional universe. These are not
a mandatory L1 row inventory or a basis to refuse a thin document. Report gaps
and exclusions separately; do not manufacture values or inflate the denominator
with operations. Empty claim sets establish no assurance and report zero
assertions, without a minimum-row refusal. The denominator is the declared
applicable assertion universe, not a document-wide percentage or a guarantee
about undisclosed facts. Sections4a/6a fix initial enumeration, duplicate handling
and counting rules within the owner's resolved U2 rule.

Local arithmetic agreement is not a clean financial-verification claim when a
required prerequisite failed or is unverifiable. Retain local relationship
findings separately and block terminal verified status through such dependencies.
Section6a states assertion precedence without borrowing a receipt aggregate
success rule or hiding demonstrated disagreement behind missing inputs.

**Receipt disposition:** coverage is a separate verification result, not a new
field in existing receipts. [RFC0016](0016-verification-receipts.md) and
[Receipt](../../spec/UW_RECEIPT.md)4/5.1/5.5 retain pack-output, subject, policy,
signature and verdict contracts. A verified financial receipt does not assert
every pro forma identity passed. Validation findings gain no new issuance veto.
An authenticated coverage report needs a separately governed subject/result
contract; no such wire structure is invented here. RFC0088/0089 keep their
separate receipt/subject ownership.

### 6a. U9 disposition — assertion identity and coverage protocol

This is proposed profile-specific text derived from Protocol II.6a/III/XI,
Format4.24-4.26 and the existing stated-metric/verification CLI boundaries.
U9's accounting/transport choices do not supply any U3-U7 numerical convention.
**PENDING owner:** the recommended declared-gap exit rule below is proposed,
not an owner ruling or current CLI behavior.

**Inventory and identity.** First inventory the document's stated pro forma
rows, including input-only and unknown/custom identities, independently of which
checks can run. The exact selected source/model and target address are authority;
labels, equal values and implementation object identity are not. For a source
operation retain the admitted original source and its selected physical block;
for a model operation use the supplied current model, without silently reparsing
stale raw text. Neither operation fills fields or mutates source, model or meta.

Inventory all rows of the explicitly claimed pro forma, plus external statement
targets it binds, in the current selected blocks. Historical/superseded and
unselected peers remain retained source/validation evidence, not additional
current assertions merely because they are retained. A binding cannot silently
select a historical or arbitrary peer; preserve the existing selection refusal.

**Canonical target context before keys.** Resolve each declaration against one
admitted snapshot before duplicate elimination. A source block address is its
physical ordinal in retained source order; a model block address is its full
document-rooted typed path. Resolve pointer segments against the actual tree:
map keys remain exact strings, array positions are canonical integer indexes,
and pointer escapes have one decoded spelling. Do not treat an array index as
a free string or collapse null/unlabelled variant to literal `default`. Preserve
accepted exact variant/period/loan selection refusals and source accounting.

The physical target address, not a declaration's optional labels, first groups
all declarations of one assertion. Derive `period_key_or_null` and
`loan_ref_or_null` from that admitted target's structural context and the
accepted identity's bound selector: a period row's admitted period key, the
same selected loan's canonical address, or null when the target has no such
context. Explicit declaration members must agree with that derived context;
absent members do not erase it and supplied null cannot mask it. If the physical
target has no period/loan context, adding `Y1`/another loan is a contradiction,
not a second key. If context cannot be uniquely resolved, retain one target
assertion with all declarations and local typed/ambiguous-context evidence;
do not mint one assertion per guessed context. Distinct physical targets remain
distinct even when values/labels match. An unresolved target declaration remains
visible/unverifiable at its canonical declaration address; it cannot disappear
because the referenced target is absent. Ambiguous raw addresses are retained
as unresolved evidence, not coerced into an invented physical target.

After that resolution the assertion key is `(block_address_kind, block_address,
section_id, variant_or_null, target_pointer, canonical_period_or_null,
canonical_loan_or_null)`. It is stable only for one admitted snapshot, not an
object-identity or cross-revision guarantee. Canonicalization of these report
keys is structural addressing, not a new cryptographic digest or subject.
Use accepted RFC0089 Envelope2.0/source accounting and current subject
descriptors; complete-source commitments remain separate from selected targets,
portable projections, V9/V11/V12, results and signing inputs. Unavailable hashing
never implies authentication or a successful arithmetic assertion.

**Validate relationships before deduplication.** One assertion can have several
relationships. Their complete semantic equality includes the accepted
identity/method and procedure version; canonical target context; exact ordered
input bindings with their roles, source/model snapshot and event addresses;
all effective explicit conventions (including per-record allocations); unit and
currency; original numeric-token precision evidence and the applicable
minimum/reporting/quantizer contract; applicability/exclusion declarations; and
required dependency selections. A display label is not authority. Unknown or
invalid semantic members are retained with refusal evidence, not stripped to
make two records identical. Required dependencies come from the accepted identity,
never a producer's optional flag. No undisclosed default supplies a missing field.

Validate all declarations and relationship variants first. Only semantically
identical valid relationships may share one check; retain links to every original
declaration. Equal target/method/ordered bindings alone are insufficient. A
coarse-key or declared-identifier collision with different semantic content
retains every variant under the same assertion, records the conflict and cannot
select first/last content. Thus actual/365f versus actual/360, contradictory
units/precision or conflicting applicability do not silently deduplicate.
A repeated identical invalid declaration may share a report finding with all
origins retained, but cannot become a valid/passed relationship by deduplication.
Contradictory context/relationship variants block a clean terminal verification;
independently demonstrated failures still take precedence under the state rule.
This defines semantic equality/collision handling, not a new report hash, receipt
subject or authentication claim. Exact duplicate assertions/checks count once;
report position may use first occurrence without selecting its conflicting value.

**Accounting.** Every inventoried assertion receives exactly one terminal
`verified`, `failed` or `unverifiable` state and exactly one authored row family.
An absent/unrecognized family is counted in explicit family `unclassified`, not
dropped. Conflicting authored families for a deduplicated target also count once
in `unclassified`, retain every declaration and add local reason
`ambiguous_family`; no family is selected from first/last occurrence. Treat that
ambiguity as unverifiable unless an independently demonstrated failure takes
precedence under the state rule below. The row family is descriptive and never chooses financial behavior.
Report `total`, three `by_verdict` counts and the same three counts plus total
for every nonempty `by_row_family` entry. The sums must agree exactly, and empty
reports contain explicit zeros. Rows without a defined identity or independent
relationship are unverifiable with distinct reasons, never coverage exclusions.
Relationship/check/operation counts, if supplied, are separate from assertions.

Report inapplicable relationships as exclusions with reasons. A component missing
from an explicitly declared optional ledger universe is a separate gap, not a
fabricated numeric statement. An absent row outside that declared universe is
not a missing minimum-profile requirement. Gaps and exclusions do not inflate
assertion denominators or become passed checks. Under the PENDING recommended
U9 policy, an unmet required obligation in an explicitly declared ledger universe
affects the completed-assessment exit even when assertion counts are zero.
An exclusion is not automatically an unmet obligation; a purported exclusion
that conflicts with an explicitly required membership must be reported as that
required gap rather than silently waiving it. Zero rows means zero assurance;
there is no minimum-row refusal or vacuous aggregate `verified` claim.

**States and precedence.** Preserve each reused identity's existing numeric
refusal/state rule: e.g. a stated dated XIRR refused by its accepted procedure is
failed, whereas an undefined MOIC with no outflows is unverifiable. Do not
flatten both into a new generic arithmetic policy. For new candidate identities
whose contract is not yet accepted, report `identity_not_defined` rather than
executing guessed arithmetic. A valid target with no relationship uses
`relationship_not_claimed`; missing/null bound inputs use their existing
missing-input reason, with original typed evidence retained where available.

Evaluate independently decidable relationships even when a peer cannot run.
At the assertion boundary, any demonstrated failure takes precedence over an
unverifiable relationship; otherwise any unavailable/blocked required relationship
makes it unverifiable; only all applicable required relationships verified can
make it verified. Required relationships/prerequisites come from the accepted
identity definition, never a producer opt-out. A failed/unverifiable prerequisite blocks a dependent
relationship's clean verification; preserve any already established disagreement
and all local findings separately. This is an assertion result rule, not receipt
precedence or permission to suppress base validation errors.

**Ordering.** Emit assertions in retained source-target order. For model
operations compare section/variant/address key strings lexicographically by
UTF-16 code units (RFC8785 sorting precedent), null before strings and address
array indexes numerically. Emit relationships in their
authored binding order and local findings in their owning verifier's existing
order. Deduplication retains the first occurrence's report position, without
selecting conflicting content. Preserve the registered validation issue array
and its independent ordering in a separate `validation` result; do not interleave
profile findings or turn every schema rejection into a new validator error.

**Proposed CLI.** `uwmd verify-pro-forma <file> --json` is read-only and emits one
UTF-8 JSON document on stdout; diagnostics go to stderr. It inventories the
explicit `dcf.pro_forma` claim and its stated targets. Conventions/timeline are
required only when the chosen check's accepted contract requires them; empty
bindings are allowed by U2. Selection is expressed by the claim's explicit
per-section bindings, not a global flag that picks one arbitrary peer everywhere.
No command writes a document, cached result or receipt.

| Outcome | JSON / exit contract |
|---|---|
| Completed assessment | `status: "completed"`, `profile: "pro-forma"`, `level: "L1"`, exact selection evidence, ordered `assertions` and `relationships`, `coverage`, `gaps`, `exclusions`, plus separate `validation`. **PENDING recommended U9 rule:** Exit0 iff there are no validation errors, failed assertions, unverifiable assertions or unmet required obligations in an explicitly declared ledger universe. A genuinely gap-free zero-row claim exits0 with explicit zero coverage and no financial assurance claim. Exit1 otherwise; declared gaps remain separate from assertion counts, without fake assertions, minimum rows or operation refusal. |
| Operation cannot admit/inventory the request | `status: "refused"` and `error` satisfying ProtocolError; exit1. Preserve an existing typed source/selection error. Propose narrowly scoped `CALC-PRO-FORMA` (category `calc`) for malformed CLI/profile-claim syntax, absent explicit profile claim or an unreadable requested file only; do not use it as a fallback for uncoded Format failures, unknown identities or missing arithmetic inputs. No fabricated zero-coverage success. |
| Unrecoverable internal implementation failure | Exit2 under II.6a.2; stdout need not be a result. A missing/unreadable requested file is the typed request refusal above, not a financial disagreement. |

Per-row unsupported/undefined checks produce unverifiable rows in a completed
assessment, not an operation refusal. Registered base validation findings remain
visible even if arithmetic can run; errors affect the CLI exit without changing
unrelated per-row financial states. Source selection failures that affect only
one fully inventoried assertion remain local typed unverifiable evidence; a
failure preventing inventory of the claim itself is an operation refusal.

**Pending U9 decision vectors (paper contract, not executed CLI evidence).** A
valid empty/gap-free claim has total0/by-verdict zeros and exit0. The original
review witness (one explicitly required ledger payment, no bound target cell)
still has total0/by-verdict zeros and one required gap: the old written proposal
permitted exit0, while this recommendation proposes completed/exit1. Preserve
that original expectation as historical paper evidence; do not edit it into a
purported passing runtime test. A merely excluded inapplicable relationship or
an absent undeclared row creates no required gap and does not alone cause exit1.
A failed or unverifiable assertion, or a separate validation error, still causes
exit1. Missing input for an inventoried row is a completed local unverifiable
assessment; malformed/absent claim or inability to inventory the request remains
a typed operation refusal. An FV error-band deal-quality flag is not by itself
a validation error or profile arithmetic failure.

The alternative is assertion-only exit0 despite declared required gaps. It keeps
the original predicate but requires callers to inspect `gaps`; it is less useful
for automation requesting declared-ledger coverage. Recommend the gap-sensitive
rule, with both choices PENDING owner confirmation. This proposal intentionally
differs from the default base `verify-*` unverifiable-exit0 rule in Protocol
II.6a.2; the reserve verifier commands supply existing profile-specific exception
precedent. It changes no base CLI here and requires explicit synchronized text
if accepted. A completed exit1 is not the same status as a refused request.

The CLI does not adopt the standalone receipt verifier's exit3 convention:
Protocol II.6a.2's 0/1/2 contract applies. Future synchronized protocol types,
JSON Schemas, the capability/profile registry and portable/nonportable fixtures
must pin these exact fields, counts, array ordering, failures and exits before
advertising support. Keep result reasons distinct from registered validation
codes. This proposal adds no new receipt field, issue family, comparison minimum,
financial method or activation of the current validator.

## Launch scope

The profile is optional and ships with everything else at the approved 5.0.0
public launch. Before launch it may land on main in 4.x. No surface/release
version is allocated, and no tag or publication authorized. The proposed initial
scope is the U1 disposition above; comprehensive underwriting generation is not
a launch requirement.

## Conformance impact

No source fixture or expectation changes in this PR. Future implementation adds
synthetic `conformance/pro-forma/` cases and a portable profile target; unrelated
suites are not silently rebaselined and incomplete implementations cannot claim
support. Proposed case groups, not files created here:

- **Claim/coverage:** claimed, unclaimed and unsupported profile; every verdict;
  unknown identities; distinct assertion/relationship/family totals; duplicates,
  applicability exclusions, empty claims, blocked dependencies and required gaps
  without cells; thin/partial documents admitted without a minimum-row refusal,
  zero-assertion coverage, and rows stated with no defined identity counted by
  verdict and row family.
  Capability skips are not passing evidence.
- **Selection/source:** exact period/loan/variant, duplicate/missing periods,
  ambiguous peers, independently changed selected/unselected inputs, read-only
  source/model, numeric tokens and no default filling.
- **Each identity family:** independently correct target, deliberately wrong
  target, missing-input unverifiable, explicit zero versus omission, typed/domain
  refusal and contradicted neighbor/headline evidence.
- **Each convention:** every option plus missing/unknown declarations. Each
  contested convention with two admitted options has paired complete L1 fixtures
  holding inputs fixed and varying those options. A registered but out-of-L1
  value has an unsupported-declaration control. LTV covers all three distinct denominators and
  absence of the selected denominator, proving no fallback.
- **Timing/debt:** end/dated, annual deal versus explicit monthly lender stream,
  nominal/12, full-term after IO, loan-at-close DY, actual/constant DSCR bindings,
  year-1 after-capex CoC, above/below NOI reserves and balloon counted once.
  Missing/unknown declarations, mid/beginning, generic stubs, remaining-term,
  current-balance DY and before-capex/later-year CoC do not verify. No generated
  land schedule; preserve missing-payment-stream coverage.
- **Precision/procedure:** RFC0079 token/quantum controls, governed IRR/refusals,
  integer/fractional/negative powers and row results against accepted RFC0088.

Each complete L1 fixture MUST be cross-checked against an **independently authored
spreadsheet**, not a workbook exported by the same verifier. Record the synthetic
source identity, convention choices, cell-to-row map, workbook hash, actual
spreadsheet engine/version/platform, calculation mode and recalculation command/
time, raw/reported cell results, independent author/reviewer and exact comparisons.
Commit reproducible evidence with fixtures. Native spreadsheet IRR/POWER is not
presumed equal: procedural IRR follows RFC0024 and the accepted power contract.
Record a genuine spreadsheet-contract conflict rather than hiding it with epsilon.
Negative and unavailable-input expectations also need independent evidence.
No private deal corpus, track record, personal identifiers or producer internals belong
in this corpus. This is a plan, not a claim that a spreadsheet was executed.

## Reference implementation

Plan only, inside `@uwmd/verify` under the optional profile (RFC0083). No code,
projection package, model-generation function, AI agent or module manifest.

1. Review U1/U9 and the owner-resolved U3–U7 admission boundaries, obtain the
   independent review/evidence and final acceptance; synchronize
   Format/Protocol, class-scoped LTV dictionary entries, schemas, executable
   protocol mirror, profile/capability/target tables and conformance through
   reviewed implementation work.
2. Proposed pure export `verifyProForma`, with row/convention/coverage types,
   in verify and browser, re-exported by core. It can compute a comparison value
   but cannot produce schedules or mutate source/model/_meta.
3. Reuse `period-path.ts`, `section-resolver.ts`, `metric-verification.ts`,
   `calc/stated-precision.ts`, `calc/quantize.ts`, `cash-flow-series.ts` and
   accepted numerical primitives. Selection, calculation, comparison and source
   evidence remain observable separate stages. Do not port producer engines or
   starter defaults. Keep financial/receipt admission independently tested.
4. Prove actual CLI transport and profile cases with an independent implementation
   before advertising support. Python still needs its complete base validation,
   dictionary/stated-financial and receipt obligations; no Verifier shortcut.

## Alternatives considered

- **Projection engine, amending RFC0078 D1/D7 on the D9 pattern.** Rejected by
  the owner on 2026-10-15, superseding earlier same-day approval. It owns model
  production, competes with producer methodologies and commoditizes their
  modeling products. Identity verification preserves vendor-neutral adoption.
- **Status quo.** Existing verifiers remain valuable but unbound headline
  derivations and hidden basis changes are not covered.
- **Monthly-only, no conventions.** Rejects honestly stated annual models and
  replaces declared methodology with a preferred one.
- **Fourth `stated-only` verdict.** Unnecessary: unverifiable with a reason
  preserves the existing sizing/metric vocabulary and honest coverage.
- **Generate missing rows then compare headlines.** Replaces missing evidence
  with UWMD's model; missing rows must remain visible instead.

## Resolved owner decision

**U2 — resolved, owner decision 2026-10-17.** The pro forma profile verifies
whatever the document states and reports coverage, with no minimum L1 row set
required to claim it. Counts by verdict and row family include rows stated with
no defined identity. A thin document gets a thin coverage report, not a refusal.
This follows Format 4.24's "stated and verified, never trusted" and the #355
reframe. That ruling resolves U2 only. U1/U9 have separate draft dispositions;
U3–U7 are resolved by the 2026-10-23 ruling, and U8 separately below.

**U8 — resolved, owner direction 2026-10-18.** RFC0088 is accepted on main at
`8a646aa219620c143bb8439aa67cf010d9896a79`; section5 records the exact procedure,
public exports and CI evidence. This closes only the numerical-primitive
dependency. It did not decide U3–U7; their later resolution is section3a.
U1/U9 remain draft dispositions.

## Remaining acceptance gates and recommendation

U3–U7 are resolved by the owner on 2026-10-23 within section3a's admissions.
Their broader unadmitted variants are future identity work, not defaults for an
implementer. U2/U8 remain resolved. This RFC stays **draft**.

| Gate | Current proposal / recommendation | Required before acceptance |
|---|---|---|
| U1 — initial identity membership | PENDING owner: recommend the exact fifteen tokens in4b (fourteen financial plus membership), retaining4c's named land candidate as a separate explicit sixteenth-member choice. No generated land schedule, DSCR/cap rate or whole-registry activation. | Owner decision on the exact4b list and separate4c land membership, with independent complete-procedure/spreadsheet evidence before final RFC acceptance. Other section3a/4 procedures remain outside the list. |
| U9 — coverage/transport | PENDING owner: recommend section6a's distinct assertion keys, relationship deduplication, independent inventory, three verdicts, failure precedence, authored family counts, deterministic order and read-only CLI0/1/2 proposal. Zero rows means zero assurance; no minimum-row refusal. No new receipt field. | Review adversarial ambiguity, duplicates, missing prerequisites, unselected/source-model mismatches and misleading coverage claims; confirm the proposed gap-sensitive completed-exit1 policy versus the retained assertion-only alternative. |
| Independent red-team and procedure evidence | Complete independent closure of this clause-repair pass and independently authored composed-procedure/spreadsheet evidence before final acceptance; the initial clause review is bounded evidence already received. | Preacceptance: unchanged original witnesses, independent finding closure and spreadsheet/composed-procedure comparisons with actual engine/version/recalculation/provenance. After acceptance/before support: independent profile implementation and real read-only CLI transport evidence. Neither gate substitutes for the other. |

The independent clause review is complete on bounded arithmetic/accepted-API
and paper-contract evidence; its F1–F4 draft findings require independent closure
against this revised text. Its rational/Decimal witnesses and accepted-native
probes do not close independently authored spreadsheet or complete composed-
procedure evidence. Before final RFC acceptance: owner U1/U9 decisions, finding
closure, and the independent procedure/spreadsheet comparisons specified above.
After acceptance, implementation and independent profile/CLI transport evidence
precede any support claim; do not implement this unaccepted RFC to satisfy that
later gate. Producer expectations, builder checks and green CI cannot substitute
for independent authorship, actual spreadsheet engine/version/recalculation or
whole-procedure evidence.

RFC0085 is implemented. RFC0089 is accepted and implemented at production
`495220e7fa569659aaadcab0f06574d09a570703`; its bounded independent closure and
production integration are separate from RFC0092 financial evidence. Reuse
Envelope2.0 and canonicalization2.0/subject descriptors, preserving source/carrier
admission and separately scoped commitments. No representation compatibility
path or extra receipt/profile digest is introduced. Optional profile launch,
publication and release remain separately gated.

## Prior art

- [XBRL Calculations1.1, Recommendation with 2024 errata](https://www.xbrl.org/Specification/calculation-1.1/REC-2023-02-22+corrected-errata-2024-02-14/calculation-1.1-REC-2023-02-22+corrected-errata-2024-02-14.html)
  checks consistency of stated facts under calculation relationships, rather
  than preparing financial statements. Its interval/precision policies are not
  imported into UWMD.
- RFC0005/0007 through RFC0078 D9; Format4.24 state-and-verify;
  RFC0024's governed solver; RFC0079 and Protocol VIII.5 statement/reporting boundary.

## Future work

L2 identity sets: lease rollover, recovery caps/gross-up, floating-rate paths,
constraint sizing, further fees/prepayment/defeasance. L3: construction/takeout,
broader waterfalls, tax and depreciation. These are verification contracts, not
a projection engine. A generated per-metric/per-identity formula library is a
separate follow-up; no generator, unrelated formula page or docs-site correction
lands here.
