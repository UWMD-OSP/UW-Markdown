# 05 — Calc packs

A **calc pack** is a `ModuleManifest` that bundles a set of derived-metric
declarations for an asset class. It is the *single source of truth* for those
metrics: define a formula once, and every consumer (web editor, Excel converter,
CLI, conformance, refinement) picks it up.

- **Location:** [`packages/uwmd-core/src/packs/`](../../packages/uwmd-core/src/packs/)
- **Public API (via `index.ts`):** `MULTIFAMILY_PACK`, `OFFICE_PACK`,
  `RETAIL_PACK`, `INDUSTRIAL_PACK`, `SELF_STORAGE_PACK`, `HOSPITALITY_PACK`,
  `SENIOR_HOUSING_PACK`, `STUDENT_HOUSING_PACK`, `LAND_PACK`,
  `getPackForAssetClass`,
  `emitFromAst`, `emitExcelFormula`, `ExcelEmitError`, type `ExcelEmitOptions`.

## File layout

File | Role
---|---
`packs/multifamily.ts` | `MULTIFAMILY_PACK` — the canonical multifamily metrics
`packs/office.ts` | `OFFICE_PACK` — the canonical office metrics
`packs/retail.ts` | `RETAIL_PACK` — the canonical retail metrics
`packs/industrial.ts` | `INDUSTRIAL_PACK` — the canonical industrial metrics
`packs/self-storage.ts` | `SELF_STORAGE_PACK` — the canonical self-storage metrics
`packs/hospitality.ts` | `HOSPITALITY_PACK` — the canonical hospitality metrics
`packs/senior-housing.ts` | `SENIOR_HOUSING_PACK` — the canonical senior-housing metrics
`packs/student-housing.ts` | `STUDENT_HOUSING_PACK` — the canonical student-housing metrics
`packs/land.ts` | `LAND_PACK` — the canonical land metrics (no cap rate by design)
`packs/excel-emit.ts` | Translate the same calc AST → Excel formula string
`packs/index.ts` | Re-exports the packs + the `getPackForAssetClass` registry
`packs/packs.test.ts` | Multifamily pack integrity + Excel↔evaluator parity (exact)
`packs/office.test.ts` | Office pack integrity + Excel↔evaluator parity (exact)
`packs/retail.test.ts` | Retail pack integrity + Excel↔evaluator parity (exact)
`packs/industrial.test.ts` | Industrial pack integrity + Excel↔evaluator parity (exact)
`packs/self-storage.test.ts` | Self-storage pack integrity + Excel↔evaluator parity (exact)
`packs/hospitality.test.ts` | Hospitality pack integrity + Excel↔evaluator parity (exact) + operating-statement footing
`packs/senior-housing.test.ts` | Senior-housing pack integrity + Excel↔evaluator parity (exact) + footing/labor-subtotal reconciliation
`packs/student-housing.test.ts` | Student-housing pack integrity + Excel↔evaluator parity (exact) + footing + bed-sizing guard
`packs/land.test.ts` | Land pack integrity + Excel↔evaluator parity (exact) + carry-model footing + income-metric omission guard

## Selecting a pack by asset class

`getPackForAssetClass(asset_class)` returns the built-in pack for an asset class
(or `null` if none is registered) — mirroring `getAssetClassDefaults` in
`defaults.ts`. The CLI's `refine`/`scope` and any consumer should select the pack
off the deal's `frontmatter.asset_class` rather than hard-coding `MULTIFAMILY_PACK`.
Registered today: `multifamily`, `office`, `retail`, `industrial`, `self_storage`,
`hospitality`, `senior_housing`, `student_housing`, `land`.

## `MULTIFAMILY_PACK`

A `ModuleManifest` (`requires_tier: 'tier-3-calc-host'`,
`asset_classes: ['multifamily']`) whose `calculations[]` are the **eight**
multifamily derived metrics. Each is a `ModuleCalcDecl`
(`{ id, label, formula, unit, deterministic: true }`):

id | label | formula | unit
---|---|---|---
`cap_rate` | Cap Rate | `noi_model.net_operating_income / valuation.purchase_price` | `%`
`ltv` | LTV | `debt_structure.loan_amount / valuation.purchase_price` | `%`
`dscr` | DSCR | `noi_model.net_operating_income / debt_structure.annual_debt_service` | `x`
`debt_yield` | Debt Yield | `noi_model.net_operating_income / debt_structure.loan_amount` | `%`
`price_per_unit` | Price / Unit | `valuation.purchase_price / property.total_units` | `$`
`loan_per_unit` | Loan / Unit | `debt_structure.loan_amount / property.total_units` | `$`
`loan_per_sqft` | Loan / SqFt | `debt_structure.loan_amount / property.total_nra_sqft` | `$`
`cash_on_cash` | Cash-on-Cash | `(noi_model.net_operating_income - debt_structure.annual_debt_service) / sources_uses.sources.equity_sponsor` | `%`

## `OFFICE_PACK`

A `ModuleManifest` (`requires_tier: 'tier-3-calc-host'`, `asset_classes:
['office']`) whose `calculations[]` are the **eleven** office derived metrics:

id | label | formula | unit
---|---|---|---
`cap_rate` | Cap Rate | `noi_model.net_operating_income / valuation.purchase_price` | `%`
`ltv` | LTV | `debt_structure.loan_amount / valuation.purchase_price` | `%`
`ltc` | LTC | `debt_structure.loan_amount / sources_uses.uses.total` | `%`
`dscr` | DSCR | `noi_model.net_operating_income / debt_structure.annual_debt_service` | `x`
`debt_yield` | Debt Yield | `noi_model.net_operating_income / debt_structure.loan_amount` | `%`
`price_per_sqft` | Price / SqFt | `valuation.purchase_price / property.rentable_square_feet` | `$`
`loan_per_sqft` | Loan / SqFt | `debt_structure.loan_amount / property.rentable_square_feet` | `$`
`noi_per_sqft` | NOI / SqFt | `noi_model.net_operating_income / property.rentable_square_feet` | `$`
`expense_ratio` | Operating Expense Ratio | `noi_model.expenses.total_operating_expenses / noi_model.income.effective_gross_income` | `%`
`cash_on_cash` | Cash-on-Cash | `(noi_model.net_operating_income - debt_structure.annual_debt_service) / sources_uses.sources.sponsor_equity` | `%`
`occupancy` | Occupancy | `rent_roll.occupied_sf / rent_roll.total_rentable_sf` | `%`

Office diverges from multifamily on three field shapes: size is **rentable square
feet** (`property.rentable_square_feet`, not `total_units`/`total_nra_sqft`),
sponsor equity is `sources_uses.sources.sponsor_equity` (not `equity_sponsor`),
and the NOI model nests `income`/`expenses`. Verified against the
`Riverside-Office-Phoenix-AZ.uwx.md` worked example.

## `RETAIL_PACK`

A `ModuleManifest` (`requires_tier: 'tier-3-calc-host'`, `asset_classes:
['retail']`) whose `calculations[]` are the **twelve** retail derived metrics.
Same cap-rate / LTV / LTC / DSCR / debt-yield core as office, but keyed off
**gross leasable area** (`property.gross_leasable_area`) for the per-SF metrics
and GLA for occupancy (`rent_roll.occupied_gla / rent_roll.total_gla`). The
retail-distinctive metric is `expense_recovery_ratio` —
`noi_model.income.expense_reimbursements / noi_model.expenses.total_operating_expenses` —
the share of operating expenses recovered from tenants under an NNN structure.
Verified against the `Cactus-Crossing-Retail-Mesa-AZ.uwx.md` worked example.

## `INDUSTRIAL_PACK`

A `ModuleManifest` (`requires_tier: 'tier-3-calc-host'`, `asset_classes:
['industrial']`) whose `calculations[]` are the **twelve** industrial derived
metrics. Same shape as the retail pack — including the NNN `expense_recovery_ratio`
— but keyed off **rentable building area** (`property.rentable_square_feet`) and
SF-based occupancy (`rent_roll.occupied_sf / rent_roll.total_rentable_sf`), like
office. Verified against the `Ironwood-Logistics-Industrial-Tolleson-AZ.uwx.md`
worked example.

## `SELF_STORAGE_PACK`

A `ModuleManifest` (`requires_tier: 'tier-3-calc-host'`, `asset_classes:
['self_storage']`) whose `calculations[]` are the **twelve** self-storage derived
metrics. Same cap-rate / LTV / LTC / DSCR / debt-yield core as the other income
property packs, but keyed off **net rentable square feet**
(`property.net_rentable_square_feet`), rentable units
(`property.rentable_units`), and both physical and economic occupancy. Verified
against the `Sonoran-Self-Storage-Peoria-AZ.uwx.md` worked example.

## `HOSPITALITY_PACK`

A `ModuleManifest` (`requires_tier: 'tier-3-calc-host'`, `asset_classes:
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

A `ModuleManifest` (`requires_tier: 'tier-3-calc-host'`, `asset_classes:
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

A `ModuleManifest` (`requires_tier: 'tier-3-calc-host'`, `asset_classes:
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
`rent_per_bed_monthly` | `noi_model.income.gross_potential_rent / (property.total_beds * 12)` | `$`

Student housing re-leases essentially its entire rent roll on one date, so
pre-lease velocity is the leading indicator of next year's revenue in a way no
trailing occupancy figure can be. **`preleased_beds` and `occupied_beds` are
deliberately separate stored counts, not derived from each other** — they are
measured on different dates (next academic year vs. in place today), and the
fixture carries different values for each so the distinction cannot silently
collapse. A test asserts they differ.

The operating statement also carries `turnover_make_ready` as its own expense
line: turning nearly the whole property in one August window is a materially
larger and less smoothable cost than conventional multifamily turnover, which is
why the class expense-ratio band sits above multifamily's. Verified against the
`Mill-Ave-Commons-Student-Tempe-AZ.uwx.md` worked example, which also
demonstrates honest **negative leverage** — a 5.75% going-in cap against 6.25%
debt, giving 3.0% year-one cash-on-cash.

## `LAND_PACK`

A `ModuleManifest` (`requires_tier: 'tier-3-calc-host'`, `asset_classes:
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

These are the **nine asset-class packs today** (`multifamily`, `office`,
`retail`, `industrial`, `self_storage`, `hospitality`, `senior_housing`,
`student_housing`, `land`). Only `mixed_use` remains undefined, and it is the one
class the recipe below does not fit: it composes other classes rather than
standing alone. See [RFC 0019](../rfcs/0019-mixed-use-composition.md) — unlike
the other nine, it needs a normative format change (a `components` section)
before its pack can be written, because the calc engine cannot iterate over a
variable-length component list. Adding another **built-in** pack for any other
existing enum value remains a library-only change (follow the recipe below). Letting **third-party modules** declare entirely new
asset-class identifiers is the separate v2 RFC topic — see
`docs/rfcs/0003-module-asset-classes.md`.

## Who consumes the pack

- **Web editor** (`tools/web-editor`) — evaluates each formula on edit via
  `evaluateCalc` and renders live metric cards.
- **Excel converter** (`@uwmd/excel`) — emits each formula as an Excel formula
  via `emitExcelFormula` (see below).
- **CLI** — `uwmd calc`, `uwmd refine`/`uwmd scope` (which select the pack via
  `getPackForAssetClass(frontmatter.asset_class)`).
- **Refinement engine** — `extractDependencyGraph(parsed, { packs })`.
- **Conformance** — Tier-3 fixtures.

## Excel emit + the parity invariant

`emitFromAst(expr, { namedRanges })` and `emitExcelFormula(formula, opts)`
translate a parsed safe-expression into an Excel formula string (without the
leading `=`). The caller supplies a `namedRanges: Map<calcPath, excelNamedRange>`.

Operator / function mapping (`excel-emit.ts`): arithmetic and parens are
identical; `%` → `MOD`; comparisons/ternary → `IF`/`AND`/`OR`/`NOT`; builtins map
to Excel equivalents (`sum→SUM`, `pmt→PMT`, `npv→NPV`, `irr→IRR`, `round→ROUND`,
`pow→POWER`, `log→LN`, `ceil→CEILING`, `fv→FV`, `pv→PV`, `nper→NPER`, …).

`ExcelEmitError` codes:
- `EXCEL-EMIT-PATH` — a path/identifier has no named range in the map.
- `EXCEL-EMIT-FN` — a builtin has no clean Excel equivalent (e.g. `coalesce`,
  null-aware `avg`).
- `EXCEL-EMIT-OP` — unreachable operator guard.

> **The invariant:** the calc engine and the Excel emitter are two renderings of
> the *same* AST. `packs.test.ts` asserts that for every metric in the pack, the
> evaluator's number and the Excel formula's number agree **to six decimals**.
> If you add or change a metric, both paths must still agree, or the test fails.

## Recipe: add a derived metric to the multifamily pack

1. Add a `ModuleCalcDecl` to `MULTIFAMILY_PACK.calculations` in
   `packs/multifamily.ts` — pick an `id`, `label`, `unit` (`%`/`$`/`x`), and a
   `formula` referencing real section field paths (see [07 — Data model](07-data-model-reference.md)).
2. Make sure every field path the formula reads has an Excel named range. If the
   metric uses a new input, add it to `NAMED_INPUTS` / `NAMED_RANGE_MAP` in
   `packages/uwmd-excel/src/multifamily.ts` (see [08 — Tools › Excel](08-tools.md)).
   If the formula uses a builtin with no Excel equivalent, the Excel path will
   fail with `EXCEL-EMIT-FN` — choose Excel-mappable builtins.
3. Run `npm test` (the parity test in `packs.test.ts` will exercise it) and, if
   you added a Tier-3 fixture, `npm run conformance -- --tier=3`.

## Recipe: add a new built-in asset-class pack

`office` was the first pack to follow this recipe — model new packs on
`packs/office.ts` + `packs/office.test.ts`. Adding a built-in pack for an asset
class **already in the `AssetClass` enum** is a library-only change and does **not**
need an RFC (no `spec/` change). Only declaring a brand-new asset-class identifier
needs RFC 0003.

1. Create `packs/<assetclass>.ts` exporting `const <X>_PACK: ModuleManifest` with
   `asset_classes: ['<assetclass>']` and a `calculations[]` array. Reference real
   field paths from a worked example deal for that class (see [07 — Data
   model](07-data-model-reference.md)).
2. Export it from `packs/index.ts` (and add it to the `PACK_REGISTRY` there so
   `getPackForAssetClass` resolves it), then from `src/index.ts` and
   `src/browser.ts`.
3. Add an `<assetclass>` defaults table in `defaults.ts` and register it in that
   file's `REGISTRY` so the cascade and refinement engine can resolve its inputs.
4. Decide the Excel layout (named inputs/ranges) in a corresponding Excel layout
   module if Excel export is in scope.
5. Add a parity test analogous to `packs/office.test.ts` (and Tier-3 conformance
   fixtures if needed).

> **You should not have to touch the "unregistered class" negative tests.** They
> anchor on the synthetic identifier `__unregistered_test_class__`, not on a real
> enum member, precisely so that registering a class cannot invalidate them. If
> you find yourself editing `cascade.test.ts`, `defaults.test.ts`,
> `toWorkbook.test.ts`, `receipts.test.ts`, or the
> `conformance/receipts/refuse/02-no-pack-for-asset-class` fixture to make a new
> pack pass, something is wrong — those tests assert that an *unknown* class
> resolves to nothing, which stays true no matter how many real classes ship.
> `__unregistered_test_class__` must never be added to the `AssetClass` union.
