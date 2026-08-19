# 13 — Build status (living document)

**Review update:** 2026-07-26 — RFC 0014 Phases A–E are implemented;
owner-led governance is active.
**Last verified:** 2026-08-18 at `f72eeeb` (the `v1.5.0` release commit; full
pass: build green across all workspaces; **970 tests** — 832 core, 69 excel, 62
cli, 4 batch, 3 report — plus **63 web-editor**; **195 conformance** assertions
including the Tier-4 replay, module, package, receipts, market-data, and
composition suites; 15/15 schemas valid; Biome clean over 401 files;
`typecheck:tests` clean across all five workspaces).
**Maintainer action:** this is a *living* doc — update it when a status changes (see
[How to keep this current](#how-to-keep-this-current) at the bottom). It is a
*synthesis*, not a source of truth; the authoritative sources are
[`ROADMAP.md`](../../ROADMAP.md) (forward plan), [`CHANGELOG.md`](../../CHANGELOG.md)
(what landed), and the code itself.

## Snapshot

UW Markdown is **v1 feature-complete**, and the entire **v1.1 architectural-review
train (phases 1–6)** has landed (integrity/hashes, cascade+defaults, `gaps`,
incomplete-data policies, context profiles, refinement/VOI, L0a/L0b agents, the
`scope` stage). What remains is mostly **breadth** (more asset classes), **a few
stubs**, **explicitly-deferred v2 RFC work**, and **operational launch tasks** —
not core gaps.

## Status legend

- ✅ **Built** — present, wired, tested
- 🟡 **Partial** — works but thin / narrow / under-tested
- 🔴 **Stub / missing** — declared or contracted but not implemented
- 🧊 **Deferred (v2)** — has an RFC draft; intentionally not built for v1
- ⚙️ **Operational** — non-code launch/process task

---

## ✅ Built and solid

- **Specs:** format (`spec/UW_FORMAT_SPEC_v1.md`, 23 subsections, CC-NN, YAML
  subset Appendix D) + protocol (`spec/UW_PROTOCOL_v1.md`, tiers, calc EBNF,
  cascade §IX, context profiles §X) + 10 JSON Schemas. See [02](02-uwmd-format.md).
- **Core Tiers 1–3:** parser, validator (CC/FV/DQ/INT/POL families wired to
  `BUILTIN_REMEDIATIONS`), editor (`applyEdit`/`applyEditAsync`, byte-preserving),
  renderer (`json`/`csv`/`chat`/`summary`). See [03](03-core-library.md).
- **Calc engine:** sandboxed parser+evaluator, 17 builtins incl.
  `pmt/fv/pv/nper/irr/npv`, full error taxonomy, property tests, and a normative
  **numeric model** (§VIII.5). See [04](04-calc-engine.md).
- **Nine asset-class packs:** `MULTIFAMILY_PACK` (8 metrics), `OFFICE_PACK` (11),
  `RETAIL_PACK` (12), `INDUSTRIAL_PACK` (12), `SELF_STORAGE_PACK` (12),
  `HOSPITALITY_PACK` (14), `SENIOR_HOUSING_PACK` (14), `STUDENT_HOUSING_PACK` (14),
  `LAND_PACK` (12, and deliberately no cap rate / DSCR / debt yield — land is not
  an income property), selectable via `getPackForAssetClass`. The Excel converter
  has a `WorkbookLayout` per class (selected via `getLayoutForAssetClass`); its
  `toWorkbook.test.ts` computes parity for all nine (operating statement foots —
  for land a carry statement that nets negative; metrics == evaluateCalc
  exactly). Pack-level parity also pinned in each `packs/*.test.ts`. See
  [05](05-calc-packs.md), [08](08-tools.md).
- **v1.1 train:** integrity (`integrity.ts`, `uwmd verify`), `cascade.ts` +
  `defaults.ts`, `gaps.ts`, `INCOMPLETE_DATA_POLICIES`, `context-profiles.ts`,
  `refinement.ts`, L0a/L0b layers, `scope` stage.
- **Market data (RFC 0022, 2026-08-16):** `market-data-v1` profile
  (`market-data.ts`), a deterministic document resolver that fills the cascade's
  `market_data` step, receipt `inputs_provenance` pinning the observation set's
  digest, and an explicit promotion path. Identity and `basis` are refusals, not
  warnings — an unattributable observation set does not parse. `uwmd market-data
  validate`; `--market-data` on `scope`/`refine`. See [05](05-calc-packs.md) and
  the `market-data` conformance suite.
- **CLI:** 25 commands (incl. `export` → `.uw.json`, `receipt issue|verify`,
  `market-data validate`, and `compose`/`resolve` for RFC 0021 composition).
  See [08](08-tools.md).
- **Batch collection indexer:** `@uwmd/batch` provides a deterministic local JSON/CSV read model over a directory of `.uwx.md` files. It validates the required envelope, records semantic digests, and isolates invalid candidates without defining a database protocol. See [08](08-tools.md).
- **Machine interchange Phases A–E:** Envelope 1.0, normative schemas, UW JSON
  1.0, UW XML 1.0, normalized UW CSV Bundle 1.0, semantic digest/equivalence
  helpers, codec registry, safe ZIP extraction, all six CSV views, and CLI
  conversion are implemented and tested. See [03](03-core-library.md).
- **Conformance:** **175 assertions** across 4 tiers plus the named `lite`,
  `receipts`, `4-replay`, `modules`, and `packages` suites. CI now runs the runner's
  **default** suite list rather than a pinned `--tier=`, which is what the
  earlier claim of replay coverage assumed but did not have: `ci.yml` pinned
  `1,2,3,lite,receipts`, so `4-replay` had never actually gated a pull request.
  See [09](09-conformance-testing.md).
- **Verification receipts (RFC 0016):** `receipts.ts` issues and verifies
  detached receipts binding a record's canonical digest to the deterministic
  outputs of a named pack. Normative spec `spec/UW_RECEIPT_v1.md` +
  `uw-receipt.schema.json`; browser-safe; `uwmd receipt issue|verify`;
  `conformance/receipts/` (11 assertions). Verification is three-state and keeps
  `unverifiable` distinct from `failed`. **Unsigned only** — signature creation
  and validation await the RFC 0010 signing package, and a signed receipt
  correctly reports `unverifiable` until one exists.
- **Excel round-trip:** `.uwx.md → .xlsx` via `toWorkbook.ts`, and **reverse
  import** `.xlsx → section fragments` via `fromWorkbook.ts` (shipped 2026-08-13).
  Every workbook also carries a **`UW MCP` sheet** (`mcpSheet.ts`) — machine-readable
  identity, producing pack, source semantic digest, a metric dictionary in
  calc-engine source form, and an explicit assurance boundary.
  `verifyWorkbookContract()` is three-state; `unverifiable` is kept distinct from
  `failed`, because an older export is not evidence of tampering.
- **Report renderer + PDF pipeline:** `report.ts` in core renders the spec's
  §7.1 Lender Package / §7.2 Credit Memo as deterministic print-ready HTML
  (`renderReportHtml`, browser-safe, `uwmd report` CLI); `@uwmd/report`
  (`uwmd-report`) prints it to PDF via playwright-core + system Chrome/Edge.
  See [03](03-core-library.md), [08](08-tools.md).
- **Tools:** CLI, Excel converter, report PDF pipeline, web-viewer, web-editor
  (React + Tailwind, with live report preview; rent-roll, operating-statement,
  debt, sources-&-uses, valuation, **and DCF/hold-period** are **footed-model
  surfaces** — line items in, section totals derived by core's `derive*`
  functions, hand-overrides via `_meta.field_overrides`), VS Code ext, docs-site
  (the docs-site is the public text-first docs/download hub, publishes the Tier-1
  reference viewer, and hosts the calc-aware web editor as a public preview).
- **Provider-neutral Tier-4 host (T9):** `agents/provider.ts` defines
  `AgentProvider` — `complete()`, optional `stream()`, and neutral request /
  completion types — and imports no vendor SDK.
  `agents/providers/anthropic.ts` is the **only** file in the library that
  touches `@anthropic-ai/sdk`, and it touches it only at runtime: the SDK is an
  optional peer dependency loaded by dynamic import on the first request, and
  `bancroft.ts` reaches the provider the same way. So no consumer loads the SDK
  by importing `@uwmd/core`, and a host that never sends a request need not
  install it — a missing SDK surfaces as `AGENT_PROVIDER_SDK_MISSING`, not a
  module-resolution error. Tests assert the absence of a static import in both
  files and that the factory constructs without the SDK present. `BancroftRunOptions` gained
  `provider` (and `apiKey` became optional); supplying neither is a typed
  `AgentProviderError`.
- **Recorded-replay Tier-4 conformance (T10):** `agents/providers/replay.ts`
  supplies `createRecordingProvider` / `createReplayProvider`, and
  `conformance/tier-4-agent-host/replay/` replays a cassette through the real
  runner, comparing the resulting document **byte for byte**. Runs in CI by
  default — no network, no API key. Determinism comes from
  `BancroftRunOptions.now`: a constant clock freezes `_meta.timestamp`,
  collapses `duration_ms`, and makes the log-entry id derivable rather than
  random. Replay is strict, so a cassette doubles as a **prompt-drift
  detector** — see `conformance/tier-4-agent-host/replay/README.md`, including
  its note on what recorded replay does *not* prove.
- **Document profiles and deal packages (RFC 0018):** the canonical two-layer
  **edge registry** lives in `protocol.ts` as `BUILTIN_EDGE_TYPES` — one table,
  with `guarantees` and `supports` declared valid on both layers rather than
  duplicated per layer. Unknown types are preserved; a *known* type used on the
  wrong layer is refused. Three document profiles are registered
  (`deal-underwriting-v1`, `lease-abstract-v1`, `source-note-v1`) and unknown
  profiles are preserved rather than reinterpreted.

  `lease-abstract.ts` enforces the two rules that make an abstract worth
  trusting: every asserted term carries a `source_ref` with a locator, and a
  null term must state *why* it is null (`not_stated` / `ambiguous` /
  `not_reviewed`). The second matters most — a bare null from an extractor that
  could not find a term is indistinguishable from an assertion that the lease
  has no such term. `projectLeaseAbstractToRentRoll` is deliberately narrow: it
  never computes a rent figure it was not given, and separates ambiguous
  conflicts from plain omissions.

  `deal-package.ts` / `-zip.ts` / `-context.ts` implement UW Deal Package 1.0 —
  manifest validation, a deterministic `.uwpkg.zip` codec, three-state
  verification (`unverifiable` kept distinct from `failed`), and the JSON
  context view whose central rule is that **source-evidence bytes are never
  inlined**, only described by identity and digest.
  `projectPackageLinksToEntityEdges` synthesizes provenance naming the package
  and member ids, and has no inverse by design.

  CLI: `uwmd lease validate|project` and
  `uwmd package create|verify|list|to-context|validate-context|edges`.
  Conformance: `conformance/packages/` (18 assertions).
- **Numeric determinism ([RFC 0023](../rfcs/0023-numeric-determinism.md), 2026-08-14):**
  the protocol now states how precise a number is. `calc/quantize.ts` is the one
  boundary where an evaluated double becomes a *reported* value, quantized half
  away from zero to the declaration's `round_to` — stated, or defaulted from
  `unit` by a normative table (`$`→2, `%`→6, `x`→4, else 6) that is total by
  design.

  The defect it closes was in `receipts.ts`, which ran two checks over the same
  numbers that could not both be right: `RECEIPT_RESULT_TOLERANCE` compared
  stated against recomputed at 1e-6 while `results_digest` hashed them
  bit-exactly. A last-ULP difference passed the tolerant check, failed the exact
  one, and was reported as **corruption** — verification blaming the record when
  the record was fine. Quantized results carry no tail for the two to disagree
  about.

  Two things fell out of it. `round()` had diverged from its own documented
  contract: it scaled by `10 ** dec`, so `round(1.005, 2)` returned `1.00` where
  Excel's `ROUND` returns `1.01` — fixed as errata, since §VIII.3 already said
  half-away-from-zero. And **Excel parity is now asserted as exact equality**
  rather than agreement to six decimals, across all nine asset classes:
  `emitCalcExcelFormula` wraps each emitted formula in `ROUND(expr, round_to)`,
  so both sides apply one identical rule. That `toBe` replacing `toBeCloseTo`
  is the strongest single signal the boundary is real.

  **Protocol 1.2.0 → 1.3.0.** §VIII.5 adds normative `MUST` requirements, which
  `VERSIONS.md` rule 2 puts at a minor bump; leaving it would have left two
  documents both calling themselves 1.2.0.

  Pre-quantization receipts degrade to `unverifiable`, not `failed` — `RCP-07`
  ("results disagree *and* the engine version differs") already covered it, so
  bumping `@uwmd/core` to **1.2.0** was the whole migration. No new verification
  state was needed; the three-state design already had the right answer.
  Receipts also gained an optional `computation.protocol_version`, because an
  engine version only means something to a reader who knows that engine's
  release history — not the position a verifier is in when handed a third-party
  receipt. Absence means *unstated*, not *non-conforming*.

  The packs deliberately carry **no** explicit `round_to`: every pack
  calculation uses `$`, `%`, or `x`, so the normative defaults already give each
  one the precision it wants, and restating that 109 times would duplicate the
  table into a second place that can drift from it.

- **Iterative determinism ([RFC 0024](../rfcs/0024-iterative-function-determinism.md),
  accepted and implemented 2026-08-15) — protocol 1.3.0 → 1.4.0.** RFC 0023 made
  a *reported* number reproducible; it did not make a *searched* one
  reproducible, and `irr` is the one builtin that searches. §VIII.3 is now a
  normative six-step procedure — bracket over `[-0.999, 10.0]`, return an exact
  endpoint root, bisect to `|npv| < 1e-9` or a half-interval under `1e-12`
  capped at 200 iterations, **no Newton polish** — and `calc/builtins.ts`
  implements exactly it. `pmt`/`fv`/`pv`/`nper` are normatively closed-form;
  `irr` is the only builtin permitted to iterate.

  **`irr` now refuses in two cases where it answered.** A root outside the
  bracket: `irr(-1, 20)` was `18.999…`, a 1900% return from a search documented
  as stopping at 1000%. And an even number of roots inside it:
  `irr(-100, 230, -132)` was `0.1`, an artifact of Newton's seed, though `0.2`
  zeroes the same NPV. Conventional cash flows do not move — bisection and the
  old Newton pass agree to ~5e-13, far below the six-decimal quantum — and no
  pack declares an `irr` metric, so no built-in calculation on any asset class
  changed. Five Tier-3 fixtures (`irr-01`…`irr-05`) and a property test that the
  returned value actually zeroes the NPV, not merely reproducibly.

  Three checks ran before acceptance and all three shrank the change: the
  iteration audit came back clean, no pack uses `irr`, and the Excel-parity
  question the draft called its blocker is therefore unreachable today.

  **Implementation then found two of the RFC's five stated fixtures impossible
  under its own procedure**, both now recorded as errata in the RFC. Fixture 02
  wanted a multi-root cash flow to return a pinned root — but an even root count
  means no sign change across the bracket, so bisection cannot locate it and the
  procedure raises. Fixture 04 wanted a root exactly at `-0.999` — but
  `1.0 + (-0.999)` is `0.001000000000000001` in binary64, so that root is not a
  well-defined quantity at the low endpoint (the high endpoint is exact and is
  covered). A worked reminder that an accepted RFC is a proposal until something
  runs it.

  Released as `@uwmd/core` **1.3.0** (with `@uwmd/cli` 1.3.0 and coordinated
  repins of excel 0.3.0, report 0.3.0, batch 0.2.0). A minor rather than a
  major even though `irr` can now throw where it returned: the removed
  behavior is a value from outside the domain the spec claims to search, so no
  correct code depends on it.

- **OSS scaffolding:** governance, RFC pipeline, CI+release, CHANGELOG, VERSIONS,
  GLOSSARY, ARCHITECTURE, first-file tutorial.

## 🟡 Partial — works but needs improvement

- **Asset-class coverage = 9 of 10 classes.** Every class in `AssetClass` except
  `mixed_use` now has a pack + defaults table + worked example + Excel layout,
  and `scope`/`refine`/Excel resolve all nine off `frontmatter.asset_class`.
  **Effectively closed as a limiter.** `mixed_use` is the genuinely hard one: it
  *composes* other asset classes rather than standing alone. Designed in
  [RFC 0019](../rfcs/0019-mixed-use-composition.md), which concludes that the
  one-pack-per-class assumption **does** survive — the composition belongs in the
  document (a bounded set of component slots keyed by class), not in the pack.
  The deciding constraint is that the Tier-3 calc engine has no iteration or
  array indexing, so per-component pack evaluation is not expressible without a
  new primitive in the sandboxed evaluator. RFC is `draft`; not yet accepted, so
  no code yet.

  > **Drift is now caught automatically (T16).** `AssetClass` had four
  > hand-maintained runtime mirrors — `modules.ts`, `PACK_REGISTRY`,
  > the defaults `REGISTRY`, and the web editor's catalog — and a type union is
  > erased at runtime, so nothing stopped a member being added to the union
  > while one of those lists was forgotten. `types.ts` now derives an exported
  > `ASSET_CLASSES` from a `Record<AssetClass, true>` that `tsc` checks, so the
  > list cannot drift from the union; `modules.ts`'s duplicate was deleted in
  > favour of it, and `types.test.ts` holds the pack and defaults registries to
  > that list. `mixed_use` is carried as a single documented exception that
  > fails loudly the moment its pack lands.
  >
  > **Landmine defused (T12).** `mixed_use` used to be load-bearing for every
  > "no pack / no defaults registered" negative test, because it was the only
  > unregistered class. Each pack shuffled that role to the next unregistered
  > class (hospitality → senior_housing → student_housing → mixed_use), and after
  > `mixed_use` there was no next one — so registering it would have broken five
  > tests at once. Those tests now anchor on the synthetic identifier
  > `__unregistered_test_class__`, which is deliberately *not* a member of the
  > `AssetClass` union and must never become one. `cascade.test.ts`,
  > `defaults.test.ts`, `toWorkbook.test.ts`, `receipts.test.ts`, and the
  > `conformance/receipts/refuse/02-no-pack-for-asset-class` fixture no longer
  > reference `mixed_use` at all, so the `mixed_use` pack can be written without
  > touching any of them.
- **Module system is declarative-only** — by design — **but the loader is now
  hardened (T13).** `modules.ts` validates and registers in-process
  `ModuleManifest` objects; there is still no dynamic import, signing, or
  custom asset-class declaration, and those stay v2/RFC work (0002, 0003).

  What changed is that the loader now actually enforces the normative schema.
  It previously validated `calculations` and `validations` and stopped:
  `sections`, `view_models`, and `agent_layers` were declared in
  `module-manifest.schema.json` and validated **nowhere**, unknown keys were
  accepted at every level, and `id` ignored the schema's minimum length. Probing
  identical manifests through ajv and the loader disagreed on **seven of eight**
  cases. `agent_layers` was the worst of them — it carries `prompt_template`, so
  it is Tier-4 prompt surface, and it would accept `prompt_template: 42`.

  Three defects fell out of writing the fixtures:

  - **Duplicate module ids silently shadowed.** Two manifests sharing an id both
    loaded and `byId` returned whichever came last, so a registry lookup
    resolved to the wrong module. Now `PROTO-MOD-066`.
  - **A typo discarded a module's work.** `calculationz:` loaded clean and
    contributed nothing, with no error.
  - **`requires_protocol: "^1"` never matched.** Only `X.Y` was padded to full
    semver, so a bare major failed to parse and every range containing one was
    silently unsatisfiable — while the schema's own description documents `^1`
    as a valid spelling.

  Drift is now **checked rather than requested**: the `modules` conformance
  suite runs every fixture through both ajv and the loader and fails when the
  verdicts disagree. Core cannot carry a JSON Schema validator (layering
  invariant), so the hand-written mirror needed an external referee; ajv is a
  root devDependency and the runner is a root script, so nothing enters the
  package's dependency graph. Two deliberate divergences — requiring
  `deterministic: true`, and parsing the safe-expression grammar — are declared
  per fixture with a stated reason; the opposite direction has no opt-out.

  `uwmd modules validate|list` gives module authors a host-side surface, with
  pointer-level errors (`agent_layers[0].prompt_template`) rather than a bare
  refusal.

  > **The schema's `deal_stages` enum had gone stale in the other direction**,
  > omitting the `scope` stage that shipped in the v1.1 train — so a manifest
  > the loader accepted was invalid against the normative document. Corrected as
  > errata rather than by RFC, on the grounds that it aligns a stale mirror to an
  > already-accepted decision instead of making a new one.
- **Refinement VOI is approximate.** Perturbation-only, marginal (not joint) VOI;
  non-monotonic outputs only warn; `refinement.ts` carries an empty v1 placeholder
  for the L0b loop.
- **Test coverage uneven, but the gate is real.** The backfills landed:
  `compactor.ts`, `init.ts`, `format.ts`, and `context.ts` all have dedicated
  tests now, and the validator has four (`validator.cc`, `.consistency`, `.dq`,
  `.fv`), not just `.dq`. Core `cli.ts` is the remaining module with no sibling
  unit test.

  The CI coverage gate is **blocking**, not advisory — `continue-on-error` was
  removed in `13218c4`, and the floor in `packages/uwmd-core/vitest.config.ts`
  has been ratcheted twice since: to 76/76/95/74 (T17, 2026-08-13), then to
  **82 lines, 82 statements, 97 functions, 76 branches** (2026-08-15), roughly
  a point under measured. Falling through a floor fails CI.

  > **Reading the number honestly.** The open question here — whether the
  > `exclude` list should drop the re-export barrels — is now decided: it
  > does. `index.ts` and `browser.ts` had grown to ~1,050 lines of pure
  > re-export that no test imports, and the 79% floor they were dragging on
  > had actually gone red (measured 77.88%) before anyone noticed, because
  > RFC 0018 enlarged the barrels rather than because anything got less
  > tested. With them excluded, measured core coverage is **~83% lines**. What
  > still reads as 0% and is not untested logic: `cli.ts` (1,104 lines) *is*
  > exercised, by the CLI smoke tests in `packages/uwmd-cli`, which do not
  > count toward this package's number.

  The **web-editor** has its own Vitest suite (63 tests, 8 files): the
  `runEdit()` chokepoint + catalog helpers (node), jsdom component tests for the
  footed surfaces and inline-remediation wiring, receipt issuance/verification
  incl. the stale-vs-failed distinction and a forced Web-Crypto path, an
  axe-core a11y smoke check, and the metric strip's asset-class awareness (T14).

  > **Tests are type-checked by `npm run typecheck:tests`, not by the build.**
  > `tsconfig.json` still excludes `src/**/*.test.ts` and Vitest still
  > transpiles with esbuild, so neither `npm run build` nor `npm test` reads a
  > test as TypeScript. `packages/uwmd-core/tsconfig.test.json` closes that
  > hole and runs in CI. Its first run found 12 type errors across 5 files —
  > all in test-side navigation of union types, none failing at runtime.
  > All five workspaces carry one now. Extending it to cli/excel/report/batch
  > found no further type errors, but did surface that `@uwmd/excel` was
  > compiling its tests into `dist/` and **publishing them** — its tsconfig had
  > no `exclude`, its `files` field none of core's `!dist/**/*.test.*` guards,
  > and `verify-packages` did not cover the workspace at all. Fixed, and
  > verify-packages now covers excel and report too.
  > This cost real time during T16 before it was noticed.
- **Examples = 9 deals** (multifamily, office, retail, industrial, self-storage,
  hospitality, senior housing, student housing, land) plus `parkview-after-L6`;
  other loan types undemonstrated. All are `.uwx.md` as of RFC 0020 — they were
  structured records on the legacy `.uw.md` extension, which the project's own
  detector flagged on every load. One UW Lite `.uw.md` example now ships
  alongside them (T11).

  > **A UW Lite example now exists (T11).** `spec/UW_LITE_SPEC_v1.md` specified
  > Lite normatively while the repo shipped zero instances of it — plausibly
  > *why* the two representations blurred together in the docs for so long.
  > `examples/Parkview-Apts-Glendale-AZ.uw.md` closes it, deliberately as a
  > **twin** of the existing `.uwx.md` record: same deal, same base name, both
  > extensions adjacent in the directory listing. Its numbers are the record's
  > own, and the derived metrics quoted in its prose (DSCR 1.1091, LTV 0.7000,
  > cap rate 0.0551, debt yield 0.0787) were evaluated through the multifamily
  > pack rather than asserted. Projecting the full record back to Lite reports
  > **7 projected paths against 1,215 omitted**, which is the most concrete
  > statement of the split the repo can make.
- **Docs on-ramps.** Tutorial, glossary, tools-comparison, cookbook, FAQ, and the
  calc "calling-convention" guide all ship on the docs site (`tools/docs-site/guide/`).

## 🔴 Stubs / not implemented

- **DOCX rendering** — the Word credit-memo target has no pipeline. The core
  renderer now rejects `docx` explicitly with typed `UnsupportedRenderFormatError`
  instead of returning an apparently successful empty document. PDF is built via
  `report.ts` + `@uwmd/report`; the core `pdf` target rejects with guidance to use
  that package.
- **Investor-profile** — interface-only; no reference implementation. Market data
  is now built (see ✅ above); `InvestorProfile` was deliberately excluded from
  RFC 0022 §5 as an institution-private preference set nobody has yet asked to
  exchange, and portfolio-level shared assumptions belong to RFC 0021's
  `inherited_assumption` instead.
- **L3 / L9 / L10 layers** — L3 reserved; portfolio/relationship layers absent.
  RFC 0015 now sketches an optional v2 relationship sidecar, but no protocol or
  reference implementation exists.

## 📋 Active 1.1+ machine-interchange train

RFC 0014 defines a format-neutral envelope plus UW JSON, XML, and normalized CSV
bundle mappings. Envelope 1.0, UW JSON 1.0, semantic digests, the codec registry,
Protocol 1.2 representation descriptors/negotiation, schemas, `uwmd export`,
`uwmd formats`, deterministic UW XML 1.0, normalized UW CSV Bundle 1.0,
Markdown/JSON/XML/CSV `uwmd convert`, HTTP Binding 1.0, MCP Binding 1.0, and
reference adapters are implemented. Package publication is the remaining release
step. See the
[release plan](../releases/1.1-plus-interchange-plan.md) and
[RFC 0014](../rfcs/0014-multi-format-interchange.md).

## Active Lite / UWX transition

RFC 0017 assigns human-readable Lite to .uw.md and the current structured format
to .uwx.md; RFC 0016 defines receipts for unchanged signed content and
deterministic math consistency, not input truth. Both were **accepted
2026-08-09**. The Lite/UWX split (0017) is implemented; **receipts (0016) are
now implemented too**, unsigned — see the receipts entry above. (These were
previously cited as RFCs 0015 and 0016; 0015 belongs to the unrelated
portfolio-relationships proposal and 0016 did not exist — see the process-failure
note in RFC 0017.) The first compatibility slice
is built: representation constants/detection, parseUWXFile, legacy structured
.uw.md recognition, byte-identical migration planning, and
uwmd migrate-source, the normative Lite 1.0 grammar, source-located parser/AST,
typed values, financial canonicalizer, canonical renderer, first fixture, and
CLI parse/validate support. The deterministic deal-summary bridge now compiles
Lite into the Document Envelope/UWX, preserves the complete Lite source in a
namespaced extension, projects UWX back to Lite with explicit loss reporting,
and powers CLI convert/export plus representation discovery. The public web editor and docs site now expose the bridge: Lite imports become editable UWX records, UWX-to-Lite exports name every omitted path, and the format guidance distinguishes the readable summary from the complete working record.

The Lite representation now has its own conformance suite (`conformance/lite/`,
run by default and wired into CI): five well-formed fixtures each freezing the
financial canonical form, its SHA-256 digest, the canonical rendering, the
`deal-summary-v1` compilation plus UWX serialization, and the UWX→Lite
projection report; twelve `malformed/` fixtures covering every parse-time
`LITE_*` code; six `compile/` fixtures covering every `LITE_COMPILE_*` code; and
two spec invariants asserted without baselines — the §7 canonical-rendering
round-trip and the §6 display-equivalence digest match. That took the corpus
from 26 to 90 assertions. The `receipts` suite then added 11 more (two issuance
scenarios each carrying a re-issuance-stability invariant, five verification
outcomes, two refusals), bringing the corpus to 101; Tier-3 fixtures for the four
newest asset classes brought it to **105**.

**The terminology alignment is done** ([RFC 0020](../rfcs/0020-uwx-terminology-alignment.md),
2026-08-13). `UW_FORMAT_SPEC_v1.md` had never been updated for the split — it
contained zero occurrences of `.uwx.md` while describing the full section model,
and since the docs site renders the spec directly, uwmd.org repeated that to
every visitor. The format, protocol, XML, and CSV specs and `README.md` are now
aligned, the format spec carries a **Naming** section fixing the vocabulary
(*UW Markdown* the standard, `.uwx.md` the lossless record, `.uw.md` UW Lite),
and all ten examples were renamed to `.uwx.md`. The library never had the bug —
`source-representation.ts` already carried `UWX_EXTENSION` and the legacy
warning, which every example was tripping.

> **Legacy `.uw.md` sniffing sunsets at Protocol 2.0** (decided 2026-08-16 with
> [RFC 0025](../rfcs/0025-lite-percent-decimal-exactness.md)). RFC 0017
> introduced it as a transition path and RFC 0020 declined to schedule its end.
> RFC 0025 would have opened a *second* open-ended transition — Lite
> canonicalization 1.0 — so both were given one shared boundary instead. For all
> of 1.x, sniffing stays and a `1.0` receipt degrades to `RCP-10`; at Protocol
> 2.0 both obligations end.

Receipt **signing** remains unimplemented and is blocked on the RFC 0010 signing
package; unsigned issuance and verification ship today.

## 🧊 Deferred to v2 (RFC drafts exist, none implemented)

Range/stochastic calcs (0005), sensitivity-table builtin (0007), lease-up modeling
(0008), custom asset-class declarations from modules (0003), module signing (0002),
locale/multi-currency (0001), conformance runner v2 (0004), `_meta` v2 reorg
(0009), signed blocks (0010), capability tokens (0011), and corpus retrieval
(0013), and portfolio/relationship profiles (0015).
See [`docs/rfcs/`](../rfcs/) and [11 — Governance](11-build-release-governance.md).

## ⚙️ Operational — gates the public launch

> **Current state (2026-08-04):** the repository is public and the first npm
> packages are live: `@uwmd/core@1.1.2` and `@uwmd/cli@1.1.3`. The CLI package
> is scoped because npm rejects the unscoped `uwmd` name; its executable remains
> `uwmd`. The Excel add-on remains held separately until its ExcelJS dependency
> chain is upgraded, replaced, or formally risk-accepted.

Completed: public repository, canonical rename to `uw-markdown`, npm organization,
release secret, and initial package publication. Review-flagged: single-maintainer
bus factor, personal security email, and no public RFC venue.

## Suggested priority order

> **[RFC 0018 was accepted 2026-08-13.](../rfcs/0018-document-profiles-and-deal-packages.md)**
> Document profiles, the UW Deal Package (`.uwpkg.zip` + manifest + typed links),
> the connector JSON context, and `lease-abstract-v1` are now approved for
> implementation. Acceptance also settled edge-registry ownership under its own
> §5 rule: the canonical registry belongs to the protocol spec as 0018 defines
> it, and RFC 0015's edge list is superseded by that section rather than
> competing with it.
>
> **[RFC 0021](../rfcs/0021-composable-documents.md) (composition) and
> [RFC 0022](../rfcs/0022-market-data-documents.md) (market data) were also
> accepted 2026-08-13**, so the three-RFC arc 0018 → 0021 → 0022 is now approved
> end to end and the next two medium roadmap items are implementable.
>
> Both amend the receipt format that RFC 0016 owns — 0021 adds rollup
> verification, 0022 adds `inputs_provenance`. Each records the same ownership
> rule 0018 §5 established for the edge registry: the amendments live in
> `UW_RECEIPT_v1.md` and `uw-receipt.schema.json`, whichever implements first
> establishes the extension section, and **`receipt_version` bumps once** to
> cover both.
>
> **Still blocked on acceptance, not on code.** One RFC remains drafted:
> [0019](../rfcs/0019-mixed-use-composition.md) (`mixed_use` composition — gates
> the last asset class). [0020](../rfcs/0020-uwx-terminology-alignment.md) was
> flipped to `implemented` 2026-08-17: its prose had already landed in the specs
> and examples, so `draft` was recording a gap that no longer existed.

### Large

1. **DOCX path — or formally scope it out.** PDF landed via `report.ts` +
   `@uwmd/report`; Word remains the gap for institutions that edit memos. If it
   is built, reuse `report.ts`'s deterministic model rather than forking the
   renderer, and keep core's typed `UnsupportedRenderFormatError` pointing at the
   new package as `pdf` already does. Scoping it out is a legitimate outcome and
   should be recorded as one rather than left ambiguous.

### Medium

2. ~~**Market-data reference implementation.**~~ **Implemented 2026-08-16 —
   [RFC 0022](../rfcs/0022-market-data-documents.md) is `implemented`.** The
   `market-data-v1` profile, a deterministic document resolver, receipt
   `inputs_provenance`, and the promotion path all ship; the top two cascade
   steps now have a runnable example (`uwmd scope --market-data <file>`) and a
   worked document under `examples/market-data/`. New `market-data` conformance
   suite (14 assertions); corpus 159 → 175.

   > **Two things the RFC did not anticipate, both found by building it.**
   > §2 claimed the resolver needed no cascade change; true for *resolution*,
   > but attribution — the entire point — needed an optional `source_id` channel
   > so a value can say which set produced it. And §4's promotion would have
   > silently discarded the analyst's number: `resolveValue` recognized no
   > in-file `market_data_accepted` tag, so a promoted value fell through to
   > `asset_class_default`. It now resolves at the `user_input` step while
   > keeping its own tag, which also makes it correctly outrank a fresher live
   > pull. `CascadeStep` was untouched by 0022; RFC 0021 §5 later extended it to
   > eight steps at protocol 1.5.0, which is a protocol change rather than a
   > reordering.
3. ~~**Batch workflow expansion — composition.**~~ **Accepted 2026-08-13 and
   implemented 2026-08-18 as
   [RFC 0021](../rfcs/0021-composable-documents.md).** Section externalization
   into `.uwpart.md` fragments, recursive composites (portfolio → deals → rent
   rolls), assumptions inherited along the composition DAG, and rollup receipts.
   `spec/UW_COMPOSITION_v1.md`, three schemas, `composition.ts`, the
   `uwmd resolve`/`compose --externalize`/`--resolved` CLI surface, and a
   `composition` conformance suite (20 assertions) all ship. Protocol
   **1.4.0 → 1.5.0** — the cascade goes from seven steps to eight.

   One invariant carried the design: **an externalized record and its inline
   equivalent have the same semantic digest**, so composition is packaging
   rather than modelling. Rollup receipts sidestepped the wall RFC 0019 hit —
   the Tier-3 sandbox has no iteration, so a composite *states* aggregates and
   the verifier recomputes them over named child digests using a fixed
   `fn` vocabulary. No change to the calc engine.

   > **Three errata against the RFC, all found by building it** and accepted
   > 2026-08-18. The directive needed a `collection_path`: `collection_key` says
   > which field *identifies* a row and never says which field the rows
   > *occupy*, and I-1 cannot hold without it — `units` and `rows` are different
   > documents. §7's error table had a code for every *semantic* failure and
   > none for a structurally invalid input, which every parser needs first. And
   > the RFC gave each fragment its own `_meta` without saying what becomes of
   > it when the fragment becomes a *row*; I-1 settles it — dropped, since the
   > inline twin's rows are plain objects.
   >
   > A fourth thing was a *violation* that read as compliance. §3 requires the
   > UWX→Lite projection to report externalized sections, and it did report
   > something — the directive's own keys. So an externalized record listed
   > seven omitted paths against its inline twin's ten, and a consumer diffing
   > the two would conclude it had lost *less* while it was missing an entire
   > rent roll.
4. **Web-editor field catalog asset-class awareness.** `fieldsForSection()`
   filters by `section_id` only, so a land deal is offered a "Total units" input
   and a student-housing deal gets one too, though that class sizes per bed. The
   metric strip is already class-aware and pinned (T14); this is the input side.
   Needs the per-class field mapping decided first — hiding a field users need is
   worse than showing a spare one, so default to opt-out.

### Small, unblocked, high value per hour

5. ~~**Lite percent normalization loses decimal exactness.**~~ **Accepted and
   implemented 2026-08-16 as
   [RFC 0025](../rfcs/0025-lite-percent-decimal-exactness.md); shipped in
   `@uwmd/core` 1.4.0.** `lite.ts` now shifts the decimal point
   through the digit string instead of dividing, so `5.51%` normalizes to
   `0.0551` and equals the double a hand-authored UWX fraction produces. Lite
   canonicalization **1.0 → 1.1**; the grammar is untouched and no document needs
   editing.

   Two things came out of implementing it. Lite issuance had been stamping
   `canonicalization_version` from `UW_LITE_REPRESENTATION_VERSION`, conflating
   the canonical-bytes rules with the source grammar — UWX already kept them
   separate, so Lite was the odd one out, and bumping without splitting them
   first would have claimed a grammar change that never happened. And a digest
   mismatch was decisive at precedence step 2, so every pre-existing receipt over
   an affected document would have reported **`failed`** — a tampering accusation
   against a byte-identical record. New **`RCP-10`** degrades that to
   `unverifiable`, mirroring the §5.3 engine-identity carve-out.

   > **The corpus could not have caught this, and still can't.** Every
   > `conformance/lite/` fixture uses 5.50%/5.75%/6.25%/5.00%/-1.50% — all divide
   > cleanly — so all 90 assertions passed *unchanged* through the fix. An empty
   > diff there is the absence of evidence, not evidence of correctness; the
   > proof is the unit tests asserting `toBe(0.0551)` (where `toBeCloseTo` would
   > pass either way) and the new `receipts/verify/06-*` scenario.
6. ~~**Decide when legacy `.uw.md` sniffing ends.**~~ **Decided 2026-08-16:
   sunsets at Protocol 2.0**, together with Lite canonicalization `1.0`, via
   [RFC 0025](../rfcs/0025-lite-percent-decimal-exactness.md). Both are 1.x
   compatibility bridges and now share one boundary instead of accumulating
   separately. Nothing to build for 1.x; the work is to *remove* both at 2.0,
   which belongs on the 2.0 checklist rather than here.

### Ongoing

8. ~~**Docs on-ramps.**~~ **Shipped.** `cookbook.md`, `faq.md`, and
    `calc-conventions.md` are live under `tools/docs-site/guide/`; the remaining
    docs work is upkeep, not a gap.
9. **Operational launch gates** — single-maintainer bus factor, personal
    security email, and no public RFC venue remain review-flagged. The Excel
    add-on is held pending its ExcelJS dependency chain being upgraded, replaced,
    or formally risk-accepted.

## How to keep this current

- **When you finish a feature:** flip its line from 🟡/🔴 to ✅ here, and log the
  detail in `CHANGELOG.md` (that's the authoritative record — keep this doc to
  one-liners).
- **When you start deferred/v2 work:** move the item out of 🧊 into 🟡/🔴 with a
  pointer to the relevant module.
- **When an operational task lands:** strike it from ⚙️ and update `ROADMAP.md`.
- **Re-verify periodically:** update the "Last verified" date + commit at the top
  after a pass through the code. Don't let this doc assert state you haven't
  checked — when in doubt, trust `CHANGELOG.md` and the source over this summary.
- **Avoid line numbers** here (they rot); cite file/symbol names instead.
