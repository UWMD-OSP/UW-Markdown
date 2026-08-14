# 13 — Build status (living document)

**Review update:** 2026-07-26 — RFC 0014 Phases A–E are implemented;
owner-led governance is active.
**Last verified:** 2026-08-13 at `30bfe60`+ (full pass: build green across all
workspaces; **737 tests** — 615 core, 69 excel, 46 cli, 4 batch, 3 report — plus
**63 web-editor**; **107 conformance** assertions including the Tier-4 replay
suite; 10/10 schemas valid; Biome clean over 284 files).
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
  `pmt/fv/pv/nper/irr/npv`, full error taxonomy, property tests. See [04](04-calc-engine.md).
- **Nine asset-class packs:** `MULTIFAMILY_PACK` (8 metrics), `OFFICE_PACK` (11),
  `RETAIL_PACK` (12), `INDUSTRIAL_PACK` (12), `SELF_STORAGE_PACK` (12),
  `HOSPITALITY_PACK` (14), `SENIOR_HOUSING_PACK` (14), `STUDENT_HOUSING_PACK` (14),
  `LAND_PACK` (12, and deliberately no cap rate / DSCR / debt yield — land is not
  an income property), selectable via `getPackForAssetClass`. The Excel converter
  has a `WorkbookLayout` per class (selected via `getLayoutForAssetClass`); its
  `toWorkbook.test.ts` computes parity for all nine (operating statement foots —
  for land a carry statement that nets negative; metrics == evaluateCalc
  to 6 decimals). Pack-level parity also pinned in each `packs/*.test.ts`. See
  [05](05-calc-packs.md), [08](08-tools.md).
- **v1.1 train:** integrity (`integrity.ts`, `uwmd verify`), `cascade.ts` +
  `defaults.ts`, `gaps.ts`, `INCOMPLETE_DATA_POLICIES`, `context-profiles.ts`,
  `refinement.ts`, L0a/L0b layers, `scope` stage.
- **CLI:** 19 commands (incl. `export` → `.uw.json` and `receipt issue|verify`).
  See [08](08-tools.md).
- **Batch collection indexer:** `@uwmd/batch` provides a deterministic local JSON/CSV read model over a directory of `.uwx.md` files. It validates the required envelope, records semantic digests, and isolates invalid candidates without defining a database protocol. See [08](08-tools.md).
- **Machine interchange Phases A–E:** Envelope 1.0, normative schemas, UW JSON
  1.0, UW XML 1.0, normalized UW CSV Bundle 1.0, semantic digest/equivalence
  helpers, codec registry, safe ZIP extraction, all six CSV views, and CLI
  conversion are implemented and tested. See [03](03-core-library.md).
- **Conformance:** **107 assertions** across 4 tiers plus the named `lite`,
  `receipts`, and `4-replay` suites. CI gates tiers 1–3, both named suites, and
  the deterministic Tier-4 replay suite. See [09](09-conformance-testing.md).
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
  imports `@anthropic-ai/sdk`, and `bancroft.ts` reaches it through a *dynamic*
  import, so a host supplying its own provider never loads the SDK at all. A
  test asserts the absence of a static import. `BancroftRunOptions` gained
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
- **Module system is declarative-only.** `modules.ts` validates and registers
  in-process `ModuleManifest` objects (shape, formulas, dependency load order,
  tier/protocol/format compatibility), but there is no dynamic import, signing,
  or custom asset-class declaration support.
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
  was ratcheted (T17, 2026-08-13) from 70/70/90/70 to **76 lines, 76 statements,
  95 functions, 74 branches**, roughly a point under measured. Falling through a
  floor fails CI.

  > **Reading the number honestly.** Measured core coverage is **~80% lines**,
  > up from ~77% once T9's provider seam made `agents/` testable at all. What
  > remains at 0% is mostly not untested logic: `index.ts` and `browser.ts`
  > (838 lines) are pure re-export barrels with nothing to cover, and `cli.ts`
  > (1,104 lines) *is* exercised — by the CLI smoke tests in
  > `packages/uwmd-cli`, which do not count toward this package's number.
  > Excluding just the two barrels the figure is ~85%. Worth deciding whether
  > the `exclude` list should reflect that — a floor over a denominator padded
  > with re-export lists is a weaker signal than it looks. Deliberately left out
  > of T17, which only moved the floor.

  The **web-editor** has its own Vitest suite (63 tests, 8 files): the
  `runEdit()` chokepoint + catalog helpers (node), jsdom component tests for the
  footed surfaces and inline-remediation wiring, receipt issuance/verification
  incl. the stale-vs-failed distinction and a forced Web-Crypto path, an
  axe-core a11y smoke check, and the metric strip's asset-class awareness (T14).

  > **Test files are not typechecked.** `tsconfig.json` excludes
  > `src/**/*.test.ts` and Vitest transpiles with esbuild, so a type error in a
  > test is invisible to both `npm run build` and `npm test`. Any compile-time
  > assertion written in a test file — an exhaustiveness `Record`, a `satisfies`,
  > an expect-error helper — is therefore **inert**. Put it in a source file
  > where `tsc` sees it; `ASSET_CLASSES` in `types.ts` is the worked example.
  > This cost real time during T16 before it was noticed.
- **Examples = 9 deals** (multifamily, office, retail, industrial, self-storage,
  hospitality, senior housing, student housing, land) plus `parkview-after-L6`;
  other loan types undemonstrated. All are `.uwx.md` as of RFC 0020 — they were
  structured records on the legacy `.uw.md` extension, which the project's own
  detector flagged on every load.

  > **No UW Lite example exists.** The repo specifies Lite normatively in
  > `spec/UW_LITE_SPEC_v1.md` and ships zero instances of it. That gap is
  > plausibly *why* the two representations blurred together in the docs for so
  > long. Small, cheap, and worth doing to stop the confusion recurring.
- **Docs on-ramps partial.** Tutorial/glossary/tools-comparison exist; cookbook,
  FAQ/troubleshooting, and a calc "calling-convention" guide are still missing.

## 🔴 Stubs / not implemented

- **DOCX rendering** — the Word credit-memo target has no pipeline. The core
  renderer now rejects `docx` explicitly with typed `UnsupportedRenderFormatError`
  instead of returning an apparently successful empty document. PDF is built via
  `report.ts` + `@uwmd/report`; the core `pdf` target rejects with guidance to use
  that package.
- **Market-data / investor-profile** — interface-only; no reference implementation.
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

> **Legacy `.uw.md` sniffing has no expiry.** RFC 0017 introduced it as a
> transition path and RFC 0020 deliberately declined to schedule its end. That
> decision should be made before 1.0 rather than drifting into permanence.

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

> **Blocked on acceptance, not on code.** Three RFCs are drafted and awaiting the
> owner's decision; nothing should be implemented against them until then:
> [0018](../rfcs/0018-document-profiles-and-deal-packages.md) (document profiles
> and deal packages), [0019](../rfcs/0019-mixed-use-composition.md) (`mixed_use`
> composition — gates the last asset class), and
> [0020](../rfcs/0020-uwx-terminology-alignment.md) (the `.uwx.md` terminology
> correction, whose prose has already landed).

### Large

1. **DOCX path — or formally scope it out.** PDF landed via `report.ts` +
   `@uwmd/report`; Word remains the gap for institutions that edit memos. If it
   is built, reuse `report.ts`'s deterministic model rather than forking the
   renderer, and keep core's typed `UnsupportedRenderFormatError` pointing at the
   new package as `pdf` already does. Scoping it out is a legitimate outcome and
   should be recorded as one rather than left ambiguous.

### Medium

2. **Module loader hardening.** The v1 in-process loader exists; next steps are
   richer schema validation, recorded fixtures, and host UX for loading manifests
   from files. Module signing (RFC 0002) and custom asset-class identifiers
   (RFC 0003) stay v2/RFC work and are explicitly out of scope.
3. **Market-data / investor-profile reference implementation.** Interface-only
   today, so the top two cascade steps have no worked example.
4. **Batch workflow expansion.** Deterministic filters, summaries, and
   underwriting-queue projections over the collection index. `.uwx.md` remains
   the canonical source; shared storage semantics only through a future RFC.
5. **Web-editor field catalog asset-class awareness.** `fieldsForSection()`
   filters by `section_id` only, so a land deal is offered a "Total units" input
   and a student-housing deal gets one too, though that class sizes per bed. The
   metric strip is already class-aware and pinned (T14); this is the input side.
   Needs the per-class field mapping decided first — hiding a field users need is
   worse than showing a spare one, so default to opt-out.

### Small, unblocked, high value per hour

6. **A UW Lite worked example.** Lite is normatively specified and has zero
   instances in `examples/`. Cheapest item here and it removes the root cause of
   the Lite/UWX documentation drift RFC 0020 had to correct.
7. **Decide the coverage `exclude` list.** Measured ~80% is padded by 838 lines
   of re-export barrels; excluding them the figure is ~85%. A floor over a
   padded denominator is a weaker signal than it looks.
8. **Decide when legacy `.uw.md` sniffing ends.** RFC 0017 introduced it as a
   transition path with no expiry, and RFC 0020 declined to set one. Worth
   settling before 1.0 rather than letting it drift into permanence.

### Ongoing

9. **Docs on-ramps.** Cookbook, FAQ/troubleshooting, and a calc
    "calling-convention" guide are still missing.
10. **Operational launch gates** — single-maintainer bus factor, personal
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
