# Assemble explicitly covered property cash flows

RFC 0045 is implemented in source with Protocol **2.12.0**. Published core/CLI
**2.8.0** still expose Protocol **2.11.0**; use a repository build for this
workflow until the next package release.

The assembler combines verified stated lease-up cash with a supplemental dated
ledger. The result covers one property, one explicitly declared currency,
unlevered and pre-tax. It copies cash amounts and keeps every row's source
identity. It does not forecast leases, calculate an exit price, or infer expenses.

## Run the synthetic example

All inputs below are **synthetic engineering data**. They describe no actual
property or investment; the owner selected synthetic fixtures for implementation
and will validate a real deal separately. They demonstrate cash coverage and
refusal behavior, not an underwriting recommendation.

From a repository checkout:

```sh
npm run build
npm run cli -- assemble-property docs/examples/property-cash-flow-synthetic.uwx.md docs/examples/property-cash-flow-plan.json --json
node scripts/verify-property-cash-flow-workflow.mjs
```

The `assemble-property` command emits a candidate JSON payload and does not edit either input.
The workflow script additionally invokes the existing dated metric engine at an
explicit discount-rate input of `0.08`. Neither operation writes to the deal.
The `.uwx.md` example uses Format 2.0 nested metadata; its provenance labels the
inputs as synthetic.

The complete candidate contains 12 copied cash rows and 20 coverage cells.
Each period's three lease-up cells intentionally share one bundled row. Four
other cells have explicit zero explanations; those declarations insert no rows.
A separately stated numeric zero remains an ordinary source row.

## Declare coverage and the economic boundary

The plan states acquisition and disposition dates, day count, currency and exact
source variants. Each supplemental row belongs to exactly one `(slot, category)`
cell. Each required cell has rows or an explicit zero explanation. There is no
default source, zero amount, month-end date or currency inferred from `$`.

Lease-up owns rent, concessions and TI/LC together. Other income excludes rent;
operating expenses are cash payments; nonleasing capital excludes TI/LC.
Acquisition and disposition have separate purchase/gross-sale, transaction-cost
and reserve cells. Gross sale excludes debt payoff and separately returned cash
reserves. Debt and investor tax cash flows are outside this first scope.

Reserve funding is an owner cash outflow and release is an inflow. Work paid
inside a funded reserve is excluded from all other selected cash rows. The plan
requires explicit assertions about that exclusion and no restricted reserve
remaining after sale. If the source lease-up bundle also includes reserve-funded
TI/LC, this adapter refuses the asserted unsupported case; it cannot split or
repair the bundle. It cannot discover a false assertion hidden inside otherwise
valid numbers.

The first purchase payment anchors the series on `2026-07-01`. All cash must
settle by the declared disposition on `2026-12-31`; no post-sale settlement or
partial-window rule is implied. Every date is supplied, never inferred from a
holding-year row number.

## Read the result without losing its meaning

Keep the entire result wrapper: `plan`, `coverage`, `cells`, `bindings`,
`source_verification`, `source_envelope_digest` and `series`.
`coverage: "declared_complete"` means the required declarations are present and
structurally consistent. It does not prove the author included every real payment.
The bare generic series does not carry the wrapper's currency or financial basis.

`bindings` preserve each source path, variant, date and amount. Same-date rows
remain separate, ordered by lease-up source order then supplemental index.
Consequently, a generic date selector still refuses an ambiguous date. Coverage
cell evidence uses output indexes so repeated dates do not destroy identity.

The source digest covers the existing complete semantic envelope, including its
history. It is not a signature, a plan digest or an economic-completeness receipt.
Source and plan snapshots remain consistent while hashing runs asynchronously.

## Existing metric results

The workflow script generated the following values from the existing engine;
they are regression expectations for these synthetic inputs only:

| Metric | Value | Interpretation |
|---|---|---|
| XNPV at `0.08` | 197078.23 | Net present value at acquisition, including the purchase outflow. |
| XIRR | 0.54739 | Annualized fractional return of this synthetic unlevered, pre-tax stream. |

The engine uses the plan's `actual/365f` day count and its existing quantization
(currency two decimals, rate six decimals). XNPV here is an investment NPV, not
an appraisal value. The assembly API emits no `stated_metrics`; callers request
metrics explicitly. Existing IRR convergence and bracket refusals are unchanged.

## Refusals and further scope

`PropertyCashFlowAssemblyError.proto` carries `CALC-CF-ASSEMBLY`, a stage reason,
pointer and any original nested source evidence. CLI `--json` emits `{ "error":
... }` and exits nonzero; text mode reports the code and pointer. Unknown flags,
including write and calculation-override flags, are refused.

Missing coverage, duplicate source rows, bad signs/dates, mismatched currency,
false required assertions and failed/unverifiable source checks refuse assembly.
Unknown or nonfinite cash is never replaced by zero. Supplemental structure is
checked before whole-document hashing, so malformed amounts retain typed errors.

Levered/after-tax assembly, FX, reserve rollforwards, post-sale settlements,
speculative leasing, terminal valuation, persistence of the evidence wrapper and
Excel cash-flow metric formulas require separate contracts.
See [RFC 0045](rfcs/0045-explicit-property-cash-flow-assembly.md) for the complete
wire contract and [RFC 0044 workflow](LEASE_UP_CASH_FLOW_WORKFLOW.md) for the
partial projection this assembler consumes.
