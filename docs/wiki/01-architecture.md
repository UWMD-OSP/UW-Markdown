# 01 — Architecture

## The five layers

The project is a stack of five layers, each consuming the one above it. This is
the single most important diagram in the repo (also in [`ARCHITECTURE.md`](../../ARCHITECTURE.md)):

```
┌──────────────────────────────────────────────────────────────┐
│  Spec (normative text)   spec/UW_FORMAT_SPEC.md             │  defines the
│                          spec/UW_PROTOCOL.md                │  contract
│                          spec/schemas/*.schema.json            │
└──────────────────────────────────────────────────────────────┘
                         ▲ implements
┌──────────────────────────────────────────────────────────────┐
│  Reference library      packages/uwmd-verify (@uwmd/verify)    │  the standard
│   parser · validator · calc/ · builtin-packs/ · receipts      │
│   integrity · modules · representations · protocol …          │
├──────────────────────────────────────────────────────────────┤
│  Starter toolkit        packages/uwmd-core  (@uwmd/core)       │  the heart
│   editor · renderer · runner · compactor · cascade · defaults  │
│   packs/ (Excel emit) · layer context · CLI …                  │
│   depends on @uwmd/verify exactly and re-exports all of it     │
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
│  Conformance corpus     conformance/ + corpus-index.json     │  trust anchor
└──────────────────────────────────────────────────────────────┘
                         ▲ governed by
┌──────────────────────────────────────────────────────────────┐
│  Governance             GOVERNANCE.md · docs/rfcs/ · CODEOWNERS │  process
└──────────────────────────────────────────────────────────────┘
```

## The standard and the starter products

[RFC 0078](../rfcs/0078-protocol-is-verification.md) (accepted 2026-10-10,
the Protocol 3.0 contract) splits the repo into two layers:

- **The standard** — the format, the verification Protocol, receipts, the module
  system and the representation specs. It defines how any party *verifies* a
  document: well formed, internally consistent, reproducible.
- **The starter products** — the tools given away on top of it: calc engine and
  packs, editor, viewer and report renderer, Excel exporter, defaults and the
  cascade, refinement, the Bancroft layer registry. Their behavior is described
  non-normatively in [`docs/starter/`](../starter/README.md) and versions with
  the packages only.

The Protocol defines two conformance tiers (`UW_PROTOCOL.md` Part II, typed
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

`reader` and `verifier` are the only tier values (`isConformanceTier` in
`protocol.ts`); the Protocol 2.x tier names are not read. Editor behavior is a
non-normative starter-product claim; the reference toolkit hosts no agents. Module manifests declare
`requires_conformance` and optional `requires_profiles` in the same
vocabulary. The re-tiered corpus retains its historical
directory names until RFC 0081 Phase 5 renames them.

## Repository map

```
spec/                      Normative specs + JSON Schemas + XML XSD
  UW_FORMAT_SPEC.md     File shape: frontmatter, 21 standard sections (§4.0-4.20),
                           extension meta-spec (§4.21), gaps (§4.22), CC-NN checks
  UW_PROTOCOL.md        Verification: tiers + profiles, provenance rules, calc EBNF, verifiers
  UW_XML_MAPPING.md     Deterministic Envelope 1.0 XML representation
  UW_CSV_BUNDLE.md      Normalized CSV directory/ZIP representation
  UW_RECEIPT.md         Verification receipts
  metrics/                 Normative metric dictionary (builtin.json)
  bindings/                HTTP/MCP profiles + OpenAPI 3.1 contract
  schemas/                 JSON Schema 2020-12 plus structural UW XML XSD

packages/
  uwmd-verify/ (@uwmd/verify)      The reference implementation of the standard (RFC 0083)
  uwmd-core/   (@uwmd/core)        The starter toolkit on verify — see 03-core-library.md
  uwmd-cli/    (uwmd 1.1.0)        Thin npx wrapper over @uwmd/core's cli.ts
  uwmd-excel/  (@uwmd/excel 0.2.0) .uw.md → .xlsx workbook (formulas, not values)

tools/
  web-viewer/   Single-file (<500 LOC) drag-drop Reader, no build (starter product)
  web-editor/   Vite app, calc-aware editor (starter product, no framework)
  vscode-uwmd/  Authoring extension (syntax, folding, on-save validation)
  docs-site/    VitePress site assembling spec + protocol + governance

conformance/    Fixture families + expected outputs; corpus-index.json owns each case
                (reader, verifier, profiles, starter products). tier-N dirs are legacy names
scripts/        run-conformance.mjs, regen-conformance.mjs, validate-schemas.mjs
examples/       Sample .uw.md deal files (Parkview is the canonical fixture)
docs/           GLOSSARY.md, TOOLS.md, rfcs/, starter/ (non-normative starter guide), and this wiki/
```

## Dependency rules (enforced — violating these blocks a PR)

From `ARCHITECTURE.md`, restated because agents break these most often:

1. **Spec depends on nothing.** Any spec change requires an RFC (`docs/rfcs/`).
2. **The library keeps transport logic dependency-light.** `@uwmd/verify`'s
   runtime dependencies are `fast-xml-parser` and `fflate`, and it depends on no
   `@uwmd/*` package. `@uwmd/core` depends on `@uwmd/verify` exactly and imports
   it only through its public entry. Neither package takes a vendor SDK, and
   HTTP/MCP adapters add no server SDK.
3. **Tools depend on the library** — `@uwmd/core`, or `@uwmd/verify` alone
   when they only read and verify (browser entry where applicable) — plus their
   own UI/runtime stack. **Tools MUST NOT reach into other tools' code.**
4. **Conformance fixtures depend on nothing.** They are pure data, versioned
   alongside the spec they exercise.

## The data-flow story (how a deal moves through the system)

1. A `.uw.md` file is **parsed** (`parseUWFile`) into a `ParsedUWFile` —
   frontmatter + sections (each a JSON block with `_meta` provenance) + prose +
   pipeline log + superseded history.
2. It is **validated** (`validateUWFile`) against cross-section consistency
   (CC-NN), financial thresholds (FV-NN), and data-quality rules (DQ-NN).
3. **Agents run by a host** (outside this toolkit, which runs none) read
   curated context and write structured section blocks back through the
   generic writers or the edit API — *extracting data, never computing
   financials*.
4. **Derived metrics** (cap rate, DSCR, LTV, …) are computed **deterministically**
   by the calc engine from the asset class's pack — same formulas, every tool.
   The packs mirror the normative [metric dictionary](../../spec/metrics/README.md),
   which is what a third-party Verifier reproduces without our engine.
5. The same formulas are **emitted as Excel** by `@uwmd/excel` so a workbook
   stays in lock-step with the calc engine (parity tested as exact equality, a
   starter-product quality bar).
6. Edits go through the **reference editor** which supersedes (append-only) or
   replaces blocks while preserving bytes outside the edited region.

## The invariants in one breath

(Full detail in [10 — Conventions & invariants](10-conventions-invariants.md).)

- **Deterministic calc boundary** — AI never does financial math.
- **Layering** — spec→∅, verify→no `@uwmd/*`, core→verify + optional SDK (excluded from browser), tools→core or verify only.
- **Byte preservation** — editor edits don't reflow unrelated regions (starter product).
- **Excel ↔ evaluator parity** — both paths agree exactly (one pack; both
  quantize at the same `round_to`, §VIII.5); a starter-product quality bar.
- **Append-only provenance** — supersede, don't destroy; every block carries `_meta`.
- **Semver-per-surface** — format, protocol, and each package version independently.
