# AGENTS.md — UW Markdown

The single source of guidance for every coding agent in this repo (Claude Code,
Codex, or anything else). `CLAUDE.md` only points here; CI fails if it grows
content of its own. The deep reference is the **developer wiki** in
[`docs/wiki/`](docs/wiki/README.md) — read it for any non-trivial task.

## What this is

UW Markdown is the open **`.uw.md`** standard (Markdown + JSON for commercial
real-estate underwriting) plus its reference implementation. It is a **library +
specification**, supported by static tools including a React web editor. There
is no Express server and no database here. `underwriter.cc` is a separate
product that consumes this standard.

## Where things live

- `packages/uwmd-core` — `@uwmd/core`, the library and the heart of the repo.
  Everything depends on it. Runtime dependencies are `fast-xml-parser` and
  `fflate`; `@anthropic-ai/sdk` is an **optional peer**, loaded by dynamic import
  and excluded from the `@uwmd/core/browser` entry.
- `packages/uwmd-cli` — the `uwmd` CLI (thin wrapper over core's `cli.ts`).
- `packages/uwmd-excel` — `.uw.md → .xlsx` converter.
- `packages/uwmd-lake` — `@uwmd/lake`, the RFC 0049 PostgreSQL/JSONB adapter.
  Plans SQL; takes no database driver.
- `packages/uwmd-signing`, `uwmd-batch`, `uwmd-report`, `uwmd-module-*` —
  signing, batch runs, reports, and the official modules.
- `tools/` — web-viewer, web-editor, vscode-uwmd, docs-site.
- `spec/` — the normative specs and JSON Schemas.
- `conformance/` — fixture/expected pairs that prove behavior.
- `docs/rfcs/` — the standard's design record. `docs/wiki/` — developer reference.

The public API is `packages/uwmd-core/src/index.ts` (browser-safe subset:
`src/browser.ts`). The contract is `spec/UW_FORMAT_SPEC_v2.md`,
`spec/UW_FORMAT_SPEC_v1.md` and `spec/UW_PROTOCOL_v1.md`;
`packages/uwmd-core/src/protocol.ts` is the executable mirror of the protocol.
Current state: [`docs/wiki/13-status.md`](docs/wiki/13-status.md) and
[`VERSIONS.md`](VERSIONS.md).

Some directories carry their own `CLAUDE.md` with package-specific notes
(`packages/uwmd-core`, `packages/uwmd-excel`, `tools/`). Every agent should read
the one for the directory it is working in.

## Invariants you must not break (full list: docs/wiki/10)

1. **AI never does financial math.** Agents extract data and write narrative; all
   NOI/DSCR/LTV/IRR/DCF math is deterministic in `calc/` + `packs/`.
2. **Layering:** spec → nothing; `@uwmd/core` → no vendor SDK as a hard
   dependency; tools → core only, never another tool.
3. **Tier-2 edits preserve bytes** outside the edited region.
4. **Excel ↔ calc-engine parity is exact.** One pack drives both; math runs
   unrounded in IEEE-754 binary64 and both sides quantize once at the same
   `round_to`, half-away-from-zero (protocol §VIII.5).
5. **Append-only provenance:** supersede, don't destroy; the host owns `_meta`.
6. **Semver-per-surface:** format, protocol, and each package version independently.
7. **Spec/schema/protocol stay in lockstep:** `protocol.ts`, `spec/schemas/` and
   `spec/UW_PROTOCOL_v1.md` change in the same PR or not at all.
8. **Workspace isolation:** `@uwmd/*` always resolves through local workspace
   links, never a registry tarball.

## Conventions

- TypeScript, **ESM only**; relative imports use the `.js` extension (NodeNext).
- Rates are **fractions, not percents** (`0.0551` = 5.51%) everywhere but display.
- Export new public symbols from `src/index.ts` (and `src/browser.ts` if
  browser-safe). Web tools import from `@uwmd/core/browser`.
- One `*.test.ts` per source file (Vitest). Lint is Biome, lint-only.
- Use typed errors (`ProtocolError`, `CalcError`, `ExcelEmitError`), not bare `Error`.

## Commands and gates

```bash
npm run build            # tsc across workspaces (build before conformance!)
npm test                 # vitest across workspaces
npm run typecheck:tests  # tests are not type-checked by build or npm test
npm run conformance      # all tiers (imports dist/, so build first)
npm run validate-schemas # ajv compile of spec/schemas
npm run lint             # biome, lint-only
npm run cli -- <cmd>     # run the uwmd CLI from source
```

Before opening a PR, run `build`, `test`, `typecheck:tests` and `conformance`,
plus whichever guards the change touches: `verify-packages`, `verify-lockfile`,
`verify-versions`, `verify-indexes`, `verify-codes`, `verify-release`, and
`npm --prefix tools/docs-site run build` when `docs/` or `spec/` changed.
Run `npm ci` only when dependencies, lockfiles or workspace links changed.
CI runs all of them; a red check is yours to fix before asking for review.


## Contributing a change

- **One PR, one topic.** A PR ships everything its change needs: code, tests,
  the wiki page it changes, the `CHANGELOG.md` `[Unreleased]` entry, and (for
  normative changes) the RFC, spec, schema and conformance updates. Anything
  out of scope goes in the PR description or a separate issue, not the diff.
- **Normative changes need an RFC** in `docs/rfcs/` (process: `docs/wiki/11`
  and [GOVERNANCE.md](GOVERNANCE.md)). An RFC and its implementation can land
  in one PR; merging it accepts the RFC.
- **Decide open questions from precedent** (existing RFCs, the spec,
  `protocol.ts`, house patterns such as closed vocabularies that refuse
  unknown values) and record each call in the PR description:
  question, decision, and the precedent behind it.
- **Never guess at numerics.** A formula, day count, rounding rule or tolerance
  that no accepted RFC or the spec pins is a question for the maintainers, not
  a judgment call (invariant 1). The same goes for a breaking format change or
  a new external dependency.
- **Releases** follow the procedure in `docs/wiki/11` exactly; `verify-release`
  enforces it.
- **Parallel work:** use separate checkouts or worktrees, branch from current
  `main`, and rebase before merging. PRs that each append to `CHANGELOG.md`
  conflict even when both are green.

Maintainers keep their own team workflow outside this repo. It loads through
gitignored local files (`CLAUDE.local.md`, a user-level Codex `AGENTS.md`), so
this file stays the same for every contributor and fork.
