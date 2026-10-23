# 08 — Tools

All tools depend on the reference library — `@uwmd/core`, or only
`@uwmd/verify` when a tool reads and verifies but never edits, renders or
emits (RFC 0083) — and nothing else from this monorepo (the dependency rule
from [01 — Architecture](01-architecture.md)). Today `@uwmd/batch`,
`@uwmd/lake` and the VS Code extension build on `@uwmd/verify`;
`@uwmd/signing` uses it for the signing payloads and keeps core for the
capability-token types; the CLI, Excel, report and the web editor build on
`@uwmd/core`, which re-exports everything verify exports. The human-oriented
"which tool should I use" guide is [`docs/TOOLS.md`](../TOOLS.md); this page is the
developer view (where the code is, how it's built, what to know when changing it).

The editor's new-deal address placeholder is explicitly fictional. The reviewed
Parkview example is `parkview-reviewed.uwx.md` and its narrative key is
`review_gate_note`; neither name implies a hosted agent pipeline.

## `uwmd` CLI — `packages/uwmd-cli`

Summary, chat and CSV fill absent quick-metric summaries through the existing
class pack and canonical statement homes. Authored values (including explicit
nulls) win, and rendering never writes the record. Missing values carry no
currency/unit suffix; CSV uses two decimal percent and three decimal DSCR display.

Reading commands use core's Node-only `loadUWSourceFile`: UWX keeps its raw
bytes, Lite compiles through its bridge, and JSON/XML/CSV decode through the
codec registry. CSV reconstruction preserves own JSON content members, including
prototype-named keys, while placing authoritative metadata first. Byte-preserving
source writers require UWX and report
`SOURCE_EDIT_UNSUPPORTED` otherwise. Document signatures authenticate only the
original UWX source; other representations receive `INT-14`.

A thin npm package whose `bin/uwmd.mjs` is one line: `import '@uwmd/core/cli'`.
All logic is in `@uwmd/core`'s [`src/cli.ts`](../../packages/uwmd-core/src/cli.ts).

Commands (from `cli.ts`):

Command | Purpose
---|---
`parse <file>` | Parse → JSON (`--compact`, `--strict`)
`validate <file>` | Run validation (`--institution <cfg>`, `--json`)
`verify <file>` | Validate + recompute stated metrics + integrity (hashes) + provenance (`--validate`/`--integrity`/`--policy`/`--json`). The validate phase applies Protocol §II.2 item 2: a stated metric that disagrees with its recomputation fails the command (exit 1), while one whose inputs are absent is reported `unverifiable` and does not; `--json` carries the report as `stated_metrics`; `--signing --keystore=<store>` checks block signatures, and `--document-signature=<artifact> --keystore=<store>` requires an authenticated document snapshot (RFC 0084; both via the optional `@uwmd/signing`)
`sign-document <file> --key=<signer.json> --out=<signature.json>` | Write a detached document snapshot signature (RFC 0084; `--signed-at=<iso>`). The output must be a new file distinct from the source and key
`render <file>` | Render (`--format json\|csv\|chat\|summary`, or `--profile`, `--max-tokens`, `--output`)
`edit <file> <op.json>` | Apply an `EditOperation` with the starter editor (`--actor`, `--source`, `--confidence`, …)
`calc <file> <calc.json\|formula>` | Evaluate a calc decl or inline formula
`diff <a> <b>` | Section-by-section comparison
`init` | Scaffold a blank `.uwx.md` (`--name`, `--address`, `--asset-class`, `--stage`, `--scenario`, `--tier`, `--output`); names the file with `--output` only and refuses a file argument; refuses to overwrite an existing file; `--scenario` takes a standard business plan or reverse-DNS extension; `--asset-subtype` carries the open subtype, including multifamily `build_to_rent` (RFC 0072)
`summary <file>` | Print quick metrics to terminal
`export <file>` | Export a lossless `.uw.json` sibling — provenance + history preserved (`--stdout`, `--output`)
`formats` | List Lite, UWX, and registered model representations/media types (`--json`)
`convert <file> --to <format>` | Convert `.uw.md`, `.uwx.md`, verified model formats, or CSV bundles to `lite`, `uwx`, `uw-json`, `uw-xml`, or `uw-csv-bundle`
`report <file>` | Render the §7.1 Lender Package / §7.2 Credit Memo HTML ([renderer reference](../starter/rendering.md); `--tier`, `--prepared-by`, `--output`, `--stdout`)
`scope <file>` | Resolve every required input via the fallback cascade (triage view)
`refine <file>` | Rank gaps by value-of-information (`--targets`, `--top`, `--json`)
`receipt issue <file>` | Issue a detached verification receipt (`--output`, `--issued-at`, `--stdout`)
`receipt verify <file> <receipt.json>` | Verify a receipt (`--json`; exits 0 verified, 1 failed, 3 unverifiable)
`compose <file> --externalize <s>` | Split a collection section into `.uwpart.md` fragments (`--collection-key`, `--collection-path`, `--out-dir`, `--in-place`, `--dry-run`)
`resolve <file>` | Reassemble externalized sections from a parts directory (`--parts`, `--output`, `--json`; exits 1 unresolved)

Chat rendering labels each annual DCF row with its stated `year`, preserving
source order, duplicate years and sparse years. An absent year displays `n/a`;
the renderer does not infer a year from array position. This display convention
does not alter period validation, period lookup or CC-06's existing cross-check.

Every command accepts a closed set of flags: `COMMAND_FLAGS` in
[`cli-args.ts`](../../packages/uwmd-core/src/cli-args.ts), keyed by command or
by `command subcommand`. The router refuses a flag outside the set with exit 1,
naming the flag and the command (`uwmd verify: unknown flag
--document-signture. Accepted flags: …`), before it reads any file. This is
unreleased: `main` has it, but published CLI 4.2.0 and earlier silently ignore
an unknown flag, so there a misspelled security flag looks like a passed check. `verify-cash-flows` parses its own arguments and
refuses under its typed JSON contract instead. A flag a usage string promises
must be in the table (`cli-args.test.ts` holds the two together), so add a new
flag to both.

The three 4.2.0 aliases (`validate --stage`, `export --compact`,
`compose --parts`) were removed under the prelaunch no-compatibility rule
(#412). They are unknown flags now and exit 1 like any other: use
`stage_readiness` in the report, full-record export and `--out-dir`.

From a source checkout: `npm run cli -- <command> ...` (root script proxies to the
CLI bin).

An unknown command exits 1 with `uwmd: unknown command '<name>'` on stderr
before it reads or writes any file; only no command, `--help`, `-h` or `help`
prints the command list (exit 0). That covers the removed `uwmd run`: the
toolkit hosts no agents, and a host that runs its own writes through
`uwmd edit --agent-id/--agent-version` or the writer API.

### Validation, completeness and receipt reporting

Core/CLI 2.18.0 carries these CLI reporting changes.
`validate` labels its validation result separately from **Stage Readiness
(workflow completeness)**, the existing `stage_readiness` section/field checks.
An incomplete later stage is informational; it does not by itself make a clean
document invalid. Existing issue severities remain authoritative. Skipped
cross-checks retain their reason counts and are not claimed to agree. Lite
syntax validation explicitly leaves workflow and cross-checks unchecked.

`validate` does not resolve receipt-pack metrics or verify an earlier receipt.
Those lines say **not checked**. `receipt issue` reports **Receipt issued**,
metric completeness, computed count, uncomputed calc IDs, canonicalization and
document/results hashes. Partial metric coverage still produces the pack's
complete result/status set. Missing inputs differ from verification failure;
no asset equity allocation is inferred from portfolio capitalization.

Issuance refusals print the existing `ReceiptError` code and available calc
message/pointer, including unresolved metric, section and variants. A missing
pack remains `RCP_PACK_UNRESOLVED`; no other pack is substituted. `receipt verify`
labels the independent verification verdict and retains expected/actual mismatch
details. JSON modes and `receipt issue --stdout` remain payload-only; schemas,
codes, result semantics and exit behavior are unchanged. A failed
recomputation's diagnostic `message` text, including in `receipt verify
--json`, now carries the calc message and pointer.

**Terminology boundary:** Stage Readiness and `stage_readiness` are public,
spec-described terms, so this change adds an explanation rather than renaming
the contract. A future terminology RFC could consider “workflow completeness”
while deciding compatibility for the public field and documentation together.
See [receipt semantics](../UW_RECEIPTS.md#validation-completeness-and-hashes).

### Cash-flow metric verification

`verify-cash-flows <file> [--variant <name>] [--json]` uses the CLI-only
`src/cli-cash-flows.ts` boundary and existing `verifyCashFlowSeries`. Selection
uses `periodSection`; strict parsing and payload guards precede metric checks.
No claims is distinct from verified claims. Exit codes are 0 verified, 1
failed/input refusal, 3 unverifiable/no claims. Nothing writes to the source.
Tests cover both the helper and actual CLI subprocesses. The command shipped in
core/CLI 2.10.0. See the
[workflow](../PROPERTY_CASH_FLOW_WORKFLOW.md#check-stated-cash-flow-metrics-from-the-cli).

### Calculation context

`calc` and `refine` accept `--calc-context <JSON file>`. The shared
`parseCalculationContext` helper in core validates only the existing
`sectionVariants`/`overrides` options; it is exported from core and browser.
Variants select period dependencies only. Exact scalar/period override keys keep
zero and null intact. The refine CLI refuses ordinary scalar override keys because
`rankGaps.periodContext` only consumes period overrides. The Excel CLI requires
`--calculations` alongside context and applies it only to additional calculations.
Source documents are never edited by these options. See the
[source guide](../CALCULATION_CONTEXT.md) for commands,
validation errors and publication status.

## Batch collection indexer — `packages/uwmd-batch` (`@uwmd/batch`, published since 0.8.0)

A local batch runner for a directory of canonical `.uw.md` / `.uwx.md` deal files. It
recursively indexes every candidate, validates the required UW frontmatter envelope,
records each deal's semantic digest, and writes deterministic `uwmd-collection.json`
and CSV projections:

```bash
npx @uwmd/batch deals --out batch-output --facts
```

`--facts` additionally emits `uwmd-facts.jsonl` — the corpus fact table: one line per
JSON fact per deal, the normative `block_values` row (via `@uwmd/verify`'s
`flattenEnvelopeBlockValues`, never re-implemented; batch depends only on verify) prefixed with deal identity
(`path`, `deal_id`, `asset_class`, `semantic_digest`, `valid`) — plus a manifest with
counts and a `deals_skipped` list. See [`docs/DATA_LAKE.md`](../DATA_LAKE.md) for the
full lake pipeline.

The output is intentionally a read model, not a new storage protocol: databases or
other structured systems may import it while `.uw.md` remains the canonical record.
Invalid or non-UW files are included with an error instead of halting the batch.
## PostgreSQL lake adapter — `packages/uwmd-lake` (`@uwmd/lake`)

The RFC 0049 reference adapter. It is a **host-side integration**, not part of the
protocol: it reads canonical outputs the standard already produces and plans
idempotent SQL that an adopter runs with their own client. There is no database
driver in its dependency tree and database availability is never part of
validation. It depends only on `@uwmd/verify` (RFC 0083).

```ts
await client.query(postgresLakeSchema('uwmd_lake'), []);
const { document, facts } = await lakeInputFromEnvelope(envelope, { path, deal_id });
await executeLakeLoad(await planLakeLoad({ documents: [document], facts, schema: 'uwmd_lake' }), client);
```

Six tables — `uw_documents`, `uw_facts`, `uw_receipts`, `uw_packages`,
`uw_package_members`, `uw_source_evidence`. Each stores the raw canonical JSON in
`jsonb` **and** typed shadow columns beside it. The split is the point:

- **canonical** — `envelope`, `value_json`, `receipt`, `manifest`;
- **projection** — everything else, which exists so a join or filter can use an
  index. A query that disagrees with the calc engine is a query against the
  projection.

Identity is always a digest, never a path: document by semantic digest, fact by
`(semantic_digest, block_ref, scope, pointer)`, package member by byte digest,
receipt by the canonical hash of the receipt JSON. Every statement is
`INSERT … ON CONFLICT … DO UPDATE`, so a re-load is a no-op and a *changed*
document becomes a new row rather than overwriting the old one.

Inputs come from what an adopter already has: an envelope
(`lakeInputFromEnvelope`), a CSV bundle's `block_values.csv`
(`readBlockValuesCSV`), or `@uwmd/batch`'s `uwmd-facts.jsonl`
(`readBatchFactJSONL`).

Deliberate refusals: `uw_source_evidence` takes identity and status only and
rejects any bytes-bearing field at any depth (`LAKE_SOURCE_BYTES`); a
numeric-looking *string* never lands in `value_number`; the adapter never opens
the transaction, so a partial load is visible rather than hidden. No live
PostgreSQL instance is exercised by the test suite — a real load is an adopter
integration step.

## Hospitality and data center

Both are builtin classes in `@uwmd/core` (RFC 0080): sections, calculations,
`CC-HOSP-NN` / `CC-DC-NN` rules, packs, Excel layouts and defaults, like every
other builtin. `@uwmd/module-hospitality` and `@uwmd/module-data-center` were
compatibility shells whose final 0.2.0 was published and deprecated on npm on
2026-10-11; RFC 0081 Phase 4 deleted both packages from the repository.

## Signing — `packages/uwmd-signing` (`@uwmd/signing`; see VERSIONS.md)

Block and receipt signatures (RFC 0010, protocol §V.11). Separate from
`@uwmd/verify` and `@uwmd/core` so the library keeps its zero-crypto guarantee: reading,
validating, editing, and computing over a `.uw.md` never require cryptography,
and signed blocks are for regulated data rooms and multi-party deal flow, not
the everyday case.

```ts
import { verifyChain } from '@uwmd/core';
import { createBlockSignatureVerifier, loadKeyStoreFile } from '@uwmd/signing';

const store = await loadKeyStoreFile('./keystore.json');
const result = await verifyChain(parsed, {
  signatureVerifier: createBlockSignatureVerifier(store),
});
```

```bash
uwmd verify deal.uwx.md --signing --keystore=./keystore.json
```

`ed25519` / `es256` / `es384` over Web Crypto (Node 20 or later). Also supplies
`signReceipt` + `createReceiptSignatureVerifier`, which is what made receipt
signing real. Key distribution is out of scope by design — the JSON key store
in `keystore-file.ts` is a reference format, and an adopter backing a `KeyStore`
with an HSM never touches it. **Published:** signing 0.2.12 pairs with core
2.8.0. The release workflow publishes core, CLI, signing and batch.

The CLI reaches it by dynamic import as an optional peer, so core takes no
dependency on a sibling package. Signing depends on `@uwmd/verify` (the
signing payloads, verifier seams and `parseActorSource`) and on `@uwmd/core`
for the `Capability*` types, which are starter products (RFC 0083); both pins
are exact.

## Excel converter — `packages/uwmd-excel` (`@uwmd/excel`; see VERSIONS.md)

`.uw.md → .xlsx`. Depends on `@uwmd/core` + `exceljs`. CLI bin:
`uwmd-excel <input.uw.md> [-o output.xlsx]`.

RFC 0043 adds explicit numeric custom calculations through
`toWorkbook(parsed, { calculations, calculationContext })` and
`uwmd-excel deal.uwx.md --calculations <ids>`. Its additional input tables use
canonical period identity, whole-series guards and the existing calc boundary.
They support value edits and sorting; reverse import refuses these extended
workbooks so additional edits are not discarded. The native verification scripts
exercise generated files in a separate hidden Excel instance.

Key design: the workbook ships **formulas, not pre-computed values**, so it stays
in sync with the calc engine by construction. The engine (`toWorkbook.ts`) is
generic; each asset class supplies a `WorkbookLayout` (`src/layout.ts`) selected
by `frontmatter.asset_class` via the registry (`src/layouts.ts`,
`getLayoutForAssetClass`). Supported: **all twelve classes** — multifamily, office,
retail, industrial, self-storage, hospitality, senior housing, student housing,
land, data center, manufactured housing, and `mixed_use`. `SUPPORTED_ASSET_CLASSES` is the live list; a class with
no layout throws `UnsupportedAssetClassError`.

`mixed_use` (RFC 0019) is the one class whose workbook is **not** a single
operating statement. Its layout carries a `mixedUse` spec (`src/mixed-use.ts`),
and `toWorkbook` dispatches to a dedicated builder: **one footing operating
statement per present component** (EGI − opex = NOI) plus a **consolidation
block** whose SUM of the component NOI named ranges is the property NOI (the §3a
foot, live in the sheet). Metrics are emitted **per deal** — a metric is written
only when it evaluates non-null for that document, so a component absent from the
file, or an intensive lacking its user-supplied `allocation_pct`, simply
contributes no row (RFC 0019 §4). Reverse import (`fromWorkbook`) reads the
property inputs and each component's named inputs (EGI, operating expenses,
intermediate, allocation, denominator) back; NOIs are formula-derived and never
imported, and an altered footing is `WORKBOOK-IMPORT-SUBTOTAL` (#411). With no
component block there is nothing to consolidate, so the property NOI is the
stated source NOI as an editable input, or `#N/A` when it is absent, written and
imported like a single-statement subtotal (#484).

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
  Export checks that these live formulas preserve the selected record's stated
  subtotals. Conflicting line detail or an EGI/OpEx/NOI mismatch refuses export
  with `EXCEL-EMIT-PATH`; this is an exporter limitation, not a new validation
  obligation. Without any detail for a subtotal, its stated aggregate remains
  an editable numeric input. A missing source subtotal becomes `#N/A` with an
  explanatory note, so it cannot turn into a calculated zero or a reconstructed
  value that the source calculation never read.
  When canonical decimal inputs sum exactly but binary arithmetic differs
  (for example, `0.1 + 0.2` versus `0.3`), export retains the original unrounded
  source aggregate with a note instead of a live subtotal formula. This is a
  source-preserving fallback, with no financial tolerance or input rounding;
  subsequent detail edits do not update that aggregate.
  Each non-formula subtotal carries column-C status text. Reverse import
  (`fromWorkbook`) accepts exactly these three forms: the live formula with no
  status (not imported), `#N/A` beside the missing status (nothing imported),
  or a finite number beside the retained status (imported as
  `noi_model.income.effective_gross_income`,
  `noi_model.expenses.total_operating_expenses` or
  `noi_model.net_operating_income`). A different formula, a value typed over a
  formula or over `#N/A`, a formula typed over a retained value, or a deleted
  status refuses with `WORKBOOK-IMPORT-SUBTOTAL` (#484).
- **Capital Stack** sheet (`src/capital-stack.ts`, RFC 0026) — present **only
  when the document carries a `capital_stack` section**, for any asset class; a
  single-loan document produces exactly the workbook it produced before. One row
  per tranche (ordered by seniority) with a **live annual-debt-service formula**
  mirroring `trancheAnnualDebtService` branch for branch, a native-`SUM`
  total-capitalization row (named `capital_stack_total`), the property-level
  sizing inputs (`cs_noi` references the workbook's live `noi` named range when
  one exists), and a sizing block that recomputes every stated figure as a live
  formula beside its stated value. The agree/disagree cells `ROUND` both sides
  at `CAPITAL_STACK_SIZING_DECIMALS[fn]` — imported from `@uwmd/core`, not
  copied — and a live verdict cell applies the verifier's precedence
  (`failed` → `unverifiable` → `verified`). A figure the verifier reports
  `unverifiable` is written as literal text, never as a formula over blank
  cells (a blank SUMs to 0 — the misleading zero the verifier refuses).
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
> comparing to `evaluateCalc()` exactly. (An earlier converter summed
> income without signs — double-counting vacancy — and the old test missed it
> because it only checked formula *text*. Adding a new class's example deal must
> keep its operating statement footing.)

**Accepted RFC0088 export limit.** Native spreadsheet POWER/LN/EXP may differ
from the pinned verification procedure beyond about eleven significant digits
and may error on subnormals/overflow. The representative exact-comparison tests
above do not certify universal native recalculation parity. UWMD verifies the
stated record, never the spreadsheet's recomputation; neither financial graphs
nor quantizer are changed to match a spreadsheet. The package's
[export contract](../../packages/uwmd-excel/README.md#native-recalculation-limits-accepted-rfc-0088)
records the named-engine evidence and these accepted limits.

### The `UW MCP` sheet — machine-readable identity and contract

Every workbook carries a fourth sheet, `UW MCP` (`mcpSheet.ts`). An `.xlsx` is a
**view** of a `.uw.md`, not the record, and once it leaves the converter it
otherwise carries no statement of where it came from. The sheet writes that
statement down: human-legible key/value rows, a metric dictionary, a table of
sibling representations, and one cell holding the whole thing as canonical JSON
under the `uw_mcp` named range — so a reader can scan it or parse exactly one
thing.

It reuses the existing interchange vocabulary rather than inventing a parallel
one, which is what makes the workbook line up with the JSON/XML/CSV forms:
envelope semantic digests (`computeEnvelopeDigest`), codec
`RepresentationDescriptor`s from `CORE_CODEC_REGISTRY`, and the MCP deal
resource URI (`uwmdDealResourceURI`).

What it carries, and why each part earns its place:

- **Document identity** — `uw_version`, `deal_id`, `deal_name`, `asset_class`,
  the source **semantic digest** at export time, and the MCP resource URI for
  the canonical record.
- **Producer** — the pack id and version, and the converter. Derived metrics are
  pack-owned, so a reader needs to know *which* pack produced them.
- **Metric dictionary** — every metric's id, label, unit, and its
  **calc-engine source formula**, not the Excel translation. An agent handed a
  bare workbook would otherwise have to reverse-engineer a cell to learn what
  `debt_yield` means.
- **Sibling representations** — the codec registry's descriptors, so a reader
  can discover the JSON/XML/CSV forms of the same record.
- **Assurance boundary**, stated explicitly. The likeliest agent error with a
  spreadsheet is treating a cached cell as ground truth and "helpfully"
  recomputing it. The rows say plainly: this workbook is a view, the canonical
  record is the `.uw.md`, derived metrics are pack-owned formulas, inputs apply
  only through the starter editor, and the digest proves *source identity*, not
  input truth.

`verifyWorkbookContract(wb, parsed, layout)` returns a **three-state** verdict —
`verified` / `stale` / `failed` / `unverifiable` — deliberately mirroring
`receipts.ts`. A workbook with no `UW MCP` sheet is `unverifiable`, **not**
`failed`: an older export is not evidence of tampering, and reporting it as a
failure would train users to ignore the result. A pack-version bump or a changed
source document is `stale`. Only a workbook that carries a contract *and*
disagrees with the record is `failed`.

`fromWorkbook()` consumes it: identity comes from the sheet rather than the
positional `Underwriting!B3` cell, a pack-id mismatch is refused with
`WORKBOOK-IMPORT-PACK-MISMATCH` rather than read at the wrong row offsets, and a
contract that disagrees with `B3` is refused as internally inconsistent.

Build: `tsc`. Test: `vitest run`.

## Report PDF pipeline — `packages/uwmd-report` (`@uwmd/report`; see VERSIONS.md)

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
it renders (embeds a minimal Parser + Renderer). Reader demo. Skip it for editing
or calc.

## Web editor — `tools/web-editor` (`@uwmd/web-editor` 0.8.0, private)

React 18 + Tailwind CSS 4 (Vite). Opens `.uw.md` Lite summaries by compiling their supported anchored fields into a canonical `.uwx.md` record (retaining the complete Lite source in a namespaced extension), and opens `.uwx.md` structured records directly. Export Lite is explicitly loss-reported: omitted UWX paths are listed before the smaller deal-summary projection is downloaded. Embeds `@uwmd/core/browser` (parser, validator,
edit dispatcher, calc engine, report renderer, init scaffolder,
cascade/refinement/gaps intelligence, calc dependency introspection, receipt
issuance/verification). Six tabs:

- **Editor** — sidebar with per-section validation badges; an **edit-provenance
  bar** (`EditModeBar`) controlling what gets stamped on `_meta`
  (actor/source/confidence/notes/human-review) and whether section edits
  **replace in place or append a superseding version**; frontmatter form;
  per-section numeric inputs (curated allow-list in `src/catalog.ts`, now down to
  the fields no footed-model surface owns — most totals moved into
  RentRoll/OperatingStatement/Debt/SourcesUses/Valuation/Dcf models). The grid is
  **asset-class aware**: `fieldsForSection(section_id, asset_class)` offers each
  class its own size intensive (`rentable_square_feet` for office/industrial,
  `gross_leasable_area` for retail, `net_rentable_square_feet` + `rentable_units`
  for self-storage, `keys` for hospitality, `total_beds` for student/senior,
  `gross_acres`/`usable_acres`/`entitled_units` for land, `critical_it_load_kw`
  (kW) for data center, `total_sites` (sites) for manufactured housing,
  `total_units` for multifamily/senior/student) and not another class's. The
  class-section fields keep their stated precision: integers are counts, unit
  prices and tariffs (ADR, $/kW-month, $/kWh, pad rent) are unrounded numbers,
  and fractions such as `power_margin` are rates. The filter is
  deliberately **opt-out** — an unset, unrecognized, or `mixed_use` class sees
  the full list, class-independent fields (`year_built`, `parking_spaces`) are
  never filtered, and anything hidden is still reachable in the generic
  all-fields editor. `catalog.test.ts` pins the direction that matters: every
  `property.*` path a class's calc pack reads is offered to that class, so the
  grid cannot omit an input the metric strip divides by; **editable rent-roll tables** with add/remove rows (unit-mix or
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
- **Receipt** — issue and verify RFC 0016 verification receipts entirely
  client-side (`src/receipts.ts` + `ReceiptPanel`). Issuance runs the asset
  class's pack over the open deal and offers the `.receipt.json` sidecar;
  verification accepts a receipt file and re-verifies continuously against the
  in-editor document. Renders **four** states, not three: core's
  `verified`/`failed`/`unverifiable` plus a UI-level **`stale`**. A digest
  mismatch is reclassified as stale only when *this session* issued the receipt
  and the deal has since been edited — spec §6's "editors SHOULD treat any
  existing receipt as stale once a write lands". A mismatch on a receipt that
  arrived as a file stays `failed`. Per `UW_RECEIPT.md` §1 the panel never
  shows a bare checkmark: every verdict states what it attests, and `verified`
  carries the "not correct/complete/audited/approved" caveat inline rather than
  behind a disclosure.
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
keep Node-only starter code out of the bundle. The intelligence + introspection
functions (`resolveValue`, `rankGaps`, `inferGaps`, `getAssetClassDefaults`,
`getExprDependencies`, `extractDependencyGraph`, …) are browser-safe and are
now exported from `@uwmd/core/browser`.

## VS Code extension — `tools/vscode-uwmd` (`vscode-uwmd`; see VERSIONS.md)

Authoring extension: syntax highlighting (`syntaxes/uwmd.tmLanguage.json` —
YAML frontmatter + Markdown + embedded JSON), section folding, document outline,
on-save validation diagnostics tied to `BUILTIN_REMEDIATIONS`. Entry:
`src/extension.ts`; `activationEvents: onLanguage:uwmd`. Bundled with esbuild
(`esbuild.mjs`); package with `vsce package`. Not yet on the marketplace.
It depends on `@uwmd/verify` only (a `file:` dependency on its built dist,
RFC 0083): it parses, validates and verifies receipts, and never edits or
renders. Its receipt verifier identifies as `@uwmd/verify`, the same engine
every current receipt names (core's included), so a tampered receipt is
`failed`. A receipt from an earlier release names that release's engine and is
`unverifiable` (`RCP-07`) on a disagreement, as it always was across versions.

**Receipt verification** — the `uwmd.verifyReceipt` command ("UW Markdown:
Verify Receipt for This Deal") checks the `<deal>.receipt.json` sidecar against
the open document. Verdicts map to notification severity (information / error /
warning for verified / failed / unverifiable), with the full breakdown in a
*UW Markdown Receipts* output channel; unsaved editor changes are offered as
the likely cause of a failure. Per `UW_RECEIPT.md` §1 the verified
notification states the assurance boundary inline rather than showing a bare
checkmark.

The extension **verifies but never issues** — a receipt issued mid-authoring is
stale on the next keystroke, which would teach users that receipts are noise.

The logic lives in `src/receipts.ts`, deliberately free of any `vscode` import,
so `src/receipts.test.ts` runs it under plain vitest with no editor harness. CI
job: **VS Code extension (build + test)** (typecheck + esbuild bundle + vitest);
before this the extension had no CI coverage at all.

**Representation-aware validation** (`src/validate.ts`, also `vscode`-free) —
the language contribution now covers **both** `.uw.md` and `.uwx.md` under the
single `uwmd` id, and the parser is chosen from the *content* via
`detectUWSourceRepresentation` rather than the extension. Lite documents get
`LITE_*` parse errors plus `LITE_COMPILE_*` bridge errors; UWX documents get the
full structured validator. Diagnostics are anchored to real lines — Lite issues
carry source ranges, structured findings map `section` → `block.lineStart`.

> **Why content dispatch, not the extension:** the extension previously ran the
> *structured* parser over every `.uw.md`. Post-RFC-0017 that means UW Lite, and
> the structured parser finds no fenced sections in a Lite document — so it
> reported zero issues and `clean` for a file it had never parsed. A silent
> false pass, worse than a wrong error. `validate.test.ts` guards the regression.

> **Financial thresholds are not reported for Lite, by construction.**
> `checkFinancialValidity` reads `frontmatter.quick_metrics`; the deal-summary
> bridge does not populate it, so the FV family is inert over a compiled Lite
> record. A setting to "enable" it was prototyped and removed — it did nothing.
> Synthesizing the metrics inside the extension would break its contract that it
> flags exactly what `uwmd validate` flags. Whether a compiled Lite record should
> carry derived metrics is a core/bridge decision (and arguably an RFC one), not
> a tooling one.

## Docs site — `tools/docs-site` (VitePress)

The **published, human-facing** documentation site. A prebuild step
(`scripts/prebuild.mjs`) copies repo-root markdown (spec, governance, RFCs,
schemas, examples) into the site tree and rewrites links — repo root stays the
single source of truth. All `docs/rfcs/*.md` files are discovered automatically;
the RFC index and template retain their special URLs. Release labels read the
core manifest and protocol constants via `scripts/docs-site-sources.mjs`, and
the "on npm" list on the home release card and Downloads page comes from
`docsNpmPackages()`: the newest CHANGELOG section carrying `### Released` (added
only by post-publication reconciliation) names the published generation, and
`releasePackagesForGeneration()` gives its scope. A release-prepared tree, whose
manifest already carries the next version and possibly a wider scope, therefore
never shows unpublished packages as on npm. `docsSiteVersions()` writes the
source-tree versions and this publication state as separate fields, and the
home card shows them under separate headings. Prebuild writes all of these to `about/versions.json`.
Config: `.vitepress/config.ts`. Dev: `npm run dev`;
build: `npm run build`.

Public positioning (home page, `/about`, quickstart) leads with the `.uwx.md`
record and the AI boundary; UW Lite is introduced as the compact summary
representation. The home page and `/ai` share `theme/AiBoundary.vue`, the
"AI extracts, code calculates" workflow diagram. Nav follows the visitor
journey: Why UWMD → Examples → Get started → Integrate → Reference.

> This wiki (`docs/wiki/`) is deliberately **not** wired into the docs-site nav —
> it is internal dev/agent documentation, not part of the published standard.
> Keep it that way unless the decision changes.

## Lease-up cash-flow projection

`uwmd project-lease-up <deal.uwx.md> <plan.json> [--json]` uses the verified
RFC 0044 adapter and emits a JSON candidate with source digest and bindings.
The plan requires exact `source_variant`, registered `day_count`, and one
`{ period, date }` mapping per source period. No document is edited.
Success exits 0. Typed refusals exit 1; `--json` retains the nested verifier or
structural evidence in an `error` object. Unsupported write flags refuse.
See the [workflow](../LEASE_UP_CASH_FLOW_WORKFLOW.md) for the supplied plan,
browser-safe API and economic limits. Included in published core/CLI 2.8.0.

## RFC 0070 validation split (Protocol 2.21.0)

`uwmd validate` text/JSON invokes the separate async funding verifier.
JSON retains the structural result at root and adds
`replacement_funding_verification`; HDG-09 never enters its structural errors.
`uwmd verify` with validation enabled exposes the same separate result.
Structural errors or applicable failed/unverifiable/unchecked funding exit 1;
a lawful not_applicable legacy path does not itself refuse. Integrity/policy-only
verification exposes not_checked/not_invoked and claims no complete binding check.
MCP validation uses the same split and sets isError when complete validation refuses.

The web editor remains synchronous: its panel is labeled Structural validation
and explicitly reports not_checked/not_invoked, with no complete verification
claim. VS Code diagnostics and collection validity are structural diagnostics;
they do not establish replacement-payment binding verification. Producers and
other clients claiming this capability must call the async verifier and require
verified. Published core/CLI 2.17.0 carry Stable Protocol 2.21.0;
RFC 0070 is implemented after shipment and independent publication verification.
See [the publication record](https://github.com/UWMD-OSP/UW-Markdown/blob/main/docs/releases/2.17.0-publication.md).

## RFC 0064 property reserve accounts

Optional, asset-class-independent `reserve_accounts` (Format §4.28) carries closed source-attributable property custody facts. `reserve-accounts-structure.ts` checks ordinary `RSV-01`–05 structure; browser-safe `verifyReserveAccounts` in `reserve-accounts.ts` separately checks stated balances and claimed continuity using the existing 2dp half-away currency boundary. Results include the Envelope semantic source digest and ordered account/period/movement evidence; absent data is `not_checked`. CLI: `uwmd verify-reserve-accounts <file> --json`. The default and portable `conformance/reserve-accounts/` suite uses synthetic source-shaped classifications and typed refusals. Gross capex stays gross and RFC 0045 reserve refusal remains unchanged.

## RFC 0065 reserve draw bindings

`reserve-draw-bindings.ts` exports browser-safe `verifyReserveDrawBindings(parsed, plan?)`. Its optional external `ReserveDrawBindingPlan` uses exact variants, reserve account/period/movement identities, lease-up TI/LC components or gross cash-row addresses, declared selected-draw completeness and explicit funded shares. `RDB-01`–09 findings and the two companion schemas mirror Protocol §VIII.12. CLI: `uwmd verify-reserve-draws <file> [plan.json] --json`. Synthetic default/portable fixtures, shared-quantizer cent controls and regressions preserve gross rows and the unchanged RFC 0045 reserve refusal. No document field, transfer, owner cash or financing assembly is added.

## Official builtin starters (RFC 0080)

All twelve classes have packs and Excel layouts. Data center uses critical IT kW; manufactured housing uses sites. Their layouts bind every class calculation and the six standard income metrics to stated inputs. Hospitality also binds the former module's hotel and F&B fields; a metric whose optional hotel inputs are missing is `#N/A`, as the calc engine's null (#487). The web editor includes both new class names, primary-size fields and standard class sections. The official module packages were retired after 3.0.0 and deleted by RFC 0081.

The Lite bridge emits bare Format 3.0 for all twelve classes (RFC 0081 D12) and recognizes the two new classes' standard section/size anchors; a Lite source stating any other `uw_version` is refused.
