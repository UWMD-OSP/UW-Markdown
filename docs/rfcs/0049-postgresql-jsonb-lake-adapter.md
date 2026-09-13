---
rfc: 0049
title: PostgreSQL JSONB lake adapter boundary
status: draft
author: jaredmaxey
created: 2026-09-13
depends_on:
  - 0014
  - 0018
affects:
  - tooling
  - documentation
---

# RFC 0049: PostgreSQL JSONB lake adapter boundary

## Status and intent

This is a host-side integration RFC. It scopes an optional reference adapter
for PostgreSQL-style warehouses without making SQL, JSONB, or a warehouse
schema part of the UWMD protocol.

## Proposed boundary

The adapter would load existing canonical outputs rather than reinterpret UWMD
documents:

- `uw_documents`: document identity, semantic digest, format/protocol versions,
  validation verdict, and the complete canonical envelope in `jsonb`;
- `uw_facts`: one row per `block_values` fact with deal digest, block reference,
  scope, JSON Pointer, JSON type, canonical `value_json`, and typed shadow
  columns for common numeric, text, boolean, and date queries;
- `uw_receipts`: receipt JSON plus indexed verdict, pack, engine, and subject
  digest fields;
- `uw_packages` / `uw_package_members`: package manifests, member digests,
  document profiles, and typed links;
- optional source-evidence references containing identity and status, never
  unapproved source bytes.

The semantic digest is the idempotency key. Unknown sections, extension keys,
nulls versus absence, array order, provenance, and receipt evidence must remain
recoverable from the raw JSONB or fact rows.

## Non-goals

The adapter does not define a normative storage contract, warehouse-specific
SQL, portfolio aggregate math, ingestion truth, PII policy, or a replacement
for CSV/JSON/JSONL interchange. It does not add a PostgreSQL dependency to
`@uwmd/core` and does not make database availability part of validation.

## Definition of done

- A reference loader ingests UW CSV bundles or batch JSONL facts idempotently.
- Common catalog and fact queries have typed indexes without losing raw JSON.
- Unknown sections and future fields survive a load unchanged.
- Receipts and package members join by semantic/byte digest as appropriate.
- Documentation makes clear which outputs are canonical facts and which are
  warehouse projections.
