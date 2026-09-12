# Native Excel period-binding verification — 2026-09-12

Result: **14 scenarios / 48 cell checks pass** in desktop Excel **16.0, build
20326**, using a new hidden COM instance with macros, events and link updates
disabled. Existing user workbooks were not opened or modified.

The disposable workbooks came from the real `toWorkbook` implementation and the
existing RFC 0041 conformance source, with explicit synthetic custom calculations.
Expected numeric values came from evaluateCalc at each declaration's existing
rounding boundary. Tests compare exact values; no new tolerance was introduced.

Coverage: all five period series, native sorting, numeric edits, real zero,
blank period and scalar inputs, nonnumeric text, duplicate and changed keys,
case-sensitive identity validation, explicit zero/null overrides, absolute monthly
lookup, negative half-away rounding, a $100M fractional spread, and native
save/reopen. #N/A and #VALUE! were checked as distinct deliberate error states.
All seven additional worksheet views were exported through Excel and inspected.

Reproduce from Windows with desktop Excel, after `npm run build`:

```powershell
node scripts/gen-excel-period-verification.mjs $env:TEMP/uwmd-period-verification
./scripts/verify-excel-periods.ps1 -Directory $env:TEMP/uwmd-period-verification
```

Use an empty disposable directory. The generator creates synthetic .xlsx files
and a manifest. The verifier changes only those copies, writes verification.json,
saves a recalculated copy and exports new sheets to PDF for visual review. It
closes its own Excel instance in a finally block. It does not install software,
alter dependencies, attach to an active workbook, or change user account settings.

The implementation uses the existing ExcelJS dependency because the subject of
verification is this repository's converter. No alternate authoring library was
used to replace or mask its generated workbook behavior.

Limitations: the tested engine/version is recorded above. Function compatibility
does not constitute a test of every Excel release or third-party spreadsheet
engine. Workbook identity guards support value edits and row permutations of the
exported key set; structural edits and deliberate helper tampering are outside
this first contract. Native tests are optional maintainer checks; CI covers
deterministic source, schema, serialization and command behavior.
