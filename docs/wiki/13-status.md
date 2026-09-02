# 13 — Build status (living document)

**Review update:** 2026-07-26 — RFC 0014 Phases A–E are implemented;
owner-led governance is active.
**Last verified:** 2026-09-02 (evening), after the **2.1.0 release
shipped** (`bd8c249`, tag `v2.1.0`): `@uwmd/core` **2.1.0**, `@uwmd/cli`
**2.1.0**, and `@uwmd/signing` **0.2.3** all **live on npm, verified via
`npm view`** (excel/report 0.8.3 and batch 0.7.3 repins landed,
unpublished). The release carries the post-2.0 pair of same-day RFCs:
**RFC 0034** (calendar-anchored cash flows — protocol **2.1.0**, §VIII.9)
and **RFC 0015** (portfolio & relationship profiles — protocol **2.2.0**,
§XV; Future work renumbered §XVI), both drafted / revised, accepted by
the owner, and implemented today on top of the morning's **2.0.0
release** (`1738219`, tag `v2.0.0`; underwriter.cc acknowledged). Full pass: build
green across all workspaces; all tests green (95 core test files; +74 new
unit tests today); **363 conformance** assertions (341 + the 15-scenario
`cash-flow` suite + the 7-scenario `portfolio-relationships` suite);
**22/22 schemas**; Biome clean; `typecheck:tests` clean;
`verify-versions` / `verify-indexes` clean. Protocol history: 2.2.0 = RFC
0015's §XV; 2.1.0 = RFC 0034's §VIII.9; 2.0.0 = RFC 0009; 1.14.0 = the
0009 on-ramp; 1.13.0 = RFC 0001's §III.1a (1.12.0 = RFC 0011's §XIV;
1.11.0 = RFC 0008's §4.25; 1.10.0 RFC 0031; 1.9.0 RFC 0030; 1.8.0 §X.2;
1.7.0 §V.11; 1.6.0 §XIII).

> **The corpus count moved for a reason worth recording.** It read *274* in this
> file and in two READMEs for several merges after it stopped being true. RFC
> 0030's implementation re-measured it at **301**. Treat any assertion count
> quoted from memory as stale — run `npm run conformance` and read the summary
> line.

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
- **Ten asset-class packs:** `MULTIFAMILY_PACK` (8 metrics), `OFFICE_PACK` (11),
  `RETAIL_PACK` (12), `INDUSTRIAL_PACK` (12), `SELF_STORAGE_PACK` (12),
  `HOSPITALITY_PACK` (14), `SENIOR_HOUSING_PACK` (14), `STUDENT_HOUSING_PACK` (14),
  `LAND_PACK` (12, and deliberately no cap rate / DSCR / debt yield — land is not
  an income property), and `MIXED_USE_PACK` (21 metrics — property cap rate / LTV
  / DSCR / debt yield / cash-on-cash, a NOI share per component use, allocation-
  gated price per unit / psf / bed, and per-component operating intermediates;
  deliberately no property price/unit, loan/unit, or blended cap rate; RFC 0019).
  Selectable via `getPackForAssetClass`. The Excel converter has a
  `WorkbookLayout` for **all ten** classes (selected via `getLayoutForAssetClass`).
  `mixed_use` is the one with a different workbook shape — per-component operating
  statements plus a consolidation block whose SUM of component NOIs is the
  property NOI (§3a), with metrics emitted per deal (an absent use or an
  un-allocated intensive contributes no row). `toWorkbook.test.ts` computes parity
  for every class (operating statement foots — for land a carry statement that
  nets negative; metrics == evaluateCalc exactly), and a dedicated mixed-use suite
  covers per-component footing, present-metric parity, and absent-metric omission.
  Reverse import (`fromWorkbook`) refuses `mixed_use` (`WORKBOOK-IMPORT-UNSUPPORTED-SHAPE`);
  export is fully supported. Pack-level parity also pinned in each `packs/*.test.ts`,
  including `mixed-use.test.ts`. See [05](05-calc-packs.md), [08](08-tools.md).
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
- **Conformance:** **363 assertions** across 4 tiers plus the named `lite`,
  `receipts`, `4-replay`, `modules`, `packages`, `market-data`, `composition`,
  `capital-stack`, `lease-up`, `cash-flow`, `portfolio-relationships`, `capability`, `locale`,
  `size-intensive`, `signing`, `sensitivity`, `stochastic`, `source`,
  `meta-v2`, and `migrate` suites. CI runs the runner's **default** suite list rather than a pinned
  `--tier=`, which is what the earlier claim of replay coverage assumed but did
  not have: `ci.yml` pinned `1,2,3,lite,receipts`, so `4-replay` had never
  actually gated a pull request. See [09](09-conformance-testing.md).

  **Every case is capability-tagged** (RFC 0030). `requires_capabilities` is
  derived from the command a case runs, and the RFC 0004 driver skips what an
  implementation's manifest does not claim — reported as a TAP skip and counted
  separately, never folded into `passed`. An absent capability list runs
  everything, so an implementation cannot exempt itself by omission, and CI runs
  the reference implementation under `--no-skip`. Three stub implementations in
  `conformance/profiles/` exercise the mechanism, checked by
  `npm run conformance:profiles`, which recomputes the skip set in JavaScript
  and compares it against the Python driver's.

  Two documented blind spots were closed 2026-08-25 (corpus 222 → 244):
  Tier-1 valid fixtures now freeze their **validation verdict**
  (`expected/<id>.validation.json`, `overall_status` + every
  `(code, severity)` pair — the gap RFC 0027 Appendix A named, where a
  warning→error escalation would flip `uwmd validate` to exit 1 with the
  suite still green), and the Lite suite gained the **RFC 0025
  decimal-exactness pin** — a fixture pair (`06-decimal-exact-percents` /
  `07-decimal-exact-fractions`) whose shared equivalence-group digest holds
  only under decimal-point-shift normalization, since every prior fixture's
  percents divide cleanly and could not tell the implementations apart.
- **Verification receipts (RFC 0016):** `receipts.ts` issues and verifies
  detached receipts binding a record's canonical digest to the deterministic
  outputs of a named pack. Normative spec `spec/UW_RECEIPT_v1.md` +
  `uw-receipt.schema.json`; browser-safe; `uwmd receipt issue|verify`;
  `conformance/receipts/` (11 assertions). Verification is three-state and keeps
  `unverifiable` distinct from `failed`. **Signing landed 2026-08-27** with RFC
  0010: `@uwmd/signing` supplies `signReceipt` and the
  `createReceiptSignatureVerifier` backend core has always accepted, so a signed
  receipt verifies instead of reporting `RCP-08 unverifiable`. Core itself stays
  crypto-free — a verifier with no backend still reports `unverifiable`, which
  is the correct answer to "I cannot check this".
- **Block signatures (RFC 0010, protocol §V.11):** `_meta.signature` is
  normative in the format spec and the `uwmd-block` schema; the cryptography
  ships as **`@uwmd/signing` 0.1.0** (ed25519 / es256 / es384 over Web Crypto,
  file-backed reference key store) so `@uwmd/core` keeps its zero-crypto
  guarantee. Core owns the crypto-free half — the wire type and
  `canonicalBlockSigningInput` — and takes a verifier through
  `verifyChain(parsed, { signatureVerifier })`. `INT-05`–`INT-08`;
  `uwmd verify --signing --keystore=<path>` (dynamic import, optional peer);
  `conformance/signing/` (6 assertions, 5 generated scenarios). A verifier with
  no key store reports signatures **present and unchecked**, never valid. Also
  supplies `signReceipt` / `createReceiptSignatureVerifier`, which is what made
  receipt signing real.
- **Module signatures (RFC 0002, protocol §X.1):** `ModuleManifest.signature`
  with its own `module-signature.schema.json`, five kept-apart verdicts
  (`PROTO-MOD-068`–`072`), and three host policies (`ignore` /
  `verify-if-present` / `require`) on `loadModuleManifestAsync` +
  `createModuleRegistryAsync`. The scheme is `uwmd-keystore`, **not** Sigstore
  — a Fulcio root plus a Rekor proof would mean a vendored snapshot that fails
  closed when stale, or network access inside the module loader; `scheme:
  "sigstore"` is reserved so adding it stays additive. `identity` is advisory
  and §X.1.5 says so normatively. `conformance/signing/modules/` runs six
  scenarios under all three policies.
- **Stochastic calculations (RFC 0005, protocol §VIII.8):** distributions via a
  JSON `StochasticDecl` plus the same override mechanism — grammar and built-ins
  untouched. Normative PCG-XSL-RR-128/64. The finding the RFC did not have:
  specifying the PRNG is *not sufficient*, because IEEE 754 leaves `log`/`cos`
  unspecified and both textbook normal samplers depend on them. Everything is
  inverse-CDF sampled; `uniform` and `triangular` are exact, `normal`'s tails
  are not and the spec says so. Percentiles are nearest-rank.
  `CALC-STOCH-001`–`006`; `conformance/stochastic/` (7 assertions), where
  reproducibility is asserted in-process without a baseline. **Known gap:** the
  PCG test vector is self-generated and not yet diffed against the reference C
  implementation — see
  [`docs/handoff/HUMAN-verify-pcg64-vector.md`](../handoff/HUMAN-verify-pcg64-vector.md).
- **Sensitivity tables (RFC 0007, protocol §VIII.7):** two-axis grids as a JSON
  `SensitivityDecl` — **the §VIII.1 grammar is unchanged**, because the RFC's
  proposed builtin would have needed object literals, array literals, and an
  executable string argument to reach data already sitting in JSON. The real
  primitive is `CalcEvaluationContext.overrides` (keyed by full dotted path,
  shadowing lookup and never writing; `null` means "absent", distinct from no
  override), which scenario sweeps and stress tests can use too. The grid never
  travels through `CalcResult.value`. A failed cell does not fail the table.
  `CALC-SENS-001`–`005`; `conformance/sensitivity/` (5 scenarios). Excel emit
  deferred — there was no ad-hoc renderer to replace, contrary to the RFC's
  motivation.
- **Module-declared asset classes (RFC 0003):** the builtin enum stays
  **closed** and a namespaced space opens beside it — format spec §2.2a
  (reverse-DNS, three segments minimum), protocol §X.2 (resolution in exactly
  three outcomes: resolved / degraded via a declared builtin fallback /
  unresolved), `ModuleManifest.declares_asset_classes`, and
  `conformance/modules/asset-classes/`. `AssetClass` is deliberately *not*
  widened — folding custom ids into it collapses the union to `string` and
  silently kills every exhaustiveness check downstream — so `UWAssetClassId`
  carries the wider type at the boundary only. Holding a cached declaration can
  only ever *degrade*, never resolve.
- **Module runtime + the reference module (RFC 0006):** `module-runtime.ts`
  gives the module system the consumer it never had —
  `evaluateModuleCalculations` (declaration order, results threaded forward),
  `validateAgainstModules` (rules through the same §VIII.1 sandbox; `null` is
  *not* `false`), `checkModuleSections`. Failures are reported rather than
  skipped: `MOD-CALC-ERROR`, `MOD-RULE-ERROR`, `MOD-SECTION-MISSING`.
  **`@uwmd/module-hospitality` 0.1.0** is the reference consumer — three hotel
  sections, five calcs, three validations, built against core's published
  surface only. Protocol §X gained the host obligations a registered module
  implies. `conformance/modules/runtime/` (5 scenarios). Section `schema`
  fragments stay normative JSON Schema a host with a validator SHOULD apply;
  core checks presence and stops, because it takes no validator dependency.
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

- **Calendar-anchored cash flows ([RFC 0034](../rfcs/0034-calendar-anchored-cash-flows.md),
  accepted and implemented 2026-09-02) — protocol 2.0.0 → 2.1.0.** The
  calendar-date primitive carried as v2 future work since RFC 0024, and the
  hold-period primitive RFC 0026 Phase 2 named as its missing precondition
  (that precondition is now removed; the waterfall itself stays deferred).
  Format §4.26 registers `cash_flow_series` — dated irregular flows as the
  **third state-and-verify structure** (after §4.24/§4.25): multi-variant,
  asset-class independent, `CF-01`…`CF-03` validator family, four stated
  metrics recomputed three-state by `verifyCashFlowSeries`. Protocol §VIII.9
  pins the closed **day-count registry** (`actual/365f` default,
  `actual/360`, `30/360us` = the exact Excel DAYS360 U.S. clamps, no NASD
  February special-casing — divergence documented, not discovered),
  closed-form `xnpv`, and `xirr` by the RFC 0024 bisection **verbatim**
  (`irr` and `xirr` are now the only two builtins permitted to iterate).
  Reachable only via declaration (`CashFlowMetricDecl` /
  `evaluateCashFlowMetrics`, the §VIII.7/§VIII.8 pattern's third instance)
  and the verifier — grammar and builtin table untouched,
  `CalcResult.value` not widened, per-row overrides honored. New
  `calc-cash-flow` capability, `CALC-XIRR-DIVERGE` / `CALC-CF-SERIES`
  codes, `section-cash-flow-series.schema.json`, chat/summary renderer
  tables, and `conformance/cash-flow/` (15 scenarios; corpus 341 → 356).
  Two errata recorded in the RFC: additive sections never bump the format
  version (the draft claimed 2.1), and the draft's hand-computed example
  metrics were wrong — the spec's §4.26 example now carries
  verifier-generated values that `verify-all-metrics` pins verbatim.
  Excel emit deferred with the Newton-parity reason recorded.
- **Portfolio & relationship profiles ([RFC 0015](../rfcs/0015-portfolio-relationships.md),
  revised, accepted, and implemented 2026-09-02) — protocol 2.1.0 → 2.2.0,
  new §XV (Future work renumbered §XVI).** The `.uwportfolio.json` sidecar:
  typed entities and provenance-backed edges spanning deals — the portable
  carrier for the **entity layer** of the RFC 0018 edge registry, which
  `projectPackageLinksToEntityEdges` could produce but nowhere keep.
  Registry-resolved validation (`validatePortfolioProfile`,
  `PORT-001`…`PORT-011`, new `portfolio` error category): a *known*
  member-layer type used as an entity edge refuses (the
  one-table-two-layers rule, pinned from the sidecar side for the first
  time), builtin `from`/`to` entity-kind constraints refuse, and *unknown*
  entity/edge types and fields are preserved and reportable
  (`uninterpretedPortfolioTypes`), never refused. Provenance `source` is a
  document identifier, explicitly kept apart from the RFC 0031
  `_meta.source` actor grammar. Out-of-band and descriptive by design — no
  storage, no query semantics, no aggregates (those stay with RFC 0021
  rollup receipts). New `portfolio-relationships` capability,
  `uw-portfolio-profile.schema.json` (`portfolio_version` 1.0, its own
  semver line), `uwmd portfolio validate|edges`, and
  `conformance/portfolio-relationships/` (7 scenarios; corpus 356 → 363).
  One erratum recorded in the RFC: its scenario-05 sketch wanted a
  byte-preserving *edit* proven, but the reference surface is read-only by
  the RFC's own design — preservation is pinned through validation and
  type reporting; the §XV.3 editor obligation waits for an editor to test.
- **OSS scaffolding:** governance, RFC pipeline, CI+release, CHANGELOG, VERSIONS,
  GLOSSARY, ARCHITECTURE, first-file tutorial.

## 🟡 Partial — works but needs improvement

- **Asset-class coverage = 10 of 10 classes fully implemented.**
  Every class in `AssetClass` has a calc pack + defaults table, a worked example,
  and an Excel layout, and resolves end-to-end off `frontmatter.asset_class`.
  `mixed_use` — the genuinely hard one, which *composes* other asset classes
  rather than standing alone — is now complete: its **format section (§4.23),
  schema, pack, defaults, validator rules, Excel layout, worked example, and
  conformance fixtures** have all shipped, and **RFC 0019 is `implemented`**
  (2026-08-19). This item is done; it remains here only for the design narrative.
  Designed in [RFC 0019](../rfcs/0019-mixed-use-composition.md) (accepted
  2026-08-18), which concludes that the one-pack-per-class assumption **does**
  survive — the composition belongs in the document (a bounded set of component
  slots keyed by class), not in the pack, because the Tier-3 calc engine has no
  iteration or array indexing. The three open design questions were resolved
  2026-08-18: all nine income classes are admissible components on an
  NOI-additivity rule (not just hospitality); `MIXED_USE_DEFAULTS` is kept for
  mix-independent financing terms; and component-level debt is deferred to
  [RFC 0026](../rfcs/0026-capital-stack.md) (a typed capital stack), spun out
  because a cap stack is an asset-class-independent primitive, not a `mixed_use`
  sub-feature.

  > **Shipped so far (RFC 0019 implementation):** the `components` section +
  > `section-components.schema.json` (format spec §4.23); `MIXED_USE_PACK` (21
  > metrics) + `MIXED_USE_DEFAULTS`, both registered and wired through
  > `types.test.ts` (the `INTENTIONALLY_UNREGISTERED` guard is now empty); and the
  > **validator rules** — `checkComponents` emits `CC-11` (asset-class gate),
  > `CC-12` (property NOI == Σ component NOI), and `MU-01`…`MU-06` (≥2 components,
  > admissible-class, key==class, present-but-unmeasured NOI, allocation sums to
  > 1.0, no component debt), each with a `BUILTIN_REMEDIATIONS` entry; the Excel
  > `MIXED_USE_LAYOUT` (per-component operating statements + a consolidation block
  > that foots to the property NOI, deal-aware metric emission, Excel↔evaluator
  > parity) plus its worked example
  > (`examples/Roosevelt-Row-MixedUse-Phoenix-AZ.uwx.md`); and the **conformance
  > fixtures** — six tier-3 calc-host cases (two-component cap rate / NOI share /
  > price-per-unit, absent-component → `null`, allocation-absent → `null`, and the
  > per-component operating-business GOP) plus seven `tier-1-reader/malformed`
  > rejection cases (CC-11, CC-12, MU-01, MU-02, MU-04, MU-05, MU-06) and a
  > cascade proof that a component field resolves from its own class table
  > (`resolved_from: retail@1.0.0`). **RFC 0019 is `implemented`.**

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
  `ModuleManifest` objects; there is still no dynamic import or custom
  asset-class declaration, and those stay v2/RFC work (0003). **Signing landed
  2026-08-27** (RFC 0002, §X.1) — see the Built section.

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
  `.fv`), not just `.dq`. The `cli.ts` note is resolved (2026-08-26): `cli.ts`
  is a top-level script that runs at import time, which is *why* it never had
  a sibling unit test — its pure argument/path plumbing now lives in
  `cli-args.ts` (100% covered by `cli-args.test.ts`, 20 tests), the command
  surface stays covered by the `@uwmd/cli` smoke tests, and extraction found
  a real bug: the positional pass skipped the token after *any* `--` token,
  so `uwmd parse --compact=true file.uwx.md` silently dropped the filename.
  `cli-packages.ts` (the package subcommands) turned out *not* to share the
  script shape — it exports plain functions — and got a direct sibling test
  2026-08-26 (`cli-packages.test.ts`, 14 tests, 0% → 97.5%; console/exit
  captured by spies). No 0%-in-core module remains that isn't a run-at-import
  script.

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

  The **web-editor** has its own Vitest suite (69 tests, 8 files): the
  `runEdit()` chokepoint + catalog helpers (node), jsdom component tests for the
  footed surfaces and inline-remediation wiring, receipt issuance/verification
  incl. the stale-vs-failed distinction and a forced Web-Crypto path, an
  axe-core a11y smoke check, and asset-class awareness on **both** the metric
  strip (T14) and the input side — the quick-edit field grid, pinned against
  each pack's `property.*` reads.

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

- **DOCX rendering — scoped out (owner decision, 2026-09-01).** The Word
  credit-memo target is deliberately not built: demand is unproven, and
  `report.ts` + `@uwmd/report` already produce the print-ready credit-memo
  deliverable as HTML/PDF. The core renderer keeps rejecting `docx` with typed
  `UnsupportedRenderFormatError` — a truthful refusal, not a gap. Revisit only
  on a concrete adopter ask; if built then, reuse `report.ts`'s deterministic
  model rather than forking the renderer. This closes the last "Large" roadmap
  item below.
- **Investor-profile** — interface-only; no reference implementation. Market data
  is now built (see ✅ above); `InvestorProfile` was deliberately excluded from
  RFC 0022 §5 as an institution-private preference set nobody has yet asked to
  exchange, and portfolio-level shared assumptions belong to RFC 0021's
  `inherited_assumption` instead.
- ~~**Format spec §4.1 names only multifamily's size intensives.**~~ **Closed
  2026-08-25 by [RFC 0027](../rfcs/0027-asset-class-size-intensives.md)
  (implemented).** §4.1 now declares every class's intensive, Protocol §XIII
  carries the normative selection table (mirrored by `SIZE_INTENSIVES` /
  `getSizeIntensive()` / `resolveDealSize()` in core), and the three consumers
  that were wrong are fixed: `csv` exports `size_basis`/`size_quantity` for
  every class (appended — `total_units` keeps its column), the §7.1 cover
  states `RSF 42,500` / `Keys 142`, and the Lite bridge anchors all nine
  intensives. `CC-13` warns (never errors) when the primary size field is
  unstated. The Excel layouts and the web editor's grid now derive from the
  registry, and `conformance/size-intensive/` pins the whole surface (corpus
  215 → 222). Note the RFC's §XI numbering was corrected to §XIII in errata —
  §XI was already the Error Taxonomy.
- **L3 / L9 / L10 layers** — L3 reserved; the portfolio/relationship *agent
  layers* remain absent, but their data surface now exists: **RFC 0015 is
  implemented** (protocol §XV, 2026-09-02 — see the Built entry). Reference
  implementations of the layers themselves are follow-up work that the
  interchange format deliberately did not gate on.

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

Receipt **signing** shipped 2026-08-27 with RFC 0010 (`@uwmd/signing`). Unsigned
issuance and verification are unchanged and remain the default path.

## 📋 v2 RFC train (unfrozen 2026-08-26; 0002-0007 + 0010 + 0030 + 0031 implemented)

Previously 🧊 deferred; the owner unfroze the train once the v1.x dev queue
emptied (RFCs 0014–0029 all implemented).

**✅ The signing chain — shipped 2026-08-27.** RFC 0002 (module signatures,
protocol §X.1) landed the same day as RFC 0010 and on the same machinery; see
the Built section above.

**✅ RFC 0010 signed blocks — shipped 2026-08-27.** Protocol §V.11, the
`@uwmd/signing` package (Ed25519 / ES256 / ES384 over the normative signing
input, file-backed reference key store), `_meta.signature` in the format spec
and block schema, `INT-05`–`INT-08`, `uwmd verify --signing --keystore`, and
the five-scenario `conformance/signing/` suite. Receipt signing came with it.
Two findings the work surfaced are recorded in the RFC: `parent_hash` *is*
covered transitively (via `content_hash`, contradicting the RFC's rationale),
and §V.9's hash exclusions had never fired for a parsed block because the
meta-shape test required `section` where every file on disk writes `section_id`.

**✅ RFC 0004 conformance runner v2 — shipped 2026-08-27.** Protocol §II.6a
(the CLI protocol), `conformance/runner/runner.py` (TAP14 + JSON manifest,
Python stdlib only), 44 generated cases across tiers 1–3, `npm run
conformance:v2`, and a CI `--check` on the case files. The TypeScript runner is
**not** replaced — it gates the corpus, the driver gates the protocol; most of
the thirteen suites are not expressible as one command with one output.

**✅ RFC 0006 hospitality reference module — shipped 2026-08-27**, closing the
priority order the owner set when the train unfroze. See the Built section: the
gap it surfaced was not the loader but the absence of any *consumer* of a
registered module.

**✅ RFC 0003 module-declared asset classes — shipped 2026-08-27**, following
0006 because a declared class needs a runtime to mean anything.

**✅ RFC 0030 conformance profiles — shipped 2026-08-31.** Not from the v2 train
list: it came out of the first external adopter running the corpus end to end
and reporting four divergences, all four of which were defects here. Protocol
1.9.0.

Cases now carry `requires_capabilities`, derived from the command each runs, and
the driver skips what an implementation does not claim — visibly, never as a
pass. An absent capability list runs everything, so forgetting to declare fails
closed against the claimant, and `--no-skip` (used in CI) makes any skip a
failure so the mechanism cannot erode its own coverage.

Three defects it fixed, each of the same kind — **the corpus asserting
requirements the spec never stated**:

- **§III.6a named three code families while eighteen shipped.** `INT-*` and
  `POL-*` were not legal families, `FV_*` had been renamed `FV-NN` in v1.1, and
  `META_*` shipped nowhere. Now a registry naming the owning capability per
  family, plus a test asserting every code resolves to one. It went stale by
  duplicating a list that lives in code; the assertion is the part that cannot.
- **§II.1.6 owed every validator family to any Tier-1 reader**, including
  `INT-NN` (needs a hash chain) and `POL-NN` (needs an edit engine). Now scoped
  to the `validate` capability.
- **§II.6 self-certified by directory membership**, which made
  `tier-3-calc-host/refinement/` read as required though §II.3 never mentions
  refinement — and the RFC 0004 driver had always generated zero cases for it.
  Two of our own conformance surfaces disagreed.

§II.6a.6 also replaced the corpus-README sentence that had made `@uwmd/core`'s
in-memory `ParsedUWFile` a protocol surface by accident, with a specified parse
projection. The tier-1 baselines shrank by 595 lines.

New: `conformance/profiles/` and `npm run conformance:profiles`, which
recomputes the skip set in JavaScript and compares it to the Python driver's —
two independent implementations of one rule, because one checked against its own
output passes even when the rule is wrong.

**✅ The unpoliced-write path — closed 2026-08-31.** `resolvePolicy` returned
`null` for a source matching no `BUILTIN_EDIT_POLICIES` pattern, and the editor
read that `null` as *both* "permitted" and "exempt from `supersede_on_edit`", so
such a block could be replaced in place, destroying its predecessor, with
`POL-01` and `POL-02` unable to fire. A terminal `*` catch-all now gives an
unrecognized source the conservative policy; a totality assertion pins it.

`generateBlankUWFile` turned out to be the worst offender, stamping `wizard` and
`engine:uwmd` — **every document this project generated carried blocks no policy
governed**, which is why replacing them in place appeared to work. Caught by the
web-editor suite, which root `npm test` does not cover by design.

This is the correctness half of RFC 0031, shipped ahead of it. The vocabulary
reconciliation is still a draft.

**✅ RFC 0031 source vocabulary — accepted and implemented 2026-08-31**
(protocol 1.10.0). `_meta.source` is now actor-only (`manual` or
`<namespace>/<id>` over the closed `agent|document|system|institution` set,
parsed by `parseActorSource` — never prefix tests, which is how `agent:L0-01`
used to classify as a *human* write); the new optional `_meta.resolution`
carries the canonical `SOURCE_TAGS` method, at block and `field_overrides`
leaf level (leaf wins — now specified in §3.4, not presumed). Legacy tags in
`source` are read-time-interpreted onto a **cloned** meta (never into
`content._meta`, which feeds digests) and warn `SRC-02`; other out-of-grammar
sources warn `SRC-01`. §3.1's precedence ladder — which ranked market data and
investor profile in the **opposite order** from §V.7 — is now non-normative
narrative deferring to §V.7. `uwmd migrate --source-tags` migrated exactly the
measured **160 blocks** across 42 files (zero unmapped; it refuses unknown
sources and `content_hash`-bearing blocks rather than guessing); the Tier-4
host, which stamped bare layer ids, now writes `agent/<id>`.
`conformance/source/` pins the split and the data-loss regression (corpus
301 → 306). Three errata recorded in the RFC, the best of which: the draft's
own schema pattern rejected its own worked example `agent/L6-01`
(lowercase-only id charset). **RFC 0009 is unblocked.**

**✅ RFC 0008 lease-up modeling — accepted and implemented 2026-09-01**
(protocol 1.11.0). Format spec **§4.25** registers `lease_up_schedule`: the
trajectory from current to stabilized rents as a **state-and-verify**
structure on the `capital_stack` pattern — the schedule is data, not
formulas, so the Tier-3 no-iteration invariant was never in play and the calc
engine is untouched. New three-state `verifyLeaseUpSchedule` (+
`leaseUpContext`, which resolves the occupancy denominator through the §XIII
size registry — no sqft basis → `unverifiable`, never a guess); new `LU-NN`
validator family (grammar/contiguity/presence, `LU-04` warning for turnover
with no roll); **`CC-15`** warning with the named exported
`LEASE_UP_STABILIZED_TOLERANCE` (2%) checking only the base variant against
`noi_model`. Multi-variant like `stress_tests`; new
`section-lease-up-schedule.schema.json`; chat/summary renderers gain the
period table; `conformance/lease-up/` adds 9 scenarios (corpus 306 → 315).
Deferred by design: Excel emit, `dcf` coupling, defaults entries, and any
shared period-schedule abstraction (a future hospitality RevPAR ramp should
reuse §4.25's period grammar, not invent one).

**✅ RFC 0011 capability tokens — accepted and implemented 2026-09-01**
(protocol 1.12.0, new **§XIV**; future work renumbered §XV). An opt-in
second gate on writes: a scope-limited JWT verified by the editor before
accepting an edit. The load-bearing rule is **tokens narrow, never widen** —
the static §V.3 policy runs regardless and a token cannot override its
refusal, which also resolves the RFC 0031-era question: `institution/*`
keeps `system_only`. `sub` binds `_meta.source` under the 0031 actor
grammar (`agent/L2.inst-A`); free-text `actor` takes no part. Core stays
crypto-free — `CapabilityVerifier` is injected (the RFC 0016 precedent),
honored by `applyEditAsync` only (sync path refuses with `PROTO-EDIT-008`);
refusals are `POL-03` with a typed reason; an accepted token's `jti` is
recorded as `capability:<jti>` in the new block's notes. The reference
verifier + `signCapabilityToken` live in `@uwmd/signing` over the existing
KeyStore. `uwmd edit --capability-token --coord-key` (optional-peer dynamic
import). Generated `conformance/capability/` suite, 8 scenarios including
the no-escalation pin (corpus 315 → 323), owed only under the new
`capability-verify` capability.

**✅ RFC 0001 display-locale negotiation — accepted and implemented
2026-09-01** (protocol 1.13.0, new **§III.1a**). Declare-and-refuse: the
file states its locale (frontmatter, default en-US), the implementation
states what it renders (`supported_locales`), and an unsupported locale
refuses display renders (`LOC-01` / `UnsupportedLocaleError`) rather than
silently switching. **Display-only by construction** — canonical JSON, CSV
renders, Lite canonical form, digests, and calc are locale-free
(calc invariance pinned by fixture). Formatting for the five non-en-US
first-wave locales (en-GB, de-DE, fr-FR, ja-JP, zh-CN) comes from the
curated `BUILTIN_FORMAT_RULES` registry, never runtime Intl/ICU; en-US
keeps its historical path byte-identical. New `conformance/locale/` suite,
8 scenarios (corpus 323 → 331). Currency-code disambiguation deliberately
deferred to its own RFC.

**Phase 2 is complete.** All three owner-ordered builds (0008 → 0011 →
0001) accepted and implemented in one day; corpus retrieval (0013) and
portfolio/relationship profiles (0015) stay deferred to a later sprint.
**Phase 3 is done too**: 1.9.0 cut and published 2026-09-01 (PR #124, tag
`v1.9.0`) — core/cli 1.9.0 and signing 0.2.0 live, coordinated repins
landed (excel/report 0.8.0, batch 0.7.0, web-editor 0.8.0, hospitality
repin-only). The signing trusted publisher is configured, so all three
packages now release hands-off on any `v*` tag. **Phase 4 resolved 2026-09-01: the owner opened the 2.0 train.** RFC 0009
was revised to acceptance-ready (PR #126 — four open questions resolved by
the owner: `lifecycle.version`→`revision`, `integrity.algorithm` added
defaulting `'sha256'`, no mixed shapes per file, `manual` leaves
`SOURCE_TAGS` at 2.0; plus the previously missing canonicalization section:
v1 rule frozen forever, v2 rule is normalize-then-hash so both parser
shapes digest identically, signatures don't survive migration —
`--resign`/`--strip-signatures` is the key holder's explicit choice) and
**accepted**. The train: a **1.10.0 on-ramp** — **implemented 2026-09-01**
(protocol **1.14.0**, corpus **341**: the shim + flat parse view,
versioned canonicalization with the frozen v1 rule, the `META-*` family,
`migrate --to-v2` with the refuse/`--resign`/`--strip-signatures`
signature policy, `PROTO-EDIT-010` guarding v2 files from 1.x edits, and
the `meta-v2` + `migrate` suites) — then the `STAGE_CONTRACT` merge, also
**implemented 2026-09-01** (one registry with asset_class-qualified rows
absorbs STAGE_REQUIREMENTS + the RFC 0029 overlays +
INCOMPLETE_DATA_POLICIES; equivalence-tested, no behavior change, no
protocol move) — then the **1.10.0 release (shipped 2026-09-01**, tag
`v1.10.0`, all three packages live via OIDC), and the **2.0 cut, both legs
implemented 2026-09-02**: leg A = `UW_FORMAT_SPEC_v2.md` (a delta spec
over v1) + `uwmd-block-v2.schema.json` (#132); leg B = protocol **2.0.0**,
authoring format **2.0** with the whole 1.x line still read
(`SUPPORTED_FORMAT_VERSIONS`; module ranges checked against the supported
sets), full v2 editing through one writer seam (`PROTO-EDIT-010` retired;
`init` scaffolds 2.0 by default with `--format 1.1` opt-out), the
per-file SRC escalation + new `SRC-03`, `manual` out of `SOURCE_TAGS`,
the structured-`.uw.md` sniffing sunset (`SOURCE_LEGACY_STRUCTURED`), and
the corpus renamed to spec-compliant `.uwx.md` extensions. **The train is
complete: 2.0.0 released 2026-09-02** (PR #134, tag `v2.0.0`) — `@uwmd/core`
2.0.0 and `@uwmd/cli` 2.0.0 live on npm via OIDC, `@uwmd/signing` 0.2.2
(repin-forced patch), with excel/report 0.8.2 and batch 0.7.2 repins landed
(unpublished). RFC 0009 is **implemented**; underwriter.cc acknowledged the
2.0 release. The parallel human-only track stays open (PCG64
vector diff, security alias, public RFC venue, bus-factor note).

**Unblocked (was blocked on 0031):** `_meta` v2 reorg (0009), and its **draft
was revised 2026-08-31** to absorb the split: `provenance` now carries both
`source` (actor) and `resolution` (method), the shim applies RFC 0031's
read-time interpretation (a legacy tag reshapes to `resolution` with the actor
left absent, never invented), `market_data_ref` / `inherited_from` /
`signature` — all of which landed after the April draft — are slotted, the
deprecation timeline is re-anchored on the shared Protocol 2.0 boundary from
RFC 0025 (where `SRC-02` also flips to error), the `STAGE_CONTRACT` merge now
absorbs RFC 0029's class overlays, and a new compatibility bullet flags that
moving `content_hash`/`signature` under `integrity.*` makes canonicalization
shape-sensitive — that needed v2 spec text, which RFC 0009's format 2.0 delta
spec supplied (§5, canonicalization v2 = normalize-then-hash). **RFC 0009 was
accepted 2026-09-01 and is implemented — shipped in the 2.0.0 release
2026-09-02.** The RFC 0011 edit-authority question it raised was settled by
0011's implementation: `institution/*` keeps `system_only` (tokens narrow,
never widen).
See [`docs/rfcs/`](../rfcs/) and [11 — Governance](11-build-release-governance.md).

## ⚙️ Operational — gates the public launch

> **Current state (2026-09-02):** the repository is public and the live npm
> surface is `@uwmd/core@2.0.0`, `@uwmd/cli@2.0.0`, and `@uwmd/signing@0.2.2`,
> all publishing hands-off on `v*` tags via OIDC trusted publishers. The CLI
> package is scoped because npm rejects the unscoped `uwmd` name; its
> executable remains `uwmd`. The ExcelJS dependency chain was **formally
> risk-accepted 2026-09-01** (see the Operational section) — the publication
> hold on `@uwmd/excel` is no longer a dependency question, only a scheduling
> one.

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
> **The last asset class is done.**
> [RFC 0019](../rfcs/0019-mixed-use-composition.md) (`mixed_use` composition —
> gated the last asset class) was **accepted 2026-08-18** and is **implemented
> 2026-08-19**: the `mixed_use` pack, `MIXED_USE_DEFAULTS`, the `components`
> schema, the validator rules, the Excel layout + worked example, and the
> conformance fixtures have all landed. The newly spun-out
> [0026](../rfcs/0026-capital-stack.md) (typed capital stack — senior/mezz/pref
> tranches and stack-aware DSCR/debt-yield; asset-class-independent, and the
> primitive 0019's component-level debt builds on) was **accepted 2026-08-20**
> and is **implemented 2026-08-22**. It settled on **state-and-verify** (RFC
> 0021 §6), which expresses an arbitrary tranche count off the calc engine, and
> deliberately **splits scope**: a buildable v1 (tranches + stack-aware sizing +
> preferred-equity return/accrual + a placeable bridge slot) with the multi-period
> **distribution waterfall documented and deferred** to a later phase (it needs a
> hold-period cash-flow primitive the format lacks; its boundary is enforced by
> `CS-WATERFALL-UNSUPPORTED`). **Everything shipped:** the `capital_stack`
> format section (§4.24) + `section-capital-stack.schema.json`; the core
> verifier (`capital-stack.ts` — `verifyCapitalStack`, three-state, a sibling
> of `verifyRollup`) and the validator rules (`CS-01`, `CS-02`,
> `CS-WATERFALL-UNSUPPORTED`, generalized `CC-03`); the Excel **Capital Stack
> sheet** (one row per tranche + live sizing block quantized at the verifier's
> own `CAPITAL_STACK_SIZING_DECIMALS`, additive for every asset class); the
> **conformance fixtures** — the seven scenarios the RFC names under
> `conformance/capital-stack/`, including the no-stack single-loan additivity
> pin and the enforced §E waterfall refusal; the **MU-06 relaxation** — §4.23
> accepts a component-level `capital_stack` (same `CS-*` validation, fields
> prefixed `<key>.capital_stack.`; bare component `debt_structure` stays
> refused, and the generalized `CC-03` stays top-level-only); and the **worked
> example** (`examples/Agave-Court-Apts-Scottsdale-AZ.uwx.md`) — a
> senior + mezz + pref + common multifamily deal whose stack foots to its
> sources and uses and whose six stated sizing figures all verify.
> [0020](../rfcs/0020-uwx-terminology-alignment.md) was
> flipped to `implemented` 2026-08-17: its prose had already landed in the specs
> and examples, so `draft` was recording a gap that no longer existed.

### Large

1. ~~**DOCX path — or formally scope it out.**~~ **Scoped out 2026-09-01** —
   the legitimate outcome this item asked to have recorded. See the entry under
   "Stubs / not implemented" for the rationale and the revisit condition.

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
4. ~~**Web-editor field catalog asset-class awareness.**~~ **Done 2026-08-23.**
   `fieldsForSection(section_id, asset_class)` now narrows the quick-edit grid,
   and the catalog carries the size intensive for every class rather than
   multifamily's alone — the bug had two halves, and only one of them was the
   one written down here. A land deal was indeed offered "Total units"; the
   *other* half is that an office, retail, industrial, self-storage,
   hospitality, or land deal had been offered **no** size input at all, because
   `rentable_square_feet` / `gross_leasable_area` / `net_rentable_square_feet` /
   `keys` / `gross_acres` were never in the catalog. The denominator of every
   per-unit metric on the strip was reachable only through the collapsed
   generic all-fields editor.

   The filter is **opt-out**, as this item asked: a field is dropped only when
   the class is known *and* the field names other classes, so an unset or
   unrecognized `asset_class` sees everything, class-independent fields
   (`year_built`, `parking_spaces`) are never scoped, and `mixed_use` is
   deliberately unfiltered — a mixed-use record may carry any use's intensive,
   and its per-component figures live in the `components` section anyway.
   Nothing became unreachable: `GenericFieldEditor` still surfaces every scalar
   leaf.

   > **The pin is a coverage direction, not an equality.** `catalog.test.ts`
   > walks each pack's formulas for `property.*` reads and asserts the grid
   > offers every one of them to that class — the grid must never omit an input
   > the metric strip divides by. Equality would be wrong: senior housing
   > states `total_beds` alongside the `total_units` its pack actually uses. The
   > assertion also counts what it checked and fails at zero, because a
   > formula-scanning loop that matches nothing passes silently.
   >
   > A second thing surfaced: `spec/UW_FORMAT_SPEC_v1.md` §4.1's property
   > payload names only `total_units` / `total_nra_sqft` / `land_area_*`. Every
   > other class intensive is established by the packs and the worked examples
   > and appears nowhere in the normative section. That is a spec gap, not a
   > code one, and closing it is normative work — see the note under
   > "Stubs / not implemented".

### Small, unblocked, high value per hour

4a. ~~**Accept or reject [RFC 0027](../rfcs/0027-asset-class-size-intensives.md)
   (size intensives), then implement it.**~~ **Accepted and implemented
   2026-08-25** across four PRs: spec (#90 — §4.1 fields + field notes, §5.3
   `CC-13`, Protocol §XIII registry with Future work renumbered to §XIV, Lite
   §8 anchor rows), core (#91 — the executable registry + validator +
   csv/summary/chat/report/lite consumers, 33 new tests), consumers (#92 — the
   Excel layouts and web-editor grid now derive from the table), and the
   `conformance/size-intensive/` group (this change, corpus 215 → 222). The
   load-bearing claim held: no metric, receipt verdict, or Excel parity
   assertion moved; the only baseline update is `tier-1/04-scope-only`, which
   states `"units"` — a field no consumer reads — and now truthfully warns.
   One errata: the RFC said "protocol §XI (new)", but §XI was already the
   Error Taxonomy, so the registry landed as **§XIII**.

   > **The `CC-13` severity question is settled (scanned 2026-08-24, Appendix
   > A of the RFC): keep it a warning, and the reason is not the one expected.**
   > Escalating to error at `full_underwrite` would newly refuse 6 corpus
   > documents, all conformance fixtures, all because they have no property
   > section at all. Add the precondition that `CC-13` fires only when a
   > property section exists and the escalation refuses nothing — so the
   > *applicability preconditions* decide this, not the severity. The scan also
   > showed `deal_stage` cannot carry the gate: `full_underwrite` is boilerplate
   > in minimal fixtures, not a completeness claim. All eleven UWX worked
   > examples already state their primary size field; 37 of 67 in-scope
   > documents that don't are conformance fixtures, none of them examples.
   >
   > Two spin-offs. **Nothing enforces that the property section exists** —
   > §4.1 says it is required at all stages, and 22 in-scope corpus documents
   > omit it and still validate `clean`/`warnings` (a 2026-08-26 re-scan over
   > all seven stage tables counts 28). **Closed 2026-08-26 by
   > [RFC 0028](../rfcs/0028-reportable-section-readiness.md) (implemented):**
   > `CC-14` warns on the missing property section, `DQ-06` (info) mirrors
   > `stage_readiness` into the issues stream, §5.1 gained its missing scope
   > row, and `operating_statement` re-joined `STAGE_REQUIREMENTS` at
   > full_underwrite+ (the validator's dead variant-aware `hasSection` case
   > was the fossil of the lost requirement). `CC-13` deliberately does not
   > absorb it — one defect, one diagnostic.
   >
   > **Follow-up (closed 2026-08-26): all twelve worked examples are
   > stage-honest** — zero `DQ-06` notes across the corpus. Seven class
   > examples (retail, industrial, student, senior, office, hotel, storage)
   > gained the five missing sections (`operating_statement` reconciled to
   > the NOI model, `preliminary_sizing` against the three standard
   > constraints, `borrower_sponsor`, `market_analysis`, `validation`), with
   > numbers derived from each file's own sections so CC-01/CC-05 hold. The
   > Parkview twins gained `preliminary_sizing` — truthfully recording that
   > the proposed loan *exceeds* the DSCR and debt-yield sizings, the same
   > tension their FV-04 warning already carries. The three feature-focused
   > examples (Agave/capital-stack, Roosevelt/mixed-use, Sundance/land)
   > restaged to `screening` + `validation` instead: a property-level
   > `rent_roll` is wrong for land and mixed-use, which is itself a finding —
   > **stage requirements are class-agnostic** — **closed 2026-08-26 by
   > [RFC 0029](../rfcs/0029-class-aware-stage-requirements.md)
   > (implemented)**: a two-row §5.1 overlay (`land` exempt from
   > `rent_roll`/`operating_statement`, `mixed_use` substituting
   > `components` for both), mirrored by `STAGE_SECTION_OVERLAYS` /
   > `requiredSectionsFor()` and pinned by three Tier-1 fixtures (corpus
   > 245 → 257). Sundance and Roosevelt restaged upward the same day: both
   > gained `borrower_sponsor` / `preliminary_sizing` / `market_analysis`
   > (Sundance's sizing is LTC-governed — the only test with meaning against
   > a negative carry) and now declare `full_underwrite` with
   > `stage_readiness` true and zero `DQ-06`. Agave stays `screening` by
   > choice: it is multifamily (no overlay), its subject is the capital
   > stack, and a rent roll + operating statement would be padding there. `DQ-06` severity can still be revisited by a future
   > RFC on an honest corpus. And
   > **conformance would not have caught the escalation**: Tier-1 `malformed`
   > matches expected codes as a subset and Tier-1 valid fixtures asserted
   > nothing about validation, so a new error code would flip `uwmd validate`
   > to exit 1 on six fixtures with the suite still green. *(The valid-fixture
   > half of this is closed as of 2026-08-25 — each now freezes its validation
   > verdict, so an escalation is a visible baseline diff; see the Conformance
   > entry above. The `malformed` subset-matching half is by design.)*

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

   > **The corpus could not have caught this** (closed 2026-08-25 — the
   > `decimal-exactness-percent-vs-fraction` equivalence group now pins it;
   > see the Conformance entry above). At the time of the fix: every
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
    security email, and no public RFC venue remain review-flagged.
    **The ExcelJS dependency chain is formally risk-accepted (owner decision,
    2026-09-01):** `@uwmd/excel` only ever *writes* workbooks from trusted
    in-repo data (`toWorkbook`) or reads files the operator explicitly names
    (`fromWorkbook`), it runs in build/CLI contexts rather than serving
    untrusted uploads, and its output parity is pinned by tests — so the
    residual exposure is a malicious-workbook parse the tool is not deployed
    against. Accepted rather than re-vendored; revisit if the converter ever
    ingests third-party workbooks as a service. Publishing `@uwmd/excel`
    remains unscheduled (its 0.3.0 number is burned; the next publish would be
    current-version), but is no longer blocked on this flag.
    **`@uwmd/signing` will publish (owner decision, 2026-09-01):**
    `release.yml` now publishes it on any `v*` tag whose manifest version is
    not yet on npm — so 0.1.0 goes live with the 1.9.0 tag, *provided* the
    one-time npm trusted-publisher step in
    [`docs/handoff/HUMAN-configure-signing-trusted-publisher.md`](../handoff/HUMAN-configure-signing-trusted-publisher.md)
    is done first (it is owner-only). Every publish step in the workflow is
    now idempotent (skip-if-live), so a partial run is recoverable by re-run.
    `@uwmd/module-hospitality` deliberately stays unpublished — it is a
    reference implementation, not a dependency.

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
