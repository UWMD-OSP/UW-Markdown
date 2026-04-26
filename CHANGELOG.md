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

### Changed
- Format spec — added RFC 2119 preamble; restored §4.18 (Pipeline Log) to canonical numeric position; clarified section count (21 standard + 1 meta).
- Protocol spec — fixed `.uw.institution.json` cross-reference (now points to Appendix C.6); added "Normative schema:" links from §I.4, §III.1, §V, §VIII, §XI to the new JSON Schemas; added §XIII "Future work" consolidating v2 deferrals.

## [1.0.0-pre] — pre-public

Pre-public development of the format spec (`UW_FORMAT_SPEC_v1.md`) and reference
parser/validator/renderer/runner/Claude agent host inside `uwmd/`.

[Unreleased]: https://github.com/jaredmaxey/Underwriting-Markdown-Private-1.0/compare/v1.0.0...HEAD
