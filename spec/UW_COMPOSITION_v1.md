# UW Composition 1.0

**Fragment extension:** `.uwpart.md`
**Fragment media type:** `text/vnd.uwmd.part+markdown`
**Fragment representation ID:** `uwx-part-markdown`
**Schemas:** `schemas/uwpart.schema.json`, `schemas/uw-external-section.schema.json`
**Defining RFC:** [0021](../docs/rfcs/0021-composable-documents.md) (accepted 2026-08-13)
**Status:** normative for `uwpart_version` `1.0`

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are to be interpreted
as described in RFC 2119.

## 1. Purpose and the invariance rule

A UWX record MAY store any of its sections in separate **fragment** files rather
than inline, and MAY reference whole child records to form a composite. This
specification defines the fragment format, the externalization directive, the
resolution algorithm, the merge order, and the bounds a resolver MUST enforce.

Everything in this document exists to make one rule hold:

> **I-1 (Digest invariance).** For any UWX record `R` with externalized parts,
> the semantic digest of `R` resolved equals the semantic digest of the
> byte-identical inline record `R'` in which every part has been substituted in
> place.

I-1 is what makes composition a **packaging** decision rather than a modelling
one. Its consequences are normative:

- Externalizing a section, or inlining one, is **not** a semantic change. It
  does not alter the record's identity, does not invalidate a receipt issued
  over the resolved form, and is not a Tier-2 edit of the model.
- Invariance is on the **semantic digest** — the RFC 8785 canonical form — not
  on source bytes. Source bytes necessarily differ. Tier-2 byte preservation is
  unaffected: it governs editing a document, not assembling one.
- A resolver MUST therefore produce a canonically ordered result. Merging
  fragments in archive order or in `parts` order would canonicalize the same
  rows two ways and I-1 would not hold, which is why §3.4 requires a declared
  collection key and a total order over it.

### 1.1 Assurance boundary

A resolved record is the same record its inline twin would be. That is all I-1
claims. It does **not** mean the parts present are all the parts that should
exist, that a collection is complete, or that any value is true. A resolver
reports what it was given; §3.6 governs what it MUST do when it was given less
than the record declares.

## 2. Fragments (`.uwpart.md`)

A **fragment** carries one section's content plus the frontmatter needed to
identify it. A fragment is deliberately **not** a `.uwx.md`: it is not an
underwriting record, it has no deal of its own, and it MUST NOT be presented as
one. The distinct extension exists so detection never guesses — the format has
already paid once for extension ambiguity, and the legacy `.uw.md` sniffing
introduced by RFC 0017 still has no expiry.

````markdown
---
uwpart_version: "1.0"
part_id: lease-suite-210
section: rent_roll
collection_member: true
---

```json uw:section=rent_roll confidence=high source=document/lease v=1
{ "unit_id": "210", "tenant": "Anchor Tenant LLC", "base_rent_annual": 184800 }
```
````

### 2.1 Frontmatter

| Key | Requirement |
|---|---|
| `uwpart_version` | REQUIRED. Non-empty string. `1.0` for this specification. |
| `part_id` | REQUIRED. Non-empty string, unique within a package. |
| `section` | REQUIRED. A registered section id, or an `x_`-prefixed extension section. |
| `collection_member` | OPTIONAL. `true` marks the fragment as one row of a collection section (§3.4). Absent or `false` means it supplies the whole section (§3.3). |

A fragment MUST NOT carry `deal_id`. A fragment is not an underwriting record,
and carrying a deal identifier is the cheapest way for one to be mistaken for
one. This is a refusal (`COMP-PART-MALFORMED`), not a warning.

### 2.2 Content rules

- A fragment MUST carry at least one block for its declared `section`.
- Every block in the fragment MUST target that section. A fragment MUST NOT
  contribute to two sections (`COMP-SECTION-MISMATCH`); that is what two
  fragments are for.
- A fragment MUST parse standalone, and MUST validate against the section's
  schema for the fields it carries. This is a hard requirement rather than a
  nicety: a fragment that can only be understood in the context of its parent is
  not independently reviewable and cannot be usefully content-addressed.
- A fragment carries its own `_meta` provenance for the blocks it holds. The
  host owns `_meta` in a fragment exactly as it does in a record.

### 2.3 Fragments do not nest

A fragment MUST NOT itself externalize a section. Composition is one level deep
by construction in `uwpart_version` 1.0: a resolver reads a fragment's blocks
and does not look for a directive inside them. RFC 0021 left this "forbidden by
omission"; it is stated here explicitly so implementations agree.

## 3. Externalizing a section

A record externalizes a section by replacing that section's block content with
an externalization directive naming the parts, and marking the fence annotation
`external=true`:

```json uw:section=rent_roll external=true v=1
{
  "_meta": { "...": "host-owned as usual" },
  "rent_roll_type": "multifamily",
  "external": {
    "parts": ["lease-suite-210", "lease-suite-215", "lease-suite-220"],
    "collection_key": "unit_id",
    "collection_path": "units",
    "part_count": 3
  }
}
```

### 3.1 The directive

| Field | Requirement |
|---|---|
| `parts` | REQUIRED. Non-empty array of `part_id`s, each naming a member of the same package. A `part_id` MUST NOT appear twice (`COMP-DUP-KEY`). |
| `part_count` | REQUIRED. Integer equal to `parts.length` (`COMP-COUNT-MISMATCH`). |
| `collection_key` | REQUIRED when the parts are collection members, forbidden otherwise. Names the field uniquely identifying a row. |
| `collection_path` | REQUIRED when the parts are collection members, forbidden otherwise. Names the field within the section content where merged rows land. |

`part_count` is redundant on purpose. Without it a truncated `parts` array is
not detectable, and silent under-resolution is the most dangerous failure this
design admits: a rent roll missing four tenants still totals, still validates,
and still produces a confident DSCR.

### 3.2 Why `collection_path` exists

`collection_key` says which field identifies a row. It does not say which field
the rows *occupy*, and I-1 cannot hold without that: the resolved content has to
equal the inline content exactly, and `units` and `rows` are different documents.

The alternative was a section-to-collection-field table held in the library.
That is precisely the hand-maintained mirror that has already drifted for
section ids, so the answer is declared in the document instead.

`collection_path` was not in RFC 0021 as originally accepted. It was added to
the RFC by erratum on 2026-08-18 and is normative here; see Appendix A.

### 3.3 Whole-section externalization

When the named parts are not collection members, exactly **one** part MUST
supply the section. Naming two whole-section fragments for one section is an
error (`COMP-DIRECTIVE-MALFORMED`), because nothing in the format says how two
complete sections would combine.

The resolved block takes the fragment's block content verbatim, with the
annotation normalized per §3.5.

A directive MUST NOT mix collection-member parts with whole-section parts
(`COMP-DIRECTIVE-MALFORMED`).

### 3.4 Collection merge order

When the named parts are collection members, a resolver MUST:

1. Resolve every `part_id` in `parts` to a fragment in the package. A part that
   does not resolve is `COMP-UNRESOLVED` — see §3.6.
2. Confirm each part's declared `section` equals the section referencing it
   (`COMP-SECTION-MISMATCH`).
3. Take each block of each part as one row, **dropping the block's `_meta`**
   (§3.7).
4. Read each row's `collection_key` value. A row whose key is absent or not a
   non-empty string is an error (`COMP-DIRECTIVE-MALFORMED`).
5. Reject duplicate keys. Two fragments claiming the same key is
   `COMP-DUP-KEY`, **never** a last-one-wins merge: it is a conflict a human
   resolves, not an ordering question.
6. Sort the merged rows by `collection_key` under a **byte-wise total order on
   the UTF-8 encoding of the key**.
7. Set the resolved content to the directive's sibling fields — that is, the
   section content with `external` removed — plus `collection_path` bound to the
   sorted rows.

Step 6 is normative and specific. A locale-aware comparison (for example
JavaScript's `localeCompare`) is locale-dependent, so the canonical form, and
therefore the digest, would vary by machine. That is exactly what I-1 forbids.

### 3.5 Annotation normalization

A resolved block MUST carry the fence annotation its inline equivalent would
carry. Specifically, the `external` key MUST be removed from the annotation
during resolution.

This is easy to miss and fatal to I-1. The semantic value of a block includes
its `annotation`, not only its `content`, so a resolved block still marked
`external=true` digests differently from its byte-identical inline twin, and
I-1 fails on every record.

### 3.6 An unresolved part is never a smaller collection

If any named part does not resolve, the resolver MUST report the section as
**unresolved** and MUST NOT emit a partially merged collection. The record's
composition status is `unresolved`, and a verifier over it reports
`unverifiable` — not `failed`.

The distinction matters and mirrors the receipt verifier's: a record referencing
a fragment the caller does not hold is *undecidable*, not *wrong*. Degrading to
"the rows I happened to find" would produce a confident, complete-looking, and
incorrect record — the one outcome this specification exists to prevent.

### 3.7 `_meta` on merged rows

A collection row's `_meta` is **not** carried into the merged collection. The
fragment's block-level `_meta` is provenance for the fragment as an
independently reviewable artifact; the merged section's provenance is the
parent block's own `_meta`.

This follows from I-1 rather than from preference: in the inline twin, a
collection's rows are plain objects inside the collection field, and the
section's `_meta` sits on the section block. A merge that carried per-row
`_meta` into the rows would produce content the inline form never has.

## 4. Composites and recursion

A record MAY reference whole child records through the RFC 0018 `contributes_to`
member link, and a child MAY itself be a composite. The resulting structure is a
**directed acyclic graph**.

### 4.1 Traversal and order

A resolver walks from the graph's **roots** — members that nothing contributes
to — and produces members in dependency order, **leaves first**. A parent's
resolved digest is a function of its children's digests, so children MUST be
resolved before the parents that name them.

A resolver MUST NOT overflow its call stack in place of enforcing §4.2. A
hostile graph that crashes the resolver has converted a clean, reportable bound
violation into an outage; the reference implementation therefore walks
iteratively.

### 4.2 Bounds

| Bound | Default | On breach |
|---|---|---|
| Composition depth | 8 | `COMP-DEPTH` |
| Total resolved members | 4096 | `COMP-DEPTH` |

Both bounds are configurable by the host and both MUST be enforced. They mirror
the existing safe-ZIP limits and exist for the same reason: a nested-package
expansion is a decompression bomb wearing a different hat.

### 4.3 Cycles

Cycles are an error (`COMP-CYCLE`). A resolver MUST detect them rather than
recursing until a bound trips.

Detection has two parts, and both are required:

1. A member reached again while still on the current traversal path is a cycle.
2. After the walk, any member **not reached from any root** sits in a cycle: it
   has a parent, but no root leads to it. Without this second check a cycle with
   no entry point from a root would go unreported.

### 4.4 Staleness

Because a parent's resolved digest is a function of its children's digests,
correcting a leaf changes every ancestor. A parent whose **recorded** digest for
a child disagrees with that child's **actual** digest is reported **`stale`**.

`stale` is a third status, deliberately distinct from `failed`:

| Status | Meaning |
|---|---|
| `resolved` | Every member resolved and every recorded child digest agrees. |
| `stale` | Resolution succeeded, but at least one parent holds an out-of-date record of a child. |
| `unresolved` | A member, link, or bound prevented resolution. |

A stale ancestor is not evidence of tampering; it is evidence that a correction
has not been adopted yet. Collapsing "out of date" into "wrong" trains people to
ignore the alarm — the same reasoning the receipt verifier applies in keeping
`unverifiable` distinct from `failed`.

Staleness is recorded **per edge**, naming the parent, the child, the recorded
digest, and the actual one, because the recorded digest belongs to the parent's
view of the child rather than to the child.

### 4.5 Resolution performs no I/O

Resolution MUST NOT perform network or connector I/O. Members and fragments
resolve from within the package, in memory, from what the caller already holds.

This preserves RFC 0018's rule that validating a package never writes untrusted
files to disk: resolving is reading archive entries, not extracting them. A
reference pointing outside the package is **unresolvable**, never fetched.

## 5. Scope: UWX only

Externalization applies to **UWX** (`.uwx.md`) records only. UW Lite is a
deliberately lossy, human-readable summary whose value is that it reads on its
own; a Lite document whose meaning depended on files it does not contain would
defeat that.

The UWX-to-Lite projection MUST report every externalized section in its
omission report rather than silently flattening or dropping it, so the
projection report stays a complete account of what was lost.

Concretely, the report carries `externalized_sections`, naming each such section,
and is `lossy` whenever that list is non-empty — a record whose only loss is an
externalized section omits no *paths*, so path count alone cannot carry the
signal. The directive's own keys (`parts`, `part_count`, `collection_key`,
`collection_path`) MUST NOT appear in `omitted_paths`: they describe the
packaging, not the underwriting data, and listing them reports the wrapper in
place of the contents it stands for. Doing so is worse than silence, because it
makes an externalized record appear to omit *fewer* paths than its inline twin
while it is in fact missing an entire section.

The projected Lite document itself is unchanged by externalization — packaging,
not modelling, the same principle as I-1 — so the report is the only place the
difference may show.

## 6. Error codes

| Code | Meaning |
|---|---|
| `COMP-PART-MALFORMED` | A fragment is missing required frontmatter, carries `deal_id`, declares an unregistered section, or holds no block for its section. |
| `COMP-DIRECTIVE-MALFORMED` | An `external` directive is structurally invalid, mixes part kinds, names more than one whole-section part, omits `collection_key`/`collection_path` for a collection, or a row lacks a usable key. |
| `COMP-DUP-KEY` | Two fragments claim the same `collection_key` value, or `parts` names the same `part_id` twice. |
| `COMP-UNRESOLVED` | A declared part or member does not resolve in the package. |
| `COMP-COUNT-MISMATCH` | `part_count` disagrees with `parts.length`. |
| `COMP-CYCLE` | The composition graph contains a cycle. |
| `COMP-DEPTH` | Resolution exceeded the depth or member-count bound. |
| `COMP-SECTION-MISMATCH` | A fragment contains a block for a section other than its declared one, or is referenced from a different section. |
| `COMP-AMBIGUOUS-INHERIT` | Equidistant ancestors supply the same assumption (see §7). |
| `COMP-ROLLUP-DISAGREES` | A stated aggregate does not match recomputation (see §7). |

`COMP-PART-MALFORMED` and `COMP-DIRECTIVE-MALFORMED` are **not** in RFC 0021's
error table; see Appendix A.

## 7. Relationship to other specifications

This document owns fragments, externalization, resolution, and the composition
graph. Two surfaces RFC 0021 introduces are owned elsewhere, and are specified
there rather than duplicated here:

- **Inherited assumptions** (`inherited_assumption`, `COMP-AMBIGUOUS-INHERIT`)
  are a cascade step, so they belong to the protocol: see
  [`UW_PROTOCOL_v1.md`](UW_PROTOCOL_v1.md) §V.7.1.
- **Rollup receipts** (`COMP-ROLLUP-DISAGREES`, the fixed `fn` vocabulary,
  two-stage verification) amend the receipt format, which RFC 0016 owns: see
  [`UW_RECEIPT_v1.md`](UW_RECEIPT_v1.md) §11.

Packages, member links, and the edge registry are RFC 0018's; this document
assumes them and does not restate them.

## 8. Conformance

A conforming implementation MUST satisfy the named `composition` suite. I-1 is
the assertion the suite exists to prove: an externalized record and its inline
twin MUST produce identical canonical forms and identical semantic digests,
including under shuffled `parts` order and shuffled archive order.

An implementation that does not support composition remains conforming, but MUST
report an externalized section as unresolved rather than presenting the record
as complete. A partial rent roll shown as a whole one is the failure §3.6 exists
to prevent, and it is not made acceptable by the reader simply not implementing
this specification.

## 9. Reference implementation

`packages/uwmd-core/src/composition.ts` — `parseUWPart`, `readExternalDirective`,
`validateExternalDirective`, `resolveComposition`, `resolveComposite`, the bounds
constants, and the error taxonomy. Browser-safe: it performs no I/O.

## Appendix A: Errata against RFC 0021 as accepted

Recorded rather than quietly absorbed, per the process argument in RFC 0017's
own [Process failure](../docs/rfcs/0017-uw-lite-source-representation.md#process-failure)
section. None changes the design; all three are gaps found by building it.

**All three were accepted into RFC 0021 on 2026-08-18** and appear in its
[Errata](../docs/rfcs/0021-composable-documents.md#errata) section. They are
listed here as well because this document is the normative one: a reader
holding only the spec should not have to consult the RFC to learn that its
§3 directive is incomplete.

1. **`collection_path` is required and is not in the RFC.** RFC 0021 §3
   declares `collection_key` but never says which field the merged rows occupy.
   I-1 cannot hold without it. See §3.2.
2. **Two error codes are missing from RFC 0021 §7.** `COMP-PART-MALFORMED` and
   `COMP-DIRECTIVE-MALFORMED` cover malformed fragments and malformed
   directives respectively. The RFC's table has codes for every *semantic*
   failure but none for a structurally invalid input, which every parser needs.
3. **Per-row `_meta` is dropped on merge** (§3.7). The RFC says a fragment
   carries its own `_meta`, and it does; it does not say what happens to that
   `_meta` when the fragment becomes a row. I-1 settles it.
