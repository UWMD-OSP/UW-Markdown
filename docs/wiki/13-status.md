# 13 — Build status (living document)

Reconciled **2026-09-18** for release **v2.12.0**, plus unreleased work on
`main` (see [Unreleased on `main`](#unreleased-on-main)).
Core/CLI **2.12.0**, signing **0.2.16** and batch **0.8.11** publish to npm with
SLSA provenance from the `v2.12.0` tag. Format **2.0** and Protocol **2.17.0**
version independently. See [VERSIONS.md](../../VERSIONS.md) and
[ROADMAP.md](../../ROADMAP.md).

## Built and released

- Reader/editor/calc/agent-host foundations; Format 2.0 metadata, provenance,
  scoped edits, deterministic asset packs, class-aware readiness and validation.
- Calendar cash flows, xirr/xnpv, typed capital stacks, lease-up schedules,
  mixed-use component aggregation and LP-IRR waterfalls.
- Signed blocks/modules, capability tokens, receipts and conformance profiles;
  JSON/XML/CSV interchange, optional HTTP/MCP profiles, document composition,
  market data, portfolio relationships and batch corpus fact tables.
- RFCs 0040/0041 in 2.7.0: signed block roles and explicit period identities.
- RFCs 0042–0044 in 2.8.0: fixed stated period refinement inputs, contextual
  workbook binding APIs, validated CLI calculation context, and explicit
  lease-up cash-flow projection with semantic source evidence.

## Implemented supporting tools

Web editor/viewer, docs site and VS Code extension are implemented. Standalone
Excel **0.9.4**, report **0.8.16**, lake **0.2.0** and hospitality/data-center
module packages **0.1.4** remain unpublished. The registry does serve a stale
`0.3.0` of excel and report from a hand publish on 2026-08-16, pending
deprecation; see [VERSIONS.md](../../VERSIONS.md). Core's RFC 0043 binding API is published; the full Excel
exporter remains available from source. Native Excel 16.0 build 20326 passed
14 scenarios / 48 cell checks. Reverse import of additional inputs refuses.

## Verification

Release preparation for 2.10.0 passed build, **1,778 core tests** plus every
other workspace, test typechecking, **504 default + 76 declarative conformance
checks** and three capability profiles, **38 JSON schemas**, lint,
lockfile/package/version/index/release checks and the documentation build. The
`v2.10.0` tag published core, CLI, signing and batch through trusted publishing
(OIDC) with provenance attached. Separate tarball and registry installations verified
core/browser assembly and projection, synthetic pinned metrics, explicit zeros, CLI success/refusal,
signing exports and batch indexing. Source documents remained unchanged.

PCG64 independently matches NumPy 1.26.4's compiled implementation over
11 seeds, 11,264 raw draws and 176 doubles. See the [record](../reviews/2026-09-12-pcg64-reference.md).
No financial formula, precision boundary or calculation digest changed in the
release repin. The three receipt edits changed engine-version labels only.

## Unreleased on `main`

Work merged to `main` after the `v2.12.0` tag and **not yet in any release**.
Package versions are unchanged, so `VERSIONS.md` and the tables above still
describe 2.12.0.

- **SQL / relational export.** `packages/uwmd-core/src/sql.ts` plans `CREATE
  TABLE` + `INSERT` statements for a document's canonical facts, exposed as
  `exportSql`, `exportSqlStatements` and `UWSqlError` from both `index.ts` and
  the browser entry, and as a CLI export command. Distinct from `@uwmd/lake`:
  this emits portable SQL text from one document, where the lake plans
  digest-keyed upserts for a corpus.
- **RFC 0019 collection primitives.** The Tier-3 calc engine gained array
  indexing and collection aggregation — `filter`, `map_by`, `count_where` over
  a shared `extractCollection` helper — plus period-indexed path navigation.
  This retires the long-standing "the calc engine has no iteration" constraint
  for *traversal*; it is not a fixed-point solver.
- **RFC 0024 determinism enforced.** The Newton-Raphson parameters the RFC
  specifies are now checked rather than assumed.
- **Prototype-pollution guard.** The evaluator refuses `__proto__`,
  `constructor` and `prototype` path segments with the new `CALC-FORBIDDEN-PROP`
  code, alongside the existing `MAX_NODES` bound.
- **Release readiness check.** `scripts/check-release-readiness.mjs` verifies the
  npm Trusted Publishers OIDC configuration before a `v*` tag triggers a publish.

**Not yet verified:** invariant 4 requires exact Excel↔calc parity, and nothing
in this work touched `@uwmd/excel`. The collection primitives have **no matching
Excel emission for dynamic ranges**, so parity for a formula using them is
unproven. Treat that as a release blocker for the next core minor, not a bug in
what shipped.

## Released in 2.12.0

Two contracts and one guard, all additive.

| RFC | Surface | Family |
|---|---|---|
| 0058 | Expense recoveries and the CAM true-up on the commercial tenant record (§4.3). | `REC-NN` |
| 0059 | Distribution-waterfall clawback as a terminal true-up (§4.27, protocol §VIII.10 step 5). | `WF-10`–`WF-15` |

RFC 0058 leaves two figures **stated, not recomputed**, and the spec says why:
the capped amount, because a cumulative or compounding cap depends on base-year
history no single document carries, and the pool allocation across tenants,
because that needs a vacant-space policy and is a modeling decision. `REC-05`
anchors on the rent roll's own `as_of_date` and is skipped when absent.

RFC 0059's every basis is closed-form — the IRR floor reuses RFC 0036's hurdle
balance rather than iterating, because the calc engine had no iteration when
RFC 0059 shipped. (It has collection primitives on `main` now; see
[Unreleased on `main`](#unreleased-on-main). RFC 0059 was not revisited.) A test
pins the boundary: at a floor equal to the IRR the LP achieved, the true-up is
exactly zero.

`verify-codes` joins CI. RFC 0058 first shipped nine of its ten codes: `REC-09`
was in the RFC, the format spec and the schema, and nowhere in the validator,
and nothing went red — a missing refusal looks exactly like a document with
nothing to refuse. The guard cross-checks every code an implemented RFC or a
format-spec bullet promises against what `@uwmd/core` actually emits.

Current gate totals: **1,994 core tests**, **589 default conformance checks**,
three capability profiles, **46 JSON schemas**, **221 emitted codes**.

## Released in 2.11.0

Five contracts. All additive, every member optional, so a document stating none
of them validates exactly as it did at 2.10.0.

| RFC | Surface | Family |
|---|---|---|
| 0049 | `@uwmd/lake`, the PostgreSQL/JSONB adapter. Plans SQL; takes no database driver. | — |
| 0054 | Decision only: per-lease economics split by shape. The periodic ledger waits for a named consumer. | — |
| 0055 | Commercial lease clauses — escalation steps, break options, co-tenancy, TI/LC balances (§4.3). | `LSE-NN` |
| 0056 | Rate hedges (§4.7) and escrow cash lines (§4.8). `rate_swap` / `rate_collar` reserved and refused. | `HDG-NN`, `ESC-NN` |
| 0057 | Renovation draw and expense-targeted capex (§4.8). | `CAPX-NN` |

**RFCs 0055, 0056 and 0057 type structures nothing yet consumes.** No rent
escalates, no break is exercised, no balance amortizes, nothing is priced, no
strike crossing is projected and no stated saving is applied. Typed-but-inert is
the intended state, not an unfinished one: the format learns to *say* these
things before anything acts on them, and each consumer arrives with its own
contract.

RFC 0054's periodic-series half is likewise **unbuilt by decision**. It needs a
named consumer, and a calc-grammar answer for collections and a second period
dimension, before it is reachable from a pack formula at all.

Three of the new rules require a disclosure rather than defaulting one, because
the unstated reading is the one that misleads: `HDG-06` (what happens when the
cap expires), `CAPX-07` (whether a stated saving is already inside the NOI) and,
from 2.10.0, `TAX-08` (whether the terminal tax is inside exit NOI).

Gate totals at the cut: **1,937 core tests**, **558 default conformance
checks**, **44 JSON schemas**. Protocol **2.15.0**.

For the lake adapter, a live load **has now been run** (2026-09-16, after the
2.12.0 cut): the whole conformance corpus — 382 documents, 24,380 facts, 24,809
statements — into PostgreSQL 18, twice, for identical row counts. It found three
defects the in-memory double could not, all fixed in `@uwmd/lake` **0.2.0** /
lake schema **0.2**:

- `uw_facts.value_json` was `NOT NULL`, so the **21.6% of canonical facts that
  are containers** — an object or an array, which UWMD represents by its
  flattened children and leaves valueless — could not load at all;
- `uw_receipts.verdict` projected a field no receipt carries, because a verdict
  is what *verifying* a receipt produces, not something it states. The unit test
  missed it by inventing the field in its fixture;
- the documented DDL call could not work: a multi-command script cannot go
  through a parameterized `query(sql, params)`.

The publication decision stays open — no managed service, network or concurrent
loader has been exercised. See the
[load record](../reviews/2026-09-16-lake-live-postgres.md).

## Property cash-flow assembly released in 2.9.0

RFC 0045 adds `assemblePropertyCashFlows` and `uwmd assemble-property` under
Protocol 2.12.0. It assembles explicitly covered unlevered/pre-tax cash in one
declared currency, with real purchase anchoring, reserve assertions and source
evidence. The owner selected a synthetic test ledger; real-deal review remains
separate. See the [workflow](../PROPERTY_CASH_FLOW_WORKFLOW.md).
This API and CLI are published in 2.9.0.

## Development released in 2.10.0

The source CLI adds `verify-cash-flows` for selected stated-metric comparisons,
with explicit no-claim results, input guards and read-only behavior. This reuses
the published metric engine without changing the protocol or financial math.
Private archived-deal comparisons informed the workflow; no private ledgers or
property identifiers are included in public fixtures. Complete real-deal
assembly still needs explicit expense/reserve coverage and payment timing.

RFC 0046 is released in 2.10.0: optional
document-level `currency_code` makes display denomination explicit without
changing numeric storage, calculation, or locale separators. `CUR-01` refuses
malformed identity; per-value/multi-currency representation and FX remain
deferred.

RFC 0047 is released in 2.10.0:
`inspectPropertyCashFlowInputs` and `inspect-property-cash-flows` inventory the
source shape needed for RFC 0045 authoring without classifying rows or inferring
expense, reserve, or payment timing.

Data-center conformance is structurally complete as a reference module: six
dedicated runtime scenarios, 26 module tests, 11 calculations, seven
validations, and explicit fallback/degraded behavior. The Mesa Gateway fixture
is synthetic and the module package remains unpublished, so adopter validation
is still open. The built-in library covers nine calculation packs; mixed-use is
composition rather than a standalone pack.

RFC 0048 is released in 2.10.0: standalone
document/package examples with their own `standalone` conformance suite.
RFC 0049 is implemented in development as `@uwmd/lake` **0.2.0**
(`packages/uwmd-lake`, unpublished): a PostgreSQL/JSONB lake adapter that plans
idempotent digest-keyed upserts over six tables from canonical envelopes,
`block_values` facts, receipts, package manifests and source-evidence
references. Raw canonical JSON sits in `jsonb` beside typed shadow columns, so
unknown sections, extension keys, explicit nulls and array order survive a load.
It takes no database driver, changes no protocol or financial math, and refuses
bytes-bearing source evidence. 52 unit tests cover it against an in-memory
warehouse double, and a live PostgreSQL 18 load **has** now been run — see the
live-load subsection above for the three defects it found and what it does not
prove. The publication decision remains open.

RFC 0050 is released in 2.10.0: split preferred-equity
coupons use one tranche with `cash_rate` for coverage, `accrued_rate` excluded
from coverage, and full `rate` for weighted cost. Debt PIK toggles and accrued
compounding remain deferred.

RFC 0051 is released in 2.10.0: `hurdle_mode: "any"`
enables dual-hurdle tiers to end as soon as either `until_lp_em` or
`until_lp_irr` is met (smaller capacity), while default `hurdle_mode: "both"`
preserves existing behavior (larger capacity). `WF-01` rejects `hurdle_mode`
when both hurdles are not present.

RFC 0052 is released in 2.10.0: an optional closed `sale_deductions`
vocabulary names every cost-of-sale row at the disposition slot, and an optional
`net_sale_proceeds` figure is verified against gross sale less exit costs at the
currency quantum. `prepayment_penalty`, `defeasance` and `loan_payoff` are
reserved and refused by this unlevered assembler. A plan stating neither member
behaves exactly as it did before.

RFC 0053 is released in 2.10.0: the `noi_model`
reassessment basis and abatement schedule are typed, the `TAX-NN` validator
family is registered, and `dcf.exit_analysis.terminal_tax` names the next
buyer's tax. Everything is stated-and-verified; the exit-value/terminal-tax
circularity is not solved. It needs a fixed-point solve, which the RFC 0019
collection primitives on `main` do **not** supply — they traverse a collection,
they do not iterate a formula to convergence.

## Remaining work

- Validate RFC 0045 against a real deal. Levered/tax, post-sale and reserve-rollforward
  extensions remain separate contracts; declared completeness is not verified
  economics.
- Speculative leasing needs explicit renewal/vacancy, rent reset and TI/LC timing
  rules with an adopter example. Array iteration alone does not supply them.
- Reverse import, structural workbook edits, period defaults and cash-flow
  metric Excel export remain separate extensions.
- Waterfall extensions, per-value currency identity and stochastic VOI need
  bounded contracts. Retrieval and standalone optional-package publication remain
  demand-gated. DOCX remains scoped out by the owner.
- Exercise `@uwmd/lake` beyond a single local load. The 2026-09-16 run proves a
  real PostgreSQL 18 accepts the DDL and the corpus, but **not** network
  behaviour, concurrent writers, a managed service, or that the GIN index earns
  its keep — the planner did not choose it at corpus scale.
- RFCs 0055–0059 type structures **nothing yet consumes**. No rent
  escalates, no break is exercised, no balance amortizes, nothing is priced and
  no strike crossing is projected. Typed-but-inert is the intended state until a
  verifier is specified for each; it is not a gap to be closed by inference.
- The RFC 0054 periodic ledger is unbuilt **by decision, not oversight**. It
  needs a named consumer *and* a calc-grammar answer for collections and a
  second period dimension before it is reachable from pack formulas at all.
  See [the calc-engine limits](10-conventions-invariants.md).

Historical implementation/preparation details are [archived](13-status-history-2.8.0-preparation.md).
They do not describe current release status.
