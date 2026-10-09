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

---

# How work gets done

## Who does what

**Claude Code and Codex are equal peers.** Either can take any kind of work —
bug fixes, features, RFCs, releases — end to end, from reading the issue to a
green PR. **Jared owns the repo** and is the only one who merges, tags,
publishes, or changes accounts and credentials.

## Work in your own checkout, on your own branch

- Each agent works in its own checkout or git worktree, never in another
  agent's. Codex's usual worktree is `../uwmd-codex`; the primary checkout
  (`UW Markdown`) belongs to whichever Claude Code session is running there.
- Branch from current `origin/main`, one branch per PR, named
  `claude/<topic>` or `codex/<topic>`. Don't reuse a branch for a second PR.
- Before starting, check open PRs (`gh pr list`) for one already doing the same
  work or touching the same files. Parallel PRs that each append to
  `CHANGELOG.md` or `docs/wiki/13-status.md` conflict with each other even when
  both are green; rebase on `main` before asking for a merge.
- Commit before running long commands. Never leave changes staged while a
  multi-minute test suite runs; another session's `git commit` can sweep them up.

## One PR, one topic

A PR does one thing, and everything it needs ships with it: the code, its tests,
the wiki page it changes, the `CHANGELOG.md` `[Unreleased]` entry, and (for
normative changes) the RFC, spec, schema and conformance updates. Anything you
notice along the way that is out of scope goes in the PR description as a
follow-up or into a separate issue, not into the diff.

**Agents do not edit `AGENTS.md`, `CLAUDE.md`, `GOVERNANCE.md` or
`CONTRIBUTING.md` inside other work.** If the guidance is wrong or stale, say so
in the PR description, or open a separate PR that changes only the guidance.

## Decide, record, ship

When a task leaves a question open — naming, API shape, a code to emit, which of
two compatible readings to implement — **decide it from repo precedent and keep
going.** Existing RFCs, the spec, `protocol.ts`, the house patterns (closed
vocabularies that refuse unknown values; the existing currency quantum; typed
errors) answer most questions. Record every such call in the PR description:

| Question | Decision | Why (precedent) |
|---|---|---|

Jared's merge is the acceptance. Don't stop work to ask, and don't end a task by
listing "owner decisions remain."

**Stop and ask** only for:

1. **Merge, tag, publish, deprecate**, or anything that touches npm, GitHub,
   Vercel or other accounts and credentials.
2. **A new financial convention** — a formula, day count, rounding rule,
   convergence criterion or tolerance that no accepted RFC or the spec pins.
   Never guess at numerics (invariant 1).
3. **A breaking change to the format** that existing documents would fail.
4. **A new external npm dependency.**
5. **The same fix failing the same check twice.** Stop, leave the tree
   committed, and report what you tried.

## RFCs

Any change to what the standard means — `spec/`, `spec/schemas/`, protocol
types — needs an RFC in `docs/rfcs/` (process: `docs/wiki/11`). RFCs are the
standard's permanent record and adopters read them, so they are never skipped.

- **Default: one RFC, one PR.** The RFC (status `accepted`), its Decisions
  table, and the implementation, spec, schema and conformance changes land
  together. Merging the PR accepts the RFC.
- **Draft PR first** only when the RFC introduces a new financial convention or
  a breaking format change (stop-and-ask items 2 and 3). Open the RFC alone as
  `draft`, and implement after Jared merges it.

## Paperwork

The PR description carries scope, decisions and validation results. Don't write
plan files (`specs/`), review documents (`docs/reviews/`), or standalone
"reconcile" / "record" / "review" commits unless Jared asks for them. Existing
files there are history, not instructions — reconcile them against `main`
before trusting anything they say.

The exception is release records: the release procedure in `docs/wiki/11`
(prepare → tag → publish → reconcile) is enforced by `verify-release` and is
followed exactly, one reconciliation PR per release.

## Human handoffs

When a step needs Jared — a merge, a tag, an account setting, a credential —
don't mention it mid-reply and keep working. Write it to a standalone Markdown
file (what and why in two sentences; the exact commands or click path with
literal values; what "done" looks like; what to bring back), say plainly that
work is paused, and stop. Verify the result when he returns instead of assuming
it succeeded. Handoff files go in your scratch space, not the repo.

## Finishing

A task is done when its PR is open, CI is green, and the description lists what
changed, the decisions table (if any), how it was validated, and any
follow-ups. Report the PR link and stop. Don't merge.
