# @uwmd/batch

A local, deterministic collection indexer for `.uw.md` files. It validates every deal, records a semantic digest, and emits `uwmd-collection.json` plus a spreadsheet-safe CSV index.

```bash
npx @uwmd/batch deals --out batch-output
```

The index is a projection over canonical deal files, not a storage protocol. A host may import it into any database without changing `.uw.md` semantics.

## Read-only workflow projections

`filterUWMDCollection(index, filters)` narrows an existing index by asset class,
deal stage, flag, or a named quick-metric comparison. `summarizeUWMDCollection(index)`
returns deterministic asset-class, stage, and flag summaries. `projectUnderwritingQueue(index)`
returns every matching candidate ordered by `blocking_flags`, then error count,
warning count, and path. Invalid candidates stay visible in the index, summary,
and unfiltered queue; none of these helpers changes a deal file.

## Corpus fact table (`--facts`)

```bash
npx uwmd-batch deals --out batch-output --facts
```

Adds `uwmd-facts.jsonl` — one JSON object per line, one line per JSON fact in
every parseable deal — plus `uwmd-facts-manifest.json` with the counts and the
skip list. Each row is a normative `block_values` row (UW CSV Bundle spec §3,
produced by `@uwmd/core`'s `flattenEnvelopeBlockValues`, never re-implemented
here) prefixed with the deal's identity: `path`, `deal_id`, `asset_class`,
`semantic_digest`, and `valid`. Deals that parse but fail validation are
included with `valid: false`; files that cannot produce an envelope are listed
in the manifest's `deals_skipped` — the fact table never silently drops a deal.

The JSONL loads directly into DuckDB (`read_json('batch-output/uwmd-facts.jsonl')`),
Snowflake, ClickHouse, or Pandas. The durable key for a fact is
`(semantic_digest, block_ref, scope, pointer)`. See the
[data-lake guide](../../docs/DATA_LAKE.md) for the full pipeline.
