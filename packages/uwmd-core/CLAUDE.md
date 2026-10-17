# CLAUDE.md — `@uwmd/core`

The starter toolkit, built on [`@uwmd/verify`](../uwmd-verify/CLAUDE.md) (the
reference implementation of the standard, RFC 0083). Core depends on verify at
an exact version and re-exports its current surface. Follow the owner rule at
the top of the root AGENTS.md/CLAUDE.md; there is no prelaunch API-retention gate. Deep reference:
[`docs/wiki/03-core-library.md`](../../docs/wiki/03-core-library.md). See also
the root [`CLAUDE.md`](../../CLAUDE.md).

## Layout (`src/`)

- `index.ts` — **the public API surface**: `export * from '@uwmd/verify'` plus
  the starter exports. Export new starter symbols here (and in `browser.ts` if
  browser-safe); new standard symbols go in verify's `index.ts`.
  `surface.test.ts` checks current verifier re-exports and intentional wrapper
  bindings. The owner rule retires the frozen4.0.x export-superset gate.
- Three names shadow verify's on purpose: `evaluateCalc` and
  `evaluateModuleCalculations` (`calc-display.ts`, which adds `display`), and
  `issueReceipt` (`receipt-engine.ts`, which defaults the `issuer` to
  `@uwmd/core@<CORE_VERSION>`; the engine stays `@uwmd/verify`, the code that
  computes). Core code that issues receipts imports the wrapper.
- `editor.ts` / `renderer.ts` / `report.ts` / `compactor.ts` / `init.ts` —
  Tier 2 editing and rendering.
- `runner.ts` — supersede-aware block writer (`writeAgentBlock`; re-exports
  `buildMeta`, which is verify's).
- `starter-protocol.ts` — the starter protocol tables (number formats, badges,
  `BUILTIN_VIEW_MODELS`, `CASCADE_ORDER`, agent host, capability tokens); the
  barrels export them under the same names as before.
- `reference-implementation.ts` — `REFERENCE_IMPLEMENTATION_MANIFEST`, what
  `uwmd manifest` prints. `version.ts` — `CORE_VERSION`, in lockstep with
  package.json.
- `packs/` — re-exports verify's builtin pack manifests beside the Excel
  emitter (`excel-emit.ts`); the per-class Excel parity tests live here
  (`docs/wiki/05`).
- `agents/` + `context.ts` — Bancroft agent host (`docs/wiki/06`). Layers default
  to `claude-sonnet-4-6`, temp 0.1.
- `cascade.ts` / `defaults.ts` / `gaps.ts` / `refinement.ts` — data resolution +
  VOI gap ranking. `bindings-edit.ts` wires the editor into verify's bindings.
- `cli.ts` — the `uwmd` CLI (wrapped by `@uwmd/cli`).

## The boundary (RFC 0083)

Core imports standard code only through `@uwmd/verify`'s public entry, never a
deep path into another package (invariant 2). If core needs a standard symbol
verify does not export, export it from verify's `index.ts` (core re-exports it
too). A test that exercises a standard module through a starter module stays
here, named for the starter module (`editor.block-roles.test.ts`,
`renderer.locale.test.ts`); a test of standard behavior alone belongs in verify.

## Local invariants

- **AI never computes financials** — that's verify's `calc/` + `builtin-packs/`, deterministically.
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
npm run build          # tsc (build @uwmd/verify first; core compiles against its dist)
npm test               # vitest run
npm run test:coverage  # vitest run --coverage
```

After changes, also run the repo-level conformance from the root:
`npm run build && npm run conformance` (it imports both packages' `dist/`).
Add/extend the sibling `*.test.ts` for any module you change.
