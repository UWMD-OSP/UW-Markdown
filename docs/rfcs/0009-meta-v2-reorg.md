---
rfc: 0009
title: _meta v2 sub-object reorganization
status: implemented
author: jaredmaxey
created: 2026-04-27
revised: 2026-09-01
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0009: `_meta` v2 sub-object reorganization

> **Revised 2026-08-31, after [RFC 0031](./0031-source-vocabulary.md)
> implemented.** The original draft typed the nested provenance field as
> `source: SourceTag` — the short-form *resolution* reading (`user_input`,
> `ai_extracted`) — which would have baked one half of a conflated field into
> `provenance.source` for format v2.0 and permanently orphaned the actor
> vocabulary the edit engine runs on. RFC 0031 split the field at 1.x:
> `_meta.source` is actor-only, `_meta.resolution` carries the method. This
> revision carries **both** fields into the v2 `provenance` object, and also
> slots the `_meta` fields that landed since the April draft
> (`market_data_ref` from RFC 0022, `inherited_from` from RFC 0021, the
> shipped — no longer "candidate" — `signature` from RFC 0010, and
> `resolution` itself).

> **Revised 2026-09-01, at the sprint's Phase 4 gate.** The owner opened the
> 2.0 train. This revision makes the draft acceptance-ready: the four open
> questions are resolved (see [Resolved questions](#resolved-questions)),
> the previously missing canonicalization/integrity section is written
> ([§ Canonicalization](#canonicalization-integrity-and-signatures-across-the-shape-change)
> — the draft's own acceptance blocker), `manual` leaves `SOURCE_TAGS` at
> 2.0, and the deprecation timeline is re-anchored on the shipped 1.9.0:
> **1.10.0** is the `--emit-v2-shape` minor and **v2.0 is now scheduled**.

## Summary

The block-level `_meta` object has grown to ~18 fields covering four
distinct concerns — provenance, quality, lifecycle, and integrity — but
they all live on a single flat record. This RFC proposes reorganizing
`_meta` into four named sub-objects (`provenance`, `quality`,
`lifecycle`, `integrity`) for v2.0 of the format. v1.x continues to
accept the flat shape; v2.0 readers SHOULD accept both forms via a
back-compat parser shim and v2.0 writers MUST emit the nested form.
This is the only RFC in this batch that proposes a breaking change to
the file format.

## Motivation

After the v1.1 train and the RFC 0016–0031 arc landed, the `_meta`
shape now has:

- **Provenance fields** — `source` (actor, RFC 0031), `resolution`
  (method, RFC 0031), `agent_id`, `agent_version`, `actor`,
  `timestamp`, `notes`, `market_data_ref` (RFC 0022),
  `inherited_from` (RFC 0021)
- **Quality fields** — `confidence`, `human_review_required`, `flags`,
  `partial`, `provisional`, `field_overrides`
- **Lifecycle fields** — `version`, `superseded`
- **Integrity fields** — `input_hash`, `content_hash`, `parent_hash`,
  `signature` (RFC 0010, shipped)
- **Section-routing fields** — `section`

Three concrete problems with the current flat shape:

1. **Two surfaces for confidence.** `_meta.confidence` is block-level;
   `_meta.field_overrides[].confidence` is per-field. The precedence
   rule ("field_overrides wins for that path; block-level for everything
   else") is documented but the colocated keys obscure that
   relationship.
2. **Two surfaces for stage gating.** `STAGE_REQUIREMENTS` (in
   `validator.ts`) declares which sections must be present; the
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
on the horizon — but at ~18 mixed-concern fields the surface is past
the point where a flat shape pays for itself.

## Proposed change

### v2 `_meta` shape

```ts
interface UWMetaV2 {
  /** Routing — which section this block belongs to. */
  section: string;

  /** Provenance: who wrote this block, and how its values were resolved. */
  provenance: {
    /**
     * The actor (RFC 0031 grammar, format §2.6):
     * `manual | agent/<id> | document/<id> | system/<id> | institution/<id>`.
     * This is the field edit policies and authority classification key on.
     * At v2.0 the grammar is enforced: SRC-02 (a resolution tag here) is an
     * error, and the 1.x read-time interpretation ends — the same boundary
     * RFC 0025 set for legacy `.uw.md` sniffing.
     */
    source: string;
    /** How the value was resolved — one canonical SOURCE_TAGS member
     *  (`user_input`, `asset_class_default`, …). Optional; orthogonal to
     *  `source`. At 2.0, `manual` is no longer a member of SOURCE_TAGS
     *  (see § `manual` leaves the resolution vocabulary). */
    resolution?: CanonicalSourceTag;
    /** The principal that initiated the write (user identifier or system
     *  name). Distinct from `source`: `source` is the policy-vocabulary
     *  identity of the writer, `actor` is who asked for the write. */
    actor: string;
    agent_id?: string | null;
    agent_version?: string | null;
    timestamp: string;            // ISO 8601
    notes?: string | null;
    /** RFC 0022 §4 — REQUIRED when `resolution` is `market_data_accepted`. */
    market_data_ref?: MarketDataRef;
    /** RFC 0021 §5 — REQUIRED when `resolution` is `inherited_assumption`. */
    inherited_from?: InheritedFrom;
  };

  /** Quality: how trustworthy or complete the data is. */
  quality: {
    confidence: ConfidenceLevel;          // low | medium | high
    human_review_required: boolean;
    flags?: string[];
    partial?: boolean;
    provisional?: boolean;
    // field_overrides moves to the top-level `_overrides` annotation in v2
    // (see § Confidence consolidation).
  };

  /** Lifecycle: where this block sits in the supersede chain. */
  lifecycle: {
    /** 1-based chain position; first block of a chain is 1. Renamed from
     *  v1 `version` to avoid colliding with frontmatter `uw_version`
     *  (resolved question 1). */
    revision: number;
    superseded: boolean;          // true on every block that is not the head
  };

  /** Integrity: cryptographic / structural verification. All optional. */
  integrity?: {
    /** Hash algorithm for content_hash / parent_hash / input_hash.
     *  Defaults to 'sha256' when absent; 'sha256' is the only admitted
     *  value at 2.0 (resolved question 2 — the field exists for forward
     *  agility, not present choice). */
    algorithm?: 'sha256';
    input_hash?: string | null;
    content_hash?: string;
    parent_hash?: string | null;
    signature?: BlockSignature;  // RFC 0010 (shipped at 1.x as _meta.signature)
  };
}
```

`market_data_ref` and `inherited_from` sit in `provenance`, not
`integrity`: each names *where a value came from* (an observation set,
an asserting ancestor), and each is coupled to a `resolution` value —
the conditional-requirement rules RFC 0021/0022 state are unchanged,
merely re-anchored on `provenance.resolution`.

### One shape per file

A file's `uw_version` frontmatter is global and decides the shape for
every block in the file (resolved question 3). Mixing flat and nested
`_meta` in one file is invalid in both directions: nested `_meta` in a
`uw_version: "1.x"` file is `META-V2-IN-V1` (error), and flat `_meta`
in a `uw_version: "2.0"` file is `META-V1-IN-V2` (error). The shim
makes whole-file migration lossless and mechanical, so per-block
mixing would complicate every reader while buying nothing — "read
both shapes" is a property of *parsers*, never of a single *file*.

### `manual` leaves the resolution vocabulary

RFC 0031 left `manual` as both a legal actor and a legal member of
`SOURCE_TAGS`. At 2.0 the duplication ends (resolved question 4):
`manual` is **actor-only**. The resolution-method reading is covered
by `user_input`. Concretely:

- `SOURCE_TAGS` (the canonical resolution vocabulary) drops `manual`
  at protocol 2.0. Every consumer of the constant is touched; the
  actor grammar (`parseActorSource`, edit policies, authority
  classification) is unaffected — `manual` remains a legal
  `provenance.source`.
- In a v2 file, `provenance.resolution: "manual"` is invalid (an
  `SRC`-family error; exact code assigned at implementation alongside
  the SRC-02 escalation).
- `uwmd migrate --to-v2` rewrites `resolution: "manual"` →
  `resolution: "user_input"` and records the rewrite in
  `provenance.notes`. This is a migrate-time vocabulary repair, not a
  shim behavior — the shim stays purely structural (see next section).
- v1.x is untouched: `manual` remains legal in both positions for the
  life of 1.x, exactly as RFC 0031 left it.

### Migration story (the back-compat parser shim)

A v2 parser MUST accept v1.x flat-shape `_meta` and reshape it to v2
in memory before exposing it via `ParsedUWFile`. The reshape is
deterministic and lossless for v1.x inputs, purely **structural** (it
never rewrites vocabulary values — that is `uwmd migrate`'s job), and
it applies RFC 0031's read-time interpretation first — a canonical tag
in flat `source` becomes `provenance.resolution`, never
`provenance.source`. Pseudocode:

```ts
function reshapeMetaV1toV2(flat: UWMetaV1): UWMetaV2 {
  // RFC 0031 §4: a canonical SOURCE_TAGS value in the actor field is a
  // resolution method in the pre-split spelling.
  const legacyTag = isCanonicalSourceTag(flat.source) && flat.source !== 'manual';
  const v2: UWMetaV2 = {
    section: flat.section,
    provenance: {
      source: legacyTag ? undefined : flat.source,   // absent, not invented
      resolution: flat.resolution ?? (legacyTag ? flat.source : undefined),
      actor: flat.actor,
      agent_id: flat.agent_id ?? null,
      agent_version: flat.agent_version ?? null,
      timestamp: flat.timestamp,
      notes: flat.notes ?? null,
      market_data_ref: flat.market_data_ref,
      inherited_from: flat.inherited_from,
    },
    quality: {
      confidence: flat.confidence,
      human_review_required: flat.human_review_required,
      flags: flat.flags ?? [],
      partial: flat.partial ?? false,
      provisional: flat.provisional ?? false,
    },
    lifecycle: {
      revision: flat.version,
      superseded: flat.superseded,
    },
  };
  // flat.field_overrides lifts to the block-level `_overrides` annotation
  // (handled by the block-level reshape, not shown here).
  if (flat.input_hash || flat.content_hash || flat.parent_hash || flat.signature) {
    v2.integrity = {
      input_hash: flat.input_hash ?? null,
      content_hash: flat.content_hash,
      parent_hash: flat.parent_hash ?? null,
      signature: flat.signature,
      // algorithm omitted — absent means 'sha256'.
    };
  }
  return v2;
}
```

One wrinkle the split introduces: `provenance.source` is required in
v2, but a legacy-tag v1 block has no recoverable actor. The shim leaves
it **absent** rather than inventing one (the RFC 0031 rule), which is
the one case where the reshape of a v1 file is not schema-valid v2 —
by design, since `uwmd migrate --source-tags` exists precisely to
repair such files before a v2 migration.

A v2 writer MAY emit either shape but MUST emit the nested shape when
the file's `uw_version` frontmatter is `"2.0"` or higher (and MUST
emit the flat shape below that — see § One shape per file).

### Canonicalization, integrity, and signatures across the shape change

Moving `content_hash` and `signature` under `integrity.*` makes three
parts of Protocol §V shape-sensitive: the §V.9 exclusion paths, the
§V.9 "`_meta`-shaped object" detection heuristic (`version` + `source`
+ `section`/`section_id` — a triple the nested shape no longer carries
at one level), and every stored digest. This section is normative for
the v2 spec text.

**Canonicalization is versioned by `uw_version`, and frozen for v1.**
Files with `uw_version: "1.x"` keep §V.9 exactly as published —
flat-shape JCS with the v1 exclusion rule — forever. No stored v1
`content_hash` is ever invalidated by this RFC. A v2 reader verifying
a v1 file MUST use the v1 rule.

**Canonicalization v2 is defined over the reshaped form, so it is
shape-insensitive by construction.** For `uw_version: "2.0"` files,
the canonical form of a block is produced by:

1. **Normalize**: apply the structural reshape (the shim) to `_meta`,
   including the `field_overrides` → `_overrides` lift and the
   `version` → `revision` rename. (For a file already in nested shape
   this is the identity.)
2. **Exclude**: remove `integrity.content_hash`, `integrity.signature`,
   and — when it is absent-or-`'sha256'` — `integrity.algorithm` from
   the normalized `_meta`. Excluding a defaulted `algorithm` keeps the
   digest of today's blocks independent of whether the default is
   spelled out; a future non-default algorithm IS hashed, so it cannot
   be stripped undetected.
3. **Serialize**: RFC 8785 JCS, with the same byte-identity
   requirements as §V.9 (code-unit key sort, ECMAScript number
   ToString, `-0` → `0`, non-finite rejected, `undefined` dropped).

Because step 1 runs first, the two shapes a v2 parser accepts yield
**identical digests** for semantically identical blocks — the
dual-shape reader era cannot fork a block's identity. This satisfies
the requirement that a v1→v2 reshape of an unhashed block does not
change its semantic digest *within the v2 rule*; across the version
boundary digests differ by design and re-stamping is mandatory (next
paragraph). The `_meta`-shaped-object detection for nested exclusion
becomes: an object carrying `provenance` AND `lifecycle` AND either
`section` or `section_id` (the v2 triple), checked after
normalization; the v1 triple continues to apply before normalization.

**Migration re-stamps hashes; signatures do not survive it.**
`uwmd migrate --to-v2` recomputes `content_hash` and `parent_hash`
chains under the v2 rule for every stamped block. Because a §V.11
signature commits to the block's `content_hash`, re-stamping
necessarily invalidates every existing signature — a migrated
signature would fail `INT-07` immediately. A tool cannot re-sign
without the key, so:

- `migrate --to-v2` MUST refuse a file containing signed blocks by
  default, listing them.
- With `--resign` (and access to the signing key via the RFC 0010
  machinery) it re-signs each block over its new v2 digest, appending
  a note that the signature was re-issued at migration.
- With `--strip-signatures` it removes signatures and records each
  removal in `provenance.notes` (append-only provenance: the fact
  that a signature existed is preserved even though the signature
  itself cannot be).

This is the honest expression of invariant 5 — a signature is a
commitment to specific bytes, and migration changes the bytes; the
choice between re-signing and stripping belongs to the key holder,
never to the migration tool.

### Deprecation timeline

Re-anchored on the shared v2.0 boundary RFC 0025 established (legacy
`.uw.md` sniffing, Lite canonicalization 1.0, and RFC 0031's `SRC-02`
warning-to-error escalation all end/flip at Protocol 2.0), and — as of
this revision — on the shipped 1.9.0:

- **1.10.0 (the last planned 1.x minor):** writers (CLI, web editor,
  agent host) gain `--emit-v2-shape`, which writes a `uw_version:
  "2.0"` file in the nested shape (a whole-file conversion — see
  § One shape per file). `uwmd migrate --to-v2` ships here too, so
  operators MAY adopt ahead of the 2.0 release. Flat remains the
  default and the only valid shape for `uw_version: "1.x"`.
- **v2.0:** v1.x flat files continue to round-trip via the back-compat
  parser; v2 writers emit nested shape by default. v1.x consumers
  reading v2 files emit a clear error. `SRC-02` becomes an error; the
  read-time interpretation moves into the shim; legacy `.uw.md`
  sniffing and Lite canonicalization 1.0 sunset; `manual` leaves
  `SOURCE_TAGS`.
- **v2.2 or later:** flat-shape emit paths issue a deprecation warning
  at emit time. Spec §3 marks the flat shape "legacy."
- **v3.0:** flat shape removed from the spec. v2 readers continue to
  accept both via the shim; v3 readers MAY drop the shim.

Critical 1.x fixes remain possible after 1.10.0 (patch releases, or
further minors if 2.0 slips); "last planned minor" is a plan, not a
freeze.

### Confidence consolidation

In v2, `field_overrides` moves out of `_meta.quality` and into a new
top-level **block annotation**:

```jsonc
{
  "_meta": { /* v2 shape */ },
  "_overrides": [
    {
      "path": "units[7].current_rent",
      "confidence": "low",
      "resolution": "ai_extracted",
      "reason": "illegible"
    }
  ],
  /* …block content… */
}
```

This separates "the meta-data about this block" from "the per-field
exceptions to that meta-data." The precedence rule is unchanged and now
spec-stated (format §3.4, RFC 0031): `_overrides` wins for paths it
covers — `confidence`, `source`, and `resolution` alike —
`_meta.quality` / `_meta.provenance` apply elsewhere. `_overrides` is
block content for integrity purposes: it is inside the digest, exactly
as `field_overrides` is today.

### `STAGE_REQUIREMENTS` × `INCOMPLETE_DATA_POLICIES` merge

Both tables are restructured into a single `STAGE_CONTRACT` registry
keyed by `(stage, section, field_path?)`. Each entry declares:

```ts
interface StageContractEntry {
  stage: DealStage;
  section: string;
  field_path?: string;
  asset_class?: AssetClass;     // absorbs STAGE_SECTION_OVERLAYS (RFC 0029)
  required: boolean;            // replaces STAGE_REQUIREMENTS
  on_provisional: GapAction;    // replaces INCOMPLETE_DATA_POLICIES
  on_partial?: GapAction;       // new: distinct from full-block provisional
  rationale?: string;
}
```

The merge must also absorb `STAGE_SECTION_OVERLAYS` (RFC 0029): the
class-aware overlay that exempts `land` from `rent_roll` /
`operating_statement` and substitutes `components` for `mixed_use`
becomes the `asset_class?` qualifier on the entry rather than a second
table beside the merged one — otherwise the merge recreates the
two-surface problem it exists to fix.

Validators consult one table instead of two. The merge is mechanically
derived from the v1 tables; no behavior change for default-policy
files.

## Compatibility analysis

- **Existing `.uw.md` / `.uwx.md` files** — every v1.x file remains
  valid under `uw_version: "1.x"`. v2 parsers continue to read them via
  the shim. No file ever has to be edited to remain readable.
- **Tier-1 readers** — must implement the shim to claim v2 conformance.
  v1-only readers continue to work against v1 files.
- **Tier-2 editors** — gain a new emit mode (`v2-shape: true`). Default
  remains v1.x until `uw_version: "2.0"` is in the frontmatter. Edit
  policy resolution keys on `provenance.source` in v2 — same
  vocabulary, same `BUILTIN_EDIT_POLICIES`, same catch-all.
- **Tier-3 calc hosts** — unaffected; calc inputs reference content
  fields, not `_meta` fields.
- **Tier-4 agent hosts** — must read provenance from
  `provenance.source` / `provenance.actor` in v2 instead of top-level.
  `parseActorSource` and the namespace-based classification (RFC 0031)
  are shape-independent and accept either transparently.
- **Integrity/signing** — shape-sensitive by nature; fully specified in
  § Canonicalization above: v1 canonicalization is frozen for v1 files,
  v2 canonicalization normalizes before hashing (so both accepted
  shapes digest identically), migration re-stamps, and signed blocks
  require an explicit `--resign` / `--strip-signatures` choice.
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
- `tier-1-reader/v2-fixtures/04-legacy-tag-through-shim.uw.md` — a
  flat block whose `source` is a canonical tag; the reshape yields
  `provenance.resolution` set and `provenance.source` absent (the
  RFC 0031 read-time rule surviving the shape change).
- `tier-1-reader/v2-fixtures/05-flat-in-v2.uw.md` — illegal mirror of
  02: a `uw_version: "2.0"` file with flat `_meta`. Expects
  `META-V1-IN-V2` error.
- `tier-1-reader/v2-fixtures/06-digest-shape-insensitive/` — the same
  block in both accepted parser shapes; asserts identical v2 canonical
  digests (pins canonicalization step 1).
- `tier-1-reader/v2-fixtures/07-defaulted-algorithm-digest.uw.md` —
  digest identical with `integrity.algorithm` absent vs. spelled
  `'sha256'` (pins the exclusion rule in step 2).
- migration scenarios (migrate suite): signed block refused by default;
  `--strip-signatures` records the removal in `provenance.notes`;
  `resolution: "manual"` rewritten to `user_input` with a note.

Existing v1.x fixtures: untouched. The v2 fixtures live in a separate
sub-directory keyed off `uw_version`; the runner dispatches by
frontmatter version.

## Reference implementation

- **Files affected:**
  - `packages/uwmd-core/src/types.ts` — `UWMetaV1`, `UWMetaV2`, union
    type, reshape helper.
  - `packages/uwmd-core/src/parser.ts` — invoke shim when reading.
  - `packages/uwmd-core/src/render.ts` — `--shape=v1|v2` toggle.
  - `packages/uwmd-core/src/validator.ts` — new `META-V2-IN-V1` /
    `META-V1-IN-V2` codes (family registration in §III.6a per
    RFC 0030); merged `STAGE_CONTRACT`.
  - `packages/uwmd-core/src/protocol.ts` — `STAGE_CONTRACT` registry;
    `SOURCE_TAGS` minus `manual` (v2 vocabulary).
  - `packages/uwmd-core/src/integrity-canonical.ts` — versioned
    canonicalization (v1 frozen; v2 normalize-then-hash).
  - `packages/uwmd-core/src/cli.ts` — `migrate --to-v2`
    (`--resign` / `--strip-signatures`), `--emit-v2-shape`.
  - `spec/UW_FORMAT_SPEC_v1.md` — Part III §3 rewrite (kept for v1.x).
  - `spec/UW_FORMAT_SPEC_v2.md` (new) — v2 normative text.
  - `spec/schemas/uwmd-block-v2.schema.json` (new).
- **API surface:** additive in v1.x (helpers); breaking in v2 (the
  shape itself).
- **Test plan:** round-trip every existing fixture through v1→v2→v1
  and assert byte-identical recovery (sans whitespace). Property test:
  shim is its own inverse — except the legacy-tag case, where v1→v2 is
  deliberately lossy in the forward direction (the tag moves to
  `resolution`) and the inverse asserts semantic, not byte, identity.
  Digest property test: for every fixture, canonicalize-v2(flat) ===
  canonicalize-v2(nested).

## Alternatives considered

1. **Keep the flat shape forever.** The simplest path. Rejected — at
   ~18 fields the cognitive load is real, and every new category of
   metadata makes it worse. The cost of migration is bounded; the cost
   of inaction grows with every field.

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

5. **Fold `resolution` into `source` as a second segment**
   (`agent/L6-01#asset_class_default`). Considered during the 0031
   revision and rejected: it re-conflates the two facts one delimiter
   deeper, and every policy matcher would need to strip the suffix.

6. **Hash the on-disk shape directly and version digests by shape.**
   Rejected during the 2026-09-01 revision: a dual-shape parser era
   with shape-dependent digests means the *same block* has two
   identities depending on how it was written, which breaks parent
   chains and dedup across an edit that merely reshapes.
   Normalize-then-hash costs one deterministic reshape per digest and
   removes the fork entirely.

## Resolved questions

Decided 2026-09-01 by the owner at the Phase 4 gate:

1. **`lifecycle.version` is renamed `revision`.** Self-describing,
   no collision with frontmatter `uw_version`. (`seq` rejected as
   opaque; keeping `version` rejected as a standing footgun.)
2. **`integrity.algorithm` is added**, optional, defaulting
   `'sha256'`, which is the only admitted value at 2.0. Forward
   agility for one field's cost; excluded from the digest only while
   defaulted (see § Canonicalization step 2).
3. **No mixed shapes within a file.** `uw_version` is global;
   `META-V2-IN-V1` and `META-V1-IN-V2` enforce both directions.
4. **`manual` leaves `SOURCE_TAGS` at 2.0.** Actor-only thereafter;
   `user_input` is the resolution-method spelling; `migrate --to-v2`
   rewrites with a note. v1.x untouched.

No unresolved questions remain.

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
- **Git's author/committer split** (via RFC 0031) — the same
  two-facts-one-field lesson that shaped `provenance.source` /
  `provenance.resolution`.
- **Sigstore / in-toto re-signing practice** — signatures commit to
  digests, so format migrations require explicit re-signing by the key
  holder; tools refuse to carry signatures across a digest change.
