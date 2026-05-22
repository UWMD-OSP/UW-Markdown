# 09 — Conformance & testing

Two test systems guard this repo: **unit tests** (Vitest, per package) and the
**conformance corpus** (fixture/expected pairs that any implementation — including
this one — runs to prove behavior). CI runs both.

## Unit tests (Vitest)

- Every `src/*.ts` has a sibling `src/*.test.ts`. Run from a package with
  `vitest run`; from the root `npm test` runs all workspaces.
- Coverage: `npm run test:coverage` (root) → `@uwmd/core` with
  `@vitest/coverage-v8`.
- Property tests use `fast-check`: `calc/calc.property.test.ts` asserts calc
  *totality* (any input parses or throws a typed `CalcError`) and Excel↔evaluator
  parity. `packs/packs.test.ts` asserts every pack metric evaluates against the
  Parkview fixture and that the Excel emission matches to 6 decimals.

## Conformance corpus (`conformance/`)

Runner: [`scripts/run-conformance.mjs`](../../scripts/run-conformance.mjs). It
imports the **built** `@uwmd/core` from `dist/`, so **build before running**.

```bash
npm run build
npm run conformance                 # tiers 1,2,3 (default)
npm run conformance -- --tier=1,2,3,4
npm run conformance -- --tier=2 --update   # regenerate that tier's baselines
npm run conformance -- --json              # machine-readable summary
```

Exit code 0 = all pass, 1 = at least one failure. **Tier 4 is gated behind an
explicit `--tier=4`** because it requires a live LLM or a replay store (not in
CI); the in-repo tier-4 check is shape/lint-only plus the profile contract.

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
- `fixtures/<scenario>/`: `before.uw.md` + `expected-after-shape.json` — currently
  **lint-only** (parse + JSON-validate; live runs are operator-driven, replay
  store deferred to v2).
- `profile/<scenario>/expected-layer-profiles.json` — asserts the `layer →
  consumed_profile` map from `BANCROFT_LAYERS` matches the baseline.

## Schema validation

`npm run validate-schemas` → [`scripts/validate-schemas.mjs`](../../scripts/validate-schemas.mjs)
validates `spec/schemas/*.schema.json` with Ajv 2020-12 (+ `ajv-formats`),
pre-registered by `$id` for cross-file `$ref`s. Keep schemas in lockstep with the
matching `protocol.ts` types (notably `ModuleManifest` ↔
`module-manifest.schema.json`).

## What CI runs

`.github/workflows/ci.yml`: lint (Biome) on Node 20, then build + test +
`run-conformance.mjs --tier=1,2,3` on a Node 20/22 matrix. `release.yml` publishes
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
- Regeneration helper: [`scripts/regen-conformance.mjs`](../../scripts/regen-conformance.mjs).

> `--update` overwrites baselines from current library output — only use it when
> you intend to change the contract, and always eyeball the resulting diff.
