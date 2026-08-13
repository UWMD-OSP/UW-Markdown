---
title: "Cookbook"
---

# UW Markdown cookbook

These short recipes use the reference implementation from a source checkout.
The commands work unchanged with the published CLI when `uwmd` replaces
`npm run cli --`.

## Start a structured underwriting record

Create a scaffold, then validate it before adding source facts. The generator
creates a **UWX** working record; `.uw.md` is reserved for readable Lite
summaries.

```bash
npm run cli -- init --name "Canyon Apartments" --asset-class multifamily --output canyon.uwx.md
npm run cli -- validate canyon.uwx.md
```

The initial validation may contain expected incompleteness warnings. Fill fields
from source documents, preserve each block's `_meta` provenance, and use an
editor or the Tier-2 `edit` command rather than rebuilding the file as text.

## Inspect an existing deal

```bash
npm run cli -- summary examples/Parkview-Apts-Glendale-AZ.uw.md
npm run cli -- validate examples/Parkview-Apts-Glendale-AZ.uw.md --json
npm run cli -- render examples/Parkview-Apts-Glendale-AZ.uw.md --format summary
```

`summary` is a quick screen. `validate` reports the structured rule codes and
canonical remediation text. `render` produces a reviewable Tier-1 view without
changing the source file.

## Evaluate a formula without giving an agent control of the math

The calc engine owns financial math. Rates are fractions: `0.0551` means 5.51%.

```bash
npm run cli -- calc examples/Parkview-Apts-Glendale-AZ.uw.md "pmt(0.0551 / 12, 360, 1000000)"
```

For a named metric, add a `ModuleCalcDecl` to the relevant asset-class pack.
The pack drives both the deterministic calc engine and Excel formula emission;
see [Calc conventions](/guide/calc-conventions).

## Export a workbook for review

```bash
npm --prefix packages/uwmd-excel run build
node packages/uwmd-excel/dist/cli.js examples/Parkview-Apts-Glendale-AZ.uw.md -o parkview.xlsx
```

The workbook is a live projection: input cells and operating-statement line
items are carried out, while derived metrics are Excel formulas generated from
the same pack. Keep the UWX/Markdown source as the canonical record.

## Issue and verify a receipt

```bash
npm run cli -- receipt issue examples/Parkview-Apts-Glendale-AZ.uw.md --issued-at 2026-08-12T00:00:00Z --output parkview.receipt.json
npm run cli -- receipt verify examples/Parkview-Apts-Glendale-AZ.uw.md parkview.receipt.json
```

A verified receipt proves that the unchanged record produces the stated pack
outputs. It does not prove the input facts are complete, correct, audited, or
approved. See [Verification receipts](/guide/receipts).

## Convert Lite and UWX

```bash
npm run cli -- convert conformance/lite/fixtures/01-minimal.uw.md --to uwx --output deal.uwx.md
npm run cli -- convert conformance/receipts/issue/01-uwx-multifamily/deal.uwx.md --to lite --output deal.uw.md --projection-report lite-losses.json
```

The Lite-to-UWX direction compiles the supported deal summary into a complete
working record. The second command projects a complete structured record into
Lite. UWX-to-Lite can omit advanced paths; always review the emitted projection
report before treating the Lite output as a complete representation.

## Add a metric to a pack

1. Add the deterministic `ModuleCalcDecl` in the relevant core pack.
2. Ensure every field path has a workbook named range in that class's Excel
   layout, or Excel export will reject it with `EXCEL-EMIT-PATH`.
3. Use only Excel-mappable builtins in pack formulas; `coalesce` and null-aware
   `avg` intentionally reject with `EXCEL-EMIT-FN`.
4. Add a pack test and confirm Excel-to-engine parity to six decimals.

Pack and asset-class changes require normal project coordination; they are not
edits to a single deal file.
