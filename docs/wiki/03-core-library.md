# 03 — Core library (`@uwmd/core`)

`packages/uwmd-core` is the reference implementation and the heart of the repo.
Everything else depends on it; it depends only on `@anthropic-ai/sdk` (excluded
from the browser entry).

- **Package:** `@uwmd/core` 1.0.0, ESM (`"type": "module"`), TypeScript ES2022 / NodeNext.
- **Public API:** [`src/index.ts`](../../packages/uwmd-core/src/index.ts) — the
  single source of truth for what's exported. If it isn't there, tools can't import it.
- **Entry points (`package.json` `exports`):**
  - `.` → `dist/index.js` (full library, includes the Anthropic SDK agent host)
  - `./browser` → `dist/browser.js` (everything **except** `@anthropic-ai/sdk` — for web bundling)
  - `./cli` → `dist/cli.js` (the CLI program; `uwmd-cli` just imports this)
- **Build:** `tsc` (per-package). **Test:** `vitest run`. Coverage:
  `vitest run --coverage`. Each `*.ts` has a sibling `*.test.ts`.

## Module map

Module | Responsibility | Key exports
---|---|---
`parser.ts` | `.uw.md` text → `ParsedUWFile` | `parseUWFile`, `getSection`, `getSectionVariant`, `deepGet`
`validator.ts` | Cross-section / financial / DQ checks | `validateUWFile`, `lookupRemediation`
`editor.ts` | Tier-2 edit dispatcher | `applyEdit`, `applyEditAsync`, `resolvePolicy`
`renderer.ts` | Render to json/csv/chat/summary/html | `render` (+ `RenderFormat`, `RenderTier`, `RenderOptions`)
`runner.ts` | Write blocks back to file (supersede-aware) | `writeAgentBlock`, `writeErrorEntry`, `buildMeta`
`compactor.ts` | Live view + section diff | `compact`, `diff`
`init.ts` | Scaffold a blank `.uw.md` | `generateBlankUWFile`
`cli.ts` | The `uwmd` command program | (default program; routes subcommands)
`protocol.ts` | Executable protocol contract + BUILTIN_* tables | see [§ protocol](#protocol-the-contract-surface)
`types.ts` | Format type definitions | `UWBlock`, `UWMeta`, `UWFrontmatter`, `ParsedUWFile`, `DEFAULT_THRESHOLDS`, …
`format.ts` | Field-level display formatters | `formatCurrency`, `formatPercent`, `formatRatio`, `formatCount`, `formatDate`, `formatValue`, …
`context.ts` | Bancroft layer defs + agent context builder | `BANCROFT_LAYERS`, `buildAgentContext`, `buildAgentPrompt`, `getLayerDependencies`, `isContextReady`
`context-profiles.ts` | Normative context payloads (Protocol §XI) | `buildContext` (+ `ContextProfile`)
`cascade.ts` | Fallback-cascade value resolver | `resolveValue`, `readInFile`
`defaults.ts` | Asset-class default tables | `MULTIFAMILY_DEFAULTS`, `getAssetClassDefaults`, `getDefaultRange`, `listDefaultedFields`
`gaps.ts` | Gap detection | `inferGaps`, `summarizeGaps`, `readGapsContent`
`refinement.ts` | Value-of-information gap ranking | `rankGaps`
`integrity.ts` | content/parent-hash chain + provenance | `verifyChain`, `verifyProvenance`, `computeBlockHash`, `sha256Hex`
`integrity-canonical.ts` | Canonicalization for hashing | `canonicalize`
`calc/` | Tier-3 safe-expression engine | see [04 — Calc engine](04-calc-engine.md)
`packs/` | Calc packs + Excel emit | see [05 — Calc packs](05-calc-packs.md)
`agents/` | Tier-4 Bancroft agent host | see [06 — Bancroft agents](06-bancroft-agents.md)

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
(token-budgeted context string for an LLM), `summary` (markdown), plus HTML.
`chat`/`summary` are the formats exercised by Tier-1 conformance. PDF/DOCX are
stubs deferred to a third-party pipeline. `RenderOptions` include `format`,
`tier` (`screener`|`analyst`), and `maxTokens`.

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
(`MULTIFAMILY_DEFAULTS` is the only table today). The CLI `uwmd scope` command
materializes the full resolved triage view.

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

## protocol.ts (the contract surface)

The executable mirror of `UW_PROTOCOL_v1.md`. It **re-uses** types from `types.ts`
(never duplicates them) and adds the protocol-layer types plus the `BUILTIN_*`
tables every conforming tool references:

- Versions: `PROTOCOL_VERSION` (1.1.0), `FORMAT_VERSION` (1.1).
- Tiers/capabilities: `ViewerTier`, `ViewerCapability`, `ImplementationManifest`.
- Display: `DEFAULT_NUMBER_FORMAT`, `DEFAULT_DATE_FORMAT`, `BUILTIN_VIEW_MODELS`
  (per-section render hints), `SectionViewModel`, `FieldViewHint`.
- Edits: `EditOperation`, `EditPolicy`, `EditAuthority`, `BUILTIN_EDIT_POLICIES`.
- Cascade: `CascadeStep`, `CASCADE_ORDER`, `SOURCE_TAGS`.
- Incomplete data: `IncompleteDataPolicy`, `GapAction`,
  `BUILTIN_INCOMPLETE_DATA_POLICIES`, `lookupIncompleteDataPolicy`.
- Calc contract: `CalcEvaluationContext`, `CalcResult`, `ModuleCalcDecl`.
- Modules: `ModuleManifest` (+ section/calc/validation/agent-layer decls).
- Errors: `ProtocolError`, `ProtocolErrorCategory`.
- Remediations: `IssueRemediation`, `BUILTIN_REMEDIATIONS` (CC/DQ/INT/POL/FV copy).

> **Keep `protocol.ts` and `spec/schemas/*.schema.json` in lockstep.** The
> `ModuleManifest` interface explicitly mirrors `module-manifest.schema.json`.

## Where to start, by task

Goal | Start here
---|---
Parser bug | `parser.ts` + `parser.test.ts`
New validator check | `validator.ts` (register copy in `BUILTIN_REMEDIATIONS`)
New calc builtin | `calc/builtins.ts` + `calc.test.ts`, then `packs/excel-emit.ts`
New derived metric | `packs/multifamily.ts` (one place, all tools pick it up)
New agent layer | `context.ts` (`BANCROFT_LAYERS`) + `agents/`
New edit semantics | `editor.ts` + `protocol.ts` (`EditOperation`/policy)
New display formatter | `format.ts` + the relevant `BUILTIN_VIEW_MODELS` entry
