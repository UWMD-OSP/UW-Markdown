# Changelog

All notable changes to UW Markdown — the format spec, the protocol spec, the
reference library `@uwmd/core`, the conformance corpus, and starter tools — are
documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project follows semantic versioning per surface (the format, the
protocol, and each package each carry an independent semver).

## [Unreleased]

### Added
- Repo restructured into OSS-ready monorepo (`spec/`, `packages/`, `examples/`, `conformance/`, `tools/`).
- `@uwmd/core` package (renamed from `uwmd`).
- UW Protocol v1 specification (`spec/UW_PROTOCOL_v1.md`).
- TypeScript protocol surface (`packages/uwmd-core/src/protocol.ts`) — `ViewerCapability`, `SectionViewModel`, `ModuleManifest`, `ProtocolError`, `BUILTIN_VIEW_MODELS`, etc.
- Module manifest JSON Schema (`spec/schemas/module-manifest.schema.json`).
- Canonical formatting helpers (`packages/uwmd-core/src/format.ts`) — `formatCurrency`, `formatPercent`, `formatRatio`, etc.
- Conformance test corpus (`conformance/tier-{1..4}/`).
- Single-file Tier-1 reference viewer (`tools/web-viewer/index.html`).
- Top-level OSS scaffolding (LICENSE, CONTRIBUTING, CODE_OF_CONDUCT, CI workflow, issue templates).
- **Tier-2 Editor** — `applyEdit()` dispatcher in `@uwmd/core` covering `frontmatter_set`, `section_replace`, `section_supersede`, and `pipeline_log_append`, with `BUILTIN_EDIT_POLICIES` enforcement and round-trip preservation. New `uwmd edit` CLI subcommand.
- **Tier-3 Calc Host** — safe-expression parser + evaluator + built-ins (`sum`, `avg`, `min`, `max`, `coalesce`, `if`, `round`, `pmt`, `npv`, `irr`) per protocol §VIII.1 EBNF, with full `CalcError` taxonomy. New `uwmd calc` CLI subcommand.
- Validator wired to `BUILTIN_REMEDIATIONS` registry (no inline strings; per protocol §III.6).
- **Conformance runner** (`scripts/run-conformance.mjs`) executing tiers 1–4 with CI gate on tiers 1–3. Filled missing tier-2/3/4 fixtures (`frontmatter-set-recommendation` before/after pair, `revpar-basic`, `dscr-from-section`, `l6-risk-rating` shape assertion).
- **JSON Schemas** for all six boundary-crossing protocol types: `uwmd-block`, `edit-operation`, `protocol-error`, `implementation-manifest`, `calc-result`, `issue-remediation`. Programmatic validator (`scripts/validate-schemas.mjs`) using ajv 2020 + ajv-formats with cross-file `$ref` pre-registration. CI gate.
- **Governance scaffolding** — [SECURITY.md](./SECURITY.md), [GOVERNANCE.md](./GOVERNANCE.md) (BDFL + contributors model, normative-vs-editorial split, RFC process), [MAINTAINERS.md](./MAINTAINERS.md), [`.github/CODEOWNERS`](./.github/CODEOWNERS), [ROADMAP.md](./ROADMAP.md), [`docs/rfcs/`](./docs/rfcs/) directory with template and process README.
- **npm publish workflow** ([`.github/workflows/release.yml`](./.github/workflows/release.yml)) — on `v*` tag, runs full test + conformance + schema-validation gate, then publishes `@uwmd/core` to npm with provenance. `prepublishOnly` script in the package mirrors the same gate locally.
- **VS Code extension** ([`tools/vscode-uwmd/`](./tools/vscode-uwmd/), preview `0.1.0`) — syntax highlighting for `.uw.md` (YAML frontmatter + Markdown + embedded JSON in `uwmd json` blocks), folding for frontmatter / fenced blocks / heading sections, document outline, and on-save validation surfacing every `@uwmd/core` issue with its `code`, `title`, `remediation`, and `spec_ref`. Bundled via esbuild; ships as `.vsix`.
- **Documentation site** ([`tools/docs-site/`](./tools/docs-site/), preview `0.1.0`) — VitePress build covering the format spec, protocol spec, JSON Schemas, conformance corpus per tier, and the full set of project documents (roadmap, governance, contributing, security, RFC process). Repo-root markdown remains the single source of truth; `scripts/prebuild.mjs` copies content into the site tree at build time and rewrites relative links to site URLs. Ships as a 2.9 MB static bundle deployable to any static host.
- **Standalone CLI installer** ([`packages/uwmd-cli/`](./packages/uwmd-cli/), preview `1.0.0`) — new `uwmd` npm package providing `npx uwmd <command>` for non-developers who don't want to clone the repo. Thin wrapper that re-exposes the `@uwmd/core` CLI module via a new `./cli` subpath export. Covers all eleven subcommands: `init`, `parse`, `validate`, `compact`, `diff`, `render`, `edit`, `calc`, `run`, `summary`, `layers`. Same Tier-1/2/3/4 conformance behavior as the in-repo CLI; no separate code path, so no calc-drift risk.
- **`@uwmd/core/browser` subpath export** — new browser-safe entry point that excludes the agent runner and `@anthropic-ai/sdk` so the library can be bundled directly into web apps. Re-exports parser, validator, compactor, renderer, editor (`applyEdit`), calc engine (`evaluateCalc`), formatting helpers, and the full type / protocol surface. Source at `packages/uwmd-core/src/browser.ts`.
- **v2 RFC drafts** ([`docs/rfcs/`](./docs/rfcs/)) — six initial drafts opened to start the v2 design conversation, one per item in [ROADMAP](./ROADMAP.md) §"v2 spec exploration": [RFC 0001](./docs/rfcs/0001-locale-negotiation.md) (locale negotiation), [RFC 0002](./docs/rfcs/0002-module-signing.md) (Sigstore-style module signing), [RFC 0003](./docs/rfcs/0003-module-asset-classes.md) (custom asset-class declarations from modules), [RFC 0004](./docs/rfcs/0004-conformance-runner-v2.md) (language-agnostic conformance runner with TAP14 + JSON manifest output), [RFC 0005](./docs/rfcs/0005-stochastic-calculations.md) (stochastic calc declarations with seeded PCG-XSL-RR-64 PRNG), and [RFC 0006](./docs/rfcs/0006-hospitality-module.md) (hospitality reference module). All in `status: draft`; none required for v1 conformance.
- **Excel converter** ([`packages/uwmd-excel/`](./packages/uwmd-excel/), preview `0.1.0`) — new `@uwmd/excel` package providing `uwmd-excel <file.uw.md> [-o out.xlsx]` and a programmatic `toWorkbook(parsed)` API. Generates a three-sheet multifamily workbook: an Underwriting sheet (header + named-range inputs block + derived-metric formulas block), an Operating Statement sheet (five income lines + `EGI=SUM(income)` + eleven expense lines + `total_opex=SUM(expenses)` + `NOI=EGI−total_opex`), and a Pipeline Log audit sheet. The eight derived-metric formulas (cap rate, LTV, DSCR, debt yield, price/unit, loan/unit, loan/sqft, cash-on-cash) ship as Excel formulas referencing the workbook-scope named ranges (`purchase_price`, `loan_amount`, `annual_debt_service`, `total_units`, `total_nra_sqft`, `equity_sponsor`, `noi`) — these mirror `MULTIFAMILY_STARTER_PACK` in `@uwmd/core` exactly, so opening the workbook in Excel and running `uwmd calc` against the same `.uw.md` produce identical numbers by construction. Editing any named-input cell or any line item ripples through to every dependent metric. Multifamily-only and `.uw.md` → `.xlsx` only in 0.1.0; the reverse direction is deferred and the calc-aware web editor remains the canonical Tier-2 chokepoint for editing.
- **Calc-aware web editor** ([`tools/web-editor/`](./tools/web-editor/), preview `0.1.0`) — Vite + plain TS bundle on top of `@uwmd/core/browser`. Drag-drop file load, sidebar with per-section validation badges, frontmatter editor (16 typed inputs spanning text / enum / list fields), and section views with typed numeric inputs on five calc-bearing sections (`property`, `valuation`, `noi_model`, `debt_structure`, `sources_uses`). Every edit dispatches through `applyEdit()` and reparses the file, so in-memory state can never drift from canonical source. Multifamily calc starter pack (cap rate, LTV, DSCR, debt yield, $/unit, $/sqft, price/unit, cash-on-cash) re-evaluates on every render via `evaluateCalc`. Validation footer surfaces every `ValidationMessage` with severity, code, section, and `BUILTIN_REMEDIATIONS` copy. Bundle size: 19 kB app + 11 kB core, gzipped. Replaces the originally-planned narrative-only Tier-2 web editor — that design was rejected because separating safe narrative edits from unsafe numeric edits creates two paths into the same file.

### Changed
- `@uwmd/core` no longer declares a `bin` entry — the standalone `uwmd` package owns the binary so the two packages don't conflict when both installed. Library consumers continue to import from `@uwmd/core`; CLI consumers should install `uwmd` (or `npx uwmd`). The CLI module is now exposed as the `@uwmd/core/cli` subpath export.
- Release workflow now publishes both `@uwmd/core` and `uwmd` together on each `v*` tag, with a version-match gate that also verifies `uwmd`'s pinned dependency on the corresponding `@uwmd/core` version.
- Quickstart in `README.md` and fixture-regen examples in `CONTRIBUTING.md` updated to use `npx uwmd …` (or `npm run cli -- …` from a clone) instead of the raw `node packages/uwmd-core/dist/cli.js` path.
- Format spec — added RFC 2119 preamble; restored §4.18 (Pipeline Log) to canonical numeric position; clarified section count (21 standard + 1 meta).
- Protocol spec — fixed `.uw.institution.json` cross-reference (now points to Appendix C.6); added "Normative schema:" links from §I.4, §III.1, §V, §VIII, §XI to the new JSON Schemas; added §XIII "Future work" consolidating v2 deferrals.

## [1.0.0-pre] — pre-public

Pre-public development of the format spec (`UW_FORMAT_SPEC_v1.md`) and reference
parser/validator/renderer/runner/Claude agent host inside `uwmd/`.

[Unreleased]: https://github.com/jaredmaxey/Underwriting-Markdown-Private-1.0/compare/v1.0.0...HEAD
