# `@uwmd/lake` against a live PostgreSQL server

**Date:** 2026-09-16 · **Package:** `@uwmd/lake` 0.1.2 → **0.2.0** ·
**Schema:** 0.1 → **0.2** · **RFC:** [0049](../rfcs/0049-postgresql-jsonb-lake-adapter.md)

RFC 0049 shipped in 2.11.0 with 52 unit tests against an in-memory warehouse
double and a recorded gap: *no live PostgreSQL instance has been exercised.*
This is that run. It found three defects, all of which the double could not
have caught, because the double stored whatever it was handed.

## What was run

PostgreSQL **18.3**, executing the adapter's own planned statements — the
`{ sql, params }` pairs `planLakeLoad` returns, sent through a `LakeClient`
whose `query(sql, params)` reaches the server over the extended query protocol,
which is what `pg` and `postgres.js` both do.

Input was the repository's conformance corpus, not a fixture: **382 documents**
(every `.uwx.md` and `.uw.md` under `conformance/`), the **24,380 facts**
`flattenEnvelopeBlockValues` projects from them, **10 receipts** and **9 package
manifests** — 24,809 statements in one transaction.

The engine was PGlite, which is PostgreSQL compiled to WebAssembly: the real
parser, planner, executor, type input functions and constraint machinery, in
process. It is the server's own code answering, which is what the three
findings turn on. What it does not exercise is the network, concurrency,
roles and permissions, or `EXPLAIN` behavior at warehouse scale — see
[what this run does not prove](#what-this-run-does-not-prove).

## What it found

### 1. The adapter could not load 21% of its own canonical output

`uw_facts.value_json` was `jsonb NOT NULL`, and the planner passed the input
string through verbatim. But UWMD's canonical fact table — `block_values.csv`,
`@uwmd/batch`'s `uwmd-facts.jsonl` and `flattenEnvelopeBlockValues` alike —
represents an object or an array **by its flattened children**, leaving the
container's own `value_json` an empty string. An empty string is not JSON:

```
[22P02] invalid input syntax for type json
detail: The input string ended unexpectedly.
where:  unnamed portal parameter $6 = ''
```

That is **5,270 of the corpus's 24,380 facts, 21.6%** — 4,207 objects and 1,063
arrays. The first container row aborted the load, so in practice *no* corpus
document loaded completely. All three of the adapter's documented ingest paths
produce these rows; there was no way to use it as written.

The double never noticed because it pushed rows onto an array. Nothing parsed
the JSON, so nothing had an opinion about whether `''` was any.

**Fixed:** `value_json` is now nullable under
`CHECK (value_json IS NOT NULL OR json_type IN ('object', 'array'))`. A
container becomes SQL NULL — the honest reading, since `json_type` and the
child rows are the record. Storing `'{}'` was rejected as the alternative: an
object with children would then read as empty to a `@>` containment query. A
*scalar* with an empty value is malformed rather than a container, and is now
refused with `LAKE_FACT_VALUE` instead of silently nulled.

### 2. The documented way to create the schema cannot work

Both the README and `docs/DATA_LAKE.md` showed:

```ts
await client.query(postgresLakeSchema('uwmd_lake'), []);
```

`postgresLakeSchema()` returns a 17-command script. Passing a values array —
even the empty one — puts `pg`, `postgres.js` and PGlite on the extended query
protocol, which carries exactly one command per message:

```
cannot insert multiple commands into a prepared statement
```

Since `LakeClient` is *defined* as `query(sql, params)`, an adopter implementing
the documented interface had no way to run the DDL through it at all.

**Fixed:** `postgresLakeSchemaStatements(schema)` returns the DDL as an ordered
array of single commands and is now the source of truth;
`postgresLakeSchema()` joins it, and its doc comment says it is for `psql` and
migration runners, not for `query(sql, [])`. The splitter refuses to end a
statement on a `--` comment line, because this file's prose does contain
semicolons.

### 3. `uw_receipts.verdict` projected a field no receipt carries

Every one of the corpus's receipts loaded with `verdict` NULL. The reason is
not a mapping bug: **a verdict is what *verifying* a receipt produces**
(`UW_RECEIPT_v1` §5 — `verified`, `failed`, `unverifiable`), not a field a
receipt states about itself. `planReceipt` looked in three places for it and no
receipt has it in any of them.

So the column was NULL for every real input, and `uw_receipts_verdict_idx` was
an index on `(verdict, pack_id)` whose leading column was dead — the README
advertised both.

The unit test missed it because its fixture *invented* the field:
`computation: { …, verdict: 'pass', … }`. The fixture was written against the
code rather than against `UW_RECEIPT_v1`, so the two agreed with each other and
disagreed with reality. This is the same failure shape `verify-codes` was added
for in 2.12.0: a promise checked against nothing.

**Fixed:** the column and its index are gone. `validation_errors` and
`validation_warnings` take their place, projected from `policy.validation`,
which is what a receipt does state, and the index is now `(pack_id,
pack_version)`. The test fixture is a real receipt shape and carries a comment
saying why.

## What it confirmed

| Claim | Result |
|---|---|
| The whole corpus loads | 24,809 / 24,809 statements, ~1,340/s |
| Idempotency by digest | Identical row counts across two full loads |
| DDL re-runnability | 17 `IF NOT EXISTS` statements, applied twice, no-op |
| Canonical JSON survives | `envelope`, `receipt`, `manifest`, `member` round-trip |
| The package FK holds | A member without its package is refused |
| The `scope` CHECK holds | An unknown scope is refused |
| The partial number index is used | `Index Scan using uw_facts_number_idx` |

Post-load rows: 311 documents, 17,876 facts, 9 receipts, 1 package, 3 members —
18 MB for `uw_facts`, 2.5 MB for `uw_documents`.

## Two things an adopter should know

**Identity collapses rows, by design.** 382 documents became **311** rows and 10
receipts became **9**: fixtures that differ in bytes but not in meaning share a
semantic digest, and byte-identical receipts share a canonical hash. That is
the intended accumulate-versions behavior. Its consequence is that
`uw_documents.path` records whichever file loaded last, which is why `path` is a
convenience column and not an identity.

**Packages are the one thing not keyed by a digest.** 9 manifests became **1**
row and 28 members became **3**, because the conformance manifests reuse
`package_id` — and `package_id` is the primary key, since that is what the
links between members resolve against. Two genuinely different packages
claiming one id silently collapse, last writer winning. The README's "everything
is keyed by digest" now says this instead of implying otherwise. Whether the key
should become a manifest digest is a real design question and is **left open**;
changing it is an RFC 0049 amendment, not a bug fix.

## What this run does not prove

- **No network, no concurrency, no roles.** PGlite is in-process and
  single-connection. Connection-pool behavior, lock contention between
  concurrent loaders, and whether the DDL works under a restricted role are
  untested.
- **`EXPLAIN` at this scale is not `EXPLAIN` at warehouse scale.** The GIN
  `jsonb_path_ops` index on `envelope` was *not* chosen for the documented
  containment query: at 311 rows the planner preferred a sequential scan
  (cost 107.89, 3.4 ms actual). That is correct behavior, not a defect, but it
  means the index is unproven — an adopter should not read its presence as a
  guarantee until they have measured it on their own row counts.
- **Managed-service differences.** Extensions, `search_path` defaults and
  permission models on RDS, Cloud SQL or Supabase are not covered.

## Reproducing

The harness is not committed: it is ~230 lines driving `PGlite`, the corpus and
the adapter's public API, and it needs a dependency (`@electric-sql/pglite`)
that the repository deliberately does not take. Any PostgreSQL 14+ server
reproduces it — apply `postgresLakeSchemaStatements('uwmd_lake')`, project the
corpus through `lakeInputFromEnvelope`, and run `planLakeLoad` /
`executeLakeLoad` in one transaction.

## Publication decision

Still **open**, and now better informed. The three defects are fixed and the
adapter demonstrably loads a real corpus into a real server, which removes the
strongest argument against publishing. The remaining arguments are unchanged:
no adopter has run it against a managed PostgreSQL service, and the package
identity question above is unresolved. A first publish should be `0.2.0`
against a named adopter, not ahead of one.
