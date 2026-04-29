---
rfc: 0009
title: _meta v2 sub-object reorganization
status: draft
author: jaredmaxey
created: 2026-04-27
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0009: `_meta` v2 sub-object reorganization

## Summary

The block-level `_meta` object has grown to ~15 fields covering four
distinct concerns — provenance, quality, lifecycle, and integrity — but
they all live on a single flat record. This RFC proposes reorganizing
`_meta` into four named sub-objects (`provenance`, `quality`,
`lifecycle`, `integrity`) for v2.0 of the format. v1.x continues to
accept the flat shape; v2.0 readers SHOULD accept both forms via a
back-compat parser shim and v2.0 writers MUST emit the nested form.
This is the only RFC in this batch that proposes a breaking change to
the file format.

## Motivation

After Phase 1–3 of the v1.1 work landed (per
[`spec/UW_FORMAT_SPEC_v1.md`](../../spec/UW_FORMAT_SPEC_v1.md) Part III §3),
the `_meta` shape now has:

- **Provenance fields** — `source`, `agent_id`, `agent_version`,
  `actor`, `timestamp`, `notes`
- **Quality fields** — `confidence`, `human_review_required`, `flags`,
  `partial`, `provisional`, `field_overrides`
- **Lifecycle fields** — `version`, `superseded`
- **Integrity fields** — `input_hash`, `content_hash`, `parent_hash`,
  `signature` (RFC 0010 candidate)
- **Section-routing fields** — `section`

Three concrete problems with the current flat shape:

1. **Two surfaces for confidence.** `_meta.confidence` is block-level;
   `_meta.field_overrides[].confidence` is per-field. The precedence
   rule ("field_overrides wins for that path; block-level for everything
   else") is documented but the colocated keys obscure that
   relationship.
2. **Two surfaces for stage gating.** `STAGE_REQUIREMENTS` (in
   `validator.ts`) declares which sections must be present; the new
   `INCOMPLETE_DATA_POLICIES` table declares what to do when those
   sections are present but provisional. The two contracts overlap and
   the RFC 0009 reorganization is the natural place to merge them.
3. **Hash fields are visually adjacent to provenance fields.** A
   reader scanning `_meta` cannot distinguish "facts about who wrote
   this" from "cryptographic checksums of the content" without knowing
   the spec by heart. Worse, an LLM authoring a block by example can
   easily emit a syntactically valid but cryptographically wrong
   `content_hash` because the field looks like just another label.

The growth is bounded — there are no new categories of `_meta` field
on the horizon — but at 15 mixed-concern fields the surface is past
the point where a flat shape pays for itself.

## Proposed change

### v2 `_meta` shape

```ts
interface UWMetaV2 {
  /** Routing — which section this block belongs to. */
  section: string;

  /** Provenance: who/what produced this block. */
  provenance: {
    source: SourceTag;            // user_input | ai_extracted | …
    actor: string;                // 'user' | 'agent/L2' | 'system/gaps-maintainer'
    agent_id?: string | null;
    agent_version?: string | null;
    timestamp: string;            // ISO 8601
    notes?: string | null;
  };

  /** Quality: how trustworthy or complete the data is. */
  quality: {
    confidence: ConfidenceLevel;          // low | medium | high
    human_review_required: boolean;
    flags?: string[];
    partial?: boolean;
    provisional?: boolean;
    field_overrides?: FieldOverride[];
  };

  /** Lifecycle: where this block sits in the supersede chain. */
  lifecycle: {
    version: number;              // 1-based; first block of a chain is 1
    superseded: boolean;          // true on every block that is not the head
  };

  /** Integrity: cryptographic / structural verification. All optional. */
  integrity?: {
    input_hash?: string | null;
    content_hash?: string;
    parent_hash?: string | null;
    signature?: BlockSignature;  // RFC 0010
  };
}
```

### Migration story (the back-compat parser shim)

A v2 parser MUST accept v1.x flat-shape `_meta` and reshape it to v2
in memory before exposing it via `ParsedUWFile`. The reshape is
deterministic and lossless for v1.x inputs. Pseudocode:

```ts
function reshapeMetaV1toV2(flat: UWMetaV1): UWMetaV2 {
  const v2: UWMetaV2 = {
    section: flat.section,
    provenance: {
      source: flat.source,
      actor: flat.actor,
      agent_id: flat.agent_id ?? null,
      agent_version: flat.agent_version ?? null,
      timestamp: flat.timestamp,
      notes: flat.notes ?? null,
    },
    quality: {
      confidence: flat.confidence,
      human_review_required: flat.human_review_required,
      flags: flat.flags ?? [],
      partial: flat.partial ?? false,
      provisional: flat.provisional ?? false,
      field_overrides: flat.field_overrides,
    },
    lifecycle: {
      version: flat.version,
      superseded: flat.superseded,
    },
  };
  if (flat.input_hash || flat.content_hash || flat.parent_hash || flat.signature) {
    v2.integrity = {
      input_hash: flat.input_hash ?? null,
      content_hash: flat.content_hash,
      parent_hash: flat.parent_hash ?? null,
      signature: flat.signature,
    };
  }
  return v2;
}
```

A v2 writer MAY emit either shape but MUST emit the nested shape when
the file's `uw_version` frontmatter is `"2.0"` or higher. The nested
shape is invalid for `uw_version: "1.x"` files (validator emits a new
`META-V2-IN-V1` error code).

### Deprecation timeline

- **v1.2 (approximate Q3 2026):** flat shape remains the only valid
  form for `uw_version: "1.x"`. v2 nested shape rejected. Validator
  emits an info-level `META-V1-DEPRECATION-NOTICE` on every parse,
  pointing at this RFC.
- **v1.3:** writers (CLI, web editor, agent host) gain a
  `--emit-v2-shape` flag that produces a v2 file. Operators MAY adopt.
- **v2.0:** v1.x flat shape continues to round-trip via the back-compat
  parser, but v2 writers emit nested shape by default. v1.x consumers
  reading v2 files emit a clear error.
- **v2.2 or later:** flat-shape writers issue a deprecation warning at
  emit time. Spec §3 marks the flat shape "legacy."
- **v3.0 (no earlier than 2028):** flat shape removed from the spec.
  v2 readers continue to accept both via the shim; v3 readers MAY drop
  the shim.

### Confidence consolidation

In v2, `field_overrides` moves out of `_meta.quality` and into a new
top-level **block annotation**:

```jsonc
{
  "_meta": { /* v2 shape */ },
  "_overrides": [
    { "path": "units[7].current_rent", "confidence": "low", "reason": "illegible" }
  ],
  /* …block content… */
}
```

This separates "the meta-data about this block" from "the per-field
exceptions to that meta-data." The precedence rule is unchanged:
`_overrides` wins for paths it covers; `_meta.quality.confidence`
applies elsewhere.

### `STAGE_REQUIREMENTS` × `INCOMPLETE_DATA_POLICIES` merge

Both tables are restructured into a single `STAGE_CONTRACT` registry
keyed by `(stage, section, field_path?)`. Each entry declares:

```ts
interface StageContractEntry {
  stage: DealStage;
  section: string;
  field_path?: string;
  required: boolean;            // replaces STAGE_REQUIREMENTS
  on_provisional: GapAction;    // replaces INCOMPLETE_DATA_POLICIES
  on_partial?: GapAction;       // new: distinct from full-block provisional
  rationale?: string;
}
```

Validators consult one table instead of two. The merge is mechanically
derived from the v1 tables; no behavior change for default-policy
files.

## Compatibility analysis

- **Existing `.uw.md` files** — every v1.x file remains valid under
  `uw_version: "1.x"`. v2 parsers continue to read them via the shim.
  No file ever has to be edited to remain readable.
- **Tier-1 readers** — must implement the shim to claim v2 conformance.
  v1-only readers continue to work against v1 files.
- **Tier-2 editors** — gain a new emit mode (`v2-shape: true`). Default
  remains v1.x until `uw_version: "2.0"` is in the frontmatter.
- **Tier-3 calc hosts** — unaffected; calc inputs reference content
  fields, not `_meta` fields.
- **Tier-4 agent hosts** — must read provenance from `provenance.actor`
  in v2 instead of top-level `actor`. The `classifyActor` helper in
  `@uwmd/core` will accept either shape transparently.
- **Modules** — module manifests do not embed `_meta` shapes; no
  breakage.

This is the **only** breaking change in this batch. v2.0 cannot ship
without a working back-compat shim.

## Conformance impact

New fixtures (Tier-1):

- `tier-1-reader/v2-fixtures/01-nested-meta.uw.md` — minimal v2-shape
  file; validates clean.
- `tier-1-reader/v2-fixtures/02-mixed-shape.uw.md` — illegal: a v1.x
  file with nested `_meta`. Expects `META-V2-IN-V1` error.
- `tier-1-reader/v2-fixtures/03-shim-roundtrip.uw.md` — paired with
  `expected-shim-output.json`; verifies the v1 → v2 reshape is
  byte-identical to the recorded output.

Existing v1.x fixtures: untouched. The v2 fixtures live in a separate
sub-directory keyed off `uw_version`; the runner dispatches by
frontmatter version.

## Reference implementation

- **Files affected:**
  - `packages/uwmd-core/src/types.ts` — `UWMetaV1`, `UWMetaV2`, union
    type, reshape helper.
  - `packages/uwmd-core/src/parser.ts` — invoke shim when reading.
  - `packages/uwmd-core/src/render.ts` — `--shape=v1|v2` toggle.
  - `packages/uwmd-core/src/validator.ts` — new `META-V2-IN-V1`,
    `META-V1-DEPRECATION-NOTICE` codes; merged `STAGE_CONTRACT`.
  - `packages/uwmd-core/src/protocol.ts` — `STAGE_CONTRACT` registry.
  - `spec/UW_FORMAT_SPEC_v1.md` — Part III §3 rewrite (kept for v1.x).
  - `spec/UW_FORMAT_SPEC_v2.md` (new) — v2 normative text.
  - `spec/schemas/uwmd-block-v2.schema.json` (new).
- **API surface:** additive in v1.x (helpers); breaking in v2 (the
  shape itself).
- **Test plan:** round-trip every existing fixture through v1→v2→v1
  and assert byte-identical recovery (sans whitespace). Property test:
  shim is its own inverse.

## Alternatives considered

1. **Keep the flat shape forever.** The simplest path. Rejected — at
   15 fields the cognitive load is real, and every new category of
   metadata (e.g. RFC 0010's `signature`) makes it worse. The cost of
   migration is bounded; the cost of inaction grows with every field.

2. **Split `_meta` across multiple top-level keys instead of nesting.**
   E.g. `_provenance`, `_quality`, `_lifecycle`, `_integrity` as
   peers of the content. Rejected because it spreads the metadata
   surface across many keys instead of one, making it harder to
   identify "the metadata for this block" by structural inspection.
   The single-`_meta`-with-nesting shape is closer to how OpenAPI,
   JSON Schema, and CycloneDX organize their metadata.

3. **Replace `_meta` entirely with a sidecar header block.** A v2 file
   would have a leading header block containing all metadata for all
   subsequent blocks. Rejected — destroys the "each block is
   self-contained" property that makes the format work for streaming
   reads and partial extraction.

4. **Use JSON Schema `$defs` references to keep `_meta` flat but
   typed.** Cosmetic only; doesn't address the cognitive load issue.

## Unresolved questions

- **Should `lifecycle.version` be renamed?** `version` collides with
  `uw_version` in the frontmatter. Candidates: `seq`, `revision`,
  `chain_pos`. Defer to RFC review feedback.
- **Should `integrity` carry a hash algorithm field?** The protocol
  pins SHA-256 today, but a 5-year-out v2 might want SHA-3 or
  BLAKE3. Probably yes — add `integrity.algorithm` defaulting to
  `'sha256'` so the field is forward-compatible.
- **Per-section v2 adoption.** Can a single file mix v1 and v2 blocks
  by section? Probably no — a file's `uw_version` is global. But the
  shim could permit it for incremental migration; needs explicit
  decision.

## Prior art

- **OpenAPI 3.x → 3.1 transition.** Schema dialect change with
  long-deprecation; back-compat parsers are standard. We adopt the
  same pattern.
- **CycloneDX 1.4 → 1.5.** Component metadata reorganization with a
  `licenses` sub-object. Their tooling kept dual-shape parsing for
  three minor releases.
- **CommonMark 0.30 spec stability** — instructive counter-example.
  Resisting reorganization for stability has costs too; we accept the
  one-time migration cost in exchange for long-term clarity.
