# Roadmap

Current as of **2026-09-19**, following [release 2.12.0](https://github.com/UWMD-OSP/UW-Markdown/releases/tag/v2.12.0)
and reconciled against unreleased work on `main` (see
[Unreleased on `main`](#unreleased-on-main)).
UW Markdown has completed its foundational standard and reference-engine work.
The forward work is narrower modeling workflows, tool integration and adopter-led
extensions. This roadmap is directional; a candidate is not a release commitment.

## Current release

Core/CLI **2.12.0**, signing **0.2.16** and batch **0.8.11** are published on
npm. Format is **2.0** and Protocol is **2.17.0**. The version streams are
independent.
The [version matrix](VERSIONS.md) records exact compatibility and unpublished
packages. Release automation uses npm trusted publishing (OIDC), not NPM_TOKEN.

## Status legend

- **Released** — implemented and included in a published package release.
- **Implemented** — code and verification exist; a standalone package may remain unpublished.
- **Sprint verification** — evidence or tooling added by the current maintenance sprint.
- **Next candidate** — scoped for consideration; requires acceptance before implementation.
- **Demand-gated / deferred** — no committed implementation or release date.

## Completed capabilities

| Area | State | Scope |
|---|---|---|
| Format, reader, editor and calc host | Released | UW Lite / UWX, Format 2.0 authoring with legacy readers, byte-preserving edits, deterministic evaluation, validation and stage readiness. |
| Integrity and authorization | Released | Provenance, verification receipts, signed blocks/modules, capability tokens and conformance profiles. |
| Interchange and composition | Released | JSON/XML/CSV codecs, HTTP/MCP profiles, document packages/composites, mixed-use aggregation, market data and portfolio relationship data. |
| Financial structures | Released | Asset-class packs, typed capital stacks, calendar cash flows and xirr/xnpv, lease-up schedules, distribution waterfalls and LP IRR hurdles. |
| Signed block roles — RFC 0040 | Released in 2.7.0 | Role-aware cross-check selection, component exclusion, trusted edits and coverage evidence; introduced Protocol 2.7.0. |
| Explicit period addressing — RFC 0041 | Released in 2.7.0 | Named holding years and absolute month/quarter/date selectors on five standard series; Protocol 2.8.0. |
| Period consumers — RFCs 0042/0043 | Core APIs released in 2.8.0 | Fixed stated refinement inputs, explicit variants/overrides and contextual workbook binding APIs. Native Excel verified; standalone Excel package remains unpublished. |
| Explicit lease-up projection — RFC 0044 | Released in 2.8.0 | Complete explicit cash-date mapping of verified stated amounts, semantic source digest and binding evidence; read-only API and CLI. |
| Explicit property cash-flow assembly — RFC 0045 | Released in 2.9.0 | Read-only unlevered/pre-tax, single-currency candidate assembly with explicit coverage, acquisition/disposition and reserve assertions; synthetic engineering fixtures. |
| Supporting tools and modules | Implemented | Web editor/viewer, docs site, VS Code extension, Excel/report packages and hospitality/data-center reference modules. Publication varies; see the matrix. |

See the [RFC index](docs/rfcs/README.md) and [changelog](CHANGELOG.md) for the
individual contracts and releases. A module implementation landing in the repo
does not mean its standalone npm package is published.

## Maintenance sprint after 2.7.0

| Work | State | Evidence / completion |
|---|---|---|
| Current roadmap and status reconciliation | Merged in PR #181 | Historical launch plans archived; implemented/published/proposed states separated; RFC 0040/0041 marked implemented. |
| Independent PCG64 verification | Sprint verification complete | 11 seeds, 11,264 raw draws and 176 doubles match NumPy 1.26.4's compiled PCG64 under the upstream default stream and srandom sequence. Existing outputs are unchanged. [Evidence and reproduction](docs/reviews/2026-09-12-pcg64-reference.md). |
| Period consumers and lease-up projection | Released in 2.8.0 | RFCs 0042–0044, validated CLI context and the explicit projection workflow. [Publication and installation evidence](docs/reviews/2026-09-12-release-2.8.0.md). |

## Released in 2.10.0

Seven accepted RFCs that had accumulated on `main` shipped together, with
Protocol **2.13.0**:

| RFC | Scope |
|---|---|
| 0046 | Optional document-level currency identity (`CUR-01`) for honest display across locales. No FX, no mixed-currency arithmetic. |
| 0047 | Read-only property cash-flow input inventory, making the RFC 0045 handoff inspectable without inferring economics. |
| 0048 | Standalone document kit — lease abstracts, source notes, fragments, composition twins, a packaged example and the `standalone` suite. |
| 0050 | Preferred-equity split coupons (`CS-02b`): cash enters coverage, accrued does not, full rate drives weighted cost. |
| 0051 | Waterfall dual-hurdle `any` mode (`WF-01`): the smaller capacity governs; default `both` keeps the larger. |
| 0052 | Named exit sale deductions and a `net_sale_proceeds` verifier; levered names reserved and refused. |
| 0053 | Typed reassessment basis and abatement schedule (`TAX-NN`), naming the trailing, going-in and terminal taxes. |

The source CLI also gained `verify-cash-flows`, which checks stated cash-flow
metrics without a custom script and distinguishes no claims from verified ones.
See the [workflow](docs/PROPERTY_CASH_FLOW_WORKFLOW.md#check-stated-cash-flow-metrics-from-the-cli-unreleased).

## Released in 2.12.0

Two RFCs and one CI guard, with Protocol **2.17.0**. Both contracts are
additive: every member is optional, so a document stating none of them validates
exactly as it did at 2.11.0.

| RFC | Scope |
|---|---|
| 0058 | Expense recoveries and the CAM true-up on the commercial tenant record (§4.3), registering the `REC-NN` family. `REC-09` requires the settled amount to resolve to a §4.26 cash-flow row, so assembly and receipt coverage verify it rather than trusting it. Nothing is projected, grossed up or allocated across tenants. |
| 0059 | Distribution-waterfall clawback as the terminal true-up protocol §XVI predicted (§4.27, protocol §VIII.10 step 5), registering `WF-10`–`WF-13` and the `WF-15` warning. Every basis is closed-form — the IRR floor reuses RFC 0036's hurdle balance rather than iterating. The `cap` must be `"promote_received"`: a GP cannot owe back more promote than it received. Nothing is escrowed, crystallized per period or projected. |

RFC 0058 leaves two figures **stated, not recomputed**, and says why: a
cumulative or compounding cap depends on base-year history no single document
carries, and allocating the pool across tenants needs a vacant-space policy,
which is a modeling decision rather than a verification.

`verify-codes` joined CI in the same cut. RFC 0058 first shipped nine of its ten
codes — `REC-09` was in the RFC, the format spec and the schema, and nowhere in
the validator, and no gate went red, because a missing refusal looks exactly
like a document with nothing to refuse. The guard cross-checks every code an
implemented RFC or a format-spec bullet promises against what `@uwmd/core`
actually emits. Gate totals at the cut: **1,994 core tests**, **589 default
conformance checks**, **46 JSON schemas**, **221 emitted codes**.

## Released in 2.11.0

Five RFCs, with Protocol **2.15.0**. All additive: every member of every new
structure is optional, and a document stating none of them validates exactly as
it did at 2.10.0. RFC 0013 (embedding-based corpus retrieval) is now the one
open draft, and it is owner-gated.

| RFC | Scope |
|---|---|
| 0049 | `@uwmd/lake` (unpublished): an optional PostgreSQL/JSONB adapter preserving canonical envelopes and facts beside typed query projections, without putting a warehouse schema in the protocol or a database driver in any package. |
| 0054 | **Decision, half deliberately unbuilt.** Per-lease economics split by shape: clauses typed in place (0055), the periodic series deferred until a consumer exists and the calc grammar can reach it. |
| 0055 | Typed commercial lease clauses — escalation steps, break options, co-tenancy, LC balances beside TI (`LSE-01`–`LSE-09`). |
| 0056 | Typed rate hedges and escrows (`HDG-NN`, `ESC-NN`), including the `ESC-04` tie from a `"replace"` assumption to a funded replacement line. |
| 0057 | Renovation draw and expense-targeted capex (`CAPX-NN`), including the `CAPX-07` `in_noi_model` disclosure. |

**RFCs 0055, 0056 and 0057 type structures nothing yet consumes.** No rent
escalates, no break is exercised, no balance amortizes, nothing is priced, no
strike crossing is projected and no stated saving is applied. Typed-but-inert is
the intended state: the format learns to *say* these things before anything acts
on them, and each consumer arrives with its own contract.

For the lake adapter, a real load against a live PostgreSQL server ran on
2026-09-16 and is recorded [here](docs/reviews/2026-09-16-lake-live-postgres.md);
a managed-service run and the publication decision are still open. See the
[adoption notes](docs/roadmap/2026-09-13-standalone-documents-and-lake.md) and
the [data-lake guide](docs/DATA_LAKE.md).

## Unreleased on `main`

Merged after the `v2.12.0` tag and **not in any published release**. Package
versions are unchanged, so the version matrix above still describes 2.12.0. The
living detail is in the developer wiki's build-status page
(`docs/wiki/13-status.md`); this section records only what changes a roadmap or
status claim.

| Change | Effect on this roadmap |
|---|---|
| **Period-indexed path navigation** (§VIII.2a) | Additive. A registered series resolves by stated period identity (`dcf.annual_cash_flows@Y3`), never row position. No roadmap item opens or closes. |
| **RFC 0024 bisection restored** | A regression had replaced `irr`'s bisection with the Newton pass §VIII.3 step 5 forbids, giving up the cross-engine bit-identical root the RFC exists to guarantee. Reverted. No roadmap item changes; determinism claims elsewhere in this file remain true. |
| **Tier-3 collection surface: added, then withdrawn** | Sixteen builtins and numeric bracket indexing landed and were removed. They were outside §VIII.3's enumerated set and §VIII.1's grammar, and RFC 0019 had already rejected the primitive. **The calc engine still has no collection iteration**, so every roadmap statement resting on that constraint — RFC 0054's deferral above, and the speculative-leasing note below — stands unchanged. |
| **SQL export surface: added, then withdrawn** | An unreleased `exportSql` in `@uwmd/core` emitted PostgreSQL and Snowflake DDL and a second `uw_documents` table that collided with `@uwmd/lake`'s. RFC 0049 names warehouse-specific SQL a non-goal and gives `@uwmd/lake` the relational boundary, so it was withdrawn rather than re-homed. **This is not planned work.** A second BI-oriented projection would need an adopter requirement and its own RFC; none exists. |
| **`@uwmd/lake` 0.2.0, lake schema 0.2** | The live-PostgreSQL fixes below. Still unpublished. |
| **Release readiness check** | `npm run release:check` verifies npm Trusted Publishers OIDC before a `v*` tag triggers a publish. Tooling only. |

Nothing here adds a protocol capability, and no forward candidate below moved.

## StackUW protocol alignment queue

**Source:** owner-supplied *StackUW protocol brief* from the engine team,
2026-09-13. StackUW (formerly underwriter.cc) is the current vendor building
on UW Markdown and produces `.uwx.md` records through `export_uwmd`.

This is adopter input, not an accepted contract or an instruction to change the
spec immediately. Each normative item below still needs its own accepted RFC,
an absent-case fixture, and an engine-produced fixture. The queue preserves the
project's existing rules: additive and opt-in fields, stated figures verified
where practical, explicit "stated, not recomputed" notes where not, custom
asset classes as namespaced modules, and fund mechanics as document profiles.

### Reuse before extending

The brief explicitly asks us not to duplicate capabilities already present:
catch-up and LP IRR hurdles are in §4.27; the capital-stack and preferred-equity
surfaces are in §4.24 (with split coupon in RFC 0050); dated cash flows are
in §4.26; student housing, senior housing, land, mixed-use, portfolios and data
centers already have class/profile or module homes. The remaining work is to
type the documented stubs, add missing verification paths, or make the existing
surfaces usable for the next producer wave.

### Proposed sequence

| Wave | Candidate | State / acceptance gate |
|---|---|---|
| 1 | Preferred-equity split coupon | **RFC 0050, implemented.** Split coupons with cash/accrued decomposition and `CS-02b` validation; cash enters coverage, accrued does not. |
| 1 | Waterfall dual-hurdle `any` mode | **RFC 0051, implemented.** Lifted `hurdle_mode: "any" | "both"` into normative contract with closed-form capacity, `WF-01` validation, and conformance fixtures. |
| 1 | Named exit sale deductions | **RFC 0052, implemented.** Closed `sale_deductions` vocabulary with a label-bearing `other`, reserved-and-refused levered names, complete-naming rule, and a `net_sale_proceeds` verifier at the currency quantum. Each deduction remains its own dated §4.26 row. |
| 1 | Tax abatements and reassessment basis | **RFC 0053, implemented.** Types the reassessment basis (`TAX-01`–`TAX-04`), adds an RFC 0041-addressed abatement schedule (`TAX-05`–`TAX-07`), and names the trailing, going-in and terminal taxes with a `TAX-08` tie to exit value. Stated-and-verified only: the exit-value circularity stays the author's to converge. |
| 1/2 | Lease clauses and TI/LC amortization | **RFC 0055, implemented.** Break options, co-tenancy triggers/remedies and escalation steps are typed on the commercial tenant record, with LC balances beside TI (`LSE-01`–`LSE-09`). Straight-line amortization stays deferred: RFC 0054 placed it with the periodic series. |
| 2 | Per-lease monthly ledger | **RFC 0054, `decided` (terminal); the series half is deliberately unbuilt.** Splits by shape: type the lease clauses in place on the commercial rent roll (the stubs already exist), and defer the periodic series until a consumer exists. The calc grammar addresses neither collections nor two period dimensions, so a ledger is unreachable from pack formulas. |
| 2 | Rate caps, escrow and replacement | **RFC 0056, implemented.** Types `debt_structure.rate_hedge` (strike, notional, term, premium and a required `post_expiration_assumption`) and `sources_uses.uses.escrows` under a closed vocabulary with a label-bearing `other` (`HDG-01`–`HDG-06`, `ESC-01`–`ESC-04`). `ESC-04` ties a `"replace"` assumption to a funded `rate_cap_replacement` line. `rate_swap` and `rate_collar` are reserved and refused pending an MTM contract; nothing is priced. |
| 2 | Construction contingency used share | **RFC 0057, implemented.** `uses.renovation` carries budget, contingency, used, a verified remaining and total drawn as of a stated date (`CAPX-01`–`CAPX-05`). Milestone releases and draw projection stay out of scope. |
| 2 | Nearest asset-class extensions | **Demand-gated by a concrete deal.** Student by-bed rent roll; manufactured-housing module; and a decision between a parcel array and RFC 0021 composition for SFR/BTR scattered-site deals. |
| 2 | CAM, redevelopment and OpEx compression | **Resolved. RFC 0057 shipped expense-targeted capex; RFC 0058 shipped the CAM true-up in 2.12.0.** Expense-targeted capex is implemented (`CAPX-06`–`CAPX-08`), with `in_noi_model` required so a stated saving cannot be double-counted; nothing applies the saving. Redevelopment downtime needs **no new field**: §4.25 `natural_turnover` already expresses suppressed occupancy carrying its own `ti_lc_capex`. On CAM, RFC 0058 disputes the earlier "it is periodic, so RFC 0054 defers it" reading: it proposes an **annual reconciliation of a closed period**, which needs neither collection iteration nor a second period dimension — the two things RFC 0054 actually found unreachable. Settled amounts land in §4.26. That distinction was the RFC's load-bearing claim, and it was accepted: RFC 0058 shipped in 2.12.0 with the `REC-NN` family and its own conformance suite. |
| 2 | Ground lease / leasehold tenure | **Not a tranche class ([RFC 0060](docs/rfcs/0060-tranche-class-candidates.md)); the tenure contract remains demand-gated.** The earlier "reserve `ground_lease` as a tranche concept" framing conflated the leasehold estate and its ground-rent obligation with financing merely secured by a leasehold, which is already `senior_debt`. A `Tranche` has no field for tenure, and no honest `amount` exists for one. **The format does not model ground leases today:** §4.4 has no `ground_rent` key (only the generic `other_expenses`), §4.5 `noi_model.expenses` has no ground-rent line *and no generic bucket at all*, and no section types the leasehold as an object — term, resets, extension options, fee relationship and subordination are all untyped. Where the underwriting does include ground rent in OpEx, adding it again as a debt tranche would double-count it. The open work is a property/tenure contract against its own section, gated on a demonstrated consumer. |
| 3 | Operating-business modules and executions | **Demand-gated.** Senior-housing refinements, cold storage, life science, marina/outdoor storage, affordable housing, parking, phased delivery, condo sell-off, adaptive reuse, swaps and collars each require a concrete engine scope and module/RFC pair. **PACE-specific mechanics** stay on this demand-gated list: RFC 0060 closed the *enum* question — it is stated as `other_debt` where the existing fields suffice — but assessment servicing above or below NOI, jurisdictional lien behaviour and transferability are unmodelled and would need their own contract. |
| 4 | Fund and land-development profiles | **Later / profile boundary first.** Subscription facilities, clawback/lookback, co-invest fees and lot takedowns belong in fund or land-development profiles that reference deal documents; they do not widen ordinary deal sections. |

### Cross-cutting requirements

- Extend the RFC 0027 size-intensive registry once per demonstrated need (`$/bed`,
  `$/pad`, `$/acre`, `$/slip`, `$/space`); do not create class-specific aliases
  outside the registry.
- **Tranche-enum question settled by [RFC 0060](docs/rfcs/0060-tranche-class-candidates.md) (`decided`); do not reopen it.**
  The four candidates were taken up in one bounded RFC, as this requirement
  asked, and **none opened the enum**. `TrancheClass` is unchanged. `pace` and
  `soft_debt` are stated as `other_debt` **for the subset the existing fields
  express**; `tax_credit_equity` defers with its mechanics
  (`sources_uses.sources.tax_credit_equity` already records the amount);
  `ground_lease` was a layer error. RFC 0060 closed the **enum-opening question
  only** — it did not declare these domains modelled. The genuine needs survive
  as demand-gated mechanics, profile and tenure work, each requiring its own RFC
  and a demonstrated consumer: the ground-lease/leasehold tenure contract (row
  above), PACE-specific mechanics (row above), soft-debt contingent and
  forgiveness mechanics, and a tax-credit-equity profile.
- Treat §4.26 as the addressable sink for new dated cash lines so assembly and
  receipt coverage can verify them instead of trusting engine output.
- Require one engine-produced conformance fixture per accepted RFC, plus one
  fixture proving that an absent optional field remains byte-identical and
  verifies as before.

## Forward backlog

The bounded period-consumer and lease-up projection stages are complete. The
next modeling work needs explicit economic inputs and a concrete adopter case;
no additional financial assumptions are supplied by the released adapter.

| Priority | Work | State | Definition of done / prerequisite |
|---|---|---|---|
| 1 | Real-deal DCF validation and extensions | RFC 0045 released; input inventory implemented; adopter review pending | Use the [input inventory](docs/PROPERTY_CASH_FLOW_WORKFLOW.md#prepare-a-real-deal-plan-without-inventing-inputs), then validate explicit coverage and economic assertions against a real deal. [Synthetic workflow](docs/PROPERTY_CASH_FLOW_WORKFLOW.md) and [release evidence](docs/reviews/2026-09-12-release-2.9.0.md). Levered/tax, reserve-rollforward and post-sale economics require separate contracts. |
| 2 | Speculative leasing module | Proposal | Pin renewal probability, vacancy, market-rent resets, TI/LC cash timing and amortization against a concrete adopter example. Add deterministic fixtures before implementing rollover math. |
| 3 | Additional period consumers | Deferred extensions | Reverse import, structural workbook edits, period defaults and custom function/cash-flow metric export need separate contracts and parity evidence. |
| 4 | Waterfall extensions | RFC 0051 implemented; **RFC 0059 released in 2.12.0** | Combined-hurdle "any" mode implemented under RFC 0051. RFC 0059 takes up clawback as the terminal true-up protocol §XVI predicted, closed-form via the RFC 0036 hurdle balance so no iteration is introduced. GP-side hurdles (`until_gp_irr`) remain deliberately out. |
| 5 | Currency-code disambiguation | RFC 0046 released in 2.10.0 | Document-level identity is explicit and display-safe. Per-value identity, FX, and mixed-currency arithmetic remain deferred. |

### Adoption and integration candidates

| Work | State | Next evidence |
|---|---|---|
| Standalone document and package example kit | RFC 0048 implemented (2.10.0) | Adopter authoring against the kit. |
| PostgreSQL JSONB lake adapter | RFC 0049 released in 2.11.0; **live load run 2026-09-16** (`@uwmd/lake` 0.2.0, unpublished) | The corpus load against PostgreSQL 18 is done and found three defects, all fixed — see the [load record](docs/reviews/2026-09-16-lake-live-postgres.md). Remaining: a run against a managed service with roles and concurrency, and the publication decision. |
| Additional niche asset classes | Demand-gated | Bring a concrete deal/operator workflow before adding another class or module. |

### Mixed-use and speculative leasing

[RFC 0019](docs/rfcs/0019-mixed-use-composition.md) implements multi-component
container aggregation. [RFC 0008](docs/rfcs/0008-lease-up-modeling.md) implements
stated lease-up schedules. [RFC 0041](docs/rfcs/0041-period-indexed-addressing.md)
selects periods in existing series. None alone implements speculative lease
rollover or establishes Argus parity. Array iteration is not the remaining
product specification; lease economics and cash timing are.

### Demand-gated work

- **Semantic corpus retrieval (RFC 0013):** remains draft until an adopter needs
  find-similar-deals or risk-pattern recall. Portfolio analytics already use the
  corpus fact table and SQL; an embedding pipeline is not required for that.
- **Investor profiles and portfolio/relationship agent layers:** the data
  surfaces exist, but reference consumers need concrete adoption requirements.
- **Standalone Excel/report/module publication:** implemented packages remain
  unpublished until a consumer and supported distribution scope are chosen.
- **DOCX output:** scoped out by the owner; reconsider on an actual adopter ask.
- **Native bps units:** deferred until a pack demonstrates the required unit
  and precision contract. This is not an unresolved Excel ROUND-parity defect.
- **Relative periods, module-defined period series and stochastic VOI:** require
  separate contracts; they are not implied by the released first implementations.

## History and maintenance

The [historical roadmap](docs/roadmap/history-through-2.7.0.md) preserves the v1
launch, interchange train and v2 exploration narrative. Those milestones are
closed history, not remaining npm setup or launch tasks.

For each future item, record its user need, acceptance state, implementation
scope, proof of completion and publication state. Update the RFC frontmatter
and index together after a release; keep detailed implementation notes in the
developer wiki and dated reviews. New normative behavior requires an RFC under
[governance](GOVERNANCE.md); editorial status corrections do not change contracts.
