# Changelog

All notable changes to UW Markdown — the format spec, the protocol spec, the
reference library `@uwmd/core`, the conformance corpus, and starter tools — are
documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project follows semantic versioning per surface (the format, the
protocol, and each package each carry an independent semver).

## [Unreleased]

### Governance
- **RFC 0018 accepted (2026-08-13)** — document profiles and deal packages.
  Approves `lease-abstract-v1` and `source-note-v1`, the UW Deal Package
  (`.uwpkg.zip` with a manifest carrying per-member `sha256` and
  `semantic_digest`), the source-file-free connector JSON context view, and the
  canonical two-layer edge registry. Both of its previously blocking questions
  were resolved in the text before acceptance; the remaining open items (legal
  vocabulary, amendment consolidation, package signing, OCR profile) are
  explicitly deferred rather than blocking. No code has shipped against it yet.

  Acceptance settled edge-registry ownership under 0018's own §5 rule: **whichever
  of 0018/0015 was accepted first owns the registry**, so the canonical
  entity-plus-member edge vocabulary now belongs to the protocol spec as 0018
  defines it, and RFC 0015's edge list is superseded by that section. A later
  acceptance of 0015 amends that section rather than starting a second table —
  which was the entire point of writing §5.

  This unblocks RFC 0021 (composition) and RFC 0022 (market data)
  architecturally; both still require their own acceptance.

### Added
- **Module loader hardening, and a conformance suite that keeps it honest (T13).**
  `modules.ts` validated `calculations` and `validations` and stopped —
  `sections`, `view_models`, and `agent_layers` were constrained by
  `spec/schemas/module-manifest.schema.json` and validated **nowhere**. Running
  identical manifests through ajv and the loader disagreed on **seven of eight**
  probes. `agent_layers` was the one that mattered most: it carries
  `prompt_template`, making it Tier-4 prompt surface, and it accepted
  `prompt_template: 42`.

  The loader is now schema-complete — all three constructs validated, unknown
  keys refused at every level (`additionalProperties: false`), `depends_on`
  shape-checked, length bounds enforced — with pointer-level error codes
  (`PROTO-MOD-033` … `PROTO-MOD-066`).

  New `conformance/modules/` suite (22 assertions, runs by default, no network):
  every fixture is checked against both the loader **and** ajv, and the suite
  fails when the two disagree. `@uwmd/core` cannot depend on a JSON Schema
  validator under the layering invariant, so the hand-written mirror needed an
  external referee. Two deliberate divergences — requiring `deterministic: true`,
  and parsing the safe-expression grammar, neither expressible in JSON Schema —
  are declared per fixture with a stated reason; the reverse direction has no
  opt-out.

  New `uwmd modules validate|list` for module authors, reporting the exact
  failing declaration rather than a bare refusal.
- **A UW Lite worked example — the first one the repo has ever shipped (T11).**
  `spec/UW_LITE_SPEC_v1.md` has specified UW Lite normatively since RFC 0017
  while `examples/` contained zero instances of it, which RFC 0020 identified as
  a plausible root cause of the Lite/UWX drift it had to go back and correct.
  `examples/Parkview-Apts-Glendale-AZ.uw.md` closes the gap deliberately as a
  **twin** of the existing record: same deal, same deal id, same base name, both
  extensions adjacent in the directory listing, so the distinction is visible
  before either file is opened. The numbers are the record's own — including the
  underwritten NOI of $396,635 rather than the $412,096 trailing-twelve actual,
  a distinction the example calls out because it is exactly what a bare
  spreadsheet cell leaves ambiguous.

  The example states no DSCR and no LTV. Both are derived, and the prose says so
  and quotes what the multifamily pack computes (DSCR 1.1091, LTV 0.7000, cap
  rate 0.0551, debt yield 0.0787). Those four values were evaluated through the
  pack, not asserted, and three CLI smoke tests now pin them — an example whose
  prose quotes numbers nothing checks is an example that rots. Projecting the
  complete record back down to Lite reports **7 projected paths against 1,215
  omitted**, which is the most concrete statement of the split available.

### Fixed
- **Duplicate module ids silently shadowed each other.** Two manifests sharing an
  id both loaded and `byId` returned whichever came last, so a registry lookup
  resolved to the wrong module. Now refused with `PROTO-MOD-066`.
- **A typo'd construct name discarded a module's work in silence.**
  `calculationz: [...]` loaded clean and contributed nothing, with no error.
- **`requires_protocol: "^1"` was silently unsatisfiable.** Only `X.Y` was padded
  to full semver, so a bare major failed to parse and every range containing one
  failed to match — while the schema's own description documents `^1` as valid.
- **A malformed `depends_on` misreported itself.** `depends_on: ["other"]` was
  iterated character by character and surfaced as
  `Missing module dependency: undefined`.
- **CI never ran the Tier-4 replay suite on pull requests.** `ci.yml` pinned
  `--tier=1,2,3,lite,receipts`, so the `4-replay` suite added in T10 ran only in
  `release.yml`. Both CI steps now call `npm run conformance` and take the
  runner's default list, so adding a suite to the default is enough to gate PRs.

### Changed
- **Errata: `module-manifest.schema.json` was missing the `scope` deal stage.**
  `DealStage` in `types.ts` has carried `scope` since the v1.1 train, so a
  manifest the loader accepted was invalid against the normative schema. Treated
  as errata rather than an RFC because it aligns a stale mirror to an
  already-accepted decision rather than making a new one.
- **`uwmd init` wrote structured UWX content to a `.uw.md` file.**
  `generateBlankUWFile()` emits `uw_version` and fenced `uw:section=` blocks, but
  the default output filename was `new-deal.uw.md` (or `<name>.uw.md`), so the
  CLI produced exactly the file the format spec forbids and
  `detectUWSourceRepresentation()` flags as legacy on the next load — every deal
  a newcomer scaffolded was born legacy. Now `.uwx.md`.
- **`uwmd export` and `uwmd report` appended to a `.uwx.md` name instead of
  replacing it.** `replaceUWExtension()` did not list `.uwx.md`, so a UWX input
  fell through to the append branch: `uwmd export deal.uwx.md` wrote
  `deal.uwx.md.uw.json` rather than `deal.uw.json`, and `report` likewise emitted
  `deal.uwx.md.report.html`. (`.uw.md` never matched a `.uwx.md` filename — the
  suffixes genuinely differ — so it failed silently rather than mis-matching.)
  `report` now routes through the same helper instead of its own inline check,
  so every UW source extension is handled in one place. Legacy `.uw.md` inputs
  resolve exactly as before.
- These three had **no test coverage at all**, which is how they survived the
  `.uwx.md` migration. Five CLI smoke tests now pin the default output paths,
  including a regression case for legacy `.uw.md` input.

### Changed
- **The format spec now describes `.uwx.md`, the extension it has specified
  since RFC 0017.** `spec/UW_FORMAT_SPEC_v1.md` still called itself the `.uw.md`
  specification and opened by declaring a `.uw.md` file "the canonical,
  lossless" record — the exact claim accepted RFC 0017 moved to `.uwx.md` when
  it split UW Lite from UWX. It contained zero occurrences of `.uwx.md`. Since
  the docs site renders the spec directly, uwmd.org repeated the error to every
  visitor. Retitled, realigned throughout, and given a **Naming** section fixing
  the vocabulary: *UW Markdown* is the standard, `.uwx.md` is the lossless
  record, `.uw.md` is UW Lite — a current, deliberately lossy view, **not** a
  superseded predecessor, which is where the `.doc`/`.docx` analogy stops. Same
  alignment applied to the protocol, XML, and CSV specs and to `README.md`.
  No behaviour change; the library already emitted `.uwx.md`. See RFC 0020.
- **The ten worked examples were renamed to `.uwx.md`.** Every file in
  `examples/` was a structured record carrying the legacy extension, so the
  project's own detector flagged each one — *"Structured UWX content uses the
  legacy .uw.md extension; migrate it to .uwx.md."* The examples are the most
  copied artifact in the repo and were modelling deprecated usage. Content is
  byte-identical; 41 referencing files were updated by path only.

### Added
- **The Tier-4 agent host is provider-neutral (T9).** Protocol §IX has always
  described it that way, but `agents/bancroft.ts` constructed an Anthropic
  client on every run and typed its internals against the SDK — so the claim
  could not be demonstrated, and `agents/` sat at 0% coverage because exercising
  it needed a network call and an API key. New `AgentProvider` contract
  (`complete()`, optional `stream()`, neutral request/completion types) with no
  vendor import; `agents/providers/anthropic.ts` is now the only file importing
  `@anthropic-ai/sdk`, reached through a **dynamic** import so a host bringing
  its own provider never loads it. `BancroftRunOptions` gains `provider` and
  `apiKey` becomes optional — additive; existing callers are unaffected.
  Streaming falls back to `complete()` for providers that cannot stream.
- **Recorded-replay Tier-4 conformance (T10).** Tier-4 was shape-and-lint only:
  fixtures were parsed and nothing ran, so nothing checked that a host writes
  what the protocol says it writes. The `l6-risk-rating` fixture was in fact
  **un-runnable** — it carries only a `property` section while L6 requires
  `noi_model`, `valuation`, and `debt_structure`. New `createRecordingProvider`
  / `createReplayProvider` plus a `4-replay` conformance suite that replays a
  cassette through the real runner and compares the document **byte for byte**.
  It runs in CI by default because it needs no network and no key. Replay is
  strict — a request that no longer matches its recording is a typed error
  naming the changed field — so a cassette doubles as a prompt-drift detector.
  What it does not prove, and says so in its README, is that any particular
  model produces the recorded answer.
- **`RunOptions.timestamp` / `RunOptions.logEntryId` and `BancroftRunOptions.now`.**
  Agent output was previously non-reproducible: `_meta.timestamp`, `duration_ms`,
  and a random log-entry suffix differed every run, which is why replay could not
  assert on a document at all. A constant clock now freezes all three. Real runs
  leave `now` unset and keep the random suffix that stops same-millisecond
  collisions.
- **`ASSET_CLASSES` — the `AssetClass` union as a runtime list**, exported from
  `@uwmd/core` and `@uwmd/core/browser`. It is *derived* from a
  `Record<AssetClass, true>` exhaustiveness anchor rather than written by hand,
  so adding a member to the union without updating the list is a compile error
  (`TS2741`) instead of silent drift. `modules.ts`'s private duplicate list was
  deleted in favour of it. Additive; no signature changes.
- **`types.test.ts` — a drift guard over the asset-class registries.** Holds the
  calc-pack registry and the defaults registry to `ASSET_CLASSES`, checks each
  pack declares the class it is registered under and each defaults table stamps
  its own class, and pins the `DEFAULT_THRESHOLDS` bands (warning always fires
  before error). `mixed_use` is carried as one documented exception that fails
  loudly the moment its pack lands, so the allowance cannot outlive its reason.
  A matching guard in the web editor's `catalog.test.ts` keeps its own
  asset-class list in step with the format.

### Changed
- **The `@uwmd/core` coverage floor was ratcheted to just under measured.**
  Thresholds had sat at 70 lines / 70 statements / 90 functions / 70 branches
  while actual coverage was ~77 / ~77 / 96.7 / ~75.5 — five to seven points of
  headroom in which coverage could erode without CI noticing. Raised to
  **76 / 76 / 95 / 74**. The gate itself was already blocking:
  `continue-on-error` was removed from the coverage job in `13218c4`, contrary
  to the internal status doc, which still described it as a soft floor. Verified
  the gate actually fails by breaching it deliberately (exit 1) rather than
  assuming it. The remaining ~1 point of margin is sized against real jitter —
  `calc.property.test.ts` runs fast-check with no fixed seed, so coverage varies
  by ~0.2 points between identical runs and a floor set flush to a measured
  figure would fail at random.
- **"No pack registered" negative tests no longer borrow a real asset class.**
  Five tests — in `cascade.test.ts`, `defaults.test.ts`, `toWorkbook.test.ts`,
  `receipts.test.ts`, and the
  `conformance/receipts/refuse/02-no-pack-for-asset-class` fixture — asserted
  that an unregistered class resolves to no pack, no defaults, and no Excel
  layout by pointing at whichever real `AssetClass` member happened to still be
  unregistered. Every new pack therefore broke them and had to shuffle the role
  onward (land → hospitality → senior_housing → student_housing → mixed_use).
  With `mixed_use` the last one left, the next pack had nowhere to shuffle to.
  All five now anchor on the synthetic identifier `__unregistered_test_class__`,
  which is deliberately not a member of the `AssetClass` union and must never
  become one. No test or fixture references `mixed_use` any more, so the final
  pack can be written without touching them. Behaviour is unchanged — the
  public API already accepted `string`, so no casts or signature changes were
  needed.
- **Canonical repository moved to the project organization** — every source,
  download, example, raw-content, and clone URL now points at
  `github.com/UWMD-OSP/UW-Markdown`. Package `repository` metadata, the
  docs-site nav/footer/edit links, the `llms.txt` corpus, and the AI guide were
  all updated in lockstep. Security reports now go to `team@uwmd.org`.

### Fixed
- **Two accepted RFCs were unreachable from the docs-site nav.** RFC 0016
  (verification receipts) and RFC 0017 (the Lite/Extended source split) were
  copied into the site by `prebuild.mjs` and rendered, but the sidebar's RFC
  list stopped at 0015 — so two *accepted*, shipped RFCs could only be found by
  guessing the URL. Added both, plus 0018.
- **`land` was the canonical "no pack registered" example and stopped being one.**
  Registering `LAND_PACK` broke `receipts.test.ts` and the
  `conformance/receipts/refuse/02-no-pack-for-asset-class` fixture, both of which
  used `asset_class: land` to exercise `RCP_PACK_UNRESOLVED`. Both moved to
  `mixed_use` — since superseded by the synthetic-identifier change below, which
  ends the shuffle for good.
- **The hospitality defaults table shipped without its invariant tests.** Every
  asset-class defaults table has a dedicated `describe` block in
  `defaults.test.ts` asserting `low <= central <= high`, the
  `asset_class_default` source stamp, a citation and unit on every entry, and
  the expected field set — except `HOSPITALITY_DEFAULTS`, which was added
  without one and was therefore covered only by the registry-lookup tests.
  Blocks added for both hospitality and senior housing, plus two cross-field
  checks the older tables do not make: that the occupancy and vacancy bands are
  complementary, and that senior housing's labor band sits inside its
  expense band.
- **`npm run lint` was red locally but green in CI.** Biome linted
  `tools/docs-site/public/editor/`, the built web-editor bundle vendored into
  the docs site, producing 7,267 diagnostics from one generated file. The
  directory is gitignored, so a fresh CI checkout never saw it and CI passed;
  anyone running the lint script locally got a wall of noise from a file they
  had not written. Added to the Biome ignore list.
- **`@uwmd/excel` and `@uwmd/report` were building against published core 1.1.0,
  not the workspace.** Both pinned `"@uwmd/core": "1.1.0"` exactly while the
  workspace core was at 1.1.2, so npm could not satisfy the pin from the
  workspace and installed the *published* 1.1.0 into each package's nested
  `node_modules`, shadowing the workspace link. Every build and test in those
  two packages — including the Excel↔calc-engine parity invariant, whose whole
  point is that one pack drives both — was silently verified against a different
  core than the repo's. It went unnoticed because 1.1.0 happened to export
  everything they referenced. Both pins now track the workspace version.
- **VS Code extension silently passed UW Lite files.** It ran the *structured*
  parser over every `.uw.md`; post-RFC-0017 that extension means UW Lite, where
  the structured parser finds no fenced sections — so it reported zero issues
  and a `clean` status for a document nothing had parsed. The parser is now
  chosen from the content via `detectUWSourceRepresentation`: Lite documents get
  `LITE_*` parse errors plus `LITE_COMPILE_*` bridge errors, UWX documents get
  the full structured validator. Diagnostics are also anchored to the line they
  concern instead of all being pinned to line 1. Financial thresholds remain
  unavailable for Lite by construction — `checkFinancialValidity` reads
  `frontmatter.quick_metrics`, which the deal-summary bridge does not populate;
  a toggle for it was prototyped and removed because it did nothing. Extension
  bumped to 0.2.0.

### Added
- **Land calc pack — the ninth asset class, and the first that is not an income
  property.** `LAND_PACK` adds twelve deterministic metrics and **deliberately
  omits `cap_rate`, `dscr`, and `debt_yield`**. Land has no stabilized income:
  its `noi_model` is a *carry model* (taxes, CFD assessments, insurance, site
  security against incidental interim revenue), so NOI is normally negative.
  Capitalizing it would emit a "−1.6% cap rate" that reads as a yield when it is
  a carry burden — confidently wrong output, worse than none. Tests pin the
  omission and assert no land formula reads `net_operating_income` at all. Land
  is underwritten instead on basis and density: `price_per_buildable_unit`,
  `price_per_usable_acre`, `usable_land_ratio`, `basis_per_buildable_unit`,
  `carry_ratio`, and `land_to_sellout_ratio`. `LAND_DEFAULTS` follows the same
  logic and publishes no `rent_roll.*`, expense-ratio, or exit-cap entry, with
  tests asserting those absences and that land's LTV band sits at or below every
  income class. Ships with the `Sundance-Ranch-Land-Buckeye-AZ.uwx.md` worked
  example (160 acres, 552 platted lots, $30k/lot) and a `LAND_LAYOUT` workbook
  layout whose operating statement is a carry statement that nets negative.
- **Student-housing calc pack — the eighth asset class end-to-end.**
  `STUDENT_HOUSING_PACK` adds fourteen deterministic metrics. The class looks
  like multifamily but is not underwritten like it: leases are signed per *bed*,
  so every sizing and occupancy metric keys off `property.total_beds`
  (`price_per_bed`, `loan_per_bed`, `noi_per_bed`, `revenue_per_bed`,
  `rent_per_bed_monthly`, bed-count `occupancy`), and a test asserts no metric
  reads `property.total_units`. The defining metric is `pre_lease_rate` — the
  share of beds committed for the coming academic year — because student housing
  re-leases its entire rent roll on one date, making pre-lease velocity the
  leading revenue indicator. `preleased_beds` and `occupied_beds` are separate
  stored counts measured on different dates, never derived from each other; a
  test pins that they differ. Shipped with `STUDENT_HOUSING_DEFAULTS` (14
  triage-grade ranges including pre-lease rate and per-bed turnover cost, with
  reserves quoted per bed rather than per unit), the
  `Mill-Ave-Commons-Student-Tempe-AZ.uwx.md` worked example (600 beds; 5.75% cap,
  1.30x DSCR, and honest negative leverage at 3.0% cash-on-cash), and a
  `STUDENT_HOUSING_LAYOUT` workbook layout carrying turnover/make-ready as its
  own expense row.
- **Senior-housing calc pack — the seventh asset class end-to-end.**
  `SENIOR_HOUSING_PACK` adds fourteen deterministic metrics. Sizing is per unit
  as in multifamily; the class-distinctive three are `revpor` (revenue per
  occupied unit per month), `labor_ratio`, and `care_revenue_ratio` — the
  numbers that say whether the operator, not the real estate, is carrying the
  deal. `total_labor_expense` is a model-level subtotal rather than an entry
  inside `noi_model.expenses`, so the three labor lines stay in the expense map
  and the operating statement still foots without double counting; the test
  asserts both halves. Shipped with `SENIOR_HOUSING_DEFAULTS` (15 triage-grade
  ranges, including a defaulted labor ratio and wage-growth band), the
  `Ocotillo-Senior-Living-Chandler-AZ.uwx.md` worked example, and a
  `SENIOR_HOUSING_LAYOUT` workbook layout whose income lines carry a signed
  vacancy-loss row.
- **Hospitality calc pack — the sixth asset class end-to-end.**
  `HOSPITALITY_PACK` adds fourteen deterministic metrics keyed off keys
  (`price_per_key`, `loan_per_key`, `noi_per_key`) alongside the shared
  cap-rate / LTV / LTC / DSCR / debt-yield core, plus the four metrics that make
  a hotel an operating business rather than a lease: `occupancy`, `adr`,
  `revpar`, and `gop_margin`. Hospitality has no lease-based rent roll, so
  `rent_roll` carries trailing-twelve room-night statistics (available room
  nights = keys × 365, occupied room nights from the STR report); `noi_model` is
  USALI-shaped, with a `gross_operating_profit` subtotal struck above the
  management fee, fixed charges, and the FF&E reserve. `RevPAR = ADR ×
  occupancy` holds by construction — all three read the same primitives.
  Shipped with `HOSPITALITY_DEFAULTS` (14 triage-grade ranges, wider expense and
  cap-rate bands than the lease-based classes), the
  `Saguaro-Select-Hotel-Tempe-AZ.uwx.md` worked example, and a
  `HOSPITALITY_LAYOUT` workbook layout. `getPackForAssetClass`,
  `getAssetClassDefaults`, and `getLayoutForAssetClass` all resolve
  `hospitality`; Excel↔evaluator parity is pinned to 6 decimals in both
  `packs/hospitality.test.ts` and the converter's `toWorkbook.test.ts`.
- **`.uwx.md` registered in the VS Code extension** — structured records on the
  new extension now get highlighting, folding, outline, and validation, where
  previously they got nothing at all. Structured content still on the legacy
  `.uw.md` extension is detected and nudged toward migration.
- **Receipt verification in the VS Code extension** — a
  `UW Markdown: Verify Receipt for This Deal` command checks the
  `<deal>.receipt.json` sidecar against the open document. Verdicts map to
  notification severity (information / error / warning for verified / failed /
  unverifiable), with the full breakdown — pack, engine, policy set, digest,
  every stated result, and the §1 assurance boundary — in a *UW Markdown
  Receipts* output channel. Unsaved editor changes are offered as the likely
  cause of a failure. The verified notification states the boundary inline
  rather than showing a bare checkmark. The extension **verifies but never
  issues**: a receipt issued mid-authoring is stale on the next keystroke.
  Verification logic lives in a `vscode`-free module so it unit-tests under
  plain vitest with no editor harness, and a new **VS Code extension (build +
  test)** CI job typechecks, bundles, and runs it — the extension previously
  had no CI coverage at all.
- **Receipts on the docs-site** — adds `docs/UW_RECEIPTS.md`, published at
  `/guide/receipts`: a human-facing explanation of what a receipt does and does
  not attest, how to issue and verify one, why verification has three outcomes
  rather than two (including the `unverifiable` exit code of 3), and why a
  receipt going stale after an edit is expected rather than alarming. Linked
  from the Tools nav and both guide sidebars, cross-referenced from
  `docs/TOOLS.md` (decision tree, CLI examples, web-editor entry) and a new
  `docs/GLOSSARY.md` entry. Also fixes a gap in the docs-site link rewriter:
  RFC links spelled `rfcs/NNNN-slug.md` — the correct GitHub-relative form from
  a file inside `docs/` — previously failed the build's dead-link check, since
  only `docs/rfcs/NNNN-slug.md` and bare `NNNN-slug.md` were recognized.
- **Receipts in the web editor** — a **Receipt** tab issues and verifies RFC 0016
  receipts entirely client-side via `@uwmd/core/browser`; nothing is uploaded.
  Issuance runs the asset class's pack over the open deal and offers the
  `.receipt.json` sidecar; verification accepts a receipt file and continuously
  re-verifies against the in-editor document. The panel renders **four** states
  rather than three: core's `verified` / `failed` / `unverifiable`, plus a
  UI-level **`stale`**. A digest mismatch is reclassified as stale only when this
  session issued the receipt and the deal has since been edited — spec §6's
  "editors SHOULD treat any existing receipt as stale once a write lands" — while
  the same mismatch on a receipt that arrived as a file stays `failed`, so an
  ordinary edit never reads as tampering and tampering never reads as an edit.
  Per `UW_RECEIPT_v1.md` §1 no verdict is a bare checkmark: each states what it
  attests, and `verified` carries the "not correct, complete, audited, or
  approved" caveat inline rather than behind a disclosure. Web-editor suite goes
  33 → 56 tests, including the stale-vs-failed distinction, an axe-core pass over
  the rendered verdict, and a test that forces the Web Crypto branch of
  `sha256TextHex` (jsdom leaks `process`, so the component tests would otherwise
  only ever exercise the Node path the browser never takes).
- **Verification receipts (RFC 0016)** — a detached JSON document binding a
  canonical digest of an underwriting record to the deterministic outputs a
  named calc pack produced from it, so a party who did not run the calculation
  can confirm offline that the numbers follow from the inputs. Adds the
  normative [`spec/UW_RECEIPT_v1.md`](spec/UW_RECEIPT_v1.md) and
  `spec/schemas/uw-receipt.schema.json`; `receipts.ts` in `@uwmd/core` (exported
  from both `index.ts` and the browser entry, since unsigned issuance and
  verification need no cryptographic dependency); `uwmd receipt issue` and
  `uwmd receipt verify`; and a `receipts` conformance suite
  (`--tier=receipts`, 11 assertions) covering issuance, the four verification
  outcomes, and refusal. Verification is three-state — `verified` / `failed` /
  `unverifiable` — and never collapses "cannot decide" into either of the
  others. Two invariants are asserted without a baseline: re-issuance over an
  unmodified record reproduces the same digest and results, and every
  verification lands on exactly one of the three verdicts. Resolves RFC 0016's
  open question on engine-version mismatch in favour of `unverifiable`
  (`RCP-07`) rather than `failed`, so a document is never blamed for an engine
  upgrade. A receipt attests that stated outputs follow from stated inputs; it
  attests nothing about whether those inputs are true, and consumers MUST NOT
  render a `verified` verdict as an unqualified checkmark.
- **Local batch collection indexer** — introduces @uwmd/batch, a deterministic directory runner that validates required deal envelopes, captures semantic digests, and emits JSON/CSV read models for database-adjacent underwriting workflows without changing the canonical .uw.md protocol.

## [1.1.3] - 2026-08-04

### Fixed
- **Scoped CLI distribution** — renames the npm package from the unpublishable uwmd name to @uwmd/cli; its installed executable remains uwmd.

## [1.1.2] - 2026-08-04

### Fixed
- **Release lockfile completeness** — regenerates the npm lockfile so clean CI installs include every package required by the published workspace manifests.

## [1.1.1] - 2026-08-04

### Fixed
- **Coordinated npm release** — publishes the `uwmd` CLI with its exact `@uwmd/core@1.1.1` dependency after the initial scoped-package bootstrap release.

## [1.1.0] - 2026-08-04

### Added
- **UW Lite / UWX transition foundation (RFC 0017)** adds the
  pre-launch .uw.md Lite and .uwx.md Extended split. (This entry originally cited
  "RFCs 0015 and 0016": 0015 belongs to the unrelated portfolio-relationships
  proposal, and 0016 did not exist. The split is governed by RFC 0017; receipts
  are defined by RFC 0016, both accepted 2026-08-09. Receipts are **not**
  implemented — the original wording overstated what shipped.) Core now exposes representation constants, content-aware
  source detection, the parseUWXFile compatibility name, and a byte-identical
  legacy migration planner. The uwmd migrate-source command safely copies a
  structured legacy .uw.md to a sibling .uwx.md, refuses Lite/mixed content and
  existing destinations by default, and supports dry-run reporting.
- **Deterministic UW Lite bridge** compiles the deal-summary Lite profile into a
  UW Document Envelope/UWX source, preserves the complete human-readable source
  in a namespaced extension, and rejects unsupported periods, scenarios, or
  units instead of guessing. The reverse UWX-to-Lite projection emits a
  machine-readable omission report whenever advanced data is dropped. The CLI
  exposes both directions through convert, accepts Lite in export, and lists
  Lite/UWX in representation discovery. Receipt signing remains implementation work.
- **UW Lite Markdown 1.0 parser foundation** adds the normative constrained
  grammar, lossless source-located AST, explicit anchored fields, normalized
  currency/rate/ratio values and units, duplicate/ambiguity diagnostics,
  presentation-insensitive financial canonicalization, canonical rendering,
  browser-safe public APIs, a conformance fixture, and CLI parse/validate
  support. Parsing remains separate from deterministic envelope compilation.
- **HTTP and MCP Binding 1.0 (RFC 0014 Phase E)** — publishes stable
  `https://uwmd.org/deals/{deal_id}` resource identities, an OpenAPI 3.1 contract,
  negotiated HTTP responses with semantic ETags and preconditions, MCP text/blob
  resources, compact dual structured/text tool results, resource links, all five
  reference tool handlers, and a runnable SDK-neutral adapter example. Core
  binding tests cover JSON/XML/CSV transport, `304`/`406`/`412`/`415`/`428`,
  resource variants, validation results, and Tier-2 source edits.
- **UW CSV Bundle 1.0 (RFC 0014 Phase D)** — adds the normalized model-fidelity
  directory and deterministic ZIP codecs, manifest inventory and file hashes,
  semantic-digest verification, bounded extraction defenses, and all six named
  spreadsheet-safe view profiles. The shared registry and `uwmd convert` now
  round-trip Markdown, JSON, XML, and `.uw.csv.zip` representations.
- **UW XML 1.0 and cross-format conversion (RFC 0014 Phase C)** — adds the
  deterministic `uw-xml` codec, namespace and normative mapping specification,
  structural XSD, semantic-digest verification, bounded secure parsing, and
  shared JSON/XML registry APIs. `uwmd convert` now converts `.uw.md`, verified
  `.uw.json`, and verified `.uw.xml`; round-trip, hostile-input, registry, and
  CLI integration tests cover the implementation.
- **UW Document Envelope 1.0 and UW JSON 1.0 (RFC 0014 Phase A)** — adds the
  format-neutral `UWDocumentEnvelope`, a normative JSON Schema, one authoritative
  `_meta` and prose location per block, semantic canonicalization/digests,
  equivalence checks, `CodecRegistry`, the registered `uw-json` codec, verified
  parsing, and digested `uwmd export` output. Core and CLI round-trip, tampering,
  registry, and schema tests cover the new contract. XML, CSV, discovery, and
  HTTP/MCP companion profiles now ship in the same 1.1 release train.
- **Protocol 1.2 representation discovery** — `ImplementationManifest` now
  advertises typed representation descriptors; its normative schema mirrors the
  addition. `negotiateRepresentation` implements Accept quality/specificity and
  fidelity filtering, `resolveInputRepresentation` resolves Content-Type, and
  `uwmd formats` exposes the live registry for API/MCP hosts.
- **Owner-led governance mode** — the owner may accept RFCs and merge
  owner-authored work immediately while the project is solo. External pull
  requests require owner review; collaborative 14-day normative comment periods
  activate automatically after the first outside contribution merges.
- **Cross-platform release gates** - CI now runs the complete build, workspace
  tests, and tiers 1-3 conformance suite on Windows/Node 20 in addition to the
  existing Ubuntu matrix. Core coverage is now a blocking gate at 70% lines,
  70% statements, 70% branches, and 90% functions, based on a measured baseline
  of 72.45% / 72.45% / 74.25% / 91.92% respectively.
- **Repository line-ending policy** - `.gitattributes` pins text files to LF while
  retaining CRLF for Windows command scripts.
- **CI now builds and tests the web editor** ([`.github/workflows/ci.yml`](./.github/workflows/ci.yml))
  — a new `web-editor` job builds `@uwmd/core`, then runs the web editor's own
  `npm run build` (tsc + vite) and `npm test` (33 vitest cases). The root
  `npm test` only covers workspace packages, and `tools/*` are intentionally not
  workspace members, so the editor's calc-integrity suite was never gated in CI.
- **Web editor: accessibility & keyboard pass** ([`tools/web-editor/`](./tools/web-editor/))
  — a global `:focus-visible` ring (light on the navy toolbar) so keyboard users
  can see focus without cluttering mouse use; the New Deal dialog gains
  `aria-modal`, `aria-labelledby`, real `<label htmlFor>` associations on every
  field, and initial focus (it already closed on Esc); the editor-views tabs are a
  labelled `<nav>` with `aria-current` on the active tab; the footed-cell override
  inputs get `aria-label`s; (the report iframe already had a `title`). A new
  `a11y.test.tsx` runs **axe-core** against the dialog and a flagged section view
  and fails on any serious/critical violation (color-contrast excluded — jsdom
  can't compute rendered colors). Web-editor suite is now 33 tests across 5 files.
- **Web editor: inline validator remediations** ([`tools/web-editor/src/components/SectionView.tsx`](./tools/web-editor/))
  — the validator's issues for the active section now render **in context** at the
  top of that section (severity, code, field badge, message, and the
  `BUILTIN_REMEDIATIONS` copy), and the offending flat numeric field is flagged
  with a red border, `aria-invalid`, an associated `<label>`, and the remediation
  shown beneath it via `aria-describedby` — all read off the `ValidationMessage`
  (never re-authored, so the footer and the inline copy can't drift). The global
  `ValidationPanel` footer is unchanged. `SectionView.test.tsx` (jsdom) pins that
  the remediation shows in-context and the field is marked invalid, and that a
  clean section shows nothing. Web-editor suite is now 31 tests across 4 files.
- **Web-editor component tests for the footed-model surfaces** (jsdom)
  ([`tools/web-editor/src/components/footed-model.test.tsx`](./tools/web-editor/))
  — adds jsdom + `@testing-library/react` (dev-only; bundle unchanged) and pins
  the contract every footed surface shares: editing one input re-foots the
  dependent totals and dispatches **exactly one** `section_replace`. Covers
  `ValuationModel` (NOI change re-foots indicated value) and the new `DcfModel`
  (a year's NOI re-foots its levered cash flow; the gross exit value re-foots the
  whole disposition→net→proceeds waterfall; "+ Add year" appends a projection
  year in one dispatch). Component tests are `*.test.tsx` and opt into jsdom via a
  `// @vitest-environment jsdom` docblock, so the pure node suite stays fast.
  Web-editor suite is now 29 tests across 3 files.
- **DCF footing in `@uwmd/core` + a DCF footed-model surface in the web editor**
  ([`dcf.ts`](./packages/uwmd-core/src/dcf.ts),
  [`tools/web-editor/src/components/DcfModel.tsx`](./tools/web-editor/)) — the
  `dcf` section was the last calc-bearing section still edited as a flat numeric
  grid. New `deriveDCF(content)` foots the relationships that follow
  unambiguously from a DCF block's own stored inputs — per projection year
  `net_cash_flow_levered = NOI − annual_debt_service` and
  `cash_on_cash_return = levered / cumulative_equity_invested`, and the exit
  waterfall `disposition_costs = exit_value_gross × disposition_costs_pct`,
  `exit_value_net = gross − disposition`, and
  `net_proceeds_to_equity = net − loan_balance_at_exit`. It deliberately leaves
  `exit_value_gross` (capitalizes a *forward* NOI the block doesn't store) and
  `returns.*` (IRR / NPV / equity multiple — cash-flow-timing convention) as
  inputs, in the same narrow, self-contained spirit as `deriveValuation`. Pure,
  exported from `index.ts` + `browser.ts`, and pinned to the Parkview worked
  example in [`dcf.test.ts`](./packages/uwmd-core/src/dcf.test.ts) (8 tests). The
  web editor's new `DcfModel` surface edits the assumptions, the per-year
  cash-flow rows (add/remove years), and the exit gross + loan balance; the
  derived totals render as locked **ƒ derived** cells and IRR/NPV/equity multiple
  show read-only as engine-provided. Removes the five flat `dcf` entries from the
  editor's numeric catalog. Web-editor tests grew to 25 (a dcf array round-trip
  through `applyEdit` + reparse, plus array-indexed `deepGet`/`deepSet`).
- **Web editor test harness** ([`tools/web-editor/`](./tools/web-editor/)) — the
  calc-aware editor previously shipped with **zero tests** despite being the
  Tier-2/3 chokepoint. Adds Vitest (dev-only; not in the production bundle —
  bundle hash unchanged) with a `test` script and a Node test environment, plus
  two suites: `src/edits.test.ts` (7 tests) pins the `runEdit()` contract — a
  `frontmatter_set` applies and re-parses so in-memory state can't drift from the
  canonical bytes, a rejected op returns a failed outcome instead of throwing,
  `EditSettings` thread confidence + `human_review_required` onto the written
  block, `supersede` mode archives the prior block (two fences) where `replace`
  edits in place (one), and `carryForwardOverrides()` keeps a pinned
  `_meta.field_overrides` alive across a later edit that doesn't restate it; and
  `src/catalog.test.ts` (16 tests) covers the path helpers and the wrapper-aware
  `getNumeric`/`setNumeric` that preserve the `{ value, … }` provenance wrapper.
  23 tests, all green; `npm --prefix tools/web-editor run test` and `run build`
  both pass.
- **Deterministic section-footing in `@uwmd/core`** (`derived.ts`, `rentroll.ts`,
  `opstatement.ts`) — `deriveRentRoll(content)` rolls a unit-level (multifamily)
  or tenant-level (commercial) schedule up into the section's totals (GPR,
  in-place rent, physical occupancy, loss-to-lease, concessions, net effective
  rent, leased/vacant SF, rent PSF, WALT, plus a recomputed `unit_mix_summary` /
  `tenant_concentration`), tolerant of both the spec naming
  (`nra_sqft`/`base_rent_annual`) and the worked-example naming
  (`leased_sf`/`annual_base_rent`) and writing back to whichever total keys the
  block already uses. `deriveOperatingStatement(content)` foots EGI / total OpEx
  (excluding below-the-line capex + replacement reserves) / NOI / expense ratio /
  NOI margin from the income and expense line items, with `other_income` and
  `utilities` sub-rollups. Both are pure (no I/O, never mutate), return
  `DerivedField[]` via the shared `derived.ts` collector (which drops any
  non-finite result so partial data never writes `NaN`), and honor invariant #1
  (not AI math — plain deterministic arithmetic, the same spirit as the calc
  packs) and #4 (one source so the editor, CLI, and Excel converter never
  disagree). Exported from both `index.ts` and `browser.ts`; covered by
  `rentroll.test.ts` (13) and `opstatement.test.ts` (8). Extended to three more
  sections (`debt.ts`, `sourcesuses.ts`, `valuation.ts`): `deriveDebt(content)`
  foots monthly + annual debt service from the loan terms — fully-amortizing via
  a `pmt()` byte-identical to the calc engine's `pmt` builtin, `loan × rate` when
  interest-only (detected from `amortization: "interest_only"` or a missing/zero
  term), rate-key tolerant; `deriveSourcesUses(content)` foots the per-bucket
  `sources.total`/`uses.total`, the nested `closing_costs.total`, and the
  top-level project-cost mirrors from the line items, and reports the
  sources-vs-uses `gap`/`balanced` so an imbalance surfaces without being
  silently written; `deriveValuation(content)` foots the income-approach
  `indicated_value = noi_used / cap_rate_applied` (and its delta to purchase
  price) entirely from the block's own inputs. Covered by `debt.test.ts` (6),
  `sourcesuses.test.ts` (6), `valuation.test.ts` (5).
- **Lender Package / Credit Memo report renderer** in `@uwmd/core`
  (`report.ts`) — `renderReportHtml(parsed, opts)` implements the spec's
  rendering targets §7.1 (Tier 1 Lender Package: cover page, executive summary
  with metric grid, property overview, proforma, rent-roll summary, debt
  structure, sources & uses, borrower summary, exit analysis, assumptions table
  with source badges + standard disclaimer) and §7.2 (Tier 2 Credit Memo: adds
  market analysis with comps, financial analysis with annual cash flows +
  stress matrix + break-even, due diligence, risk assessment, compliance,
  covenants, pipeline-log appendix). Output is a self-contained, print-aware
  HTML document (embedded `REPORT_CSS` with `@page`/`@media print` rules) or an
  `<article>` fragment for embedding. Zero dependencies, browser-safe, exported
  from `index.ts` and `browser.ts`; every number is read from the file (calc
  engine/pack output), never recomputed. Handles both multifamily
  `unit_mix_summary` and commercial `tenants` rent rolls, single-variant maps,
  and missing sections (skipped + reported in `sectionsSkipped`). New
  `uwmd report` CLI subcommand (`--tier`, `--prepared-by`, `--output`,
  `--stdout`).
- **PDF report pipeline** ([`packages/uwmd-report/`](./packages/uwmd-report/),
  preview `0.1.0`) — new `@uwmd/report` package providing
  `uwmd-report <file.uw.md> [-o out.pdf] [--tier] [--format pdf|html]` and a
  programmatic `generateReport(parsed, opts)` API. Prints core's report HTML to
  PDF via **playwright-core** with no bundled-browser download: resolves
  `--browser`/`UWMD_REPORT_BROWSER`, then system Chrome, then system Edge, then
  a Playwright-managed Chromium; typed `BrowserNotFoundError` with remediation
  otherwise. Page layout is owned entirely by core's `REPORT_CSS`
  (`preferCSSPageSize`, zero engine margins), so browser print of the HTML and
  the CLI PDF are identical.

### Fixed
- **Windows CRLF parsing** - `parseUWFile()` now accepts CRLF documents without
  silently dropping every fenced UW section. The parser retains `raw` input
  byte-for-byte while normalizing line endings only for structural scanning.
  Regression coverage exercises a complete CRLF section.
- **Unterminated section fences fail closed** - a recognized `uw:section` fence
  without a closing fence now raises typed `UNCLOSED_SECTION_FENCE` even outside
  strict mode, preventing the remainder of a deal from being swallowed as one
  malformed block.
- **Unsupported document targets fail explicitly** - the core `pdf` and `docx`
  render targets now throw typed `UnsupportedRenderFormatError` instead of
  returning successful-looking empty output. PDF callers are directed to
  `@uwmd/report`; DOCX remains explicitly unimplemented.
- **Publishable core package contents** - `@uwmd/core` now explicitly ships its
  compiled `dist` API and package README while excluding source tests. CI and the
  release workflow run `verify-packages` so a package whose exports point at
  missing artifacts cannot be published again.
- **Web editor lint errors that were failing the CI `lint` job** — `biome lint`
  flags (recommended-default errors): `noAutofocus` on the New Deal dialog and the
  footed-cell override input (replaced the `autoFocus` attribute with a ref +
  `useEffect().focus()`), and `noArrayIndexKey` on the DCF per-year rows (now keyed
  by the row's year). These had accumulated across the unpushed web-editor train;
  the lint job is green again.

### Changed
- **Dependency hardening** - the workspace Vitest and coverage-provider floor is
- **Canonical project identity** - the repository is renamed, package
  repository links follow the new URL, and public package/homepage metadata
  now points to `https://uwmd.org`.
  raised to 3.2.6, clearing the critical development-server advisory. Safe
  transitive lockfile updates also patch Vite, esbuild, PostCSS, fast-uri, tmp,
  and brace-expansion versions where upstream ranges permit. Remaining ExcelJS
  archive/UUID advisories require an upstream release or a separately validated
  converter migration before the separately versioned Excel add-on can publish.
- **Web editor 0.5.0 — rent-roll & operating-statement become underwriting
  *models*, not forms** ([`tools/web-editor/`](./tools/web-editor/)). New
  `RentRollModel` and `OperatingStatementModel` surfaces (shared `Footed.tsx`)
  treat the line items as the only inputs and render the section totals as
  locked **"ƒ derived"** cells footed live by core's `deriveRentRoll` /
  `deriveOperatingStatement`. Every mutation (cell edit, add/remove row,
  override, revert) clones the block, mutates one array, re-foots, writes back
  every non-pinned total, and dispatches a single `section_replace` through the
  `applyEdit()` chokepoint, so the file can never be left internally
  inconsistent. A footed total can be **pinned by hand** via an inline override
  editor; the pin is recorded in the format's own `_meta.field_overrides`
  (`reason: "overridden"`) and badged "manual" until reverted to formula. The
  edit dispatcher (`edits.ts`) now **carries `field_overrides` forward** across
  unrelated edits (the protocol's `buildMeta()` doesn't), and the generic scalar
  editor accepts `lockedPaths` so each footed total has exactly one editing
  path. Replaces the old `RentRollTable` (deleted) and the hand-entered
  rent-roll/operating-statement numeric fields. The same pattern now extends to
  three more sections — `DebtModel` (loan terms in, monthly/annual debt service
  footed), `SourcesUsesModel` (every source/use line in, bucket + closing-cost +
  project-cost totals footed, with a live sources-vs-uses **balance check**), and
  `ValuationModel` (NOI + cap rate in, income-approach indicated value footed) —
  via a shared `model-kit.tsx` (the `useFooting` write-path hook + `InputRow` /
  `FootedRow` row primitives). Those three sections drop out of the flat numeric
  allow-list (`catalog.ts`); their footed totals are locked out of the generic
  scalar editor so each has exactly one editing path.
- **`@uwmd/core/browser` now exports the intelligence + calc-introspection
  surfaces** — `resolveValue`/`readInFile` (cascade), `rankGaps` (value-of-
  information), `inferGaps`/`summarizeGaps`/`readGapsContent`, the asset-class
  default tables (`getAssetClassDefaults`/`getDefaultRange`/`listDefaultedFields`
  + the five `*_DEFAULTS`), and `getExprDependencies`/`extractDependencyGraph`,
  with their types. All confirmed browser-safe (no node, no SDK); previously
  only on the node `index.ts` entry. Enables the web editor's intelligence and
  calc-transparency panels.
- **Web editor 0.4.0 — extensive build-out** ([`tools/web-editor/`](./tools/web-editor/)):
  five tabs (Editor, Intelligence, Report, Diff, Source). New **Intelligence**
  tab surfaces **Scope** (every required input resolved through the fallback
  cascade with its source step + range) and **Refine** (VOI gap ranking with
  affected-output ranges and suggested questions). New **edit-provenance bar**
  threading actor/source/confidence/notes/human-review into `_meta` and toggling
  **replace vs. append (supersede)** mode (promotes `section_replace` →
  `section_supersede`). New **assumptions editor** capturing override rationale
  (`is_overridden`/`original_value`/`override_rationale`), **generic field
  editor** for every scalar leaf (narrative strings → textareas), **add/remove
  rent-roll rows**, **clickable calc cards** opening a formula + resolved-inputs
  + result detail (`CalcDetail`), and a **Diff** tab (section + frontmatter
  changes since load/save via core `diff()`). Edit chokepoint unchanged
  (`edits.ts` → `applyEdit()` → re-parse); modal Escape handling made global.
- **Web editor 0.3.0 — richer editing surfaces** ([`tools/web-editor/`](./tools/web-editor/)):
  **editable rent-roll tables** (unit-mix rows for multifamily-style rolls,
  tenant rows for commercial — cell edits replace the row through
  `applyEdit()`); **NOI line-item editor** (income/expense entries; wrapped
  `{value, …}` fields are updated via a wrapper-aware `setNumeric` that
  preserves rationale/source provenance, stored totals shown read-only with
  validator-flagged drift); **snapshot-based undo/redo** (restores prior
  canonical source verbatim; Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z + toolbar);
  **New Deal dialog** scaffolding a blank file via `generateBlankUWFile`;
  **per-section superseded-version history view**; **Source tab** (read-only
  canonical bytes + copy); **Ctrl+S** download; numeric allow-list expanded
  from 8 to ~30 fields across eight sections (incl. DCF assumptions and
  operating statement).
- **Web editor rebuilt on React 18 + Tailwind CSS 4**
  ([`tools/web-editor/`](./tools/web-editor/), preview `0.2.0`) — replaces the
  vanilla-TS stage-3 editor. Adds: a pinned calc strip that evaluates the asset
  class's full pack via `getPackForAssetClass` (all five shipped classes, was
  multifamily-only), block `_meta` provenance chips
  (version/source/confidence/review-required), collapsible raw-JSON block view,
  per-section prose display, pipeline-log table, and a **live Report Preview
  tab** rendering `renderReportHtml` in a sandboxed iframe on every edit with
  Lender Package / Credit Memo toggle, Download HTML, and Print/PDF. The edit
  chokepoint is unchanged: every mutation flows through `src/edits.ts` →
  `applyEdit()` → re-parse, so in-memory state can never drift from canonical
  bytes (React state only holds the result).
- **Initial `.uw.json` prototype** in `@uwmd/core` established the model-level
  round-trip and CLI export path later stabilized by RFC 0014 Phase A above.- **Renderer unit tests** in `@uwmd/core` covering JSON projection, superseded
  history opt-in, CSV numeric/percent output, summary/chat rendering, chat
  truncation, and the explicit PDF/DOCX stub targets.
- **Self-storage calc pack + defaults + worked example + Excel layout** —
  `SELF_STORAGE_PACK` adds twelve deterministic metrics keyed off NRSF, rentable
  units, physical occupancy, and economic occupancy. `SELF_STORAGE_DEFAULTS`
  registers cascade/refinement ranges, `Sonoran-Self-Storage-Peoria-AZ.uwx.md`
  provides a footing worked example, and `@uwmd/excel` now emits a self-storage
  workbook layout with Excel↔evaluator parity to 6 decimals.
- **Declarative module loader/registry** in `@uwmd/core` — `modules.ts` validates
  and registers in-process `ModuleManifest` objects, including shape checks,
  formula/rule parsing, dependency load order, and tier/protocol/format
  compatibility. Dynamic imports, signing, and custom asset-class identifiers
  remain v2/RFC work.
- Repo restructured into OSS-ready monorepo (`spec/`, `packages/`, `examples/`, `conformance/`, `tools/`).
- `@uwmd/core` package (renamed from `uwmd`).
- UW Protocol v1 specification (`spec/UW_PROTOCOL_v1.md`).
- TypeScript protocol surface (`packages/uwmd-core/src/protocol.ts`) — `ViewerCapability`, `SectionViewModel`, `ModuleManifest`, `ProtocolError`, `BUILTIN_VIEW_MODELS`, etc.
- Module manifest JSON Schema (`spec/schemas/module-manifest.schema.json`).
- Canonical formatting helpers (`packages/uwmd-core/src/format.ts`) — `formatCurrency`, `formatPercent`, `formatRatio`, etc.
- Conformance test corpus (`conformance/tier-{1..4}/`).
- Single-file Tier-1 reference viewer (`tools/web-viewer/index.html`).
- Top-level OSS scaffolding (LICENSE, CONTRIBUTING, CODE_OF_CONDUCT, CI workflow, issue templates).
- **Tier-2 Editor** — `applyEdit()` dispatcher in `@uwmd/core` covering `frontmatter_set`, `section_replace`, `section_supersede`, and `pipeline_log_append`, with `BUILTIN_EDIT_POLICIES` enforcement and round-trip preservation. New `uwmd edit` CLI subcommand.
- **Tier-3 Calc Host** — safe-expression parser + evaluator + built-ins (`sum`, `avg`, `min`, `max`, `coalesce`, `if`, `round`, `pmt`, `npv`, `irr`) per protocol §VIII.1 EBNF, with full `CalcError` taxonomy. New `uwmd calc` CLI subcommand.
- Validator wired to `BUILTIN_REMEDIATIONS` registry (no inline strings; per protocol §III.6).
- **Conformance runner** (`scripts/run-conformance.mjs`) executing tiers 1–4 with CI gate on tiers 1–3. Filled missing tier-2/3/4 fixtures (`frontmatter-set-recommendation` before/after pair, `revpar-basic`, `dscr-from-section`, `l6-risk-rating` shape assertion).
- **JSON Schemas** for all six boundary-crossing protocol types: `uwmd-block`, `edit-operation`, `protocol-error`, `implementation-manifest`, `calc-result`, `issue-remediation`. Programmatic validator (`scripts/validate-schemas.mjs`) using ajv 2020 + ajv-formats with cross-file `$ref` pre-registration. CI gate.
- **Governance scaffolding** — [SECURITY.md](./SECURITY.md), [GOVERNANCE.md](./GOVERNANCE.md) (owner-led mode with contributor-activated collaborative safeguards and an RFC process), [MAINTAINERS.md](./MAINTAINERS.md), [`.github/CODEOWNERS`](./.github/CODEOWNERS), [ROADMAP.md](./ROADMAP.md), [`docs/rfcs/`](./docs/rfcs/) directory with template and process README.
- **npm publish workflow** ([`.github/workflows/release.yml`](./.github/workflows/release.yml)) — on `v*` tag, runs full test + conformance + schema-validation gate, then publishes `@uwmd/core` to npm with provenance. `prepublishOnly` script in the package mirrors the same gate locally.
- **VS Code extension** ([`tools/vscode-uwmd/`](./tools/vscode-uwmd/), preview `0.1.0`) — syntax highlighting for `.uw.md` (YAML frontmatter + Markdown + embedded JSON in `uwmd json` blocks), folding for frontmatter / fenced blocks / heading sections, document outline, and on-save validation surfacing every `@uwmd/core` issue with its `code`, `title`, `remediation`, and `spec_ref`. Bundled via esbuild; ships as `.vsix`.
- **Documentation site** ([`tools/docs-site/`](./tools/docs-site/), preview `0.1.0`) — VitePress build covering the format spec, protocol spec, JSON Schemas, conformance corpus per tier, and the full set of project documents (roadmap, governance, contributing, security, RFC process). Repo-root markdown remains the single source of truth; `scripts/prebuild.mjs` copies content into the site tree at build time and rewrites relative links to site URLs. Ships as a 2.9 MB static bundle deployable to any static host.
- **Standalone CLI installer** ([`packages/uwmd-cli/`](./packages/uwmd-cli/), preview `1.0.0`) — new `uwmd` npm package providing `npx uwmd <command>` for non-developers who don't want to clone the repo. Thin wrapper that re-exposes the `@uwmd/core` CLI module via a new `./cli` subpath export. Covers all eleven subcommands: `init`, `parse`, `validate`, `compact`, `diff`, `render`, `edit`, `calc`, `run`, `summary`, `layers`. Same Tier-1/2/3/4 conformance behavior as the in-repo CLI; no separate code path, so no calc-drift risk.
- **`@uwmd/core/browser` subpath export** — new browser-safe entry point that excludes the agent runner and `@anthropic-ai/sdk` so the library can be bundled directly into web apps. Re-exports parser, validator, compactor, renderer, editor (`applyEdit`), calc engine (`evaluateCalc`), formatting helpers, and the full type / protocol surface. Source at `packages/uwmd-core/src/browser.ts`.
- **v2 RFC drafts** ([`docs/rfcs/`](./docs/rfcs/)) — six initial drafts opened to start the v2 design conversation, one per item in [ROADMAP](./ROADMAP.md) §"v2 spec exploration": [RFC 0001](./docs/rfcs/0001-locale-negotiation.md) (locale negotiation), [RFC 0002](./docs/rfcs/0002-module-signing.md) (Sigstore-style module signing), [RFC 0003](./docs/rfcs/0003-module-asset-classes.md) (custom asset-class declarations from modules), [RFC 0004](./docs/rfcs/0004-conformance-runner-v2.md) (language-agnostic conformance runner with TAP14 + JSON manifest output), [RFC 0005](./docs/rfcs/0005-stochastic-calculations.md) (stochastic calc declarations with seeded PCG-XSL-RR-64 PRNG), and [RFC 0006](./docs/rfcs/0006-hospitality-module.md) (hospitality reference module). All in `status: draft`; none required for v1 conformance.
- **Excel converter** ([`packages/uwmd-excel/`](./packages/uwmd-excel/), preview `0.1.0`) — new `@uwmd/excel` package providing `uwmd-excel <file.uw.md> [-o out.xlsx]` and a programmatic `toWorkbook(parsed)` API. Generates a three-sheet multifamily workbook: an Underwriting sheet (header + named-range inputs block + derived-metric formulas block), an Operating Statement sheet (five income lines + `EGI=SUM(income)` + eleven expense lines + `total_opex=SUM(expenses)` + `NOI=EGI−total_opex`), and a Pipeline Log audit sheet. The eight derived-metric formulas (cap rate, LTV, DSCR, debt yield, price/unit, loan/unit, loan/sqft, cash-on-cash) ship as Excel formulas referencing the workbook-scope named ranges (`purchase_price`, `loan_amount`, `annual_debt_service`, `total_units`, `total_nra_sqft`, `equity_sponsor`, `noi`) — these mirror `MULTIFAMILY_STARTER_PACK` in `@uwmd/core` exactly, so opening the workbook in Excel and running `uwmd calc` against the same `.uw.md` produce identical numbers by construction. Editing any named-input cell or any line item ripples through to every dependent metric. Multifamily-only and `.uw.md` → `.xlsx` only in 0.1.0; the reverse direction is deferred and the calc-aware web editor remains the canonical Tier-2 chokepoint for editing.
- **Calc-aware web editor** ([`tools/web-editor/`](./tools/web-editor/), preview `0.1.0`) — Vite + plain TS bundle on top of `@uwmd/core/browser`. Drag-drop file load, sidebar with per-section validation badges, frontmatter editor (16 typed inputs spanning text / enum / list fields), and section views with typed numeric inputs on five calc-bearing sections (`property`, `valuation`, `noi_model`, `debt_structure`, `sources_uses`). Every edit dispatches through `applyEdit()` and reparses the file, so in-memory state can never drift from canonical source. Multifamily calc starter pack (cap rate, LTV, DSCR, debt yield, $/unit, $/sqft, price/unit, cash-on-cash) re-evaluates on every render via `evaluateCalc`. Validation footer surfaces every `ValidationMessage` with severity, code, section, and `BUILTIN_REMEDIATIONS` copy. Bundle size: 19 kB app + 11 kB core, gzipped. Replaces the originally-planned narrative-only Tier-2 web editor — that design was rejected because separating safe narrative edits from unsafe numeric edits creates two paths into the same file.
- **Lint toolchain** — Biome `1.9.4` configured at the repo root ([`biome.json`](./biome.json)) with `npm run lint` / `npm run format` scripts. Linter-only (no formatter enforcement) so the existing code style is preserved. New `lint` job in CI ([`.github/workflows/ci.yml`](./.github/workflows/ci.yml)).
- **CLI smoke tests** — `uwmd` CLI installer now ships a vitest suite ([`packages/uwmd-cli/test/cli.smoke.test.ts`](./packages/uwmd-cli/test/cli.smoke.test.ts)) covering `--help`, `parse`, `validate`, and missing-file error path against the bundled Parkview fixture. CLI was previously untested.
- **`.editorconfig`** at the repo root for cross-editor consistency (LF, UTF-8, 2-space, trim trailing whitespace except in `.md`).
- **Canonical asset-class calc packs** in `@uwmd/core` ([`packages/uwmd-core/src/packs/`](./packages/uwmd-core/src/packs/)) — `MULTIFAMILY_PACK` is now the single source of truth for the eight multifamily derived metrics, exported from both `@uwmd/core` and `@uwmd/core/browser` as a `ModuleManifest`. Previously, the same eight calcs were defined twice — once in calc-engine syntax inside [`tools/web-editor/src/calc-pack.ts`](./tools/web-editor/src/calc-pack.ts) and again in Excel formula syntax inside [`packages/uwmd-excel/src/multifamily.ts`](./packages/uwmd-excel/src/multifamily.ts). Adding a metric required editing both. Both consumers now import from the canonical pack.
- **Office calc pack + defaults** in `@uwmd/core` — `OFFICE_PACK` ([`packages/uwmd-core/src/packs/office.ts`](./packages/uwmd-core/src/packs/office.ts)) is the second built-in asset-class pack: eleven office derived metrics (cap rate, LTV, LTC, DSCR, debt yield, price/sqft, loan/sqft, NOI/sqft, operating expense ratio, cash-on-cash, occupancy) as a `ModuleManifest`, exported from both `@uwmd/core` and `@uwmd/core/browser`. Office field paths differ from multifamily — size is `property.rentable_square_feet`, sponsor equity is `sources_uses.sources.sponsor_equity`, and the NOI model splits into nested `income`/`expenses`. `OFFICE_DEFAULTS` ([`defaults.ts`](./packages/uwmd-core/src/defaults.ts)) adds a 13-field office triage table (wider ranges than multifamily, plus office-specific TI/LC fields) registered for the cascade. New `getPackForAssetClass(asset_class)` registry helper selects the right pack by asset class; `uwmd refine` and `uwmd scope` now resolve office deals automatically off the deal's `frontmatter.asset_class`. Every office metric is verified through both `evaluateCalc()` and the emitted Excel formula to 6 decimals against the Riverside office worked example ([`packages/uwmd-core/src/packs/office.test.ts`](./packages/uwmd-core/src/packs/office.test.ts)).
- **Retail calc pack + defaults + worked example** in `@uwmd/core` — `RETAIL_PACK` ([`packages/uwmd-core/src/packs/retail.ts`](./packages/uwmd-core/src/packs/retail.ts)) is the third built-in asset-class pack: twelve retail derived metrics, keyed off **gross leasable area** (`property.gross_leasable_area`) for the per-SF metrics and GLA for occupancy, plus a retail-distinctive `expense_recovery_ratio` (`income.expense_reimbursements / expenses.total_operating_expenses`) for NNN recovery. `RETAIL_DEFAULTS` ([`defaults.ts`](./packages/uwmd-core/src/defaults.ts)) adds a 13-field retail triage table including the NNN `expense_recovery_rate`. New third worked example [`examples/Cactus-Crossing-Retail-Mesa-AZ.uwx.md`](./examples/Cactus-Crossing-Retail-Mesa-AZ.uwx.md) — a 95k SF grocery-anchored neighborhood center with a tenant-level rent roll, NNN reimbursements, and percentage rent; validates with **zero** issues. Both registries (`getPackForAssetClass`, `getAssetClassDefaults`) now resolve `retail`, so `uwmd refine`/`uwmd scope` work for retail deals automatically. Every metric is verified through `evaluateCalc()` and the emitted Excel formula to 6 decimals ([`packages/uwmd-core/src/packs/retail.test.ts`](./packages/uwmd-core/src/packs/retail.test.ts)).
- **Industrial calc pack + defaults + worked example** in `@uwmd/core` — `INDUSTRIAL_PACK` ([`packages/uwmd-core/src/packs/industrial.ts`](./packages/uwmd-core/src/packs/industrial.ts)) is the fourth built-in asset-class pack, completing the four core commercial types: twelve metrics keyed off **rentable building area** (`property.rentable_square_feet`) and SF occupancy, including the NNN `expense_recovery_ratio`. `INDUSTRIAL_DEFAULTS` ([`defaults.ts`](./packages/uwmd-core/src/defaults.ts)) adds a 13-field industrial triage table (lowest expense ratio + highest recovery + tightest caps of the four classes). New fourth worked example [`examples/Ironwood-Logistics-Industrial-Tolleson-AZ.uwx.md`](./examples/Ironwood-Logistics-Industrial-Tolleson-AZ.uwx.md) — a 220k SF Class A bulk-distribution warehouse, multi-tenant NNN; validates with **zero** issues. Both registries now resolve `industrial`, so `uwmd refine`/`uwmd scope` work for industrial deals automatically. Every metric verified through `evaluateCalc()` and the emitted Excel formula to 6 decimals ([`packages/uwmd-core/src/packs/industrial.test.ts`](./packages/uwmd-core/src/packs/industrial.test.ts)).
- **Excel converter: office/retail/industrial layouts + multifamily NOI parity fix** ([`packages/uwmd-excel/`](./packages/uwmd-excel/)) — `@uwmd/excel` is no longer multifamily-only. The converter engine ([`toWorkbook.ts`](./packages/uwmd-excel/src/toWorkbook.ts)) is now generic over a `WorkbookLayout` ([`layout.ts`](./packages/uwmd-excel/src/layout.ts)) selected by `frontmatter.asset_class` via a registry ([`layouts.ts`](./packages/uwmd-excel/src/layouts.ts), `getLayoutForAssetClass`); layouts ship for multifamily, office, retail, and industrial. A layout is just `{ assetClass, pack, incomeLines, expenseLines, namedInputs }` — the engine derives the calc-path→named-range map and the derived-metrics block *from* the layout (`buildNamedRangeMap`/`buildDerivedMetrics`) so formulas and named ranges can't drift. **Bug fix:** the operating statement previously computed `EGI = SUM(income lines)` while vacancy/credit-loss were stored as positive magnitudes, so the SUM *added* vacancy instead of subtracting it — overstating EGI and NOI, and (since the `noi` named range feeds cap-rate/DSCR/etc.) silently breaking Excel↔evaluator parity. Income deduction lines now carry `sign: -1`, so `EGI = SUM` and `NOI = EGI − total opex` foot to the stored `effective_gross_income`/`net_operating_income`. The round-trip test ([`toWorkbook.test.ts`](./packages/uwmd-excel/src/toWorkbook.test.ts)) was rewritten to **compute** parity for all four example deals (assert the statement foots, then evaluate every derived-metric formula against the workbook's named-range values and compare to `evaluateCalc` to 6 decimals) — the old test only checked formula text and missed the bug. The Riverside office example's operating statement was reconciled (+$2,550 utilities → $382,550 total opex) so EGI − opex foots to its stated $300,000 NOI; cap rate, DSCR, and all other narrative figures are unchanged.
- **AST → Excel formula emitter** ([`packages/uwmd-core/src/packs/excel-emit.ts`](./packages/uwmd-core/src/packs/excel-emit.ts)) — `emitExcelFormula(formula, { namedRanges })` translates a Tier-3 safe expression into Excel syntax via a caller-supplied identifier-to-named-range map. Maps arithmetic 1:1, ternary to `IF()`, modulo to `MOD()`, logical `&&`/`||` to `AND()`/`OR()`, and the 17 supported builtins (`sum`/`min`/`max`/`if`/`round`/`pmt`/`npv`/`irr`/`abs`/`floor`/`ceil`/`sqrt`/`pow`/`log`/`exp`/`fv`/`pv`/`nper`). Throws `ExcelEmitError` with codes `EXCEL-EMIT-PATH` (unmapped identifier), `EXCEL-EMIT-FN` (no Excel equivalent), `EXCEL-EMIT-OP` (unhandled operator). New parity test in `packs.test.ts` evaluates each multifamily metric both through `evaluateCalc()` and through the emitted Excel formula (with named-range substitution) and asserts they agree to 6 decimals.
- **Pre-publication review follow-ups** (REVIEW-2026-04-26.md) — first pass at the audit's punch list:
  - **Documentation on-ramps:** [ARCHITECTURE.md](./ARCHITECTURE.md) (system map: spec → reference library → tools → conformance corpus, with dependency rules and "where to start contributing" guide), [VERSIONS.md](./VERSIONS.md) (compatibility matrix across format / protocol / `@uwmd/core` / CLI / tools, plus pinning recommendations), [docs/GLOSSARY.md](./docs/GLOSSARY.md) (alphabetical entries for both format-specific and CRE domain terms with normative spec links), [docs/TOOLS.md](./docs/TOOLS.md) (decision tree for picking among the seven shipped tools), and [tools/docs-site/tutorials/your-first-uwmd-file.md](./tools/docs-site/tutorials/your-first-uwmd-file.md) (5-step walkthrough from blank file to validated minimal `.uw.md`). All five are wired into the docs-site sidebar via `prebuild.mjs` so the repo-root markdown remains the single source of truth.
  - **Second worked example:** [examples/Riverside-Office-Phoenix-AZ.uwx.md](./examples/Riverside-Office-Phoenix-AZ.uwx.md) — suburban office with a bridge-loan capital stack and tenant-level rent roll, demonstrating that the format is not multifamily-only. Validates with zero errors and a single intentional `FV_DSCR_BELOW_THRESHOLD` warning (bridge-loan DSCR is thin at close by design).
  - **Coverage in CI:** new `coverage` job in [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) runs `vitest --coverage` on `@uwmd/core`, publishes a coverage table to the GitHub job summary, and uploads the full `lcov` report as a build artifact. Soft floor (`continue-on-error: true`) at the current baseline; will be tightened once the number is ratcheted up. Vitest config at [`packages/uwmd-core/vitest.config.ts`](./packages/uwmd-core/vitest.config.ts).
  - **Malformed conformance fixtures:** new `conformance/tier-1-reader/malformed/` category with three fixtures (`META_MISSING`, `META_LOW_CONFIDENCE_NO_REVIEW_FLAG`, `CC-04`) and matching `expected.json` declarations. The conformance runner ([`scripts/run-conformance.mjs`](./scripts/run-conformance.mjs)) gained a `runTier1Malformed` pass that dispatches each fixture through `validateUWFile` and asserts the actual issue codes are a superset of the expected codes.
  - **Property-based tests on the calc engine:** new [`packages/uwmd-core/src/calc/calc.property.test.ts`](./packages/uwmd-core/src/calc/calc.property.test.ts) using `fast-check` to assert (1) parser totality on arbitrary ASCII input ≤ 256 chars (always returns AST or throws typed `CalcError`), (2) evaluator null-safety against the empty context (always returns `CalcValue` scalar or throws typed `CalcError`), (3) Excel-emit grammar parity (every AST the constrained generator can produce emits to a non-empty string). Runs 500 + 300 + 300 cases per property in CI.
  - **YAML parser hardening:** new [Appendix D in the format spec](./spec/UW_FORMAT_SPEC_v1.md) defines the supported YAML subset (scalars, mappings, sequences, comments) and the rejected features (anchors, aliases, explicit tags, block scalars, complex keys, directives). The parser at [`packages/uwmd-core/src/parser.ts`](./packages/uwmd-core/src/parser.ts) now hard-rejects unsupported features at frontmatter parse time with a typed `UWMDParseError` carrying the new validator code `UNSUPPORTED_YAML_FEATURE` (registered in `BUILTIN_REMEDIATIONS`). Eight new unit tests in `parser.test.ts` cover the rejection paths plus the all-supported subset.
  - **Validator code taxonomy:** new §III.6a in [the protocol spec](./spec/UW_PROTOCOL_v1.md) documents the three validator code prefixes (`CC-NN` cross-section consistency, `FV_*` financial validity, `META_*` meta integrity) and their severity defaults. Pointer to `BUILTIN_REMEDIATIONS` and the validator implementation as the authoritative registry — the review's claim that codes were unregistered turned out to be wrong; the gap was that the categorization wasn't documented.
  - **Pipeline state L3 documented:** the L3 layer was missing from [the Parkview example](./examples/Parkview-Apts-Glendale-AZ.uwx.md)'s `pipeline_state` because it is intentionally reserved. The format spec now states this explicitly inside the `pipeline_state` example block — conforming files MUST NOT define `L3_*` keys, and any layer key absent from `pipeline_state` is treated as `pending` by default.
  - **README cleanup:** dropped the stale "(in progress)" labels next to the protocol spec and the conformance corpus links. Both shipped per [ROADMAP.md](./ROADMAP.md).
- **Two new v2 RFC drafts** — [RFC 0007](./docs/rfcs/0007-sensitivity-tables.md) (sensitivity tables as a first-class calc primitive — `sensitivity_table()` builtin returning a structured grid result) and [RFC 0008](./docs/rfcs/0008-lease-up-modeling.md) (a `lease_up_schedule` standard section for value-add and ground-up deals). Both in `status: draft`; not implemented.
- **Architectural review v1.1 train (six-phase landing of `ARCHITECTURAL-REVIEW-2026-04-27.md`)** — full surface expansion across format, protocol, library, conformance, and docs in response to the three architectural concerns raised in the review (wrong-actor / wrong-tool writes, incomplete-data first-class support, AI-efficient representation). Implemented as six independently-shippable phases.
  - **Phase 1 — Foundation (`_meta` extensions + validator taxonomy + `scope` stage).** `_meta` gained five optional fields documented in [Format Spec Part III §3](./spec/UW_FORMAT_SPEC_v1.md): `partial`, `provisional`, `field_overrides[]`, `content_hash`, `parent_hash`. `_meta.source` enum widened by four additive values (`user_input`, `asset_class_default`, `global_default`, `system_default`); existing `scenario_default` retained. New normative §IX "Fallback cascade" in [the protocol spec](./spec/UW_PROTOCOL_v1.md) defines the seven-step resolution order producers MUST walk. New `DealStage` value `scope` added below `screening` for back-of-napkin triage; `STAGE_REQUIREMENTS` widened to support field-level + either-or readiness checks (`required_field_paths`, `required_one_of`). Validator code taxonomy finalized: `CC-NN` (existing), `FV-NN` (renamed from legacy `FV_*` strings, both emitted via `legacy_code` for one release), `DQ-NN` (new), `INT-NN` (new), `POL-NN` (new), `META_*` (existing). `BUILTIN_REMEDIATIONS` extended with one entry per new code. Confidence vs `human_review_required` disambiguated as orthogonal in spec.
  - **Phase 2 — Gaps section + cascade resolver + asset-class defaults + `INCOMPLETE_DATA_POLICIES`.** New optional standard section `gaps` with [`spec/schemas/sections/gaps.schema.json`](./spec/schemas/sections/gaps.schema.json) — `items[]` with `(section, field_path, reason ∈ {missing, illegible, out_of_scope, deferred, blocked_by_dependency, awaiting_external}, blocks_stage, first_seen, last_checked, owner, note)` plus `summary` rollup. New [`packages/uwmd-core/src/defaults.ts`](./packages/uwmd-core/src/defaults.ts) exports `MULTIFAMILY_DEFAULTS` covering 11 fields with low/central/high ranges (expense ratio, vacancy, rent growth, management fee, replacement reserve, debt rate, amortization, IO months, LTV, exit cap, closing costs); each entry version-pinned at `1.0.0` with the contract that range revisions bump the version. New [`packages/uwmd-core/src/cascade.ts`](./packages/uwmd-core/src/cascade.ts) exports `resolveValue(field_path, parsed, ctx?)` walking the protocol §IX cascade; `MarketDataLookup` and `InvestorProfile` are interface-only (adopters bring their own). New [`packages/uwmd-core/src/gaps.ts`](./packages/uwmd-core/src/gaps.ts) with `inferGaps`, `applyGapPolicy`, `summarizeGaps`. New `INCOMPLETE_DATA_POLICIES` registry in [`protocol.ts`](./packages/uwmd-core/src/protocol.ts) with `GapAction = halt | degrade | substitute | defer` and `lookupIncompleteDataPolicy` resolution; seeded with conservative `(section, stage)` defaults. `applyEdit` gained an opt-in `maintain_gaps` option that recomputes the gaps section after every successful write under actor `system/gaps-maintainer`.
  - **Phase 3 — Integrity (hashes + chains + `uwmd verify`).** New [`packages/uwmd-core/src/integrity-canonical.ts`](./packages/uwmd-core/src/integrity-canonical.ts) implements RFC 8785 (JCS) JSON canonicalization — vendored ~40 LOC, zero dependencies — with the documented exclusion of `_meta.content_hash` and `_meta.signature` from the hash input. New [`packages/uwmd-core/src/integrity.ts`](./packages/uwmd-core/src/integrity.ts) exports `computeBlockHash`, `verifyChain`, `verifyProvenance`, returning typed `IntegrityIssue[]` with codes `INT-01` (parent_hash mismatch), `INT-03` (partial chain), `INT-04` (content_hash recompute mismatch), `POL-01` (unauthorized actor per `BUILTIN_EDIT_POLICIES`), `POL-02` (`section_replace` where `section_supersede` required). New `applyEditAsync` recomputes `content_hash` on every write when `options.integrity` is enabled and rejects edits whose `ctx.parentHash` is stale with `INT-02`. Crypto split: Node `crypto.createHash` and Web Crypto `subtle.digest` produce byte-identical hashes verified in `integrity-canonical.test.ts`. New `uwmd verify <file> [--integrity] [--policy] [--validate] [--json]` subcommand combines all three checks; `uwmd validate --integrity` also opts in inline.
  - **Phase 4 — Context profiles for AI consumption.** New [`packages/uwmd-core/src/context-profiles.ts`](./packages/uwmd-core/src/context-profiles.ts) exports `buildContext(parsed, profile, opts?)` returning a `ContextResult` with `{content, tokenEstimate, profile, sectionsIncluded, truncated}`. Five normative profiles defined in new protocol §X "Context profiles": `summary` (frontmatter + quick_metrics + pipeline_state + gaps, ≤600 tokens), `live` (all non-superseded, prose included), `compact` (all non-superseded, JSON-only, minified, stable→volatile section order, ≤55% of `live` tokens), `full` (every byte), `relevant` (filtered to `opts.sections`). Stable→volatile compact ordering targets prompt-cache-friendly prefixes for adopters using LLMs at scale. `buildAgentContext` rewritten as a thin shim over `buildContext(parsed, layer.consumed_profile, {sections: layer.reads})` — external `AgentContext` shape preserved. `BANCROFT_LAYERS` entries gained a `consumed_profile` field. New `uwmd render --profile=summary|live|compact|full|relevant [--sections=…] [--max-tokens=N] [--no-meta]` flag.
  - **Phase 5 — Refinement engine (dependency graph + perturbation VOI + L0a / L0b agents).** New [`packages/uwmd-core/src/calc/dependencies.ts`](./packages/uwmd-core/src/calc/dependencies.ts) exports `getExprDependencies(ast)` and `extractDependencyGraph(parsed, {packs?})` which walks every `MULTIFAMILY_PACK` calc plus every `custom_calculations[]` entry into a `DependencyGraph` of `(outputs: calc → inputs, inputs: input → calcs, formulas)`. New [`packages/uwmd-core/src/refinement.ts`](./packages/uwmd-core/src/refinement.ts) exports `rankGaps(parsed, opts?)` returning `RankGapsResult` with `by_voi[]` ranked by value-of-information and `by_stage_blocking[]` for non-numeric completeness gaps. The perturbation method evaluates each provisional input at its low / central / high values using interval arithmetic across the dependency graph, computes today's output range, then computes the collapsed range if the gap were known; VOI = today − collapsed, summed across affected outputs. Question templates ship in `defaults.ts` co-located with the ranges. Diagnostics surface non-monotonic outputs as warnings. Two new pipeline layers: `L0a Scope` (prerequisites: none; reads `property`; writes `noi_model`, `debt_structure`, `valuation`, `market_analysis`, `gaps`; `consumed_profile: summary`) and `L0b Scope Refinement` (prerequisites: `L0a`; reads `*`; writes `property`, `noi_model`, `debt_structure`, `gaps`; `consumed_profile: compact`). New `uwmd scope <file>` deterministically resolves every required input via the cascade and stamps results provisional at `deal_stage: scope`. New `uwmd refine <file> [--targets=...] [--top=N] [--json]` runs `rankGaps` and prints / emits the ranking. L0b prompt template at [`packages/uwmd-core/src/agents/L0b-prompt.md`](./packages/uwmd-core/src/agents/L0b-prompt.md).
  - **Phase 6 — Conformance corpus + RFC drafts.** New conformance fixtures: tier-1 `04-scope-only.uw.md` (back-of-napkin scope file), and six new malformed fixtures (`04-broken-chain` → `INT-01`, `06-wrong-actor` → `POL-01` with sibling `policies.json`, `07-replace-where-supersede-required` → `POL-02`, `08-provisional-without-gap` → `DQ-01`, `09-partial-without-overrides` → `DQ-03`). New tier-2 fixtures: `gaps-section-update` (post-write maintainer hook), `parent-hash-stamp` (integrity-aware edit), `stale-parent-rejected` (negative-path `INT-02`). New tier-3 mode: `dependency-graph-multifamily` exercises `extractDependencyGraph`. New tier-4 fixtures: `l0a-scope-deterministic` (shape contract for the scope agent's writes) and `consumer-profile-contract` (verifies every Bancroft layer declares the right `consumed_profile`). The conformance runner ([`scripts/run-conformance.mjs`](./scripts/run-conformance.mjs)) gained async dispatch, integrity / policy code multiplexing on tier-1 malformed via `verifyChain` + `verifyProvenance`, optional `<id>.policies.json` and `<id>.options.json` siblings on tier-1/tier-2 fixtures, `expected-error.json` for negative-path tier-2 fixtures, `runTier3Refinement` / `runTier4Profile` modes, and a `<volatile>` mask on `content_hash` strings (which canonicalize over a per-run timestamp). Final tally: 29 conformance fixtures pass, 0 fail.
  - **Deferred / discussed** — five items intentionally captured as RFC drafts rather than implementation in this train: [RFC 0009](./docs/rfcs/0009-meta-v2-reorg.md) (`_meta` v2 sub-object reorganization, the only proposed breaking change; deferred to v2.0 with back-compat parser shim), [RFC 0010](./docs/rfcs/0010-signed-blocks.md) (`_meta.integrity.signature` as a separate `@uwmd/signing` package; explicit non-goal as everyday open-standard usage), [RFC 0011](./docs/rfcs/0011-capability-tokens.md) (JWT-style scoped capability tokens for write authorization in orchestrator-bound deployments), [RFC 0013](./docs/rfcs/0013-corpus-retrieval.md) (per-section embedding sidecar for portfolio-scale "find similar deals", v3 territory), and a new "Range types and napkin mode" subsection added to [RFC 0005](./docs/rfcs/0005-stochastic-calculations.md) framing the v1.1 perturbation engine as the v1.1 approximation of a stochastic v2. Other items explicitly NOT pursued and documented in the architectural review's out-of-scope catalog: per-field provenance everywhere (rejected — `field_overrides` is the chosen mid-point), calc-engine confidence propagation (deferred indefinitely — math is murky), pure-halt mode for required fields (rejected — partial data is the norm), compiled binary `.uwc` format (rejected with extended explanation), AST cache files (deferred until measured parsing speed becomes a problem), per-block telemetry (no current adopter need), asset-class default tables for non-multifamily (one pack per RFC; office / retail / industrial follow), and `MarketDataLookup` reference implementation (interface only — adopters bring CoStar / Yardi / internal).
- **Calc engine v1.1 (Phase B)** — protocol version bumped to `1.1.0` with two additive Tier-3 changes. (1) Grammar gains short-circuiting logical operators `&&` and `||` between conditional and comparison precedence levels, with full null propagation (any null operand → null) and `CALC-TYPE-001` on non-boolean operands; the right side is only evaluated when the left does not determine the result. (2) Built-in function set expands by 10: math (`abs`, `floor`, `ceil`, `sqrt`, `pow`, `log`, `exp`) and financial (`fv`, `pv`, `nper`). All new financials use the same unsigned convention as the existing `pmt` (positive `pv` = loan balance, positive `pmt` = periodic payment) and admit zero-rate edge cases by closed-form fallback. Spec updated at [`spec/UW_PROTOCOL_v1.md`](./spec/UW_PROTOCOL_v1.md) §VIII.1 (EBNF) and §VIII.3 (builtin table). Backwards-compatible: every v1.0.0 expression continues to parse and evaluate identically.

### Changed
- `@uwmd/core` no longer declares a `bin` entry — the standalone `uwmd` package owns the binary so the two packages don't conflict when both installed. Library consumers continue to import from `@uwmd/core`; CLI consumers should install `uwmd` (or `npx uwmd`). The CLI module is now exposed as the `@uwmd/core/cli` subpath export.
- Release workflow now publishes both `@uwmd/core` and `uwmd` together on each `v*` tag, with a version-match gate that also verifies `uwmd`'s pinned dependency on the corresponding `@uwmd/core` version.
- Quickstart in `README.md` and fixture-regen examples in `CONTRIBUTING.md` updated to use `npx uwmd …` (or `npm run cli -- …` from a clone) instead of the raw `node packages/uwmd-core/dist/cli.js` path.
- Format spec — added RFC 2119 preamble; restored §4.18 (Pipeline Log) to canonical numeric position; clarified section count (21 standard + 1 meta).
- Protocol spec — fixed `.uw.institution.json` cross-reference (now points to Appendix C.6); added "Normative schema:" links from §I.4, §III.1, §V, §VIII, §XI to the new JSON Schemas; added §XIII "Future work" consolidating v2 deferrals.
- Root `npm test` and `npm run build` now run across all workspaces (`--workspaces --if-present`), not just `@uwmd/core`. The existing `@uwmd/excel` test suite and the new `uwmd` CLI smoke tests are now covered.
- `vitest` bumped from `^1.6.0` to `^3.0.0` in `@uwmd/core`, `@uwmd/excel`, and `uwmd` (clears four moderate `npm audit` advisories in the vite/esbuild dev-server chain).
- `esbuild` bumped from `^0.24.0` to `^0.25.0` in [`tools/vscode-uwmd`](./tools/vscode-uwmd/) (clears the dev-server CSRF advisory).
- `vite` bumped from `^5.4.0` to `^7.0.0` in [`tools/web-editor`](./tools/web-editor/); the web-editor lockfile now reports `0 vulnerabilities`.
- Calc engine — internal AST node for ternary expressions renamed `cond.then` → `cond.consequent` to avoid the false thenable signal the previous shape produced. No external API change (the AST is internal to `packages/uwmd-core/src/calc/parser.ts` and `evaluator.ts`).
- Docs site prebuild ([`tools/docs-site/scripts/prebuild.mjs`](./tools/docs-site/scripts/prebuild.mjs)) — now copies the six numbered RFC drafts into the site tree and rewrites `docs/rfcs/NNNN-…` and bare `NNNN-…` link forms to `/about/rfcs/NNNN-…`. Fixes 18 dead links that were breaking `npm run build` for the docs site.
- Workspace lockfile policy — `packages/uwmd-core/package-lock.json` removed (workspace member, drifts from the root lockfile). Tools under `tools/*` are intentionally not workspace members and continue to commit their own lockfiles. Documented in [CONTRIBUTING.md](./CONTRIBUTING.md).

### Removed
- `packages/uwmd-core/ANTHROPIC_API_KEY.env` — local-dev convenience file containing a real API key. Deleted; the CLI already loads `ANTHROPIC_API_KEY` from `process.env`. Future: set it via your shell or a gitignored `~/.config/uwmd/.env` instead of inside the repo tree.

## [1.0.0-pre] — pre-public

Pre-public development of the format spec (`UW_FORMAT_SPEC_v1.md`) and reference
parser/validator/renderer/runner/Claude agent host inside `uwmd/`.

[Unreleased]: https://github.com/UWMD-OSP/UW-Markdown/compare/v1.0.0...HEAD
