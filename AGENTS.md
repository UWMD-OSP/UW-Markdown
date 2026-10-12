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

## The standard vs the starter products

[RFC 0078](docs/rfcs/0078-protocol-is-verification.md) splits the repo in two.
Know which side a change is on before you start.

- **The standard (normative)** is a document format plus the rules any party
  uses to *verify* a document: the Format spec, the Protocol (verification),
  receipts, the module system, the representation specs and bindings, and the
  metric dictionary `spec/metrics/builtin.json`, which defines every builtin
  metric. Conformance is two tiers, **Reader** and **Verifier**, plus optional
  profiles. The boundary test: a lender can verify a `.uw.md` from any producer
  using only the standard, with none of this repo's tools.
- **The starter products (non-normative)** are the tools given away so the
  standard spreads: the calc engine code and packs, defaults and the cascade,
  refinement, the editor, viewer and report, the Excel exporter, the AI agents,
  capability tokens and display conventions. Their guide is
  [`docs/starter/`](docs/starter/README.md); they change by package semver, never
  by a Protocol version.
- **Every official asset class is a full builtin** on both sides, equal to
  multifamily (RFC 0080): class id, sections, dictionary metrics, pack, Excel
  layout, defaults and example. Modules are for third parties only.

## Where things live

- `packages/uwmd-core` — `@uwmd/core`, the library and the heart of the repo.
  Everything depends on it. Runtime dependencies are `fast-xml-parser` and
  `fflate`; `@anthropic-ai/sdk` is an **optional peer**, loaded by dynamic import
  and excluded from the `@uwmd/core/browser` entry.
- `packages/uwmd-cli` — the `uwmd` CLI (thin wrapper over core's `cli.ts`).
- `packages/uwmd-excel` — `.uw.md → .xlsx` converter.
- `packages/uwmd-lake` — `@uwmd/lake`, the RFC 0049 PostgreSQL/JSONB adapter.
  Plans SQL; takes no database driver.
- `packages/uwmd-signing`, `uwmd-batch`, `uwmd-report` — signing, batch runs,
  reports.
- `tools/` — web-viewer, web-editor, vscode-uwmd, docs-site.
- `spec/` — the normative specs, JSON Schemas and the metric dictionary
  (`spec/metrics/`).
- `conformance/` — fixture/expected pairs that prove behavior.
- `docs/rfcs/` — the standard's design record. `docs/starter/` — the
  non-normative starter products guide. `docs/wiki/` — developer reference.

The public API is `packages/uwmd-core/src/index.ts` (browser-safe subset:
`src/browser.ts`). The contract is `spec/UW_FORMAT_SPEC.md`, `spec/UW_PROTOCOL.md`,
`spec/UW_RECEIPT.md` and
`spec/metrics/`; `packages/uwmd-core/src/protocol.ts` is the executable mirror
of the protocol.
Current state: [`docs/wiki/13-status.md`](docs/wiki/13-status.md) and
[`VERSIONS.md`](VERSIONS.md).

Some directories carry their own `CLAUDE.md` with package-specific notes
(`packages/uwmd-core`, `packages/uwmd-excel`, `tools/`). Every agent should read
the one for the directory it is working in.

## Invariants you must not break (full list: docs/wiki/10)

Code comments cite these by number, so the numbers stay fixed. A rule marked
starter-product is a quality bar for the reference tools, not a requirement of
the standard; every rule here still blocks a PR.

1. **AI never does financial math.** Agents extract data and write narrative; all
   NOI/DSCR/LTV/IRR/DCF math is deterministic in `calc/` + `packs/`. A project
   rule for every tool.
2. **Layering:** spec → nothing; `@uwmd/core` → no vendor SDK as a hard
   dependency; tools → core only, never another tool.
3. **Edits preserve bytes** outside the edited region. A starter-product
   (editor) guarantee: integrity hashes use canonical JSON, not raw bytes.
4. **Excel ↔ calc-engine parity is exact.** A starter-product quality bar, not a
   standard requirement. One pack drives both, and every pack equals its
   `spec/metrics/` entries; math runs unrounded in IEEE-754 binary64 and both
   sides quantize once at the same `round_to`, half-away-from-zero (protocol
   §VIII.5, which *is* normative).
5. **Append-only provenance:** supersede, don't destroy; the host owns `_meta`.
6. **Semver-per-surface:** format, protocol, and each package version independently.
7. **Spec/schema/protocol stay in lockstep:** `protocol.ts`, `spec/schemas/` and
   `spec/UW_PROTOCOL.md` change in the same PR or not at all.
8. **Workspace isolation:** `@uwmd/*` always resolves through local workspace
   links, never a registry tarball.
9. **Descriptive identity never selects underwriting behavior:** frontmatter
   `scenario` and `asset_subtype` may route descriptive workflows, but never
   choose calculations, defaults, packs or rules (Format §2.2b).

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
  and [GOVERNANCE.md](GOVERNANCE.md)). That includes adding or changing a
  metric definition in `spec/metrics/` and adding an official asset class. An
  RFC and its implementation can land in one PR; merging it accepts the RFC.
  Starter-product changes need no RFC, but numerics still follow the next rule.
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
