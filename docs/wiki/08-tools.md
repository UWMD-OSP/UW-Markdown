# 08 — Tools

All tools depend on `@uwmd/core` and nothing else from this monorepo (the
dependency rule from [01 — Architecture](01-architecture.md)). The human-oriented
"which tool should I use" guide is [`docs/TOOLS.md`](../TOOLS.md); this page is the
developer view (where the code is, how it's built, what to know when changing it).

## `uwmd` CLI — `packages/uwmd-cli`

A thin npm package whose `bin/uwmd.mjs` is one line: `import '@uwmd/core/cli'`.
All logic is in `@uwmd/core`'s [`src/cli.ts`](../../packages/uwmd-core/src/cli.ts).

Commands (from `cli.ts`):

Command | Purpose
---|---
`parse <file>` | Parse → JSON (`--compact`, `--strict`)
`validate <file>` | Run validation (`--institution <cfg>`, `--json`)
`verify <file>` | Validate + integrity (hashes) + provenance (`--validate`/`--integrity`/`--policy`/`--json`)
`render <file>` | Render (`--format json\|csv\|chat\|summary`, or `--profile`, `--max-tokens`, `--output`)
`run <file> --agent <id>` | Tier-4 agent (`--context-only`, `--prompt`, `--live`, `--model`, `--api-key`, `--instructions`)
`edit <file> <op.json>` | Apply a Tier-2 `EditOperation` (`--actor`, `--source`, `--confidence`, …)
`calc <file> <calc.json\|formula>` | Evaluate a calc decl or inline formula (Tier-3)
`compact <file>` | Strip superseded blocks (`--dry-run`, `--output`)
`diff <a> <b>` | Section-by-section comparison
`init` | Scaffold a blank `.uw.md` (`--name`, `--address`, `--asset-class`, `--stage`, `--tier`)
`summary <file>` | Print quick metrics to terminal
`export <file>` | Export a lossless `.uw.json` sibling — provenance + history preserved (`--no-superseded`, `--stdout`, `--output`)
`formats` | List Lite, UWX, and registered model representations/media types (`--json`)
`convert <file> --to <format>` | Convert `.uw.md`, `.uwx.md`, verified model formats, or CSV bundles to `lite`, `uwx`, `uw-json`, `uw-xml`, or `uw-csv-bundle`
`migrate-source <file>` | Copy legacy structured `.uw.md` to byte-identical `.uwx.md` (`--dry-run`, `--force`)
`report <file>` | Render the §7.1 Lender Package / §7.2 Credit Memo HTML (`--tier`, `--prepared-by`, `--output`, `--stdout`)
`scope <file>` | Resolve every required input via the fallback cascade (triage view)
`refine <file>` | Rank gaps by value-of-information (`--targets`, `--top`, `--json`)
`layers` | List Bancroft agent layers

From a source checkout: `npm run cli -- <command> ...` (root script proxies to the
CLI bin). `run --live` needs `ANTHROPIC_API_KEY` (or `--api-key`).

## Batch collection indexer — `packages/uwmd-batch` (`@uwmd/batch` 0.1.0)

A local batch runner for a directory of canonical `.uw.md` deal files. It recursively
indexes every candidate, validates the required UW frontmatter envelope, records each
deal's semantic digest, and writes deterministic `uwmd-collection.json` and CSV
projections:

```bash
npx @uwmd/batch deals --out batch-output
```

The output is intentionally a read model, not a new storage protocol: databases or
other structured systems may import it while `.uw.md` remains the canonical record.
Invalid or non-UW files are included with an error instead of halting the batch.
## Excel converter — `packages/uwmd-excel` (`@uwmd/excel` 0.1.0)

`.uw.md → .xlsx`. Depends on `@uwmd/core` + `exceljs`. CLI bin:
`uwmd-excel <input.uw.md> [-o output.xlsx]`.

Key design: the workbook ships **formulas, not pre-computed values**, so it stays
in sync with the calc engine by construction. The engine (`toWorkbook.ts`) is
generic; each asset class supplies a `WorkbookLayout` (`src/layout.ts`) selected
by `frontmatter.asset_class` via the registry (`src/layouts.ts`,
`getLayoutForAssetClass`). Supported: **multifamily, office, retail, industrial,
self-storage** (`MULTIFAMILY_LAYOUT`/`OFFICE_LAYOUT`/`RETAIL_LAYOUT`/
`INDUSTRIAL_LAYOUT`/`SELF_STORAGE_LAYOUT`); an
unsupported class throws `UnsupportedAssetClassError`.

Layout:
- **Underwriting** sheet — header (deal name/address) + an inputs block (each
  `NamedInput` cell a workbook-scope **named range**) + a derived-metrics block
  whose formulas reference those names.
- **Operating Statement** sheet — income/expense line items. Income deduction
  lines carry `sign: -1` (vacancy etc. are stored positive), so `EGI =
  SUM(income lines)` foots to the stored `effective_gross_income` and
  `NOI = EGI − total opex` foots to the stored `net_operating_income`. EGI, total
  opex, and NOI are exposed as the `effective_gross_income`,
  `total_operating_expenses`, and `noi` named ranges.
- **Pipeline Log** sheet — flat audit table of `pipeline_log` entries.

A `WorkbookLayout` is just `{ assetClass, pack, incomeLines, expenseLines,
namedInputs }`. The engine derives the calc-path → named-range map
(`buildNamedRangeMap`) and the derived-metrics block (`buildDerivedMetrics`,
emitting `emitExcelFormula` for every pack calc) **from the layout**, so the
formulas and the named ranges the engine creates can't drift. **Adding a metric
is a one-place change in `@uwmd/core`'s pack** — it surfaces automatically,
provided its inputs have named ranges (else `EXCEL-EMIT-PATH`) and its builtins
map to Excel (else `EXCEL-EMIT-FN`).

> **Parity is computed, not assumed.** `toWorkbook.test.ts` builds each example
> deal's workbook, asserts the operating statement **foots** (signed income →
> stored EGI, expenses → stored opex, EGI − opex → stored NOI), and evaluates
> every derived-metric formula against the workbook's named-range values,
> comparing to `evaluateCalc()` to 6 decimals. (An earlier converter summed
> income without signs — double-counting vacancy — and the old test missed it
> because it only checked formula *text*. Adding a new class's example deal must
> keep its operating statement footing.)

Build: `tsc`. Test: `vitest run`.

## Report PDF pipeline — `packages/uwmd-report` (`@uwmd/report` 0.1.0)

`.uw.md → .pdf` for the lender package / credit memo. The HTML is produced by
`@uwmd/core`'s `renderReportHtml` (deterministic, §7.1/§7.2); this package only
adds the headless-Chromium print step. CLI bin:
`uwmd-report <input.uw.md> [-o out.pdf] [--tier screener|analyst] [--format pdf|html] [--prepared-by <name>] [--browser <path>]`.
Programmatic API: `generateReport(parsed, opts)`.

Key design: depends on **`playwright-core`** (no bundled browser download).
Browser resolution order: explicit `--browser` / `UWMD_REPORT_BROWSER` env →
system Chrome channel → system Edge channel → a Playwright-managed Chromium if
the user ran `playwright install`. No browser → typed `BrowserNotFoundError`
with instructions; `--format html` always works browser-free (the print
stylesheet is embedded, so printing that HTML from any browser yields the same
PDF). `preferCSSPageSize` is on and Playwright margins are zeroed — page layout
is owned entirely by `REPORT_CSS`'s `@page`/`@media print` rules in core.

Build: `tsc`. Test: `vitest run` (the PDF test self-skips when no Chromium-based
browser is present).

## Web viewer — `tools/web-viewer`

Single-file `index.html`, under 500 LOC, no build step. Drag-drop a `.uw.md` and
it renders (embeds a minimal Parser + Renderer). Tier-1 demo. Skip it for editing
or calc.

## Web editor — `tools/web-editor` (`@uwmd/web-editor` 0.4.0, private)

React 18 + Tailwind CSS 4 (Vite). Embeds `@uwmd/core/browser` (parser, validator,
Tier-2 edit dispatcher, Tier-3 calc engine, report renderer, init scaffolder,
cascade/refinement/gaps intelligence, calc dependency introspection). Five tabs:

- **Editor** — sidebar with per-section validation badges; an **edit-provenance
  bar** (`EditModeBar`) controlling what gets stamped on `_meta`
  (actor/source/confidence/notes/human-review) and whether section edits
  **replace in place or append a superseding version**; frontmatter form;
  per-section numeric inputs (curated allow-list in `src/catalog.ts`, ~30
  fields); **editable rent-roll tables** with add/remove rows (unit-mix or
  tenant); an **NOI line-item editor** (wrapper-aware `{value,…}` editing via
  `setNumeric`); an **assumptions editor** that captures override rationale
  (flips `is_overridden`, records `original_value`); a **generic field editor**
  exposing every scalar leaf (long strings → textareas, so narrative fields like
  `investment_thesis`/`risk_narrative` are editable); a **clickable calc strip**
  where each metric opens `CalcDetail` (formula + resolved inputs + result/error);
  block `_meta` chips, raw-JSON view, superseded-version history, and pipeline log.
- **Intelligence** — the differentiated surface. **Scope** resolves every
  required input through the fallback cascade (`resolveValue`) showing value +
  source step (in-file / class default / fallback) + published range; **Refine**
  ranks value-of-information gaps (`rankGaps`) by how much each unknown widens
  the deal's metrics, with affected-output ranges and a suggested question.
- **Report** — the `renderReportHtml` §7.1/§7.2 package, live in a sandboxed
  iframe, with tier toggle, Download HTML, and Print/PDF.
- **Diff** — section + frontmatter changes since the file was loaded / last saved
  (core `diff()`), the "what did I touch this session" view.
- **Source** — read-only canonical bytes (exactly what Download writes), with copy.

Plus: snapshot-based **undo/redo** (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z), **Ctrl+S**
download, and a **New Deal** dialog (`generateBlankUWFile`).

All mutations flow through `src/edits.ts` → `applyEdit()` → re-parse (the single
chokepoint; React state just holds the result). `edits.ts` threads the active
`EditSettings` into the `EditContext` and promotes `section_replace` →
`section_supersede` in append mode. Files: `src/main.tsx`, `src/App.tsx`
(shell/tabs/shortcuts), `src/state.ts` (`useDeal` + undo stacks + edit
settings), `src/edits.ts`, `src/catalog.ts` (allow-lists + wrapper-aware
`getNumeric`/`setNumeric`), `src/components/*` (Toolbar, Sidebar, EditModeBar,
CalcDashboard, CalcDetail, SectionView, FrontmatterEditor, RentRollTable,
NoiLineItems, AssumptionsEditor, GenericFieldEditor, HistoryView, Intelligence,
DiffView, SourceView, NewDealDialog, PipelineLog, ValidationPanel, ReportPreview).
Build: `tsc --noEmit && vite build`. TS uses `Bundler` resolution + DOM libs +
`react-jsx`; **must import from `@uwmd/core/browser`** (not `@uwmd/core`) to
keep the Anthropic SDK out of the bundle. The intelligence + introspection
functions (`resolveValue`, `rankGaps`, `inferGaps`, `getAssetClassDefaults`,
`getExprDependencies`, `extractDependencyGraph`, …) are browser-safe and are
now exported from `@uwmd/core/browser`.

## VS Code extension — `tools/vscode-uwmd` (`vscode-uwmd` 0.1.0)

Authoring extension: syntax highlighting (`syntaxes/uwmd.tmLanguage.json` —
YAML frontmatter + Markdown + embedded JSON), section folding, document outline,
on-save validation diagnostics tied to `BUILTIN_REMEDIATIONS`. Entry:
`src/extension.ts`; `activationEvents: onLanguage:uwmd`. Bundled with esbuild
(`esbuild.mjs`); package with `vsce package`. Not yet on the marketplace.

## Docs site — `tools/docs-site` (VitePress)

The **published, human-facing** documentation site. A prebuild step
(`scripts/prebuild.mjs`) copies repo-root markdown (spec, governance, RFCs,
schemas, examples) into the site tree and rewrites links — repo root stays the
single source of truth. Config: `.vitepress/config.ts`. Dev: `npm run dev`;
build: `npm run build`.

> This wiki (`docs/wiki/`) is deliberately **not** wired into the docs-site nav —
> it is internal dev/agent documentation, not part of the published standard.
> Keep it that way unless the decision changes.
