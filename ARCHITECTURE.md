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
│  Reference        packages/uwmd-verify (@uwmd/verify)       │  TypeScript
│  implementation   ├── parser / validator / receipts          │  library:
│  of the standard  ├── calc/  (parser, evaluator, builtins)   │  the standard
│                   └── builtin-packs/ (12 builtin packs)      │
├─────────────────────────────────────────────────────────────┤
│  Starter toolkit  packages/uwmd-core (@uwmd/core)           │  re-exports
│                   ├── editor (starter edit dispatcher)       │  verify
│                   ├── renderer / report / cascade / defaults │
│                   ├── packs/ (excel-emit)                    │
│                   └── context (layer registry; no agents)    │
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

## Reference library: `@uwmd/verify` and `@uwmd/core`

[`packages/uwmd-verify/src`](packages/uwmd-verify/src/) is the canonical
TypeScript implementation of the standard (RFC 0083): everything a party needs
to read and verify a document. [`packages/uwmd-core/src`](packages/uwmd-core/src/)
is the starter toolkit on top of it; it depends on `@uwmd/verify` at an exact
version and re-exports its whole surface. All file-level operations route
through this library; tools depend on it. The table names the package of each
module.

| File | Responsibility |
|---|---|
| `parser.ts` (verify) | `.uw.md` → `ParsedUWFile` (frontmatter + sections + `_meta`). |
| `validator.ts` (verify) | Cross-section + financial-validity + meta-integrity checks. Hosts `BUILTIN_REMEDIATIONS`, the registry referenced by protocol §III.6a. |
| `editor.ts` (core) | Starter-product edit dispatcher: `applyEdit()` over four operation types, gated by `BUILTIN_EDIT_POLICIES`. |
| `bindings.ts` (verify) + `bindings-edit.ts` (core) | HTTP negotiation/ETags and MCP resource/tool-result adapters over the shared codecs; core injects its editor for source edits. |
| `renderer.ts` (core) | HTML / Markdown rendering paths. PDF/DOCX are stubs deferred to a third-party pipeline. |
| `runner.ts` (core) | Writer API; generic metadata is supplied by verify's `buildMeta`. Generic editing and initialization import metadata directly from verify. |
| `calc/` (verify) | `parser.ts` (recursive-descent), `evaluator.ts` (AST walker), `builtins.ts` (financial + math primitives). The evaluator is sandboxed: capped input, no globals, no I/O. |
| `builtin-packs/` (verify) + `packs/` (core) | One pack manifest per builtin asset class in `builtin-packs/` (standard data), each equal to its normative `spec/metrics/` entries (`metric-dictionary.test.ts`); `packs/` re-exports them. `packs/excel-emit.ts` translates the same AST to Excel formulas, and the pack tests assert the two paths agree exactly after §VIII.5 quantization (a starter-product quality bar). |
| `protocol.ts` (verify) | The normative contract types, `BUILTIN_EDIT_POLICIES`, `BUILTIN_REMEDIATIONS`, version constants. |
| `starter-protocol.ts` (core) | Starter tables: `BUILTIN_VIEW_MODELS`, number formats, `CASCADE_ORDER` and the capability-token types (RFC 0083). |
| `format.ts` (core) | Field-level formatters (currency, percent, multiple, etc.) used by view models. |
| `context.ts` (core) | `BANCROFT_LAYERS` definitions and the agent context and prompt builders. The toolkit hosts no agents: a host runs its own and writes through `runner.ts` or the editor. The [starter guide](docs/starter/ai-host.md) describes this non-normative surface. |
| `compactor.ts` (core) | Materializes "live view" by collapsing superseded blocks. |
| `init.ts` (core) | Scaffold a new `.uw.md` from defaults. |
| `cli.ts` (core) | Programmatic CLI entry; surfaced via `uwmd-cli`. |
| `browser.ts` (both) | Subpath export excluding Node-only starter code so the parser/validator/calc engine can be bundled into a web app. Verify's equals its main entry; core's adds the browser-safe starter products. |

## Tools layer

Each tool depends on `@uwmd/core`, or only `@uwmd/verify` when it reads and
verifies without editing or rendering (browser entry where applicable), and
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
- **Starter products** — editor, layer-profile, rendering, defaults and refinement
  checks. Not conformance; still blocking in CI and reported separately.

Fixture directories are named by content (`documents/`, `calc/`,
`starter/editor/`, `starter/agent/`); ownership comes from the
corpus index, not the directory name. A `malformed/`
subdirectory (where applicable) holds deliberately-invalid fixtures whose
`expected.json` declares which validator codes the parser must surface.

## Governance and process

- [`GOVERNANCE.md`](GOVERNANCE.md) — owner-led model with RFC pipeline.
  Editorial-vs-normative split is the central distinction.
- [`docs/rfcs/`](docs/rfcs/) — RFC drafts. Numbered sequentially;
  the [`0000-template.md`](docs/rfcs/0000-template.md) carries the
  required sections.
- [`CHANGELOG.md`](CHANGELOG.md) — Keep a Changelog format. The
  project uses semver-per-surface (format, protocol, and each
  package each carry an independent version). See
  [`VERSIONS.md`](VERSIONS.md) for the version matrix.
- [`SECURITY.md`](SECURITY.md) — disclosure policy (5-day ack,
  90-day fix target).
- [`.github/CODEOWNERS`](.github/CODEOWNERS) routes spec, schema,
  and reference-library paths to the project owner.
- [`.github/workflows/`](.github/workflows/) — CI runs lint + test
  + conformance + schema validation on each push; release publishes
  on `v*` tags.

## Dependency rules

These constraints exist to keep the boundaries clean:

1. **Spec depends on nothing.** Any spec change requires an RFC
   regardless of whether implementations follow.
2. **The library keeps transport logic dependency-light.** `@uwmd/verify`'s
   runtime dependencies are `fast-xml-parser` and `fflate`, and it depends on
   no `@uwmd/*` package. `@uwmd/core` adds `@uwmd/verify` (exact) and no
   vendor SDK; HTTP/MCP adapters introduce no server-SDK dependency.
3. **Tools depend on `@uwmd/core` or `@uwmd/verify`** plus their own UI/runtime stack.
   Tools MUST NOT reach into other tools' code.
4. **Conformance fixtures depend on nothing.** They are pure data and
   are versioned alongside the spec they exercise.

Violating any of these breaks the layering and is grounds for blocking
a PR.

## Where to start contributing

| Goal | Start here |
|---|---|
| Fix a parser bug | `packages/uwmd-verify/src/parser.ts` + `parser.test.ts` |
| Add a validator check | `packages/uwmd-verify/src/validator.ts` (register code in `BUILTIN_REMEDIATIONS`) |
| Add a calc builtin | `packages/uwmd-verify/src/calc/builtins.ts` + `calc.test.ts`, then update `excel-emit.ts` so the Excel translation matches |
| Propose a spec change | Open an RFC under `docs/rfcs/` using the template |
| Add a conformance fixture | `conformance/documents/`, `calc/` or `starter/*/` `fixtures/` plus matching `expected/` |
| Improve docs | Either `tools/docs-site/` or the spec/governance markdown at repo root (the docs site rebuilds from these) |
