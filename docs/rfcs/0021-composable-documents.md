---
rfc: 0021
title: Composable UWX documents — section externalization, composites, and rollup receipts
status: draft
author: jaredmaxey
created: 2026-08-13
depends_on:
  - 0018
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0021: Composable UWX documents

## Summary

Let a `.uwx.md` record be assembled from parts without changing what it means.
A section may be **externalized** into one or more `.uwpart.md` fragments that
the parent references and a resolver reassembles; a **composite** record may
reference whole child records, recursively; and a composite may state aggregate
figures whose correctness is provable by a **rollup receipt** rather than by
teaching the calculation engine to iterate.

The governing rule is one invariant: **an externalized document and its inline
equivalent have the same semantic digest.** Composition is a packaging decision,
not a modelling decision. It does not add iteration to the Tier-3 sandbox, does
not let AI compute financial results, and does not define a database.

## Motivation

A deal record today is one file. That is right for a single asset and wrong for
three situations users already have:

**Granularity.** A forty-tenant retail rent roll is forty lease abstracts.
RFC 0018 makes a lease abstract a portable document, but the only way it reaches
the deal is a lossy `rent-roll-v1` projection that proposes an edit. There is no
way to say "this deal's rent roll *is* these forty abstracts" and have the record
remain complete and verifiable.

**Portfolios.** A portfolio is a composite of deals, each itself a composite of
rent rolls, historical financials, and shared assumptions. Nothing in the format
expresses that, so hosts rebuild it privately and portfolio figures become
unattributable.

**Shared assumptions.** Deals in one portfolio share exit assumptions, reserve
policy, and rate outlook. Today each record restates them, so correcting one
means editing every file and nothing detects the ones that were missed.

RFC 0018 supplies the container — a manifest, digests, typed links, safe-ZIP
rules — and stops at whole documents. This RFC supplies composition *within* and
*across* records on top of that container.

## Prerequisite

**RFC 0018 was accepted on 2026-08-13, so this dependency is satisfied.** This
RFC builds directly on it, reusing the package manifest, member identity, the
two-layer edge registry (§5), the safe-ZIP restrictions, and the reference-handle
rules. It does not restate any of them, and it must not be implemented against a
private copy of them.

Note that 0018's acceptance also settled registry ownership under its own §5
rule: the canonical edge registry now belongs to the protocol spec as 0018
defines it, and RFC 0015's edge list is superseded by that section rather than
competing with it.

## Proposed change

### 1. The invariance rule

> **I-1 (Digest invariance).** For any UWX record `R` with externalized parts,
> the semantic digest of `R` resolved equals the semantic digest of the
> byte-identical inline record `R'` in which every part has been substituted in
> place.

Everything else in this RFC exists to make I-1 hold. Its consequences:

- Externalizing a section, or inlining one, is **not a semantic change**. It does
  not alter the record's identity, does not invalidate a receipt issued over the
  resolved form, and is not a Tier-2 edit of the model.
- Invariance is on the **semantic digest** (the RFC 8785 canonical form), not on
  source bytes. Source bytes obviously differ. Tier-2 byte preservation is
  unaffected: it governs editing a document, not assembling one.
- A resolver must therefore produce a canonically ordered result, which is why
  §3 requires a declared collection key and a total order. Without that, merging
  forty fragments in directory order would produce a different canonical form
  than the same forty rows typed inline, and I-1 would fail.

I-1 is the single assertion the conformance suite exists to prove. If an
implementation gets nothing else right, it must get this right, because every
downstream guarantee — receipts, equivalence, package verification — assumes an
externalized record is the same record.

### 2. Fragments (`.uwpart.md`)

| Property | Value |
|---|---|
| Extension | `.uwpart.md` |
| Media type | `text/vnd.uwmd.part+markdown` |
| Representation ID | `uwx-part-markdown` |

A fragment carries **one section's content** plus the frontmatter needed to
identify it. It is deliberately *not* a `.uwx.md`: a fragment is not an
underwriting record, has no `deal_id` of its own, and must not be presented as a
deal. A distinct extension means detection never guesses — the project has
already paid once for extension ambiguity, and the legacy `.uw.md` sniffing
introduced by RFC 0017 still has no expiry.

```markdown
---
uwpart_version: "1.0"
part_id: lease-suite-210
section: rent_roll
collection_member: true
---

```json uw:section=rent_roll confidence=high source=document/lease ts=... v=1
{ "unit_id": "210", "tenant": "Anchor Tenant LLC", "base_rent_annual": 184800 }
```
```

Rules:

- `uwpart_version`, `part_id`, and `section` are required. `part_id` MUST be
  unique within a package.
- The declared `section` MUST be a registered section id, and every block in the
  fragment MUST target that section. A fragment MUST NOT contribute to two
  sections; that is what two fragments are for.
- A fragment MUST parse standalone and MUST validate against the section's
  schema for the fields it carries. "Parses correctly and hashes properly" is a
  hard requirement, not a nicety: a fragment that can only be understood in the
  context of its parent is not independently reviewable and cannot be
  content-addressed usefully.
- A fragment carries its own `_meta` provenance for the blocks it holds. The
  host owns `_meta` in a fragment exactly as in a record.
- `collection_member: true` marks a fragment as one of many composing a
  collection section (§3). Absent or `false` means it supplies the whole section.

### 3. Externalizing a section

A parent record externalizes a section by replacing the section's block with an
externalization directive naming the parts:

```json uw:section=rent_roll external=true v=1
{
  "_meta": { "...": "host-owned as usual" },
  "external": {
    "parts": ["lease-suite-210", "lease-suite-215", "lease-suite-220"],
    "collection_key": "unit_id",
    "part_count": 3
  }
}
```

- `parts` lists `part_id`s that MUST resolve to members of the same package.
- `part_count` MUST equal `parts.length`. It is redundant on purpose: a
  truncated `parts` array is then a detectable error rather than a silently
  smaller rent roll. Silent under-resolution is the most dangerous failure mode
  in this whole design — a rent roll missing four tenants still totals, still
  validates, and still produces a confident DSCR.
- `collection_key` is REQUIRED when parts are `collection_member: true` and
  forbidden otherwise. It names the field that uniquely identifies a row.

**Merge semantics.** When parts compose a collection:

1. Each part contributes its rows.
2. Rows are keyed by `collection_key`. A duplicate key across parts is an
   **error** (`COMP-DUP-KEY`), never a last-one-wins merge. Two fragments
   claiming suite 210 is a conflict a human must resolve, not an ordering
   question.
3. The merged collection is sorted by `collection_key` under a total order
   (byte-wise on the UTF-8 key) before canonicalization. This is what makes I-1
   hold regardless of `parts` order or ZIP entry order.
4. A missing or unresolvable part is `COMP-UNRESOLVED` and the record resolves
   to `unverifiable`, **not** to a smaller rent roll and not to `failed`.

**Scope.** Externalization applies to **UWX only**. UW Lite is a deliberately
lossy, human-readable summary whose value is that it reads on its own; a Lite
document whose meaning depended on files it does not contain would defeat that.
The UWX→Lite projection MUST report every externalized section in its omission
report rather than silently flattening or dropping it, so the existing
projection report stays a complete account of what was lost.

### 4. Composites and recursion

A record MAY reference whole child records through the RFC 0018 `contributes_to`
member link, and a child MAY itself be a composite. The resulting structure is a
**directed acyclic graph**, and the following bounds are normative:

- **Cycles are an error** (`COMP-CYCLE`). A resolver MUST detect them rather
  than recursing.
- **Depth is bounded** (default 8) and **total resolved member count is bounded**
  (default 4,096). These mirror the existing safe-ZIP limits and exist for the
  same reason: a nested-package expansion is a decompression bomb wearing a
  different hat.
- Resolution MUST NOT perform network or connector I/O. Members resolve from
  within the package, in memory. This preserves RFC 0018's rule that validating
  a package never writes untrusted files to disk — resolving is reading archive
  entries, not extracting them. A reference pointing outside the package is
  unresolvable and yields `unverifiable`.

**Staleness propagates, and that is the feature.** Because every parent's
resolved digest is a function of its children's digests, correcting a leaf rent
roll changes every ancestor. An ancestor whose recorded child digest no longer
matches is reported **`stale`** — a third state, distinct from `failed`. A stale
ancestor is not evidence of tampering; it is evidence that a correction has not
been adopted yet. This is the same three-state discipline the receipt verifier
already draws between `verified`, `failed`, and `unverifiable`, and for the same
reason: collapsing "out of date" into "wrong" trains people to ignore the alarm.

### 5. Shared assumptions

A composite MAY declare assumptions its descendants inherit:

```json uw:section=assumptions shared=true v=1
{ "exit_cap_rate_spread": 0.0050, "reserve_per_unit": 300 }
```

Inheritance is resolved through the **existing cascade**, as a new step between
`user_input` and `market_data`:

```
user_override → user_input → inherited_assumption → market_data
  → asset_class_default → global → system
```

- An inherited value is tagged `source: "inherited_assumption"` and records the
  ancestor `document_id` and digest it came from, so a value is always traceable
  to the document that asserted it.
- A descendant's own `user_input` **always wins**. Inheritance supplies defaults;
  it never overrides a value someone entered on the deal.
- Inheritance is resolved along the composition DAG only. A document not
  reachable as an ancestor contributes nothing, and there is no ambient or
  global assumption scope.
- Where two ancestors supply the same field, the **nearest** ancestor wins;
  equidistant ancestors are an error (`COMP-AMBIGUOUS-INHERIT`) rather than a
  silent pick. Diamond inheritance resolves explicitly or not at all.

Investor profiles (cascade step 2) are deliberately out of scope here; see
RFC 0022's scoping note.

### 6. Rollup receipts

A composite states aggregate figures. It does **not** compute them in the calc
engine, because the Tier-3 sandbox has no iteration and no array indexing —
RFC 0019 reached exactly this wall for `mixed_use` components and concluded
per-component pack evaluation is not expressible without a new primitive. A
portfolio total over N assets is the same problem at a different scale.

Rather than change the sandbox, a composite carries stated aggregates whose
provenance names the children they came from:

```json uw:section=portfolio_rollup v=1
{
  "aggregates": [
    {
      "id": "portfolio_noi",
      "fn": "sum",
      "over": "noi_model.net_operating_income",
      "members": ["deal:parkview", "deal:riverside"],
      "value": 1049823
    }
  ]
}
```

A **rollup receipt** (an RFC 0016 receipt over a composite) verifies in two
stages:

1. **Child stage.** Each named member's own receipt is verified — its record
   digest is unchanged and its pack outputs recompute. This is existing
   behaviour, applied per child.
2. **Parent stage.** The aggregate is recomputed by applying `fn` to the `over`
   path of exactly those member digests, and compared to the stated `value`.

The permitted `fn` set is small, total, and deterministic: `sum`, `count`,
`min`, `max`, and `weighted_average` (which requires a `weight_by` path). This
is **not** an extension of the calc expression language — it is a fixed,
non-extensible aggregation vocabulary evaluated by the receipt verifier. Nothing
here lets a module or a document author introduce a new aggregation, and nothing
here makes the Tier-3 evaluator iterate. A general aggregation primitive remains
future work, and if it ever lands, it supersedes this section rather than
sitting beside it.

The assurance boundary is unchanged and worth restating, because a portfolio
figure is exactly the kind of number people over-trust: a verified rollup means
the stated total follows deterministically from those child records as they
stand. It does not mean the children are complete, that the portfolio contains
every asset it should, or that any input is true.

### 7. Error codes

| Code | Meaning |
|---|---|
| `COMP-DUP-KEY` | Two fragments claim the same `collection_key` value. |
| `COMP-UNRESOLVED` | A declared part or member does not resolve in the package. |
| `COMP-COUNT-MISMATCH` | `part_count` disagrees with `parts.length`. |
| `COMP-CYCLE` | The composition graph contains a cycle. |
| `COMP-DEPTH` | Resolution exceeded the depth or member-count bound. |
| `COMP-SECTION-MISMATCH` | A fragment contains a block for a section other than its declared one. |
| `COMP-AMBIGUOUS-INHERIT` | Equidistant ancestors supply the same assumption. |
| `COMP-ROLLUP-DISAGREES` | A stated aggregate does not match recomputation. |

## Compatibility analysis

Every existing `.uwx.md`, `.uw.md`, envelope, CSV bundle, and package remains
valid and unchanged. A record with no externalized sections resolves to itself,
so I-1 holds trivially for the entire existing corpus.

Tier 1–4 implementations remain conforming without change. A reader that does
not implement composition MUST report an externalized section as unresolved
rather than presenting the record as complete — a partial rent roll shown as a
whole one is the failure this rule exists to prevent.

The calc engine, module manifest, pack registry, `_meta` ownership rules, and
Tier-2 byte-preservation semantics are untouched.

## Conformance impact

A new named `composition` suite:

- `resolve/inline-vs-external/` — **the I-1 fixture.** The same rent roll
  authored inline and as fragments must produce byte-identical canonical forms
  and identical semantic digests. This is the suite's reason for existing.
- `resolve/collection-order/` — fragments listed in shuffled `parts` order and
  shuffled ZIP order resolve to one canonical form.
- `resolve/nested-composite/` — a portfolio of deals of fragments, proving
  recursion and depth accounting.
- `reject/duplicate-key/`, `reject/cycle/`, `reject/depth-exceeded/`,
  `reject/count-mismatch/`, `reject/section-mismatch/`,
  `reject/ambiguous-inherit/` — one per error code.
- `stale/leaf-corrected/` — correcting a leaf reports ancestors `stale`, not
  `failed`, and re-resolution clears it.
- `unresolved/missing-part/` — a missing part yields `unverifiable` and
  explicitly **not** a smaller collection. Asserted by comparing row counts, so
  silent under-resolution fails loudly.
- `inherit/nearest-ancestor/` — nearest wins, descendant `user_input` beats
  inheritance, and the source tag records the ancestor digest.
- `rollup/verified/`, `rollup/child-mutated/`, `rollup/stated-disagrees/` —
  the two-stage receipt, including that mutating a child invalidates the parent
  rollup.
- `lite-projection/externalized/` — the UWX→Lite projection names externalized
  sections in its omission report.

## Reference implementation

- `spec/UW_COMPOSITION_v1.md` — normative fragment grammar, resolution
  algorithm, merge order, and bounds.
- `spec/schemas/uwpart.schema.json`, `uw-external-section.schema.json`,
  `uw-rollup.schema.json`.
- `packages/uwmd-core/src/composition.ts` — `parseUWPart`, `resolveComposition`,
  `ResolvedDocument`, bounds, and the error taxonomy. Browser-safe.
- `packages/uwmd-core/src/receipts.ts` — extended with the two-stage rollup
  verification and the fixed `fn` vocabulary.
- `packages/uwmd-core/src/cascade.ts` — the `inherited_assumption` step.
- CLI: `uwmd resolve <package>`, `uwmd compose --externalize <section>`, and
  `--resolved` on `verify`/`export`.

## Alternatives considered

1. **Add iteration to the Tier-3 sandbox.** Cleanest conceptually — one
   mechanism would serve portfolios and `mixed_use` both. Rejected for now
   because it is a large, security-sensitive change to a deliberately total
   evaluator, and the rollup-receipt approach delivers verifiable portfolio
   totals without it. If RFC 0019 later motivates the primitive, §6 folds into
   it.
2. **Let the parent's digest cover only its own bytes.** Cheaper, and it avoids
   resolution during verification. Rejected because it makes an externalized
   record a *different artifact* from its inline equivalent, so the packaging
   decision leaks into identity and every consumer must know which form it holds.
3. **Last-one-wins on duplicate collection keys.** Rejected: it turns a data
   conflict into an ordering accident, and the resulting rent roll is wrong in a
   way nothing detects.
4. **Resolve references over the network.** Rejected outright — it would break
   the offline-verifiable property and the safe-ZIP boundary. RFC 0018's
   reference handles already cover "where bytes might be obtained", with
   resolution an explicit opt-in host action.
5. **Put composition in Lite as well.** Rejected; see §3.

## Unresolved questions

- Whether a fragment may itself externalize (fragments containing fragments).
  Currently forbidden by omission; the depth bound would cover it if allowed.
- Whether `weighted_average` is the right fifth aggregate, or whether the set
  should stop at four until a real portfolio demands it.
- Whether a composite should be able to declare a section *partially*
  externalized — some rows inline, the rest in fragments. Deliberately excluded
  from v1 because it complicates I-1 considerably for unclear benefit.
- Interaction with RFC 0010 signed blocks: whether a signature over a resolved
  form is meaningful when the parts are individually signed.
