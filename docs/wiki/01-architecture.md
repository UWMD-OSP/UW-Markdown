# 01 — Architecture

## The five layers

The project is a stack of five layers, each consuming the one above it. This is
the single most important diagram in the repo (also in [`ARCHITECTURE.md`](../../ARCHITECTURE.md)):

```
┌──────────────────────────────────────────────────────────────┐
│  Spec (normative text)   spec/UW_FORMAT_SPEC_v1.md             │  defines the
│                          spec/UW_PROTOCOL_v1.md                │  contract
│                          spec/schemas/*.schema.json            │
└──────────────────────────────────────────────────────────────┘
                         ▲ implements
┌──────────────────────────────────────────────────────────────┐
│  Reference library      packages/uwmd-core  (@uwmd/core)       │  the heart
│   parser · validator · editor · renderer · runner · compactor  │
│   calc/ · packs/ · agents/ · protocol · context · cascade …    │
└──────────────────────────────────────────────────────────────┘
                         ▲ used by
┌──────────────────────────────────────────────────────────────┐
│  Tools                  packages/uwmd-cli   (uwmd CLI)         │  user-facing
│                         packages/uwmd-excel (.uw.md → .xlsx)   │
│                         tools/web-viewer / web-editor          │
│                         tools/vscode-uwmd / docs-site          │
└──────────────────────────────────────────────────────────────┘
                         ▲ certified by
┌──────────────────────────────────────────────────────────────┐
│  Conformance corpus     conformance/tier-1-reader … tier-4     │  trust anchor
└──────────────────────────────────────────────────────────────┘
                         ▲ governed by
┌──────────────────────────────────────────────────────────────┐
│  Governance             GOVERNANCE.md · docs/rfcs/ · CODEOWNERS │  process
└──────────────────────────────────────────────────────────────┘
```

## The standard and the starter products

[RFC 0078](../rfcs/0078-protocol-is-verification.md) (accepted 2026-10-10,
Protocol 3.0 contract, unreleased) splits the repo into two layers:

- **The standard** — the format, the verification Protocol, receipts, the module
  system and the representation specs. It defines how any party *verifies* a
  document: well formed, internally consistent, reproducible.
- **The starter products** — the tools given away on top of it: calc engine and
  packs, editor, viewer and report renderer, Excel exporter, defaults and the
  cascade, refinement, Bancroft agents. Their behavior is described
  non-normatively in [`docs/starter/`](../starter/README.md) and versions with
  the packages only.

The Protocol defines two conformance tiers (`UW_PROTOCOL_v1.md` Part II, typed
in `protocol.ts` as `ConformanceTier`) and six optional profiles
(`ConformanceProfile`):

Tier | What it does | Reference impl
---|---|---
**Reader** | Parse and check well-formedness, read-only | `parser.ts`, `validator.ts`
**Verifier** | Reader + Format validation, metric reproduction, the stated-figure verifiers, receipts | `validator.ts`, `calc/`, the stated-figure verifiers, `receipts.ts`

Profiles: `module`, `integrity`, `representations`, `portfolio`, `sensitivity`,
`stochastic`. A tool declares its tier and profiles in an
`ImplementationManifest` (`protocol.ts`); the reference claims `verifier` with
all six.

The four Protocol 2.x tiers (Reader, Editor, Calc Host, Agent Host; the
`ViewerTier` type) are retired as implementation tiers. Their manifest values
stay readable, deprecated, during 3.x: tier-1 and tier-2 → reader, tier-3 and
tier-4 → verifier (2.x Tier 4 included Tier 3), with the editor and agent-host
claims kept as non-normative starter-product claims
(`readConformanceTier` in `protocol.ts`). Module manifests keep `requires_tier`
in the 2.x vocabulary. The corpus directories keep their 2.x names until the
corpus is re-tiered (RFC 0078 phase 3).

## Repository map

```
spec/                      Normative specs + JSON Schemas + XML XSD
  UW_FORMAT_SPEC_v1.md     File shape: frontmatter, 21 standard sections (§4.0-4.20),
                           extension meta-spec (§4.21), gaps (§4.22), CC-NN checks
  UW_PROTOCOL_v1.md        Verification: tiers + profiles, provenance rules, calc EBNF, verifiers
  UW_XML_MAPPING_v1.md     Deterministic Envelope 1.0 XML representation
  UW_CSV_BUNDLE_v1.md      Normalized CSV directory/ZIP representation
  bindings/                HTTP/MCP profiles + OpenAPI 3.1 contract
  schemas/                 JSON Schema 2020-12 plus structural UW XML XSD

packages/
  uwmd-core/   (@uwmd/core 1.1.0)  The reference library — see 03-core-library.md
  uwmd-cli/    (uwmd 1.1.0)        Thin npx wrapper over @uwmd/core's cli.ts
  uwmd-excel/  (@uwmd/excel 0.2.0) .uw.md → .xlsx workbook (formulas, not values)

tools/
  web-viewer/   Single-file (<500 LOC) drag-drop Tier-1 reader, no build
  web-editor/   Vite app, Tier-2/3 calc-aware editor (no framework)
  vscode-uwmd/  Authoring extension (syntax, folding, on-save validation)
  docs-site/    VitePress site assembling spec + protocol + governance

conformance/    tier-1-reader … tier-4-agent-host fixtures + expected outputs
scripts/        run-conformance.mjs, regen-conformance.mjs, validate-schemas.mjs
examples/       Sample .uw.md deal files (Parkview is the canonical fixture)
docs/           GLOSSARY.md, TOOLS.md, rfcs/, starter/ (non-normative starter guide), and this wiki/
```

## Dependency rules (enforced — violating these blocks a PR)

From `ARCHITECTURE.md`, restated because agents break these most often:

1. **Spec depends on nothing.** Any spec change requires an RFC (`docs/rfcs/`).
2. **`@uwmd/core` keeps transport logic dependency-light.** Runtime dependencies
   are `fast-xml-parser` and `fflate`. `@anthropic-ai/sdk` is an **optional peer
   dependency** — needed only by the reference Anthropic provider, loaded
   dynamically on the first request, and excluded from `@uwmd/core/browser`.
   HTTP/MCP adapters add no server SDK.
3. **Tools depend on `@uwmd/core`** (browser entry where applicable) plus their
   own UI/runtime stack. **Tools MUST NOT reach into other tools' code.**
4. **Conformance fixtures depend on nothing.** They are pure data, versioned
   alongside the spec they exercise.

## The data-flow story (how a deal moves through the system)

1. A `.uw.md` file is **parsed** (`parseUWFile`) into a `ParsedUWFile` —
   frontmatter + sections (each a JSON block with `_meta` provenance) + prose +
   pipeline log + superseded history.
2. It is **validated** (`validateUWFile`) against cross-section consistency
   (CC-NN), financial thresholds (FV-NN), and data-quality rules (DQ-NN).
3. **Optional Bancroft reference agents** (Tier-4) read curated context, call Claude, and write
   structured section blocks back — *extracting data, never computing financials*.
4. **Derived metrics** (cap rate, DSCR, LTV, …) are computed **deterministically**
   by the calc engine from the multifamily pack — same formulas, every tool.
5. The same formulas are **emitted as Excel** by `@uwmd/excel` so a workbook
   stays in lock-step with the calc engine (parity tested as exact equality).
6. Edits go through the **Tier-2 editor** which supersedes (append-only) or
   replaces blocks while preserving bytes outside the edited region.

## The invariants in one breath

(Full detail in [10 — Conventions & invariants](10-conventions-invariants.md).)

- **Deterministic calc boundary** — AI never does financial math.
- **Layering** — spec→∅, core→SDK only (excluded from browser), tools→core only.
- **Byte preservation** — Tier-2 edits don't reflow unrelated regions.
- **Excel ↔ evaluator parity** — both paths agree exactly (one pack; both
  quantize at the same `round_to`, §VIII.5).
- **Append-only provenance** — supersede, don't destroy; every block carries `_meta`.
- **Semver-per-surface** — format, protocol, and each package version independently.
