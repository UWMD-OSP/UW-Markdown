# AGENTS.md — UW Markdown

Orientation for AI agents working in this repo. The deep reference is the
**developer wiki** in [`docs/wiki/`](docs/wiki/README.md) — start there.

## What this is

UW Markdown is the open **`.uw.md`** standard (Markdown + JSON for commercial
real-estate underwriting) plus its reference implementation. The primary product
is a **library + specification**, supported by static tools including a React web
editor. There is no Express server or database here. `underwriter.cc` is a
separate product that consumes this standard.

## Where things live

- `packages/uwmd-core` — `@uwmd/core`, the library and the heart of the repo.
  Everything depends on it; it depends only on `@anthropic-ai/sdk`.
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
2. **Layering:** spec→nothing; `@uwmd/core`→`@anthropic-ai/sdk` only (and excluded
   from the `@uwmd/core/browser` entry); tools→core only, never other tools.
3. **Tier-2 edits preserve bytes** outside the edited region.
4. **Excel ↔ calc-engine parity** to 6 decimals (one pack drives both).
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

---

# Agent Orchestration Protocol

Everything above orients *one* agent in the repo. This section governs how
several of them work together without stepping on each other.

## Role division

| Role | Who | Owns |
|---|---|---|
| **Context hub & planner** | Gemini / ChatGPT | Ingests broad repo context, plans architectural changes, drafts `specs/active/SPEC.md`, reviews PRs adversarially. |
| **Lead builder** | Claude Code / terminal agent | Executes `specs/active/TASKS.md` one item at a time, writes tests, runs the deterministic gates locally. |
| **Human partner** | Jared | Resolves ambiguous business logic, approves schema changes, merges PRs once the gates are green. |

The planner writes specs; the builder writes code. A builder that finds itself
redesigning the contract has hit an escalation trigger, not a coding problem.

## The spec/task contract

- `specs/active/SPEC.md` — the current feature contract: scope, technical
  decisions, and a definition of done. One active spec at a time.
- `specs/active/TASKS.md` — the ordered task matrix derived from that spec.
  Exactly one unchecked item is in flight at a time; the builder checks it off
  only after the gates pass and the change is committed.
- Completed specs move to `specs/archive/<name>.md` when their task matrix is
  fully checked off.

**Reconcile before you build.** Task matrices are written from a snapshot and go
stale — branches land, PRs merge. Before starting a stage, verify each item
against the working tree and check off what is already true rather than redoing
it. Reconciliation is cheap; a duplicate protocol bump is not.

## Deterministic verification gates

Run every gate before checking off a task:

```bash
npm ci                   # only after dependency or lockfile changes
npm run build            # tsc across workspaces — conformance imports dist/
npm test                 # vitest across workspaces
npm run conformance      # every default suite, all tiers
npm run validate-schemas # ajv compile of spec/schemas/
npm run lint             # biome, lint-only
npm run verify-lockfile  # no @uwmd/* resolving to a registry tarball
npm run verify-packages  # publishable package contents
npm --prefix tools/docs-site run build   # docs build, when docs/ or spec/ changed
```

`npm ci` on every task is wasteful on a warm tree — run it when `package.json`,
`package-lock.json`, or workspace links changed, and otherwise trust the build.

## Escalation triggers — halt and ask

1. **Loop failure.** Any test, schema, or conformance check fails twice
   consecutively on the same fix attempt.
2. **Interface or schema drift.** The task needs a change to exported types in
   `packages/uwmd-core/src/protocol.ts` or to `spec/schemas/` that the active
   spec does not explicitly authorize. Normative changes need an RFC.
3. **Dependency alteration.** The task needs a new external npm dependency or an
   edit to workspace linking.
4. **Financial ambiguity.** A formula, convergence criterion, root bracket, or
   precision tolerance is not pinned by the spec. Never guess at numerics —
   see invariant 1.

Halting means: stop, leave the tree in a committed or cleanly-stashed state,
and state precisely what decision is needed.

## Cross-agent invariants

- **Zero-drift triad.** `protocol.ts`, `spec/schemas/`, and
  `spec/UW_PROTOCOL_v1.md` change in the same commit or not at all.
- **Deterministic quantization.** Math runs unrounded in IEEE-754 `binary64`;
  quantization happens once, at the `evaluateCalc` boundary, half-away-from-zero.
- **Workspace isolation.** `@uwmd/*` always resolves through local workspace
  links, never a registry tarball.
- **Clean provider seam.** AI SDK orchestration stays out of document mechanics
  and out of the `browser.ts` bundle.
- **Worktree separation.** Codex works in `../uwmd-codex` on `codex/work`; the
  primary checkout belongs to the lead builder. Two agents in one worktree is a
  merge conflict waiting to happen.
