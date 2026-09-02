# .uwx.md — UW Markdown Extended Format Specification, Version 2.0

## Version 2.0 | September 2026 | Delta specification

This document is the normative text for **format 2.0** — files declaring
`uw_version: "2.0"` (or a later 2.x) in their frontmatter. It is a **delta
specification**: [`UW_FORMAT_SPEC_v1.md`](./UW_FORMAT_SPEC_v1.md) is
incorporated by reference, and everything it specifies — the file grammar
(Part II), the section registry (Part IV), validation rules (Part V), the
toolchain interface (Part VI), rendering targets (Part VII), and all
appendices — continues to govern 2.0 files **except as amended below**. A
statement in this document supersedes the corresponding v1 statement for 2.0
files only; v1.x files are governed by the v1 document alone, unamended.

The changes at 2.0 were designed in [RFC 0009](../docs/rfcs/0009-meta-v2-reorg.md)
(accepted 2026-09-01) with vocabulary groundwork from
[RFC 0031](../docs/rfcs/0031-source-vocabulary.md) and boundary decisions
from [RFC 0025](../docs/rfcs/0025-lite-percent-decimal-exactness.md). This is
the format's first — and only planned — breaking revision: the block-level
`_meta` object is reorganized into named sub-objects, and four dormant
deprecations pinned to this boundary take effect.

---

## §1 Versioning and the one-shape rule

### §1.1 Declaring 2.0

A 2.0 file declares itself in frontmatter:

```yaml
uw_version: "2.0"
```

`uw_version` is **global**: it decides the `_meta` shape for every block in
the file. Mixing shapes within one file is invalid in both directions:

| Condition | Code | Severity |
|---|---|---|
| Nested (v2) `_meta` in a `uw_version: "1.x"` file | `META-V2-IN-V1` | error |
| Flat (v1) `_meta` in a `uw_version: "2.0"` file | `META-V1-IN-V2` | error |

"Read both shapes" is a property of *parsers*, never of a single *file*.

### §1.2 Reader and writer obligations

- A **2.0 reader** MUST accept both shapes at the parser level: v1.x files
  continue to round-trip via the back-compat reshape ("the shim", §5), and
  a nested block is exposed to consumers through the same in-memory view a
  flat block produces. No file ever has to be edited to remain readable.
- A **2.0 writer** MUST emit the nested shape for every block it writes into
  a `uw_version: "2.0"` file, and MUST emit the flat shape into a
  `uw_version: "1.x"` file. The nested shape is the default for new files.
- A **v1.x-only consumer** encountering a 2.0 file MUST emit a clear
  error rather than misreading it (in the reference implementation, the
  1.x editor refuses with `PROTO-EDIT-010`; the 1.x validator reports
  `META-V2-IN-V1` on every block).

### §1.3 Per-file semantics of the 2.0 boundary

Every rule in this document that "becomes an error at 2.0" keys on the
**file's declared `uw_version`**, not on the validator's own version. A 2.0
implementation validating a `uw_version: "1.x"` file applies the v1 rules to
it — warnings stay warnings, the flat shape stays valid, and the read-time
source interpretation (v1 §2.6) still applies. This is the only reading
consistent with the round-trip guarantee in §1.2; it is stated here because
RFC 0031 phrased the escalation per-format while RFC 0009's timeline phrased
it per-release, and the two are reconciled in favor of per-file.

---

## §2 The nested `_meta` object

*Amends v1 §2.5 (The `_meta` Object) and Part III for 2.0 files.*

Every data block in a 2.0 file MUST carry `_meta` as its first key,
organized into four named sub-objects by concern:

```json
"_meta": {
  "section": "rent_roll",
  "provenance": {
    "source": "agent/L2-01",
    "resolution": "ai_extracted",
    "actor": "jared@example.com",
    "agent_id": "L2-01",
    "agent_version": "1.0.0",
    "timestamp": "2026-09-01T10:12:00Z",
    "notes": null
  },
  "quality": {
    "confidence": "medium",
    "human_review_required": true,
    "flags": [],
    "partial": false,
    "provisional": false
  },
  "lifecycle": {
    "revision": 1,
    "superseded": false
  },
  "integrity": {
    "input_hash": null,
    "content_hash": "…64 hex…",
    "parent_hash": null
  }
}
```

### §2.1 Routing

| Field | Type | Description |
|---|---|---|
| `section` | string | Section ID. 2.0 writers MUST emit the `section` spelling; readers MUST also accept `section_id` (the dominant v1 on-disk spelling) as an alias. |

### §2.2 `provenance` — who wrote this block, and how its values were resolved

| Field | Type | Req | Description |
|---|---|---|---|
| `source` | string | yes | The actor (v1 §2.6 grammar, RFC 0031): `manual` or `<namespace>/<id>` with a registered namespace. At 2.0 the grammar is **enforced** — see §4. |
| `resolution` | string | no | How the value was resolved — one member of the 2.0 resolution vocabulary (§4.1). Orthogonal to `source`. |
| `actor` | string | yes | The principal that initiated the write. Distinct from `source`: `source` is the policy-vocabulary identity of the writer, `actor` is who asked for the write. |
| `agent_id` | string\|null | no | As v1; REQUIRED when `source` matches `agent/*`. |
| `agent_version` | string\|null | no | As v1. |
| `timestamp` | ISO 8601 | yes | As v1. |
| `notes` | string\|null | no | As v1. |
| `market_data_ref` | object | cond. | RFC 0022 §4 — REQUIRED when `resolution` is `market_data_accepted`. |
| `inherited_from` | object | cond. | RFC 0021 §5 — REQUIRED when `resolution` is `inherited_assumption`. |

`market_data_ref` and `inherited_from` sit in `provenance`, not `integrity`:
each names *where a value came from*, and each is coupled to a `resolution`
value. The conditional-requirement rules are unchanged from v1, merely
re-anchored on `provenance.resolution`.

### §2.3 `quality` — how trustworthy or complete the data is

| Field | Type | Req | Description |
|---|---|---|---|
| `confidence` | enum | yes | `high` / `medium` / `low`, as v1 §3.2. |
| `human_review_required` | boolean | yes | As v1 §3.3. |
| `flags` | string[] | no | As v1. |
| `partial` | boolean | no | As v1 §3.4. When true, `_overrides` (§3) SHOULD enumerate which paths and why. |
| `provisional` | boolean | no | As v1 §3.4. |

`field_overrides` is **no longer a `_meta` field** at 2.0 — it moves to the
block-level `_overrides` annotation (§3).

### §2.4 `lifecycle` — where this block sits in the supersede chain

| Field | Type | Req | Description |
|---|---|---|---|
| `revision` | integer ≥ 1 | yes | 1-based supersede-chain position. **Renamed from v1 `version`** to end the collision with frontmatter `uw_version` (RFC 0009 resolved question 1). Semantics unchanged. |
| `superseded` | boolean | yes | As v1: true on every block that is not the chain head. |

### §2.5 `integrity` — cryptographic / structural verification (all optional)

| Field | Type | Description |
|---|---|---|
| `algorithm` | `"sha256"` | Hash algorithm for the three hash fields. **Absent means `sha256`**, and `sha256` is the only admitted value at 2.0 — the field exists for forward agility, not present choice (RFC 0009 resolved question 2). A defaulted value is excluded from the block digest; a non-default value is hashed and therefore cannot be stripped undetected. |
| `input_hash` | string\|null | As v1: reproducibility anchor over the block's inputs. |
| `content_hash` | string | As v1, computed under **canonicalization v2** (§5). |
| `parent_hash` | string\|null | As v1: the `content_hash` of the superseded predecessor; null on a chain root. |
| `signature` | object | As v1 §3.4 / protocol §V.11 (RFC 0010) — same wire shape, same signing input, relocated. |

The whole sub-object is optional: integrity remains opt-in, exactly as in v1.

---

## §3 The `_overrides` block annotation

*Amends v1 Part III §3.4 (`field_overrides`) for 2.0 files.*

Per-field exceptions to the block-level metadata move out of `_meta` into a
top-level block annotation, a sibling of `_meta`:

```json
{
  "_meta": { "…v2 shape…": "…" },
  "_overrides": [
    {
      "path": "units[7].current_rent",
      "confidence": "low",
      "resolution": "ai_extracted",
      "reason": "illegible"
    }
  ]
}
```

Entry shape and semantics are identical to v1 `field_overrides` (path,
optional `confidence` / `source` / `resolution` / `reason` / `note`). The
precedence rule is unchanged and remains as RFC 0031 stated it: `_overrides`
wins for the paths it covers — `confidence`, `source`, and `resolution`
alike — `_meta.quality` / `_meta.provenance` apply elsewhere.

`_overrides` is **block content for integrity purposes**: it is inside the
digest, exactly as `field_overrides` was in v1.

---

## §4 Vocabulary changes at 2.0

*Amends v1 §2.6 (source vocabulary) for 2.0 files.*

### §4.1 `manual` leaves the resolution vocabulary

At 2.0, `manual` is **actor-only** (RFC 0009 resolved question 4). The
resolution vocabulary (`SOURCE_TAGS`) drops it; `user_input` is the
resolution-method spelling for human-typed values. In a 2.0 file,
`provenance.resolution: "manual"` is an error (`SRC-03`).
`uwmd migrate --to-v2` rewrites it to `user_input` and records the rewrite
in `provenance.notes`. v1.x is untouched: `manual` remains legal in both
positions for the life of 1.x.

The 2.0 resolution vocabulary is therefore: `user_input`, `user_override`,
`inherited_assumption`, `investor_profile`, `market_data`,
`market_data_accepted`, `ai_extracted`, `agent_computed`,
`asset_class_default`, `scenario_default`, `global_default`,
`system_default`.

### §4.2 The actor grammar is enforced

In a 2.0 file, `provenance.source` MUST parse under the v1 §2.6 actor
grammar. The v1-era leniencies end, **for 2.0 files** (per §1.3):

| Condition in a 2.0 file | Code | Severity (was, in 1.x) |
|---|---|---|
| A resolution tag in `provenance.source` | `SRC-02` | **error** (warning) |
| Any other value outside the actor grammar | `SRC-01` | **error** (warning) |
| `provenance.resolution: "manual"` | `SRC-03` | **error** (new — the field could not previously be wrong this way) |

The §2.6 **read-time interpretation** (a legacy tag in the actor field is
exposed as `resolution`) survives only inside the back-compat shim for v1.x
files; it is never applied to a 2.0 file's own blocks — in a 2.0 file the
legacy spelling is simply an error to be fixed, not information to be
recovered.

---

## §5 Canonicalization, integrity, and migration

*Amends v1's references to protocol §V.9 for 2.0 files. The normative
algorithm lives in [`UW_PROTOCOL_v1.md`](./UW_PROTOCOL_v1.md) §V.9
("Canonicalization is versioned by the file's `uw_version`").*

- The **v1 canonicalization rule is frozen forever** for `uw_version: "1.x"`
  files. No stored v1 digest is ever invalidated by 2.0 existing.
- 2.0 files use **canonicalization v2**: normalize-then-hash. The block is
  first reshaped to the canonical nested form (the shim, including the
  `field_overrides` → `_overrides` lift and full defaulting), then
  `integrity.content_hash`, `integrity.signature`, and a defaulted
  `integrity.algorithm` are excluded, then RFC 8785 serialization applies.
  Because normalization runs first, the two shapes a dual-shape parser
  accepts yield **identical digests** for semantically identical blocks.
- **The shim** is the deterministic structural reshape between the shapes,
  defined by RFC 0009 §"Migration story" and implemented as
  `reshapeMetaV1toV2` / `reshapeMetaV2toV1` in the reference library. It is
  purely structural: it never rewrites vocabulary values. Its one lossy
  corner is deliberate: a v1 block whose `source` is a legacy resolution tag
  reshapes with `provenance.resolution` set and `provenance.source`
  **absent** — never invented (RFC 0031's rule surviving the shape change).
- **Migration re-stamps hashes; signatures do not survive it.** A signature
  commits to the v1 `content_hash`, which migration recomputes. The
  migrating tool MUST refuse a file containing signed blocks unless
  explicitly told to re-sign (`--resign`, with the key) or strip
  (`--strip-signatures`, recorded in `provenance.notes`). A parent link
  that was broken *before* migration is carried over broken — migration
  never repairs tamper evidence.

---

## §6 Deprecations taking effect at this boundary

Two decisions recorded in earlier RFCs were pinned to Protocol 2.0 and take
effect with this document:

### §6.1 Legacy structured `.uw.md` sniffing sunsets (RFC 0025 / RFC 0017)

Since RFC 0017, `.uwx.md` is the structured extension and `.uw.md` is UW
Lite. Through 1.x, readers additionally **sniffed** structured content under
a `.uw.md` name and accepted it with a warning. At 2.0 that acceptance ends:
a file named `.uw.md` whose content carries structured UWX fences is an
**error** (`SOURCE_LEGACY_STRUCTURED`), directing the operator to rename it
`.uwx.md` (a byte-identical rename — that was always the whole migration).
Representation detection otherwise continues unchanged: `.uwx.md` must
carry fences, `.uw.md` is Lite, ambiguous content still refuses.

### §6.2 Lite canonicalization `1.0` recognition obligation ends (RFC 0025)

Through 1.x, receipt verifiers were **obliged** to recognize
`canonicalization_version: "1.0"` and degrade to `RCP-10` (unverifiable)
rather than fail. At 2.0 that obligation ends: a verifier is not required to
distinguish a `1.0` receipt from a corrupted one. A verifier MAY — and the
reference implementation does — retain the generic version-mismatch
degradation as a quality-of-implementation choice, since it is what makes
*any* future canonicalization bump non-catastrophic; what ends is the
normative requirement, not the behavior.

---

## §7 Toolchain at 2.0

*Amends v1 Part VI.*

- `uwmd migrate <file> --to-v2` converts a whole v1.x file: frontmatter to
  `"2.0"`, every block reshaped, `field_overrides` lifted, `resolution:
  "manual"` rewritten with a note, hashes re-stamped chain-aware, and the
  §5 signature policy applied. `--emit-v2-shape` is accepted as a synonym.
- Tier-2 editors write nested blocks into 2.0 files natively (the 1.x-era
  `PROTO-EDIT-010` refusal is retired at 2.0); all v1 edit semantics —
  byte preservation outside the edited region, append-only supersede,
  host-owns-`_meta`, edit policies keyed on `provenance.source` — carry
  over unchanged.
- `uwmd init` scaffolds `uw_version: "2.0"` nested-shape files by default;
  `--format 1.1` scaffolds the legacy flat shape for operators pinned to
  1.x consumers.
- UW Lite (`.uw.md`) remains a **1.x-format source representation**: the
  Lite bridge compiles to `uw_version: "1.1"` envelopes until a future RFC
  moves it. Lite's grammar and canonicalization are unaffected by this
  document.

---

## §8 Conformance

2.0 conformance builds on the v1 corpus:

- The `meta-v2` suite (`conformance/tier-1-reader/v2-fixtures/`) pins the
  shim, the one-shape rule in both directions, digest shape-insensitivity,
  and the defaulted-`algorithm` exclusion.
- The `migrate` suite pins the §5 migration policy (signed-block refusal,
  `--strip-signatures` provenance notes, the `manual` rewrite).
- The v2 block schema is
  [`schemas/uwmd-block-v2.schema.json`](./schemas/uwmd-block-v2.schema.json);
  the v1 schema continues to govern v1.x blocks.
- A reader claiming 2.0 conformance MUST pass the v1 tier-1 corpus as well:
  reading v1.x files is part of the 2.0 contract (§1.2).

---

## Appendix A — Shape mapping reference

| v1 flat field | v2 location |
|---|---|
| `section` / `section_id` | `section` |
| `version` | `lifecycle.revision` |
| `superseded` | `lifecycle.superseded` |
| `source` | `provenance.source` |
| `resolution` | `provenance.resolution` |
| `agent_id`, `agent_version`, `actor`, `timestamp`, `notes` | `provenance.*` |
| `market_data_ref`, `inherited_from` | `provenance.*` |
| `confidence`, `human_review_required`, `flags`, `partial`, `provisional` | `quality.*` |
| `field_overrides` | top-level `_overrides` (not `_meta`) |
| `input_hash`, `content_hash`, `parent_hash`, `signature` | `integrity.*` |
| — | `integrity.algorithm` (new; defaulted `sha256`) |
