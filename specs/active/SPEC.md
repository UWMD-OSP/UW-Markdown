# RFC 0043 — contextual Excel period bindings

Status: implementation for owner review, stacked on RFC 0042 / PR #182.
The owner authorized continued roadmap development for review in the morning.

## Contract and authorized surfaces

Implement explicit custom-calculation export from parsed documents, numeric
arithmetic only, with contextual period binding across the five standard series.
Source identities are a closed snapshot: edit values and reorder rows; changes
to the period set require source edits and re-export. Lookup uses canonical
identity with whole-series duplicate/identity guards. Missing values are #N/A;
invalid series or nonnumeric inputs are #VALUE!, never zero. Source malformed or
duplicate periods fail before a workbook is returned. Overrides and variants
follow existing calc semantics. Existing pack-only exports remain unchanged.

Authorize Protocol 2.10.0, PeriodExcelBinding and PeriodColumnSnapshot public
types/schemas and matching protocol prose in one commit. Expose resolvePeriodColumn
from core/browser and contextual options in the Excel emitter. Add toWorkbook
options, an explicit --calculations CLI flag and export-only reverse-import
refusal. Do not add dependencies or change workspace links, package versions,
financial formulas, precision, period default rules, or existing pack layouts.

## Verification

Test all series, monthly/quarterly calendars, aliases, variants, overrides,
literal paths, missing/nonnumeric values, malformed/duplicate periods, binding
validation, serialization, CLI and import refusal. Recalculate generated files
in a separate hidden Excel instance: baseline, sorted rows, edits, missing/zero,
duplicate/invalid keys, null overrides, save/reopen. Compare supported numeric
results with evaluateCalc at the existing boundary; no new numeric tolerances.
Pass all repository gates, inspect generated views and publish a stacked PR.
No merge or release is part of the overnight development scope.
