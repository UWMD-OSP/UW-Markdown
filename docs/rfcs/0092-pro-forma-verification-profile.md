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
Numeric questions below require decisions before implementation.

## Motivation

At main `cc5291fb6fbd8f22dfb57fc1993de8e2d8f3ee1f`, the normative
[dictionary](../../spec/metrics/builtin.json) has 171 class-scoped calculations,
89 distinct ids, and no IRR, NPV, equity-multiple, debt-service, amortization or
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
- [#356](https://github.com/UWMD-OSP/UW-Markdown/issues/356) and draft RFC 0088
  [#357](https://github.com/UWMD-OSP/UW-Markdown/pull/357) own numerical procedures.
  RFC 0089 remains draft in [#368](https://github.com/UWMD-OSP/UW-Markdown/pull/368).
- [#354](https://github.com/UWMD-OSP/UW-Markdown/issues/354) owns independent
  Python verification; its current parse-only discovery is not a profile claim.

## Proposed change

All RFC 2119 language here is proposed, subject to final acceptance and the
unresolved questions. It does not authorize production activation.

### 1. Verification boundary and claims

Reconcile the issue's current bounded direction before choosing L1 membership:
(1) bind headline assertions to exact streams, methods, periods, variants and
source subjects; (2) optionally account for a declared acquisition-ledger
universe; (3) add only individually justified normative identities. These are
assurance scopes, not new conformance tiers or numerical convention options.
The brief requests the complete candidate inventory below; U1 decides the initial
subset. U2 is resolved by the owner on 2026-10-17: the profile verifies whatever
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
one source snapshot. No new Envelope, canonicalizer or signing admission is implied.

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
Format at synchronization; do not create another value home. U1 retains the
initial identity scope decision; resolved U2 imposes no minimum document row set
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
not an invalidity verdict or permission to omit a choice. Conformance distinguishes
at least two values of every contested entry.

| Group | Convention | Exact options | Scope |
|---|---|---|---|
| Timeline | `period_basis` | `monthly` · `annual` | Monthly rows with annual roll-ups, or annual rows. |
| Timeline | `first_period` | `full` · `stub` | Stub uses declared existing day count. |
| Timeline | `cash_flow_timing` | `end` · `mid` · `beginning` | Discounting and IRR; U3. |
| Revenue | `growth_application` | `anniversary-step` · `calendar-step` · `monthly-compound` | Bound growth identity. |
| Revenue | `growth_start` | `period-1` · `year-2` | Whether year-1 input is already grown. |
| Revenue | `vacancy_base` **(contested)** | `gross-potential-rent` · `gross-potential-revenue` | Latter includes other income. |
| Revenue | `credit_loss_base` | `gross-potential-rent` · `gross-potential-revenue` | Period loss input. |
| Revenue | `occupancy_method` | `percent-of-base` · `stated-occupancy-path` | Explicit rate/base or authored path. |
| Expenses | `line_class` | `fixed` · `per-unit` · `per-occupied-unit` · `per-sf` · `percent-of-egi` | Per expense line. |
| Expenses | `management_fee_base` | `egi` · `egi-excluding-reimbursements` | Bound management line. |
| NOI / NCF | `reserves_placement` **(contested)** | `below-noi` · `above-noi` | NCF ambiguity U5. |
| Debt | `payment_frequency` | `monthly` · `annual` | Per loan, amortization basis. |
| Debt | `interest_accrual` | `30/360us` · `actual/360` · `actual/365f` | Exact VIII.9.1 procedures. |
| Debt | `amortization_after_io` **(contested)** | `full-term` · `remaining-term` | Per loan; count arithmetic U4. |
| Debt | `dscr_basis` **(contested)** | `noi` · `ncf` | Per loan. |
| Debt | `dscr_debt_service` **(contested)** | `actual` · `amortizing-constant` | IO cash service versus amortizing-payment basis throughout. |
| Debt | `debt_yield_basis` | (`noi` · `ncf`) × (`loan-at-close` · `balance-at-period`) | Both axes required; balance timing U4. |
| Debt | `ltv_basis` **(contested)** | `purchase-price` · `underwritten-value` · `total-project-cost` | **Owner addition, 2026-10-17; direct per-loan field.** |
| Exit | `exit_noi_basis` | `forward-12` · `trailing-12` | Year N+1/next twelve months versus year N/final twelve. |
| Exit | `exit_noi_measure` | `noi` · `ncf` | Measure bound to existing `exit_noi` target. |
| Exit | `disposition_cost_base` | `gross-sale-price` | One admitted value. |
| Returns | `irr_frequency` **(contested)** | `annual-periodic` · `monthly-compounded` · `xirr` | Annualize monthly m as `(1+m)^12-1`, never simple `m*12`. |
| Returns | `cash_on_cash_numerator` | `before-capex` · `after-capex` | Components/equity denominator U6. |

Exactly the approved refined registry's 22 conventions/options plus `ltv_basis`.
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

### 4. L1 identities and numerical admission

L1 lists candidate stabilized-acquisition identities, initially fixed-rate debt.
U1 must select the initial bounded return/method subset and any optional ledger
scope; this is not universal period-by-period reproduction. L2/L3 remain future sets. Unknown/custom/vendor rows are retained and counted
unverifiable (`identity_not_defined`), never omitted or silently passed.

Notation: `t` is an explicit period, `j` a line, `q` a payment. Revenue/expense
magnitudes below must be explicitly bound as such; investor cash is signed.
Do not reinterpret an existing signed cash row by its label. Sums follow declared
source/line order left to right, and dependencies are explicit. No hidden iteration
solves a circularity. Algebra alone is not a binary64 reassociation license.

Precision: `M` = `$`, reporting r2; `R` = `%`, reporting r6; `X` = `x`, reporting
r4, per VIII.5. These are reporting quanta, not new comparison tolerances.
Dictionary-bound DSCR/debt-yield/LTV/CoC reuse that class entry's actual minima
and ceilings. Apply RFC 0079/VIII.5.1 once to the unrounded result at
`d = min(max(source_decimals,m),r)`, half away from zero, retaining numeric tokens,
trailing zeroes and exponents. No double rounding or relative epsilon.
New identities require accepted comparison minima m (U7), not guessed floors.
Existing dated-series comparisons retain VIII.9.4's full reporting quantum when
that verifier is reused.

| Identity | Inputs / convention dependencies | Formal check, unit/precision and authority/gate |
|---|---|---|
| Growth | Prior line A, stated g, explicit application count; growth/start and timeline | Single step `A_t = A_previous*(1+g)`; general `A_t = A_base*P(1+g,k)`; monthly increment `P(1+g,1/12)-1`. M/R; algebra, timing U3 and primitive U8. Never author missing intervening rows. |
| Vacancy, credit loss, EGI | GPR, other income, loss amounts/rates; selected vacancy/credit bases, occupancy | `GPRV = GPR+other_income`; `loss = rate*selected_base`; `EGI = GPRV-vacancy-credit_loss-concessions-loss_to_lease`. M; additive identity. Each deduction needs explicit binding/zero and no-double-count evidence. Occupancy-to-loss conversion U3. |
| Expenses | Stated amount/rate and units/occupied units/SF, EGI/reimbursements; line class and fee base | Fixed reads authored amount; quantity line `expense = rate*quantity`; percentage `expense = rate*selected_EGI`; sum exact bound lines. M; algebra, scaling/growth U3. No fixed-label default amount. |
| NOI | EGI, opex excluding reserves, reserve allocation; placement | `NOI = EGI-opex_excluding_reserves-R_above`, with explicit above-NOI allocation. M; additive identity, U5. |
| NCF | NOI, reserves, TI, LC, capex | Registry's literal rule is `NCF = NOI-reserves-TI-LC-capex`; above-NOI reserves may already have been deducted. **U5 blocks that combination**; no silent alternate formula. M. |
| Debt service | Loan/payment rates, amortization count, dates, IO state, opening principal; frequency/accrual/after-IO | IO `payment_q = interest_q`; amortizing payment uses `pmt(i_q,n_q,B_open)` (VIII.3). `DS_t = sum(payment_q)`; summary binds actual schedule. M; exact rate/count/unsigned-sign association U4. |
| Interest/principal | Opening balance, annual rate, payment dates; accrual | Candidate `I_q = B_open*rate*yearfrac(d_previous,d_q,interest_accrual)`; `principal_q = payment_q-I_q`. M; VIII.9.1 pins yearfrac, but payment interaction/association U4. |
| Balance/balloon | Opening/closing balance, draws, principal, payoff date | `B_close = B_open+draws-principal`; next opening equals prior close. Balloon binds designated outstanding balance, counted once, not again as scheduled principal. M; algebra, boundary U4. |
| DSCR | NOI/NCF; actual service/amortizing constant; both DSCR choices | `DSCR_t = selected_income_t/selected_service_t`. X, existing dictionary precision; alternate income/constant semantics U4/U5. No silently substituted amortizing payment during IO. |
| Debt yield | NOI/NCF; original loan/period balance; both basis axes | `DY_t = selected_income_t/selected_balance_t`. R, current dictionary precision; balance timing U4. |
| LTV | Selected loan and declared denominator | The three identities above. R, current LTV precision; missing basis refuses. |
| Exit value/costs | Selected forward/trailing NOI/NCF, cap, gross sale, cost rate | `gross_sale = selected_income/cap`; `sale_cost = gross_sale*cost_rate`; `net_sale = gross_sale-sale_cost`. M; algebra. Forward input must be authored beyond the hold. No unapproved stated-price convention is introduced. |
| Equity sale proceeds | Net sale, stated outstanding debt payoff | `net_proceeds_to_equity = net_sale-debt_payoff` under Format4.9/RFC0077's aggregate-equity/junior-debt boundary. Common-only proceeds keep separate fields. M; payoff timing U4. |
| Unlevered/levered flows | Stated signed property cash, debt draws and positive interest/principal/fee magnitudes | `U_t = sum(bound property cash amounts)`; `E_t = U_t+debt_draws_t-interest_t-principal_t-financing_costs_t`. M; algebra with each acquisition/exit component once. Financing costs at t0 enter equity. Retain VIII.9.6 reserve/cash exclusions and explicit coverage; NCF is not automatically complete owner cash. |
| IRR | Signed flows, exact timing/dates, frequency, existing series day count | Annual `irr(CF0,...,CFn)` via VIII.3/RFC0024; monthly `m=irr(monthly_flows)`, annual report `P(1+m,12)-1`; dated VIII.9.3 `xirr`. R; unchanged solver/refusals, timing U3, primitive U8. No Newton polish/new tolerance. |
| Equity multiple | Separate distributions D_t and contribution magnitudes C_t | `EM = sum(D_t)/sum(C_t)`. X; approved fixed rule/VIII.9 precedent. Do not net a same-period contribution/distribution or infer gross flows from a net row. Retain reused verifier's domain/refusal contract. |
| CoC by year | Stated selected numerator components, explicit equity binding; numerator option | `CoC_t = selected_cash_numerator_t/stated_equity_denominator_t`. R, existing CoC precision; numerator bridge and annual denominator U6. No inferred cumulative-equity policy. |
| NPV | CF0, later signed flows, discount rate, explicit timing exponents | `NPV = CF0+sum(t>0,CF_t/P(1+r,tau_t))`. M; CF0 undiscounted, unlike spreadsheet NPV's first supplied argument. End/full integer timing reuses VIII.3; other mappings U3/U8. |

A supplied assumption or fixed line with no independent identity remains an
input-only, unverifiable row. Reading/copying it cannot earn a verified count;
a growth or build-up identity can verify its stated consequence.

`P` means the exact power procedure finally accepted through RFC0088, not a
convenient host pow. New composed identities need governed operation order,
domains/refusals and independent evidence before acceptance.

### 5. Determinism dependency

[#356](https://github.com/UWMD-OSP/UW-Markdown/issues/356) proposed integer powers
as `d0=1; dt=dt-1*(1+r)` and reciprocals for negatives. The older profile brief
carried this running-product proposal. The owner's later 2026-10-17 RFC0088
direction selects A: one exact pinned fdlibm pow/exp/log procedure for **all**
exponent classes, including negative powers, with financial associations,
quantizer and solvers unchanged. Those procedures are not binary64 substitutes.

**Final accepted RFC0088 is an explicit dependency (U8).** The issue's
running-product proposal is not assumed adopted. This RFC does not reopen A,
accept RFC0088 or introduce a competing profile integer-power routine.
Monthly compounding, annualization and integer/fractional discounting all require
the one accepted procedure and composed evidence. Log1p/expm1 rearrangements are
not authorized here. Retain accepted solver endpoint/iteration/refusal behavior;
no silent correction of IRR edge cases.

### 6. Verdicts, coverage, receipts

Reuse `verified` / `failed` / `unverifiable` from Format4.24 and metric verification.
Finite comparable disagreement fails; missing usable input, unavailable accepted
procedure or undefined identity is unverifiable. Structural/selection/arithmetic
refusals retain their typed evidence; profile code allocation/ordering is U9.
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
no numeric cell exists; U1 still determines that optional universe. These are not
a mandatory L1 row inventory or a basis to refuse a thin document. Report gaps
and exclusions separately; do not manufacture values or inflate the denominator
with operations. Empty claim sets establish no assurance and report zero
assertions, without a minimum-row refusal. The denominator is the declared
applicable assertion universe, not a document-wide percentage or a guarantee
about undisclosed facts. U1/U9 must freeze its enumeration, duplicate handling
and final counting rules within the owner's resolved U2 rule.

Local arithmetic agreement is not a clean financial-verification claim when a
required prerequisite failed or is unverifiable. Retain local relationship
findings separately and block terminal verified status through such dependencies.
U9 must state the exact final precedence rather than borrowing an aggregate
success rule or silently hiding demonstrated disagreement behind missing inputs.

**Receipt disposition:** coverage is a separate verification result, not a new
field in existing receipts. [RFC0016](0016-verification-receipts.md) and
[Receipt](../../spec/UW_RECEIPT.md)4/5.1/5.5 retain pack-output, subject, policy,
signature and verdict contracts. A verified financial receipt does not assert
every pro forma identity passed. Validation findings gain no new issuance veto.
An authenticated coverage report needs a separately governed subject/result
contract; no such wire structure is invented here. RFC0088/0089 keep their
separate receipt/subject ownership.

## Launch scope

The profile is optional and ships with everything else at the approved 5.0.0
public launch. Before launch it may land on main in 4.x. No surface/release
version is allocated, and no tag or publication authorized. The profile's initial
accepted scope is U1; comprehensive underwriting generation is not a launch
requirement.

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
  contested convention has a paired complete L1 fixture holding inputs fixed and
  varying at least two values. LTV covers all three distinct denominators and
  absence of the selected denominator, proving no fallback.
- **Timing/debt:** annual/monthly, full/stub, IO transition, both after-IO choices,
  actual/constant DSCR, day-count edges, maturity payoff and balloon counted once,
  after U3/U4 are resolved.
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
No Golden Deals, track record, personal identifiers or producer internals belong
in this corpus. This is a plan, not a claim that a spreadsheet was executed.

## Reference implementation

Plan only, inside `@uwmd/verify` under the optional profile (RFC0083). No code,
projection package, model-generation function, AI agent or module manifest.

1. Resolve the remaining U1/U3–U9 gates and final acceptance; synchronize
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
reframe. Only U2 is resolved by this decision; all other U items remain open.

## Unresolved questions

These are acceptance gates, not choices for an implementer to guess. Reference
code or spreadsheet practice alone does not decide a new financial convention.

| ID | Kind | Required decision/evidence |
|---|---|---|
| U1 | Scope | Reconcile the requested broad L1 candidate inventory with the current bounded-assurance direction: select initial return/method bindings, the optional ledger universe and individually justified additional identities, with exact income/cash/equity boundaries. No universal row expansion is accepted. |
| U3 | **Numeric** | Pin calendar/anniversary anchors, stub proration/quantity-rate scaling, occupancy-to-loss arithmetic and discount exponents. `beginning`/`mid` with CF0 fixed at t0 cannot silently use integer-spaced `irr`: decide admitted combinations or govern the timed identity without changing the solver implicitly. |
| U4 | **Numeric** | Pin nominal annual-to-payment rate, full/remaining amortization counts, IO boundary, payment/accrual interaction and unsigned PMT semantics; pre/post-payment balances for debt yield, balloon and exit. Current stabilized stack service/starter code is not a normative periodic schedule. |
| U5 | **Numeric** | Reconcile above-NOI reserves with literal `NCF=NOI-reserves-TI/LC-capex`: subtract only reserves not already deducted, or intentionally define another measure? Also bind accrual versus owner cash under VIII.9.6/11. Do not choose or double count silently. |
| U6 | **Numeric** | Pin before/after-capex CoC components and equity denominator across periods/later contributions. Existing Y1 fallback or cumulative-equity field does not define every year. No new registry option without approval. |
| U7 | **Numeric** | Allocate new-identity comparison minima and freeze composed binary64 association/domain/refusal tables. Existing dictionary and reused series contracts stay authoritative; no guessed floor or blanket epsilon. |
| U8 | **Numeric dependency** | Final accepted RFC0088 and composed evidence. A/all exponent classes is selected direction; the historical #356 running product is not accepted arithmetic. Use one accepted primitive contract. No repeated A/B decision requested. |
| U9 | Coverage/engineering | Freeze stable assertion identity/universe, applicability, exclusions/gaps, duplicate and dependency precedence, counts by verdict/row family, then necessary typed refusal/CLI/exit/schema details. Three verdicts are selected; no generic META/CS/RCP expansion. |

The launch question is closed: this optional profile ships at 5.0.0 with
everything else. RFC0085 provenance and RFC0089 subject work remain separately
owned and are not accepted by this draft.

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
