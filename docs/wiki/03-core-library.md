# 03 — Core library (`@uwmd/verify` and `@uwmd/core`)

`verifyProvenance` derives authority from `_meta.provenance.source`; the descriptive
principal does not select an authority class. It checks every current variant,
and POL-02 requires visible superseded history for that same variant (Protocol
V.3/V.10, RFC0090).

RFC0128 pins the bounded pro-forma admission/report contract: effective LTV
conventions must agree with the bound loan, universe membership is by event and
undeclared roles produce required-sensitive gaps, and the exact loan input is the
sole loan selector. Report loan_ref remains derived; authored selectors.loan is
unsupported. Profile support is still gated by #551/#552.

The pro-forma assessor preserves unresolved declared inputs as inputs with null
targets (RFC0092 §6a). Final occupancy uses stated final-row SF before the
summary fallback; only a selected fallback adds the existing summary prerequisite
(§4b). These reference regressions add no profile support claim.

The validator follows the Format's null-is-unstated rule for tax stabilization
and optional hedge terms. CC-15 selects base, default, then a sole lease-up
variant. Replacement funding verification reports unresolvable_source before
invalid_structure when a named source cannot resolve (Protocol §V.12.3).

Format 3.0 is the only format the reference library reads ([RFC
0081](../rfcs/0081-one-format-one-protocol.md)): bare section payloads with an
inline nested `_meta`, a block digest over the block minus `_meta`, and one
home for each fact. A missing or other `uw_version` is refused at parse as
`UNSUPPORTED_FORMAT_VERSION`. Phase 4 deleted the old readers, the migrators
and the one-off re-authoring scripts; there is no migration path in the
product. Release 4.0.0 carries it, labelled Format 3.0 and Protocol 4.0.0;
3.0.0 is the last release that reads older formats.


Accepted RFC0081's hospitality field homes are enforced by CLS-04 on the selected
current statement: `property.keys` is the only key count; `rent_roll` holds ADR,
occupancy and available room nights; `hotel_metrics` holds only the market RevPAR
fact. Explicit presence of removed `rent_roll.keys` or `hotel_metrics.adr`,
`occupancy`, `available_room_nights` or `key_count` is refused, including null.
This bounded rule does not allocate a diagnostic for arbitrary unknown fields or
change historical-block applicability, role selection or financial calculations.
The reference library is two packages since RFC 0083 Phase 2, and everything
else in the repo depends on one or both:

- **`packages/uwmd-verify` — `@uwmd/verify`**, the reference implementation of
  the standard: everything a party needs to read and verify a `.uw.md`
  (reader, validation, the calc evaluator, the metric dictionary, receipts,
  integrity, modules and the verification profiles). It depends on no `@uwmd/*`
  package; its runtime dependencies are `fast-xml-parser` and `fflate`, and it
  has no peers. Versions independently from 0.1.0.
- **`packages/uwmd-core` — `@uwmd/core`**, the starter toolkit on top: editor,
  runner, renderer, report, defaults and cascade, refinement, display
  formatting, the Excel emitter, the context profiles and generic writers,
  and the CLI. It depends on `@uwmd/verify` at an exact version and
  **re-exports its whole surface**, so consumers use the current standard
  surface through either package. Core hosts no agents and takes no vendor
  SDK: a host that runs its own agents writes their records through
  `writeAgentBlock`/`writeErrorEntry` or the edit API.

- **Packages:** ESM (`"type": "module"`), TypeScript ES2022 / NodeNext.
- **Public API:** [`uwmd-verify/src/index.ts`](../../packages/uwmd-verify/src/index.ts)
  for the standard, and [`uwmd-core/src/index.ts`](../../packages/uwmd-core/src/index.ts),
  which is `export * from '@uwmd/verify'` plus the starter exports. If it isn't
  there, tools can't import it. Three core names shadow verify's on purpose:
  `evaluateCalc` and `evaluateModuleCalculations` (core adds the starter
  `display` string) and `issueReceipt` (core defaults the receipt's `issuer` to
  `@uwmd/core`; the engine stays `@uwmd/verify`). Core's `surface.test.ts` holds its
  two entries to every current verify export and the three intentional wrappers.
- **Entry points (`package.json` `exports`):**
  - `@uwmd/verify` `.` and `./browser` → the same surface (verify has no
    Node-only export; `browser.test.ts` holds them equal)
  - `@uwmd/core` `.` → `dist/index.js` (full library)
  - `@uwmd/core/browser` → `dist/browser.js` (everything **except**
    `applyEditAsync`, `buildContext`, `CASCADE_ORDER` and
    `REFERENCE_IMPLEMENTATION_MANIFEST` — for web bundling)
  - `@uwmd/core/cli` → `dist/cli.js` (the CLI program; `uwmd-cli` just imports this)
- **Build:** `tsc` per package, verify before core (the root `workspaces`
  order). **Test:** `vitest run`. Coverage: `vitest run --coverage`, each
  package with its own floor. Each `*.ts` has a sibling `*.test.ts`; a test
  that needs a starter module lives in core, named for it.

## Pinned numerical primitives — draft RFC0088 candidate

The owner selected one pinned fdlibm procedure for `pow`, `exp` and `log`.
The draft implementation exports `pinnedPow(base, exponent)`, `pinnedExp(value)`
and `pinnedLog(value)` from `@uwmd/verify` and its browser entry, with identical
bindings through both core entries. StackUW can use that same implementation;
there is no separate integer-power algorithm or host transcendental fallback.

These are raw binary64 primitives: no quantization, financial reassociation,
solver changes or final-result policy. Number inputs include infinities, signed
zero and NaN; domain/overflow results retain their IEEE classes. NaN payloads,
NaN signs and exception flags are not portable guarantees. Nonnumeric runtime
arguments refuse with existing `CalcError`/`CALC-TYPE-001`, without coercion.
Existing calc builtins retain their own null, domain and finite-result rules.

The typed port retains the research kernel's ordered graph and exact constants,
word operations and bounded loops. Tests compare4204 independent compiled-C
procedure cases and the erased implementation graph. Procedure agreement does
not imply universal correct rounding; measured mathematical accuracy and composed
financial/refusal evidence remain RFC acceptance gates. This draft export does
not switch current evaluator consumers or accept/activate RFC0088. See the
[procedure study](../../experiments/numerical-0088/pinned-fdlibm/README.md).

## Module map

Module | Package | Responsibility | Key exports
---|---|---|---
`parser.ts` | verify | `.uw.md` text → `ParsedUWFile` | `parseUWFile`, `getSection`, `getSectionVariant`, `deepGet`
`lite.ts` | verify | Constrained Lite parser, AST, renderer, financial canonical form | `parseUWLite`, `canonicalizeUWLiteFinancial`
`lite-bridge.ts` | verify | Lite compilation, UWX serialization, lossy projections | `compileUWLite`, `stringifyUWX`, `projectUWEnvelopeToLite`
`validator.ts` | verify | Cross-section / financial / DQ checks | `validateUWFile`, `lookupRemediation`
`editor.ts` | core | Edit dispatcher (starter product; Protocol 2.x Tier-2) | `applyEdit`, `applyEditAsync`, `resolvePolicy`
`renderer.ts` | core | Render to json/csv/chat/summary | `render` (+ `RenderFormat`, `RenderTier`, `RenderOptions`)
`report.ts` | core | §7.1 Lender Package / §7.2 Credit Memo HTML | `renderReportHtml`, `REPORT_CSS` (+ `ReportOptions`, `ReportResult`)
`envelope.ts` | verify | Format-neutral model + semantic digest/equivalence | `UWDocumentEnvelope`, `toUWEnvelope`, `verifyEnvelopeDigest`
`codec.ts` | verify | Extensible representation registry | `CodecRegistry`, `UWCodec`, representation descriptors
`bindings.ts` | verify | Optional HTTP/MCP companion adapters | semantic ETags, negotiation, resources, compact tool results; source edits through an injected edit adapter
`bindings-edit.ts` | core | Source edits wired to the starter editor | `applyUWMDSourceEdit`, `createUWMCPApplyEditResult`
`uwjson.ts` | verify | UW JSON 2.0 codec + parsed-model bridge | `UW_JSON_CODEC`, `toUWJson`, `parseUWJsonVerified`, `fromUWJson`
`runner.ts` | core | Write blocks back to file (supersede-aware) | `writeAgentBlock`, `writeErrorEntry`, `buildMeta` (defined in `metadata.ts`)
`compactor.ts` | core | Section diff | `diff`
`init.ts` | core | Scaffold a blank `.uw.md` | `generateBlankUWFile`
`cli.ts` | core | The `uwmd` command program | (default program; routes subcommands)
`protocol.ts` | verify | Executable protocol contract + BUILTIN_* tables | see [§ protocol](#protocol-the-contract-surface)
`starter-protocol.ts` | core | Starter-product protocol tables (RFC 0083) | `DEFAULT_NUMBER_FORMAT`, `BUILTIN_VIEW_MODELS`, `CASCADE_ORDER`, `CapabilityVerifier`, …
`types.ts` | verify | Format type definitions | `UWBlock`, `UWMeta`, `UWFrontmatter`, `ParsedUWFile`, `DEFAULT_THRESHOLDS`, …
`format.ts` | core | Field-level display formatters | `formatCurrency`, `formatPercent`, `formatRatio`, `formatCount`, `formatDate`, `formatValue`, …
`context-profiles.ts` | core | Starter context payloads (starter guide §IX.7) | `buildContext` (+ `ContextProfile`)
`cascade.ts` | core | Fallback-cascade value resolver | `resolveValue`, `readInFile` (browser-exported)
`section-resolution.ts` | verify | One block per section-rooted read (§VIII.2, RFC 0066) | `resolveSectionBlock` (browser-exported)
`defaults.ts` | core | Asset-class default tables | `MULTIFAMILY_DEFAULTS`, `SELF_STORAGE_DEFAULTS`, `getAssetClassDefaults`, `getDefaultRange`, `listDefaultedFields`
`gaps.ts` | core | Gap detection | `inferGaps`, `summarizeGaps`
`gaps-content.ts` | verify | The `gaps` section's types and reader | `readGapsContent`, `GapsContent`
`size-contract.ts` | verify | RFC 0100 size contract: `SIZE-01` for a negative or fractional size, count, area or rent | module-level `checkSizeContract`, `SIZE_CONTRACT`
`refinement.ts` | core | Value-of-information gap ranking | `rankGaps`
`asset-class.ts` | verify | Identifier grammar + resolution for module-declared classes (RFC 0003) | `parseAssetClass`, `resolveAssetClass`, `declaredAssetClasses`
`module-runtime.ts` | verify | Running what a module declares (RFC 0006) | `evaluateModuleCalculations`, `validateAgainstModules`, `checkModuleSections`
`module-signing.ts` | verify | Module manifest signature contract (RFC 0002) | `moduleSigningPayload`, `verifyModuleSignature`, `checkSignatureShape`
`integrity.ts` | verify | content/parent-hash chain + provenance + signature contract | `verifyChain`, `verifyProvenance`, `computeBlockHash`, `sha256Hex`, `canonicalBlockSigningInput`
`integrity-canonical.ts` | verify | Canonicalization for hashing | `canonicalize`
`receipts.ts` | verify | Detached verification receipts (RFC 0016) | `issueReceipt`, `verifyReceipt`, `resolveReceiptSubject`, `assertUWReceipt`, `ReceiptError`
`version.ts` | both | Engine identity recorded in receipts: verify's own, and core's | verify: `VERIFY_PACKAGE_NAME`, `VERIFY_VERSION`; core: `CORE_PACKAGE_NAME`, `CORE_VERSION`
`receipt-engine.ts` | core | The exported `issueReceipt`: verify's, with `@uwmd/core` as the default `issuer` | `issueReceipt`
`reference-implementation.ts` | core | What `uwmd manifest` prints (Protocol §I.4) | `REFERENCE_IMPLEMENTATION_MANIFEST`
`modules.ts` | verify | Declarative module manifest loader/registry | `loadModuleManifest`, `createModuleRegistry`, `getModuleCalculationsForAssetClass`
`calc/` | verify | Safe-expression engine (the Verifier's evaluator; Protocol 2.x Tier-3) | see [04 — Calc engine](04-calc-engine.md)
`calc-display.ts` | core | The exported `evaluateCalc`/`evaluateModuleCalculations`: standard results plus the starter `display` string | `evaluateCalc`, `evaluateModuleCalculations`
`metric-verification.ts` | verify | Stated metrics checked against the metric dictionary (RFC 0083 §2) | `verifyStatedMetrics`
`metric-dictionary.ts` | verify | `spec/metrics/builtin.json` as package data (generated) | `BUILTIN_METRIC_DICTIONARY` (internal)
`builtin-packs/` | verify | The twelve builtin pack manifests and their registry | see [05 — Calc packs](05-calc-packs.md)
`packs/` | core | Re-exports the builtin packs + Excel emit | see [05 — Calc packs](05-calc-packs.md)

## parser.ts

`parseUWFile(content, opts?) → ParsedUWFile`. Splits frontmatter (restricted YAML
subset), prose, and fenced ```` ```json uw:… ```` data blocks. Produces
`ParsedUWFile`: `frontmatter`, `sections` (single- or multi-variant), `prose`
per section, `pipeline_log[]`, `custom_calculations[]`, `custom_scenarios[]`,
`extensions{}`, `superseded{}` (history), and the original `raw` text.

RFC0089 gives `extensions[id]` an exact tagged `UWExtensionEntry<UWBlock>`:
`{mode:'single',block}` or `{mode:'variants',blocks:[{variant,block}]}`.
Variant identities are nullable, canonical and never aliases for `default`.
Overwritten priors and explicit history retain physical-event order and original
metadata. `extensionBlocks` and `mapExtensionEntry` traverse/project either mode.
Full model/carrier readers preserve unknown members through clone-safe
`envelopeExtras`; an explicit empty prose value uses `envelopeProsePresent`.
See [the complete Envelope contract](../../spec/UW_ENVELOPE.md).

Fresh-source receipt/authentication operations account for every source
occurrence. Mutable and assembled models use their current complete model;
parser-retained metadata evidence is not an immutable source certificate.
Full carrier schema admission is separate from source JSON-value admission.
Native stamping inspects descriptors and snapshots before any copy/hash, so
accessors execute zero getters and successful returned stamps match their models.
V9/V11/V12, receipt results and signing inputs retain their distinct scopes.

Frontmatter string keys are decoded with the shared YAML scalar reader at
both mapping levels. Mapping separators are found outside quoted content;
embedded colons, escaped names and empty quoted keys retain their identities.
`onFrontmatterMember` observes decoded paths before assignment, so document
signing rejects decoded duplicate or unsafe names. Quoted sequence literals
stay scalar content. Source `raw` is unchanged. Bare non-string key projection
remains a separate unresolved contract question (Issue #354).

`ParseOptions`: `strict` (throw on JSON parse errors vs. collect — default
collect) and `thresholds` (institution overrides).

Helpers: `getSection(parsed, id)` returns the canonical (non-superseded) block;
`getSectionVariant(parsed, id, variant)` for multi-variant sections; `deepGet`
walks a dot-path into a content object.

## validator.ts

`validateUWFile(parsed, thresholds?, sourceOptions?, policy?) → ValidationResult`. Returns
`overall_status` (`clean`|`warnings`|`errors`|`blocking`), `stage_readiness`
(per `DealStage`), `issues` split into `errors`/`warnings`/`info`, and
`deal_flags`: the Format §5.2 bands the deal crosses, which never count toward
the status (RFC 0109). `policy.financial_validity_errors` (from an institution
config) raises a listed code's error band to an `error` issue. Each
`ValidationMessage` carries a `code` and (when a registry entry exists) a `title`,
`remediation`, and `spec_ref` pulled from `BUILTIN_REMEDIATIONS` via
`lookupRemediation`.
Its `field` is the dotted path from the block payload root (or the frontmatter
root), with array elements by index: `_meta.provenance.source`,
`tranches[1].position` (Protocol §III.6a, RFC 0104). A frontmatter-scoped issue
has `section: "frontmatter"`. Issue order is not part of the contract, with
one exception: the RFC 0093–0096 metadata and payload passes keep their fixed
order.

**Validation code families** (all defined with copy in `BUILTIN_REMEDIATIONS`):
- `INVALID-DEAL-STAGE-001`, `INVALID-TIER-001`, `INVALID-STATUS-001`, `INVALID-RECOMMENDATION-001` — closed non-null frontmatter values (RFC 0118); absent/null are unstated, and invalid stages do not run DQ-06.
- `CC-01..CC-10` — cross-section consistency (NOI/DSCR/LTV/cap/sources-uses/…). RFC 0119 evaluates non-positive model NOI in CC-05/06 against $500 absolute, while positive NOI retains its existing percentages.
- `DQ-01..DQ-06` — data quality (provisional/partial blocks, scope readiness, stale gaps and missing stated sections). RFC 0116 makes readiness cumulative; empty/all-null scaffolds do not count, scope uses the class primary size or valuation price, and class sections enter at screening.
- `INT-01..INT-04` — integrity (parent/content hash chain), `INT-05..INT-08` — block signatures (RFC 0010) — surfaced by `integrity.ts`.
- `POL-01..POL-02` — provenance/policy (unauthorized actor, replace-where-supersede).
- `FV-01..FV-15` — financial validity vs. thresholds (cap, DSCR, LTV, debt yield, IRR, vacancy, opex, LTC…),
  read at every Format §5.2 home (`quick_metrics` and the section field), one
  finding per home at the worst band crossed (RFC 0105). Reported as
  `deal_flags` with a `band`, not as issues, unless an institution escalates
  the code (RFC 0109).
- `DQ-07..DQ-09` — scenario vocabulary, BTR subtype agreement and class scope
  (RFC 0072); warnings in both format generations, no stage or math changes.
- `UNSUPPORTED_YAML_FEATURE` — frontmatter outside the YAML subset.
- `SOURCE_BLOCK_MALFORMED` — a structured block body that is not one I-JSON
  object (RFC 0106); `parseUWFile` throws it as a `UWMDParseError` with the
  block's line, so a non-strict parse no longer keeps a `_parse_error` block.

## editor.ts (starter editor)

`applyEdit(content, parsed, op, ctx, …, opts) → EditResult` and the async
`applyEditAsync` (used when an edit must stamp content/parent hashes). Dispatches
over four `EditOperation` kinds (`protocol.ts`): `frontmatter_set`,
`section_replace`, `section_supersede`, `pipeline_log_append`.

It enforces edit policy: `resolvePolicy` matches `_meta.provenance.source` against
`BUILTIN_EDIT_POLICIES` to decide authority (`agent_only`/`human_only`/`either`/
`system_only`) and whether the edit must supersede (append) or may replace.
`_meta.provenance.source` is actor-only under RFC 0031 — `manual` or `<namespace>/<id>`
parsed by `parseActorSource` (never prefix tests); resolution methods live in
the separate optional `_meta.provenance.resolution`, and the table ends in a `*`
catch-all so every source resolves the conservative policy. **The
golden rule of the editor:** bytes outside the modified region are preserved exactly
(round-trip stability). Failures return a typed `ProtocolError` in
`EditResult.error` (e.g. `INT-02` stale parent hash, `POL-01` unauthorized actor).

## renderer.ts (starter renderer)

`render(parsed, options) → RenderResult`. Formats: `json`, `csv`, `chat`
(token-budgeted context string for an LLM), `summary` (markdown).
`chat`/`summary` are the formats exercised by the `documents` corpus (starter-product renders, RFC 0078). The `pdf` and
`docx` enum values are reserved for dedicated pipelines; requesting either from
the core renderer throws typed `UnsupportedRenderFormatError` instead of
returning empty content. Use `report.ts` (HTML) plus `@uwmd/report` for PDF.
`RenderOptions` include `format`,
`tier` (`screener`|`analyst`), and `maxTokens`.

## report.ts (starter report renderer)

`renderReportHtml(parsed, opts?) → ReportResult` implements the starter
[renderer reference](../starter/rendering.md) **§7.1 Lender Package** (tier `screener`, 10 sections from cover page to
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

## uwjson.ts — the `.uw.json` sibling form (Reader)

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
`''` — there is no canonical Markdown byte stream behind a `.uw.json`, so the
byte-preserving `applyEdit` still needs the `.uw.md`; read/validate/calc
consumers do not.)

- `toUWJson(parsed, opts?) → UWDocumentEnvelope` — converts the parsed model to
  Envelope 2.0; superseded history is included by default.
- `stringifyUWJson(parsed, opts?) → string` — pretty-printed UW JSON 2.0.
- `stringifyUWJsonWithDigest(parsed, opts?) → Promise<string>` — adds the
  canonical `semantic_digest` used by CLI exports and cross-format checks.
- `parseUWJson(text) → UWDocumentEnvelope` and `parseUWJsonVerified(text)` —
  structural parsing, with optional digest enforcement.
- `fromUWJson(doc) → ParsedUWFile` — rehydrates the in-memory model.
- `CodecRegistry`, `CORE_CODEC_REGISTRY`, `UW_JSON_CODEC`, and `UW_XML_CODEC` — discover and invoke model codecs by ID, media type, or filename.
- `stringifyUWXml(envelope)` / `parseUWXml(text)` — deterministic UW XML 2.0 with digest verification and secure parsing limits.
- `encodeUWCSVBundle` / `decodeUWCSVBundle` — normalized directory form; `encodeUWCSVZip` / `decodeUWCSVZip` provide deterministic bounded ZIP interchange and all six views.
- `createUWHTTPResponse` / `decodeUWHTTPRequest` / `assertUWIfMatch` — negotiated model bytes, semantic ETags, and optimistic concurrency.
- `createUWMCPResource` and `createUWMCP*Result` — text/blob resources, compact structured results, JSON fallback, and resource links.

CLI: `uwmd export <file.uw.md>` writes a digested `.uw.json` (`--stdout` to pipe; all supplied history retained). `uwmd convert <file> --to uw-json|uw-xml|uw-csv-bundle` converts Markdown and all verified model representations through the shared envelope.

> **Status — normative Envelope 2.0 / UW JSON 2.0 implementation.** The schema is
> `spec/schemas/uw-document-envelope.schema.json`. This is model-lossless, not
> byte-preserving: Markdown source bytes remain exclusive to the `.uw.md` source
> adapter.
## runner.ts

The generic write path for any producer, including a host that runs its own
agents (the toolkit runs none). `buildMeta(...)` constructs a `_meta`;
`writeAgentBlock(...)` writes a section block (superseding the prior version,
bumping `version`, updating pipeline state, appending a `pipeline_log` entry);
`writeErrorEntry(...)` records a failed agent run.

## cascade.ts + defaults.ts

`resolveValue(fieldPath, parsed, …)` walks the **fallback cascade** (`CASCADE_ORDER`
in `starter-protocol.ts`): `user_override → user_input → investor_profile → market_data →
asset_class_default → global_default → system_default`. Asset-class defaults are
published `{low, central, high}` ranges with citations in `defaults.ts`, one
table per builtin class. A resolved default carries its table
(`resolved_from`) and its entry's `citation`, so a starter proxy stays labelled
as one. A table may omit a field outright (land's and mixed-use's income
fields; data center's expense ratio, which producers state); the cascade then
falls through to the host's global/system default and never borrows another
class's table. The CLI `uwmd scope` command materializes the full resolved
triage view, reporting the stated builtin as `asset_class`.
In-file steps read a block's payload through `blockPayload` (the block minus
its reserved members `_meta`, `_role`, `_overrides` and `_notes`), as the calc
evaluator does.

For a section stated as a variant map, the in-file steps read only the block
`resolveSectionBlock` (`section-resolution.ts`, RFC 0066) selects. The
selection is `CascadeContext.sectionVariants`, then `sectionRoles`, then RFC
0040's generic order. When no block can be selected, resolution throws
`CALC-RESOLVE-002` rather than reading the first fence; `uwmd scope` reports
that field as refused.

## refinement.ts + gaps.ts

`gaps.ts` detects open data gaps. `refinement.ts` `rankGaps(parsed, opts)` ranks
them by **value of information** (VOI): which missing input, if filled, would
tighten the most calc outputs. It uses `extractDependencyGraph` (`calc/dependencies.ts`)
and perturbation over the default ranges. Exposed via `uwmd refine`.

## integrity.ts

The shared JCS serializer rejects unpaired UTF-16 surrogates with `TypeError`,
including object member names, before conversion to UTF-8. Valid surrogate pairs,
U+FFFD, control escaping and UTF-16 key ordering are preserved exactly; Unicode
is never normalized. This enforces the already adopted RFC8785 string domain.
Invalid strings formerly accepted through replacement UTF-8 cannot retain a
verified subject by sanitization. For invalid **source** Unicode, receipt
verification reports RCP-09 and document authentication reports INT-15 before a
backend is invoked. Unencodable signed receipt inputs use existing RCP-01;
unencodable stated-result digests use late RCP-04, and issuance uses the typed
RCP_COMPUTATION_FAILED refusal. Document artifact input uses malformed/INT-09
before version/source/backend checks; malformed block signing input uses INT-07.
Direct helpers retain typed refusal. Unsigned/excluded metadata is not globally
reclassified. Encoding-valid unsupported signature subjects retain INT-14, and
the XML 2.0 carrier enforces its frozen XML 1.0 character and lexical rules.
Backend exceptions are not relabeled by narrow Unicode catches. The accepted
complete Envelope identity is coordinated separately from V.9/V.11/V.12 and
receipt results; no historical source or artifact is repaired.


`verifyChain(parsed, options?)` (async) checks the `content_hash`/`parent_hash`
supersede chain; `verifyProvenance(parsed, policies?)` checks actor/policy
authority. `integrity-canonical.ts` `canonicalize()` defines the canonical form
hashed by `computeBlockHash`. Both feed the `uwmd verify` command and the
`documents/malformed/` conformance fixtures (INT-/POL- codes).

**Block signatures (RFC 0010, protocol §V.11).** `_meta.integrity.signature` is optional
and, like `content_hash`, excluded from canonicalization. Core owns only the
crypto-free half: the wire type `UWBlockSignature`, and
`canonicalBlockSigningInput()` / `blockSigningPayload()`, which build the exact
RFC 8785 string a signature covers — six fields (`content_hash`, `section`,
`actor`, `timestamp`, `kid`, `signed_at`) and nothing else. The algorithms live
in [`@uwmd/signing`](../../packages/uwmd-signing/README.md) and reach core
through `VerifyChainOptions.signatureVerifier`.

Without a verifier, `verifyChain` reports `signatures_present` with
`signatures_verified: 0` — present and *unchecked*, never valid. With one it
emits `INT-05` (signature with no hash), `INT-06` (kid the store does not
hold), `INT-07` (does not verify, unadmitted algorithm, or a stamped hash that
no longer recomputes), and `INT-08` (deprecated algorithm, a warning).

`INT-06` is never folded into `INT-07`: "I cannot check this" is a
configuration problem and "this is forged" is a document problem, and they call
for opposite responses. Note that a drifted hash escalates from `INT-04
warning` to `INT-07 error` once a block is signed.

`@uwmd/signing` accepts signature bytes only as canonical unpadded base64url:
padding, non-zero unused bits, impossible encoded lengths and wrong decoded
widths are `malformed` (`INT-07` for blocks). Ed25519 and ES256 use 64 bytes;
ES384 uses 96. This shared check also covers receipts and module manifests.
Key imports use a separate decoder that accepts padded base64.

## asset-class.ts

Module-declared asset classes (RFC 0003). The twelve builtins (RFC 0080 added
`data_center` and `manufactured_housing`) form a **closed** union that grows
only by RFC; a custom class is reverse-DNS with at least three lower-snake-case
segments, so ownership is fixed at the identifier.

**`AssetClass` is not widened, and that is load-bearing.** The RFC proposed
folding custom ids into the union; in TypeScript that collapses to `string` and
silently disables `ASSET_CLASS_MEMBERS`' exhaustiveness anchor, every
pack/layout narrowing, and the RFC 0027/0029 class tables. `UWAssetClassId`
(`AssetClass | (string & {})`) is used only at the boundary — frontmatter and
module declarations. Anything needing a builtin still asks for `AssetClass`.

`resolveAssetClass(id, registry, options)` returns exactly one of three
statuses — `resolved`, `degraded` (`MOD-FALLBACK-001`), `unresolved`
(`MOD-MISSING-001`) — and determinism holds in all three: no two conforming
hosts read the same file differently.

`knownDeclarations` is separate from the registry on purpose: a cached
declaration can only ever produce `degraded`, never `resolved`. It gives a
display name and a fallback; what "loaded" means is the module's calculations
and validations.

Validation (`INVALID-ASSET-CLASS-001/002`, `MOD-DEPENDENCY-UNDECLARED`) checks
only what is true for every reader. Resolution findings are *not* validation
rules — folding them in would make the same file valid or invalid depending on
who ran it.

## module-runtime.ts

The consumer the module system never had (RFC 0006). Registering a manifest is
not the same as honoring it: before this, `calculations` were reachable only by
a host that evaluated them itself, `validations` were shape-checked at load and
never executed, and `sections` were declared and never looked for.

- `evaluateModuleCalculations(parsed, registry)` — every applicable module's
  calcs in **declaration order**, threading each result into the next as
  `prior_results`. Order is the author's: `revpar_index` divides `revpar`.
- `validateAgainstModules(parsed, registry)` — the rules, plus required-section
  presence. A rule asserts what must be TRUE and fires only on `false`; a rule
  evaluating to `null` is **silent**, because absence is not violation.
- `checkModuleSections(parsed, manifest)` — presence only. Validating contents
  against the declared JSON Schema needs a validator core does not depend on.

**Declaration conflicts and overrides (Protocol §VII.3, RFC 0074).**
`createModuleRegistry` tracks, per namespace, which module's declaration is
in effect for each section id, calculation id and view-model `section_id`.
Any refusal refuses the whole registry.
- **Overrides.** A module may redeclare an id only if it names the current
  owner in its own `depends_on`. It then becomes the owner. Otherwise the
  code is `PROTO-MOD-080`, `-081` or `-082`. That covers unrelated
  modules, sibling dependents, a transitive-only path, and a module that
  names A while B's override of A is in effect.
- **`PROTO-MOD-083`, prior-result readers.** A calculation reading an
  overridden id must be the overriding module's own, declared after the
  id, or belong to a module that depends on the overriding module. The
  exemption is the first declarer's calculations before the id. A
  replacement that reads its own id is refused. Reads come
  from the parsed expression (`priorResultReads`: identifiers and path
  heads only). The check runs from whichever side loads second, so the
  verdict does not depend on listing order.
- **`PROTO-MOD-084`, scope.** The overriding module must apply wherever
  the overridden one does: `asset_classes` plus `declares_asset_classes`,
  with none meaning every class (`coversScope`).
- **Runtime.** `evaluateModuleCalculations` skips an overridden
  calculation, so the replacement runs once, in its own module's
  declaration order. `validateAgainstModules` checks only the effective
  section declaration. `getModuleCalculationsForAssetClass` lists the
  effective declaration once per id, and substitutes it when the owner
  is not among the listed modules.
- **Ownership is internal.** It lives in a `WeakMap` beside the registry
  (`declarationOwnersOf`, `ownsDeclaration` in `modules.ts`, not
  exported from `index.ts`). `ModuleRegistry` is unchanged, and a
  hand-built registry has no overrides.
- **`checkModuleSections(parsed, manifest)`** takes no registry, so it
  checks one manifest's own `required` flags whether or not they are
  overridden. Use `validateAgainstModules` for effective declarations.
- **No new loader check for the Protocol floor.** An overriding manifest's
  `requires_protocol` floor (§X, RFC 0074 P6) is enforced by the existing
  `PROTO-MOD-030`.
- **Within one manifest**, two view models for one `section_id` are outside
  §VII.3 and are not refused. Sections and calculations already refuse
  duplicates (`-036`, `-015`).

No new evaluation machinery: a rule is a §VIII.1 safe expression run through
`evaluateCalc`. A module able to evaluate what the calc engine cannot would be
a second unsandboxed language reachable from a third-party manifest.

`MOD-CALC-ERROR` exists because an unresolved identifier evaluates to `null`
(§VIII.2) — so a calc depending on a broken one *succeeds* with no value and
every rule reading it falls quiet. One typo silently disables everything
downstream, and this issue is often the only trace.

## module-signing.ts

Module manifest signatures (RFC 0002, protocol §X.1). Same layering as block
signatures: core owns `moduleSigningPayload()` (RFC 8785 over the manifest with
`signature` **removed**, not nulled, so signing and verifying see identical
bytes), the structural checks, and the verdict taxonomy;
[`@uwmd/signing`](../../packages/uwmd-signing/README.md) supplies the verifier.

Five verdicts, and three of them must not be merged — `PROTO-MOD-068` missing
(nothing was claimed → decide a policy), `-071` unknown key (something was
claimed and this host cannot check it → load a key), `-072` invalid (something
was claimed and it is false → reject the module). Plus `-069` unsupported
scheme and `-070` malformed, which is separate from invalid so an author with a
missing `signed_at` is not sent hunting for tampering.

`loadModuleManifestAsync` / `createModuleRegistryAsync` apply a host policy —
`ignore` (default), `verify-if-present`, `require`. A malformed signature is
refused even under `ignore`: declining to verify is not a licence to admit
nonsense into a frozen manifest. The sync loaders are untouched.

`identity` is advisory. A signature proves the key holder asserted it, never
that the assertion is true.

## receipts.ts

Implements [`spec/UW_RECEIPT.md`](../../spec/UW_RECEIPT.md) (RFC 0016).
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
  collapsing them into `verified` is dangerous. Supply
  `createReceiptSignatureVerifier` from `@uwmd/signing` as `signatureVerifier`
  and a signed receipt verifies for real instead of reporting `RCP-08`.
- Subject canonicalization dispatches on representation: Lite records bind to
  the §6 financial canonical form, structured records to the envelope semantic
  value. Both are semantic, so a receipt survives reformatting and fails only on
  financial change.
- Uncomputed outputs carry `computed: false` rather than a value. The calc
  engine reports "inputs absent" as a successful evaluation to `null`; a receipt
  must not let that read as a computed number.

**Engine identity.** A receipt records the engine that computed its results,
and a verifier compares the receipt's engine with its own (`RCP-07` when they
differ, UW Receipt §5.3). That engine is `@uwmd/verify` at `VERIFY_VERSION`
for every receipt, including one issued through `@uwmd/core` or the CLI, so a
verifier holding only `@uwmd/verify` (a lender, the VS Code extension) reports
a tampered core-issued receipt as `failed`, not `unverifiable` — the RFC 0078
boundary test. The `issuer` is the tool: `@uwmd/core@<CORE_VERSION>` through
core's `issueReceipt` (`receipt-engine.ts`), `uwmd-cli@<CORE_VERSION>` from the
CLI, `@uwmd/verify@<VERIFY_VERSION>` directly. Core re-exports verify's
`verifyReceipt` unchanged. An explicit `engine`, `engine_version` or `issuer`
wins either way.

Both issuance and verification are browser-safe (SHA-256 via Web Crypto), so the
web editor can verify client-side. Signature creation and validation stay
outside core, keeping it free of cryptographic dependencies.

CLI: `uwmd receipt issue <file>` / `uwmd receipt verify <file> <receipt.json>`
(exit 0 verified, 1 failed, 3 unverifiable). Conformance: `--suite=receipts`.

> A `verified` receipt attests that the record is unchanged and that its stated
> outputs follow from its contents. It attests **nothing** about whether those
> inputs are true. Do not surface it as an unqualified checkmark.

## protocol.ts (the contract surface)

The executable mirror of `UW_PROTOCOL.md`. It **re-uses** types from `types.ts`
(never duplicates them) and adds the protocol-layer types plus the `BUILTIN_*`
tables every conforming tool references:

- Versions: `PROTOCOL_VERSION` (1.2.0), `FORMAT_VERSION` (1.1).
- Tiers/capabilities: `ConformanceTier`, `ViewerCapability`, `ImplementationManifest`, `RepresentationCapability`.
- View models in manifests: `SectionViewModel`, `FieldViewHint` (module
  `view_models`). The display defaults and the builtin registry live in
  `starter-protocol.ts` (below).
- Edits: `EditOperation`, `EditPolicy`, `EditAuthority`, `BUILTIN_EDIT_POLICIES`.
- Cascade: `CascadeStep`, `SOURCE_TAGS` (`CASCADE_ORDER` is in `starter-protocol.ts`).
- Incomplete data: `IncompleteDataPolicy`, `GapAction`,
  `BUILTIN_INCOMPLETE_DATA_POLICIES`, `lookupIncompleteDataPolicy`.
- Stage contract (RFC 0009 merge): `STAGE_CONTRACT` (the single registry
  validators consult — presence + class overlays + provisional policy in one
  row shape), `StageContractEntry`, `lookupStageContract`,
  `requiredSectionsFor`; the compact authoring tables
  (`STAGE_REQUIREMENTS`, `STAGE_SECTION_OVERLAYS`) moved here from
  `validator.ts` and the registry is derived from them at module init, so
  the two views cannot disagree.
- Calc contract: `CalcEvaluationContext`, `CalcResult`, `ModuleCalcDecl`.
- Modules: `ModuleManifest` mirrors `module-manifest.schema.json`: `ModuleConformanceRequirements` (`requires_conformance` plus optional `requires_profiles`) and the section/calc/validation/view-model declarations;
  `modules.ts` validates and registers declarative v1 manifests.
- Errors: `ProtocolError`, `ProtocolErrorCategory`.
- Remediations: `IssueRemediation`, `BUILTIN_REMEDIATIONS` (CC/DQ/INT/POL/FV copy).

`starter-protocol.ts` holds the tables that serve the starter products, not
verification (RFC 0078 D10/D11, RFC 0083): `DEFAULT_NUMBER_FORMAT`,
`DEFAULT_DATE_FORMAT`, `NumberFormatRules`, `DateFormatRules`, the badge types,
`ViewModelRegistry` and `BUILTIN_VIEW_MODELS`, `CASCADE_ORDER` and the
capability-token types (`CapabilityVerifier`, …).
`index.ts` and `browser.ts` export them under the same names. `protocol.ts`
(in `@uwmd/verify`) never imports it. `REFERENCE_IMPLEMENTATION_MANIFEST`,
which names `org.uwmd.core` and claims the starter capabilities, is core's
`reference-implementation.ts`; the `ImplementationManifest` type and the tier
and profile vocabularies stay in `protocol.ts`.

> **Keep `protocol.ts` and `spec/schemas/*.schema.json` in lockstep.** The
> `ModuleManifest` interface explicitly mirrors `module-manifest.schema.json`.
>
> For modules that lockstep is now **checked**, not merely requested. Core
> cannot carry a JSON Schema validator — the layering invariant admits no
> such dependency — so `modules.ts` re-implements the schema by hand, and a
> hand-written mirror drifts. It had: `sections`, `view_models`, and agent
> layer declarations (removed by RFC 0112) were declared in the schema and
> validated nowhere, unknown keys
> were accepted at every level, and the schema's `deal_stages` enum had gone
> stale in the other direction by omitting `scope`. The `modules` conformance
> suite now runs every fixture through both ajv and the loader and fails if the
> verdicts disagree. See [09](09-conformance-testing.md) and
> `conformance/modules/README.md` for the two permitted, individually justified
> exceptions.

## The standard set and the closure test (RFC 0083)

RFC 0083 split the reference implementation of the standard, `@uwmd/verify`,
out of core. Phase 1 drew the line inside core; Phase 2 moved the standard set
into `packages/uwmd-verify`: the reader, validation, the stated-figure
verifiers, `calc/`, the metric dictionary and `metric-verification.ts`,
receipts, integrity, modules, the builtin pack manifests (`builtin-packs/`),
the representation, portfolio, sensitivity, stochastic and market-data
profiles, the read side of `bindings.ts`, and `protocol.ts`. Everything else
(editor, runner, cascade, defaults, refinement, `gaps.ts`, display formatting
and `calc-display.ts`, `starter-protocol.ts`, `bindings-edit.ts`,
`receipt-engine.ts`, `reference-implementation.ts`, the Excel emitter,
renderer, report, layer context, CLI) is the starter toolkit in `@uwmd/core`.

Verify's `src/standard-closure.test.ts` keeps the package closed. It lists the
standard set as file paths (every source file must be on the list or be one of
the two entries) and parses each one (`import`/`export … from`, dynamic
`import()` and `import('…')` types). It fails when a source file imports
anything but another source file of the package, `fast-xml-parser`, `fflate`,
or the one runtime-guarded `await import('node:crypto')` in `integrity.ts`
(Web Crypto elsewhere); when it names `@anthropic-ai/sdk`; and when
package.json names any `@uwmd/*` package. A standard module needs a starter
service only through injection, as `bindings.ts` takes its edit adapter; a new
standard module goes on the list. Core imports standard code only through
`@uwmd/verify`'s public entry (invariant 2), so a symbol core needs is
exported from verify (and therefore re-exported by core).

The lender's boundary test (RFC 0078) is now executable as a package:
`verify-packages` installs only `@uwmd/verify`'s tarball and its two runtime
dependencies, type-checks a consumer of both entries and runs it, and
`conformance/metrics/controls.mjs` asserts the metrics verifier's import graph
reaches no core module.

`verifyStatedMetrics(parsed, options?)` (`metric-verification.ts`) checks every
numeric statement of the document's dictionary metrics and returns one
`verified`, `failed` or `unverifiable` result per statement. Where a document
states a metric is the dictionary's closed `statement_bindings` registry
(RFC 0099): `quick_metrics.<id>`, `<id>` at each output section root, and each
alias path (`valuation.going_in_cap_rate`, `debt_structure.sizing_metrics.dscr_underwritten`,
…). Every bound address is checked and counted separately. Stated precision
(RFC 0079) comes from the source: each block's `rawJson` and the frontmatter
text. A document decoded from an envelope or another representation
(`fromUWEnvelope`) has neither, so pass `options.statedDecimals` (keyed by
`section.path` or `quick_metrics.<id>`); without it a rounded statement is
`unverifiable` with reason `missing_stated_precision`.

## Where to start, by task

Paths below are relative to the package that owns the module (see the
module map): `parser.ts` is `packages/uwmd-verify/src/parser.ts`, `editor.ts`
is `packages/uwmd-core/src/editor.ts`.

Goal | Start here
---|---
Parser bug | `parser.ts` + `parser.test.ts`
New validator check | `validator.ts` (register copy in `BUILTIN_REMEDIATIONS`)
New calc builtin | `calc/builtins.ts` + `calc.test.ts`, then `packs/excel-emit.ts`
New derived metric | the relevant file in `builtin-packs/` (one place, all tools pick it up), after its `spec/metrics/` entry
New edit semantics | `editor.ts` + `protocol.ts` (`EditOperation`/policy)
New display formatter | `format.ts` + the relevant `BUILTIN_VIEW_MODELS` entry

## RFC 0070 binding verification (Protocol 2.21.0)

`validateUWFile` remains synchronous and checks funding shape, selection,
rows, digest syntax, sign, timing and escrow consistency. It reports no error
solely because hashing has not run. New Node/browser exports
`computeReplacementCashFlowBindingDigest(series, variant, rowIndex, currencyCode)`
and `verifyReplacementFundingBindings(parsed)` use the existing JCS/SHA-256
seam, snapshot before awaiting, and return a separate result.

States are `verified`, `failed / stale_binding` (HDG-09),
`unverifiable` (invalid_structure, unresolvable_source or crypto_unavailable),
and `not_checked`. The verifier returns not_applicable for lawful legacy
funding; not_invoked is a consumer's initial status. Unchecked never means
verified. Complete outright success requires structural success plus verified.
The digest protects consistency, not payment purpose or executed-trade evidence.
RFC 0070 is implemented after shipment and independent publication verification.
Published core/CLI 2.17.0 pair with Stable Protocol 2.21.0 and Format 2.0;
see [the publication record](https://github.com/UWMD-OSP/UW-Markdown/blob/main/docs/releases/2.17.0-publication.md).

## RFC 0064 property reserve accounts

Optional, asset-class-independent `reserve_accounts` (Format §4.28) carries closed source-attributable property custody facts. `reserve-accounts-structure.ts` checks ordinary `RSV-01`–05 structure; browser-safe `verifyReserveAccounts` in `reserve-accounts.ts` separately checks stated balances and claimed continuity using the existing 2dp half-away currency boundary. Results include the Envelope semantic source digest and ordered account/period/movement evidence; absent data is `not_checked`. CLI: `uwmd verify-reserve-accounts <file> --json`. The default and portable `conformance/reserve-accounts/` suite uses synthetic source-shaped classifications and typed refusals. Gross capex stays gross and RFC 0045 reserve refusal remains unchanged.

## RFC 0065 reserve draw bindings

`reserve-draw-bindings.ts` exports browser-safe `verifyReserveDrawBindings(parsed, plan?)`. Its optional external `ReserveDrawBindingPlan` uses exact variants, reserve account/period/movement identities, lease-up TI/LC components or gross cash-row addresses, declared selected-draw completeness and explicit funded shares. `RDB-01`–09 findings and the two companion schemas mirror Protocol §VIII.12. CLI: `uwmd verify-reserve-draws <file> [plan.json] --json`. Synthetic default/portable fixtures, shared-quantizer cent controls and regressions preserve gross rows and the unchanged RFC 0045 reserve refusal. No document field, transfer, owner cash or financing assembly is added.

## Document snapshot signatures (RFC 0084)

`packages/uwmd-verify/src/document-signatures.ts` provides
`resolveDocumentSigningSubject`, `documentSigningPayload` and
`verifyDocumentSignature` with crypto injected through
`DocumentSignatureVerifier`. Source scanning observes blocks before parser
routing via `ParseOptions.onBlock` and frontmatter members before assignment
via `onFrontmatterMember`; guards reject duplicate active selection,
lost source blocks, repeated/historical extensions, conflicting identity or
lifecycle declarations, duplicate JSON/YAML members and ambiguous fence values.
The subject reuses the existing envelope semantic digest with history included.

`verifyChain` exposes optional `document_signature` when requested. Set
`requireDocumentSignature` to make any state other than `verified` fail overall
integrity. The parsed input must also match its authenticated raw source; a
filtered or mutated parsed object cannot borrow authentication from untouched
`raw`. Block signature counts and default block-only results retain their scope.
`INT-09`–`INT-15` identify document shape, crypto, subject, absence, unavailable
backend/key, unsupported version and source-accounting failures respectively.

Signing's `documents.ts` supplies `signDocument`,
`createDocumentSignatureVerifier` and reference CLI key import. CLI
`sign-document` atomically creates a detached artifact; `verify
--document-signature=<artifact> --keystore=<store>` requests required snapshot
authentication, with nonzero exit for missing/unreadable/unchecked artifacts.
`conformance/document-signatures/` and its generated portable cases test this
optional Integrity-profile capability independently of financial computation.

RFC 0117 extends the closed SIZE-01 table to declared mixed-use component
sizes and applies positive_size_denominator to the eight component per-size
metrics. Validation checks all current blocks; metric verification resolves
the selected component block without defaults or aggregation.

Whole-source reserve-draw binding uses the complete Envelope 2.0 identity,
including extension peers and history. A changed peer fails a stale plan with
RDB-02; a newly reviewed plan must explicitly name the changed source digest.
No plan is automatically refreshed. The selected V.12 payment-vector digest
remains a separate commitment.

`flattenEnvelopeBlockValues` projects admitted full carrier models.
`flattenUWSourceBlockValues(parsed)` instead projects the source model into
facts without requiring full carrier-schema admission; batch indexing retains
parseable records with validation findings. Neither fact projection authenticates
a source. `lakeInputFromEnvelope` recomputes its model key, while supplied lake
source-evidence/fact keys are propagation and storage inputs, not verification.

RFC0092 exports verifyProForma(sourceOrCurrentModel, options) and the closed
registry/wire types. Source operations retain physical order and source tokens;
model operations use current values and require caller tokens for LTV precision.
Inputs, relationships, assertions, base validation and ledger gaps stay separate.
The CLI verify-pro-forma is read-only. Reference support stays unclaimed pending
#551/#552; registry/schema availability is not certification.
