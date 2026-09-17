---
rfc: 0049
title: PostgreSQL JSONB lake adapter boundary
status: implemented
author: jaredmaxey
created: 2026-09-13
accepted: 2026-09-15
implemented: 2026-09-15
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

Implemented as the unpublished `@uwmd/lake` package. See
[Implementation](#implementation) for what shipped and what the adapter
deliberately still refuses to do.

## Boundary

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

## Implementation

`@uwmd/lake` 0.1.0 (`packages/uwmd-lake`, unpublished) implements the boundary
above. It takes `@uwmd/core` as its only dependency and **no database driver**:
it plans `{ sql, params }` statements that an adopter executes with the client
they already have. That is what keeps PostgreSQL out of core's dependency graph
and database availability out of validation.

### Surface

| Export | Role |
|---|---|
| `postgresLakeSchema(schema?)` | The complete idempotent DDL for the six tables. The schema name is validated as a plain lowercase identifier, never quoted. |
| `lakeInputFromEnvelope(envelope, extras?)` | Projects one canonical envelope into its document row plus its complete `block_values` fact table, recomputing the semantic digest rather than trusting caller metadata. |
| `readBlockValuesCSV(csv, identity)` | Reads a UW CSV bundle's `block_values.csv`, stamping the identity the CSV omits. |
| `readBatchFactJSONL(jsonl)` | Reads `@uwmd/batch`'s `uwmd-facts.jsonl`, where each line already carries its digest. |
| `planLakeLoad(input)` | The deterministic, dependency-ordered load plan across documents, facts, receipts, packages, members and source evidence. |
| `executeLakeLoad(plan, client)` | Runs the plan in order against a structural `{ query(sql, params) }` client. |
| `projectShadowColumns(fact)` | The typed projection rule, exported so an adopter's own loader can match it exactly. |
| `LakeError` | The typed refusal, consistent with `ProtocolError` / `CalcError` / `ExcelEmitError`. |

### Definition of done, met

- **Idempotent ingestion of existing outputs.** Every statement is an
  `INSERT … ON CONFLICT … DO UPDATE` keyed by digest — document by semantic
  digest, fact by `(semantic_digest, block_ref, scope, pointer)`, package member
  by byte digest, receipt by the canonical hash of the receipt JSON. Loading a
  real example document twice leaves the same row counts; a *changed* document
  gets a new digest and therefore a new row, so the lake accumulates versions
  instead of overwriting history.
- **Typed indexes without losing raw JSON.** `value_number` / `value_text` /
  `value_boolean` / `value_date` are populated strictly from the declared
  `json_type`. A numeric-looking string is never sniffed into `value_number`,
  because a warehouse that guesses types answers a filter differently from the
  calc engine. `value_json` is stored verbatim beside it.
- **Unknown sections and future fields survive.** The canonical envelope,
  receipt and manifest are each stored whole in `jsonb`. A test asserts an
  unknown section, an extension key, an explicit null and array order all
  round-trip unchanged, and an unrecognized `block_values.csv` column loads
  rather than failing.
- **Digest joins.** `uw_receipts.subject_digest` and
  `uw_package_members.semantic_digest` join documents by semantic digest;
  `uw_package_members.sha256` carries the byte digest.
- **Canonical versus projection is documented.** The package README leads with
  the table, and the source comments say the same thing at each call site.

### Enforced non-goals

`uw_source_evidence` stores identity and status only: a payload carrying
`bytes`, `content`, `content_base64`, `data_base64`, `body` or `blob` — at any
nesting depth — is refused with `LAKE_SOURCE_BYTES`. The adapter does not open
a transaction (atomicity is the adopter's call; wrapping it silently would hide
a partial load), classify rows, compute portfolio aggregates, decide ingestion
truth, set a PII policy, or replace CSV/JSON/JSONL interchange.

### Verification

64 unit tests across the four source files, including an end-to-end load of
`examples/Parkview-Apts-Glendale-AZ.uwx.md` into an in-memory warehouse double
that honours only primary keys and `ON CONFLICT`.

Since **2026-09-16**, also a live load: the whole conformance corpus — 382
documents, 24,380 facts, 10 receipts, 9 manifests, 24,809 statements — into
PostgreSQL 18, twice, for identical row counts. See the
[load record](../reviews/2026-09-16-lake-live-postgres.md).

### Erratum, 2026-09-16 (lake schema 0.2)

The live load corrected three things this RFC got wrong. None of them changes
the boundary above; all three are in the projection, which the RFC always held
to be non-normative.

1. **The `uw_facts.value_json` column was `NOT NULL`.** UWMD's canonical fact
   table represents an object or an array by its flattened children, so a
   container row's `value_json` is empty — 21.6% of the corpus — and an empty
   string is not `jsonb`. The column is now nullable under a CHECK that only a
   container may omit it. "Canonical `value_json`" in **Boundary** above should
   be read as *`value_json` where the canonical row has one*.
2. **The `uw_receipts` verdict column projected a field that does not exist.**
   **Boundary** says "receipt JSON plus indexed verdict"; no receipt carries a
   verdict, because a verdict is what verifying one produces
   (`UW_RECEIPT_v1` §5). The column and its index are replaced by
   `validation_errors` / `validation_warnings` from `policy.validation`. Read
   the `uw_documents` bullet's "validation verdict" the same way: it is the
   caller-supplied `valid` / `error_count` / `warning_count` projection, not a
   verdict the document states.
3. **The DDL could not be sent through `LakeClient`.** It is one multi-command
   script, and the interface is `query(sql, params)`, which is the extended
   query protocol. `postgresLakeSchemaStatements()` now returns the commands
   individually and is the source of truth.

One question the load opened and did not close: `uw_packages` is keyed by the
manifest's declared `package_id` rather than by a digest, so two packages
claiming one id collapse. That is documented, not changed — changing it amends
this RFC.
