# CLAUDE.md — `@uwmd/verify`

The reference implementation of the standard (RFC 0083): reader, validation,
the calc evaluator, the metric dictionary, receipts, integrity, modules and the
verification profiles. `@uwmd/core` (the starter toolkit) depends on it at an
exact version and re-exports all of it. Deep reference:
[`docs/wiki/03-core-library.md`](../../docs/wiki/03-core-library.md). See also
the root [`CLAUDE.md`](../../CLAUDE.md) and core's
[`CLAUDE.md`](../uwmd-core/CLAUDE.md).

## The boundary

- **Bottom of the graph.** No `@uwmd/*` dependency, ever. Runtime dependencies
  are `fast-xml-parser` and `fflate` only, no peers.
- **No starter code.** Never the editor, runner, cascade, defaults, display
  formatting, refinement, the Excel emitter or agents. When standard code needs
  a starter service, take it by injection (`bindings.ts`'s
  `UWSourceEditAdapter`; `@uwmd/core`'s `bindings-edit.ts` supplies the editor).
- **No vendor SDK, no static `node:` import.** The one reviewed site is
  `integrity.ts`'s guarded dynamic `node:crypto`.
- `src/standard-closure.test.ts` enforces all of it: every source file must be
  in its `STANDARD_MODULES` inventory (or an entry), may import only another
  source file here or an allowed package, and package.json may name no
  `@uwmd/*` package. Adding a module means adding it to the list.

## Layout (`src/`)

- `index.ts` — **the public API.** Export new public symbols here; core's
  `index.ts`/`browser.ts` pick them up through `export *`. `browser.ts`
  re-exports `index.ts` unchanged (`browser.test.ts` holds them equal).
- `protocol.ts` — executable mirror of `UW_PROTOCOL.md` (types, error codes,
  version constants, `BUILTIN_*` tables). Keep it in lockstep with
  `spec/schemas/*` and the spec (invariant 7). The starter tables are core's
  `starter-protocol.ts`; core's reference manifest is core's
  `reference-implementation.ts`.
- `calc/` — the sandboxed evaluator (§VIII). `evaluateCalc` and
  `evaluateModuleCalculations` here return **no `display`**; core's exports
  add it (`calc-display.ts`).
- `receipts.ts` — the engine identity of every receipt is this package
  (`version.ts`: `VERIFY_PACKAGE_NAME`, `VERIFY_VERSION`, in lockstep with
  package.json), also through core. Core's `receipt-engine.ts` defaults only
  the `issuer`. A `VERIFY_VERSION` bump moves the receipt conformance
  baselines (wiki 11, release items 3–4).
- `builtin-packs/` — the twelve builtin pack manifests (standard data, each equal
  to its `spec/metrics/` entries). Their Excel parity tests live in core.
- `metric-dictionary.ts` — generated from `spec/metrics/builtin.json` by
  `npm run gen-metric-dictionary`; never edit by hand.

## Local invariants

- **AI never computes financials**: the evaluator and packs are deterministic.
- Relative imports carry the `.js` extension (NodeNext). Typed errors.
- A test needing a starter module (editor, renderer, cascade, Excel emitter,
  ...) belongs in `@uwmd/core`, named for that module (`editor.block-roles.test.ts`).

## Commands (run from this package)

```bash
npm run build          # tsc — build before core: core compiles against dist/
npm test               # vitest run
npm run test:coverage  # vitest run --coverage (floor in vitest.config.ts)
```
