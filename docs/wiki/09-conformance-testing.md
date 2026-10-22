# 09 — Conformance & testing

Format 3.0 is the only format the reference library reads ([RFC
0081](../rfcs/0081-one-format-one-protocol.md)): bare section payloads with an
inline nested `_meta`, a block digest over the block minus `_meta`, and one
home for each fact. A missing or other `uw_version` is refused at parse as
`UNSUPPORTED_FORMAT_VERSION`. Phase 4 deleted the old readers, the migrators
and the one-off re-authoring scripts; there is no migration path in the
product. Release 4.0.0 carries it, labelled Format 3.0 and Protocol 4.0.0;
3.0.0 is the last release that reads older formats.



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
- Coverage: `npm run test:coverage` (root) → `@uwmd/verify`, then
  `@uwmd/core`, with `@vitest/coverage-v8`. **Thresholds are enforced**, not
  reported: each package's floor lives in its `vitest.config.ts` (verify: 93
  lines / 93 statements / 98 functions / 86 branches; core: 94 / 94 / 97 / 81,
  re-measured for 4.1.0 after the standard modules and their tests moved to
  verify in RFC 0083 Phase 2) and the CI `coverage` job has no
  `continue-on-error`, so dropping below either fails the build. Raise the
  floor when coverage rises; lowering one should be argued for in the PR
  description. The re-export barrels `index.ts` and `browser.ts` are excluded
  — ~1,050 lines of `export {}` that no test imports, which measured 0% and
  moved the total by four points without saying anything about what is
  tested. Core also excludes the CLI entry files `cli.ts` and
  `cli-portfolio.ts`, which run only as spawned `uwmd` processes (`cli.test.ts`,
  the conformance driver). Counted, they were never-loaded denominator whose
  size depended on the platform (73.99% on Windows, 78.04% on Linux CI, with
  the same covered lines).
- Property tests use `fast-check`: verify's `calc/calc.property.test.ts`
  asserts calc *totality* (any input parses or throws a typed `CalcError`), and
  core's `packs/excel-emit.property.test.ts` asserts the Excel emitter accepts
  every AST the same generator produces. Core's `packs/packs.test.ts` asserts
  every pack metric evaluates against the Parkview fixture and that the Excel
  emission matches exactly.

### Runs under concurrent load

Root `npm test` runs the workspaces in order and caps each Vitest fork pool at
two workers. Core uses the same cap for standalone tests and coverage. This
keeps concurrent suites from each filling the machine with workers; file
isolation and all test cases remain enabled. For a deliberate concurrency
experiment, run a package with `npm test -- --maxWorkers=4`.

CLI test files use a 30-second test budget and await the shared
[`test/cli.mts`](../../test/cli.mts) runner. It launches the existing built
executable asynchronously, preserves binary stdout and nonzero exit codes,
and rejects launch errors, signals, output overflow and its 20-second child
deadline. Test cleanup terminates outstanding children. The default unit-test
budget remains five seconds; existing integration-test budgets and worker
RPC deadlines are unchanged.
Build before testing because executable tests consume `dist/`.

Use library APIs for calculation assertions and reuse CLI-generated setup
fixtures with an independent copy per test. Keep real subprocesses for
argument parsing, stdout/stderr, exit status, packaging and file-writing
behavior. A shared setup must retain its success assertion, and copied
fixtures must preserve tampering and missing-file negative controls.

To check reliability on a busy machine, build a second worktree and run full
`npm test` suites continuously there while running the full root suite three
times in the first worktree. Record wall time and exit status for each run;
keep the competing revision fixed when comparing before and after.

## Conformance corpus (`conformance/`)

RFC 0078 Phase 3 uses case-level ownership in
[`conformance/corpus-index.json`](../../conformance/corpus-index.json).
Every check belongs exactly once to Reader, Verifier, one optional profile
(Module, Integrity, Representations, Portfolio, Sensitivity or Stochastic),
or starter products. Directories describe content; owners come from the index.
Editor, layer-profile, rendering, defaults/cascade, projections and refinement checks
belong to [docs/starter](../starter/README.md), remain in CI and have separate
report counts. Mixed cases keep all their assertions and are product checks.

RFC 0081 Phase 5 renames the corpus to `documents/`, `calc/` and
`starter/{editor,refinement}/`. Suites use the same content names
(`starter-editor` and `starter-refinement` for starter checks); RFC 0112
removed `starter/agent/` and its `starter-agent-profile` check with the layer
registry.
Portable ids and filenames use `<owner>__<suite>__<scenario>__<operation>`;
malformed document scenarios start with `malformed-`. The reserve
`bare-block` cases keep their existing checks. No old path or id is accepted.

The corpus reconciled **1,053 default + three opt-in = 1,056 existing reference
checks, plus five new validate-only Verifier checks = 1,061**. RFC 0081 Phase 3
retires seven checks whose subject it removes (six conflict-only Verifier
controls and `meta-v2/06-digest-shape-insensitive`), leaving 1,054. RFC 0081
Phase 4 deletes the checks that exercised only a backward-compatibility path
(the `meta-v2` and `migrate` suites, the retired-format projections and the
module compatibility shells) and adds refusal cases for what those paths used
to admit, leaving **1,069** and **336 portable CLI projections**. The lender
fixture stays **187/0/0**. Later RFCs added cases. Removing agent execution
from the toolkit retired the four starter checks that needed an agent run or a
model provider (`starter-agent/l0a-scope-deterministic`,
`starter-agent/l6-risk-rating` and
`starter-agent-replay/l6-risk-rating/{sections,document}`). RFC 0112 retired
the layer-profile contract check (`starter-agent-profile/consumer-profile-contract`)
and module fixture `reject/02-agent-layer-malformed` with its schema-parity
twin, and added `reject/20-agent-layers-unknown-member` with its twin. The index now holds **1,235** reference checks and **397**
portable CLI projections:

| Owner | Reference | Portable |
|---|---:|---:|
| reader | 32 | 17 |
| verifier | 818 | 328 |
| module | 76 | 1 |
| integrity | 32 | 14 |
| representations | 150 | 0 |
| portfolio | 14 | 0 |
| sensitivity | 5 | 0 |
| stochastic | 7 | 0 |
| starter-products | 101 | 37 |
| **Total** | **1,235** | **397** |

A case testing something §II.2 lists as a Verifier requirement is a Verifier
case, even when it needs an expression evaluator: those keep
`requires_capabilities: ["calc-evaluate"]` and are skipped, not failed, for a
Verifier that does not claim it.

`--tier=verifier` includes Reader; `--profile=module` selects only that profile;
`--starter-products` selects product checks. Combine selectors to claim both.
`--tier` takes `reader` or `verifier` only; any other value is a usage error.
`--suite`
selects an existing fixture family independently of ownership. With no
selector every indexed check runs, with counts by target.

Unknown owners, duplicate/missing results and unindexed portable identities
fail the gate, as does a runner suite with no index rows or an indexed suite
with no runner. Baseline updates require full runs or `--suite`; a target
filter is refused because mixed-suite updates could alter unselected baselines.
A family includes its child suites (`starter-refinement` under `calc`);
baseline updates selecting only a child suite are refused.
The descriptions below use the content paths introduced by RFC 0081 Phase 5.


Runner: [`scripts/run-conformance.mjs`](../../scripts/run-conformance.mjs). It
imports the **built** `@uwmd/core` from `dist/`, so **build before running**.

```bash
npm run build
npm run conformance                 # all indexed standard and starter checks
npm run conformance -- --tier=verifier --profile=module,integrity,representations,portfolio,sensitivity,stochastic --starter-products
npm run conformance -- --suite=lite         # the UW Lite suite alone
npm run conformance -- --suite=receipts     # the receipts suite alone
npm run conformance -- --suite=modules      # the module manifest suite alone
npm run conformance -- --suite=packages     # the deal package suite alone
npm run conformance -- --suite=composition  # the RFC 0021 composition suite alone
npm run conformance -- --suite=capital-stack  # the RFC 0026 capital-stack suite alone
npm run conformance -- --suite=lease-up     # the RFC 0008 lease-up suite alone
npm run conformance -- --suite=capability   # the RFC 0011 capability-token suite alone
npm run conformance -- --suite=locale       # the RFC 0001 display-locale suite alone
npm run conformance -- --suite=starter-editor --update   # regenerate that family's baselines
npm run conformance -- --json              # machine-readable summary
```

Exit code 0 = all pass, 1 = a failed assertion, 2 = an invalid selector or
coverage error. The layer-profile check runs by default as a starter product;
no model is called. JSON reports contain
canonical `target` plus `tier`, `profile` or `starter_product`, and `by_target`
counts. Only content names are accepted as fixture-family addresses.

### Reader, Verifier and starter fixture storage

`conformance/documents/`:
- `fixtures/*.uw.md` parsed and compared (canonical JSON projection) against
  `expected/<id>.parsed.json`; `chat` and `summary` renders compared against
  `expected/<id>.rendered-{chat,summary}.{txt,md}` (whitespace-normalized).
- `expected/<id>.validation.json` freezes each valid fixture's **validation
  verdict** — `overall_status` plus every distinct `(code, severity)` pair.
  Before this baseline existed, valid fixtures asserted nothing about
  validation, so a rule escalation (warning → error) could flip
  `uwmd validate` to exit 1 on a fixture with the suite still green — the
  blind spot RFC 0027 Appendix A documented. A new code *and* a severity
  flip on an existing one are both visible diffs now.
- `malformed/<id>.uw.md` + `<id>.expected.json` — negative tests. `expected.json`
  declares `expected_codes[]` the validator MUST surface (extra codes allowed) and
  optional `must_parse`. An optional `field_issues[]` pins `{code, section, field}`
  rows that MUST appear, compared as a multiset (RFC 0104). INT-/POL- expectations also exercise
  `verifyChain`/`verifyProvenance`; an optional `<id>.policies.json` supplies
  custom policies.
- `malformed/<id>.validation.json` (06 and 07 only) freezes the Verifier
  `[validate]` projection of a starter check: the validator's `overall_status`
  and `(code, severity)` pairs, plus the `provenance` pairs `verifyProvenance`
  reports under the fixture's policies. `currency/malformed`,
  `locale/unsupported-locale-refuses` and `source/04-colon-form-rejected` carry
  the same projection as `expected-validation.json`.

### Editor starter checks

`conformance/starter/editor/fixtures/<scenario>/`: `before.uw.md` +
`operation.json` → run `applyEdit` (or `applyEditAsync` when `options.json` has
`integrity: true`) with `context.json` → compare against `after.uw.md`. Volatile
fields (`last_modified`, `timestamp`, `ts=`, `content_hash`) are stripped before
byte comparison. Negative scenarios provide `expected-error.json` declaring the
`code` `applyEdit` must fail with. **The editor quality bar: bytes outside the edited
region must be preserved.**

### Verifier and Module calculations

All but one of these are Verifier checks (§II.2: dictionary reproduction, the
IRR procedure, the §VIII.1–VIII.3 notation). `revpar-basic`, a custom
ADR × occupancy declaration, is the Module check.

`conformance/calc/fixtures/<scenario>/`: `deal.uw.md` + `calc.json`
(a `ModuleCalcDecl`) → `evaluateCalc` → compare projected `{calc_id, ok, value,
unit?, error?}` against `expected-result.json`. Plus a **refinement** mode
(`conformance/starter/refinement/<scenario>/`): `deal.uw.md` → `extractDependencyGraph` → compare the
projected `{outputs, inputs, formulas}` graph against `expected-graph.json`.

### Agent output

The toolkit hosts no agents, so there are no shape or replay checks of agent
output; a host that runs its own agents tests its own writes. RFC 0112 retired
the layer-profile check with the layer registry it read.

### UW Lite — representation + bridge

`conformance/lite/` is **named, not numbered**: UW Lite
([`spec/UW_LITE_SPEC.md`](../../spec/UW_LITE_SPEC.md)) is a source
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
  excludes; all members must hash to one digest. The
  `decimal-exactness-percent-vs-fraction` group is the **RFC 0025 regression
  pin**: `06-decimal-exact-percents` states rates only as percent literals
  whose value under naive division (`Number(p) / 100`) lands one ULP away
  from the fraction's own double (`5.51 / 100` ≠ `0.0551`), and
  `07-decimal-exact-fractions` states the same values as bare fractions with
  `unit=fraction`. Their shared digest holds only under decimal-point-shift
  normalization — every other Lite fixture's percents divide cleanly and
  pass unchanged through either implementation, which is why the corpus
  could not previously detect this (noted when RFC 0025 shipped).

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

## The language-agnostic driver (RFC 0004)

`npm run conformance:v2` → [`conformance/runner/runner.py`](../../conformance/runner/README.md)
runs the generated CLI projections against **any** implementation that speaks the CLI
protocol in protocol §II.6a. It shells out; it knows nothing about TypeScript
or `@uwmd/core`, so the reference implementation is tested exactly the way a
Python, Go, or Rust one would be. Python 3.10+, standard library only — a
driver that needs a package index is one an air-gapped implementer cannot run.

**It is not the gate, and is not meant to be.** `npm run conformance` still
runs all 1,235 indexed checks across its suites, and most of what has been added
since the corpus was four tiers is not "run a command, compare the output":
receipt re-issuance stability, composition DAG resolution, ZIP packaging,
signature key stores, invariants asserted with no baseline at all. The portable
driver checks its 397-case subset using shared comparison logic, while the
reference runner checks the full indexed corpus. A result claims only the
checks actually run. Replacing one with the other would
trade breadth for portability.

Output is TAP version 14 plus an optional JSON manifest (`--manifest-out`)
carrying the implementation's own `ImplementationManifest`, read from its
`manifest` subcommand. TAP has no standard way to attach that, and without it
two implementations' results cannot be aggregated. An implementation with no
`manifest` subcommand still runs, reported as `unidentified` rather than
assumed to be anything.

The `cases/*.case.json` files are **generated** —
`npm run gen-conformance-cases`, with `--check` in CI. A case restates what is
already on disk (which fixture, which command, which baseline), and
hand-maintaining fifty invites one to go stale silently. The known gaps are
listed in the runner README rather than hidden: two editor starter fixtures need
`applyEditAsync` and a volatile hash the synchronous CLI cannot express, the layer-profile
check has no CLI surface, and the named suites are TypeScript-only.

Comparison is **subset-by-default**: the baselines are projections, so an
implementation reporting `round_to` and `display` alongside the four fields a
calc baseline names is more informative, not wrong. Arrays stay
length-sensitive — an omitted validation issue is a disagreement, not brevity.

### Reference CLI regression checks (not conformance)

Passing the portable driver does not mean the reference `uwmd` commands
behave. Published `@uwmd/cli@4.2.0` passed 350/350, yet `uwmd verify`
printed `OK` for a wrong stated metric (launch audit D-01). `uwmd package
verify` also reported every stated semantic digest `unverifiable` (D-10).
The portable cases project the Format and Protocol through §II.6a commands.
They do not exercise what a starter tool's own commands decide or how they
exit.

Regressions of that kind are pinned in
`packages/uwmd-cli/test/cli.smoke.test.ts`. Those tests spawn the real
`bin/uwmd.mjs` and assert exit codes, text output and `--json` findings. They
run in `npm test` on every CI leg.

- **D-01:** `verify` on the `examples/verification/` pair:
  - the valid document exits 0;
  - the wrong cap rate exits 1, with `stated_metrics` counts and evidence;
  - an unverifiable metric does not fail;
  - an unrequested check is not reported.
- **D-10:** `package verify`:
  - the demo package is `verified`, exit 0;
  - a stale semantic digest is `failed` with `PKGVER-003`, exit 1;
  - a digest the CLI cannot compute is `unverifiable`, exit 0.

They are starter-tool tests. They add no case, baseline or expectation to
`conformance/`, and they change by package semver. A new normative
obligation still goes through an RFC and the corpus.

## Schema validation

`npm run validate-schemas` → [`scripts/validate-schemas.mjs`](../../scripts/validate-schemas.mjs)
validates `spec/schemas/*.schema.json` with Ajv 2020-12 (+ `ajv-formats`),
pre-registered by `$id` for cross-file `$ref`s. Keep schemas in lockstep with the
matching `protocol.ts` types (notably `ModuleManifest` ↔
`module-manifest.schema.json`).

### Receipts — issuance, verification, refusal

`conformance/receipts/` is likewise **named, not numbered**: a verification
receipt ([`spec/UW_RECEIPT.md`](../../spec/UW_RECEIPT.md), RFC 0016) is a
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
  implementations are most likely to get wrong. Every receipt names its rule
  set (`computation.rule_set`, RFC 0111); `13-rule-set-mismatch` names one its
  record does not declare and must be `failed` with `RCP-13`.
- `refuse/<scenario>/` — `deal.*` + `expected.json` naming the `ReceiptError`
  code. Issuance must throw, never emit a caveated receipt.

> **Five receipt fixtures move on every `@uwmd/verify` release.** The engine a
> receipt names is the code that computes its results, `@uwmd/verify` (RFC
> 0083), also when the receipt is issued through core. The two `issue/`
> baselines record it, so `expected-receipt.json` carries the new
> `engine_version` (`VERIFY_VERSION`; and `protocol_version`, on a protocol
> bump) — regenerate with `npm run conformance -- --suite=receipts --update` and
> check the diff is only those fields. A core release that leaves verify's
> version alone moves none of them.
>
> `verify/03-result-disagrees` (with `10-rehashed-one-cent` and
> `11-rehashed-subquantum-ratio`) is the subtle one: its receipt must be stamped
> `@uwmd/verify` at the **current** `VERIFY_VERSION`, because the scenario tests that a
> disagreement is `failed` *when the engine matches*. Leave it on the previous
> version and `RCP-07` correctly reclassifies it as `unverifiable`, the suite
> fails, and the fixture has quietly stopped testing what it was written to
> test. The other `verify/` fixtures are deliberately left on older engine
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
lives in `packages/uwmd-verify/src/modules.test.ts` instead, since a fixture file
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

### Lease-up schedule — state-and-verify trajectory (RFC 0008)

`conformance/lease-up/` (9 scenarios) pins format spec §4.25 the same way:
`case.json` payload + context scenarios exercise `verifyLeaseUpSchedule`'s
three-state verdict, and `deal.uw.md` scenarios pin the `LU-NN` structural
codes, the LU-04 warning, the tolerance-checked `CC-15` seam to `noi_model`
(base variant only), and an end-to-end `verified` verdict through
`leaseUpContext`'s §XIII denominator resolution. See
`conformance/lease-up/README.md` for the dispatch and scenario table.

- `senior-mezz-pref-verified/` — all six sizing `fn`s stated correctly →
  `verified`.
- `sizing-disagrees/` — one stated value perturbed → `failed` with
  `CS-SIZING-DISAGREES`, never a silent pass.
- `pref-cash-vs-accrued/` — two stacks identical but for the pref `accrual`;
  cash-pay pref enters `blended_coverage`, accrued does not, and
  `debt_yield_through` is identical either way (balance counts regardless of
  accrual).
- `split-coupon/` — RFC 0050's one-position preferred-equity split coupon;
  only `cash_rate` enters `blended_coverage`, while the full `rate` enters
  `weighted_cost`.
- `split-coupon-bad-total/` and `split-coupon-bad-fields/` — wrong total-rate
  sizing and malformed/non-preferred component fields remain typed refusals.
- `ab-mezz-notes/` — `mezz_a` + `mezz_b`: the ordered array expresses what
  fixed slots could not.
- `senior-reconciles-debt-structure/` — the generalized `CC-03` in both
  directions: equal senior amounts are clean, mismatched fires.
- `point-in-time-*` (RFC 0098) — `CC-03` per point: a construction-to-permanent
  record (closing construction senior, stabilization takeout, closing statement
  at 0) reconciles; a loan with no `point_in_time` counts at both points; a
  same-point role collision still owes `CC-16`; a stabilization stack never
  falls back to `sources_uses`; `CS-04` (stack point absent/unknown) and
  `DS-01` (unknown debt point).
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
which silently excluded the `starter-agent-replay` suite once it landed: a suite could be
added to the default and never gate a pull request. Adding a suite to the
default list is now enough to make CI enforce it. The Node 20 leg additionally
runs `gen-conformance-cases --check` (a fixture added without regenerating the
RFC 0004 cases would drop out of v2 coverage while everything still reported
green) and `conformance:v2`, uploading its JSON manifest as an artifact.
`release.yml` publishes
`@uwmd/core` and `uwmd` on `v*` tags. (See [11 — Build, release & governance](11-build-release-governance.md).)

## Scenario identity suite (RFC 0072)

`conformance/scenario/` pins all standard plans, owned extensions, absent/null,
unlisted/retired/malformed values and narrow BTR subtype rules. It runs in the
default suite and the v2 CLI driver. Code/severity and overall-status expectations
require zero errors; read-only, stage, coverage and unrelated-finding comparisons
ensure identity remains descriptive. See its README for the case list.

## Adding fixtures (quick reference)

First register every emitted `(suite, scenario)` once in the corpus index,
choosing its owner from the closed target vocabulary. Retain all existing
assertions; regenerate portable content ids before regenerating case files.
The following family names describe storage and baseline update selectors.


- **Documents:** drop a `.uw.md` in `fixtures/`, then `--suite=documents --update` to mint the
  expected baselines (review the diff before committing).
- **Malformed documents:** add `<id>.uw.md` + a hand-written `<id>.expected.json`
  with `expected_codes`.
- **Starter editor:** make `<scenario>/` with `before.uw.md` + `operation.json` (+
  `context.json`/`options.json`), then `--suite=starter-editor --update` to mint `after.uw.md`.
- **Calculations:** make `<scenario>/` with `deal.uw.md` + `calc.json`, then `--suite=calc
  --update`.
- **Lite:** drop a `.uw.md` in `lite/fixtures/`, then `--suite=lite --update`. Run
  `--suite=lite` *without* `--update` first — the negative and invariant checks
  (malformed, compile, round-trip, equivalence) need no baselines, so they
  validate your fixture before you freeze anything. For a negative case, add
  `<id>.uw.md` + `<id>.expected.json` under `lite/malformed/` (parse errors) or
  `lite/compile/` (bridge errors); neither needs `--update`.
- **Receipts:** make `receipts/issue/<scenario>/` with a deal document, then
  `--suite=receipts --update` to mint `expected-receipt.json`. Verify and refuse
  scenarios need no `--update`: hand-write `expected-verdict.json` /
  `expected.json`, and produce `receipt.json` with
  `uwmd receipt issue <deal> --issued-at 2026-08-09T00:00:00Z --stdout`.
- Regeneration helper: [`scripts/regen-conformance.mjs`](../../scripts/regen-conformance.mjs).

> `--update` overwrites baselines from current library output — only use it when
> you intend to change the contract, and always eyeball the resulting diff.

## RFC 0070 replacement-funding controls (Protocol 2.21.0)

The hedge suite adds 57 source/expected pairs and retains all 17 RFC 0056
pairs unchanged. Expected structural codes and separate verifier state/reason/code
projections are compared independently. Portable validate--json cases exercise
the same separation and exit behavior. Run the default suite, generated-case
freshness, portable --no-skip driver and capability-skip controls after building.

Focused unit tests additionally pin USD/null JCS known answers, real Node/Web
Crypto parity, pre-await snapshots, key-order/numeric-spelling normalization,
row absence/null distinction, unavailable crypto and qualified browser output.
A deliberately rehashed unrelated outflow verifies consistency while failing a
producer purpose assertion. Hashing supplies no economic authenticity proof.

RFC 0075 adds six `hedge/0075-*` pairs in the same shape, each one a 0070 case
with only roles, variant keys and one hedge edited. They pin the senior read
beside a junior (outright and escrow), a junior keyed `base` that must not
capture the read, a malformed senior hedge that keeps HDG-01, the junior-only
hedge that is not read, and the two-senior refusal. RFC 0076 adds eight
`hedge/0076-*` pairs for refused selections: a stated hedge on two seniors or
on components only, and one beside a refused `sources_uses`, each expecting a
single HDG-08 in place of the old silence or false ESC-04. A no-hedge control
keeps ESC-04. The v2 generator picks up all three prefixes. The RFC-numbered
cases leave the 17 RFC 0056 pairs
byte-identical; `replacement-funding.test.ts` checks this by excluding every
RFC-numbered directory.

## RFC 0064 property reserve accounts

Optional, asset-class-independent `reserve_accounts` (Format §4.28) carries closed source-attributable property custody facts. `reserve-accounts-structure.ts` checks ordinary `RSV-01`–05 structure; browser-safe `verifyReserveAccounts` in `reserve-accounts.ts` separately checks stated balances and claimed continuity using the existing 2dp half-away currency boundary. Results include the Envelope semantic source digest and ordered account/period/movement evidence; absent data is `not_checked`. CLI: `uwmd verify-reserve-accounts <file> --json`. The default and portable `conformance/reserve-accounts/` suite uses synthetic source-shaped classifications and typed refusals. Gross capex stays gross and RFC 0045 reserve refusal remains unchanged.

## RFC 0065 reserve draw bindings

`reserve-draw-bindings.ts` exports browser-safe `verifyReserveDrawBindings(parsed, plan?)`. Its optional external `ReserveDrawBindingPlan` uses exact variants, reserve account/period/movement identities, lease-up TI/LC components or gross cash-row addresses, declared selected-draw completeness and explicit funded shares. `RDB-01`–09 findings and the two companion schemas mirror Protocol §VIII.12. CLI: `uwmd verify-reserve-draws <file> [plan.json] --json`. Synthetic default/portable fixtures, shared-quantizer cent controls and regressions preserve gross rows and the unchanged RFC 0045 reserve refusal. No document field, transfer, owner cash or financing assembly is added.

### Connected financial workflow regressions

Phase 2 connects existing rent/statement/debt/funding/DCF helpers and stated
verification in `packages/uwmd-core/src/dcf.workflow.test.ts`. The authored
scenario separates vacancy from occupied-unit rent discounts rather than
copying the roll's total gap into a second deduction. Class workflow tests in
`packages/uwmd-excel/src/class-financial-workflows.test.ts` populate hotel
F&B/comp inputs and DC utility-cost branches. Their persisted-formula evaluator
is a restricted JavaScript helper, not a live Excel recalculation. These tests
and review probes are outside the normative conformance corpus.

### Financial verification boundary regressions

Capital-stack sizing and lease-up stated-figure tests exercise positive decimal
ties and negative cash flows at their existing comparison precision. The
lease-up projection tests also assert that incorrect statements cannot seed a
dated series. These regression tests use the shared Protocol VIII.5 quantizer;
no tolerance, metric definition or normative fixture is changed. They belong
to `packages/uwmd-verify/src/{capital-stack,lease-up,lease-up-cash-flows}.test.ts`.

## Independent Python foundation

`implementations/python` currently advertises parse only, with no tier or
Verifier certification. Its standard-library unit controls and genuine external
portable Reader run remain separate: 74 unit methods and 17 portable Reader
cases on the latest locally checked Windows tree. Unit tests include the nine
nonportable Reader-owned refusal fixtures and fifteen payload-level VIII.2a
period controls. The latter preserve same-day cash-flow rows under RFC 0062 and
exercise PS-01/PS-02 without claiming complete validation or portable Verifier
passes. Fifteen further expression controls check grammar/immutable ASTs and
static references: all 97 frozen calc formulas parse, and all 171 dictionary
declarations reproduce their declared input-path sets without evaluating any
formula. The frozen module parse refusal and period-path structural refusal
exercise only their grammar/reference prerequisites. The implementation's
syntax-only blocked-reference inventory flags member spellings for future safe
traversal without rejecting valid grammar or claiming a runtime verdict. Its
separate static reference check validates registered period identity without
source lookup. Role/variant resolution, expression evaluation,
PS-03 and financial verification remain separate missing work. CI retains exact-head portable
Reader manifests on three operating systems. See the
[Python README](../../implementations/python/README.md) and
[requirement inventory](../reviews/2026-10-15-python-reader-354.md).

### Independent Python reserve-account milestone

The standalone Python `verify-reserve-accounts` command implements Format §4.28
and Protocol §VIII.11 without expression evaluation or a tier claim. Its own
Envelope 1.0/JCS/SHA-256 prerequisite preserves annotations, complete payloads,
metadata, retained prose and explicit history. Independent known source digests
from receipt/signature fixtures test hashing only, with no receipt or signature
verification claim. The 91-method Python suite preserves all earlier 74 methods.

Twenty-eight unchanged reserve cases are executed by the actual shared driver's
`run_case` subprocess/comparison function as explicit case evidence. Catalogue
selection requires `calc-evaluate`, which this implementation does not claim;
these are not no-skip portable Verifier passes. The discovery manifest remains
parse-only, and portable Reader 17/17 remains separate. See the Python README
for result states, limitations and the unresolved role-opted extension-map
versus Envelope extension-block shape, which yields digest_unavailable.

### Independent Python reserve-draw bindings

The separate `verify-reserve-draws` command implements accepted §VIII.12 source
funding identity without assembling cash flows. All 46 unchanged generated
binding cases run through actual shared subprocess/comparison code as direct
case evidence; catalogue capability selection remains separate because its
`calc-evaluate` flag is broader than this implementation. The manifest stays
parse-only. The 103-method Python suite preserves the earlier 91 methods and
their 28 reserve cases, adding twelve focused exact-reference, selective reserve,
closed CF/lease-up source, monetary, precedence, overflow and snapshot controls.

Selected reserve variants are verified in full while unselected variants remain
bound only by the original complete Envelope digest. The frozen annotation-only
superseded-source digest pins a source-lifecycle prerequisite correction without
injecting metadata or changing the Reader projection. No normative baseline,
receipt convention or tier claim changes. The separate extension-variant-map
versus Envelope shape gap remains [Issue #365](https://github.com/UWMD-OSP/UW-Markdown/issues/365).


### Independent Python replacement-funding bindings

`verify-replacement-funding` implements accepted §V.12 with scoped structural
prerequisites and separate digest verification. Its nonnormative CLI wrapper
exposes `structural_issues` and the exact `replacement_funding_verification`
union, with no overall validation/readiness claim. Discovery remains parse-only;
validate/calc remain unsupported.

The 119-method suite preserves the earlier 103 methods and direct reserve28 /
reserve-draw46 evidence. Sixteen new methods perform 71 **adapted standalone
comparisons**: actual subprocesses, a documented test-only input adapter, then
unchanged shared projection/subset comparison and frozen exit expectations.
Original catalogue cases still require validate; these are not unchanged portable
case executions or full-validation passes. Extra controls distinguish consulted
role collisions, current/history and nullable identities, structural/async states,
raw sign/date semantics and snapshots during await.

Published USD/null digest answers pin the independent JCS preimage. Every ordered
cash-row member is bound, but unrelated metadata/prose/metrics and extensions
are excluded. Lawful role-opted extension peers therefore coexist with verified
replacement commitments despite separate #365. Frozen RFC0076's strike-only
control follows current RFC0081 applicability; full-term refused selections
retain HDG-08. No pricing, metric procedure, normative expectation or tier changes.


### Independent Python block-content and chain assessment

The standalone `verify-block-integrity` command implements §V.9 hashes and bounded
§V.10 checks with a nonnormative report, physical block evidence and explicit local
unsupported/unavailable assessment. It supports unambiguous singleton, registered
parallel and current role-opted identities. Historical role removal and ambiguous
append-only grouping stay unsupported; no new chain-history policy or INT code is
introduced. The explicit-input ordered-chain API leaves identity with its caller.
Root/replace behavior remains unchanged. Only post-opt-in missing hashes emit
INT-03; actual links and content comparisons emit INT-01/04 with existing severity.

The 132-method suite retains the previous 119 controls. Thirteen added methods
include 11 actual standalone frozen **hash-only** comparisons, with applicable
INT expectations projected through the unchanged shared subset comparator. Inputs
include the broken-chain negative, existing editor hash and nine signing sources;
the latter are not signature-conformance passes. All physical payloads remain
available, including finite evidence beside unsupported classification or provider
failure. Signature counts explicitly remain present/unchecked and zero verified.
No integrity profile or generic verify capability is advertised; discovery remains
parse-only and genuine Reader17/17 stays separate. See the Python README for local
count/exit semantics, supported domain and scoped API boundaries.

### Independent Python active source/role inventory

The standalone `inspect-source-roles` command inventories SRC-01/02/03 and
ROLE-01 across every active physical block, plus pinned META-01 routing. Twelve
focused methods include nine explicitly scoped actual standalone comparisons
through unchanged frozen expectations and the shared subset comparator; these
are not portable validate passes. Selected local shape diagnostics have no
invented registered code or severity. Superseded history remains retained and
outside this active-source scope. Full metadata, conditional reference and
policy verification remain separate. Discovery stays parse-only with no tier.


### Independent Python document-currency identity

The standalone `inspect-document-currency` command applies existing CUR-01 to
non-null authored declarations without trimming, case conversion, ISO allocation
lookup or display-locale inference. Absent and null declarations retain distinct
evidence and have no currency finding, following the accepted §V.12.2 clarification
and existing central currency validator. Seven focused methods include four actual
standalone fixture comparisons scoped to currency findings. They do not claim
complete frontmatter validation, rendering, portable validate or Verifier conformance.
Prior source/role, binding, integrity and Reader controls remain unchanged; discovery
stays parse-only.


### Python minimum-complete capability gates

The [current completion matrix](https://github.com/UWMD-OSP/UW-Markdown/blob/22372265039ec5748b9eff22ad623cbf2537a407/implementations/python/README.md#minimum-complete-capability-path--2026-10-16)
separates Reader proof, complete Format validation, dictionary reproduction,
all stated-figure verifiers and receipt verification from optional profiles.
The next cohesive implementation milestone is one real `validate` command with
complete result partitions, seven stage-readiness values, every registered CC
coverage entry and separate invoked V.12 verification. Its gate includes all111
unchanged portable validate cases and applicable nonportable assertions. Partial
inspectors and adapted comparisons cannot justify the flag.

The current index has1089 checks, including26Reader/688Verifier; the portable
catalogue has350 cases, including298Reader+Verifier. Those inventories are not
new Python pass counts. All171 current builtin dictionary formulas use arithmetic
and only six named `round` calls, so that work can advance independently of
RFC0088's power/return procedures. Reader key/identity/lifecycle boundaries and
metadata-family prose omission remain explicit. Preserve published missing-meta/
missing-field warnings, low-confidence info and malformed-shape META-01 error;
this ordinary implementation decision needs no owner approval. Missing `_meta`
is locally diagnosed without manufacturing META-01; the partial inventory does
not implement the full completeness family. Discovery remains
parse-only until the whole claimed capability is demonstrated.
