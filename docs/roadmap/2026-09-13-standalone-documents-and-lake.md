# Adoption notes: standalone documents and data-lake storage

Recorded 2026-09-13 after the 2.9.0 development sprint.

## Current position

Data-center support is a credible reference module, not yet an adopter-validated
asset-class product. The module has six dedicated runtime conformance scenarios,
26 package tests, 11 calculations, seven validations, and explicit degraded /
fallback behavior. Its Mesa Gateway fixture remains synthetic and the package is
unpublished. No additional niche asset class should be added until a concrete
deal or operator workflow supplies the economics.

The core currently covers nine built-in calculation packs. Mixed-use is handled
as composition, while data center is a module-declared class. Hospitality is both
a builtin class and a reference module consumer.

## Standalone-document opportunity

The protocol already supports `lease-abstract-v1`, `source-note-v1`,
`.uwpart.md` section fragments, all-in-one `.uwx.md` records, and `.uwpkg.zip`
packages. The missing adoption layer is a coherent example kit showing when to
use each form. RFC 0048 scopes that kit without adding new profiles prematurely.

The initial example set should cover:

- one lease abstract with source locators and an explicit omission/conflict;
- one source note;
- rent-roll collection fragments;
- T-12 operating-statement and dated cash-flow fragments;
- inline versus externalized document twins;
- a package containing records, fragments, source references, and links.

## Data-lake opportunity

The existing CSV bundle, `block_values` fact table, batch JSONL output, semantic
digests, receipts, and package manifests are already the portable lake boundary.
PostgreSQL JSONB is worth exploring as an optional reference adapter: raw
canonical envelopes and unknown extensions belong in JSONB, while common joins
and filters should use relational typed shadow columns and indexes. RFC 0049
keeps that work outside the protocol and outside `@uwmd/core` dependencies.

The recommended order is standalone examples first, then a loader/schema proof
against those examples. This keeps the storage design grounded in real package
and fragment shapes rather than inventing a warehouse abstraction in advance.
