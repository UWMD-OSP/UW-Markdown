# 13 — Build status (living document)

Reconciled **2026-10-03** (America/Phoenix) for published and independently
verified **2.17.0**. Core/CLI **2.17.0**, signing **0.2.21** and batch **0.8.16**
are published from immutable annotated `v2.17.0` on
`98dc5e4a040cf04f7b907a76e3d83825868d1d9f`. Stable Protocol **2.21.0** pairs with
unchanged Format **2.0**. RFC 0070 is `implemented`; its frozen replacement-funding
contract and synchronous/async boundary are unchanged. This complete generation
also includes the later multifamily pack 1.0.1 deal-level cash-on-cash correction.
[Publication evidence](../releases/2.17.0-publication.md) is separate from
[preparation](../releases/2.17.0-preparation.md).

Reconciled **2026-10-02** for published and verified **2.16.0**. Core/CLI
**2.16.0**, signing **0.2.20** and batch **0.8.15** are published from the
immutable `v2.16.0` tag with verified provenance. Stable Protocol **2.20.0**
pairs with unchanged Format **2.0**. RFC 0069 is `implemented`; see
[Released student bed-count contract](#released-student-bed-count-contract-rfc-0069).
The generation includes both RFC 0066 fence-order conformance repairs and
PR #240's publication-neutral release-state guards. The preparation and
publication records are separate sections in `docs/releases/2.16.0-candidate.md`.
Draft RFCs 0064, 0065, 0067 and 0068, and accepted-but-unreleased RFC 0071,
remain outside the current released contract. RFC 0070 shipped subsequently in 2.17.0 above. The historical publication is
[2.15.0](#released-in-2150), pairing core/CLI 2.15.0 with Protocol 2.19.0.
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
Excel **0.9.9**, report **0.8.21**, lake **0.2.5** and hospitality/data-center
module packages **0.1.9** are source-only package generations. The
registry does serve a stale `0.3.0` of excel and report from a hand publish on
2026-08-16, deprecated by the owner on 2026-10-02; see [VERSIONS.md](../../VERSIONS.md). Core's
RFC 0043 binding API is published; the full Excel exporter remains available
from source. Native Excel 16.0 build 20326 passed
14 scenarios / 48 cell checks. Reverse import of additional inputs refuses.

## Verification

The 2.17.0 prepared generation passes build, **2,801 workspace tests / 144
files**, test typechecks, **734 default conformance checks**, **158/158 portable
cases with no skips**, all three capability profiles, schema/package/lockfile/
version/index/code/release-record guards, the intended `v2.17.0` tag check,
static release readiness, lint and the documentation build. Receipt updates
change only engine/Protocol identity. All accepted RFC 0070 normative/API/
conformance bytes and merged financial runtime remain unchanged. The initial
CLI worker-reporting timeout and docs-link failures are resolved; full results,
environment and limitations are in [the preparation record](../releases/2.17.0-preparation.md).
Exact-main push CI run 37169227124 succeeded before owner-authorized tagging.
Release run 37172975077 succeeded; all four versions/`latest`/`gitHead` match.
Independent registry/DSSE signatures, authenticated TUF/Fulcio/SCT trust, all
eight Rekor bundles/live records and 462 delivered file contents verify.
The registry-installed CLI passes **158/158**, with zero failures or skips;
`npm audit signatures` verifies 13 package signatures and 8 package attestations.
See [the publication evidence](../releases/2.17.0-publication.md).
The 2.16.0 evidence below remains historical publication evidence.

Release run 37075007121 succeeded on tagged commit
`a1ca815e2aee5da374caf7627ba3702849ecd257`. All four npm versions/`latest`
and registry `gitHead` values match. Registry/DSSE signatures, Fulcio chain/
identity/SCTs, authenticated TUF trust and Rekor timestamps/inclusion proofs
verify; all eight live log entries match. All 454 published file contents
equal the prepared build. The registry-installed CLI passes **101/101**
portable cases with zero skips. `npm audit signatures` verifies registry
signatures for 13 installed packages and attestations for 8 packages. Exact
public evidence is in `docs/releases/2.16.0-publication-evidence.json`.

The 2.16.0 prepared tree passes pinned Node 22.14.0/npm 11.5.1 verification:
**2,690 workspace tests / 140 files**, test typechecks, core coverage floors,
**675 default checks**, **101/101 portable cases**, all three profiles,
47 JSON schemas, 227 codes, version/package/lockfile/index checks,
ordinary and intended-tag release-state checks, static OIDC eligibility,
lint over 1,196 files and a clean docs build. Clean web-editor and VS Code
extension builds pass with 71 and 28 tests respectively.
The private golden comparison passes 640/640 and 20/20 refusals on both this
tree and the published 2.15.0 baseline; the 640 assertion ledgers are identical
and no private file changed. All nine local tarballs pass inspection, and
the four installed workflow artifacts pass consumer checks and 101/101 portable
cases. First-/last-fence resolver negative controls still fail the four
strengthened fixtures. See `docs/releases/2.16.0-candidate.md` for the exact
receipts and limits. Jared reconfirmed all four npm trusted publishers on
2026-10-02 from his personal 2026-10-01 inspection, with no settings changes
since; the inspection clock time was not recorded. The reported fields match
the canonical release workflow; this is owner-reported account evidence.

Release 2.15.0 passed its gates on the final tree, `main` at `7b33f00` plus the
documentation-only release commit `aaa9ec3`, under the pinned Node
22.14.0/npm 11.5.1 toolchain:
- build, **2,628 workspace tests** across 139 files (**2,201 core**), test
  typechecking;
- **667 default conformance checks** and the 93-case portable driver;
- all three RFC 0030 profiles, **47 JSON schemas**, lint over **1,185 files**;
- **221 emitted codes**, the lockfile/package/version/index/release checks, the
  documentation build and the OIDC release-readiness guard.

The tag workflow published core/CLI 2.15.0, signing 0.2.19 and batch 0.8.14
through trusted publishing with provenance; see the
[release record](../releases/2.15.0-candidate.md).

Release 2.14.0 passed its gates at `6ad146a` under the pinned Node
22.14.0/npm 11.5.1 toolchain: build, **2,573 workspace tests** across 138
files (**2,166 core**), test typechecking, **652 default conformance checks**,
the 78-case portable driver, all three RFC 0030 profiles, **46 JSON schemas**,
lint over **1,168 files**, **221 emitted codes**,
lockfile/package/version/index/release checks, the documentation build and the
OIDC release-readiness guard
([review](../reviews/2026-09-28-2.14.0-pre-release.md)). The release commit
`641554d` changed documentation only. The tag workflow published core/CLI
2.14.0, signing 0.2.18 and batch 0.8.13 through trusted publishing with
provenance.

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

## Released in 2.15.0

The following work shipped from the reviewed `v2.15.0` tag.

- **Calc variant resolution (RFC 0066, Protocol 2.19.0).** Ordinary calc
  identifiers over variant-map sections select one block, or refuse with
  `CALC-RESOLVE-002`; details are below.
- **Format 2.0 payload reading.** The cascade, refinement and Excel read a
  block's v2 `content` envelope through `blockPayload`, as the evaluator
  already did.
- **RFC 0062 portable coverage.** Tier-3 fixtures `period-09` … `period-12`
  carry the same-day selection rule into the RFC 0004 driver.

## Released in 2.14.0

The following work shipped from the reviewed `v2.14.0` tag.

- **Same-day cash-flow rows (RFC 0062, Protocol 2.17.1 errata).** Legal
  same-day `cash_flow_series.series` rows no longer emit PS-02. A repeated
  requested date refuses `CALC-PERIOD-002`, and a unique date in the same
  ledger resolves. Other registered series and the whole-column Excel guard
  keep their duplicate refusal.
- **Final-period exclusive boundary (RFC 0063, Protocol 2.18.0).** The optional
  closed `disposition_period_rule` plan member admits the exact exclusive end
  of the final monthly or quarterly source period with `allow_exclusive_end`.
  Absence and `within_final_period` keep the legacy rule.
- **Decimal quantization for stated-value checks.** Cash-flow, net-sale, tax,
  escrow, hedge and capex comparisons use calc reporting's half-away-from-zero
  decimal algorithm (PR #221).
- **§4.5 `noi_model` read paths.** The student-housing and self-storage pack
  formulas, the office Excel layout, the chat renderer and the `noi_model` view
  model read `gross_potential_rent` and the other §4.5 lines as the stated
  object shape (PRs #223, #228 and #229).

No formula quantum or source amount changed in the release repin. Excel ↔ calc
parity is unchanged.

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

Hospitality and data-center are now approved together as official first-party
public npm packages. Ordinary release infrastructure supports six publishing
packages for generations after 2.17.0; historical 2.17.0 publication remains four.
Neither module is published by this tooling change. Current package versions are
0.1.9 with exact core 2.17.0 pins, independent manifest contract 0.1.0 and schema
`manifest_version: "1"`. First publication awaits human npm name/bootstrap and
trusted-publisher confirmation, then the next owner-authorized ordinary release.
See [wiki 11](11-build-release-governance.md#official-first-party-module-distribution).
No Format/Protocol, loader, signature-policy or financial behavior changes.

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

The [reconciled evidence pass](../reviews/2026-09-24-completed-golden-corpus-validation.md)
records 640/640 registered comparisons, 20/20 existing refusals and a separate
stale-workbook integrity refusal. Both monthly projections and 14 dated metric
claims pass; stated-source agreement is not complete forecasting/assembly parity.
The prior four stale reference crosswalks are reconciled. RFC 0062 resolves the
same-day PS-02 interaction as described below. Legacy RFC 0045 plans still refuse
the final-period disposition boundary and reserve-funded spending. The accepted
RFC 0063 opt-in below changes only boundary admission.

The [terminal-boundary design brief](../reviews/2026-09-24-terminal-boundary-design.md)
is integrated in main at `22d993b5`. Its evidence places final monthly cash on
economic disposition at the final source period's exclusive end, not after
sale. Jared accepted [RFC 0063](../rfcs/0063-final-period-exclusive-boundary.md)
at `f04b34a` on 2026-09-24 and authorized implementation. The implementation
integrated on canonical `main` at `413a645` shipped in 2.14.0. The released
contract is Protocol **2.18.0**, with a closed `disposition_period_rule` enum
for both monthly and quarterly sources. Absence and `within_final_period`
preserve legacy behavior; `allow_exclusive_end` additionally admits only the
exact exclusive upper boundary. No new period or coverage cell, proration,
inferred timing, grace period or post-sale cash is introduced. Reserve-funded
spending still refuses. Quarterly is a calendar generalization, not direct
Golden Deal evidence. RFC 0063 shipped in 2.14.0 and is **implemented**;
Format is unchanged. See the
[implementation verification record](../reviews/2026-09-24-rfc-0063-implementation.md).

## Same-day reconciliation (RFC 0062, released in 2.14.0)

[RFC 0062](../rfcs/0062-same-day-cash-flow-selection.md) resolves
the narrow reconciliation identified above. Jared accepted it on **2026-09-24**,
retaining Protocol **2.17.1** as normative errata. The reference implementation,
integrated at `e49eb43`, shipped in core/CLI 2.14.0; RFC status is
`implemented`. Legal same-day cash-flow rows
no longer emit PS-02, repeated requested dates still refuse CALC-PERIOD-002,
and unique dates in the same ledger resolve. Other series and the whole-column
Excel guard remain unchanged. Schemas and public types did not change.

## Calc variant resolution (RFC 0066, released in 2.15.0)

[RFC 0066](../rfcs/0066-calc-identifier-variant-resolution.md) was accepted on
**2026-10-02** through owner decisions D1–D3. It shipped in core/CLI 2.15.0
with Protocol **2.19.0** and is `implemented`.

- **The defect.** Before it, four readers chose differently from one
  role-bearing `debt_structure` map. The evaluator read `null`, the cascade the
  first fence, the workbook a blank input, and one adopter's adapter the last
  fence.
- **One selection now.** All of them select through `resolveSectionBlock`: an
  explicit variant, the calculation's declared `section_roles`, then RFC 0040's
  generic order.
- **Ambiguity refuses.** It refuses as `CALC-RESOLVE-002`, while a missing
  section stays `null`.
- **Built-in packs.** Lender-side debt metrics declare `senior`.
  `cash_on_cash` declares no role and refuses on multi-tranche maps until a
  total-debt-service input is contracted.
- **Excel.** The workbook writes `#VALUE!` where the engine refuses.
- **Refinement.** It reports excluded targets in `diagnostics.section_inputs`.
- **Fixture hardening after the release.** StackUW's UPSTREAM-021 found that
  `variant-05` and `variant-11` put the block their calc context names in the
  last fence. A reader that kept the last fence therefore passed both.
  - **Change.** Both now append a third `junior` fence, so the named block is
    the middle one: a first-fence reader reads 0.6 and a last-fence reader 0.2,
    against the unchanged 0.1.
  - **Guard.** `section-resolution.test.ts` checks every context fixture
    against both fence-order readers.
  - **Scope.** Conformance evidence included in the 2.16.0 generation. The rule, expected
    results and counts are unchanged.

- **First-fence hardening after PR #240.** The successful no-context cases
  `variant-01`, `-02`, `-04` and `-10` now prepend a non-selected
  `producer-b-note` junior fence (2,000,000). The original selected block
  (6,000,000) is in the middle, before the original junior (1,000,000).
  - **Distinct rules preserved.** Unique primary, default key, unique declared
    senior and an unclaimed senior falling back to primary still decide their
    respective cases. No primary or matching-role collision is introduced.
  - **Guard and mutants.** `section-resolution.test.ts` discovers every
    successful non-null no-context variant case and pins the selection reason.
    A built resolver that validates the selection and then returns the first
    fence passed 43/43 default tier-3 checks and 42/42 portable cases before
    this change. First- and last-fence mutants now fail all four in both runners.
  - **Unchanged.** Expected 0.6, Protocol/RFC/package state, 675 default checks
    and 101 portable cases. This conformance evidence is included in the 2.16.0 generation.

## Released student bed-count contract (RFC 0069)

[RFC 0069](../rfcs/0069-student-rent-roll-bed-counts.md) was accepted on
**2026-10-02**. It declares four OPTIONAL fields on the top-level §4.3
`rent_roll`: `occupied_beds`, `preleased_beds`, `preleased_as_of` and
`preleased_term_start`. The `STUDENT_HOUSING_PACK` already read the two counts,
and its formulas do not change.

- **A stated count is a complete fact.** It must be a nonnegative integer
  (`BED-01`), within `property.total_beds` (`BED-02`), and dated:
  - `occupied_beds` on a real roll `as_of_date` (`BED-03`);
  - `preleased_beds` with both pre-leasing dates present (`BED-04`), real
    (`BED-05`) and in order (`BED-06`).

  Every `BED` code is an error.
- **Absence is not an issue.** A roll without the counts draws nothing, and
  `occupancy` and `pre_lease_rate` stay `null`.
- **Nothing is derived.** No rule compares the two counts, or a date with the
  clock.
- **Scope.** The rules read the property-level roll's payload under RFC 0040
  selection. They do not extend to `senior_housing` or to a `mixed_use`
  component. Another class that states the fields draws no issue for doing
  so, but the rules apply to what it states.
- **Not in scope.** Future-phase capacity is deferred, and `BED-02` is not
  weakened for it. CC-13's acceptance of any finite `total_beds` is a separate,
  pre-existing size-validation concern.
- **Version.** Published core/CLI **2.16.0** pair with stable Protocol
  **2.20.0** and unchanged Format **2.0**. RFC 0069 is `implemented` after
  independent post-publication verification. The tag retains its accepted
  release-prepared lifecycle wording.

## Release records true of their tag (UPSTREAM-020)

StackUW's re-vendor of `v2.15.0` found that the tagged tree calls its own
generation unreleased, and `v2.14.0` does the same:

- `VERSIONS.md` labels the packages `(candidate; …)` and the Protocol
  `(accepted, unreleased)`;
- the rows flipped only in the post-release reconciliation, after the tag.

Per the owner's 2026-10-02 decision, the fix covers future tags. Both
historical tags stay as they are, and no `v2.15.1` is cut.

A generation now passes through three states with distinct records. See
[wiki 11](11-build-release-governance.md#the-three-release-states).

1. **Candidate.**
2. **Release-prepared.** This is the commit the owner tags. Its records are
   final and publication-neutral:
   - a dated heading;
   - no candidate, unreleased or `published <previous>` wording for the
     generation;
   - exact core/CLI/protocol pairings;
   - a protocol status such as "Accepted release contract".

   It has no `### Released`, and the RFC stays `accepted`.
3. **Released and verified.** This is the post-publication reconciliation. It
   adds `### Released`, the publication statements, the run, registry,
   provenance and Rekor evidence, and the RFC's move to `implemented`.

The guards:

- `verify-release` enforces state 2's records once the heading is dated.
- It requires a tag for every `### Released`, with no exemption.
- `release.yml` re-runs it with `--tag` before publishing.
- Its tests pin the `v2.15.0` shape as failing, and the real `v2.14.0` and
  `v2.15.0` tags as unmoved.

## Remaining work

- Decide RFCs 0068 and 0067, in that order. No post-sale settlement
  category or lag is authorized. Reserve-account, financing, investor-tax and post-sale work remain
  separate contracts.
- [RFC 0071](../rfcs/0071-calendar-date-predicate.md) is **accepted**
  (2026-10-04), and its implementation is authorized. It defines an
  `is_calendar_date` §VIII.3 predicate, with a mandatory §X
  `requires_protocol` floor for modules that call it.
  - **Source implementation (PR #250, commit `493811e`):**
    - the builtin, which reuses `parseISODate` behind a string check;
    - Protocol §VIII.3, §VIII.9 and §X text, and the manifest-schema note;
    - 48 tier-3 `date-NN` fixtures;
    - unit, module-runtime, browser-parity, Excel-refusal and exhaustive
      oracle tests.

    The completed matrix is archived at
    `specs/archive/rfc-0071-calendar-date-predicate.md`.
  - **Not released.** No version label moves, and the RFC stays `accepted`.
  - **Release preparation assigns the §X floor.** It is `>=` the first
    Protocol release that contains RFC 0071. Release preparation also moves
    the reference host's Protocol label to that release. No current module
    calls the predicate, so no manifest needs a floor yet.
  - RFC 0068 is to adopt the predicate in a later revision of its own.
  - No numeric-type predicate is authorized.
- Review draft [RFC 0064](../rfcs/0064-property-reserve-account-roll-forward.md)
  against source-backed property account movement classifications. It proposes
  deterministic account-state verification, not a relaxation of RFC 0045's
  reserve refusal.
  - **Carrier selected.** On 2026-09-29 the owner selected a direct, RFC-created
    standard `reserve_accounts` §4.28 carrier
    ([owner review](../reviews/2026-09-29-rfc-0064-owner-review.md)).
  - **Still draft.** RFC 0064 is not accepted, its implementation (PR #219) is
    not authorized to merge, no version is selected, and it is outside the
    2.15.0 release.
- Contract a total-debt-service input over `capital_stack` (RFC 0026) so a
  multi-tranche `cash_on_cash` can compute. RFC 0066 leaves it refused rather
  than senior-only.
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

## 2026-10-03 — Multifamily deal-level cash-on-cash correction

The multifamily pack is 1.0.1 in source. Generic `cash_on_cash` uses total
invested equity (`sources_uses.equity_metrics.equity_total`) and the stated
year-1 DCF levered cash flow, falling back to NOI minus debt service when the
year-1 flow is absent. Missing sponsor/LP allocation does not block it; missing
aggregate equity leaves it uncomputed. The debt fallback keeps RFC 0066's
role-free refusal on ambiguous multi-tranche maps. Excel uses the same formula.

This corrects implementation drift from Format §4.19. No sponsor/LP metrics,
format/protocol/schema changes were included in that correction. The correction
is carried by the 2.17.0 generation above. Other packs'
sponsor-denominator formulas remain follow-up work. Synthetic GD05-style
coverage uses public invented inputs, never private corpus amounts.

## 2026-10-04 — Early-year day-count correction

The early-year day-count bug is corrected in source; the fix is unreleased.
- **Contract.** Protocol §VIII.9.1 already states actual-day counts on the
  proleptic Gregorian calendar. The fix moves no version, and no RFC was
  needed.
- **Root cause.** `actualDays()` in `calc/day-count.ts` counted through
  `Date.UTC`, which ECMAScript defines to read a numeric year 0–99 as
  1900–1999. The `CF-02` date-ordering check in `validator.ts` used the same
  call.
- **What it broke.** For dates in years `0000`–`0099`:
  - `actual/365f` and `actual/360` were wrong, and so were `xnpv`, `xirr`, the
    cash-flow verifier and the waterfall accrual that build on them;
  - `0000-01-01`→`0001-01-01` counted 365 days instead of 366;
  - `0099-12-31`→`0100-01-01` counted −693,959 days instead of 1;
  - correctly ordered early-year series were refused, and reversed ones were
    accepted.
- **Fix.** Both sites now use one integer `dayOrdinal`, built on the same leap
  rule and month lengths `parseISODate` validates against. Neither uses
  `Date` any more.
- **Scope of the change.**
  - Every valid date in years `0100`–`9999` gives exactly the same result as
    before.
  - `30/360us` reads date parts directly and was never affected.
  - `is_calendar_date` (RFC 0071) only checks validity and is unchanged.
- **Coverage.** Regression and independent-oracle tests, plus three
  `conformance/cash-flow` fixtures:
  - `calc-early-year-day-count`;
  - `valid-early-year-ordering`;
  - `reject-early-year-unordered`.
