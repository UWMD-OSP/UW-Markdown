# 03 — Core library (`@uwmd/core`)

`packages/uwmd-core` is the reference implementation and the heart of the repo.
Everything else depends on it. Its runtime dependencies are `fast-xml-parser` and
`fflate`. `@anthropic-ai/sdk` is an **optional peer dependency**: only the
reference Anthropic provider needs it, it is loaded dynamically on the first
request, and it is excluded from the browser entry. A host that brings its own
`AgentProvider` — or never runs a Tier-4 agent — does not install it, and
importing `@uwmd/core` works without it.

- **Package:** `@uwmd/core` 1.1.0 release candidate, ESM (`"type": "module"`), TypeScript ES2022 / NodeNext.
- **Public API:** [`src/index.ts`](../../packages/uwmd-core/src/index.ts) — the
  single source of truth for what's exported. If it isn't there, tools can't import it.
- **Entry points (`package.json` `exports`):**
  - `.` → `dist/index.js` (full library, including the Tier-4 agent host)
  - `./browser` → `dist/browser.js` (everything **except** `@anthropic-ai/sdk` — for web bundling)
  - `./cli` → `dist/cli.js` (the CLI program; `uwmd-cli` just imports this)
- **Build:** `tsc` (per-package). **Test:** `vitest run`. Coverage:
  `vitest run --coverage`. Each `*.ts` has a sibling `*.test.ts`.

## Module map

Module | Responsibility | Key exports
---|---|---
`parser.ts` | `.uw.md` text → `ParsedUWFile` | `parseUWFile`, `getSection`, `getSectionVariant`, `deepGet`
`lite.ts` | Constrained Lite parser, AST, renderer, financial canonical form | `parseUWLite`, `canonicalizeUWLiteFinancial`
`lite-bridge.ts` | Lite compilation, UWX serialization, lossy projections | `compileUWLite`, `stringifyUWX`, `projectUWEnvelopeToLite`
`validator.ts` | Cross-section / financial / DQ checks | `validateUWFile`, `lookupRemediation`
`editor.ts` | Tier-2 edit dispatcher | `applyEdit`, `applyEditAsync`, `resolvePolicy`
`renderer.ts` | Render to json/csv/chat/summary | `render` (+ `RenderFormat`, `RenderTier`, `RenderOptions`)
`report.ts` | §7.1 Lender Package / §7.2 Credit Memo HTML | `renderReportHtml`, `REPORT_CSS` (+ `ReportOptions`, `ReportResult`)
`envelope.ts` | Format-neutral model + semantic digest/equivalence | `UWDocumentEnvelope`, `toUWEnvelope`, `verifyEnvelopeDigest`
`codec.ts` | Extensible representation registry | `CodecRegistry`, `UWCodec`, representation descriptors
`bindings.ts` | Optional HTTP/MCP companion adapters | semantic ETags, negotiation, resources, compact tool results, source edits
`uwjson.ts` | UW JSON 1.0 codec + parsed-model bridge | `UW_JSON_CODEC`, `toUWJson`, `parseUWJsonVerified`, `fromUWJson`
`runner.ts` | Write blocks back to file (supersede-aware) | `writeAgentBlock`, `writeErrorEntry`, `buildMeta`
`compactor.ts` | Live view + section diff | `compact`, `diff`
`init.ts` | Scaffold a blank `.uw.md` | `generateBlankUWFile`
`cli.ts` | The `uwmd` command program | (default program; routes subcommands)
`protocol.ts` | Executable protocol contract + BUILTIN_* tables | see [§ protocol](#protocol-the-contract-surface)
`types.ts` | Format type definitions | `UWBlock`, `UWMeta`, `UWFrontmatter`, `ParsedUWFile`, `DEFAULT_THRESHOLDS`, …
`format.ts` | Field-level display formatters | `formatCurrency`, `formatPercent`, `formatRatio`, `formatCount`, `formatDate`, `formatValue`, …
`context.ts` | Optional Bancroft reference-layer defs + agent context builder | `BANCROFT_LAYERS`, `buildAgentContext`, `buildAgentPrompt`, `getLayerDependencies`, `isContextReady`
`context-profiles.ts` | Normative context payloads (Protocol §XI) | `buildContext` (+ `ContextProfile`)
`cascade.ts` | Fallback-cascade value resolver | `resolveValue`, `readInFile` (browser-exported)
`defaults.ts` | Asset-class default tables | `MULTIFAMILY_DEFAULTS`, `SELF_STORAGE_DEFAULTS`, `getAssetClassDefaults`, `getDefaultRange`, `listDefaultedFields`
`gaps.ts` | Gap detection | `inferGaps`, `summarizeGaps`, `readGapsContent`
`refinement.ts` | Value-of-information gap ranking | `rankGaps`
`integrity.ts` | content/parent-hash chain + provenance | `verifyChain`, `verifyProvenance`, `computeBlockHash`, `sha256Hex`
`integrity-canonical.ts` | Canonicalization for hashing | `canonicalize`
`receipts.ts` | Detached verification receipts (RFC 0016) | `issueReceipt`, `verifyReceipt`, `resolveReceiptSubject`, `assertUWReceipt`, `ReceiptError`
`version.ts` | Engine identity recorded in receipts | `CORE_PACKAGE_NAME`, `CORE_VERSION`
`modules.ts` | Declarative module manifest loader/registry | `loadModuleManifest`, `createModuleRegistry`, `getModuleCalculationsForAssetClass`
`calc/` | Tier-3 safe-expression engine | see [04 — Calc engine](04-calc-engine.md)
`packs/` | Calc packs + Excel emit | see [05 — Calc packs](05-calc-packs.md)
`agents/` | Optional Tier-4 Bancroft reference agent host | see [06 — Bancroft agents](06-bancroft-agents.md)

## parser.ts

`parseUWFile(content, opts?) → ParsedUWFile`. Splits frontmatter (restricted YAML
subset), prose, and fenced ```` ```json uw:… ```` data blocks. Produces
`ParsedUWFile`: `frontmatter`, `sections` (single- or multi-variant), `prose`
per section, `pipeline_log[]`, `custom_calculations[]`, `custom_scenarios[]`,
`extensions{}`, `superseded{}` (history), and the original `raw` text.

`ParseOptions`: `strict` (throw on JSON parse errors vs. collect — default
collect) and `thresholds` (institution overrides).

Helpers: `getSection(parsed, id)` returns the canonical (non-superseded) block;
`getSectionVariant(parsed, id, variant)` for multi-variant sections; `deepGet`
walks a dot-path into a content object.

## validator.ts

`validateUWFile(parsed, thresholds?) → ValidationResult`. Returns
`overall_status` (`clean`|`warnings`|`errors`|`blocking`), `stage_readiness`
(per `DealStage`), and `issues` split into `errors`/`warnings`/`info`. Each
`ValidationMessage` carries a `code` and (when a registry entry exists) a `title`,
`remediation`, and `spec_ref` pulled from `BUILTIN_REMEDIATIONS` via
`lookupRemediation`.

**Validation code families** (all defined with copy in `BUILTIN_REMEDIATIONS`):
- `CC-01..CC-10` — cross-section consistency (NOI/DSCR/LTV/cap/sources-uses/…).
- `DQ-01..DQ-05` — data quality (provisional/partial blocks, scope readiness, stale gaps).
- `INT-01..INT-04` — integrity (parent/content hash chain) — surfaced by `integrity.ts`.
- `POL-01..POL-02` — provenance/policy (unauthorized actor, replace-where-supersede).
- `FV-01..FV-14` — financial validity vs. thresholds (cap, DSCR, LTV, debt yield, IRR, vacancy, opex…).
- `UNSUPPORTED_YAML_FEATURE` — frontmatter outside the YAML subset.

## editor.ts (Tier-2)

`applyEdit(content, parsed, op, ctx, …, opts) → EditResult` and the async
`applyEditAsync` (used when an edit must stamp content/parent hashes). Dispatches
over four `EditOperation` kinds (`protocol.ts`): `frontmatter_set`,
`section_replace`, `section_supersede`, `pipeline_log_append`.

It enforces edit policy: `resolvePolicy` matches `_meta.source` against
`BUILTIN_EDIT_POLICIES` to decide authority (`agent_only`/`human_only`/`either`/
`system_only`) and whether the edit must supersede (append) or may replace. **The
golden rule of Tier-2:** bytes outside the modified region are preserved exactly
(round-trip stability). Failures return a typed `ProtocolError` in
`EditResult.error` (e.g. `INT-02` stale parent hash, `POL-01` unauthorized actor).

## renderer.ts (Tier-1)

`render(parsed, options) → RenderResult`. Formats: `json`, `csv`, `chat`
(token-budgeted context string for an LLM), `summary` (markdown).
`chat`/`summary` are the formats exercised by Tier-1 conformance. The `pdf` and
`docx` enum values are reserved for dedicated pipelines; requesting either from
the core renderer throws typed `UnsupportedRenderFormatError` instead of
returning empty content. Use `report.ts` (HTML) plus `@uwmd/report` for PDF.
`RenderOptions` include `format`,
`tier` (`screener`|`analyst`), and `maxTokens`.

## report.ts (Tier-1)

`renderReportHtml(parsed, opts?) → ReportResult` implements the spec's rendering
targets **§7.1 Lender Package** (tier `screener`, 10 sections from cover page to
assumptions/disclosures) and **§7.2 Credit Memo** (tier `analyst`, adds market
analysis, financial analysis with stress matrix, due diligence, risk, compliance,
covenants, appendix). Output is a single self-contained HTML document with
`REPORT_CSS` embedded (print-aware: `@page`, page breaks, color-adjust), or an
`<article>` fragment via `opts.fragment` for hosts that include `REPORT_CSS`
themselves (the web editor's preview tab does this via iframe `srcDoc`).

Pure string generation, zero dependencies, exported from both `index.ts` and
`browser.ts`. Every number is read from the file — engine/pack output — never
recomputed at render time; sections with no data are skipped and reported in
`sectionsSkipped`. Default tier comes from frontmatter `tier`. CLI:
`uwmd report <file> [--tier] [--prepared-by] [--output|--stdout]`. PDF is
`@uwmd/report`'s job (see [08 — Tools](08-tools.md)).

## uwjson.ts — the `.uw.json` sibling form (Tier-1)

A `.uw.json` document is the **lossless, machine-first projection** of a `.uw.md`
file. It exists so tools — the coming calc-aware editor/viewer especially — can
work against strict, schema-shaped JSON without parsing Markdown, while still
seeing everything the Markdown form carries.

Distinguish it from the `json` **render** target (`renderer.ts`). That target is
a *lossy current-state data view*: it flattens to current values and drops prose,
`_meta` provenance, fence annotations, and supersede history. `uwjson.ts` is
*lossless* — every block keeps its `_meta`, its annotation, the prose that
preceded it, and the full append-only `superseded` history. The round trip

```
.uw.md  → parseUWFile → toUWJson → stringifyUWJson      (export)
.uw.json → parseUWJson → fromUWJson → ParsedUWFile      (re-hydrate)
```

is faithful at the model level: `fromUWJson` rebuilds the same `ParsedUWFile`
shape `parseUWFile` produces, so `validateUWFile`, the calc engine, the packs,
and `render` all run against a `.uw.json` source unchanged. (Re-hydrated `raw` is
`''` — there is no canonical Markdown byte stream behind a `.uw.json`, so Tier-2
byte-preserving `applyEdit` still needs the `.uw.md`; read/validate/calc
consumers do not.)

- `toUWJson(parsed, opts?) → UWDocumentEnvelope` — converts the parsed model to
  Envelope 1.0; superseded history is included by default.
- `stringifyUWJson(parsed, opts?) → string` — pretty-printed UW JSON 1.0.
- `stringifyUWJsonWithDigest(parsed, opts?) → Promise<string>` — adds the
  canonical `semantic_digest` used by CLI exports and cross-format checks.
- `parseUWJson(text) → UWDocumentEnvelope` and `parseUWJsonVerified(text)` —
  structural parsing, with optional digest enforcement.
- `fromUWJson(doc) → ParsedUWFile` — rehydrates the in-memory model.
- `CodecRegistry`, `CORE_CODEC_REGISTRY`, `UW_JSON_CODEC`, and `UW_XML_CODEC` — discover and invoke model codecs by ID, media type, or filename.
- `stringifyUWXml(envelope)` / `parseUWXml(text)` — deterministic UW XML 1.0 with digest verification and secure parsing limits.
- `encodeUWCSVBundle` / `decodeUWCSVBundle` — normalized directory form; `encodeUWCSVZip` / `decodeUWCSVZip` provide deterministic bounded ZIP interchange and all six views.
- `createUWHTTPResponse` / `decodeUWHTTPRequest` / `assertUWIfMatch` — negotiated model bytes, semantic ETags, and optimistic concurrency.
- `createUWMCPResource` and `createUWMCP*Result` — text/blob resources, compact structured results, JSON fallback, and resource links.

CLI: `uwmd export <file.uw.md>` writes a digested `.uw.json` (`--no-superseded` to compact, `--stdout` to pipe). `uwmd convert <file> --to uw-json|uw-xml|uw-csv-bundle` converts Markdown and all verified model representations through the shared envelope.

> **Status — normative Envelope 1.0 / UW JSON 1.0 implementation.** The schema is
> `spec/schemas/uw-document-envelope.schema.json`. This is model-lossless, not
> byte-preserving: Markdown source bytes remain exclusive to the `.uw.md` source
> adapter.
## runner.ts

The low-level write path used by the agent host and CLI. `buildMeta(...)`
constructs a `_meta`; `writeAgentBlock(...)` writes a section block (superseding
the prior version, bumping `version`, updating pipeline state, appending a
`pipeline_log` entry); `writeErrorEntry(...)` records a failed agent run.

## cascade.ts + defaults.ts

`resolveValue(fieldPath, parsed, …)` walks the **fallback cascade** (`CASCADE_ORDER`
in `protocol.ts`): `user_override → user_input → investor_profile → market_data →
asset_class_default → global_default → system_default`. Asset-class defaults are
published `{low, central, high}` ranges with citations in `defaults.ts`
(multifamily, office, retail, industrial, and self-storage today). The CLI
`uwmd scope` command materializes the full resolved triage view.

## refinement.ts + gaps.ts

`gaps.ts` detects open data gaps. `refinement.ts` `rankGaps(parsed, opts)` ranks
them by **value of information** (VOI): which missing input, if filled, would
tighten the most calc outputs. It uses `extractDependencyGraph` (`calc/dependencies.ts`)
and perturbation over the default ranges. Exposed via `uwmd refine`.

## integrity.ts

`verifyChain(parsed)` (async) checks the `content_hash`/`parent_hash` supersede
chain; `verifyProvenance(parsed, policies?)` checks actor/policy authority.
`integrity-canonical.ts` `canonicalize()` defines the canonical form hashed by
`computeBlockHash`. Both feed the `uwmd verify` command and the Tier-1 malformed
conformance fixtures (INT-/POL- codes).

## receipts.ts

Implements [`spec/UW_RECEIPT_v1.md`](../../spec/UW_RECEIPT_v1.md) (RFC 0016).
A **receipt** is a detached JSON document binding a canonical digest of a record
to the deterministic outputs a named calc pack produced from it, so a recipient
can confirm offline that the numbers follow from the inputs.

- `issueReceipt(content, options)` — parses, canonicalizes, digests, runs every
  calc the pack declares, and returns a complete receipt. **Total**: it either
  returns a receipt or throws a typed `ReceiptError`. It refuses outright for a
  document with parse errors, an asset class with no registered pack, or a pack
  calc that fails to evaluate.
- `verifyReceipt(receipt, content, options)` — always recomputes, never trusts
  `results_digest`. Returns one of three verdicts and keeps them distinct:
  `verified`, `failed`, `unverifiable`. Unknown pack, a pack version the
  verifier does not hold, an unparseable record, or a signature with no backend
  all yield `unverifiable` — collapsing those into `failed` cries wolf, and
  collapsing them into `verified` is dangerous.
- Subject canonicalization dispatches on representation: Lite records bind to
  the §6 financial canonical form, structured records to the envelope semantic
  value. Both are semantic, so a receipt survives reformatting and fails only on
  financial change.
- Uncomputed outputs carry `computed: false` rather than a value. The calc
  engine reports "inputs absent" as a successful evaluation to `null`; a receipt
  must not let that read as a computed number.

Both issuance and verification are browser-safe (SHA-256 via Web Crypto), so the
web editor can verify client-side. Signature creation and validation stay
outside core, keeping it free of cryptographic dependencies.

CLI: `uwmd receipt issue <file>` / `uwmd receipt verify <file> <receipt.json>`
(exit 0 verified, 1 failed, 3 unverifiable). Conformance: `--tier=receipts`.

> A `verified` receipt attests that the record is unchanged and that its stated
> outputs follow from its contents. It attests **nothing** about whether those
> inputs are true. Do not surface it as an unqualified checkmark.

## protocol.ts (the contract surface)

The executable mirror of `UW_PROTOCOL_v1.md`. It **re-uses** types from `types.ts`
(never duplicates them) and adds the protocol-layer types plus the `BUILTIN_*`
tables every conforming tool references:

- Versions: `PROTOCOL_VERSION` (1.2.0), `FORMAT_VERSION` (1.1).
- Tiers/capabilities: `ViewerTier`, `ViewerCapability`, `ImplementationManifest`, `RepresentationCapability`.
- Display: `DEFAULT_NUMBER_FORMAT`, `DEFAULT_DATE_FORMAT`, `BUILTIN_VIEW_MODELS`
  (per-section render hints), `SectionViewModel`, `FieldViewHint`.
- Edits: `EditOperation`, `EditPolicy`, `EditAuthority`, `BUILTIN_EDIT_POLICIES`.
- Cascade: `CascadeStep`, `CASCADE_ORDER`, `SOURCE_TAGS`.
- Incomplete data: `IncompleteDataPolicy`, `GapAction`,
  `BUILTIN_INCOMPLETE_DATA_POLICIES`, `lookupIncompleteDataPolicy`.
- Calc contract: `CalcEvaluationContext`, `CalcResult`, `ModuleCalcDecl`.
- Modules: `ModuleManifest` (+ section/calc/validation/agent-layer decls);
  `modules.ts` validates and registers declarative v1 manifests.
- Errors: `ProtocolError`, `ProtocolErrorCategory`.
- Remediations: `IssueRemediation`, `BUILTIN_REMEDIATIONS` (CC/DQ/INT/POL/FV copy).

> **Keep `protocol.ts` and `spec/schemas/*.schema.json` in lockstep.** The
> `ModuleManifest` interface explicitly mirrors `module-manifest.schema.json`.
>
> For modules that lockstep is now **checked**, not merely requested. Core
> cannot carry a JSON Schema validator — the layering invariant admits only the
> Anthropic SDK — so `modules.ts` re-implements the schema by hand, and a
> hand-written mirror drifts. It had: `sections`, `view_models`, and
> `agent_layers` were declared in the schema and validated nowhere, unknown keys
> were accepted at every level, and the schema's `deal_stages` enum had gone
> stale in the other direction by omitting `scope`. The `modules` conformance
> suite now runs every fixture through both ajv and the loader and fails if the
> verdicts disagree. See [09](09-conformance-testing.md) and
> `conformance/modules/README.md` for the two permitted, individually justified
> exceptions.

## Where to start, by task

Goal | Start here
---|---
Parser bug | `parser.ts` + `parser.test.ts`
New validator check | `validator.ts` (register copy in `BUILTIN_REMEDIATIONS`)
New calc builtin | `calc/builtins.ts` + `calc.test.ts`, then `packs/excel-emit.ts`
New derived metric | the relevant file in `packs/` (one place, all tools pick it up)
New agent layer | `context.ts` (`BANCROFT_LAYERS`) + `agents/`
New edit semantics | `editor.ts` + `protocol.ts` (`EditOperation`/policy)
New display formatter | `format.ts` + the relevant `BUILTIN_VIEW_MODELS` entry
