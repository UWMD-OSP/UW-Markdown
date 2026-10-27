# AGENTS.md — UW Markdown contributor guide

This guide applies to every coding agent and contributor. Read the
[developer wiki](docs/wiki/README.md) for non-trivial work and any package's
local guidance before editing it. `CLAUDE.md` entry files import this guide.

## Scope and contracts

UW Markdown is an open underwriting document standard and reference toolkit:
a library, specifications and static tools. It has no Express server or database.
Producing applications remain separate from the vendor-neutral standard.

The normative standard comprises the Format, verification Protocol, receipts,
module system, representations/bindings and `spec/metrics/` dictionary.
Conformance has Reader and Verifier tiers plus optional profiles. A verifier
can implement the standard without the starter toolkit (RFC 0078).

The non-normative starter products include calc-engine code, packs, defaults,
editing, rendering, Excel export and CLI tooling; see [docs/starter](docs/starter/README.md).
Every official asset class is a full builtin on both sides (RFC 0080).
Modules are third-party extensions. The toolkit hosts no agents; generic agent
provenance, integrity, receipts, edit APIs and transport interoperability remain.

## Prelaunch policy

5.0.0 is reserved for the official public launch. Every `@uwmd` npm package
launches at 5.0.0 together; prelaunch releases use 4.x.x and may include
incompatible changes. Before 5.0 there is no backward compatibility: do not add
compatibility layers, migration/deprecation paths, consumer-breakage analyses,
version-bump recommendations or preservation/repair work for prelaunch artifacts.
Current RFC, deterministic verification, conformance and source-integrity
requirements remain. A 5.0.0 launch requires separate explicit project owner approval.

## Source map

- `packages/uwmd-verify`: reference Reader/Verifier, validation, evaluator,
  dictionary, receipts, integrity, modules and profiles; no `@uwmd/*` dependency.
- `packages/uwmd-core`: starter library; pins and re-exports verify's whole API.
- `packages/uwmd-cli`, `uwmd-excel`, `uwmd-signing`, `uwmd-batch`, `uwmd-report`:
  CLI, workbooks, signing, collections and reports.
- `packages/uwmd-lake`: SQL/JSONB projection planning without a database driver.
- `tools/`: editor, viewer, VS Code extension and documentation site.
- `spec/`, `conformance/`, `docs/rfcs/`: contracts, executable cases and design record.

Public APIs are each library's `src/index.ts`; browser tools use the browser
entry point. `packages/uwmd-verify/src/protocol.ts` mirrors the Protocol.
Use [VERSIONS](VERSIONS.md) for current versions and publication state.

## Invariants

Numbers are fixed because source comments cite them.

1. **AI never does financial math.** Extract facts and write narrative;
   deterministic calc/pack code computes financial results.
2. **Layering:** spec depends on nothing; verify has no `@uwmd/*` or vendor SDK
   dependency; core depends on verify without a vendor SDK; tools never import other tools.
3. **Editor byte preservation:** edits preserve bytes outside the edited region.
4. **Exact Excel/evaluator parity:** one pack drives both; unrounded binary64,
   then one `round_to` quantization, half away from zero (Protocol §VIII.5).
5. **Append-only provenance:** supersede rather than destroy; the host owns `_meta`.
6. **Separate versions:** Format and Protocol are distinct surfaces; package
   publication follows the prelaunch policy above.
7. **Lockstep contracts:** Protocol types, schemas and normative text change
   together; dictionary definitions and pack entries agree exactly.
8. **Workspace isolation:** every `@uwmd/*` import resolves through local workspace links.
9. **Descriptive identity:** `scenario` and `asset_subtype` never select
   calculations, defaults, packs or rules (Format §2.2b).

## Implementation

Use TypeScript and ESM, with `.js` extensions on relative NodeNext imports.
Rates are fractions (`0.0551` = 5.51%); display is the conversion boundary.
Export public symbols through `src/index.ts` and browser-safe entries as applicable.
Use typed errors such as `ProtocolError`, `CalcError` and `ExcelEmitError`.
Vitest tests live beside their sources; Biome is lint-only.

Browser tools import `@uwmd/core/browser` or `@uwmd/verify/browser`.
The docs site's prebuild copies repository source Markdown and rewrites links;
edit those sources. The contributor wiki is separate from the published site nav.
Tool/package guidance and [wiki 08](docs/wiki/08-tools.md) describe their entry points.

## Changes and validation

Keep one PR to one topic, including relevant tests, documentation and an
`[Unreleased]` changelog entry. Normative changes require an RFC and synchronized
specification, schema, implementation and conformance updates. Decide routine
questions from accepted contracts and record the decision and precedent in the PR.
Unsettled financial conventions, normative format decisions and new external
dependencies require maintainer approval; never guess at numerical rules.

Before a PR, run:

```bash
npm run build
npm test
npm run typecheck:tests
npm run conformance
```

Build before conformance, which imports `dist/`. Run affected guards:
`validate-schemas`, `verify-packages`, `verify-lockfile`, `verify-versions`,
`verify-indexes`, `verify-codes`, `verify-release`, and `lint`.
Run `npm --prefix tools/docs-site run build` for docs/spec changes.
Use `npm ci` only when dependencies, lockfiles or workspace links change.
Work on an isolated branch/check-out from current main and rebase before merging.

Public content includes contracts, implementation, examples, conformance, RFCs,
contributor documentation, CHANGELOG and VERSIONS. Preparation/evidence, reviews
and status notes belong outside the public tree. Public release proof is
CHANGELOG, VERSIONS, GitHub Releases and npm provenance. Tracked-content guards
enforce public identity and language policy without directory exemptions.
