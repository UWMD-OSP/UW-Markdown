---
rfc: 0015
title: Add portfolio and relationship profiles
status: draft
author: jaredmaxey
created: 2026-08-05
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0015: Add portfolio and relationship profiles

## Summary

Define an optional v2 portfolio-profile sidecar that lets implementations exchange typed entities and provenance-backed relationship edges around canonical UW Markdown deals. It adds no database, query language, or financial calculation semantics.

## Motivation

A `.uw.md` file is a strong canonical underwriting record, but portfolio review needs relationships that span files: a borrower owns properties, a loan is secured by a property, and source documents support a deal. Today hosts recreate those links privately, preventing portable rollups and auditable batch workflows.

## Proposed change

Add an optional `portfolio-relationships` protocol capability and a JSON sidecar named `<portfolio>.uwportfolio.json`. A sidecar is not part of an individual `.uw.md` file and therefore does not claim ownership of the file's `_meta` or change its canonical bytes. It has this initial shape:

```json
{
  "portfolio_version": "2.0-draft",
  "entities": [
    { "id": "property:parkview", "type": "property", "deal_id": "uw_2026_a3f9b1" },
    { "id": "borrower:acme", "type": "borrower", "display_name": "Acme Holdings" }
  ],
  "edges": [
    { "id": "edge:1", "type": "owns", "from": "borrower:acme", "to": "property:parkview", "provenance": [{ "source": "org-chart.pdf", "locator": "p.2" }] }
  ]
}
```

The protocol's new Portfolio Relationships section will contain these normative rules:

- A profile object MUST contain `portfolio_version`, `entities`, and `edges`. `portfolio_version` is independently versioned from the UW format and protocol.
- Each entity and edge `id` MUST be non-empty and unique within the profile. IDs are opaque, case-sensitive strings; consumers MUST NOT derive identity from an ID's spelling.
- The initial entity types are `property`, `deal`, `borrower`, `loan`, and `document`. Each entity MUST have `id` and `type`; `display_name` is optional. A `property` or `deal` entity MAY carry `deal_id`, which MUST exactly equal the canonical UW frontmatter `deal_id` when the referenced deal is available.
- Every edge MUST have `id`, `type`, `from`, `to`, and a non-empty `provenance` array. `from` and `to` MUST resolve to entity IDs in the same profile. Each provenance entry MUST contain a stable `source` identifier and MAY contain a `locator`, `retrieved_at`, or `note`.
- The initial standard edge types are `owns`, `borrows_against`, `secures`, `guarantees`, `supports`, and `related_to`. Producers MAY emit extension edge types. Consumers MUST preserve unknown entity fields and unknown edge types; they MAY report that they cannot interpret them.
- A profile update MUST append provenance evidence or replace the affected sidecar as a new version. It MUST NOT silently remove provenance from an existing edge. This is an append-only evidence rule, not a requirement for a database or a revision-control system.

Hosts MAY store, query, index, or enrich profiles however they choose. The profile MUST NOT define SQL tables, graph traversal semantics, aggregate financial calculations, or ownership of host `_meta` fields.

## Compatibility analysis

Existing v1 files and Tier 1-4 implementations remain conforming: the profile is optional, additive, and out-of-band. Implementations that do not advertise the capability may ignore a sidecar. Implementations that edit a recognized sidecar must preserve unknown entity fields and unknown edge types; when they make a targeted edit, bytes outside that edit region must remain unchanged.

## Conformance impact

Existing v1 fixtures require no change. Add an optional v2 capability corpus:

- `conformance/portfolio-relationships/01-valid-multi-deal/` — a borrower, loan, two properties, and source-document evidence.
- `conformance/portfolio-relationships/02-missing-provenance/` — rejection for an edge with an empty provenance array.
- `conformance/portfolio-relationships/03-duplicate-id/` — rejection for a duplicate entity or edge ID.
- `conformance/portfolio-relationships/04-dangling-edge/` — rejection for an edge endpoint that does not resolve locally.
- `conformance/portfolio-relationships/05-unknown-preservation/` — a targeted edit proves an extension edge and fields survive byte-for-byte.

## Reference implementation

Follow-up implementation adds no behavior until this RFC is accepted. Its planned surface is browser-safe and read-only:

- `spec/schemas/uw-portfolio-profile.schema.json` — the sidecar schema.
- `packages/uwmd-core/src/portfolio.ts` — `PortfolioProfile`, `PortfolioEntity`, `PortfolioEdge`, `PortfolioProvenance`, `validatePortfolioProfile()`, and `getPortfolioRelationships()`.
- `packages/uwmd-core/src/index.ts` and `src/browser.ts` — exports for those types and helpers.
- `packages/uwmd-core/src/portfolio.test.ts` — identity, endpoint, provenance, unknown-field preservation, and deterministic canonical-digest tests.

No calc packs, formulas, validators for individual deal files, or Tier-4 agent permissions change. A host may use the helpers for portfolio display or review, but no reference implementation will calculate an aggregate financial result.

## Alternatives considered

1. **Embed a database schema in the format.** This would over-specify storage, force relational assumptions on graph and file-backed hosts, and make normal schema migrations a format concern.
2. **Use a free-form metadata bag.** It is easy to add but supplies neither interoperable types nor provenance guarantees.
3. **Link only by URLs.** URLs cannot model borrower/loan relationships reliably in offline bundles and are not stable entity identifiers.
4. **Put relationship data in each deal's `_meta`.** This couples a portfolio graph to a single document, creates duplicated edges, and violates the host ownership boundary for `_meta`.

## Unresolved questions

The final edge-type registry, cross-profile identity collision policy, document locator vocabulary, signature/permission model, and a transport representation for a portfolio bundle are intentionally deferred to acceptance and follow-up RFCs. This RFC also does not decide whether a future portfolio rollup may expose only deterministic aggregate metrics or must remain purely descriptive.

## Prior art

[JSON-LD](https://www.w3.org/TR/json-ld11/) typed nodes and edges, [W3C PROV](https://www.w3.org/TR/prov-dm/) provenance, and OpenAPI extension preservation inform the design.
