---
rfc: 0073
title: Previous identifiers for module-declared asset classes
status: draft
author: claude-code (agent proposal)
created: 2026-10-04
affects:
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0073: Previous identifiers for module-declared asset classes

## Summary

A module can declare that one of its custom asset classes was earlier
published under other identifiers. A host then resolves a document that
states a retired identifier to the declaration that now carries it. It reports
that it did so, and it never rewrites what the document says.

The field sits on each `declares_asset_classes[]` entry, not on the module
manifest or the implementation manifest. The asset-class id is the only one of
the three ids issue #263 names that the protocol resolves a document by.

This RFC is `draft`. Its presence authorizes no normative text, schema, code,
fixture or version change.

## Motivation

### Demonstrated consumer

Issue [#263](https://github.com/UWMD-OSP/UW-Markdown/issues/263) (StackUW
`UPSTREAM-023`). StackUW produces signed `.uwx.md` records and has retired the
product domain its reverse-DNS ids were built from. It wants future releases
under the current domain's namespace, and documents written under the old ids
should stay readable through a path the protocol defines rather than a
StackUW-only alias table.

### Current behavior

The [renamed-identifier review](https://github.com/UWMD-OSP/UW-Markdown/blob/main/docs/reviews/2026-10-04-renamed-identifiers.md)
reproduces each point on `main` at `83248a6`.

- **Module ids do not decide resolution.** Protocol §X.2.2 resolves a document's
  `asset_class` against the classes loaded modules declare. The document's
  `modules` list (Format §2.2a) names what to load and is never compared with
  what is loaded. Renaming only a module id leaves old documents resolved
  (review F1). The issue's example renames only the module, so its stated
  `MOD-MISSING-001` does not reproduce.
- **Class ids do.** A document whose class id was renamed is Unresolved,
  `MOD-MISSING-001` (F2).
- **Old documents can already be kept resolvable.** The renamed module keeps
  declaring each retired class id beside the new one. Every current host
  resolves both and runs the same calculations (F3).
- **What that cannot do.** It cannot state that the two ids are one class.
  Each resolves to its own declaration and reports its own id (F4), a shared
  display name raises `MOD-DISPLAY-CONFLICT-001`, and the duplicated
  declarations can drift apart. A host can't report "resolved through a
  retired id", and a consumer grouping documents by class sees two classes.

### Identity model

| Identifier | What it is | Resolves a document? |
|---|---|---|
| `declares_asset_classes[].id` | The class identity a document states in `asset_class`. Reverse-DNS fixes its owner (Format §2.2a). | **Yes**, §X.2.2 |
| Module `id` | Registry key (`PROTO-MOD-066`), `depends_on` key (`PROTO-MOD-027`), signed manifest content (§X.1.1), and in documents a locator hint. | No |
| Implementation `id` | Self-description (§I.4). Only the conformance runner's run report records it; receipts name the engine by a separate free string. | No |

Aliasing a module id or an implementation id would act on nothing the
protocol resolves, so this RFC adds no field for them
([Alternatives](#alternatives-considered)). Aliasing a class id preserves
identity rather than collapsing two, under one condition: the declaring
producer previously published the class under that id. The RFC states that
condition as a producer obligation, because no host can verify it.

## Proposed change

### Layer

| Surface | Change |
|---|---|
| Format | No document change: no field is added, and `asset_class` and `modules` keep their meaning and bytes. Part V's list of resolution-time findings names the new code, which is editorial. |
| Protocol | §X.2.1 adds the field; §X.2.2 adds one resolution step; §X.2.3 extends conflicts; §X adds a `requires_protocol` floor; §III.6a registers one code. |
| Manifest schema | `module-manifest.schema.json`: optional `previous_ids` on the `declares_asset_classes` item. `manifest_version` stays `"1"`, as with RFC 0003's and RFC 0066's additions. |
| Implementation manifest schema | None. |
| Conformance | New `conformance/modules/asset-classes/` scenarios and `conformance/modules/reject/` manifests ([Conformance impact](#conformance-impact)). |
| Reference library | `asset-class.ts`, `modules.ts`, `module-runtime.ts`, `protocol.ts`. |

### Candidate data shape

```json
{
  "declares_asset_classes": [
    {
      "id": "com.example_new.data_center",
      "display_name": "Data Center",
      "fallback": "industrial",
      "previous_ids": ["com.example_old.data_center"]
    }
  ]
}
```

`previous_ids` is optional. When present, it is a non-empty array of unique
strings, and each entry:

1. is a well-formed custom identifier under Format §2.2a. A builtin, or an
   identifier whose final segment is a builtin name, is refused, as §X.2.1
   already refuses for `id`.
2. equals no `id` and no other `previous_ids` entry anywhere in the same
   manifest.

A manifest that violates either rule is refused at load. Candidate codes:
`PROTO-MOD-080` for a malformed list or entry and `PROTO-MOD-081` for an entry
that repeats an identifier the manifest already uses. The next free numbers are
confirmed against `verify-codes` at implementation.

Nothing requires an entry to share the declaration's namespace or final
segment. A namespace move changes the prefix by definition, and equivalence is
only ever declared, never inferred from similar names.

### Resolution (§X.2.2, amended)

Let `c` be the document's `asset_class`, and `L` the declarations of the
loaded modules.

1. A builtin, or a malformed identifier, is handled as today.
2. Let *Current* be the declarations in `L` whose `id` equals `c`, and
   *Previous* the declarations in `L` whose `previous_ids` contains `c`.
3. If *Previous* is empty, resolution is exactly today's, including §X.2.3's
   handling of two declarations sharing an `id`.
4. If *Previous* is non-empty and *Current* plus *Previous* hold more than one
   declaration, the host MUST NOT resolve through any of them. It reports
   `MOD-ASSET-CLASS-CONFLICT-001` and the outcome is Unresolved. It does not
   prefer the current id, the first-loaded module or any other ordering.
5. If *Previous* holds exactly one declaration `d` and *Current* is empty, the
   class is **Resolved through a previous id**. The resolution reports:
   - `id`: `c`, exactly as the document states it;
   - `current_id`: `d.id`;
   - `MOD-PREVIOUS-ID-001` (info), naming both.

   Every consumer that selects behavior by the document's class MUST select
   `d` here. That covers which modules run (§X module runtime) and whose
   `required_sections` and `optional_sections` apply. No two consumers may
   read different classes for one document, which is the rule RFC 0066
   states for variant maps.
6. Matching is single-hop. `c` is compared with current ids and previous ids;
   a previous id is never itself looked up again. A class renamed twice lists
   both retired ids on its current declaration.

**Degraded resolution** applies the same steps to the declarations the host
holds without the module (§X.2.2 *Holding a declaration is not holding the
module*). Exactly one match with a `fallback` degrades with `MOD-FALLBACK-001`
and `MOD-PREVIOUS-ID-001`. More than one match is Unresolved with
`MOD-ASSET-CLASS-CONFLICT-001`. Without this, a host holding the current
declaration would degrade new documents and fail old ones, which breaks the
parity §X.2.2 promises.

**Determinism.** The outcome depends only on the document and the set of loaded
or held declarations, as it does today. Two hosts holding the same declarations
reach the same outcome, and no outcome this RFC adds depends on load order.

### Conflicts (§X.2.3, amended)

Beyond today's identical-`id` case, the host reports
`MOD-ASSET-CLASS-CONFLICT-001` (error) when, across loaded modules:

- one declaration's previous id equals another declaration's `id`; or
- two declarations list the same previous id.

The registry-level check that reports today's conflict
(`assetClassDeclarationConflicts` in the reference library) reports both, and
step 4 refuses any document that reaches one. A cycle (A lists B's id and B
lists A's) is the first case twice. Inside one manifest it is refused at
load.

### Producer obligations (§X.2.1, amended)

- A declaration MUST list in `previous_ids` only identifiers under which the
  same producer previously published the same class.
- A producer MUST NOT later declare a retired identifier as the `id` of a
  different class. Hosts can detect a violation only between modules loaded
  together, so this obligation binds authors.
- A manifest that uses `previous_ids` MUST declare a `requires_protocol` range
  that excludes every Protocol version without this RFC, for the reason RFC
  0071 gives: a pre-RFC host refuses the manifest's unknown key with
  `PROTO-MOD-064` (review F7), and the floor makes that a clean version refusal
  (`PROTO-MOD-030`). The exact floor is set at release preparation.

### Provenance and edits

- Resolving through a previous id changes nothing in the document. A host MUST
  NOT rewrite `asset_class` or a `modules` entry as a side effect of parsing,
  resolution, validation, rendering, conversion, refinement or any edit that
  does not target that path. Round-trip preservation (§V.1) already holds for
  edits; this sentence extends the rule to conversions, which carry the
  authored value.
- A producer MAY move a document to the current id with an explicit
  frontmatter edit. That is an ordinary write with ordinary provenance, it
  changes the document digest any receipt binds, and it does not touch block
  signatures, which sign no frontmatter (§V.11.2). The protocol defines no
  migration marker.
- Resolution metadata reports the authored and current ids separately, and
  `MOD-PREVIOUS-ID-001` is a resolution-time finding, not a validation rule.
  Format Part V already says that of the other `MOD-*` resolution codes.
- A module signature covers `previous_ids` like every other field (§X.1.1), so
  the claim is as trustworthy as the host's key-to-identity binding (§X.1.5).
  The claim grants nothing a module cannot already do: an unsigned module can
  declare someone else's class id as its own current id today.

### Library

- `AssetClassResolution`'s `resolved` and `degraded` variants gain an optional
  `current_id`, present only when resolution went through a previous id, and
  an optional info `issue`. `id` stays the authored value.
- `ModuleAssetClassDecl` gains `previous_ids?: string[]`.
- `assetClassDeclarationConflicts` reports the two new conflict cases.
- `applicableModules` in `module-runtime.ts` selects by the resolution result
  instead of exact `declares.includes(assetClass)`.
- `BUILTIN_REMEDIATIONS` registers `MOD-PREVIOUS-ID-001`, and the loader
  registers the two `PROTO-MOD` codes. The change is additive.

## Compatibility analysis

- **Existing documents.** Unchanged and still valid. No document gains or loses
  a field. A document stating a retired id becomes resolvable only on a host
  that loads a module claiming it.
- **Existing manifests.** A manifest without `previous_ids` behaves exactly as
  today.
- **Pre-RFC hosts.** They refuse any manifest carrying `previous_ids`, through
  the required `requires_protocol` floor and the unknown key. A producer that
  must still load on those hosts keeps declaring the retired id as its own
  declaration (review F3). One manifest cannot do both, because rule 2 refuses
  an identifier used as both an `id` and a previous id.
- **Tiers.** A host that loads no modules and holds no declarations sees no
  change. Tier-2 editors gain only the no-rewrite rule, which byte
  preservation already implies for edits. Hosts that load modules or hold
  declarations implement the step.
- **Versions.** Protocol minor (an additive field, an additive code and an
  additive resolution step). Format version unchanged. `manifest_version`
  unchanged.
  Packages are versioned by the release that carries it.

## Conformance impact

No existing fixture changes. RFC 0003's invariant stays: scenarios 01–03 share
one byte-identical deal, so the verdict visibly depends on the reader.
Scenarios 05 and 07–10 likewise share one deal stating the retired id, so their
verdicts differ only in what is loaded.

New `conformance/modules/asset-classes/` scenarios:

| Scenario | Loaded | Document `asset_class` | Expected |
|---|---|---|---|
| 05 previous id | declaration `new` with `previous_ids: [old]` | `old` | `resolved`, `id: old`, `current_id: new`, `MOD-PREVIOUS-ID-001`; module calculations run |
| 06 current id unaffected | same | `new` | `resolved`, no `current_id`, no info |
| 07 previous versus current | module A declares `old`; module B lists `old` as previous | `old` | `unresolved`, `MOD-ASSET-CLASS-CONFLICT-001`, regardless of load order (run both orders) |
| 08 two previous claims | modules A and B both list `old` | `old` | `unresolved`, `MOD-ASSET-CLASS-CONFLICT-001`, both orders |
| 09 degraded through previous id | no module; held declaration `new` with `previous_ids: [old]` and a fallback | `old` | `degraded`, `MOD-FALLBACK-001` and `MOD-PREVIOUS-ID-001` |
| 10 no chains | declaration `new` with `previous_ids: [mid]` only | `old` (a retired id of `mid`, not listed on `new`) | `unresolved`, `MOD-MISSING-001`: matching is single-hop |

New `conformance/modules/reject/` manifests: a builtin previous id, a previous
id ending in a builtin name, a previous id equal to the declaration's own `id`,
one equal to another declaration's `id` in the same manifest, a duplicate
entry, and an empty list.

A Tier-2 fixture shows `applyEdit` on an unrelated path leaves `asset_class`
stating the retired id byte-for-byte. A `MOD-ASSET-CLASS-CONFLICT-001` fixture
for today's identical-`id` case also lands, closing the gap the review found.

## Reference implementation

- **Files:** `packages/uwmd-core/src/asset-class.ts`, `modules.ts`,
  `module-runtime.ts`, `protocol.ts`, their tests, the schema,
  `scripts/run-conformance.mjs` for the new scenario fields, and the
  Protocol §X.2 text.
- **API:** the additive fields above; no new export.
- **Tests:** each conformance row as a unit test; both load orders for every
  conflict; the runtime runs the claiming module for a retired-id document;
  and the review's repro F2/F4 probes flip from current behavior to the new
  outcome. The three *renamed identifiers under the current contract* tests in
  `asset-class.test.ts` stay green: only `previous_ids` changes resolution.

## Alternatives considered

1. **`previous_ids` on the module manifest and the implementation manifest,
   as the issue proposes.** Rejected for both.
   - Module: the id resolves no document (review F1). The paths it would serve
     are `depends_on`, where the dependent is itself a signed, versioned
     manifest re-released to change it, and the document's `modules` hint,
     where a host without the module cannot read the mapping (F8). Adding a
     field for symmetry would put alias semantics on a key nothing resolves.
   - Implementation: nothing resolves, persists or verifies by it. Receipts
     compare a separate `(engine, engine_version)` pair, which changes on
     every release anyway.
   - Revisit trigger: a demonstrated host that selects which installed modules
     to load from a document's `modules` list. The protocol defines no such
     selection today.
2. **Do nothing; document dual declaration.** It works on every current host
   (F3) and is the right interim path. It can't state equivalence, can't
   report it, and lets the two declarations drift. If no consumer needs
   equivalence, this alternative wins and the RFC is withdrawn; see the
   owner decision below.
3. **Rewrite documents to the current id on resolution or re-export.**
   Rejected. It breaks byte preservation, changes receipt digests behind the
   producer's back, and destroys the record of what the document stated.
4. **Transitive chains** (`old → mid → new`). Rejected. A flat list states the
   same history, and it gives a single-hop lookup with no cycle detection and
   no partial-chain conflicts.
5. **Current id wins over a previous-id claim.** Deterministic, but it rewards
   whoever re-registers a retired namespace and hides the collision. §X.2.3
   already refuses to choose between two claims on one identifier, and step 4
   follows that precedent.
6. **A registry or remote lookup of retired ids.** Rejected. Resolution stays
   offline and depends only on what the host loaded (RFC 0003 Alternative 2;
   §X.1.2 on keeping the conformance corpus offline and deterministic).
7. **Infer equivalence from matching final segments** (`*.data_center`).
   Rejected. Format §2.2a calls host-side suffix matching a bug.

## Unresolved questions

### Owner decision

- **Acceptance gate.** Dual declaration already keeps old documents
  resolvable on every host (review F3) and needs no release. The choice is
  whether declared equivalence (reporting, one identity for grouping, no drift
  between duplicates) is worth a Protocol minor and a field that pre-RFC hosts
  refuse. The recommendation is to keep this RFC `draft` until StackUW
  answers the review's three reporter questions. Accept it if a class id
  actually moves and a consumer needs the ids treated as one; otherwise
  withdraw it and document dual declaration.

### Settled from repository evidence, recorded for review

- Single-hop matching and refusal on any multi-claim follow §X.2.3.
- `MOD-PREVIOUS-ID-001` is info: the document is well-formed and the read is
  full, as with `MOD-DISPLAY-CONFLICT-001`.
- Degraded resolution honors previous ids, to keep §X.2.2's parity.
- Schema `$id`: none. Normative schemas use flat
  `https://uwmd.org/schemas/<name>.schema.json` ids, and no module section
  fragment carries a `$id`. A producer's own schema URLs are outside the
  protocol.

### Outside this RFC

- Protocol §VII.3 cross-module section, calculation and view-model conflicts
  are not enforced by the reference registry (review, *Related defects*). That
  is a bug fix against an existing MUST, not part of this design.
- Today's identical-`id` conflict is reported, but the reference
  `resolveAssetClass` still returns the first-loaded declaration. Whether that
  is "picking silently" under §X.2.3 is a separate question.

## Prior art

- **Java module and Maven relocation.** Maven's `<relocation>` points an old
  coordinate at a new one, but the pointer lives in the old artifact's POM,
  which a consumer must fetch. The UWMD equivalent, data held under the old
  id, can't reach a host that lacks it (review F8). That's why the claim here
  lives on the new declaration.
