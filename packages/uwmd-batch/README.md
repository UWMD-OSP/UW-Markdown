# @uwmd/batch

A local, deterministic collection indexer for `.uw.md` files. It validates every deal, records a semantic digest, and emits `uwmd-collection.json` plus a spreadsheet-safe CSV index.

```bash
npx @uwmd/batch deals --out batch-output
```

The index is a projection over canonical deal files, not a storage protocol. A host may import it into any database without changing `.uw.md` semantics.