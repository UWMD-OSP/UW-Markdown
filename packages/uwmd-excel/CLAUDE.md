# CLAUDE.md — `@uwmd/excel`

`.uw.md → .xlsx` converter. Deep reference:
[`docs/wiki/08-tools.md`](../../docs/wiki/08-tools.md) (Excel section) and
[`docs/wiki/05-calc-packs.md`](../../docs/wiki/05-calc-packs.md). Root:
[`CLAUDE.md`](../../CLAUDE.md).

## What it does

Emits a **live multifamily workbook**: derived metrics ship as Excel **formulas,
not pre-computed values**, so the workbook stays in sync with the `@uwmd/core`
calc engine by construction. Depends on `@uwmd/core` + `exceljs`. CLI:
`uwmd-excel <input.uw.md> [-o output.xlsx]`.

## Layout (`src/`)

- `multifamily.ts` — **layout only**: which sections become which sheet rows
  (`INCOME_LINES`, `EXPENSE_LINES`), which inputs become workbook-scope named
  ranges (`NAMED_INPUTS`, `NAMED_RANGE_MAP`). `DERIVED_METRICS` is built by
  emitting Excel for every `MULTIFAMILY_PACK` calc — **metrics are defined in
  `@uwmd/core`'s pack, not here.**
- `toWorkbook.ts` — the generic ExcelJS writer.
- `cli.ts` / `index.ts` — entry points.

Sheets: **Underwriting** (header + inputs + derived metrics), **Operating
Statement** (income/expense, NOI as the `noi` named range), **Pipeline Log**.

## Invariants

- **Parity:** the Excel formula and the calc-engine value for each metric must
  agree to **6 decimals** (test in `@uwmd/core`'s `packs/packs.test.ts` and here).
- Adding a metric is a one-place change in `@uwmd/core`'s `packs/multifamily.ts`.
  It surfaces here automatically **only if** every input path has a named range
  (else `EXCEL-EMIT-PATH`) and its builtins map to Excel (else `EXCEL-EMIT-FN`).
  If you add a new input, add it to `NAMED_INPUTS` / `NAMED_RANGE_MAP`.
- ESM, `.js` import extensions, one `*.test.ts` per file.

## Commands

```bash
npm run build   # tsc
npm test        # vitest run
```
