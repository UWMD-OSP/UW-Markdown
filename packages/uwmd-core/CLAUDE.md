# CLAUDE.md — `@uwmd/core`

The reference library and the heart of the repo. Deep reference:
[`docs/wiki/03-core-library.md`](../../docs/wiki/03-core-library.md). See also the
root [`CLAUDE.md`](../../CLAUDE.md).

## Layout (`src/`)

- `index.ts` — **the public API surface.** Export new public symbols here (and in
  `browser.ts` if browser-safe). If it isn't exported here, tools can't use it.
- `parser.ts` / `validator.ts` / `editor.ts` / `renderer.ts` — Tiers 1–2 core.
- `runner.ts` — supersede-aware block writer (`writeAgentBlock`, `buildMeta`).
- `protocol.ts` — executable mirror of `UW_PROTOCOL_v1.md`: `BUILTIN_*` tables
  (view models, edit policies, remediations, incomplete-data policies), the
  cascade order, module-manifest types. Mirrors `spec/schemas/*` — keep in lockstep.
- `types.ts` — format types (`UWBlock`, `UWMeta`, `UWFrontmatter`, `ParsedUWFile`,
  `DEFAULT_THRESHOLDS`, enums).
- `calc/` — Tier-3 safe-expression engine (`docs/wiki/04`). Sandboxed: no globals,
  no I/O, caps `MAX_INPUT_LEN=4096` / `MAX_NODES=1024`. `builtins.ts` holds the
  math + financial functions.
- `packs/` — calc packs + Excel emit (`docs/wiki/05`). `multifamily.ts` is the
  single source of truth for the 8 multifamily metrics.
- `agents/` + `context.ts` — Tier-4 Bancroft host (`docs/wiki/06`). Layers default
  to `claude-sonnet-4-6`, temp 0.1.
- `cascade.ts` / `defaults.ts` / `gaps.ts` / `refinement.ts` — data resolution +
  VOI gap ranking. `integrity.ts` (+`-canonical`) — hash chain / provenance.

## Local invariants

- **AI never computes financials** — that's `calc/` + `packs/`, deterministically.
- **Browser boundary:** `@anthropic-ai/sdk` may be reached only by code reachable
  from `index.ts`, never from anything `browser.ts` re-exports. It is an optional
  peer dependency: `agents/providers/anthropic.ts` must load it by *dynamic*
  import only — a static import there would make `import '@uwmd/core'` pull the
  vendor SDK in for every consumer, since `index.ts` re-exports the factory.
- **Tier-2 byte preservation**, **append-only supersede**, **the host owns
  `_meta`** (strip any `_meta`/`_notes` from agent `section_data`).
- Relative imports carry the `.js` extension (NodeNext).

## Commands (run from this package)

```bash
npm run build          # tsc
npm test               # vitest run
npm run test:coverage  # vitest run --coverage
```

After changes, also run the repo-level conformance from the root:
`npm run build && npm run conformance` (it imports this package's `dist/`).
Add/extend the sibling `*.test.ts` for any module you change.
