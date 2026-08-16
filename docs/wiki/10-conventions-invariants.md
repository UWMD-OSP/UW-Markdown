# 10 — Conventions & invariants

If you read one page before editing code, read this one. These are the rules that
hold the system together. Breaking them is grounds for blocking a PR.

## The hard invariants

### 1. The deterministic calc boundary — AI never does financial math
All NOI / DSCR / LTV / cap rate / IRR / DCF / amortization math is computed by the
deterministic calc engine (`calc/` + `packs/`). AI agents (including the optional Bancroft reference suite) only
**extract data** (from documents, market knowledge) and **write narrative**. The
agent system prompt literally instructs Claude: *"Never calculate financial
figures."* Agents may write an *input* a formula reads (e.g.
`debt_structure.annual_debt_service`, itself computed deterministically via the
`pmt` builtin), but the derived metric is always a calc, never an LLM guess.
- **Why:** auditability and reproducibility. A deal must be re-derivable from its
  inputs; an LLM-computed cap rate is neither verifiable nor stable.
- **In practice:** if you're tempted to ask an agent to "compute X", instead have
  it write the inputs and add/extend a calc in `packs/`.

### 2. Dependency layering
- Spec depends on nothing (changes need an RFC).
- `@uwmd/core` takes no vendor SDK as a hard dependency. `@anthropic-ai/sdk` is an
  **optional peer dependency**, reached only through a dynamic import in
  `agents/providers/anthropic.ts` — so importing `@uwmd/core` never loads it, and
  a consumer who does not install it gets a typed `AGENT_PROVIDER_SDK_MISSING`
  on the first provider request rather than a resolution failure at import.
  **The SDK is also excluded from the `@uwmd/core/browser` entry.** Anything
  imported by code that must run in a browser (parser, validator, calc, packs)
  must not transitively pull in the SDK. Web tools import from
  `@uwmd/core/browser`.
- Tools depend on `@uwmd/core` + their own stack. **Tools never import other tools.**
- Conformance fixtures depend on nothing (pure data).

### 3. Tier-2 byte preservation
`applyEdit` must leave bytes outside the modified region exactly as they were
(round-trip stability). The Tier-2 conformance fixtures enforce this. Never reflow
or re-serialize the whole file on an edit.

### 4. Excel ↔ evaluator parity
The calc engine and the Excel emitter are two renderings of one AST. For every
metric, both must produce the same number *exactly* — both sides quantize at
the declaration's `round_to` per protocol §VIII.5 (`packs/packs.test.ts`).
If you add a metric, keep both paths in agreement; if a builtin has no Excel
equivalent, don't use it in a pack formula.

### 5. Append-only provenance
Prefer **supersede** over destructive replace for agent/document writes: the prior
block stays inline marked `superseded: true`, version bumps by 1, and a
`pipeline_log` entry records the write. Every block carries a `_meta`. The host
owns `_meta` — strip any `_meta`/`_notes` an agent puts in `section_data`.

### 6. Semver-per-surface
The format, the protocol, and each npm package each carry an **independent**
version (`PROTOCOL_VERSION`/`FORMAT_VERSION` in `protocol.ts`; `version` in each
`package.json`; `MULTIFAMILY_PACK.version`; defaults table `version`). See
[`VERSIONS.md`](../../VERSIONS.md) for the compatibility matrix. Don't bump them
together reflexively — bump the surface that actually changed.

### 7. Spec / schema / protocol lockstep
`protocol.ts` types mirror `spec/schemas/*.schema.json` (explicitly so for
`ModuleManifest`). Validation-code copy lives once in `BUILTIN_REMEDIATIONS`. The
cascade order, source tags, view models, and edit policies are defined once in
`protocol.ts`. Change them in one place; run `npm run validate-schemas`.

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
  web tool drags in the Anthropic SDK and breaks/bloats the bundle.
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
- **Agent `_meta` ownership:** never trust `_meta` returned inside Claude's
  `section_data`; the runner builds it.
