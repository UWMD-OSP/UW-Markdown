# Element/package validation and deterministic stitching — design candidate

Recorded 2026-10-03 from external golden-deal audit requirements. This is a
future RFC brief, not an accepted contract or an implementation task. No raw
external deal files or proprietary source material accompanies the evidence.

## Existing foundation

[RFC 0018](../rfcs/0018-document-profiles-and-deal-packages.md) already defines
document profiles, lease abstracts, source notes, ZIP package manifests,
member digests and JSON context. [RFC 0021](../rfcs/0021-composable-documents.md)
already defines section fragments, composite records, digest-preserving
resolution and rollup receipts. [RFC 0048](../rfcs/0048-standalone-document-kit.md)
provides a standalone authoring/example kit. A new design must reconcile these
implemented surfaces rather than create a competing package model.

## User need and decisions for a future RFC

- **Standalone valid elements:** specify profiles/validation scope for rent
  rolls, T-12s, debt schedules and property files. Element validity must not
  require every section or metric of a full underwriting record. Distinguish
  malformed content, missing optional fields, workflow completeness and
  deterministically uncomputed metrics.
- **Package/ZIP/folder manifests:** inventory valid elements and explicitly
  map their identities, variants, roles, periods and relationships into a
  property, portfolio or rollup. Decide whether folder transport is just a
  representation of the existing package. Pin duplicate/conflicting inputs,
  unresolved references, order independence and refusal behavior; no implicit
  overwrites, fact invention or asset-level equity allocations.
- **Deterministic stitching and canonicalization:** define exactly which
  manifest/member/assembled structures are committed to and how paths,
  ordering and representation differences affect identity. Reuse existing
  canonicalization where applicable. Distinguish member byte hashes, semantic
  document hashes, manifest/package identity and resolved-document hashes.
- **Provenance across assembled inputs:** preserve immutable member identities,
  source references/locators and append-only block history through assembly.
  Decide how corrections supersede prior inputs and how a verifier resolves
  each dependency; source evidence remains separate from extracted facts.
- **Receipt scope:** explicitly distinguish one document, a resolved composite,
  a rollup and an assembled package. Decide how a changed, absent or unavailable
  member affects each scope and how partial metric statuses are attested. A
  package inventory check must not imply financial completeness or input truth.

## Evidence and acceptance boundary

Bring synthetic inline/externalized twins and ZIP/folder equivalents; standalone
valid-but-partial elements; a conflicting-input refusal; missing/changed members;
preserved provenance; and document-versus-package verification examples. Tests
must pin deterministic bytes/digests and current composition compatibility.
Financial aggregation remains deterministic code under explicit contracts.

Any new profile rules, manifest fields, stitching semantics, canonicalization or
receipt scope must go through normative RFC review with coordinated spec,
schema/protocol and conformance changes. The current CLI clarity task implements
none of these extensions. A separate terminology proposal may consider
“workflow completeness” for Stage Readiness while preserving public compatibility.
