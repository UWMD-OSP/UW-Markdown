# 13 — Build status (living document)

Reconciled **2026-09-21** for published release **v2.13.0** (see
[Released in 2.13.0](#released-in-2130)). Core/CLI **2.13.0**, signing
**0.2.17** and batch **0.8.12** publish to npm with SLSA provenance from the
`v2.13.0` tag. Format **2.0** and Protocol **2.17.0** version independently.
See [VERSIONS.md](../../VERSIONS.md) and [ROADMAP.md](../../ROADMAP.md).

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
Excel **0.9.5**, report **0.8.17**, lake **0.2.1** and hospitality/data-center
module packages **0.1.5** remain unpublished. The registry does serve a stale
`0.3.0` of excel and report from a hand publish on 2026-08-16, pending
deprecation; see [VERSIONS.md](../../VERSIONS.md). Core's RFC 0043 binding API is published; the full Excel
exporter remains available from source. Native Excel 16.0 build 20326 passed
14 scenarios / 48 cell checks. Reverse import of additional inputs refuses.

## Verification

Release 2.13.0 passed build, **2,433 workspace tests** across
138 files (**2,032 core**), test typechecking, **589 default conformance
checks**, all three RFC 0030 profiles (161 checks passed, 67 capability skips),
**46 JSON schemas**, lint over **1,047 files**, **221 emitted codes**,
lockfile/package/version/index/release checks, the documentation build, and the
OIDC release-readiness guard. The frozen private golden corpus also passes all
eight runnable cases: 532 Artifact B assertions accounted for, 526 passing, six
documented source/baseline defects, and 20 refusal assertions. GD04 and GD07
were evidence-blocked in that frozen release corpus; see the
[review](../reviews/2026-09-21-golden-deal-release-comparison.md). The tag
workflow published core/CLI 2.13.0, signing 0.2.17 and batch 0.8.12 through
trusted publishing with provenance.

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

## Released in 2.13.0

The following work shipped from the reviewed `v2.13.0` tag. Withdrawn
experiments remain documented here because neither is part of the published
surface.

- **The SQL export surface was added and then withdrawn.** `src/sql.ts`
  exposed `exportSql`, `exportSqlStatements`, `UWSqlError` and
  `ExportSqlOptions` from `@uwmd/core` and its browser entry, plus
  `uwmd export --format sql`, emitting **PostgreSQL and Snowflake** DDL for six
  tables and four reporting views. All of it is removed; nothing consumed it
  outside its own tests.

  RFC 0049's Non-goals name "warehouse-specific SQL" explicitly, and the RFC
  gives the relational boundary to `@uwmd/lake` — `docs/DATA_LAKE.md` opens by
  saying UWMD "is the backbone of a CRE data lake, not the lake itself." The
  exporter also **collided** with the lake: both define `uw_documents` with the
  same primary key and the same three index names but different columns, and
  both default to schema `public`, so they are the same relation. Loading core's
  narrower table first makes the lake's `INSERT` fail on `format_version`;
  loading the lake's first lets core's `INSERT` write catalog rows with a null
  validation verdict.

  Withdrawn rather than re-homed: a second, BI-shaped projection is a real
  architectural choice, and there is no adopter requirement to justify deciding
  its package and schema now. If one appears, it returns through an RFC.
  `@uwmd/lake` remains the single relational boundary. JSON export is untouched.
- **RFC 0060 decided the four tranche-class candidates — none opens the enum.**
  `ground_lease`, `pace`, `tax_credit_equity` and `soft_debt` were taken up in
  one bounded RFC, as the roadmap required, and `TrancheClass` is unchanged.
  `pace` and `soft_debt` are `other_debt` **for the subset the existing fields
  express**; `tax_credit_equity` defers with its mechanics; `ground_lease` was a
  layer error — a `Tranche` has no field for tenure. No code, schema or fixture
  changed.

  The RFC closes the **enum question only** and does not claim these domains are
  modelled. Ground leases are notably *not*: §4.4 has no `ground_rent` key, §4.5
  `noi_model.expenses` has no ground-rent line and no generic bucket at all, and
  nothing types the leasehold as an object. PACE assessment servicing, soft-debt
  contingent payment and forgiveness, and tax-credit pay-in and recapture are
  equally unmodelled. Each is preserved as demand-gated mechanics, profile or
  tenure work, not tranche-class debt. `decided` is terminal.
- **Period-indexed path navigation** (§VIII.2a): a registered series resolves by
  stated period identity, `dcf.annual_cash_flows@Y3`, never by row position.
- **The Tier-3 collection surface was added and then withdrawn.** Sixteen
  builtins and numeric bracket indexing landed on this branch and have been
  removed. They were not in §VIII.3's enumerated set, the grammar change was
  the one §VIII.2a explicitly excludes, and `filter`/`map_by` returned arrays
  into a `CalcResult.value` that `calc-result.schema.json`, the normative schema
  for Part VIII, types as scalars. RFC 0019 had already
  weighed this primitive and rejected it, keeping slots static so the Excel
  emitter stays static — so the addition reopened the parity hole that design
  closed. Nothing consumed it. The calc engine therefore still has **no
  collection iteration**, by design; see the RFC 0053 and RFC 0059 notes above,
  which are unaffected.
- **RFC 0024 bisection restored.** An intermediate commit on this branch swapped
  `irr`'s bisection for a Newton-Raphson pass — the procedure §VIII.3 step 5
  forbids — and it was reverted. `irr` bisects to the normative `1e-9`/`1e-12`
  stopping conditions again. Note for future work: **conformance cannot detect
  this class of regression**, because Newton and bisection agree within the
  §VIII.5 quantum on every pinned fixture; only the property suite caught it,
  and only on a lucky seed. That suite is now seeded by default (`UWMD_FUZZ=1`
  to explore).
- **Prototype-pollution guard.** The evaluator refuses `__proto__`,
  `constructor` and `prototype` path segments with the new `CALC-FORBIDDEN-PROP`
  code, alongside the existing `MAX_NODES` bound.
- **Release readiness check.** `scripts/check-release-readiness.mjs` verifies the
  npm Trusted Publishers OIDC configuration before a `v*` tag triggers a publish.
- **Golden-deal release comparison.** A frozen private corpus accounts for 532
  Artifact B assertions: 526 pass, six remain documented source/baseline
  defects, and 20 refusal assertions pass. All eight runnable cases pass in the
  release evidence. Published 2.12.0 fails seven model-fidelity round-trips because an
  empty frontmatter array becomes a bare YAML key and reparses as `null`; the
  2.13.0 implementation preserves `[]`. See the
  [de-identified record](../reviews/2026-09-21-golden-deal-release-comparison.md).

**Invariant 4 is intact.** The parity risk here was the collection surface, and
withdrawing it removes the risk rather than deferring it: every remaining
builtin is in §VIII.3 and has a static Excel counterpart. Any future collection
primitive must arrive through an RFC that pins its Excel emission alongside its
semantics — the emitter targets Excel 2016, where an array-valued cell has no
representation, so parity is a design constraint on such a primitive, not a
follow-up task.

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
balance rather than iterating, because the calc engine has no iteration. A test
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

Current deterministic gates cover **2,032 core tests**, **589 default
conformance checks**, and **46 JSON schemas**. Protocol **2.17.0**. RFC 0061
keeps both protocol-document release labels mechanically synchronized with
`VERSIONS.md` and `PROTOCOL_VERSION`.

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
circularity is not solved, because the calc engine has no iteration. Note that
a collection primitive would not solve it either: traversing a collection is
not iterating a formula to convergence.

## Completed-corpus validation (2026-09-24)

The [current-contract evidence pass](../reviews/2026-09-24-completed-golden-corpus-validation.md)
finds completed monthly source models, so the prior all-annual blocker is stale.
Both monthly projections and 14 dated metric claims pass, but no real-deal
RFC 0045 assembly qualifies unchanged: final-period disposition timing and
reserve-funded spending hit explicit contract boundaries. Whole-document
validation also reports `PS-02` for same-day rows that the cash-flow and assembly
contracts preserve. This normative interaction needs a narrow RFC, not an
unilateral validator patch. Four private reference crosswalks and the aggregate
suite count need refresh; the historical release result is not a current-corpus
pass. No core implementation or normative changes were made.

## Accepted, unreleased same-day reconciliation (RFC 0062)

The [accepted RFC 0062](../rfcs/0062-same-day-cash-flow-selection.md) resolves
the narrow reconciliation identified above. Jared accepted it on **2026-09-24**,
retaining Protocol **2.17.1** as normative errata. The reference implementation
is prepared but has not shipped; RFC status remains `accepted`. Legal same-day cash-flow rows
no longer emit PS-02, repeated requested dates still refuse CALC-PERIOD-002,
and unique dates in the same ledger resolve. Other series and the whole-column
Excel guard remain unchanged. Schemas, public types and package versions do not
change; published core/CLI 2.13.0 still pair with Protocol 2.17.0.

## Remaining work

- Integrate RFC 0062's accepted same-day reconciliation; release remains a
  separate step. Refresh stale private crosswalks independently. The earlier
  [completed-corpus review](../reviews/2026-09-24-completed-golden-corpus-validation.md)
  remains the evidence baseline. Real-deal RFC 0045 assembly remains
  unvalidated: monthly source evidence now exists, but terminal-date and reserve
  boundaries prevent unchanged admission. Levered/tax, post-sale and
  reserve-rollforward extensions remain separate contracts; declared completeness
  is not verified economics.
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
