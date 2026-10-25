# 05 — Calc packs

A **calc pack** is a `ModuleManifest` that bundles a set of derived-metric
declarations for an asset class. Their normative source is now the
[metric dictionary](../../spec/metrics/README.md) (RFC 0078 Phase 2, extended by RFC 0080): 173
class-scoped calculations across twelve builtin packs, plus the primary-size
registry. Packs derive their definitions from that contract as TypeScript
mirrors, enforced by exact, bidirectional tests rather than runtime generation.
Every consumer (web editor, Excel converter, CLI, conformance, refinement)
continues to use the same pack objects and Excel bindings.

> **Standard or starter product?** The **dictionary** is the standard: a
> Verifier must reproduce each entry's quantized value, by any method, and
> adding or changing an entry needs an RFC. The **packs** are starter-product
> code ([RFC 0078](../rfcs/0078-protocol-is-verification.md)): the reference
> engine's TypeScript mirror of the dictionary, plus the Excel layouts, which
> no other implementation owes. Excel parity is a starter-product quality bar
> ([invariant 4](10-conventions-invariants.md)); dictionary parity is what
> keeps every consumer on the normative definitions. All twelve official
> classes are full builtins on both layers
> ([RFC 0080](../rfcs/0080-official-classes-are-builtins.md)); modules are for
> third-party classes and metrics.

- **Location:** the twelve manifests and the registry are in
  [`packages/uwmd-verify/src/builtin-packs/`](../../packages/uwmd-verify/src/builtin-packs/)
  (standard side, RFC 0083: receipts and builtin-class validation read them);
  [`packages/uwmd-core/src/packs/`](../../packages/uwmd-core/src/packs/) re-exports them beside the Excel emitter.
- **Public API (via `index.ts`):** `MULTIFAMILY_PACK`, `OFFICE_PACK`,
  `RETAIL_PACK`, `INDUSTRIAL_PACK`, `SELF_STORAGE_PACK`, `HOSPITALITY_PACK`,
  `SENIOR_HOUSING_PACK`, `STUDENT_HOUSING_PACK`, `LAND_PACK`,
  `DATA_CENTER_PACK`, `MANUFACTURED_HOUSING_PACK`, `MIXED_USE_PACK`,
  `getPackForAssetClass`,
  `emitFromAst`, `emitExcelFormula`, `ExcelEmitError`, type `ExcelEmitOptions`.

## Stated precision and output precision (RFC 0079)

A dictionary entry's `minimum_stated_decimals` is a comparison floor.
`getStatedDecimals` reads a **source numeric token**, preserving trailing zeroes
and exponents. `compareStatedMetric` takes the **unrounded** expression result,
the stated number, its source decimals and the dictionary entry. It compares
at `min(max(stated_decimals, minimum_stated_decimals), round_to)` with the shared
half-away quantizer and never double rounds. Coarse statements compare at the
minimum: `0.07` can equal 7.0%, LTC `0.6` can verify raw `0.601852`, and DSCR
`1.5` versus `1.7` fails. Absent/invalid precision arguments are typed caller
errors; unverifiable remains for absent usable formula inputs. It imports no packs,
defaults or cascade. Callers must preserve precision before numeric parsing;
`String(parsedNumber)` cannot recover it.

Calc/Excel reporting and receipt result digests still use full `round_to`.
Receipts compare those quantized outputs exactly, with no old relative tolerance.
The [lender fixture](../../conformance/metrics/README.md) reports all examples,
including failures and absent-input findings without hiding coarse statements.

## File layout

File | Role
---|---
`builtin-packs/multifamily.ts` | `MULTIFAMILY_PACK` — the canonical multifamily metrics
`builtin-packs/office.ts` | `OFFICE_PACK` — the canonical office metrics
`builtin-packs/retail.ts` | `RETAIL_PACK` — the canonical retail metrics
`builtin-packs/industrial.ts` | `INDUSTRIAL_PACK` — the canonical industrial metrics
`builtin-packs/self-storage.ts` | `SELF_STORAGE_PACK` — the canonical self-storage metrics
`builtin-packs/hospitality.ts` | `HOSPITALITY_PACK` — the canonical hospitality metrics
`builtin-packs/senior-housing.ts` | `SENIOR_HOUSING_PACK` — the canonical senior-housing metrics
`builtin-packs/student-housing.ts` | `STUDENT_HOUSING_PACK` — the canonical student-housing metrics
`builtin-packs/data-center.ts` | `DATA_CENTER_PACK` — twenty-one data-center metrics
`builtin-packs/manufactured-housing.ts` | `MANUFACTURED_HOUSING_PACK` — thirteen manufactured-housing metrics
`builtin-packs/land.ts` | `LAND_PACK` — the canonical land metrics (no cap rate by design)
`builtin-packs/mixed-use.ts` | `MIXED_USE_PACK` — property metrics and component calculations
`builtin-packs/metric-dictionary.test.ts` | Every pack declaration and size row equals its normative dictionary entry, in both directions
`packs/excel-emit.ts` | Translate the same calc AST → Excel formula string
`builtin-packs/index.ts` | The `getPackForAssetClass` registry
`packs/index.ts` | Re-exports the builtin packs and the registry beside the Excel emitter
`packs/packs.test.ts` | Multifamily pack integrity + Excel↔evaluator parity (exact)
`packs/office.test.ts` (core) | Office pack integrity + Excel↔evaluator parity (exact)
`packs/retail.test.ts` (core) | Retail pack integrity + Excel↔evaluator parity (exact)
`packs/industrial.test.ts` (core) | Industrial pack integrity + Excel↔evaluator parity (exact)
`packs/self-storage.test.ts` (core) | Self-storage pack integrity + Excel↔evaluator parity (exact)
`packs/hospitality.test.ts` (core) | Hospitality pack integrity + Excel↔evaluator parity (exact) + operating-statement footing
`packs/senior-housing.test.ts` (core) | Senior-housing pack integrity + Excel↔evaluator parity (exact) + footing/labor-subtotal reconciliation
`packs/student-housing.test.ts` (core) | Student-housing pack integrity + Excel↔evaluator parity (exact) + footing + bed-sizing guard
`packs/land.test.ts` (core) | Land pack integrity + Excel↔evaluator parity (exact) + carry-model footing + income-metric omission guard

## Selecting a pack by asset class

`getPackForAssetClass(asset_class)` returns the built-in pack for an asset class
(or `null` if none is registered) — mirroring `getAssetClassDefaults` in
`defaults.ts`. The CLI's `refine`/`scope` and any consumer should select the pack
off the deal's `frontmatter.asset_class` rather than hard-coding `MULTIFAMILY_PACK`.
Registered today: `multifamily`, `office`, `retail`, `industrial`, `self_storage`,
`hospitality`, `senior_housing`, `student_housing`, `land`, `data_center`,
`manufactured_housing`, `mixed_use`. Each has exactly one spelling; a
namespaced suffix such as `org.uwmd.data_center` is refused
(`INVALID-ASSET-CLASS-002`).

## `MULTIFAMILY_PACK`

A `ModuleManifest` (`requires_conformance: 'verifier'`,
`asset_classes: ['multifamily']`) whose `calculations[]` are the **eight**
multifamily derived metrics. Each is a `ModuleCalcDecl`
(`{ id, label, formula, unit, deterministic: true }`):

id | label | formula | unit
---|---|---|---
`cap_rate` | Cap Rate | `noi_model.net_operating_income / valuation.purchase_price` | `%`
`ltv` | LTV | `debt_structure.loan_amount / (debt_structure.ltv_basis == 'purchase-price' ? valuation.purchase_price : (debt_structure.ltv_basis == 'underwritten-value' ? valuation.underwritten_value : (debt_structure.ltv_basis == 'total-project-cost' ? sources_uses.total_project_cost : null)))` | `%`
`dscr` | DSCR | `noi_model.net_operating_income / debt_structure.annual_debt_service` | `x`
`debt_yield` | Debt Yield | `noi_model.net_operating_income / debt_structure.loan_amount` | `%`
`price_per_unit` | Price / Unit | `valuation.purchase_price / property.total_units` | `$`
`loan_per_unit` | Loan / Unit | `debt_structure.loan_amount / property.total_units` | `$`
`loan_per_sqft` | Loan / SqFt | `debt_structure.loan_amount / property.total_nra_sqft` | `$`
`cash_on_cash` | Cash-on-Cash | `year-1 levered cash flow / sources_uses.equity_metrics.equity_total` | `%`

### One deal-level cash-on-cash definition (RFC 0079)

Format §4.19 defines cash-on-cash as levered cash flow divided by total equity
invested. Every income-class pack selects `dcf.annual_cash_flows.Y1.net_cash_flow_levered`
by its stated year, independently of array order. When that input is absent or
null, it retains the existing `noi_model.net_operating_income - debt_structure.annual_debt_service`
fallback. The denominator is `sources_uses.equity_metrics.equity_total`.
Missing total equity stays uncomputed; zero follows `CALC-DIV-ZERO`.

Sponsor/LP allocation is optional for this generic metric. A sponsor contribution
alone never substitutes for aggregate equity. No `sponsor_cash_on_cash` or
`lp_cash_on_cash` declaration is added: those need separately named metrics,
attributable sponsor/LP cash flows and contribution inputs. RFC 0079 applied this definition to all nine income-class packs of the time, and RFC 0080's `data_center` and `manufactured_housing` packs use it too; land
retains its omission of income metrics. The eight corrected packs and land move to 1.0.1; multifamily moves to 1.0.2
for the shared LTV denominator correction.

The Excel layout binds total equity and the stated year-1 flow to the same pack
expression; absent total equity emits a blank, and stated zero cash flow is kept.
See [the classification and scope note](../reviews/2026-10-03-deal-cash-on-cash.md).

### LTV denominator and producer inputs (RFC 0079 revised direction)

Every builtin class uses loan / `valuation.underwritten_value`, falling back to
`valuation.purchase_price` when no underwritten value is stated. This matches
CC-02 and capital-stack `ltv_through`. The Excel layouts bind both value and
price; the shared conditional expression selects the same denominator.

**Producers of non-multifamily documents now need
`sources_uses.equity_metrics.equity_total` for cash-on-cash.** The eight worked
examples explicitly declare this equal to their sole non-debt sponsor source,
with the identity documented in `_notes`. This is producer-authored evidence;
the runtime does not infer it. Agave's mezz/preferred/common stack remains
ambiguous and its cash-on-cash stays null without a total-equity statement.
Cap rate/debt yield/cash-on-cash comparison minimums are now 3 decimals (0.1%).

### Debt metrics over several debt blocks (RFC 0066)

A deal with senior and mezzanine debt can state `debt_structure` as a
role-bearing variant map: `_role: senior` and `_role: junior` blocks, each with
a `variant=` key. Every metric that reads `debt_structure` must then say which
block it means (Protocol §VIII.2).

- **Lender-side metrics declare `senior`.** In every built-in pack, `ltv`,
  `ltc`, `dscr`, `debt_yield` and `loan_per_*` (56 declarations across twelve
  packs) declare `section_roles: { debt_structure: 'senior' }`. This mirrors the
  validator's registered senior preference for CC-02/03/05/09, stated on the
  declaration rather than inherited.
- **`cash_on_cash` declares no role.** Equity cash flow deducts all debt
  service, so a senior-only cash-on-cash would overstate the return. On a
  multi-tranche map the debt-service fallback refuses `CALC-RESOLVE-002`.
  Every income class can use its stated year-1 DCF levered cash flow without reading
  that fallback; the pack never sums debt blocks.
- **A standalone block is unaffected.** A `primary` + `junior` map reads the
  `primary` block, because an unclaimed declared role falls through to the
  generic order.
- **Two blocks claiming `senior` refuse.** This is the same answer as CC-16.

`null` still means "not stated"; `CALC-RESOLVE-002` means "stated, but no block
can be chosen". A receipt over a refused metric is not issued
(`RCP_COMPUTATION_FAILED`) rather than recording the metric as uncomputed.
`packs.test.ts` pins the 46 senior declarations and the nine role-free
`cash_on_cash` ones.

## `OFFICE_PACK`

A `ModuleManifest` (`requires_conformance: 'verifier'`, `asset_classes:
['office']`) whose `calculations[]` are the **eleven** office derived metrics:

id | label | formula | unit
---|---|---|---
`cap_rate` | Cap Rate | `noi_model.net_operating_income / valuation.purchase_price` | `%`
`ltv` | LTV | `debt_structure.loan_amount / (debt_structure.ltv_basis == 'purchase-price' ? valuation.purchase_price : (debt_structure.ltv_basis == 'underwritten-value' ? valuation.underwritten_value : (debt_structure.ltv_basis == 'total-project-cost' ? sources_uses.total_project_cost : null)))` | `%`
`ltc` | LTC | `debt_structure.loan_amount / sources_uses.uses.total` | `%`
`dscr` | DSCR | `noi_model.net_operating_income / debt_structure.annual_debt_service` | `x`
`debt_yield` | Debt Yield | `noi_model.net_operating_income / debt_structure.loan_amount` | `%`
`price_per_sqft` | Price / SqFt | `valuation.purchase_price / property.rentable_square_feet` | `$`
`loan_per_sqft` | Loan / SqFt | `debt_structure.loan_amount / property.rentable_square_feet` | `$`
`noi_per_sqft` | NOI / SqFt | `noi_model.net_operating_income / property.rentable_square_feet` | `$`
`expense_ratio` | Operating Expense Ratio | `noi_model.expenses.total_operating_expenses / noi_model.income.effective_gross_income` | `%`
`cash_on_cash` | Cash-on-Cash | `year-1 levered cash flow / sources_uses.equity_metrics.equity_total` | `%`
`occupancy` | Occupancy | `rent_roll.occupied_sf / rent_roll.total_rentable_sf` | `%`

Office sizes by **rentable square feet** (`property.rentable_square_feet`,
not `total_units`/`total_nra_sqft`), and its NOI model nests `income`/`expenses`.
The cash-on-cash inputs are common to all income classes. The
`Riverside-Office-Phoenix-AZ.uwx.md` worked example carries the office fields
and explicitly states aggregate equity equal to its sole non-debt sponsor source,
so its standardized cash-on-cash computes with the NOI-minus-debt-service fallback.

## `RETAIL_PACK`

A `ModuleManifest` (`requires_conformance: 'verifier'`, `asset_classes:
['retail']`) whose `calculations[]` are the **twelve** retail derived metrics.
Same cap-rate / LTV / LTC / DSCR / debt-yield core as office, but keyed off
**gross leasable area** (`property.gross_leasable_area`) for the per-SF metrics
and GLA for occupancy (`rent_roll.occupied_gla / rent_roll.total_gla`). The
retail-distinctive metric is `expense_recovery_ratio` —
`noi_model.income.expense_reimbursements / noi_model.expenses.total_operating_expenses` —
the share of operating expenses recovered from tenants under an NNN structure.
Verified against the `Cactus-Crossing-Retail-Mesa-AZ.uwx.md` worked example.

## `INDUSTRIAL_PACK`

A `ModuleManifest` (`requires_conformance: 'verifier'`, `asset_classes:
['industrial']`) whose `calculations[]` are the **twelve** industrial derived
metrics. Same shape as the retail pack — including the NNN `expense_recovery_ratio`
— but keyed off **rentable building area** (`property.rentable_square_feet`) and
SF-based occupancy (`rent_roll.occupied_sf / rent_roll.total_rentable_sf`), like
office. Verified against the `Ironwood-Logistics-Industrial-Tolleson-AZ.uwx.md`
worked example.

## `SELF_STORAGE_PACK`

A `ModuleManifest` (`requires_conformance: 'verifier'`, `asset_classes:
['self_storage']`) whose `calculations[]` are the **twelve** self-storage derived
metrics. Same cap-rate / LTV / LTC / DSCR / debt-yield core as the other income
property packs, but keyed off **net rentable square feet**
(`property.net_rentable_square_feet`), rentable units
(`property.rentable_units`), and both physical and economic occupancy. Verified
against the `Sonoran-Self-Storage-Peoria-AZ.uwx.md` worked example.

## `HOSPITALITY_PACK`

A `ModuleManifest` (`requires_conformance: 'verifier'`, `asset_classes:
['hospitality']`) whose `calculations[]` are the **fourteen** hospitality derived
metrics. Same cap-rate / LTV / LTC / DSCR / debt-yield core as the other income
property packs, but hotels size by **keys** (`property.keys`) rather than area,
so the per-unit metrics are `price_per_key` / `loan_per_key` / `noi_per_key`.

The class-distinctive metrics are the four that make a hotel an operating
business rather than a lease:

id | formula | unit
---|---|---
`occupancy` | `rent_roll.occupied_room_nights / rent_roll.available_room_nights` | `%`
`adr` | `noi_model.income.rooms_revenue / rent_roll.occupied_room_nights` | `$`
`revpar` | `noi_model.income.rooms_revenue / rent_roll.available_room_nights` | `$`
`gop_margin` | `noi_model.gross_operating_profit / noi_model.income.effective_gross_income` | `%`

Two shape notes. Hospitality has **no lease-based rent roll**, so `rent_roll`
carries the trailing-twelve room-night statistics instead (available room nights
= keys × 365, occupied room nights from the STR report) — the same way
self-storage keeps occupied units there. And `noi_model` is **USALI-shaped**: it
carries a `gross_operating_profit` subtotal struck after departmental and
undistributed expenses, with the management fee, property taxes, insurance, and
the FF&E reserve falling below GOP to reach NOI. `RevPAR = ADR × occupancy`
holds by construction, since all three read the same three primitives. Verified
against the `Saguaro-Select-Hotel-Tempe-AZ.uwx.md` worked example.

## `SENIOR_HOUSING_PACK`

A `ModuleManifest` (`requires_conformance: 'verifier'`, `asset_classes:
['senior_housing']`) whose `calculations[]` are the **fourteen** senior-housing
derived metrics. Sizing is per unit (`property.total_units`), as in multifamily,
so the per-unit metrics are `price_per_unit` / `loan_per_unit` / `noi_per_unit`.

Like hospitality, senior housing is an **operating business rather than a
lease** — but the thing that makes or breaks the deal is the operator's labor
model, not the rate. The three class-distinctive metrics say so directly:

id | formula | unit
---|---|---
`revpor` | `noi_model.income.effective_gross_income / (rent_roll.occupied_units * 12)` | `$`
`labor_ratio` | `noi_model.total_labor_expense / noi_model.income.effective_gross_income` | `%`
`care_revenue_ratio` | `noi_model.income.care_revenue / noi_model.income.effective_gross_income` | `%`

RevPOR is revenue **per occupied unit per month** — the blended rate an
underwriter compares against market, covering room-and-board plus care fees.
`care_revenue_ratio` splits that into the share coming from level-of-care fees
rather than rent, which is what distinguishes memory care from independent
living. `labor_ratio` is the single most predictive expense metric in the class.

One structural note. `total_labor_expense` is a **model-level subtotal**
(`noi_model.total_labor_expense`), not an entry inside `noi_model.expenses` —
the three labor lines (`salaries_wages`, `employee_benefits`, `contract_labor`)
stay inside `expenses` so the operating statement still foots to
`total_operating_expenses` without double counting. This mirrors how hospitality
carries `gross_operating_profit`. `senior-housing.test.ts` asserts both halves:
the lines foot, and the subtotal reconciles to its three components while
staying out of the expense map. Verified against the
`Ocotillo-Senior-Living-Chandler-AZ.uwx.md` worked example.

## `STUDENT_HOUSING_PACK`

A `ModuleManifest` (`requires_conformance: 'verifier'`, `asset_classes:
['student_housing']`) whose `calculations[]` are the **fourteen** student-housing
derived metrics. The class looks like multifamily and is not underwritten like
it: leases are signed **per bed**, not per unit, so every sizing and occupancy
metric keys off `property.total_beds` — `price_per_bed`, `loan_per_bed`,
`noi_per_bed`, `revenue_per_bed`, `rent_per_bed_monthly`, and a bed-count
`occupancy`. A test asserts no metric in the pack reads `property.total_units`,
so the multifamily habit cannot creep back in.

The defining metric is `pre_lease_rate`:

id | formula | unit
---|---|---
`pre_lease_rate` | `rent_roll.preleased_beds / property.total_beds` | `%`
`occupancy` | `rent_roll.occupied_beds / property.total_beds` | `%`
`rent_per_bed_monthly` | `noi_model.income.gross_potential_rent.value / (property.total_beds * 12)` | `$`

Student housing re-leases essentially its entire rent roll on one date, so
pre-lease velocity is the leading indicator of next year's revenue in a way no
trailing occupancy figure can be. **`preleased_beds` and `occupied_beds` are
deliberately separate stored counts, not derived from each other** — they are
measured on different dates (next academic year vs. in place today), and the
fixture carries different values for each so the distinction cannot silently
collapse. A test asserts they differ.

Format §4.3 declares both counts and the dates they are measured on (RFC 0069,
Protocol 2.20.0). `occupied_beds` is measured on the roll's `as_of_date`;
`preleased_beds` is measured on `preleased_as_of` for the term starting
`preleased_term_start`. The validator's `BED-NN` rules refuse a stated count
that is malformed, undated or above `property.total_beds`. An absent count
draws nothing, and the metric over it is `null`. The pack formulas are
unchanged.

The operating statement also carries `turnover_make_ready` as its own expense
line: turning nearly the whole property in one August window is a materially
larger and less smoothable cost than conventional multifamily turnover, which is
why the class expense-ratio band sits above multifamily's. Verified against the
`Mill-Ave-Commons-Student-Tempe-AZ.uwx.md` worked example, which also
demonstrates **negative leverage** — a 5.75% going-in cap against 6.25% debt.
The example explicitly states aggregate equity equal to its sole non-debt sponsor
source, documenting that identity in `_notes`; its standardized cash-on-cash
uses the NOI-minus-debt-service fallback (about 3.00%).

## `LAND_PACK`

A `ModuleManifest` (`requires_conformance: 'verifier'`, `asset_classes:
['land']`) whose `calculations[]` are the **twelve** land derived metrics. Land
is the one class here that is **not an income property**, and the pack is shaped
entirely by that.

**It deliberately omits `cap_rate`, `dscr`, and `debt_yield`.** Every other pack
is built around those three. Land has no stabilized income: its `noi_model` is a
*carry model* holding taxes, assessments, insurance, and site security against
at most incidental interim revenue (grazing, billboard, laydown), so its net
operating income is normally **negative**. Capitalizing that produces a number
that is arithmetically valid and financially meaningless — a "−1.6% cap rate"
reads as a yield when it is a carry burden, and a negative DSCR reads as
distress when the loan is an interest-only entitlement facility carried out of
an equity reserve exactly as underwritten. Emitting those metrics would be
confidently wrong, which is worse than emitting none. `land.test.ts` pins the
omission, and separately asserts that no land formula reads
`net_operating_income` at all, so a future contributor cannot restore cap rate
by pattern-matching the other packs.

What land is underwritten on instead is **basis and density**:

id | formula | unit
---|---|---
`price_per_buildable_unit` | `valuation.purchase_price / property.entitled_units` | `$`
`price_per_usable_acre` | `valuation.purchase_price / property.usable_acres` | `$`
`usable_land_ratio` | `property.usable_acres / property.gross_acres` | `%`
`basis_per_buildable_unit` | `sources_uses.uses.total / property.entitled_units` | `$`
`carry_ratio` | `noi_model.expenses.total_operating_expenses / valuation.purchase_price` | `%`
`land_to_sellout_ratio` | `valuation.purchase_price / valuation.projected_gross_sellout` | `%`

`usable_land_ratio` matters because gross acreage overstates what can be built —
washes, drainage easements, slopes, and open-space dedication come out first, and
every per-acre price should be read against the usable figure.
`land_to_sellout_ratio` is the homebuilder's test: land basis as a share of
eventual finished-lot revenue.

`LAND_DEFAULTS` follows the same logic and publishes **no** `rent_roll.*`,
`noi_model.expense_ratio`, or `valuation.exit_cap_rate_pct` entry — there is
nothing to occupy and no income to capitalize. A test asserts those absences,
and another asserts land's LTV band sits at or below every income class, since
lenders advance well below income-property leverage on dirt. Verified against
the `Sundance-Ranch-Land-Buckeye-AZ.uwx.md` worked example.

> **A note on nulls.** The land example leaves `going_in_cap_rate`,
> `exit_cap_rate`, `dscr`, and `debt_yield` explicitly `null` rather than `0`.
> `null` means *does not apply to this asset class*; `0` would mean *measured and
> found to be zero*. A test pins the distinction, because every downstream reader
> — renderer, Excel, receipt, agent — depends on it.

There are **twelve builtin packs**. `mixed_use` composes stated component
subtotals and allocations under RFC 0019 instead of blending incompatible
sizes. Each class's metrics remain in the normative dictionary, including the
shared cash-on-cash definition across the eleven income classes. Official new
classes follow the builtin contract; modules support private extensions.

## Who consumes the pack

- **Web editor** (`tools/web-editor`) — evaluates each formula on edit via
  `evaluateCalc` and renders live metric cards.
- **Excel converter** (`@uwmd/excel`) — emits each formula as an Excel formula
  via `emitExcelFormula` (see below).
- **CLI** — `uwmd calc`, `uwmd refine`/`uwmd scope` (which select the pack via
  `getPackForAssetClass(frontmatter.asset_class)`).
- **Refinement engine** — `extractDependencyGraph(parsed, { packs })`.
- **Conformance** — the calc fixtures, and the dictionary-only
  [lender fixture](../../conformance/metrics/README.md) that checks every
  builtin example without pack or engine code.

## Excel emit + the parity invariant

`emitFromAst(expr, { namedRanges })` and `emitExcelFormula(formula, opts)`
translate a parsed safe-expression into an Excel formula string (without the
leading `=`). The caller supplies a `namedRanges: Map<calcPath, excelNamedRange>`.

Operator / function mapping (`excel-emit.ts`): arithmetic and parens are
identical; `%` → `MOD`; comparisons/ternary → `IF`/`AND`/`OR`/`NOT`; builtins map
to Excel equivalents (`sum→SUM`, `pmt→PMT`, `npv→NPV`, `irr→IRR`, `round→ROUND`,
`pow→POWER`, `log→LN`, `ceil→CEILING`, `fv→FV`, `pv→PV`, `nper→NPER`, …).

`emitCalcExcelFormula(decl, opts)` is what converters call. Beyond the
§VIII.5 `ROUND`, it renders the evaluator's null (§VIII.2) as `#N/A` (#487):
a blank named input reads as `NA()` where it is used, the null literal is
`NA()`, `x == null` is `ISNA`-based, `&&`/`||` short-circuit through `IF`,
`sum` counts null as 0 and `min`/`max` skip it, and the inputs whose absence
nulls the whole result are tested once outside `ROUND`:
`IF(OR(ISBLANK(a),ISBLANK(b)),NA(),ROUND(expr,n))`. A mapped value that is not
a plain workbook name (a caller-guarded expression) is used as given. The bare
`emitFromAst`/`emitExcelFormula` keep Excel's reading of a blank cell and are
not the parity path. `excel-emit.null-parity.test.ts` blanks every combination
of every builtin calculation's inputs and checks the emitted formula, evaluated
with Excel's semantics by the test-only `test/excel-formula.mts`, against
`evaluateCalc`.

`ExcelEmitError` codes:
- `EXCEL-EMIT-PATH` — a path/identifier has no named range in the map.
- `EXCEL-EMIT-FN` — a builtin has no clean Excel equivalent (e.g. `coalesce`,
  null-aware `avg`).
- `EXCEL-EMIT-OP` — unreachable operator guard.

> **The invariant (a starter-product quality bar, RFC 0078 D6):** the calc
> engine and the Excel emitter are two renderings of the *same* AST. `packs.test.ts` asserts that for every metric in the pack, the
> evaluator's number and the Excel formula's number agree **exactly after §VIII.5 quantization**.
> If you add or change a metric, both paths must still agree, or the test fails.

**Variant-map inputs (RFC 0066).** `@uwmd/excel` reads every named input from
the block `resolveSectionBlock` selects, under the role the pack's calculations
declare. A section that cannot be selected writes `#VALUE!` with a note, never a
blank Excel would read as zero. A metric whose own selection refuses also shows
`#VALUE!`, exactly where `evaluateCalc` is `ok: false`. The export refuses
(`EXCEL-EMIT-PATH`) only when a metric would read a different block than its
named input holds. `toWorkbook.test.ts` pins the senior + junior, primary +
junior, two-senior and default-junior cases.

## Recipe: add a derived metric to the multifamily pack

1. Record the accepted normative definition in `spec/metrics/builtin.json`
   (a new or changed definition is a normative change and needs an RFC),
   including effective precision, potential inputs and declared section roles,
   then run `npm run gen-metric-dictionary`. Mirror it as a `ModuleCalcDecl` in `MULTIFAMILY_PACK.calculations` in
   `builtin-packs/multifamily.ts` — pick an `id`, `label`, `unit` (`%`/`$`/`x`), and a
   `formula` referencing real section field paths (see [07 — Data model](07-data-model-reference.md)).
2. Make sure every field path the formula reads has an Excel named range. If the
   metric uses a new input, add it to `NAMED_INPUTS` / `NAMED_RANGE_MAP` in
   `packages/uwmd-excel/src/multifamily.ts` (see [08 — Tools › Excel](08-tools.md)).
   If the formula uses a builtin with no Excel equivalent, the Excel path will
   fail with `EXCEL-EMIT-FN` — choose Excel-mappable builtins.
   If it reads a section that can be a role-bearing variant map (`debt_structure`
   today), decide which block it means: declare `section_roles` for a single
   tranche, or none when it needs every tranche (it then refuses on a map).
   Keep one role per section within a pack; the workbook holds one input per path.
3. Run `npm test` (dictionary completeness and Excel parity both exercise it) and, if
   you added a calc fixture, `npm run conformance -- --suite=calc`.

## Recipe: add a new built-in asset-class pack

`office` was the first pack to follow this recipe — model new packs on
`builtin-packs/office.ts` (verify) + `packs/office.test.ts` (core). Adding a built-in pack for an asset
class changes the normative metric dictionary and therefore needs an RFC.
Official new classes follow the builtin class contract; private third-party
extensions use modules.

1. Create `builtin-packs/<assetclass>.ts` exporting `const <X>_PACK: ModuleManifest` with
   `asset_classes: ['<assetclass>']` and a `calculations[]` array. Reference real
   field paths from a worked example deal for that class (see [07 — Data
   model](07-data-model-reference.md)).
2. Export it from `builtin-packs/index.ts` (and add it to the `PACK_REGISTRY` there so
   `getPackForAssetClass` resolves it) and from `@uwmd/verify`'s `src/index.ts`
   (its browser entry and core's entries pick it up), then re-export it from
   core's `packs/index.ts`. Add it to the standard list in verify's
   `src/standard-closure.test.ts`.
3. Add an `<assetclass>` defaults table in core's `defaults.ts` and register it in that
   file's `REGISTRY` so the cascade and refinement engine can resolve its inputs.
4. Add the Excel layout (named inputs/ranges) in a corresponding Excel layout
   module. Every official class gets one, together with its defaults table and
   a worked example (full starter support, RFC 0078 D5 and RFC 0080).
5. Add its normative calculation and size entries to `spec/metrics/builtin.json`
   and run `npm run gen-metric-dictionary` (`@uwmd/verify` ships the dictionary as
   `src/metric-dictionary.ts`); dictionary parity must prove completeness. Add a parity test analogous to
   core's `packs/office.test.ts` (and Verifier calc conformance
   fixtures under `calc/` if needed).

> **You should not have to touch the "unregistered class" negative tests.** They
> anchor on the synthetic identifier `__unregistered_test_class__`, not on a real
> enum member, precisely so that registering a class cannot invalidate them. If
> you find yourself editing `cascade.test.ts`, `defaults.test.ts`,
> `toWorkbook.test.ts`, `receipts.test.ts`, or the
> `conformance/receipts/refuse/02-no-pack-for-asset-class` fixture to make a new
> pack pass, something is wrong — those tests assert that an *unknown* class
> resolves to nothing, which stays true no matter how many real classes ship.
> `__unregistered_test_class__` must never be added to the `AssetClass` union.

## Official builtin classes (RFC 0080)

All twelve official classes are full builtins, including `data_center` and `manufactured_housing`. Their normative metric definitions and size selectors live in `spec/metrics/`, with bidirectional pack/registry parity tests. Both new packs use all six RFC 0079 standard income definitions, including equity_total-based cash-on-cash. Source size is `property.critical_it_load_kw` or `property.total_sites`, mirrored against the detailed capacity/site count. They have Excel layouts and starter defaults, and take the base stage lists verbatim like multifamily (no stage overlay; a missing `rent_roll` is DQ-06). Default tables are owner-approved starter proxies (2026-10-10), never verification inputs; data center publishes no expense-ratio default, so producers state it.

Hospitality owns `hotel_metrics`, `hotel_brand` and `hotel_food_beverage`; its sole RevPAR definition stays rooms revenue divided by available room nights. Official classes have no module packages and no module-gated behavior: the class rules and calcs apply identically to every document of the class. Third-party classes remain module extensions.
