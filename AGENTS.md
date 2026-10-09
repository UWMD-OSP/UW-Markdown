# AGENTS.md — UW Markdown

Repository guidance for contributors and coding assistants. Start with the
[developer wiki](docs/wiki/README.md) for any non-trivial task, and follow
[CONTRIBUTING.md](CONTRIBUTING.md) and [GOVERNANCE.md](GOVERNANCE.md).

## Scope and workflow

UW Markdown is the public .uw.md standard and its reference implementation:
a library and specification, with supporting static tools including a React
web editor. There is no Express server or database in this repository.
underwriter.cc is a separate product that consumes the standard.

The contributor or coding assistant working on a task can plan, implement,
debug, test and review that work end to end. Follow the user's authorized
scope and the project's contribution and RFC process. Keep instructions
specific to this repository.

Planning records under specs/ are optional development artifacts. Reconcile
them against current source and merged work before using them. An implementation
plan can help a substantial change; routine fixes can proceed directly.
Historical plans and reviews record past work rather than prescribe the
current development workflow.

## Repository map

- packages/uwmd-core — @uwmd/core, the reference library. Runtime dependencies
  are fast-xml-parser and fflate. @anthropic-ai/sdk is an optional peer, loaded
  dynamically by its provider; it is excluded from the browser entry.
- packages/uwmd-cli — the uwmd CLI, a thin wrapper over core's cli.ts.
- packages/uwmd-excel — the .uw.md to .xlsx converter.
- packages/uwmd-lake — the PostgreSQL/JSONB adapter; plans SQL without a driver.
- tools/ — web-viewer, web-editor, vscode-uwmd and docs-site.
- spec/ — normative format/protocol specifications and schemas.
- conformance/ — fixtures and expected outputs proving behavior.
- docs/wiki/ — development reference. Keep relevant pages current as behavior changes.

Public exports live in packages/uwmd-core/src/index.ts and the browser-safe
packages/uwmd-core/src/browser.ts. The principal contracts are
spec/UW_FORMAT_SPEC_v1.md, spec/UW_FORMAT_SPEC_v2.md and spec/UW_PROTOCOL_v1.md;
protocol.ts is the executable mirror of the protocol surface. See
docs/wiki/13-status.md for current implementation and publication status.

## Invariants

1. Financial calculations are deterministic in calc/ and packs/. AI extraction
   and narrative must not invent financial results or absent source facts.
   Use accepted calculation semantics; unresolved financial assumptions need
   a decision before implementation.
2. Preserve dependency layering. Spec depends on nothing. Tools depend on
   core and their own stack, never another tool. Keep provider SDK code outside
   document mechanics and the browser import closure.
3. Tier-2 edits preserve bytes outside the edited region.
4. Excel and evaluator results agree exactly after the same declared round_to
   quantization. Calculations run unrounded in IEEE-754 binary64; evaluateCalc
   quantizes once using half-away-from-zero.
5. Provenance is append-only: supersede rather than destroy. The host owns _meta.
6. Format, protocol and package versions are independent.
7. Keep protocol types, corresponding schemas and normative text consistent.
   Normative changes follow the RFC process in GOVERNANCE.md and docs/wiki/11.

## Conventions

- TypeScript, ESM only; relative imports use the .js extension (NodeNext).
- Rates are fractions: 0.0551 means 5.51%; percentages are display only.
- Export new public symbols from src/index.ts and, when browser-safe, src/browser.ts.
  Web tools import @uwmd/core/browser.
- Vitest tests normally live beside the source in a corresponding *.test.ts.
  Biome is lint-only.
- Use the existing typed errors such as ProtocolError, CalcError and ExcelEmitError
  across public boundaries.
- Preserve unrelated working-tree changes. When work runs concurrently, use
  separate checkouts or worktrees and reconcile their results.

## Verification

Run applicable checks before finishing. Build before conformance because the
runner imports dist/. The standard repository gates are:

    npm run build
    npm test
    npm run conformance
    npm run validate-schemas
    npm run lint
    npm run verify-lockfile
    npm run verify-packages

Run npm ci when dependencies, lockfiles or workspace links change.
Run npm --prefix tools/docs-site run build when docs/ or spec/ changes.
Use the version, index, code, release and test-type guards when the change
touches those surfaces. Build and test affected tools with their own commands.

Update the wiki when behavior it documents changes. Editorial corrections can
proceed through the ordinary contribution process; normative changes require
an RFC. Keep release preparation, owner-authorized publication and independently
verified publication records distinct.
