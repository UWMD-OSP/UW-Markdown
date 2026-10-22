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

The eight derived metrics ship as **formulas**, not pre-computed numbers. Their
expressions over the named ranges are:

| Metric         | Expression                                                       |
| -------------- | ---------------------------------------------------------------- |
| Cap Rate       | `noi/purchase_price`                                             |
| LTV            | `loan_amount/(underwritten_value, else purchase_price)`          |
| DSCR           | `noi/annual_debt_service`                                        |
| Debt Yield     | `noi/loan_amount`                                                |
| Price / Unit   | `purchase_price/total_units`                                     |
| Loan / Unit    | `loan_amount/total_units`                                        |
| Loan / SqFt    | `loan_amount/total_nra_sqft`                                     |
| Cash-on-Cash   | `(levered_cash_flow_y1, else noi-annual_debt_service)/equity_total` |

Exported expressions follow `MULTIFAMILY_PACK` (exported by `@uwmd/verify` and
`@uwmd/core`) and retain the existing reporting quantum. Native spreadsheet
recalculation is a separate numerical execution, subject to the limits below.

Each cell holds `ROUND(expression, round_to)`, and a missing input gives what
`evaluateCalc` gives: where the calc engine's result is null, the cell is
`#N/A`, never a fabricated zero or `#VALUE!` (#487). The inputs whose absence
makes the metric null are tested once, outside `ROUND`:

```
=IF(OR(ISBLANK(noi),ISBLANK(purchase_price)),NA(),ROUND((noi/purchase_price),6))
```

Any other input reads as `NA()` where it is used when its cell is blank, a
`null` branch is `NA()`, and a null test such as `underwritten_value != null`
is `NOT(OR(ISBLANK(underwritten_value),ISNA(underwritten_value)))`. Excel reads
a blank cell as zero, so a formula without these guards would turn a missing
input into a number the engine never computes.

### Native recalculation limits (accepted RFC 0088)

UWMD financial verification uses the exact pinned fdlibm power, exponential and
logarithm procedures. A spreadsheet's native recalculation of exported formulas
may differ from that procedure beyond about **eleven significant digits** and
may return errors on IEEE edge cases, including **subnormals and overflow**.
These are accepted export-contract limits, not defects requiring UWMD arithmetic
to change. Eleven digits is not a universal guarantee of native agreement.

**UWMD verifies the stated record, never the spreadsheet's recomputation.**
A workbook formula result is not a verification receipt or a replacement for
the stated record's values and source evidence. The export keeps its existing
financial expressions, associations and reporting quantization; no native
POWER/LN/EXP answer changes the pinned procedure, solver or record verdict.

The reproducible ten-control study uses named LibreOffice Calc24.2.7.2
420(Build:2):13 comparison agreements, one12-place POWER/ROUND discrepancy and
six #NUM! cells. A spreadsheet error is distinct from raw IEEE Infinity, an
existing public-calc refusal, or an internal Infinity producing a finite final
zero. See [accepted RFC0088](../../docs/rfcs/0088-pin-financial-numerical-procedures.md#spreadsheet-export-contract)
and the [recalculation controls](https://github.com/UWMD-OSP/UW-Markdown/tree/86a20fe5f95f56bad5766f559817b6f7ef102b2c/experiments/numerical-0088/spreadsheet-parity).

Editing a named-input cell updates its dependent formulas. When the statement
uses live subtotals, editing its income or expense detail updates those subtotals,
NOI and dependent metrics. Literal-source exceptions are described below.

The single-statement exporter checks that live subtotal formulas reproduce
the record's stated EGI, operating expenses and NOI. Conflicting detail refuses
export with `EXCEL-EMIT-PATH`; the exporter does not choose a new financial
authority or change document validation. A totals-only record retains its stated
aggregates as editable numeric inputs with cell notes and visible status text
explaining that detail edits do not recalculate them. A missing source subtotal is `#N/A` with
an explanatory note, rather than a replacement calculation or a fabricated zero.
When exact decimal detail matches but its binary sum differs from the stated
aggregate, export retains the original unrounded aggregate with a note. That
aggregate remains an editable input; subsequent detail edits do not update it.

**Several debt blocks (RFC 0066).** A deal can state `debt_structure` as
`_role: senior` and `_role: junior` blocks. The named inputs then hold the
senior tranche, which the pack's lender-side metrics declare. They are read by
the same Protocol §VIII.2 selection `evaluateCalc` uses.

- **No selectable block.** When a section has none (two `senior` blocks, say),
  its inputs are written as `#VALUE!` with a note, never left blank. Excel would
  read a blank as zero.
- **Refused metric.** A metric the calc engine refuses shows `#VALUE!` in the
  same place. Cash-on-cash refuses on a multi-tranche deal, because equity cash
  flow deducts all debt service.
- **Different block.** The export refuses with `EXCEL-EMIT-PATH` only when a
  metric would read a different block than its named input holds.

## Scope

Layouts cover all twelve builtin classes: multifamily, office, retail,
industrial, self-storage, hospitality, senior housing, student housing, land,
data center, manufactured housing and mixed-use. `fromWorkbook` and
`--import` recover editable section fragments from supported converter workbooks;
apply those through the starter editor (`applyEdit`) to preserve provenance.
Import accepts each statement subtotal in the form the exporter wrote it: the
live formula (never imported), a retained stated subtotal beside its status text
(imported as the editable input it is), or `#N/A` beside its status text (nothing
imported). Any other subtotal, such as a value typed over a formula, refuses with
`WORKBOOK-IMPORT-SUBTOTAL`. A mixed-use record with no component block states its
property NOI the same way instead of an empty consolidation formula. Extended custom
calculation workbooks explicitly refuse reverse import. `@uwmd/excel` is in
the release workflow from 0.9.14, which pairs with `@uwmd/core` 3.0.0. The
deprecated `0.3.0` on the registry is a stray 2026-08-16 hand publish pinned
to core 1.3.0; do not install it.

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
minus and arithmetic +, -, *, / are supported. Any other construct is refused:
- a function call, `is_calendar_date` included, with `EXCEL-EMIT-FN`, the code
  the core emitter uses for an unmapped builtin;
- anything else with `EXCEL-EMIT-PATH`.

Existing pack sheets are unchanged.
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
output is written. See the [context guide](../../docs/CALCULATION_CONTEXT.md)
for validation rules and examples.
