# @uwmd/excel

Excel converter for UW Markdown — emit a live multifamily underwriting
workbook from a `.uw.md` file.

```
uwmd-excel deal.uw.md -o deal.xlsx
```

The generated workbook has three sheets:

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

## Scope (0.1.0)

- `.uw.md` → `.xlsx` only — the reverse direction (workbook → `.uw.md`) is not
  yet implemented. The calc-aware web editor at `tools/web-editor/` remains the
  canonical Tier-2 chokepoint for editing a deal file.
- Multifamily only. Other asset classes will land as separate layout modules
  alongside `src/multifamily.ts`.

## Library use

```ts
import { parseUWFile } from '@uwmd/core';
import { toWorkbook } from '@uwmd/excel';

const parsed = parseUWFile(await readFile('deal.uw.md', 'utf8'));
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
