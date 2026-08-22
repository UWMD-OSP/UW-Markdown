# 09 — Conformance & testing

Two test systems guard this repo: **unit tests** (Vitest, per package) and the
**conformance corpus** (fixture/expected pairs that any implementation — including
this one — runs to prove behavior). CI runs both.

## Unit tests (Vitest)

- Nearly every `src/*.ts` has a sibling `src/*.test.ts`. In `@uwmd/core` the
  exceptions are `index.ts` and `browser.ts` (re-export barrels) and `cli.ts`
  (covered by the smoke tests in `packages/uwmd-cli` instead). Run from a
  package with `vitest run`; from the root `npm test` runs all workspaces.

> **Type-check tests separately: `npm run typecheck:tests`.** Neither `npm run
> build` nor `npm test` reads a test file as TypeScript — `tsconfig.json`
> excludes `src/**/*.test.ts` from the build, and Vitest transpiles with
> esbuild, which strips types without checking them. Every workspace carries a
> `tsconfig.test.json` to close that hole: same compiler options, `noEmit`,
> tests included. The root script fans out across all five
> (`--workspaces --if-present`) and runs in CI on the Node 20 leg of
> `build-and-test`. `@uwmd/cli` is the odd one — it has no build of its own,
> so its config stands alone rather than extending anything, and covers
> `test/**` rather than `src/**`.
>
> Run it after touching a test. Twelve type errors were sitting in the suite
> the first time it ran — none of them failing tests, but each one a place
> where the compiler had nothing to say about code that claimed to assert
> something. Compile-time assertions (an exhaustiveness `Record`, a
> `satisfies`, an expect-error helper) now do work in a test file, though a
> guard that protects *production* callers still belongs in a source file
> where the build itself enforces it — `ASSET_CLASSES` in `types.ts` is the
> worked example.
- Coverage: `npm run test:coverage` (root) → `@uwmd/core` with
  `@vitest/coverage-v8`. **Thresholds are enforced**, not reported: the floor
  lives in `packages/uwmd-core/vitest.config.ts` (82 lines / 82 statements / 97
  functions / 76 branches) and the CI `coverage` job has no `continue-on-error`,
  so dropping below it fails the build. Raise the floor when coverage rises;
  lowering one should be argued for in the PR description. The re-export
  barrels `index.ts` and `browser.ts` are excluded — ~1,050 lines of `export
  {}` that no test imports, which measured 0% and moved the total by four
  points without saying anything about what is tested.
- Property tests use `fast-check`: `calc/calc.property.test.ts` asserts calc
  *totality* (any input parses or throws a typed `CalcError`) and Excel↔evaluator
  parity. `packs/packs.test.ts` asserts every pack metric evaluates against the
  Parkview fixture and that the Excel emission matches exactly.

## Conformance corpus (`conformance/`)

Runner: [`scripts/run-conformance.mjs`](../../scripts/run-conformance.mjs). It
imports the **built** `@uwmd/core` from `dist/`, so **build before running**.

```bash
npm run build
npm run conformance                 # 1,2,3 + 4-replay + lite + receipts + market-data + modules + packages + composition + capital-stack
npm run conformance -- --tier=1,2,3,4,lite,receipts,modules
npm run conformance -- --tier=lite         # the UW Lite suite alone
npm run conformance -- --tier=receipts     # the receipts suite alone
npm run conformance -- --tier=modules      # the module manifest suite alone
npm run conformance -- --tier=packages     # the deal package suite alone
npm run conformance -- --tier=composition  # the RFC 0021 composition suite alone
npm run conformance -- --tier=capital-stack  # the RFC 0026 capital-stack suite alone
npm run conformance -- --tier=2 --update   # regenerate that tier's baselines
npm run conformance -- --json              # machine-readable summary
```

Exit code 0 = all pass, 1 = at least one failure. The **`4-replay`** suite runs
by default — it is deterministic and needs no network or API key. The numbered
**tier 4** suite stays gated behind an explicit `--tier=4`, because it is
shape/lint-only plus the profile contract and assumes an operator-driven live
run.

### Tier 1 — Reader

`conformance/tier-1-reader/`:
- `fixtures/*.uw.md` parsed and compared (canonical JSON projection) against
  `expected/<id>.parsed.json`; `chat` and `summary` renders compared against
  `expected/<id>.rendered-{chat,summary}.{txt,md}` (whitespace-normalized).
- `malformed/<id>.uw.md` + `<id>.expected.json` — negative tests. `expected.json`
  declares `expected_codes[]` the validator MUST surface (extra codes allowed) and
  optional `must_parse`. INT-/POL- expectations also exercise
  `verifyChain`/`verifyProvenance`; an optional `<id>.policies.json` supplies
  custom policies.

### Tier 2 — Editor

`conformance/tier-2-editor/fixtures/<scenario>/`: `before.uw.md` +
`operation.json` → run `applyEdit` (or `applyEditAsync` when `options.json` has
`integrity: true`) with `context.json` → compare against `after.uw.md`. Volatile
fields (`last_modified`, `timestamp`, `ts=`, `content_hash`) are stripped before
byte comparison. Negative scenarios provide `expected-error.json` declaring the
`code` `applyEdit` must fail with. **The point of Tier 2: bytes outside the edited
region must be preserved.**

### Tier 3 — Calc Host

`conformance/tier-3-calc-host/fixtures/<scenario>/`: `deal.uw.md` + `calc.json`
(a `ModuleCalcDecl`) → `evaluateCalc` → compare projected `{calc_id, ok, value,
unit?, error?}` against `expected-result.json`. Plus a **refinement** mode
(`refinement/<scenario>/`): `deal.uw.md` → `extractDependencyGraph` → compare the
projected `{outputs, inputs, formulas}` graph against `expected-graph.json`.

### Tier 4 — Agent Host

`conformance/tier-4-agent-host/`:
- `replay/<scenario>/` — **the real gate, and it runs by default.**
  `before.uwx.md` + `cassette.json` + a frozen `after.uwx.md`. The cassette
  supplies the model's side of the conversation, so the run needs no network and
  no key, and the resulting document is compared **byte for byte**. That single
  comparison pins context assembly, tool-call extraction, supersede semantics,
  `_meta` ownership, the pipeline-log append, and the frontmatter update at once.

  Determinism comes from `BancroftRunOptions.now`: a constant clock freezes
  `_meta.timestamp`, collapses `duration_ms`, and makes the log-entry id
  derivable instead of random.

  Replay is **strict** — each exchange records the request it answered, and a
  mismatch is a typed error naming the changed field, so a cassette doubles as a
  prompt-drift detector. Matching is sequential rather than keyed, because a
  keyed cassette would happily serve a reordered run and hide a change in call
  order. See `conformance/tier-4-agent-host/replay/README.md`, including its
  note on what recorded replay does *not* prove.
- `fixtures/<scenario>/`: `before.uw.md` + `expected-after-shape.json` —
  **lint-only** (parse + JSON-validate), retained for operator-driven live runs.
  Note the `l6-risk-rating` fixture is not runnable as written: it carries only
  a `property` section while L6 requires `noi_model`, `valuation`, and
  `debt_structure`. The replay scenario uses its own input for that reason.
- `profile/<scenario>/expected-layer-profiles.json` — asserts the `layer →
  consumed_profile` map from `BANCROFT_LAYERS` matches the baseline.

### UW Lite — representation + bridge

`conformance/lite/` is **named, not numbered**: UW Lite
([`spec/UW_LITE_SPEC_v1.md`](../../spec/UW_LITE_SPEC_v1.md)) is a source
representation rather than a protocol conformance tier. It runs by default.

- `fixtures/*.uw.md` must parse with **zero** error-severity issues *and*
  compile through `deal-summary-v1`. Each freezes five artifacts in `expected/`:
  `<id>.canonical.json` (RFC 8785 financial canonical form), `<id>.digest.txt`,
  `<id>.rendered.uw.md` (canonical rendering), `<id>.compile.json` +
  `<id>.uwx.md`, and `<id>.projection.json` + `<id>.projected.uw.md`.
- `malformed/<id>.uw.md` + `<id>.expected.json` — parse-time `LITE_*` codes.
  `"must_parse": false` asserts `parseUWLite` **throws** with a listed code
  (used for `LITE_UNCLOSED_FRONTMATTER`).
- `compile/<id>.uw.md` + `<id>.expected.json` — documents that parse cleanly but
  must be **rejected by the bridge** with `LITE_COMPILE_*`. The runner fails a
  fixture here that has parse errors, to keep the two layers separate.
- `equivalence.json` — groups of fixtures differing only along axes spec §6
  excludes; all members must hash to one digest.

Two properties are asserted as **invariants, not baselines**, so they bind any
implementation regardless of our frozen output:

1. **Rendering round-trip (§7).** Parsing a canonical rendering reproduces the
   source's financial canonical form.
2. **Display equivalence (§6).** Labels, headings, prose, field order, bullet
   character, whitespace, comma grouping, and equivalent numeric spellings do
   not reach the canonical form.

Digests use stock `node:crypto` in the runner rather than the library's own
`sha256Hex`, so a frozen digest is independent evidence rather than a
restatement of the implementation. The whole Lite bridge is deterministic (no
wall-clock, no randomness — timestamps come from `frontmatter.created`), so
baselines need no volatile-field stripping.

## Schema validation

`npm run validate-schemas` → [`scripts/validate-schemas.mjs`](../../scripts/validate-schemas.mjs)
validates `spec/schemas/*.schema.json` with Ajv 2020-12 (+ `ajv-formats`),
pre-registered by `$id` for cross-file `$ref`s. Keep schemas in lockstep with the
matching `protocol.ts` types (notably `ModuleManifest` ↔
`module-manifest.schema.json`).

### Receipts — issuance, verification, refusal

`conformance/receipts/` is likewise **named, not numbered**: a verification
receipt ([`spec/UW_RECEIPT_v1.md`](../../spec/UW_RECEIPT_v1.md), RFC 0016) is a
detached artifact, not a protocol tier. It runs by default.

- `issue/<scenario>/` — `deal.uw.md` or `deal.uwx.md` plus
  `expected-receipt.json`. Issuance is deterministic apart from `issued_at`,
  which the runner stubs.
- `verify/<scenario>/` — `deal.*` + `receipt.json` + `expected-verdict.json`
  declaring one of `verified` / `failed` / `unverifiable` plus the `RCP-NN`
  codes that must appear. The five scenarios cover a clean verify, a record
  mutated after issuance, a stated result that disagrees with recomputation, a
  receipt naming an unknown pack, and a signed receipt with no backend. The last
  two must be `unverifiable`, **not** `failed` — that is the case
  implementations are most likely to get wrong.
- `refuse/<scenario>/` — `deal.*` + `expected.json` naming the `ReceiptError`
  code. Issuance must throw, never emit a caveated receipt.

> **Three receipt fixtures move on every `@uwmd/core` release.** The two
> `issue/` baselines record the issuing engine, so `expected-receipt.json`
> carries the new `engine_version` (and `protocol_version`, on a protocol bump)
> — regenerate with `npm run conformance -- --tier=receipts --update` and check
> the diff is only those fields.
>
> `verify/03-result-disagrees` is the subtle one: its receipt must be stamped
> with the **current** `CORE_VERSION`, because the scenario tests that a
> disagreement is `failed` *when the engine matches*. Leave it on the previous
> version and `RCP-07` correctly reclassifies it as `unverifiable`, the suite
> fails, and the fixture has quietly stopped testing what it was written to
> test. The other four `verify/` fixtures are deliberately left on older engine
> versions — their verdicts do not depend on the engine matching, which is
> itself worth asserting.

Two properties are asserted as **invariants, not baselines**:

1. **Re-issuance stability (§4).** Re-issuing over an unmodified record
   reproduces the same `subject.digest` and the same `results`; only `issued_at`
   may differ.
2. **Three-state verdicts (§5).** Every verification lands on exactly one of
   `verified` / `failed` / `unverifiable`.

### Modules — manifest verdicts and schema parity

`conformance/modules/` holds single-manifest fixtures for the declarative v1
module loader. It runs by default and needs no network. Each fixture is asserted
twice: the loader's verdict must match the fixture (`accept/` loads; `reject/`
refuses and emits every listed `PROTO-MOD` code), and the loader must **agree
with the normative schema**, validated with ajv.

Parity is the reason the suite exists. `@uwmd/core` cannot depend on a JSON
Schema validator, so `modules.ts` re-implements
`spec/schemas/module-manifest.schema.json` by hand — and a hand-written mirror
drifts silently. It had, on seven of eight probes. Codes are matched rather than
messages, so wording can improve without touching fixtures.

A `reject/` fixture may declare `schema_divergence` when the loader is
deliberately stricter than JSON Schema can express — requiring
`deterministic: true`, or parsing the safe-expression grammar. Those are the only
permitted disagreements and each must state its reason. The opposite direction —
loader accepts, schema refuses — is always a bug and has no opt-out.

Registry-level behavior (dependency order, version ranges, duplicate module ids)
lives in `packages/uwmd-core/src/modules.test.ts` instead, since a fixture file
holds one manifest.

### Composition — I-1, bounds, staleness, rollups

`conformance/composition/` covers RFC 0021. The suite has one reason to exist:
**I-1**, the rule that an externalized record and its inline twin produce
identical canonical forms and identical semantic digests. `resolve/` asserts it
directly, and `resolve/collection-order/` asserts it survives a shuffled `parts`
array — the case that fails the moment merge order comes from the document
rather than from a total order over the collection key.

The rest guard the ways I-1 can silently stop being true, or the ways a
resolution can look successful while being wrong:

- `reject/` — one fixture per refusal (`COMP-DUP-KEY`, `COMP-COUNT-MISMATCH`,
  `COMP-SECTION-MISMATCH`, `COMP-PART-MALFORMED`).
- `unresolved/missing-part/` — the one that matters most operationally. A
  missing fragment must leave the section externalized, **never** produce a
  rent roll of the units that happened to resolve. The fixture asserts the
  section still carries its directive, because a smaller rent roll still
  totals, still validates, and still produces a confident DSCR.
- `composite/` — graph shape, the depth bound, cycle detection (including the
  post-walk unreachability check, which catches a cycle no root leads into),
  and `stale` as a third status distinct from `failed`.
- `inherit/` — nearest ancestor wins, equidistant ancestors refuse.
- `rollup/` — two-stage verification, including that a child which failed its
  own receipt short-circuits **before** any arithmetic runs.

Fixtures under `composite/`, `inherit/`, and `rollup/` are `case.json` graph and
member descriptions rather than documents, because what they exercise is the
resolver and the verifier, not the parser.

**Not yet covered:** the RFC also names a `lite-projection/externalized/`
fixture, asserting the UWX→Lite projection reports externalized sections in its
omission report. `lite-bridge.ts` does not implement that yet, so the fixture
would assert nothing; it lands with the behaviour.

### Capital stack — state-and-verify sizing (RFC 0026)

`conformance/capital-stack/` covers the seven scenarios RFC 0026 names. Like
the rollup suite, the verifier scenarios are `case.json` stack + context
descriptions (they exercise `verifyCapitalStack`, not the parser); the
validator and regression scenarios are full documents. The runner dispatches
on which files a scenario directory carries (see `conformance/README.md`).

- `senior-mezz-pref-verified/` — all six sizing `fn`s stated correctly →
  `verified`.
- `sizing-disagrees/` — one stated value perturbed → `failed` with
  `CS-SIZING-DISAGREES`, never a silent pass.
- `pref-cash-vs-accrued/` — two stacks identical but for the pref `accrual`;
  cash-pay pref enters `blended_coverage`, accrued does not, and
  `debt_yield_through` is identical either way (balance counts regardless of
  accrual).
- `ab-mezz-notes/` — `mezz_a` + `mezz_b`: the ordered array expresses what
  fixed slots could not.
- `senior-reconciles-debt-structure/` — the generalized `CC-03` in both
  directions: equal senior amounts are clean, mismatched fires.
- `no-stack-single-loan/` — **the additivity pin.** A document with only
  `debt_structure` computes every multifamily pack metric exactly as before
  the RFC and trips no `CS-*` rule. The pinned values are hand-verified in the
  fixture's `why`, not regenerated.
- `reject-waterfall-in-v1/` — distribution tiers at the section level and a
  `promote` smuggled onto a tranche are both refused with
  `CS-WATERFALL-UNSUPPORTED` (the §E Phase-2 boundary, enforced).

### Packages — manifests, archives, and the context boundary

`conformance/packages/` covers RFC 0018 deal packages. Manifest fixtures assert
validator verdicts and `PKG-` codes; a set of baseline-free invariants assert
deterministic encoding, binary round-trip (a member with bytes above 0x7F must
survive exactly — packages carry PDFs), three-state verification, and the rule
the JSON context view exists for: **source-evidence bytes are never inlined**,
even when a caller passes them in explicitly.

Schema parity here is asserted in **one direction only** — anything the
validator accepts, the normative schema must accept. Full parity is impossible:
JSON Schema cannot express the dangling-link check (it needs to cross-reference
`members` from `links`) or the wrong-layer edge rule (it needs the edge
registry). Claiming two-way parity would be claiming a guarantee that does not
exist. The `modules` suite *can* achieve two-way parity, and does.

Archive-level negatives (traversal, symlinks, encryption, ZIP64, ratio bombs)
are not duplicated here: both this codec and the CSV bundle route through
`zip-safety.ts`, so testing them twice would test one implementation twice.

## What CI runs

`.github/workflows/ci.yml`: lint (Biome) on Node 20, then build + test +
`npm run conformance` on a Node 20/22 matrix — the runner's **default** suite
list, deliberately not a pinned `--tier=`. CI used to pin `1,2,3,lite,receipts`,
which silently excluded the `4-replay` suite once it landed: a suite could be
added to the default and never gate a pull request. Adding a suite to the
default list is now enough to make CI enforce it. `release.yml` publishes
`@uwmd/core` and `uwmd` on `v*` tags. (See [11 — Build, release & governance](11-build-release-governance.md).)

## Adding fixtures (quick reference)

- **Tier 1:** drop a `.uw.md` in `fixtures/`, then `--tier=1 --update` to mint the
  expected baselines (review the diff before committing).
- **Tier 1 malformed:** add `<id>.uw.md` + a hand-written `<id>.expected.json`
  with `expected_codes`.
- **Tier 2:** make `<scenario>/` with `before.uw.md` + `operation.json` (+
  `context.json`/`options.json`), then `--tier=2 --update` to mint `after.uw.md`.
- **Tier 3:** make `<scenario>/` with `deal.uw.md` + `calc.json`, then `--tier=3
  --update`.
- **Lite:** drop a `.uw.md` in `lite/fixtures/`, then `--tier=lite --update`. Run
  `--tier=lite` *without* `--update` first — the negative and invariant checks
  (malformed, compile, round-trip, equivalence) need no baselines, so they
  validate your fixture before you freeze anything. For a negative case, add
  `<id>.uw.md` + `<id>.expected.json` under `lite/malformed/` (parse errors) or
  `lite/compile/` (bridge errors); neither needs `--update`.
- **Receipts:** make `receipts/issue/<scenario>/` with a deal document, then
  `--tier=receipts --update` to mint `expected-receipt.json`. Verify and refuse
  scenarios need no `--update`: hand-write `expected-verdict.json` /
  `expected.json`, and produce `receipt.json` with
  `uwmd receipt issue <deal> --issued-at 2026-08-09T00:00:00Z --stdout`.
- Regeneration helper: [`scripts/regen-conformance.mjs`](../../scripts/regen-conformance.mjs).

> `--update` overwrites baselines from current library output — only use it when
> you intend to change the contract, and always eyeball the resulting diff.
