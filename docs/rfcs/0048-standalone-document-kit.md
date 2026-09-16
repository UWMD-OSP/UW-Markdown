---
rfc: 0048
title: Standalone UW document kit and package examples
status: implemented
accepted: 2026-09-15
author: jaredmaxey
created: 2026-09-13
depends_on:
  - 0018
  - 0021
affects:
  - conformance-corpus
  - tooling
  - documentation
---

# RFC 0048: Standalone UW document kit and package examples

## Status and intent

This is a scoped adoption RFC, not a proposal for a new financial model or
format primitive. The current protocol already permits standalone profiles,
`.uwpart.md` fragments, all-in-one `.uwx.md` records, and `.uwpkg.zip` deal
packages. The gap is a coherent, user-facing set of examples proving how those
pieces fit together.

## Proposed kit

Add a public worked-example kit with:

1. A `lease-abstract-v1` document with source locators, null/status handling,
   amendments, and a deliberately lossy rent-roll projection.
2. A `source-note-v1` document that carries attributable transcription or
   diligence context without pretending to be underwriting math.
3. A collection of `rent_roll` `.uwpart.md` fragments, one row per lease, with
   stable collection keys and provenance.
4. Standalone `operating_statement` and `cash_flow_series` fragments showing
   T-12 and dated-ledger variants without inventing a deal identity.
5. An inline `.uwx.md` deal and an externalized equivalent whose resolved
   semantic digests match.
6. A `.uwpkg.zip` example containing the underwriting record, standalone UW
   documents, fragments, a manifest, links, and source-evidence references.

The kit should live under `examples/standalone/` and be accompanied by named
conformance fixtures where behavior is normative: profile validation,
fragment standalone parsing, package integrity, and inline/external digest
invariance.

### Concrete example matrix and conformance mapping

| Adoption surface | Worked example | Named conformance assertion |
|---|---|---|
| `lease-abstract-v1` profile plus API shape | `lease-abstract-v1.uwx.md`, `lease-abstract.json` | `standalone/profiles/lease-abstract-v1`, `standalone/lease-abstract/api-shape` |
| `source-note-v1` and standalone UWX records | `source-note-v1.uwx.md`, `inline-deal.uwx.md`, `externalized-deal.uwx.md` | `standalone/profiles/source-note-v1`, `standalone/profiles/inline-deal`, `standalone/profiles/externalized-deal` |
| Independently addressable fragments | `parts/*.uwpart.md` | `standalone/fragments/standalone-parse` |
| Inline versus externalized composition | `inline-deal.uwx.md` and `externalized-deal.uwx.md` | `standalone/composition/inline-external-canonical`, `standalone/composition/inline-external-digest` |
| Package bytes and context projection | `package/manifest.json`, `package/standalone-demo.uwpkg.zip` | `standalone/package/manifest`, `standalone/package/integrity`, `standalone/package/context-boundary` |

The suite is implemented as a named `standalone` run in
`scripts/run-conformance.mjs`; it builds the package in memory from the checked
in manifest and payloads, so conformance does not depend on a generated ZIP
being present in a fresh checkout. The checked-in ZIP remains the user-facing
regenerable artifact.

## Non-goals

This RFC does not add `cash-flow-series-v1`, `rent-roll-v1`, or
`operating-statement-v1` as new document profiles. Those remain sections or
fragments until an adopter demonstrates a stable standalone lifecycle that
needs its own identity and validation contract. It also does not add lease
forecasting, P&L calculations, database storage, OCR, or AI extraction quality
requirements.

## Definition of done

- A new adopter can choose all-in-one, externalized, or packaged form from
  examples rather than reverse-engineering the RFCs.
- Every example parses and validates with explicit provenance and null meaning.
- Package verification and context projection preserve the documented fidelity
  boundary.
- Externalized and inline examples prove semantic-digest equivalence.
- No example silently upgrades descriptive facts into calculated underwriting
  claims.
