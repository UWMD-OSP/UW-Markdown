---
rfc: 0068
title: Manufactured-housing module — a community leased by the site, with park-owned homes as a second income line
status: draft
author: claude-code (agent proposal)
created: 2026-09-29
depends_on:
  - 0003
  - 0039
affects:
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0068: Manufactured-housing module — a community leased by the site, with park-owned homes as a second income line

**Draft agent proposal.** A coding agent wrote this RFC. StackUW's
manufactured-housing plan is adopter requirements evidence, not UWMD
authority, and it is not verifiable in this repository. No owner decision
selects any semantics here, and implementation is not authorized. Open
decisions are listed in [Decision status](#decision-status).

## Summary

A manufactured-housing community (MHC) earns most of its income from pad rent:
it leases a site to a resident who owns the home. Some sites also carry a
park-owned home (POH), which earns home rent on top of the pad. No builtin class
states either fact.

This draft proposes `@uwmd/module-manufactured-housing`, following RFC 0039's
data-centre pattern. The module declares the custom class
`org.uwmd.manufactured_housing` (fallback `multifamily`) and one required
section, `mhc_sites`.

The pad rent is carried as **one stated scalar**, `weighted_pad_rent_monthly`,
with an exact meaning. Every module calculation reads it, or other stated
scalars, using ordinary existing calc grammar. The earlier draft's per-site-type
rent schedule, `site_types[]`, is **deferred**. Its only calculation was a sum
over an array, which the evaluator cannot express. Keeping it beside the scalar
would create two competing truths that no module rule can reconcile.

No Format or Protocol change is proposed, and no version moves.

## What exists today (re-verified on `main` at `51afadc`)

- **No MHC vocabulary.** The builtin classes are closed for protocol 1.x
  (§2.2). None states sites, pad rent or a park-owned home.
- **The module path.** A module-declared class (RFC 0003, Protocol §X.2) is the
  designed path. RFC 0039 shipped one (`@uwmd/module-data-center`) with no spec
  change, and confirmed that module formulas may read standard sections as well
  as the module's own (RFC 0039 implementation note 1).
- **What a custom class does not get (Protocol §X.2.4).** It has no builtin calc
  pack, no Excel layout and no §XIII size row. "A module supplies its own
  calculations for the classes it declares; anything the module does not
  supply, a custom class does not have." `getAssetClassDefaults` returns `null`
  for a custom class, so a module publishes no defaults. `CC-13` is
  `not_applicable` for a custom class.
- **Module runtime (`module-runtime.ts`):**
  - calculations run in declaration order, each seeing earlier results as
    `prior_results`;
  - a validation `rule` is a safe expression in the §VIII.1 grammar;
  - a rule fires on `false` and is silent on `null`;
  - a calculation that fails to evaluate is reported as `MOD-CALC-ERROR`, an
    error;
  - a section's `schema` is shape-checked when the manifest loads, but
    documents are **not** validated against it at runtime. A typed constraint
    on a document value must be written as a rule.
- **No collection iteration.** `sum(...nums)` and `avg(...nums)` are variadic
  over explicit arguments; given an array, `sum` refuses with `CALC-TYPE-001`. A
  numeric index such as `site_types[0]` does not parse (`CALC-PARSE-001`), and
  the protocol permits iteration only inside the named solvers. There is no
  grammar for a product over array rows or a sum over rows.
- **Adopter evidence (unverified here).** StackUW's planning record, dated
  2026-09-29 (its `Q-974` and an internal plans document), treats the site as
  the underwriting unit, with POH home rent as a second stream. Its
  upstream-first preference is not a UWMD owner decision.

## Why the earlier calculation was unreachable

The earlier draft's first calculation was
Σ(`site_types[].count` × `pad_rent_monthly`) / `total_sites`. That needs
element-wise products and a sum over a variable-length array. The evaluator has
neither, and this RFC does not add either: no collection iteration, no
aggregation primitive, no second engine.

Two later calculations (`annual_pad_revenue_potential` and `poh_rent_share`)
depended on it, so three advertised metrics could not be computed.

A counts-only `site_types[]` has the same problem. A rule cannot check that its
counts sum to `total_sites`, so it could silently contradict the site total.

## Proposed first scope

Everything in this section is a proposal. None of it is accepted.

### Manifest

| Field | Value | Why |
|---|---|---|
| `manifest_version` | `'1'` | |
| `id` | `org.uwmd.manufactured_housing_module` | the org's namespace, as RFC 0039 |
| `requires_protocol` | `>=2.5.0` | the data-centre floor; the module uses no later feature |
| `requires_format` | `>=1.1` | |
| `requires_tier` | `tier-3-calc-host` | the contribution is calculation |
| `declares_asset_classes[0].id` | `org.uwmd.manufactured_housing` | the last segment is not a builtin name (§2.2a) |
| `.display_name` | `Manufactured Housing Community` | |
| `.fallback` | `multifamily` | see [Fallback](#fallback) |
| `.required_sections` | `['mhc_sites']` | |
| `.optional_sections` | none | the earlier `mhc_utilities` and `mhc_homes` are deferred |

### Section `mhc_sites` (required)

| Field | Type and unit | Meaning |
|---|---|---|
| `total_sites` | integer ≥ 1 | Every manufactured-home site in the community, occupied or vacant. The module's size denominator, since a custom class has no §XIII row. `property` gains no field. |
| `occupied_sites` | integer, `0 ≤ n ≤ total_sites` | Sites with a home in place under an in-place lease as of `as_of_date`. |
| `park_owned_homes` | integer, `0 ≤ n ≤ total_sites` | Homes the community owns on its own sites. `0` when it owns none. |
| `weighted_pad_rent_monthly` | currency per site per month, ≥ 0 | **The authoritative pad-rent figure**, defined below. |
| `poh_home_rent_monthly` | currency per park-owned home per month, ≥ 0, or `null` | The average monthly **home** rent per park-owned home, across all `park_owned_homes`: occupied homes at in-place home rent, vacant homes at asking home rent. It **excludes** the pad rent for that home's site, which `weighted_pad_rent_monthly` already counts. `null` when `park_owned_homes` is `0` or the source states none. |
| `age_restricted` | boolean or `null` | Disclosure only (an age-restricted community). No calculation reads it. |
| `as_of_date` | `YYYY-MM-DD` | The date the counts and rents describe. |

**`weighted_pad_rent_monthly`** is the site-count-weighted average monthly pad
(lot) rent across all `total_sites`. Occupied sites count at their in-place
contract pad rent, and vacant sites at the source's current asking pad rent.

- **Included:** pad rent only.
- **Excluded:** park-owned-home rent, utility reimbursements, fees, and RV or
  transient income.
- **Source:** the figure from the source (a rent roll, a T-12, or the
  underwriter's stated assumption), carried as stated with the section's
  `_meta` provenance.
- **Not derived:** core never derives it from a site-type schedule. No module
  claims to have computed it.
- **Currency:** the document's currency (RFC 0046).

### Calculations

Every formula is in the existing §VIII.1 grammar. The order is load-bearing: a
row reads only stated fields and the rows above it.

| id | Formula | Unit | round_to |
|---|---|---|---|
| `physical_occupancy` | `mhc_sites.occupied_sites / mhc_sites.total_sites` | `%` | 4 |
| `annual_pad_rent_potential` | `mhc_sites.weighted_pad_rent_monthly * mhc_sites.total_sites * 12` | `$` | 2 |
| `poh_share` | `mhc_sites.park_owned_homes / mhc_sites.total_sites` | `%` | 4 |
| `annual_poh_home_rent_potential` | `mhc_sites.poh_home_rent_monthly * mhc_sites.park_owned_homes * 12` | `$` | 2 |
| `poh_rent_share` | `annual_poh_home_rent_potential / (annual_pad_rent_potential + annual_poh_home_rent_potential)` | `%` | 4 |
| `price_per_site` | `valuation.purchase_price / mhc_sites.total_sites` | `$` | 2 |
| `noi_per_site` | `noi_model.net_operating_income / mhc_sites.total_sites` | `$` | 2 |
| `loan_per_site` | `debt_structure.loan_amount / mhc_sites.total_sites` | `$` | 2 |
| `expense_ratio` | `noi_model.expenses.total_operating_expenses / noi_model.income.effective_gross_income` | `%` | unit default |
| `ltv` | `debt_structure.loan_amount / valuation.purchase_price` | `%` | unit default |
| `ltc` | `debt_structure.loan_amount / sources_uses.uses.total` | `%` | unit default |
| `dscr` | `noi_model.net_operating_income / debt_structure.annual_debt_service` | `x` | unit default |
| `debt_yield` | `noi_model.net_operating_income / debt_structure.loan_amount` | `%` | unit default |

The last five rows reuse, string for string, the formula and unit that the
builtin office and student-housing packs declare. Per §X.2.4, a custom class has
these metrics only if its module declares them.

### Calculation audit

| Metric | How it is reached | Null and zero behaviour |
|---|---|---|
| Pad rent per site per month | The stated input `weighted_pad_rent_monthly`; no calculation | Absent: the pad metrics below are `null`. |
| Annual pad-rent potential | `weighted_pad_rent_monthly × total_sites × 12` | `null` when either input is absent. |
| Park-owned-home revenue | `poh_home_rent_monthly × park_owned_homes × 12` | `null` when no home rent is stated. No division, so `park_owned_homes: 0` cannot raise `CALC-DIV-ZERO`. |
| POH share of sites | `park_owned_homes / total_sites` | `total_sites ≥ 1` is enforced by rule `CC-MOD-MH-01`. A stated `0` also makes every per-site division `CALC-DIV-ZERO`. |
| POH share of rent | home potential ÷ (pad potential + home potential) | `null` when home rent is unstated. Both potentials zero is `CALC-DIV-ZERO`, reported as `MOD-CALC-ERROR` on a degenerate document. |
| Price, NOI and loan per site | standard-section figure ÷ `total_sites` | `null` when the standard figure is absent. |
| Expense ratio | as the builtin packs | Zero EGI is `CALC-DIV-ZERO`. |
| DSCR, debt yield, LTV, LTC | as the builtin packs | `null` when the debt or valuation figures are absent. A **stated zero** `loan_amount` or `annual_debt_service` is `CALC-DIV-ZERO`, which the module runtime reports as `MOD-CALC-ERROR`. An all-cash document omits the debt fields rather than stating zeros. |

No row is unresolved. AI performs none of this arithmetic; the evaluator does.

### Validations (`CC-MOD-MH-NN`)

Each rule asserts what must be true. It fires on `false` and is silent on
`null`, so an absent field emits nothing. Every rule is an `error`: each refuses
a stated value that breaks the section's typed contract. There are no
market or advisory thresholds.

| Code | Rule | Message |
|---|---|---|
| `CC-MOD-MH-01` | `mhc_sites == null \|\| (mhc_sites.total_sites != null && mhc_sites.total_sites >= 1 && round(mhc_sites.total_sites, 0) == mhc_sites.total_sites)` | `total_sites` must be stated as a whole number of at least 1 |
| `CC-MOD-MH-02` | `mhc_sites.occupied_sites >= 0 && round(mhc_sites.occupied_sites, 0) == mhc_sites.occupied_sites && mhc_sites.occupied_sites <= mhc_sites.total_sites` | occupied sites must be a whole number within `total_sites` |
| `CC-MOD-MH-03` | `mhc_sites.park_owned_homes >= 0 && round(mhc_sites.park_owned_homes, 0) == mhc_sites.park_owned_homes && mhc_sites.park_owned_homes <= mhc_sites.total_sites` | park-owned homes must be a whole number within `total_sites` |
| `CC-MOD-MH-04` | `mhc_sites.weighted_pad_rent_monthly >= 0` | pad rent must be nonnegative |
| `CC-MOD-MH-05` | `mhc_sites.poh_home_rent_monthly == null \|\| (mhc_sites.poh_home_rent_monthly >= 0 && mhc_sites.park_owned_homes > 0)` | home rent must be nonnegative, and stated only when the community owns homes |

`CC-MOD-MH-01` is the one presence rule. `MOD-SECTION-MISSING` checks only that
the section exists, and `total_sites` is the denominator of every per-site
metric. Its leading `mhc_sites == null` keeps it silent when the whole section
is missing, so that case reports `MOD-SECTION-MISSING` alone.

While drafting, the calculation and rule tables above were run unchanged through
`evaluateModuleCalculations` and `validateAgainstModules` on the current core
build, using synthetic documents in a scratch harness that is not committed.
The cases were: with park-owned homes, without them, all-cash, each rule
violated, `total_sites` missing, and the section missing.

- The manifest loads.
- Absent operands make a rule `null` (silent), and each violation makes exactly
  its rule `false`.
- A stated `total_sites: 0` reports `CC-MOD-MH-01` together with a
  `MOD-CALC-ERROR` for each per-site calculation.

### What core does not do

- It does not derive pad rent from site types.
- It does not iterate over collections.
- It does not apply market thresholds, publish class defaults, or assume a
  value the document does not state.
- It does not model RV or transient sites.
- It does not reconcile the module's rent potentials with
  `noi_model.income.gross_potential_rent`. No rule ties them, because whether
  POH home rent sits in GPR or other income is a modelling choice with no
  evidence in the repository.

## Fallback

`multifamily` remains the honest degraded reading. Under Protocol §X.2.2, a host
without the module MAY render the document using the fallback's **view models**,
MUST report the read as degraded and emit `MOD-FALLBACK-001`, and MUST NOT
present it as a full read.

- **What survives.** The standard sections (`property`, `ownership`,
  `noi_model`, `valuation`, `debt_structure`, `sources_uses`, `dcf`) render
  under residential income-property view models. That is what an MHC's standard
  sections are: income property leased to residents. The stated NOI, price,
  debt and returns read correctly.
- **What is lost:**
  - every module calculation, including the per-site figures and the debt
    metrics, since §X.2.4 gives a custom class no builtin pack;
  - the module's validations;
  - any labelled presentation of `mhc_sites`, which renders as a generic block.
- **The `total_units` hazard.** A host that also ran the multifamily *pack*
  (outside what §X.2.2 grants) would divide per-unit metrics by
  `property.total_units`. The example therefore leaves `property.total_units`
  unstated, so no mislabelled per-unit figure appears. This follows RFC 0039,
  whose example set square footage so the fallback number was "not wrong, only
  unhelpful".

## Deferred

- **The per-site-type rent schedule (`site_types[]`)**, including a counts-only
  inventory. No rule can reconcile it to `total_sites` or to
  `weighted_pad_rent_monthly` without collection iteration. It returns only if a
  separate RFC gives the protocol a deterministic way to reconcile it.
- **`mhc_utilities`.** No calculation reads it. Its `annual_cost` and
  `recovery_rate` would duplicate `noi_model.expenses.utilities` and
  other-income figures, which are two truths.
- **POH operating detail** (`poh_occupancy`, `turnover_rate`,
  `turn_cost_per_home`, `reserve_per_home_annual`). No calculation reads it, and
  the reserve would compete with `noi_model.expenses.replacement_reserves`. The
  earlier `homes_count` duplicated `park_owned_homes`, so it is removed along
  with the rule (`MH-03`) that existed only to reconcile the duplicate.
- **RV and transient sites:** no demonstrated consumer.
- **Advisory thresholds** (low occupancy, high POH share): market judgements
  with no evidence.
- **Module-published class defaults:** the protocol has no mechanism.

## Compatibility analysis

- **Additive only.** No Format or Protocol text changes and no version moves,
  following RFC 0039.
- **Documents that don't load the module.** A document that does not list the
  module in `modules:` is unaffected. A host without the module reads an MHC
  document as degraded `multifamily` (see [Fallback](#fallback)).
- **No builtin changes.** No builtin calc pack, Excel layout or size-registry
  row changes.

## Conformance impact (proposed)

A runtime suite under `conformance/modules/runtime/`, numbered after the
data-centre scenarios at implementation. It would hold the example document
plus fixtures for:

- **Calculations:**
  - no park-owned homes (POH metrics `null`, no error);
  - with park-owned homes (all metrics pinned);
  - an all-cash document with debt fields omitted (debt metrics `null`, no
    issue).
- **Rules:** each of `CC-MOD-MH-01` to `CC-MOD-MH-05` firing, plus a document
  missing `total_sites`.
- **Fallback:** the module not loaded, so the read is `degraded` with
  `MOD-FALLBACK-001`.

Each fixture pins its calculation results and validation codes.
`gen-conformance-cases` would regenerate the runner cases, and `verify-packages`
would gain the package.

## Reference implementation (if accepted)

This draft authorizes none. If accepted, the implementation would land on a
separate branch, as RFC 0039's did:

- `packages/uwmd-module-manufactured-housing`, laid out like
  `packages/uwmd-module-data-center` (manifest in `src/index.ts`,
  `scripts/emit-manifest.mjs`, tests);
- the example `examples/Desert-Palms-MHC-Apache-Junction-AZ.uwx.md`;
- the runtime fixtures above.

A test would pin the five builtin-identical formulas against the builtin packs'
strings. StackUW's adoption (its `CAP-015` item) is the adopter's own follow-up.

## Alternatives considered

- **A builtin `manufactured_housing` class.** The builtin set is closed for 1.x
  (§2.2), and the module path needs no spec change.
- **A `multifamily` document stating sites as units.** It loses the pad/home
  split and misstates the denominator.
- **The earlier Σ over `site_types[]`.** Unreachable without collection
  iteration, which this RFC does not add.
- **Both `site_types[]` and a scalar.** Two truths that no rule can reconcile.
- **Stating `annual_pad_rent_potential` instead of the monthly average.**
  Equivalent information. With an annual figure stated, the per-site average
  would be a division. The draft states the monthly average because it is the
  per-site figure the consumer reads; see the owner decisions.
- **Omitting the debt metrics, as the data-centre module does.** Under §X.2.4
  the class would then have no DSCR, LTV or debt yield at all.
- **Publishing class defaults.** The protocol has no mechanism; a core RFC would
  be separate.

## Decision status

RFC 0068 remains `draft`.

| Item | Source | State |
|---|---|---|
| A custom class gets no builtin pack, layout, size row or defaults; the module supplies its own calculations | Protocol §X.2.4, RFC 0003 | Existing rule. |
| The degraded fallback renders view models only and reports `MOD-FALLBACK-001` | Protocol §X.2.2 | Existing rule. |
| No collection iteration; `sum`/`avg` take explicit arguments | Protocol §VIII.1, §VIII.3 | Existing rule. |
| Module rules fire on `false` and are silent on `null`; failed calculations report `MOD-CALC-ERROR` | `module-runtime.ts`, RFC 0006 | Existing behaviour. |
| Sites as the underwriting unit, with POH rent as a second stream | StackUW planning, 2026-09-29 | Adopter evidence. Not verified here. Not authority. |
| The class, its fallback, `mhc_sites`, the calculations and the rules above | This draft | Proposal. |
| `site_types[]`, utilities, POH operating detail, RV sites, thresholds | This draft | Deferred. |
| The scalar's form: a monthly per-site average (draft) or an annual potential | — | **Owner decision.** |
| The scalar's basis: all sites with vacant ones at asking rent (draft), or occupied sites only | — | **Owner decision.** |
| Whether the module declares the builtin debt metrics, accepting that a stated zero loan or debt service reports `MOD-CALC-ERROR` (draft: declare them) | — | **Owner decision.** |
| Whether `age_restricted` belongs in the first scope (draft: keep, disclosure only) | — | **Owner decision.** |
| Acceptance of RFC 0068 and implementation | — | Not decided. Not authorized. |

## Prior art

- RFC 0003 — module-declared asset classes and the fallback contract.
- RFC 0006 — the first module, and the rule semantics of firing on `false` and
  staying silent on `null`.
- RFC 0039 — the data-centre module, the template followed here, including
  module formulas over standard sections.
