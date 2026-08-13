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
