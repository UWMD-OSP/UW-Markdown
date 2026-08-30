---
rfc: 0007
title: Sensitivity tables as a first-class calc primitive
status: implemented
author: jared
created: 2026-04-27
affects:
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0007: Sensitivity tables as a first-class calc primitive

## Summary

Promote two-axis sensitivity grids from "something each consumer reimplements ad-hoc" to a declarative builtin in the Tier-3 calc engine. A new `sensitivity_table()` builtin takes a base formula expression and two axis specifications, and returns a structured grid result that consumers (web editor, Excel emitter, agent host) can render directly without recomputing.

## Motivation

Sensitivity analysis is the single most-requested calc capability after the basic ratios. Today, the only way to produce one is to emit N×M `custom_calculations` blocks — one per cell — which:

- Bloats the file (a 6×6 grid is 36 calc blocks).
- Hides the structure: a reader cannot tell from the document that those 36 calcs share an axis design.
- Doesn't round-trip through the Excel emitter cleanly: each cell becomes its own formula instead of one DATA TABLE.
- Doesn't compose with the supersede model: changing one input forces re-authoring 36 blocks.

Concretely, the existing Excel converter (`@uwmd/excel`) and the web editor's calc panel both have ad-hoc grid renderers that re-derive the axis structure from the calc IDs. That implicit contract is brittle and untestable.

## Proposed change

### Calc engine

Add a new builtin to `@uwmd/core` (`packages/uwmd-core/src/calc/builtins.ts`):

```
sensitivity_table(
  base_expr: <expression string>,
  row_axis:  { variable: <ident path>, values: [n, n, ...] },
  col_axis:  { variable: <ident path>, values: [n, n, ...] }
) → { rows: [...], cols: [...], grid: [[CalcValue, ...], ...] }
```

The semantics:

1. For each `(row_value, col_value)` pair, evaluate `base_expr` in a context where `row_axis.variable` resolves to `row_value` and `col_axis.variable` resolves to `col_value`. All other identifiers resolve normally from `parsed`.
2. Collect results into `grid[r][c]`. Cells that throw `CalcError` are recorded as `null` with the error code captured in a parallel `errors[r][c]` array.
3. Result is a structured object — not a scalar — so this is the first builtin whose return type extends beyond `number | string | boolean | null`.

### Protocol spec

Add §VIII.6 "Structured calc results" to `spec/UW_PROTOCOL_v1.md` defining the shape of non-scalar calc returns. Update §VIII.3 (builtins table) to include `sensitivity_table` with normative semantics.

### Custom calculations

Allow `custom_calculations[].declaration` to specify `expects: "table"` instead of the default `"scalar"`. The host validates the result shape against the declaration.

## Compatibility analysis

- **Existing `.uw.md` files** — unaffected. The new builtin is opt-in; no existing files use the name.
- **Tier-1 Reader** — unaffected; readers don't evaluate calcs.
- **Tier-2 Editor** — unaffected; editors that don't render tables can ignore the new shape.
- **Tier-3 Calc Host** — additive. Hosts that don't implement `sensitivity_table` MUST return a typed `CALC-RESOLVE-001` error rather than crash. The protocol spec needs to declare this fallback.
- **Tier-4 Agent Host** — unaffected.
- **Modules** — modules that declare custom calcs continue to work; if a module declares `sensitivity_table`-shaped calcs, it must declare `expects: "table"`.

No existing files break.

## Conformance impact

Existing fixtures: none need to change.

New Tier-3 fixtures to add (under `conformance/tier-3-calc-host/fixtures/`):

- `sensitivity-cap-rate-x-rent-growth/` — 5×5 grid varying exit cap rate against year-1 rent growth, base expression returns levered IRR.
- `sensitivity-with-error-cell/` — grid where one cell triggers `CALC-DIV-ZERO`; verify the result records the error in `errors[r][c]` rather than failing the whole table.
- `sensitivity-axis-mismatch/` — declared `expects: "scalar"` but builtin returns table → host must surface a typed error.

## Reference implementation

- **Files affected:**
  - `packages/uwmd-core/src/calc/builtins.ts` — new builtin implementation.
  - `packages/uwmd-core/src/calc/runner.ts` — handle non-scalar return.
  - `packages/uwmd-core/src/protocol.ts` — `CalcResult` type union with table shape.
  - `packages/uwmd-core/src/packs/excel-emit.ts` — emit `TABLE(...)` Excel data table syntax (or fall back to N×M cell formulas behind a flag).
- **API surface:**
  - New `SensitivityResult` type exported from `@uwmd/core`.
  - `evaluateCalc` return type extended to `CalcResult | SensitivityResult`.
- **Test plan:**
  - Unit tests for the builtin: axis lookup, cell evaluation, error capture.
  - Property tests: `sensitivity_table(expr, ...)` produces a grid whose dimensions equal `len(row_values) × len(col_values)`.
  - Excel-parity test: emitting a 3×3 table to Excel and reading it back via the existing parity harness produces matching cells.

## Implementation notes (deviations from the proposal)

Shipped 2026-08-27 as protocol §VIII.7. Three substantive departures,
and one correction to the motivation.

**1. A declaration, not a builtin — the central change.** The proposal
is `sensitivity_table(base_expr, {variable, values}, {variable, values})`
inside the §VIII.1 grammar. That grammar has no object literals and no
array literals, and its `string` production is a value rather than a
program. Implementing the proposal therefore means three extensions to
the sandbox, one of which makes a string argument *executable*.

The sandbox's narrowness is the reason it can be evaluated on untrusted
input at all — and the axis data is already sitting in JSON one level
up, so the grammar buys nothing by reaching it. What shipped is a JSON
`SensitivityDecl` (which is where every other calc declaration already
lives) with an ordinary safe expression as `base_formula`. **The grammar
is unchanged.**

This is not the RFC's rejected alternative #2 either: that was "a new
top-level *section* type", rejected for making calc power depend on the
section registry. A declaration shape alongside `ModuleCalcDecl` depends
on nothing.

**2. The result never travels through `CalcResult.value`.** The RFC
proposed extending `evaluateCalc`'s return type to
`CalcResult | SensitivityResult`, making the value union non-scalar for
the first time. That union is pinned by RFC 0016 receipts, rendered by
the CLI, and emitted from by Excel; widening it would break three
consumers for a feature none of them asked to carry. `SensitivityResult`
is its own type from `evaluateSensitivity`, and `CalcResult.value` stays
`number | string | boolean | null`.

**3. Overrides are a general mechanism, and they are the actual
primitive.** `CalcEvaluationContext.overrides` shadows lookup by full
dotted path. Two properties turned out to be worth making normative:
overrides *shadow* and never write (a sweep that mutated the document
would silently change the deal — pinned by a conformance scenario), and
a `null` override means "treat this path as absent", distinct from
having no override. Scenario sweeps and stress tests need the same
mechanism, so it is not sensitivity-specific.

`CALC-SENS-004` (both axes on one variable) is new beyond the RFC. It is
not a redundancy but a trap: the second override silently wins for every
cell, producing a grid whose rows are identical and whose reader has no
way to see why.

**4. The motivation's claim about existing renderers is not true of this
codebase.** The RFC says "the existing Excel converter (`@uwmd/excel`)
and the web editor's calc panel both have ad-hoc grid renderers that
re-derive the axis structure from the calc IDs." Neither does — there is
no sensitivity code in either, and never was. The rest of the motivation
stands on its own (N×M calc blocks bloat the document and hide the axis
design), but that specific claim should not be repeated.

Consequently the Excel emit work is **deferred**, and deferring it costs
nothing today: there is no ad-hoc implementation to replace, and the
RFC's own unresolved question already leaned toward N×M formulas over
native DATA TABLE. `SensitivityResult` gives an emitter the grid
structure whenever one is written.

**5. Conformance lives in `conformance/sensitivity/`**, a named suite,
not under `tier-3-calc-host/fixtures/`. A sensitivity declaration is not
a `ModuleCalcDecl` and its result is not a `CalcResult`, so filing it
there would force both the tier-3 runner and the RFC 0004 case generator
— which read that directory — to branch on fixture shape. Five
scenarios, including one that asserts the document is unchanged after a
sweep.

The RFC's remaining unresolved questions: the 256-cell bound is adopted
as suggested (plus a 64-per-axis bound, so a 1×256 strip is no cheaper
than a square); cube tables stay out of scope.

## Alternatives considered

1. **Keep N×M custom_calculations.** The status quo. Worse because: bloats the document, doesn't survive supersede cleanly, requires every consumer to re-derive grid structure from naming conventions.

2. **Define sensitivity tables as a new top-level section type instead of a builtin.** Worse because: makes the calc engine's expressive power dependent on the section registry. The builtin approach keeps the surface narrow and lets sensitivity grids appear inline anywhere a calc can.

3. **Defer to view-model layer (renderer-only).** Worse because: doesn't help the Excel emitter, which needs the grid structure at emit time, not at render time. Also doesn't help the web editor's calc-aware UI.

## Unresolved questions

- Excel emit strategy: native Excel DATA TABLE (which requires a specific cell layout that constrains worksheet design) vs. emitting N×M individual formulas with consistent named ranges. Probably emit individual formulas for v1 and add native DATA TABLE support behind an option later.
- Should three-axis (cube) tables be supported? Defer to a follow-up RFC if the use case emerges.
- Should the host enforce a max grid size? Suggest 256 cells for v1 to keep CALC-LIMIT bounds predictable.

## Prior art

- Excel's WhatIf Data Tables (one and two variable) — directly inspires this design.
- Argus uses a similar two-axis sensitivity matrix at the cash-flow level.
- Tableau's parameter sweeps share the (parameter, value-set) shape but are visualization-bound rather than calc-bound.
