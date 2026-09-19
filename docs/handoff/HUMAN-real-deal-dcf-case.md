# HUMAN: supply one real deal for the RFC 0045 DCF validation

**Why you, why now.** Roadmap Priority 1 is "Real-deal DCF validation and
extensions," and its definition of done is to "validate explicit coverage and
economic assertions against a real deal." The repository contains **no real
deal that can run the workflow**, and an agent cannot manufacture one: inventing
economics to complete the exercise would prove the standard against fiction and
is the one thing this task must not do.

This is not a request to "send a deal." Below is the exact minimum fact set,
mapped to the surfaces that consume each fact.

## What is *not* blocking

The tooling works. Verified on `main` before writing this:

- `uwmd inspect-property-cash-flows` (RFC 0047) returns the input inventory and
  the exact `required_coverage_cells` list for a document.
- `uwmd assemble-property` (RFC 0045) runs end to end and emits a 12-row
  `Unlevered pre-tax property cash flow` series with
  `source_verification.lease_up: "verified"`.
- `uwmd project-lease-up` (RFC 0044) and `uwmd verify-cash-flows` (RFC 0034) are
  both exposed.

The blocker is the input, not the implementation.

## Why no existing case qualifies

| Candidate | Why it cannot be used |
|---|---|
| All 13 `examples/*.uwx.md` | **None carries `cash_flow_series` or `lease_up_schedule`.** Neither assembly input exists in any shipped example, so none can run the workflow at all. |
| `docs/examples/property-cash-flow-synthetic.uwx.md` | The only runnable document. Its own body reads: *"Engineering test inputs only. No actual property, transaction or underwriting recommendation. The owner requested synthetic fixtures before real-deal review."* 10 rows, 2 quarters, a $1M round-number ledger. |
| `conformance/property-cash-flow-assembly/*` (26 fixtures) | Refusal and edge-case probes — duplicate rows, currency mismatch, off-by-a-cent proceeds. They prove the refusals fire; they are not underwriting. |
| `examples/standalone/**/cash-flow-series-dated.uwpart.md` | 32-line fragments. |

## The minimum fact set

One property, one currency, held to a stated disposition. Everything below is
**stated economics** — UWMD will not infer any of it.

### 1. Deal frame

| Fact | Consumed by |
|---|---|
| Asset class, property size (units / SF / keys) | Pack selection, size intensives |
| Currency (single; no FX) | `plan.currency_code`, must match sources |
| Acquisition date, disposition date (ISO) | `plan.acquisition_date` / `disposition_date` |
| Day-count convention (e.g. `actual/365f`) | `plan.day_count` — must be explicit |
| Period grain and labels (`2026-Q3`…, or monthly) | `lease_up_schedule` periods, RFC 0041 addressing |

### 2. Acquisition

Purchase price; acquisition transaction costs; any reserve funded at close.
These map to the three required acquisition coverage cells:
`purchase_price`, `transaction_costs`, `reserve_net`.

### 3. Per-period operations — one row per period, for every period

The assembly demands a coverage decision for each of these, **per period**, and
refuses if any is unaccounted for. An intentional zero must be stated as a zero,
not omitted:

- `other_income`
- `operating_expenses`
- `other_capex` (nonleasing)
- `reserve_net`

Plus, from the lease-up schedule: rent, concessions, and TI/LC per period.

### 4. Disposition

Gross sale price; disposition transaction costs; reserve release at exit.
Required cells: `gross_sale`, `transaction_costs`, `reserve_net`.

**Optional but valuable (RFC 0052):** the named sale deductions
(`commission`, `transfer_tax`, `title_escrow`, `legal`, `prorations`,
`other` with a label) and a stated `net_sale_proceeds` to verify against. If you
supply these, name *all* of them — partial naming is refused by design.

### 5. Supporting assumptions

Exit cap rate and the NOI it was applied to; hold period; tax assumptions
(including any abatement or reassessment schedule, RFC 0053); recoveries and CAM
treatment (RFC 0058); lease clauses and TI/LC balances (RFC 0055); renovation
budget and draws (RFC 0057). These inform the document even where the unlevered
assembly does not read them.

### 6. Financing — supply it, but know where it lands

Loan amount, rate, amortization, IO, term, and the full capital stack.

**The RFC 0045 assembly will not consume these.** It refuses any plan whose
`basis` is not `unlevered` and `tax_basis` not `pre_tax`; debt draws, principal,
interest and financing fees are excluded by explicit assertion. Financing is
still worth supplying because it exercises `capital_stack` sizing verification
and lets us state a *separate* levered `cash_flow_series` — §4.26 admits
`debt_service` and `refinance` row kinds and verifies `total_net` / `moic` /
`xnpv` / `xirr` over them. What does not exist is an **assembler** that builds
that levered series for you.

### 7. The trusted comparison — the most valuable single item

**Your model's own outputs**, so the exercise can reconcile rather than merely
run: unlevered cash flow by period, unlevered IRR and equity multiple, and — if
you want the levered surface exercised — levered cash flow, levered IRR, and
equity multiple. Without these, phase four (numerical reconciliation) has
nothing to compare against and the validation is only a representability test.

## Recommended source shape

In descending order of usefulness:

1. **A StackUW `export_uwmd` `.uwx.md`** — the highest-value form, because it
   also validates the adopter's own producer path.
2. **The underwriting model extract** — the period-grid cash flow with a row per
   line item, plus the assumption sheet.
3. **A structured assumption sheet** covering §§1–7 above.

Anonymized is fine. Rounded is fine if the rounding is stated. What cannot be
substituted is that the economics be **real** — the point of the exercise is to
find what a real deal needs that synthetic fixtures never asked for.

## What happens next

With the case in hand the agent runs phases three through five: classify every
economic assertion (supported / tooling gap / format gap / out of scope /
missing input), reconcile against your model line by line with a stated cause
for each delta, and dispose of each gap as bug, tooling, documentation, bounded
RFC, or demand-gated. No normative change begins without your approval.

## Explicitly not needed

Do not assemble any of these for this exercise; each is a closed or deferred
boundary and supplying them will not unblock anything: multi-currency or FX,
per-lease monthly ledgers, GP-side waterfall hurdles, tax-credit or PACE
mechanics, ground-lease structure, or soft-debt contingent terms.
