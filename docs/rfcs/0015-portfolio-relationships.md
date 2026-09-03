---
rfc: 0015
title: Add portfolio and relationship profiles
status: implemented
author: jaredmaxey
created: 2026-08-05
revised: 2026-09-02
accepted: 2026-09-02
implemented: 2026-09-02
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0015: Add portfolio and relationship profiles

> **Accepted and implemented 2026-09-02** (protocol 2.1.0 → 2.2.0, new
> §XV, Future work renumbered §XVI; corpus 356 → 363). **One erratum,
> found by building it:** the conformance sketch's scenario 05 asked a
> *targeted edit* to prove extension edges and fields survive
> byte-for-byte — but this RFC's own reference-implementation section
> declares the surface read-only, so there is no editor to run that
> edit through. Scenario 05 instead pins the halves that are real
> today: extension types and fields validate clean, are reported via
> `uninterpretedPortfolioTypes`, and are retained through validation
> (`preserved_paths`). The §XV.3 byte-preservation obligation stands
> normatively and binds implementations that *write* sidecars;
> conformance for it waits until an editor exists to test.

> **Revised 2026-09-02 to acceptance-ready**, after the 2.0.0 release.
> The 2026-08-05 draft predated four things it must now sit on, and the
> revision absorbs each rather than leaving them to be rediscovered at
> review: **RFC 0018** (accepted 2026-08-13, implemented) established
> the canonical two-layer edge registry this draft's edge list is
> superseded by — and shipped `UWEntityEdge` +
> `projectPackageLinksToEntityEdges`, so the *edge shape* this RFC
> standardizes already exists in core with a producer and no portable
> carrier; **RFC 0020** renamed the structured record to `.uwx.md`;
> **RFC 0030** made capabilities mechanically checkable, which dictates
> how this RFC's conformance suite must be owed; and **RFC 0031 / the
> 2.0 cut** cleaned up the source vocabulary this sidecar's provenance
> entries must be kept distinct from. The "v2 sidecar" framing is
> retired: protocol 2.0 shipped, and this is an ordinary **additive
> optional capability** with its own independent version line.

## Summary

Define an optional portfolio-profile **sidecar** —
`<portfolio>.uwportfolio.json` — that lets implementations exchange
typed entities and provenance-backed relationship edges *around*
canonical UW Markdown deals: a borrower owns properties, a property
secures a loan, a source document supports a deal. The sidecar is the
portable carrier for the **entity layer** of the edge registry RFC 0018
established (protocol `BUILTIN_EDGE_TYPES`), whose entity-layer edges
core can already *produce* (`projectPackageLinksToEntityEdges`) but
nowhere *keep*. It adds no database, no query language, and no
financial calculation semantics — aggregates belong to RFC 0021's
rollup receipts, and storage belongs to hosts.

## Motivation

A `.uwx.md` file is a strong canonical underwriting record, but
portfolio review needs relationships that span files. Today hosts
recreate those links privately, preventing portable rollups and
auditable batch workflows. The gap is now sharper than when this RFC
was first drafted, because half the machinery exists with nowhere to
point:

- The protocol carries a canonical **edge registry**
  (`BUILTIN_EDGE_TYPES`, RFC 0018 §5) with an `entity` layer —
  `owns`, `borrows_against`, `secures`, `guarantees`, `supports`,
  `related_to` — that no interchange artifact can carry. Edges valid on
  the `member` layer travel in a package manifest; edges valid on the
  `entity` layer travel nowhere.
- Core ships `projectPackageLinksToEntityEdges`, which **synthesizes
  entity-layer edges** from a deal package's typed links — and returns
  them to the caller as ephemeral values. A producer with no portable
  destination is the same shape of gap the module system had before
  RFC 0006 gave it a consumer.
- The status doc's absent **L9/L10 layers** (portfolio, relationship)
  are blocked on exactly this data surface existing.
- Downstream, every data-lake and portfolio consumer (the batch
  indexer, underwriter.cc's portfolio views) needs cross-deal identity
  and edges as *interchange*, not as a private table.

## Proposed change

Add an optional **`portfolio-relationships`** protocol capability
(RFC 0030 vocabulary, self-declared per §II.6) and a JSON sidecar named
`<portfolio>.uwportfolio.json`. A sidecar is not part of any individual
`.uwx.md` file: it does not claim ownership of any file's `_meta` and
does not change any record's canonical bytes.

```json
{
  "portfolio_version": "1.0",
  "portfolio_id": "industrial-2026",
  "entities": [
    { "id": "property:parkview", "type": "property", "deal_id": "uw_2026_a3f9b1" },
    { "id": "borrower:acme", "type": "borrower", "display_name": "Acme Holdings" },
    { "id": "loan:acme-parkview-senior", "type": "loan" }
  ],
  "edges": [
    { "id": "edge:1", "type": "owns", "from": "borrower:acme", "to": "property:parkview",
      "provenance": [{ "source": "org-chart.pdf", "locator": "p.2" }] },
    { "id": "edge:2", "type": "secures", "from": "property:parkview", "to": "loan:acme-parkview-senior",
      "provenance": [{ "source": "loan-agreement.pdf", "locator": "§2.1" }] }
  ]
}
```

The protocol's new Portfolio Relationships section will contain these
normative rules:

- A profile object MUST contain `portfolio_version`, `entities`, and
  `edges`; `portfolio_id` is RECOMMENDED. **`portfolio_version` is
  independently versioned** from the UW format and protocol (the
  semver-per-surface rule); this RFC defines `1.0`.
- Each entity and edge `id` MUST be non-empty and unique within the
  profile. IDs are opaque, case-sensitive strings; consumers MUST NOT
  derive identity from an ID's spelling (the `property:` prefix in the
  example is a producer convention, not grammar).
- The initial entity types are `property`, `deal`, `borrower`, `loan`,
  and `document` (closed for v1; extension types MUST be preserved and
  MAY be reported as uninterpreted). Each entity MUST have `id` and
  `type`; `display_name` is optional. A `property` or `deal` entity MAY
  carry `deal_id`, which MUST exactly equal the canonical frontmatter
  `deal_id` when the referenced deal is available — the sidecar's one
  anchor into the records it describes.
- Every edge MUST have `id`, `type`, `from`, `to`, and a non-empty
  `provenance` array. `from` and `to` MUST resolve to entity IDs in the
  same profile. Apart from the added `id`, an edge is exactly core's
  existing **`UWEntityEdge`** shape — this RFC standardizes the shape
  that already ships rather than minting a sibling.
- **Edge types come from the canonical registry, not from this RFC.**
  Validation resolves an edge's type through the protocol registry
  (`lookupEdgeType` / `isEdgeTypeValidOnLayer`): a *known* type not
  valid on the `entity` layer (e.g. `abstracts`) MUST be refused — the
  registry's one-table-two-layers rule — while an *unknown* type MUST
  be preserved and MAY be reported as uninterpreted. Where the registry
  declares `from`/`to` entity-type constraints for a builtin edge, a
  violation MUST be refused. This RFC adds **no rows** to the registry;
  if review finds a missing entity-layer type, it lands as an amendment
  to the registry section under RFC 0018 §5's ownership rule, never as
  a second table here.
- Each provenance entry MUST contain a stable `source` identifier and
  MAY contain `locator`, `note`, or `retrieved_at`. **`source` here is
  a document/source identifier** (the lease-abstract `SourceRef`
  posture — "which artifact says so, and where"), NOT the
  `_meta.source` actor grammar RFC 0031 defined; the two vocabularies
  stay apart by construction, and the schema description says so to
  keep the conflation 0031 cleaned up from re-forming in a new home.
- A profile update MUST append provenance evidence or replace the
  affected sidecar as a new version. It MUST NOT silently remove
  provenance from an existing edge. This is an append-only evidence
  rule, not a requirement for a database or a revision-control system.
- A targeted edit MUST preserve bytes outside the edited region, and
  unknown fields at every level MUST survive round-trips (the §XII
  posture).

Hosts MAY store, query, index, or enrich profiles however they choose.
The profile MUST NOT define SQL tables, graph traversal semantics,
aggregate financial calculations, or ownership of host `_meta` fields.
**Aggregates already have a home:** a portfolio that wants to *state*
fund-level numbers uses an RFC 0021 composite with rollup receipts;
this sidecar is descriptive, and the previously-unresolved question of
whether it may expose deterministic aggregates is resolved by that
division — it may not, because 0021 already does.

**Relationship to the Deal Package.** `projectPackageLinksToEntityEdges`
becomes the reference *producer* for this format: its output, plus
generated `id`s, is a valid `edges` array. The UW Deal Package (RFC
0018 §3) remains the transport for one deal's artifacts; the sidecar
relates *many* deals and travels beside them (in a directory, an
archive, or an object store — transport out of scope, as ever).

## Compatibility analysis

Existing files and Tier 1–4 implementations remain conforming: the
profile is optional, additive, and out-of-band. An implementation that
does not declare `portfolio-relationships` ignores sidecars entirely,
and under RFC 0030 its conformance run *visibly skips* (never passes)
the suite. No format version moves; **protocol 2.0.0 → 2.1.0**
(additive normative section — and this lands after or alongside RFC
0034's §VIII.9, whichever implements first taking the next minor).
Modules are untouched.

## Conformance impact

Existing fixtures require no change. New suite
`conformance/portfolio-relationships/`, owed under the
`portfolio-relationships` capability (cases carry
`requires_capabilities` derived from the command they run, per RFC
0030):

- `01-valid-multi-deal/` — a borrower, loan, two properties, and
  source-document evidence; validation verdict frozen.
- `02-missing-provenance/` — rejection for an edge with an empty
  provenance array.
- `03-duplicate-id/` — rejection for a duplicate entity or edge ID.
- `04-dangling-edge/` — rejection for an edge endpoint that does not
  resolve locally.
- `05-unknown-preservation/` — a targeted edit proves an extension edge
  type and unknown fields survive byte-for-byte.
- `06-wrong-layer/` — rejection for a *known* member-layer type
  (`abstracts`) used as an entity edge — the registry's two-layer rule,
  pinned from the sidecar side for the first time.
- `07-package-projection/` — `projectPackageLinksToEntityEdges` output
  over a fixture manifest round-trips into a valid sidecar (producer
  and carrier agree).

## Reference implementation

No behavior until acceptance. Planned surface, browser-safe and
read-only:

- `spec/schemas/uw-portfolio-profile.schema.json` — the sidecar schema.
- `packages/uwmd-core/src/portfolio.ts` — `PortfolioProfile`,
  `PortfolioEntity`, `PortfolioEdge` (extends `UWEntityEdge` with
  `id`), `validatePortfolioProfile()` (registry-aware via
  `lookupEdgeType`), `getPortfolioRelationships()`, and
  `entityEdgesToPortfolioEdges()` (the projection bridge).
- `packages/uwmd-core/src/index.ts` / `src/browser.ts` — exports.
- CLI: `uwmd portfolio validate <sidecar>` and
  `uwmd portfolio edges <sidecar>` — needed not just for operators but
  because the RFC 0004
  conformance driver runs suites through CLI commands, and a suite with
  no command cannot be generated for the protocol driver.
- Tests: identity, endpoint resolution, wrong-layer refusal, provenance
  append-only, unknown-field preservation, projection round-trip, and
  deterministic canonical-digest coverage.

No calc packs, no validators for individual deal files, and no Tier-4
agent permissions change. The L9/L10 layers this RFC's data surface
would feed remain out of scope — reference implementations of those
layers are follow-up work that should not gate the interchange format.

## Alternatives considered

1. **Embed a database schema in the format.** Over-specifies storage,
   forces relational assumptions on graph and file-backed hosts, and
   makes schema migrations a format concern.
2. **Use a free-form metadata bag.** Easy to add but supplies neither
   interoperable types nor provenance guarantees.
3. **Link only by URLs.** URLs cannot model borrower/loan relationships
   reliably in offline bundles and are not stable entity identifiers.
4. **Put relationship data in each deal's `_meta`.** Couples a
   portfolio graph to a single document, duplicates edges, and violates
   the host ownership boundary for `_meta`.
5. **Carry edges only inside Deal Packages.** Rejected because a
   package is one deal's transport; cross-deal edges (borrower ↔ three
   properties in three packages) have no single package to live in —
   which is the gap the projection function's ephemeral return value
   makes concrete.

## Unresolved questions

- **Cross-profile identity collision policy** — two sidecars naming
  `borrower:acme` independently. Deferred; a future federation RFC can
  add namespacing without breaking `1.0` profiles (IDs are opaque).
- **Signature/permission model** — whether a sidecar can carry an RFC
  0010-style signature and whether RFC 0011 capability tokens should
  gate sidecar edits. Deferred to follow-up; the machinery exists and
  is deliberately not required for `1.0`.
- **Locator vocabulary** — provenance `locator` stays free-text in
  `1.0`, matching the lease-abstract posture; a shared locator grammar
  is a cross-RFC concern (0018's source references, lease abstracts,
  and this sidecar) that should be solved once, for all three.

## Prior art

[JSON-LD](https://www.w3.org/TR/json-ld11/) typed nodes and edges,
[W3C PROV](https://www.w3.org/TR/prov-dm/) provenance, and OpenAPI
extension preservation inform the design. Internally: RFC 0018 §5 (the
registry this RFC's edges resolve against) and RFC 0021 (the rollup
boundary that keeps this RFC descriptive).
