# @uwmd/excel

Excel converter for UW Markdown — emit an underwriting workbook from a
structured `.uwx.md` file, using the registered asset-class layout.

```
uwmd-excel deal.uwx.md -o deal.xlsx
```

The standard multifamily workbook includes these sheets; other asset-class
layouts and optional features add their own sheets:

- **Underwriting** — header (deal name + address), an *Inputs* block where each
  row is a labeled cell with a workbook-scope named range
  (`purchase_price`, `loan_amount`, `annual_debt_service`, `total_units`,
  `total_nra_sqft`, `equity_sponsor`), and a *Derived Metrics* block where each
  row holds an Excel **formula** referencing those named ranges.
- **Operating Statement** — five income line items, an `EGI = SUM(income)`
  sub-total, eleven expense line items, a `total_opex = SUM(expenses)`
  sub-total, and an `NOI = EGI − total_opex` formula. The NOI cell is the
  workbook's `noi` named range — every Underwriting-sheet metric that needs
  NOI references it.
- **Pipeline Log** — flat audit table of every `pipeline_log` block.

## Calc-integrity contract

The eight derived metrics ship as **formulas**, not pre-computed numbers:

| Metric         | Formula                                            |
| -------------- | -------------------------------------------------- |
| Cap Rate       | `=noi/purchase_price`                              |
| LTV            | `=loan_amount/purchase_price`                      |
| DSCR           | `=noi/annual_debt_service`                         |
| Debt Yield     | `=noi/loan_amount`                                 |
| Price / Unit   | `=purchase_price/total_units`                      |
| Loan / Unit    | `=loan_amount/total_units`                         |
| Loan / SqFt    | `=loan_amount/total_nra_sqft`                      |
| Cash-on-Cash   | `=(noi-annual_debt_service)/equity_sponsor`        |

These mirror `MULTIFAMILY_STARTER_PACK` in `@uwmd/core`, so opening the
workbook in Excel and running `uwmd calc` against the same `.uw.md`
produce identical numbers by construction.

Editing any named-input cell updates every dependent metric. Editing any
income or expense line item updates EGI, total opex, NOI, and every metric
that touches NOI.

## Scope

Layouts cover multifamily, office, retail, industrial, self-storage, hospitality,
senior housing, student housing, land and mixed-use. `fromWorkbook` and
`--import` recover editable section fragments from supported converter workbooks;
apply those through the Tier-2 editor to preserve provenance. Extended custom
calculation workbooks explicitly refuse reverse import. The standalone Excel
package remains unpublished; source support is not a publication claim.

## Library use

```ts
import { parseUWFile } from '@uwmd/core';
import { toWorkbook } from '@uwmd/excel';

const parsed = parseUWFile(await readFile('deal.uwx.md', 'utf8'));
const wb = await toWorkbook(parsed);
await wb.xlsx.writeFile('deal.xlsx');
```

`toWorkbook` returns an `ExcelJS.Workbook`, so you can serialize to a buffer,
add sheets, restyle, or pipe to a stream.

## Layout schema

`src/multifamily.ts` is the single source of truth for the layout — income and
expense line items, named inputs, derived-metric formulas. The converter in
`src/toWorkbook.ts` is generic; everything asset-class-specific lives in the
layout module.


## Explicit period/custom-calculation export (RFC 0043, source implementation)

```ts
const workbook = await toWorkbook(parsed, {
  calculations: ['year_three_noi_per_unit'],
  calculationContext: { sectionVariants: { dcf: 'base' } },
});
```

```sh
uwmd-excel deal.uwx.md --calculations year_three_noi_per_unit -o deal.xlsx
```

Only requested IDs export. Numeric literals, paths, period selectors, unary
minus and arithmetic +, -, *, / are supported. Existing pack sheets are unchanged.
Shared inputs are editable and period lookup survives whole-row sorting. Missing
values are #N/A, invalid identities/nonnumeric inputs are #VALUE!, and zero stays
zero. Change the period set in the source document and re-export. Exact variants
and full-path overrides, including null, apply only to the additional calculations.

These additional inputs are export-only: reverse import explicitly refuses a
marked extended workbook. This protects against silently discarding their edits.
See RFC 0043 and scripts/verify-excel-periods.ps1 for native Excel verification.
This source implementation does not imply a new standalone package publication.

### Context files

From a built source checkout at the repository root:

```sh
node packages/uwmd-excel/bin/uwmd-excel.mjs deal.uwx.md --calculations year_three_noi_per_unit --calc-context context.json -o deal.xlsx
```

The JSON file accepts `sectionVariants` and `overrides`, for example
`{"sectionVariants":{"dcf":"base"},"overrides":{}}`. Use exact input paths for
overrides; zero and null remain distinct. Context requires `--calculations` and
affects only those additional calculations. Invalid context fails before any
output is written. See the [context guide](../../tools/docs-site/guide/calculation-context.md)
for validation rules and examples.
