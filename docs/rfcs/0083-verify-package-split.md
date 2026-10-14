---
rfc: 0083
title: 'Split @uwmd/verify, the reference implementation of the standard, out of @uwmd/core'
status: implemented
accepted: 2026-10-13
implemented: 2026-10-13
author: claude-code (agent proposal, from owner decision RFC 0078 D8)
created: 2026-10-13
depends_on:
  - 0016
  - 0078
  - 0081
affects:
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0083: Split `@uwmd/verify`, the reference implementation of the standard, out of `@uwmd/core`

**Accepted 2026-10-13** under the owner's RFC 0078 decision D8 ("Split later:
a small `@uwmd/verify` reference implementation of the standard, with
`@uwmd/core` as the starter toolkit on top that still re-exports it. Separate
follow-up."). This RFC fixes the boundary and the open implementation
questions. It changes no normative text, so neither the Format (3.0) nor the
Protocol (4.0.0) version moves. **Implemented; released and independently
verified.** The `v4.1.0` release published `@uwmd/verify` 0.1.0 and core/CLI
4.1.0 with Stable Protocol 4.0.0 and Format 3.0 (see
[Publication and verification](#publication-and-verification-2026-10-13)).

## Summary

Publish a new package, `@uwmd/verify`, that contains everything a party needs
to read and verify a `.uw.md` document and nothing it does not: the reader,
validation, the safe-expression evaluator and quantization, stated-precision
comparison, the metric dictionary, receipts, integrity, the module system,
and the optional verification profiles (representations, portfolio,
sensitivity, stochastic). `@uwmd/core` becomes the starter toolkit (defaults,
cascade, refinement, editor, renderer, report, display formatting, Excel
emission, agents, CLI) built on top of it. Core depends on `@uwmd/verify` at
an exact version and re-exports its whole surface, so no existing import of
`@uwmd/core` or `@uwmd/core/browser` breaks.

## Motivation

RFC 0078 drew the line between the standard and the starter products in the
specs. The packages do not yet follow that line:

- **The boundary test is not executable.** RFC 0078's test is that a lender can
  verify a `.uw.md` from any producer using only the standard. Today the only
  code that does this is `conformance/metrics/verifier.mjs`, a conformance
  script that imports deep `dist/` files from core and is not published.
  An adopter who wants a verifier has to install all of core: editor, cascade,
  defaults, agents and the Anthropic provider loader included.
- **Seven imports cross from standard code into starter code** (mapped
  2026-10-13 over the 68-file closure of the standard modules; the seventh,
  `validator.ts` → `gaps.ts`, was found in Phase 1):

  | Edge | Symbol | Effect |
  |---|---|---|
  | `receipts.ts` → `packs/index.ts` | `getPackForAssetClass` | receipt issue and verify |
  | `builtin-class-validation.ts` → `packs/index.ts` | `getPackForAssetClass` | every `validateUWFile` |
  | `calc/index.ts` → `format.ts` | `format*` | the optional `display` string of every `evaluateCalc` |
  | `lite-bridge.ts` → `runner.ts` | `buildMeta` | reaches the validator and receipts |
  | `bindings.ts` → `editor.ts` | `applyEditAsync` | drags in editor, runner, gaps |
  | `market-data.ts` → `cascade.ts` | `type MarketDataLookup` | type only |
  | `validator.ts` → `gaps.ts` | `readGapsContent` | the DQ rules of every `validateUWFile` |

- **`protocol.ts` mixes both sides.** About 420 of its 3,284 lines are starter
  material: display and badges, view models (`BUILTIN_VIEW_MODELS`), the
  cascade order, the agent host and capability tokens (RFC 0078 D10, D11). The
  view-model types `SectionViewModel` and `FieldViewHint` and the type
  `CascadeStep` stay normative: module manifests declare `view_models`, and
  `GapAction` names a cascade step.
- **The browser entry cannot verify integrity.** `verifyChain`,
  `verifyProvenance` and `computeBlockHash` are exported only from `index.ts`
  although `integrity.ts` already falls back to Web Crypto.

## Proposed change

### 1. The package

`packages/uwmd-verify`, published as `@uwmd/verify`, ESM only, with two
entries: `.` (Node) and `./browser` (no static `node:` imports; integrity's
SHA-256 loads `node:crypto` through a dynamic import guarded by a runtime check
for Node and uses Web Crypto everywhere else, so a browser never evaluates it).
Its runtime dependencies are `fast-xml-parser` and `fflate`, which move from
core (both are used only by the representations codecs). It has no optional
peers. The Phase 1 closure test allows exactly these packages and that one
guarded site.

It contains the modules the 2026-10-13 map classified as standard:

- **Reader:** `parser`, `yaml-scalar`, `types`, `scenario`, `metadata`,
  `version`, `block-roles`, `section-resolution`.
- **Validation:** `validator`, `builtin-class-content`,
  `builtin-class-validation`, `asset-class`, `period-path`, `periods`,
  `period-validation`, the lease-up, replacement-funding and reserve-account
  structure checks, and `readGapsContent`.
- **Stated-figure verifiers:** cash-flow series, the lease-up schedule,
  lease-up and property cash flows, waterfall, reserve accounts and draw
  bindings, replacement funding, capital stack, property cash-flow inputs.
- **Calculation:** the `calc/` parser, evaluator, builtins, errors,
  quantization, day count, dependencies, dated flows and stated precision.
- **Metric dictionary:** `spec/metrics/builtin.json` shipped as package data,
  and `verifyStatedMetrics` (below).
- **Receipts, integrity, modules:** `receipts`, `integrity`,
  `integrity-canonical`, `module-signing`, `modules`, `module-runtime`.
- **Profiles:** representations (envelope, codecs, UWJSON, UWXML, UWCSV, zip
  safety, Lite and the Lite bridge, source representation, composition,
  negotiation, deal packages, lease abstracts), portfolio, sensitivity,
  stochastic (with the PCG64 sampler), market data documents, and the binding
  operations that only read.
- **The normative part of `protocol.ts`**: types, error codes, edit policies,
  version constants, module manifest types and the conformance manifest
  types (`ImplementationManifest`, the tier and profile vocabularies). The
  manifest *value* `REFERENCE_IMPLEMENTATION_MANIFEST` describes `@uwmd/core`
  (`org.uwmd.core`, core's version, starter capabilities such as editing and
  agent hosting), so it stays in core with `uwmd manifest`.

Everything else stays in `@uwmd/core`.

### 2. The new verification API

`verifyStatedMetrics(parsed, options?)` evaluates every dictionary entry for
the document's asset class and compares it with the document's stated value,
returning one result per stated metric (`verified`, `failed`, or
`unverifiable` with a reason). It promotes the logic of
`conformance/metrics/verifier.mjs`, which already uses only the reader, the
evaluator and `compareStatedMetric` (RFC 0079), into the package. The
conformance fixture then imports the published function instead of deep
`dist/` paths, and its import-graph control (`conformance/metrics/controls.mjs`)
becomes a package-level closure test.

### 3. Core on top

- `@uwmd/core` adds a dependency on `@uwmd/verify` pinned to an exact version
  (the house rule for `@uwmd/*` dependents), and `src/index.ts` and
  `src/browser.ts` re-export every `@uwmd/verify` symbol they export today.
  A test asserts the re-exported names are a superset of the 4.0.x surface.
- `evaluateCalc` in verify returns no `display` string (the field is optional
  in `calc-result.schema.json`). Core's exported `evaluateCalc` adds `display`
  as today, so its callers see no change. So does core's exported
  `evaluateModuleCalculations`, whose outcomes carry `CalcResult`s.
- `bindings.ts`: the source-edit adapter stays in core and is injected into
  the binding operations; the read operations move to verify.
- `buildMeta` moves from `runner.ts` to `metadata.ts`; `MarketDataLookup`
  moves to `market-data.ts`.
- Receipts record the engine that computed them, and a verifier compares it
  with its own (UW Receipt §5.3, `RCP-07`). That engine is `@uwmd/verify`
  (`VERIFY_VERSION`) for every receipt, including those issued through core:
  naming `@uwmd/core` would make a verifier holding only `@uwmd/verify` report
  a tampered core-issued receipt as `unverifiable` instead of `failed`, which
  defeats the RFC 0078 boundary test. The `issuer` stays the tool; core's
  exported `issueReceipt` defaults it to `@uwmd/core@<CORE_VERSION>`, and core
  re-exports verify's `verifyReceipt` unchanged. The receipt baselines record
  verify's version from then on. An explicit `engine`, `engine_version` or
  `issuer` wins either way.
- The starter parts of `protocol.ts` move to a core module
  (`starter-protocol.ts`); core re-exports them under the same names.
- `@uwmd/signing` depends on `@uwmd/verify` for its payload builders. Its
  capability-token code keeps importing the `Capability*` types from core.

### Decisions

Each question was decided from precedent, per AGENTS.md.

| Question | Decision | Precedent |
|---|---|---|
| Do the builtin calc packs belong in verify? Packs are starter products under RFC 0078. | **The twelve builtin pack manifests ship in verify as data.** The Excel emitter, pack documentation and every other pack tool stay in core. | A receipt names a pack id and version, and a verifier that does not hold that pack must answer `unverifiable` (UW Receipt §5, `RCP-05`/`RCP-06`). Packs are module manifests, and the module system is normative. Every pack equals its dictionary entries by an exact parity test (RFC 0078 Phase 2). A verify package that answered `unverifiable` for every builtin receipt would fail D8's purpose. The packs' *definitions* stay normative only through the dictionary. |
| Does builtin-class validation keep evaluating packs? | Yes, unchanged, against the manifests now in verify. | RFC 0080 class rules (`CC-HOSP-*`, `MOD-CALC-ERROR`) read pack results; changing what they read is a separate change (AGENTS.md: one PR, one topic). |
| Does verify format display strings? | No. Core adds `display`. | RFC 0078 D11: display conventions are a starter guide; `display` is optional in `calc-result.schema.json`. |
| How does verify version? | Independent semver, first published as **0.1.0**. | Every package other than core/CLI versions independently (`release.yml` header); new packages start at 0.x (signing 0.1.0, lake 0.1.0). Core/CLI stay paired with `PROTOCOL_VERSION`. |
| Does core's version move? | Minor (4.1.0): new dependency, additive surface, no breaking change. | Semver per surface (invariant 6); RFC 0078 "No breaking change … the package split (D8) is a follow-up with re-exports." |
| Does verify ship a CLI? | Not in this RFC. The portable driver keeps running `uwmd`. A `uwmd-verify` bin is a follow-up. | One PR, one topic. The portable driver contract (RFC 0004) is unchanged. |
| Is this a Protocol change? | No. No document's meaning or verification changes. | Wiki 11: from 3.0 the Protocol moves only when meaning or verification changes. |

## Compatibility analysis

- **Documents:** none affected. No spec text, schema or conformance
  expectation changes.
- **`@uwmd/core` users:** none break. Every 4.0.x export remains, from both
  entries, with the same name and behavior. `browser.ts` gains the integrity
  verification exports it lacked (additive).
- **Implementers of the standard:** unaffected. The Reader and Verifier tiers
  and the six profiles are unchanged.
- **Modules:** unaffected. The manifest schema and module contract do not move.
- **Release tooling:** `check-release-readiness.mjs` assumes every package pins
  core and publishes after it. Verify publishes first and core pins it, so the
  readiness rules gain a verify-first ordering.

## Conformance impact

No fixture's expected result changes. `conformance/metrics/verifier.mjs`
switches from deep `dist/` imports to `@uwmd/verify`'s `verifyStatedMetrics`
and must still report the same 187/0/0 against the lender fixture.
`controls.mjs` keeps its import-graph assertion, now stated as: the
`@uwmd/verify` build reaches no core module.

## Reference implementation

In three phases, each its own PR:

1. **Cut the edges in place (this PR).** Inside core: move `buildMeta` and
   `MarketDataLookup`, and `readGapsContent` with the gaps content types into
   `gaps-content.ts`; split `display` out of `evaluateCalc` (starter wrappers in
   `calc-display.ts` for `evaluateCalc` and `evaluateModuleCalculations`);
   inject the bindings edit adapter (`bindings-edit.ts` wires the editor);
   split `protocol.ts` into `starter-protocol.ts`; move the builtin pack
   manifests into a standard-side module (`builtin-packs/`), with `packs/`
   re-exporting them; add `verifyStatedMetrics` with the dictionary as
   generated package data; add a closure test listing the standard module set
   and asserting that its import graph never reaches a starter module. No new
   package and no public API change except the added `verifyStatedMetrics`
   export and its types.
2. **Create the package.** Move the standard set to `packages/uwmd-verify`;
   core depends on it and re-exports; move `fast-xml-parser`/`fflate`; repoint
   signing, batch, lake and `tools/vscode-uwmd`; update the hardcoded
   workspace lists (`package.json` workspaces, `verify-lockfile`,
   `verify-versions`, `verify-packages`, `release-packages`,
   `check-release-readiness`, `release.yml`, `publish-cli-recovery.yml`) and
   the hardcoded core source paths (`verify-versions`, `verify-release`,
   `docs-site-sources`, `spec-refs`, `verify-codes`, `release-state.test`,
   `verify-pcg64-reference.py`, `vercel-ignore-build.sh`); add the
   `VERSIONS.md` row; update wiki 03, 08 and 11, `docs/starter/` and the
   package `CLAUDE.md` files. Every module outside the Phase 1 closure list
   stays in core as a starter module; for example, `calculation-context.ts`
   (its only user is the CLI) stays in core. Implementation notes: verify's
   `./browser` entry exports the same surface as `.` (no module is Node-only);
   a test that needs a starter module stays in core, named for that module;
   `publish-cli-recovery.yml` needed no change (it probes the CLI's core pin,
   and a published core implies its verify version published first); and the
   envelope's default `generator` label stays `@uwmd/core`, so representation
   bytes do not change.
3. **Release.** Core/CLI 4.1.0 with `@uwmd/verify` 0.1.0. The first publication
   of a new package name needs a trusted publisher on npmjs.com, an owner
   step done before the tag. Released in 4.1.0 (PR #320); publication was
   independently verified before this RFC moved to `implemented`.

**Test plan:** the closure test (phase 1) and the re-export superset test
(phase 2); the full suite, `typecheck:tests` and conformance unchanged at
every phase; the metrics fixture at 187/0/0 through `verifyStatedMetrics`;
`verify-packages` packing `@uwmd/verify` and type-checking a consumer that
imports only it.

## Alternatives considered

- **Keep packs injectable only.** Verify would need the caller to pass the
  pack for every receipt, and a lender holding only `@uwmd/verify` would get
  `RCP-05` for every builtin receipt. Rejected: it fails the boundary test.
- **Rebuild packs from the dictionary.** The dictionary carries no pack id or
  version, which receipts name. Adding them is a dictionary schema change and
  belongs in its own RFC.
- **Split the repository.** RFC 0078 deferred this: the boundary is drawn in
  the specs and packages first.

## Unresolved questions

None.

## Publication and verification (2026-10-13)

Annotated `v4.1.0` targets the release-prepared merge
`9d18a13c236b6ee46857382a25ec75c0ff6ccf86` (PR #320).
[Release run 38509776606](https://github.com/UWMD-OSP/UW-Markdown/actions/runs/38509776606)
succeeded and published `@uwmd/verify` 0.1.0 first, then core/CLI 4.1.0,
signing 0.4.0, batch 0.9.0, Excel 0.9.17, report 0.8.29 and lake 0.3.0,
pairing Stable Protocol 4.0.0 with Format 3.0. Independent registry,
provenance, published-file, delivered-CLI (336/336 portable cases, no skips)
and consumer checks passed. The boundary test holds on the registry: the
published `@uwmd/verify`, installed with no `@uwmd/core`, parses and
validates an example, verifies its stated metrics, verifies a receipt issued
by the published core 4.1.0 and reports a tampered copy `failed`; batch and
lake install without core; and core re-exports every verify export. See
[the publication record](https://github.com/UWMD-OSP/UW-Markdown/blob/main/docs/releases/4.1.0-publication.md).
Publication verification precedes this separate `accepted` → `implemented`
reconciliation. The immutable release tag and every section above remain
unchanged.
