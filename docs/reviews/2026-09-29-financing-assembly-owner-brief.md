# Priority-1 financing assembly: owner design brief

Date: 2026-09-29. **Design only; no normative behavior is authorized here.**

## Demonstrated need and current surfaces

The [completed Golden Deal review](2026-09-24-completed-golden-corpus-validation.md)
observed source-defined bridge/takeout financing, issuance fees, paydown and
payoff. UWMD can verify a *stated* dated pre-tax equity series today, but it
cannot deterministically generate that series from loan terms. Those source
roles demonstrate a consumer, not one universal debt model.

| Existing surface | Reusable fact | Limit for dated levered assembly |
|---|---|---|
| Format §4.7 `debt_structure` | One loan's amount, rate type/rate, term, IO months, amortization years, origination/exit fee percentages, prepayment type and annual/monthly service figures. | No funding date, dated payment schedule, day-count or compounding convention, amortization start rule, accrued-interest settlement or payoff event identity. Annual/monthly service is a stated/sizing figure, not a dated payment ledger. |
| Format §4.24 `capital_stack` / RFC 0033 | Typed tranche ID, amount, rate, IO/amortization/term months and point-in-time coverage; `trancheAnnualDebtService` is deterministic. | It is explicitly one capitalization point. A bridge and its takeout must not be stated as concurrent tranches. Its annualized service formula cannot establish dated cash. |
| Format §4.8 `sources_uses` | Closing senior loan source, loan-origination use, other closing uses and escrows. | Closing budget buckets are not disbursement/payoff schedules; a fee percentage is not itself a dated cash amount. |
| Format §4.26 `cash_flow_series` | Dated, signed, separately preserved rows and deterministic metric verification with declared day count. | It can state pretax levered cash but has no debt-term-to-row generator or row classification that proves each loan event. Its metric day count does not select debt-interest accrual. |
| Debt sizing and coverage | NOI/loan and tranche annual debt-service metrics already compute deterministically. | DSCR and debt-yield are point or annual measures; they do not amortize a balance or allocate principal and interest to dates. |
| RFC 0056 hedges and escrows | Typed cap and funding declarations; unsupported swaps/collars refused. | No cap payoff projection or escrow roll-forward. Lender-held reserves cannot be treated as owner property reserve accounts. |
| RFC 0045 property assembly | Digested, auditable unlevered/pre-tax dated property series with source bindings, coverage and explicit refusals. | Requires `no_financing_or_investor_tax`; cannot append debt service, proceeds, fees or payoff without a new contract. |
| Calendar/day-count machinery | Real ISO date parsing, actual-day differences and §4.26 XIRR/XNPV conventions. | Those primitives can check dates and metrics but do not pick interest day count, payment frequency, business-day adjustment or rounding for a loan. |

There is a genuine protocol gap. Reusing `cash_flow_series` as the **output
carrier** and RFC 0045-style source digests/bindings is plausible, but no
existing verifier or plan can turn the current debt terms into a complete,
dated pre-tax levered stream without adding conventions.

## Small first scope to evaluate

Candidate only: one fully funded, fixed-rate, current-pay senior tranche,
with stated acquisition funding, a finite IO period, a stated amortization
schedule and one dated payoff, over a verified RFC 0045 property series. A
read-only assembler could emit separate rows for loan proceeds, interest,
scheduled principal, fees and payoff, then combine them with the property
rows in date/source order. It would preserve every source row and expose a
binding for every generated amount. It would refuse bridge/takeout refinance,
floating/hedged terms, multi-tranche debt and lender escrows in this first
scope unless separately pinned. The demonstrated Golden Deal may therefore
remain outside the first scope; reducing scope is an engineering candidate,
not a claim of parity or an owner-approved product boundary.

## Semantics that need a contract

| Question | Current evidence | Decision before implementation |
|---|---|---|
| Funding date and original principal | `loan_amount` and sources/uses senior amount exist. | Which dated event funds principal; whether commitments, draws and net proceeds differ. |
| Interest rate and accrual | `interest_rate` and `rate_type` exist; rates are fractions. | Fixed rate applicability, accrual day count (Actual/360, Actual/365, 30/360, etc.), inclusivity of funding/payoff days, compounding and interim rounding. §4.26's metric day count is not a loan accrual rule. |
| Payment frequency and calendar | Monthly service and IO months appear as stated figures. | Exact due-date schedule, month-end behavior, weekends/holidays, stub periods and same-day ordering under RFC 0062. |
| IO and amortization | `io_period_months`, `amortization_years`; tranche `io_months`, `amortization_months`, `term_months`. | When IO begins/ends, amortization start date, fixed-payment vs fixed-principal method, recalculation after a stub/paydown, precision and final balloon. |
| Scheduled principal, maturity and payoff | `loan_term_years`, `balloon_year`, estimated balloon and prepayment type. | Whether maturity follows calendar or payment count, exact payoff date, unscheduled paydown ordering, balloon identity and partial prepayment policy. |
| Fees and refinancing | Origination and exit fee percentages, closing-cost buckets; Golden Deal review saw fees and bridge/takeout. | Fee base, payable date, cash vs financed treatment, prepayment/exit charge rules, refinance proceeds and retirement of prior debt. A percentage alone is insufficient cash evidence. |
| Accrued interest at exit | No complete field. | Whether payoff includes current-period accrued interest, whether it is a separate row, and how to avoid counting a scheduled coupon again. |
| Row identity and equity cash | §4.26 dates/signed rows and RFC 0045 source bindings. | Closed event categories, source path/digest, duplicate detection, gross proceeds vs net disbursement, ordering and date boundaries under RFC 0063. |
| Reserves/escrows | RFC 0056 funding declarations and draft RFC 0064 property custody. | Lender-held balances, draws, release and payoff application need their own financing boundary; do not silently reuse property `reserve_accounts`. |

The owner should choose one explicit convention for each applicable row above
before any formula or conformance expected value is written. A first RFC can
refuse unsupported combinations and preserve absent behavior; it must not
infer rates, dates, payments or zeros from labels or a lender type. Funding,
fees, principal, interest and payoff must be separate economic identities so
that net equity cash is reproducible without double-counting. The unlevered
property series remains immutable; AI may transcribe terms but performs no
financial math.

## Owner decision and next step

Confirm whether a one-fixed-rate-senior-tranche first scope is useful despite
excluding the demonstrated bridge/takeout case, and supply the exact date,
interest, payment, amortization, fee and payoff conventions for that scope.
Then draft a separate financing-assembly RFC with synthetic dated conformance
and explicit RFC 0045/0062/0063 and lender-reserve interactions. Do not fold
it into RFC 0064 or draft RFC 0065, and do not claim Golden Deal generation
parity from the existing 640 stated-source comparisons.
