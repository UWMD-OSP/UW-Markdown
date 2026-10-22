# 10 — Conventions & invariants

If you read one page before editing code, read this one. These are the rules that
hold the system together. Breaking them is grounds for blocking a PR.

## Which layer a rule belongs to

[RFC 0078](../rfcs/0078-protocol-is-verification.md) separates **the standard**
(the Format spec, the Protocol as verification, receipts, the module system,
the representation specs and the normative metric dictionary in
[`spec/metrics/`](../../spec/metrics/README.md)) from **the starter products**
(the calc engine code and packs, defaults and the cascade, refinement, the
editor, viewer and report, the Excel exporter, the agent layer registry, capability tokens
and display conventions, described in [`docs/starter/`](../starter/README.md)).

The invariants below mix both layers, and each says which it belongs to. A
standard invariant protects what a verifier relies on; changing it needs an
RFC. A starter-product invariant is a quality bar for the reference tools: it
still blocks a PR here, but another implementation of the standard owes it
nothing. The numbering is fixed because source comments cite invariants by
number (`invariant #4` in `dcf.ts`, `debt.ts`, `rentroll.ts` and others).

Every official asset class is a full builtin on both layers, equal to
multifamily ([RFC 0080](../rfcs/0080-official-classes-are-builtins.md)).
Module-declared classes are for third parties only.

## The hard invariants

### 1. The deterministic calc boundary — AI never does financial math
*Project rule for every tool, standard and starter alike.*
All NOI / DSCR / LTV / cap rate / IRR / DCF / amortization math is computed by the
deterministic calc engine (`calc/` + `packs/`). AI agents (run by a host; the
reference toolkit runs none) only **extract data** (from documents, market
knowledge) and **write narrative**. The prompt `buildAgentPrompt` builds
literally instructs the model: *"Never calculate financial figures."* Agents may write an *input* a formula reads (e.g.
`debt_structure.annual_debt_service`, itself computed deterministically via the
`pmt` builtin), but the derived metric is always a calc, never an LLM guess.
- **Why:** auditability and reproducibility. A deal must be re-derivable from its
  inputs; an LLM-computed cap rate is neither verifiable nor stable.
- **In practice:** if you're tempted to ask an agent to "compute X", instead have
  it write the inputs and add/extend a calc in `packs/`.

### 2. Dependency layering
*Repository structure, both layers.*
- Spec depends on nothing (changes need an RFC).
- `@uwmd/verify` (RFC 0083) depends on no `@uwmd/*` package and no vendor SDK:
  its runtime dependencies are `fast-xml-parser` and `fflate`, and its
  `standard-closure.test.ts` refuses any other import. `@uwmd/core` depends on
  it at an exact version and imports it only through its public entry, never a
  deep path into the package.
- `@uwmd/core` takes no vendor SDK as a hard dependency. It hosts no agents
  and declares no model SDK at all, even as an optional peer. Anything imported
  by code that must run in a browser (parser, validator, calc, packs) must stay
  free of Node-only modules. Web tools import from `@uwmd/core/browser`.
- Tools depend on `@uwmd/core` (or only `@uwmd/verify`, when they only read
  and verify) + their own stack. **Tools never import other tools.**
- Conformance fixtures depend on nothing (pure data).

### 3. Editor byte preservation
*Starter-product guarantee (the editor).* `applyEdit` must leave bytes outside
the modified region exactly as they were (round-trip stability). The editor
fixtures (`conformance/starter/editor/`, a starter-product suite under RFC 0078)
enforce this. Never reflow or re-serialize the whole file on an edit.
- **Why it is not a standard rule:** integrity chains hash canonical block JSON
  (Protocol §V.9), not raw bytes, so a verifier never depends on byte
  preservation. The rule moved with §V.1 to the
  [editing guide](../starter/editing.md).

### 4. Excel ↔ evaluator parity
*Starter-product quality bar (RFC 0078 D6), not a Protocol requirement.* The
calc engine and the Excel emitter are two renderings of one AST. For every
metric, both must produce the same number *exactly* — both sides quantize at
the declaration's `round_to` per protocol §VIII.5 (`packs/packs.test.ts`).
If you add a metric, keep both paths in agreement; if a builtin has no Excel
equivalent, don't use it in a pack formula.
- **What is normative here:** the metric definitions in `spec/metrics/`, the
  §VIII.1 notation they are written in, and the §VIII.5 numeric model
  (unrounded binary64, one half-away-from-zero quantization). Every pack must
  equal its dictionary entries exactly (`builtin-packs/metric-dictionary.test.ts`), and
  that is what keeps the engine, the Excel exporter and any third-party verifier
  on one set of definitions. A verifier may compute a definition any way that
  reproduces its quantized value; it owes no Excel output at all.

### 5. Append-only provenance
*Standard (Protocol §V.2–§V.4).*
Prefer **supersede** over destructive replace for agent/document writes: the prior
block stays inline marked `superseded: true`, version bumps by 1, and a
`pipeline_log` entry records the write. Every block carries a `_meta`. The host
owns `_meta` — strip any `_meta`/`_notes` an agent puts in `section_data`.

### 6. Semver-per-surface
*Both layers.* The format, the protocol, and each npm package each carry an
**independent** version (`PROTOCOL_VERSION`/`FORMAT_VERSION` in `protocol.ts`; `version` in each
`package.json`; `MULTIFAMILY_PACK.version`; defaults table `version`). See
[`VERSIONS.md`](../../VERSIONS.md) for the compatibility matrix. Don't bump them
together reflexively — bump the surface that actually changed. From Protocol
3.0 the Protocol version moves only when what a document *means* or how it is
*verified* changes; a starter-product change (engine, defaults, editor, viewer,
Excel, agents) versions its package only. There is no starter-guide version
(RFC 0078 D13).

### 7. Spec / schema / protocol lockstep
*Standard.* `protocol.ts` types mirror `spec/schemas/*.schema.json` (explicitly so for
`ModuleManifest`). Validation-code copy lives once in `BUILTIN_REMEDIATIONS`. The
source tags, edit policies and the view-model types are defined once in
`protocol.ts`; the starter-product tables (the cascade order `CASCADE_ORDER`,
`BUILTIN_VIEW_MODELS`, number formats, capability tokens) are defined once in
`starter-protocol.ts` (RFC 0083), which `protocol.ts` never imports. Change
them in one place; run `npm run validate-schemas`.
The metric dictionary is part of the same contract: `spec/metrics/builtin.json`,
its schema and the packs move together, and the dictionary parity test fails
if they do not. Core ships the dictionary as generated `src/metric-dictionary.ts`
(`npm run gen-metric-dictionary`); a test fails if the copy drifts.

### 8. Workspace isolation
*Project rule for this repository.* Every `@uwmd/*` dependency resolves through
the local workspace link (`packages/*`, or a `file:` link from `tools/`), never
a registry tarball, so a change is always tested against the code beside it.
Package manifests pin each other exactly (`@uwmd/core` `4.3.0`, not a
range); the workspace satisfies that pin locally, and external consumers
resolve it from npm. `npm run verify-lockfile` fails if any lockfile resolves
an `@uwmd/*` package from the registry or a pin disagrees with the declared
version, and `verify-packages` refuses a published package that depends on a
workspace-only specifier.

### 9. Descriptive identity does not select underwriting behavior
*Standard (Format §2.2b).* Frontmatter `scenario` is the single business plan (RFC 0072, Format §2.2b).
Subtype remains open, with a defined multifamily `build_to_rent` identity.
These may route descriptive workflows, but never choose calculations, defaults,
packs or underwriting rules. DQ-07–09 are structural/vocabulary warnings only,
in both format generations. Do not infer a plan from a subtype or vice versa.

This rule was numbered 8 here from 2026-10-08 until 3.0.0 release
preparation, while `AGENTS.md`'s 8 was workspace isolation. Nothing cited
either number; both lists now agree, keeping the older 8.

## Coding conventions

- **Language/module:** TypeScript, ESM only (`"type": "module"`). Targets ES2022.
  `@uwmd/core`/`@uwmd/excel` use `NodeNext` module resolution; web tools use
  `Bundler`. **Relative imports include the `.js` extension** (NodeNext requires
  it even in `.ts` source — e.g. `import { x } from './parser.js'`).
- **Linting:** Biome (`biome.json`), lint-only — `npm run lint`. Formatting is not
  enforced by the linter; `npm run format` runs Biome's formatter if you want it.
  `noExplicitAny` is off (TS is already strict), `noNonNullAssertion` is off.
- **Strictness:** TS `strict` everywhere. `@uwmd/excel` and the tools add
  `noUnusedLocals`/`noUnusedParameters`.
- **Tests:** Vitest; one `*.test.ts` per source file. Add/extend the sibling test
  when you change a module.
- **Public API discipline:** export new public symbols from `src/index.ts`
  (and `src/browser.ts` if browser-safe). If it's not exported there, tools can't
  use it.
- **Errors:** use the typed error machinery (`ProtocolError`, `CalcError`,
  `ExcelEmitError`) with their code taxonomies — don't throw bare `Error` across
  module boundaries.
- **Comments:** the codebase favors a short top-of-file purpose comment and
  spec-section references (e.g. `// Spec: §VIII.2`). Follow that style; don't
  narrate the obvious.

## Common gotchas

- **Browser import boundary:** importing from `@uwmd/core` (not `/browser`) in a
  web tool drags in Node-only starter code and breaks/bloats the bundle.
- **Calc identifier resolution:** a bare section name resolves to the block's
  *inner* user data (`block.content.content`), not the raw envelope. Path segments
  drill from there. (See [04 — Calc engine](04-calc-engine.md).)
- **Rates are fractions, not percents** everywhere except display (`0.0551`, not
  `5.51`). The `%`/`$`/`x` unit only changes formatting.
- **Conformance imports `dist/`** — rebuild (`npm run build`) before
  `npm run conformance`, or you'll test stale output.
- **`--update` rewrites baselines** — only with intent, and review the diff.
- **`pipeline_log` is always the last section** (§4.18). Don't insert sections
  after it.
- **Agent `_meta` ownership:** never trust `_meta` returned inside a model's
  `section_data`; the host builds it with `buildMeta`.
