# Architecture

This document describes how the UW Markdown repository is organized so
contributors can navigate it without reverse-engineering from commit
history. For *what* the format is and *why* it's designed the way it
is, see [`spec/UW_FORMAT_SPEC_v1.md`](spec/UW_FORMAT_SPEC_v1.md),
[`spec/UW_PROTOCOL_v1.md`](spec/UW_PROTOCOL_v1.md), and the representation
mappings such as [`spec/UW_XML_MAPPING_v1.md`](spec/UW_XML_MAPPING_v1.md).

## The big picture

The project has five layers, each consuming the one above it:

```
┌─────────────────────────────────────────────────────────────┐
│  Format spec      spec/UW_FORMAT_SPEC_v1.md                 │  normative
│  (file shape)     spec/UW_PROTOCOL_v1.md                    │  text
│                   spec/schemas/*.schema.json                │
└─────────────────────────────────────────────────────────────┘
                          ▲
                          │ implements
┌─────────────────────────────────────────────────────────────┐
│  Reference        packages/uwmd-core (@uwmd/core)           │  TypeScript
│  library          ├── parser / validator / renderer          │  library
│                   ├── editor (Tier-2 dispatcher)             │
│                   ├── calc/  (parser, evaluator, builtins)   │
│                   ├── packs/ (multifamily, excel-emit)       │
│                   └── agents/ (Bancroft / Tier-4)            │
└─────────────────────────────────────────────────────────────┘
                          ▲
                          │ used by
┌─────────────────────────────────────────────────────────────┐
│  Tools            packages/uwmd-cli   (standalone CLI)       │  user-facing
│                   packages/uwmd-excel (.uw.md → .xlsx)       │
│                   tools/web-viewer    (Tier-1 drag-drop)     │
│                   tools/web-editor    (Tier-2/3 calc-aware)  │
│                   tools/vscode-uwmd   (authoring extension)  │
│                   tools/docs-site     (VitePress docs)       │
└─────────────────────────────────────────────────────────────┘
                          ▲
                          │ certified by
┌─────────────────────────────────────────────────────────────┐
│  Conformance      conformance/tier-1-reader                  │  fixtures +
│  corpus           conformance/tier-2-editor                  │  expected
│                   conformance/tier-3-calc-host               │  outputs
│                   conformance/tier-4-agent-host              │
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

- [`spec/UW_FORMAT_SPEC_v1.md`](spec/UW_FORMAT_SPEC_v1.md) — file shape:
  frontmatter, the 21 standard sections, supersede semantics, the
  cross-section consistency rules (`CC-NN`).
- [`spec/UW_PROTOCOL_v1.md`](spec/UW_PROTOCOL_v1.md) — what conforming
  software must do: the four conformance tiers, display conventions,
  edit semantics, calc-engine grammar (EBNF), AI-host contract.
- [`spec/UW_XML_MAPPING_v1.md`](spec/UW_XML_MAPPING_v1.md) — deterministic
  Envelope 1.0 mapping, namespace, integrity, and secure decoding rules.
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
| `editor.ts` | Tier-2 dispatcher: `applyEdit()` over four operation types, gated by `BUILTIN_EDIT_POLICIES`. |
| `renderer.ts` | HTML / Markdown rendering paths. PDF/DOCX are stubs deferred to a third-party pipeline. |
| `runner.ts` + `agents/` | Tier-4 host. `runBancroftAgent` is the Claude-backed reference implementation; the contract in `protocol.ts` §IX is provider-neutral. |
| `calc/` | `parser.ts` (recursive-descent), `evaluator.ts` (AST walker), `builtins.ts` (financial + math primitives). The evaluator is sandboxed: capped input, no globals, no I/O. |
| `packs/` | `multifamily.ts` is the canonical Tier-3 calc pack. `excel-emit.ts` translates the same AST to Excel formulas — and `packs.test.ts` asserts the two paths agree to six decimals. |
| `protocol.ts` | `BUILTIN_VIEW_MODELS`, `BUILTIN_EDIT_POLICIES`, the AI-host contract types. |
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
  multifamily pack as the calc host so formulas in the workbook match
  evaluator output.
- `tools/web-viewer` — single-file drag-drop reader. Tier 1.
- `tools/web-editor` — calc-aware editor demonstrating Tier 2 + Tier 3.
- `tools/vscode-uwmd` — authoring extension (syntax, validation
  squiggles, calc-pack hover).
- `tools/docs-site` — VitePress site that assembles spec + protocol +
  schemas + conformance + governance. A prebuild step keeps repo-root
  markdown as the single source of truth.

## Conformance corpus

[`conformance/`](conformance/) is the trust anchor for third parties.
[`scripts/run-conformance.mjs`](scripts/run-conformance.mjs) drives
the four tiers:

- **Tier 1 (Reader)** — byte-exact comparison of parser/render output
  against `expected/`.
- **Tier 2 (Editor)** — round-trip edits must preserve bytes outside
  the modified region.
- **Tier 3 (Calc Host)** — calc evaluator output compared against
  recorded expected values.
- **Tier 4 (Agent Host)** — shape assertions only; LLM nondeterminism
  rules out byte equality.

A `malformed/` subdirectory under each tier (where applicable) holds
deliberately-invalid fixtures whose `expected.json` declares which
validator codes the parser must surface.

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
2. **`@uwmd/core` depends only on `@anthropic-ai/sdk`** at runtime
   (and the SDK is excluded from the `browser` entry).
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
| Add a conformance fixture | `conformance/tier-N-*/fixtures/` plus matching `expected/` |
| Improve docs | Either `tools/docs-site/` or the spec/governance markdown at repo root (the docs site rebuilds from these) |
