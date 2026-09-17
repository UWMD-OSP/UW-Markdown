# `@uwmd/lake`

Reference PostgreSQL/JSONB lake adapter for UW Markdown — the implementation of
[RFC 0049](../../docs/rfcs/0049-postgresql-jsonb-lake-adapter.md).

This package is **not part of the UW Markdown protocol**. It is a host-side
integration: it reads canonical outputs the standard already produces and plans
idempotent SQL an adopter runs with their own database client. Nothing here
adds a PostgreSQL dependency to `@uwmd/core`, and database availability is never
part of validation.

> Unpublished. Install from source in this repository.

## What it does and does not do

| Canonical — the record | Warehouse projection — an index |
|---|---|
| `uw_documents.envelope` jsonb | `deal_id`, `asset_class`, `currency_code`, … |
| `uw_facts.value_json` jsonb | `value_number` / `value_text` / `value_boolean` / `value_date` |
| `uw_receipts.receipt` jsonb | `pack_id`, `engine`, `subject_digest`, validation counts |
| `uw_packages.manifest` jsonb | `member_count`, `link_count` |

If a warehouse query disagrees with the calc engine, the query is against the
projection. The JSONB column is the answer of record. The adapter deliberately
does **not** classify rows, aggregate a portfolio, decide ingestion truth, set a
PII policy, or replace the CSV/JSON/JSONL interchange.

## Identity and idempotency

Rows are keyed by digest, never by file path:

- a document by its **semantic digest**;
- a fact by `(semantic_digest, block_ref, scope, pointer)`;
- a package member by its **byte digest** (`sha256`);
- a receipt by the canonical hash of the receipt JSON.

A package is the one exception: `uw_packages` is keyed by the `package_id` its
manifest declares, because that is what the links between members resolve
against. Two different packages claiming the same `package_id` therefore
collapse onto one row, last writer winning. Likewise, two files whose content
is semantically identical share a semantic digest and so share one
`uw_documents` row — `path` records whichever loaded last, which is why it is a
convenience column and not an identity.

Every statement is an `INSERT … ON CONFLICT … DO UPDATE`, so loading the same
bundle twice leaves the same rows. A document that *changed* has a different
semantic digest and becomes a new row — the lake accumulates versions rather
than overwriting history.

## Usage

```ts
import { readFile } from 'node:fs/promises';
import { parseUWFile, toUWEnvelope } from '@uwmd/core';
import {
  postgresLakeSchemaStatements,
  lakeInputFromEnvelope,
  planLakeLoad,
  executeLakeLoad,
} from '@uwmd/lake';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = { query: (sql, params) => pool.query(sql, [...params]) };

// 1. Create the schema, one command at a time. The DDL is idempotent;
//    re-running it is a no-op.
for (const statement of postgresLakeSchemaStatements('uwmd_lake')) {
  await client.query(statement, []);
}

// 2. Project a document into a document row plus its complete fact table.
const envelope = toUWEnvelope(parseUWFile(await readFile('deal.uwx.md', 'utf8')));
const { document, facts } = await lakeInputFromEnvelope(envelope, {
  path: 'deal.uwx.md',
  deal_id: 'PARKVIEW-1',
  valid: true,
});

// 3. Plan and run. The adapter does not open the transaction — atomicity is
//    your call, and wrapping it silently would hide a partial load.
const plan = await planLakeLoad({ documents: [document], facts, schema: 'uwmd_lake' });
await client.query('BEGIN', []);
await executeLakeLoad(plan, client);
await client.query('COMMIT', []);
```

### Loading what you already have

```ts
import { readBatchFactJSONL, readBlockValuesCSV } from '@uwmd/lake';

// `@uwmd/batch` output — each line carries its own semantic digest.
const facts = readBatchFactJSONL(await readFile('uwmd-facts.jsonl', 'utf8'));

// A UW CSV bundle's block_values.csv — stamp the identity the CSV omits.
const fromCsv = readBlockValuesCSV(await readFile('block_values.csv', 'utf8'), {
  semantic_digest: document.semantic_digest,
  deal_id: 'PARKVIEW-1',
});
```

Receipts, package manifests and source-evidence references load through the
same `planLakeLoad` call:

```ts
await planLakeLoad({ receipts, packages, source_evidence, schema: 'uwmd_lake' });
```

## Refusals

The adapter refuses rather than guesses. Every refusal is a `LakeError` with a
code:

| Code | Refused because |
|---|---|
| `LAKE_SCHEMA_NAME` | The schema name is not a plain lowercase identifier. It is validated, never quoted. |
| `LAKE_DOCUMENT_DIGEST` / `LAKE_FACT_DIGEST` | A row that cannot be keyed is worse than no row. |
| `LAKE_DOCUMENT_ENVELOPE` | A typed projection with no canonical JSON behind it is not loadable. |
| `LAKE_RECEIPT_SUBJECT` | A receipt with no `subject.digest` joins to nothing. |
| `LAKE_PACKAGE_MEMBER_DIGEST` | A member's byte digest is its identity. |
| `LAKE_FACT_VALUE` | A *scalar* fact declared a JSON type but carried no `value_json`. Only an object or an array may omit its value. |
| `LAKE_SOURCE_BYTES` | Source evidence carried a bytes-bearing field. The lake stores identity and status only. |
| `LAKE_CSV_*` / `LAKE_JSONL_*` | A malformed input line, refused rather than half-loaded. |

Two more deliberate non-behaviors: a numeric-looking *string* never lands in
`value_number` (a warehouse that guesses types answers filters differently from
the calc engine), and an unknown extra CSV column is ignored rather than
rejected, so a future bundle revision still loads.

### Containers have no value of their own

UWMD's canonical fact table represents an object or an array by its flattened
children, so the container's own row carries an empty `value_json` — about 21%
of the rows in a real corpus. `uw_facts.value_json` is therefore nullable, with
a CHECK that only an object or an array may omit it: a container becomes SQL
NULL, and `json_type` plus the child rows are the record. A scalar with no
value is a malformed fact and is refused.

## Querying

```sql
-- Typed filter on the projection, raw JSON for the answer of record.
SELECT d.deal_id, f.value_number AS noi, d.envelope
FROM uwmd_lake.uw_facts f
JOIN uwmd_lake.uw_documents d USING (semantic_digest)
WHERE f.pointer = '/noi' AND f.value_number > 1000000 AND d.valid;

-- Every clean receipt over a document, by digest.
SELECT r.pack_id, r.engine_version, r.issued_at
FROM uwmd_lake.uw_receipts r
WHERE r.subject_digest = $1 AND r.validation_errors = 0;
```

There is no `verdict` column. A verdict is what *verifying* a receipt produces
(`UW_RECEIPT_v1` §5) — `verified`, `failed`, `unverifiable` — not something a
receipt states about itself, so projecting one would index a column that is
NULL for every real receipt. What a receipt does carry is its
`policy.validation` counts, and those are the columns above.

## License

MIT
