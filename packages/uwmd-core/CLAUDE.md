# CLAUDE.md — `@uwmd/core`

The reference library and the heart of the repo. Deep reference:
[`docs/wiki/03-core-library.md`](../../docs/wiki/03-core-library.md). See also the
root [`CLAUDE.md`](../../CLAUDE.md).

## Layout (`src/`)

- `index.ts` — **the public API surface.** Export new public symbols here (and in
  `browser.ts` if browser-safe). If it isn't exported here, tools can't use it.
- `parser.ts` / `validator.ts` / `editor.ts` / `renderer.ts` — Tiers 1–2 core.
- `runner.ts` — supersede-aware block writer (`writeAgentBlock`; re-exports
  `buildMeta`, which lives in `metadata.ts`).
- `protocol.ts` — executable mirror of `UW_PROTOCOL.md`: types, error codes,
  version constants, `BUILTIN_*` tables (edit policies, remediations,
  incomplete-data policies), module-manifest types. Mirrors `spec/schemas/*` —
  keep in lockstep. Starter tables (number formats, badges,
  `BUILTIN_VIEW_MODELS`, `CASCADE_ORDER`, agent host, capability tokens) live in
  `starter-protocol.ts`; the barrels export both under the same names.
- `types.ts` — format types (`UWBlock`, `UWMeta`, `UWFrontmatter`, `ParsedUWFile`,
  `DEFAULT_THRESHOLDS`, enums).
- `calc/` — safe-expression engine (standard: implements §VIII; the Verifier's
  evaluator) (`docs/wiki/04`). Sandboxed: no globals, no I/O, caps
  `MAX_INPUT_LEN=4096` / `MAX_NODES=1024`. `builtins.ts` holds the math +
  financial functions. `calc/index.ts` `evaluateCalc` returns no `display`; the
  exported `evaluateCalc` is `calc-display.ts`, which adds it.
- `builtin-packs/` — the twelve builtin pack manifests + `getPackForAssetClass`
  (standard data; each equals its `spec/metrics/` entries). `packs/` re-exports
  them beside the Excel emitter (`docs/wiki/05`).
- `metric-verification.ts` — `verifyStatedMetrics`, stated metrics checked
  against `metric-dictionary.ts` (generated from `spec/metrics/builtin.json` by
  `npm run gen-metric-dictionary`; a test fails on drift).
- `agents/` + `context.ts` — Bancroft agent host (starter product) (`docs/wiki/06`). Layers default
  to `claude-sonnet-4-6`, temp 0.1.
- `cascade.ts` / `defaults.ts` / `gaps.ts` / `refinement.ts` — data resolution +
  VOI gap ranking (starter). `integrity.ts` (+`-canonical`) — hash chain / provenance.

## The standard/starter boundary (RFC 0083)

`src/standard-closure.test.ts` lists the standard module set (the future
`@uwmd/verify`) and fails if any of them imports a module outside it or the
vendor SDK. Standard code never imports `editor`, `runner`, `cascade`,
`defaults`, `format`, `gaps`, `packs/`, `starter-protocol`, `calc-display` or
`bindings-edit`; when it needs a starter service, take it by injection (see
`bindings.ts`'s `UWSourceEditAdapter`). Add a new standard module to the list.

## Local invariants

- **AI never computes financials** — that's `calc/` + `builtin-packs/`, deterministically.
- **Browser boundary:** `@anthropic-ai/sdk` may be reached only by code reachable
  from `index.ts`, never from anything `browser.ts` re-exports. It is an optional
  peer dependency: `agents/providers/anthropic.ts` must load it by *dynamic*
  import only — a static import there would make `import '@uwmd/core'` pull the
  vendor SDK in for every consumer, since `index.ts` re-exports the factory.
- **Editor byte preservation**, **append-only supersede**, **the host owns
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
