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
authority, and it is not verifiable in this repository.

On 2026-10-01 the owner gave directions that narrow the first scope (see
[Decision status](#decision-status)). Those directions do not accept the RFC or
authorize implementation.

## Summary

A manufactured-housing community (MHC) earns most of its income from pad rent:
it leases a site to a resident who owns the home. Some sites also carry a
park-owned home (POH), which earns home rent on top of the pad. No builtin class
states either fact.

This draft proposes `@uwmd/module-manufactured-housing`, on RFC 0039's
data-centre pattern. The module declares the custom class
`org.uwmd.manufactured_housing` (fallback `multifamily`) and one required
section, `mhc_sites`.

- **Pad rent** is one stated, source-backed scalar,
  `weighted_pad_rent_monthly`. This is the selected first-scope representation.
- **Calculations** are limited to MHC-specific and per-site metrics, all in
  ordinary existing calc grammar. None can divide by zero on a valid document.
- **Generic and derived ratios are deferred.** The debt metrics, the expense
  ratio and the POH share of rent are not in the first scope.
- **Every required field is enforced by a runtime rule.** The reference runtime
  does not validate documents against a module section's JSON Schema, so each
  required field has a deterministic rule.

No Format or Protocol change is proposed, and no version moves.

## What exists today (re-verified on `main` at `51afadc`)

- **No MHC vocabulary.** The builtin classes are closed for protocol 1.x
  (§2.2). None states sites, pad rent or a park-owned home.
- **The module path.** A module-declared class (RFC 0003, Protocol §X.2) is the
  designed path. RFC 0039 shipped one (`@uwmd/module-data-center`) with no spec
  change, confirmed that module formulas may read standard sections (its
  implementation note 1), and limited itself to vertical-specific calculations.
  It does not clone the generic debt pack.
- **What a custom class does not get (Protocol §X.2.4).** It has no builtin calc
  pack, no Excel layout and no §XIII size row. `getAssetClassDefaults` returns
  `null` for it, and `CC-13` is `not_applicable`.
- **Module runtime (`module-runtime.ts`):**
  - calculations run in declaration order, each seeing earlier results as
    `prior_results`;
  - a validation `rule` is a safe expression in the §VIII.1 grammar that fires
    on `false` and is silent on `null`;
  - a rule that cannot evaluate is reported as `MOD-RULE-ERROR`, and a
    calculation that cannot evaluate as `MOD-CALC-ERROR`. Both are errors that
    name the rule or calculation;
  - a section's `schema` is only shape-checked when the manifest loads.
    **Documents are not validated against it at runtime.**
- **Calc grammar limits that shape this design:**
  - **No collection iteration.** `sum(...nums)` and `avg(...nums)` take explicit
    arguments; given an array, `sum` refuses with `CALC-TYPE-001`, and a numeric
    index such as `site_types[0]` does not parse.
  - **No string literals.** `"2026-06-30"` is `CALC-PARSE-001`, and there is no
    date predicate. A rule can test that a date is present, not that it is
    real.
  - **`if()` is eager.** It evaluates both branches, so a guard such as
    `if(x > 0, 1 / x, null)` still raises `CALC-DIV-ZERO`.
  - **Type errors.** An ordered comparison or arithmetic on a non-number is
    `CALC-TYPE-001`. `==` and `!=` return booleans, including against `null`.
- **Adopter evidence (unverified here).** StackUW's planning record, dated
  2026-09-29, treats the site as the underwriting unit, with POH home rent as a
  second stream.

## Why the earliest calculation was unreachable

The original draft computed pad rent as
Σ(`site_types[].count` × `pad_rent_monthly`) / `total_sites`, and two metrics
depended on it. That needs element-wise products and a sum over a
variable-length array, which the evaluator does not have. This RFC adds no
collection iteration, aggregation primitive or second engine.

Nor could a rule check a counts-only `site_types[]` against `total_sites`. So the
schedule is deferred, and pad rent is carried as one stated scalar.

## Proposed first scope

### Manifest

| Field | Value |
|---|---|
| `manifest_version` | `'1'` |
| `id` | `org.uwmd.manufactured_housing_module` |
| `requires_protocol` | `>=2.5.0` (the data-centre floor; the module uses no later feature) |
| `requires_format` | `>=1.1` |
| `requires_tier` | `tier-3-calc-host` |
| `declares_asset_classes[0].id` | `org.uwmd.manufactured_housing` |
| `.display_name` | `Manufactured Housing Community` |
| `.fallback` | `multifamily` (see [Fallback](#fallback)) |
| `.required_sections` | `['mhc_sites']` |
| `.optional_sections` | none |

### Section `mhc_sites` (required)

| Field | Requiredness | Type and unit | Meaning |
|---|---|---|---|
| `total_sites` | required | whole number ≥ 1 | Every manufactured-home site in the community, occupied or vacant. The module's size denominator, since a custom class has no §XIII row. `property` gains no field. |
| `occupied_sites` | required | whole number, `0 ≤ n ≤ total_sites` | Sites with a home in place under an in-place lease as of `as_of_date`. |
| `park_owned_homes` | required | whole number, `0 ≤ n ≤ total_sites` | Homes the community owns on its own sites. `0` when it owns none. |
| `weighted_pad_rent_monthly` | required | currency per site per month, finite and ≥ 0 | The authoritative pad-rent input, defined below. |
| `poh_home_rent_monthly` | conditional | currency per park-owned home per month, ≥ 0 | Required when `park_owned_homes > 0`, and absent or `null` when it is `0`. The average monthly **home** rent per park-owned home across all `park_owned_homes`: occupied homes at in-place home rent, vacant homes at asking home rent. It **excludes** the pad rent for that home's site, which `weighted_pad_rent_monthly` already counts. |
| `as_of_date` | required | `YYYY-MM-DD` | The date the counts and rents describe. |

**`weighted_pad_rent_monthly`** is the selected first-scope representation. It
is the site-count-weighted average monthly pad (lot) rent across all
`total_sites`:

- occupied sites at their in-place pad rent;
- vacant sites at the asking pad rent the source or underwriter states.

Further rules:

- **Scope.** It is pad rent only, excluding park-owned-home rent, utility
  reimbursements, fees, and RV or transient income.
- **Provenance.** It is a stated, source-backed input (a rent roll, a T-12, or
  the underwriter's stated figure), carried with the section's `_meta`
  provenance. Core does not derive it, and no module claims to have computed
  it.
- **Currency.** Values are in the document's currency (RFC 0046).
- **Range.** It is finite and nonnegative, so zero is valid. JSON numbers are
  always finite, so the rule needs to check only presence and `>= 0`.

### Calculations

Every formula is in the existing §VIII.1 grammar. Order is load-bearing: a row
reads only stated fields and the rows above it.

| id | Formula | Unit | round_to |
|---|---|---|---|
| `physical_occupancy` | `mhc_sites.occupied_sites / mhc_sites.total_sites` | `%` | 4 |
| `annual_pad_rent_potential` | `mhc_sites.weighted_pad_rent_monthly * mhc_sites.total_sites * 12` | `$` | 2 |
| `poh_share` | `mhc_sites.park_owned_homes / mhc_sites.total_sites` | `%` | 4 |
| `annual_poh_home_rent_potential` | `mhc_sites.poh_home_rent_monthly * mhc_sites.park_owned_homes * 12` | `$` | 2 |
| `price_per_site` | `valuation.purchase_price / mhc_sites.total_sites` | `$` | 2 |
| `noi_per_site` | `noi_model.net_operating_income / mhc_sites.total_sites` | `$` | 2 |

### Calculation audit

| Metric | Denominator on a valid document | Null behaviour |
|---|---|---|
| Pad rent per site per month | none; it is the stated input `weighted_pad_rent_monthly` | — |
| `physical_occupancy`, `poh_share` | `total_sites ≥ 1` (`CC-MOD-MH-01`) | `null` only if an input is absent, which a rule reports |
| `annual_pad_rent_potential` | none (a product) | Valid at zero when pad rent is `0` |
| `annual_poh_home_rent_potential` | none (a product), so `park_owned_homes: 0` cannot divide by zero | Valid at zero when park-owned homes exist and home rent is `0`. `null` when there are no park-owned homes and therefore no home rent; `poh_share` is then `0` |
| `price_per_site`, `noi_per_site` | `total_sites ≥ 1` | `null` when the standard-section figure is absent |

`poh_share` is the first-scope measure of POH exposure. The POH share of *rent*
is deferred (see [Deferred](#deferred)).

No valid document can make a first-scope calculation divide by zero. A stated
`total_sites: 0` is invalid: `CC-MOD-MH-01` reports it, and each per-site
calculation also reports `MOD-CALC-ERROR`. AI performs none of this arithmetic;
the evaluator does.

### Validations (`CC-MOD-MH-NN`)

Every rule is an `error`, and there are no market or advisory thresholds. Each
rule opens with `mhc_sites == null ||`, so a document missing the whole section
reports `MOD-SECTION-MISSING` alone. Presence is tested with `!= null`, which
yields `false` rather than `null` on an absent field, so a missing required
field is reported rather than ignored.

| Code | Rule | Detects |
|---|---|---|
| `CC-MOD-MH-01` | `mhc_sites == null \|\| (mhc_sites.total_sites != null && mhc_sites.total_sites >= 1 && round(mhc_sites.total_sites, 0) == mhc_sites.total_sites)` | `total_sites` missing, below 1, or not whole |
| `CC-MOD-MH-02` | `mhc_sites == null \|\| (mhc_sites.occupied_sites != null && mhc_sites.occupied_sites >= 0 && round(mhc_sites.occupied_sites, 0) == mhc_sites.occupied_sites && mhc_sites.occupied_sites <= mhc_sites.total_sites)` | `occupied_sites` missing, negative, not whole, or above `total_sites` |
| `CC-MOD-MH-03` | `mhc_sites == null \|\| (mhc_sites.park_owned_homes != null && mhc_sites.park_owned_homes >= 0 && round(mhc_sites.park_owned_homes, 0) == mhc_sites.park_owned_homes && mhc_sites.park_owned_homes <= mhc_sites.total_sites)` | `park_owned_homes` missing, negative, not whole, or above `total_sites` |
| `CC-MOD-MH-04` | `mhc_sites == null \|\| (mhc_sites.weighted_pad_rent_monthly != null && mhc_sites.weighted_pad_rent_monthly >= 0)` | pad rent missing or negative (zero is valid) |
| `CC-MOD-MH-05` | `mhc_sites == null \|\| mhc_sites.as_of_date != null` | `as_of_date` missing |
| `CC-MOD-MH-06` | `mhc_sites == null \|\| mhc_sites.park_owned_homes != 0 \|\| mhc_sites.poh_home_rent_monthly == null` | POH home rent stated when there are no park-owned homes |
| `CC-MOD-MH-07` | `mhc_sites == null \|\| mhc_sites.park_owned_homes == null \|\| mhc_sites.park_owned_homes <= 0 \|\| (mhc_sites.poh_home_rent_monthly != null && mhc_sites.poh_home_rent_monthly >= 0)` | POH home rent missing or negative when park-owned homes exist |

**Non-numeric values.** A string, boolean or object in a numeric field makes
its rule fail to evaluate (`CALC-TYPE-001`). The reference runtime reports that
deterministically as `MOD-RULE-ERROR`, naming the rule, together with a
`MOD-CALC-ERROR` for each calculation that reads the field. The rule's own code
cannot be emitted for this case, because the grammar has no type predicate.

**`as_of_date` validity is not enforceable.** `CC-MOD-MH-05` detects a missing
date. A malformed or impossible one, such as `"2026-02-30"`, cannot be detected
by the reference runtime: rule grammar has no string literals and no date
predicate, and section schemas are not enforced. No calculation reads the date.
Closing this gap needs a separate core capability, listed under
[Unresolved questions](#unresolved-questions). This RFC does not rely on the
manifest schema for it.

**Verified on the real runtime.** While drafting, these calculation and rule
tables were run unchanged through `evaluateModuleCalculations` and
`validateAgainstModules` on the current core build, using synthetic documents in
a scratch harness that is not committed. 27 cases were run, and in each the
issues matched the tables above:

- the manifest loads;
- valid documents with and without park-owned homes draw no issue;
- valid documents with zero pad rent, zero POH home rent with park-owned homes
  present, or both, draw no issue. The annual potentials are `0`;
- valid documents with a zero `loan_amount`, a zero `annual_debt_service`, or
  zero EGI draw no issue;
- a missing section reports only `MOD-SECTION-MISSING`;
- each missing required field reports exactly its rule;
- each numeric violation reports its rule;
- non-numeric values report `MOD-RULE-ERROR`;
- a malformed `as_of_date` draws no issue, as stated above.

### What the module does not do

- It does not derive pad rent from site types, and does not iterate.
- It does not compute generic debt metrics, the expense ratio, or the POH share
  of rent (see [Deferred](#deferred)).
- It does not apply market thresholds, publish class defaults, or assume a
  value the document does not state.
- It does not model RV or transient sites.
- It does not reconcile its rent potentials with
  `noi_model.income.gross_potential_rent`. No rule ties them, because whether
  POH home rent sits in GPR or other income is a modelling choice with no
  evidence in the repository.

## Fallback

`multifamily` remains the honest degraded reading. Under Protocol §X.2.2, a host
without the module MAY render using the fallback's **view models**, MUST report
the read as degraded and emit `MOD-FALLBACK-001`, and MUST NOT present it as a
full read.

- **What survives.** The standard sections (`property`, `ownership`,
  `noi_model`, `valuation`, `debt_structure`, `sources_uses`, `dcf`) stay intact
  and render under residential income-property view models. The stated NOI,
  price, debt and returns read correctly. This RFC does not change those
  sections.
- **What is lost:**
  - the module's calculations and validations;
  - any labelled presentation of `mhc_sites`, which renders as a generic block.
- **The `total_units` hazard.** A host that also ran the multifamily *pack*
  (outside what §X.2.2 grants) would divide per-unit metrics by
  `property.total_units`. The example therefore leaves `property.total_units`
  unstated, so no mislabelled per-unit figure appears. RFC 0039 handled the
  same issue in its example.

## Deferred

- **Generic metrics for custom classes:** `loan_per_site`, `ltv`, `ltc`, `dscr`,
  `debt_yield` and `expense_ratio`.
  - Copied into this module, a legitimately stated zero `loan_amount`,
    `annual_debt_service` or `effective_gross_income` would raise
    `CALC-DIV-ZERO`, which the module runtime reports as `MOD-CALC-ERROR`.
  - Absence and zero are different facts, and a document should not omit a true
    zero to avoid an error.
  - `if()` is eager, so no guarded variant is possible in today's grammar, and
    this RFC invents none.
  - The data-centre module already shows a vertical module computing only
    vertical-specific metrics.

  How custom classes should get generic metrics is a separate, shared design
  question. Builtin packs are unchanged.
- **`poh_rent_share`** (POH home rent as a share of pad plus home rent). Its
  denominator, `annual_pad_rent_potential + annual_poh_home_rent_potential`, is
  zero on a valid document when pad rent and home rent are both `0`.
  - Requiring positive pad rent only to keep a derived ratio evaluable was
    rejected.
  - Because `if()` is eager, no conditional form is expressible today.
  - This RFC invents no engine workaround.
  - It can return when the calc contract has a suitable denominator or
    conditional mechanism, or when a use case justifies one.

  `poh_share` remains the first-scope POH-exposure metric.
- **`age_restricted`.** It is disclosure only, no calculation reads it, and the
  runtime would not enforce its type. It can return with a demonstrated
  consumer.
- **The per-site-type rent schedule (`site_types[]`)**, including a counts-only
  inventory. No rule can reconcile it without collection iteration.
- **Utilities detail (`mhc_utilities`).** No calculation reads it, and it would
  duplicate `noi_model.expenses.utilities` and other-income figures.
- **POH operating detail** (occupancy, turnover, turn cost, reserves). No
  calculation reads it, and the reserve would compete with
  `noi_model.expenses.replacement_reserves`.
- **RV and transient sites:** no demonstrated consumer.
- **Advisory thresholds:** market judgements with no evidence.
- **Module-published class defaults:** the protocol has no mechanism.

## Compatibility analysis

- **Additive only.** No Format or Protocol text changes and no version moves,
  following RFC 0039.
- **Documents that don't load the module.** A document that does not list the
  module in `modules:` is unaffected. A host without the module reads an MHC
  document as degraded `multifamily` (see [Fallback](#fallback)).
- **Standard sections.** `debt_structure`, `valuation`, `sources_uses` and the
  other standard sections are unchanged and fully renderable. Stating zero debt
  values draws no module issue, because the module computes no debt metric.
- **No builtin changes.** No builtin calc pack, Excel layout or size-registry
  row changes.

## Conformance impact (proposed)

A runtime suite under `conformance/modules/runtime/`, numbered after the
data-centre scenarios at implementation. It would hold the example document
plus fixtures for:

- **Valid documents:**
  - park-owned homes present (all six calculations pinned);
  - no park-owned homes (POH revenue `null`, `poh_share` `0`);
  - zero pad rent, and zero POH home rent with park-owned homes present (annual
    potentials `0`, no issue);
  - zero `loan_amount` and `annual_debt_service` stated (no module issue).
- **Missing data:**
  - the section missing (`MOD-SECTION-MISSING` only);
  - each required field missing (its rule only).
- **Rule violations:** each of `CC-MOD-MH-01` to `CC-MOD-MH-07`.
- **Non-numeric values:** a non-numeric count (`MOD-RULE-ERROR` naming the
  rule).
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

StackUW's adoption is the adopter's own follow-up.

## Alternatives considered

- **A builtin `manufactured_housing` class.** The builtin set is closed for 1.x
  (§2.2), and the module path needs no spec change.
- **A `multifamily` document stating sites as units.** It loses the pad/home
  split and misstates the denominator.
- **The original Σ over `site_types[]`.** Unreachable without collection
  iteration.
- **Both `site_types[]` and the scalar.** Two truths that no rule can reconcile.
- **Stating `annual_pad_rent_potential` instead of the monthly average.**
  Superseded: the owner selected `weighted_pad_rent_monthly`.
- **Copying the builtin debt metrics and expense ratio.** A true zero would
  become an error, and no guard is expressible (see [Deferred](#deferred)).
- **Requiring positive pad rent so that `poh_rent_share` always evaluates.**
  Rejected by the owner: a valid input is not restricted only to keep a derived
  ratio defined. `poh_rent_share` is deferred instead.
- **Telling all-cash documents to omit zero debt values.** It conflates absence
  with zero; rejected.
- **Relying on the manifest JSON Schema for requiredness and types.** The
  reference runtime does not enforce it; rules carry the contract instead.
- **Publishing class defaults.** The protocol has no mechanism; a core RFC would
  be separate.

## Unresolved questions

1. **`as_of_date` validity: a module-runtime capability gap.** The reference
   runtime can require the date but cannot detect a malformed one. That needs a
   core capability, either:
   - a date-validity predicate in §VIII.3, or
   - runtime enforcement of module section schemas.

   Either is its own RFC. Until then this module enforces presence only.
2. **Type errors.** Non-numeric values surface as `MOD-RULE-ERROR` naming the
   rule, not under the rule's own code. A type predicate would need the same
   kind of core change. Whether `MOD-RULE-ERROR` is acceptable as the
   first-scope signal is the owner's call.
3. **Generic metrics for custom classes:** how a module-declared class should
   obtain debt metrics and the expense ratio without cloning formulas or
   refusing true zeros. This is a shared design question, outside this RFC.
4. **Ratios with a possibly-zero denominator** (`poh_rent_share`): whether the
   calc contract should gain a denominator or conditional mechanism, or whether
   a use case justifies one. Outside this RFC.
5. **Acceptance** of RFC 0068 and authorization to implement.

## Decision status

RFC 0068 remains `draft`.

| Item | Source | State |
|---|---|---|
| A custom class gets no builtin pack, layout, size row or defaults; the module supplies its own calculations | Protocol §X.2.4, RFC 0003 | Existing rule. |
| The degraded fallback renders view models only and reports `MOD-FALLBACK-001` | Protocol §X.2.2 | Existing rule. |
| No collection iteration; no string literals; `if()` is eager | Protocol §VIII.1, §VIII.3; evaluator | Existing behaviour. |
| Module rules fire on `false` and are silent on `null`; failures report `MOD-RULE-ERROR` / `MOD-CALC-ERROR`; section schemas are not enforced at runtime | `module-runtime.ts`, `modules.ts` | Existing behaviour. |
| Sites as the underwriting unit, with POH rent as a second stream | StackUW planning, 2026-09-29 | Adopter evidence. Not verified here. Not authority. |
| `weighted_pad_rent_monthly` (site-weighted, all sites, vacant at stated asking rent; stated, not derived) is the first-scope pad-rent representation | Owner direction, 2026-10-01 | Selected for first scope. |
| `age_restricted` removed from first scope | Owner direction, 2026-10-01 | Deferred. |
| Generic debt calculations (`loan_per_site`, `ltv`, `ltc`, `dscr`, `debt_yield`) deferred; no recommendation to omit true zero values | Owner direction, 2026-10-01 | Deferred. |
| First-scope requiredness enforced by runtime rules, not the manifest schema | Owner direction, 2026-10-01 | Adopted in `CC-MOD-MH-01..07`. |
| `expense_ratio` deferred from first scope with the generic debt metrics | Owner decision, 2026-10-01 | Deferred. |
| `poh_home_rent_monthly` required (≥ 0) when `park_owned_homes > 0`, and absent or `null` when it is `0` | Owner decision, 2026-10-01 | Decided for first scope (`CC-MOD-MH-06`, `CC-MOD-MH-07`). |
| `weighted_pad_rent_monthly` is finite and nonnegative (≥ 0), not strictly positive | Owner decision, 2026-10-01 | Decided for first scope (`CC-MOD-MH-04`). |
| `poh_rent_share` deferred from first scope; `poh_share` is the POH-exposure metric | Owner decision, 2026-10-01 | Deferred. |
| The class, fallback, section, six calculations and seven rules | This draft, within the owner directions above | Proposal. |
| `as_of_date` validity; type errors under `MOD-RULE-ERROR` | — | **Unresolved.** A module-runtime capability gap. |
| `site_types[]`, utilities, POH operating detail, RV sites, thresholds, defaults, generic metrics for custom classes, `poh_rent_share` | — | Deferred. |
| Acceptance of RFC 0068 and implementation | — | Not decided. Not authorized. |

## Prior art

- RFC 0003 — module-declared asset classes and the fallback contract.
- RFC 0006 — the first module, and the rule semantics of firing on `false` and
  staying silent on `null`.
- RFC 0039 — the data-centre module, the template followed here, including
  module formulas over standard sections and the decision to compute only
  vertical-specific metrics.
