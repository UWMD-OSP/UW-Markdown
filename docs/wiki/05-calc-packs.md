# 05 — Calc packs

A **calc pack** is a `ModuleManifest` that bundles a set of derived-metric
declarations for an asset class. It is the *single source of truth* for those
metrics: define a formula once, and every consumer (web editor, Excel converter,
CLI, conformance, refinement) picks it up.

- **Location:** [`packages/uwmd-core/src/packs/`](../../packages/uwmd-core/src/packs/)
- **Public API (via `index.ts`):** `MULTIFAMILY_PACK`, `OFFICE_PACK`,
  `RETAIL_PACK`, `INDUSTRIAL_PACK`, `SELF_STORAGE_PACK`, `HOSPITALITY_PACK`,
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
`packs/excel-emit.ts` | Translate the same calc AST → Excel formula string
`packs/index.ts` | Re-exports the packs + the `getPackForAssetClass` registry
`packs/packs.test.ts` | Multifamily pack integrity + Excel↔evaluator parity (6 decimals)
`packs/office.test.ts` | Office pack integrity + Excel↔evaluator parity (6 decimals)
`packs/retail.test.ts` | Retail pack integrity + Excel↔evaluator parity (6 decimals)
`packs/industrial.test.ts` | Industrial pack integrity + Excel↔evaluator parity (6 decimals)
`packs/self-storage.test.ts` | Self-storage pack integrity + Excel↔evaluator parity (6 decimals)
`packs/hospitality.test.ts` | Hospitality pack integrity + Excel↔evaluator parity (6 decimals) + operating-statement footing

## Selecting a pack by asset class

`getPackForAssetClass(asset_class)` returns the built-in pack for an asset class
(or `null` if none is registered) — mirroring `getAssetClassDefaults` in
`defaults.ts`. The CLI's `refine`/`scope` and any consumer should select the pack
off the deal's `frontmatter.asset_class` rather than hard-coding `MULTIFAMILY_PACK`.
Registered today: `multifamily`, `office`, `retail`, `industrial`, `self_storage`,
`hospitality`.

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
`Riverside-Office-Phoenix-AZ.uw.md` worked example.

## `RETAIL_PACK`

A `ModuleManifest` (`requires_tier: 'tier-3-calc-host'`, `asset_classes:
['retail']`) whose `calculations[]` are the **twelve** retail derived metrics.
Same cap-rate / LTV / LTC / DSCR / debt-yield core as office, but keyed off
**gross leasable area** (`property.gross_leasable_area`) for the per-SF metrics
and GLA for occupancy (`rent_roll.occupied_gla / rent_roll.total_gla`). The
retail-distinctive metric is `expense_recovery_ratio` —
`noi_model.income.expense_reimbursements / noi_model.expenses.total_operating_expenses` —
the share of operating expenses recovered from tenants under an NNN structure.
Verified against the `Cactus-Crossing-Retail-Mesa-AZ.uw.md` worked example.

## `INDUSTRIAL_PACK`

A `ModuleManifest` (`requires_tier: 'tier-3-calc-host'`, `asset_classes:
['industrial']`) whose `calculations[]` are the **twelve** industrial derived
metrics. Same shape as the retail pack — including the NNN `expense_recovery_ratio`
— but keyed off **rentable building area** (`property.rentable_square_feet`) and
SF-based occupancy (`rent_roll.occupied_sf / rent_roll.total_rentable_sf`), like
office. Verified against the `Ironwood-Logistics-Industrial-Tolleson-AZ.uw.md`
worked example.

## `SELF_STORAGE_PACK`

A `ModuleManifest` (`requires_tier: 'tier-3-calc-host'`, `asset_classes:
['self_storage']`) whose `calculations[]` are the **twelve** self-storage derived
metrics. Same cap-rate / LTV / LTC / DSCR / debt-yield core as the other income
property packs, but keyed off **net rentable square feet**
(`property.net_rentable_square_feet`), rentable units
(`property.rentable_units`), and both physical and economic occupancy. Verified
against the `Sonoran-Self-Storage-Peoria-AZ.uw.md` worked example.

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
against the `Saguaro-Select-Hotel-Tempe-AZ.uw.md` worked example.

These are the **six asset-class packs today** (`multifamily`, `office`,
`retail`, `industrial`, `self_storage`, `hospitality`). The `AssetClass` type
union also lists senior_housing/student_housing/mixed_use/land, but no packs are
defined for them yet. Adding
another **built-in** pack for an existing enum value is a library-only change
(follow the recipe below). Letting **third-party modules** declare entirely new
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
   fixtures if needed). Update any existing tests that assert the class is
   *unregistered* (e.g. `cascade.test.ts`, `defaults.test.ts`).
