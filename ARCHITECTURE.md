# Architecture

This document describes how the UW Markdown repository is organized so
contributors can navigate it without reverse-engineering from commit
history. For *what* the format is and *why* it's designed the way it
is, see [`spec/UW_FORMAT_SPEC.md`](spec/UW_FORMAT_SPEC.md),
[`spec/UW_PROTOCOL.md`](spec/UW_PROTOCOL.md), and the representation
mappings such as [`spec/UW_XML_MAPPING.md`](spec/UW_XML_MAPPING.md), plus optional transport profiles under [`spec/bindings/`](spec/bindings/).

## The big picture

The project has five layers, each consuming the one above it:

```
┌─────────────────────────────────────────────────────────────┐
│  Standard         spec/UW_FORMAT_SPEC.md (3.0)          │  normative
│  (normative)      spec/UW_PROTOCOL.md  (verification)    │  text
│                   spec/UW_RECEIPT.md                     │
│                   spec/metrics/builtin.json (dictionary)    │
│                   spec/schemas/*.schema.json                │
└─────────────────────────────────────────────────────────────┘
                          ▲
                          │ implements
┌─────────────────────────────────────────────────────────────┐
│  Reference        packages/uwmd-core (@uwmd/core)           │  TypeScript
│  library          ├── parser / validator / renderer          │  library
│                   ├── editor (starter edit dispatcher)       │
│                   ├── calc/  (parser, evaluator, builtins)   │
│                   ├── packs/ (12 builtin packs, excel-emit)  │
│                   └── agents/ (Bancroft, starter agent host) │
└─────────────────────────────────────────────────────────────┘
                          ▲
                          │ used by
┌─────────────────────────────────────────────────────────────┐
│  Tools            packages/uwmd-cli   (standalone CLI)       │  user-facing
│                   packages/uwmd-excel (.uw.md → .xlsx)       │
│                   tools/web-viewer    (Reader, drag-drop)    │
│                   tools/web-editor    (calc-aware editor)    │
│                   tools/vscode-uwmd   (authoring extension)  │
│                   tools/docs-site     (VitePress docs)       │
└─────────────────────────────────────────────────────────────┘
                          ▲
                          │ certified by
┌─────────────────────────────────────────────────────────────┐
│  Conformance      conformance/corpus-index.json             │  one owner
│  corpus           (reader, verifier, six profiles,          │  per case
│                    starter products) over fixture families  │  fixtures +
│                   conformance/<family>/  (legacy dir names) │  expected
└─────────────────────────────────────────────────────────────┘
                          ▲
                          │ governed by
┌─────────────────────────────────────────────────────────────┐
│  Governance       GOVERNANCE.md, MAINTAINERS.md,             │  process
│                   CONTRIBUTING.md, SECURITY.md,              │
│                   docs/rfcs/*                                │
└─────────────────────────────────────────────────────────────┘
```

## Spec layer

Versioned normative documents and one schema set. Adopters needing to
implement only one tier can read just the relevant sections.

- [`spec/UW_FORMAT_SPEC.md`](spec/UW_FORMAT_SPEC.md) — file shape:
  frontmatter, the 21 standard sections, supersede semantics, the
  cross-section consistency rules (`CC-NN`).
- [`spec/UW_PROTOCOL.md`](spec/UW_PROTOCOL.md) — how any party
  verifies a document: the Reader and Verifier tiers and optional profiles,
  the provenance rules, the calc-engine grammar (EBNF) and the stated-figure
  verifiers (Protocol 3.0 contract, RFC 0078). Display, editing, defaults and
  the AI host are non-normative starter-product guidance in
  [`docs/starter/`](docs/starter/README.md).
- [`spec/UW_XML_MAPPING.md`](spec/UW_XML_MAPPING.md) — deterministic
  Envelope 1.0 mapping, namespace, integrity, and secure decoding rules.
- [`spec/UW_CSV_BUNDLE.md`](spec/UW_CSV_BUNDLE.md) — normalized tables,
  deterministic ZIP, model reconstruction, views, and extraction limits.
- [`spec/bindings/`](spec/bindings/) — HTTP Binding 1.0, MCP Binding 1.0,
  and the example OpenAPI 3.1 API contract.
- [`spec/schemas/`](spec/schemas/) — JSON Schema 2020-12 definitions plus the
  structural UW XML XSD.

## Reference library: `@uwmd/core`

[`packages/uwmd-core/src`](packages/uwmd-core/src/) is the canonical
TypeScript implementation. All file-level operations route through
this library; tools depend on it.

| File | Responsibility |
|---|---|
| `parser.ts` | `.uw.md` → `ParsedUWFile` (frontmatter + sections + `_meta`). |
| `validator.ts` | Cross-section + financial-validity + meta-integrity checks. Hosts `BUILTIN_REMEDIATIONS`, the registry referenced by protocol §III.6a. |
| `editor.ts` | Starter-product edit dispatcher: `applyEdit()` over four operation types, gated by `BUILTIN_EDIT_POLICIES`. |
| `bindings.ts` | HTTP negotiation/ETags and MCP resource/tool-result adapters over the shared codecs/editor. |
| `renderer.ts` | HTML / Markdown rendering paths. PDF/DOCX are stubs deferred to a third-party pipeline. |
| `runner.ts` + `agents/` | Starter agent host. `runBancroftAgent` is the Claude-backed reference implementation; the contract (`protocol.ts` types, [starter guide](docs/starter/ai-host.md)) is provider-neutral. |
| `calc/` | `parser.ts` (recursive-descent), `evaluator.ts` (AST walker), `builtins.ts` (financial + math primitives). The evaluator is sandboxed: capped input, no globals, no I/O. |
| `builtin-packs/` + `packs/` | One pack manifest per builtin asset class in `builtin-packs/` (standard data), each equal to its normative `spec/metrics/` entries (`metric-dictionary.test.ts`); `packs/` re-exports them. `packs/excel-emit.ts` translates the same AST to Excel formulas, and the pack tests assert the two paths agree exactly after §VIII.5 quantization (a starter-product quality bar). |
| `protocol.ts` | The normative contract types, `BUILTIN_EDIT_POLICIES`, `BUILTIN_REMEDIATIONS`, version constants. |
| `starter-protocol.ts` | Starter tables: `BUILTIN_VIEW_MODELS`, number formats, `CASCADE_ORDER`, the AI-host and capability-token types (RFC 0083). |
| `format.ts` | Field-level formatters (currency, percent, multiple, etc.) used by view models. |
| `context.ts` | `BANCROFT_LAYERS` definitions and `buildAgentContext`. |
| `compactor.ts` | Materializes "live view" by collapsing superseded blocks. |
| `init.ts` | Scaffold a new `.uw.md` from defaults. |
| `cli.ts` | Programmatic CLI entry; surfaced via `uwmd-cli`. |
| `browser.ts` | Subpath export excluding `@anthropic-ai/sdk` so the parser/validator/calc engine can be bundled into a web app. |

## Tools layer

Each tool depends on `@uwmd/core` (browser entry where applicable) and
nothing else from this monorepo:

- `packages/uwmd-cli` — the public `uwmd` CLI. Wraps `cli.ts` and
  ships its own bin entry.
- `packages/uwmd-excel` — `.uw.md` → `.xlsx` export. Consumes the same
  packs as the calc engine so formulas in the workbook match
  evaluator output.
- `tools/web-viewer` — single-file drag-drop Reader.
- `tools/web-editor` — calc-aware starter editor.
- `tools/vscode-uwmd` — authoring extension (syntax, validation
  squiggles, calc-pack hover).
- `tools/docs-site` — VitePress site that assembles spec + protocol +
  schemas + conformance + governance. A prebuild step keeps repo-root
  markdown as the single source of truth.

## Conformance corpus

[`conformance/`](conformance/) is the trust anchor for third parties.
[`scripts/run-conformance.mjs`](scripts/run-conformance.mjs) drives
every fixture family, and
[`conformance/corpus-index.json`](conformance/corpus-index.json) gives each
case exactly one owner (Protocol §II.6, RFC 0078):

- **Reader** — parsing and well-formedness.
- **Verifier** — Reader plus the Format validation rules, metric-dictionary
  reproduction, the stated-figure verifiers (including the IRR procedure),
  receipts and the §VIII.1–VIII.3 expression notation.
- **Profiles** — Module, Integrity, Representations, Portfolio,
  Sensitivity and Stochastic, each claimed explicitly.
- **Starter products** — editor, agent, rendering, defaults and refinement
  checks. Not conformance; still blocking in CI and reported separately.

Fixture directories are named by content (`documents/`, `calc/`,
`starter/editor/`, `starter/agent/`); ownership comes from the
corpus index, not the directory name. A `malformed/`
subdirectory (where applicable) holds deliberately-invalid fixtures whose
`expected.json` declares which validator codes the parser must surface.

## Governance and process

- [`GOVERNANCE.md`](GOVERNANCE.md) — BDFL model with RFC pipeline.
  Editorial-vs-normative split is the central distinction.
- [`docs/rfcs/`](docs/rfcs/) — RFC drafts. Numbered sequentially;
  the [`0000-template.md`](docs/rfcs/0000-template.md) carries the
  required sections.
- [`CHANGELOG.md`](CHANGELOG.md) — Keep a Changelog format. The
  project uses semver-per-surface (format, protocol, and each
  package each carry an independent version). See
  [`VERSIONS.md`](VERSIONS.md) for the compatibility matrix.
- [`SECURITY.md`](SECURITY.md) — disclosure policy (5-day ack,
  90-day fix target).
- [`.github/CODEOWNERS`](.github/CODEOWNERS) routes spec, schema,
  and reference-library paths to the BDFL.
- [`.github/workflows/`](.github/workflows/) — CI runs lint + test
  + conformance + schema validation on each push; release publishes
  on `v*` tags.

## Dependency rules

These constraints exist to keep the boundaries clean:

1. **Spec depends on nothing.** Any spec change requires an RFC
   regardless of whether implementations follow.
2. **`@uwmd/core` keeps transport logic dependency-light.** Runtime dependencies
   are `@anthropic-ai/sdk` (excluded from `browser`), `fast-xml-parser`, and
   `fflate`; HTTP/MCP adapters introduce no server-SDK dependency.
3. **Tools depend on `@uwmd/core`** plus their own UI/runtime stack.
   Tools MUST NOT reach into other tools' code.
4. **Conformance fixtures depend on nothing.** They are pure data and
   are versioned alongside the spec they exercise.

Violating any of these breaks the layering and is grounds for blocking
a PR.

## Where to start contributing

| Goal | Start here |
|---|---|
| Fix a parser bug | `packages/uwmd-core/src/parser.ts` + `parser.test.ts` |
| Add a validator check | `packages/uwmd-core/src/validator.ts` (register code in `BUILTIN_REMEDIATIONS`) |
| Add a calc builtin | `packages/uwmd-core/src/calc/builtins.ts` + `calc.test.ts`, then update `excel-emit.ts` so the Excel translation matches |
| Propose a spec change | Open an RFC under `docs/rfcs/` using the template |
| Add a conformance fixture | `conformance/documents/`, `calc/` or `starter/*/` `fixtures/` plus matching `expected/` |
| Improve docs | Either `tools/docs-site/` or the spec/governance markdown at repo root (the docs site rebuilds from these) |
