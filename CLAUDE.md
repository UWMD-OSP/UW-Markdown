# CLAUDE.md — UW Markdown

Orientation for AI agents working in this repo. The deep reference is the
**developer wiki** in [`docs/wiki/`](docs/wiki/README.md) — start there.

## What this is

UW Markdown is the open **`.uw.md`** standard (Markdown + JSON for commercial
real-estate underwriting) plus its reference implementation. It is a **library +
specification**, not a web app: there is **no React frontend, no Express server,
no database** here. `underwriter.cc` is a separate product that consumes this
standard.

## Where things live

- `packages/uwmd-core` — `@uwmd/core`, the library and the heart of the repo.
  Everything depends on it; it takes no vendor SDK as a hard dependency
  (`@anthropic-ai/sdk` is an optional peer, loaded dynamically).
- `packages/uwmd-cli` — the `uwmd` CLI (thin wrapper over core's `cli.ts`).
- `packages/uwmd-excel` — `.uw.md → .xlsx` converter.
- `tools/` — web-viewer, web-editor, vscode-uwmd, docs-site.
- `spec/` — the normative format + protocol specs and JSON Schemas.
- `conformance/` — fixture/expected pairs that prove behavior.
- `docs/wiki/` — **read this for any non-trivial task.**

The public API is one file: `packages/uwmd-core/src/index.ts`. The contract is
two files: `spec/UW_FORMAT_SPEC_v1.md` and `spec/UW_PROTOCOL_v1.md`
(`packages/uwmd-core/src/protocol.ts` is the executable mirror of the latter).

For a current "what's built vs. what needs work" snapshot, see the living status
doc: [`docs/wiki/13-status.md`](docs/wiki/13-status.md) — keep it updated as
features land.

## Invariants you must not break (full list: docs/wiki/10)

1. **AI never does financial math.** Agents extract data and write narrative; all
   NOI/DSCR/LTV/IRR/DCF math is deterministic in `calc/` + `packs/`.
2. **Layering:** spec→nothing; `@uwmd/core`→no vendor SDK (`@anthropic-ai/sdk` is
   an optional peer reached only by dynamic import, and excluded from the
   `@uwmd/core/browser` entry); tools→core only, never other tools.
3. **Tier-2 edits preserve bytes** outside the edited region.
4. **Excel ↔ calc-engine parity** is *exact* (one pack drives both; both sides
   quantize at the same `round_to` — protocol §VIII.5).
5. **Append-only provenance:** supersede, don't destroy; the host owns `_meta`.
6. **Semver-per-surface:** format, protocol, and each package version independently.
7. **Spec/schema/protocol stay in lockstep.**

## Conventions

- TypeScript, **ESM only**; relative imports use the `.js` extension (NodeNext).
- Rates are **fractions, not percents** (`0.0551` = 5.51%) everywhere but display.
- Export new public symbols from `src/index.ts` (and `src/browser.ts` if
  browser-safe). Web tools import from `@uwmd/core/browser`.
- One `*.test.ts` per source file (Vitest). Lint is Biome, lint-only.
- Use typed errors (`ProtocolError`, `CalcError`, `ExcelEmitError`), not bare `Error`.

## Commands

```bash
npm run build            # tsc across workspaces (build before conformance!)
npm test                 # vitest across workspaces
npm run lint             # biome lint
npm run conformance      # tiers 1,2,3 (imports dist/, so build first)
npm run validate-schemas # ajv check of spec/schemas
npm run cli -- <cmd>     # run the uwmd CLI from source
```

## Before you finish a change

Run `npm run build && npm test && npm run conformance`. If you changed behavior a
wiki page describes, update that page in the same change. Anything touching
`spec/` or `spec/schemas/` is **normative and needs an RFC**
(`docs/rfcs/`) — see `docs/wiki/11`.
