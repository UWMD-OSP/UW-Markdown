# 02 — The `.uw.md` format

> **Lite/UWX transition:** human-readable Lite now uses `.uw.md`; the
> structured format documented on this page is UW Extended Markdown and moves
> to `.uwx.md`. Legacy structured `.uw.md` remains readable with a migration
> warning. Lite's normative grammar is
> [`spec/UW_LITE_SPEC_v1.md`](../../spec/UW_LITE_SPEC_v1.md). The linked
> `UW_FORMAT_SPEC_v1.md` remains the structured specification until its
> compatibility rename is completed.

> Normative source: [`spec/UW_FORMAT_SPEC_v1.md`](../../spec/UW_FORMAT_SPEC_v1.md)
> (v1.1). This page is a working summary for code work; the spec is authoritative.
> Types live in [`packages/uwmd-core/src/types.ts`](../../packages/uwmd-core/src/types.ts)
> (see [07 — Data model reference](07-data-model-reference.md) for the type shapes).

## Anatomy of a file

A `.uw.md` file is three things stacked in one Markdown document:

```
┌─ YAML frontmatter ────────────────────────────────┐
│ uw_version, deal_id, deal_name, asset_class,       │  deal-level metadata
│ pipeline_state, quick_metrics, flags, …            │  (UWFrontmatter)
└────────────────────────────────────────────────────┘
# Prose heading + narrative (human-readable)

```json uw:section=noi_model source=agent/L2 ts=… v=2 confidence=high
{ "_meta": { … }, "_notes": "…", …section fields… }     ← a data block
```

…repeated per section, newest block last; superseded blocks kept inline…
```

Three coordinated representations:
- **Prose** — Markdown narrative a human reads. Carried per-section in
  `ParsedUWFile.prose`.
- **Data blocks** — fenced ```` ```json uw:… ```` blocks. Each is a `UWBlock`:
  an `annotation` (parsed from the fence line), a `_meta` provenance object, an
  optional `_notes` string, and the section's JSON fields.
- **History** — supersede semantics keep prior versions of a block inline
  (marked `superseded`), so the file is an append-only audit trail.

## Frontmatter

Parsed into `UWFrontmatter`. Key fields: `uw_version` ("1.1"), `deal_id`,
`deal_name`, address fields, `asset_class` (`AssetClass` union), `pipeline_state`
(per-layer `PipelineStatus`), `deal_stage` (`DealStage`), `quick_metrics`
(`UWQuickMetrics` snapshot), `flags[]`, `blocking_flags[]`.

> **YAML subset only.** Frontmatter MUST use the restricted YAML subset in the
> spec's Appendix A — scalars, simple mappings, dash-prefixed sequences. Anchors,
> tags, block scalars, complex keys, and directives are rejected with
> `UNSUPPORTED_YAML_FEATURE`.

## The fence annotation

The opening fence carries inline key=value metadata, parsed into
`UWFenceAnnotation`:

```
```json uw:section=debt_structure source=agent/L4 ts=2026-04-24T15:42:00Z v=2 superseded=false confidence=high variant=…
```

`section` is required; `source`, `ts`, `v`, `superseded`, `variant`, `confidence`
are recognized; unknown keys are preserved.

## The `_meta` object (provenance)

Every data block begins with `_meta` (`UWMeta`). This is the backbone of the
provenance model (`UW_FORMAT_SPEC_v1.md` Part III). Core fields:

Field | Meaning
---|---
`section` | Section ID this block belongs to
`version` | Monotonic integer; bumped on each supersede
`superseded` | True once a newer version replaces it
`source` | Where the value came from (`SourceTag`; e.g. `agent/L6-01`, `manual`, `document/rent_roll`, or a canonical short tag)
`agent_id` / `agent_version` | Producing agent identity (null for manual)
`actor` | Who performed the write (`"jared"`, `"system"`, …)
`timestamp` | ISO-8601
`confidence` | `high` \| `medium` \| `low`
`human_review_required` | Gate: true means a human must check before advancing
`flags[]` | Machine-readable anomaly tags (snake_case)
`input_hash` | Reproducibility anchor (`sha256:…`) or null

Optional integrity / quality fields (`UWMeta`, spec Part III §3.4):
`partial`, `provisional`, `field_overrides[]` (per-path overrides), `content_hash`
(sha256 of canonicalized content), `parent_hash` (the superseded block's
`content_hash`, forming a verifiable chain).

Universal optional field: every block also accepts a top-level **`_notes`** string
(free text, never validated, never consumed by agents/engine).

## The section registry (§4.0 – §4.22)

`UW_FORMAT_SPEC_v1.md` Part IV registers **23 numbered subsections**: **21
standard data sections (§4.0–§4.20)** + the extension meta-spec (§4.21) + gaps
(§4.22). "The 21 standard sections" = §4.0–§4.20.

§ | ID | Section
---|---|---
4.0 | `deal_context` | Overview, thesis, value creation, AI synthesis
4.1 | `property` | Physical asset: units, vintage, class, NRA, zoning, condition
4.2 | `ownership` | Current owner, acquisition terms, entity structure
4.3 | `rent_roll` | Unit/tenant lease detail (multifamily + commercial variants)
4.4 | `operating_statement` | T-12/T-3/YTD historical income & expense
4.5 | `noi_model` | Underwritten, normalized NOI
4.6 | `valuation` | Purchase price, cap rate, per-unit, exit assumptions
4.7 | `debt_structure` | Loan terms, LTV, DSCR, covenants
4.8 | `sources_uses` | Capital stack reconciliation
4.9 | `dcf` | Hold-period cash flows, exit, IRR, equity multiple
4.10 | `stress_tests` | Sensitivity scenarios (multi-variant)
4.11 | `market_analysis` | MSA/submarket fundamentals, comps
4.12 | `borrower_sponsor` | Sponsor strength, experience, guarantees
4.13 | `due_diligence` | Appraisal/PCA/ESA/zoning/survey status
4.14 | `risk_assessment` | Aggregate rating, key risks, recommendation
4.15 | `compliance` | OFAC, CRA, regulatory, policy flags
4.16 | `assumptions` | Assumptions registry — assumption sources & cascade record
4.17 | `validation` | Flags & validation summary
4.18 | `pipeline_log` | **Always last** — append-only execution audit
4.19 | `custom_calculations` | User-authored Tier-3 formulas
4.20 | `custom_scenarios` | User-defined what-if scenarios
4.21 | `x_*` | Extension-section meta-spec (non-standard content namespace)
4.22 | `gaps` | Open data gaps blocking stage advancement / provisional defaults

> The exact field schema for each section is in the spec under its `§ 4.x`
> heading. The `examples/Parkview-Apts-Glendale-AZ.uw.md` file is the canonical
> populated example. The display layer for these sections is
> `BUILTIN_VIEW_MODELS` in `protocol.ts` (note: the view-model registry is a
> *rendering convenience* and is not 1:1 with the spec's section registry).

## Multi-variant sections

`rent_roll` (multifamily/commercial), `operating_statement` (t12/t3/ytd/…), and
`stress_tests` (one per scenario) can hold multiple variant blocks. In
`ParsedUWFile.sections`, a single-variant section maps `id → UWBlock`; a
multi-variant section maps `id → { variantId → UWBlock }`. Code distinguishing the
two checks for the presence of `'content'`/`'annotation'` on the entry (see
`getSection` / `getSectionVariant` in `parser.ts`).

## Update semantics: supersede vs. replace

- **Supersede** (append-only): the prior block stays inline marked
  `superseded: true`; a new block with `version+1` is appended. Used for
  agent/document-sourced writes.
- **Replace** (in place): the block is overwritten. Used for `manual` edits.

Which one applies is decided by `BUILTIN_EDIT_POLICIES` (`protocol.ts`) matching
the block's `_meta.source`. The `compactor.ts` `compact()` produces a "live view"
by dropping superseded blocks; `diff()` compares two files section-by-section.

## Cross-section consistency (CC-NN)

`UW_FORMAT_SPEC_v1.md` §5.3 defines consistency checks the validator enforces;
their remediation copy lives in `BUILTIN_REMEDIATIONS` (`protocol.ts`). Examples:
CC-01 NOI mismatch (`noi_model.net_operating_income` vs
`quick_metrics.noi_underwritten`), CC-02 DSCR, CC-03 LTV, CC-04 sources/uses
imbalance, CC-05 cap rate. See [07 — Data model reference](07-data-model-reference.md)
and [03 — Core library › validator](03-core-library.md) for the full code families
(CC / DQ / INT / POL / FV).
