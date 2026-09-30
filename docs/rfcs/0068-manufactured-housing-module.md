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

**Draft agent proposal.** StackUW's manufactured-housing plan is adopter
requirements evidence, not UWMD owner authorship or acceptance. The per-site
calculation representation below is unresolved under the current no-collection-
iteration rule. Do not accept or implement this module until it has a compatible
representation; this RFC does not reopen collection iteration.

> A manufactured-housing community earns most of its income from pad rent. It leases a lot to a resident who owns
> the home, so the revenue unit is the site, not the unit or the square foot. Some sites also carry a park-owned
> home, which earns home rent on top of the pad. No builtin class states either fact, and the §XIII size registry
> refuses a custom class a size row (§X.2.4). This RFC follows RFC 0039 exactly: one module declares the class, with
> its own sections, calculations and validations. No spec change; protocol and format versions do not move.

## Summary

Propose `@uwmd/module-manufactured-housing`. It would declare the custom class `org.uwmd.manufactured_housing`, with fallback
`multifamily`, and sections `mhc_sites` (required), `mhc_utilities` and `mhc_homes` (optional). Its calculations are
per-site figures, the park-owned-home split, and the builtin debt metrics over the declared paths. Its `CC-MOD-MH-*`
validations cover the site roll's internal consistency. It ships an example document, fixtures and a runtime
conformance suite, as RFC 0039 did.

## Motivation

StackUW's 2026-09-29 planning record (`Q-974` option 1 and
`docs/plans/manufactured-housing-2026-09-29/README.md`) treats sites as the
underwriting unit: a tenant-owned-home site earns pad rent, and a park-owned
home adds a second home-rent stream on the same site. Its upstream-first
preference is adopter evidence, not a UWMD owner decision.

What the protocol has today:
- The builtin classes are closed for protocol 1.x (§2.2). None states sites, pad rent or a park-owned home, and
  `pad`, `site` and `manufactured` appear nowhere in the format spec.
- A module-declared class (RFC 0003, §2.2a) is the designed path, and RFC 0039 proved it on data centres with no spec
  change.
- A module cannot publish class defaults (`AssetClassDefaults` is keyed to the builtin enum). This module publishes
  none and claims none.

A reader with core only sees a degraded `multifamily` read with a warning. That is the protocol's designed behaviour,
and it is why this ships in the org's namespace rather than a vendor's.

## Proposed change

### New package: `@uwmd/module-manufactured-housing`

Layout, build and export as `packages/uwmd-module-data-center`: `src/index.ts` exports the manifest,
`scripts/emit-manifest.mjs` writes `manifest.json`, and `test/fixtures/` plus `conformance/modules/runtime/` are
added.

### Manifest

| Field | Value | Why |
|---|---|---|
| `manifest_version` | `'1'` | |
| `id` | `org.uwmd.manufactured_housing_module` | the org's namespace, as RFC 0039 |
| `requires_protocol` | `>=2.5.0` | the data-centre floor: coverage channel and return basis |
| `requires_format` | `>=1.1` | |
| `requires_tier` | `tier-3-calc-host` | the contribution is per-site calculation |
| `declares_asset_classes[0].id` | `org.uwmd.manufactured_housing` | the last segment is not a builtin name (§2.2a) |
| `.display_name` | `Manufactured Housing Community` | |
| `.fallback` | `multifamily` | a park is residential income property; a fallback reader loses the site count and the pad/home split |
| `.required_sections` | `['mhc_sites']` | |
| `.optional_sections` | `['mhc_utilities', 'mhc_homes']` | |

### Sections

**`mhc_sites`: Sites and pad rent** (required)
- `total_sites`: integer ≥ 1. It is the size denominator, since a custom class has no §XIII row. The §4.1 `property`
  block does not gain `total_sites`.
- `site_types[]`: `{ name, count ≥ 0, pad_rent_monthly ≥ 0, market_pad_rent_monthly ≥ 0 | null }`.
- `occupied_sites`: integer ≥ 0.
- `park_owned_homes`: integer ≥ 0, or `null` when the park has none.
- `age_restricted`: boolean.
- `as_of_date`: YYYY-MM-DD.

**`mhc_utilities`: Utility billing method** (optional)
- `utilities[]`: `{ utility: water | sewer | trash | gas | electric | other, method: direct_billed | rubs | included_in_rent, annual_cost ≥ 0 | null, recovery_rate 0..1 | null }`.
- A `direct_billed` utility is neither the park's cost nor its recovery.

**`mhc_homes`: Park-owned home inventory** (optional)
- `homes_count` (equals `mhc_sites.park_owned_homes`), `home_rent_monthly_avg ≥ 0`, `poh_occupancy 0..1`,
  `turnover_rate 0..1 | null`, `turn_cost_per_home ≥ 0 | null`, `reserve_per_home_annual ≥ 0 | null`.
- No field carries a default. A value the document does not state is absent, not assumed.

### Calculations

The order is load-bearing: each row reads only rows above it. `gross_potential_rent` is read as the §4.5 object's
`.value` wherever it appears.

| id | formula | unit | round_to |
|---|---|---|---|
| `pad_rent_per_site_monthly` | **Unresolved.** The proposed Σ(`site_types[].count` × `pad_rent_monthly`) / `mhc_sites.total_sites` requires collection iteration that §VIII currently rejects. | `$` | 2 |
| `physical_occupancy` | `mhc_sites.occupied_sites / mhc_sites.total_sites` | `%` | 4 |
| `poh_share` | `mhc_sites.park_owned_homes / mhc_sites.total_sites` | `%` | 4 |
| `annual_pad_revenue_potential` | `pad_rent_per_site_monthly * mhc_sites.total_sites * 12` | `$` | 2 |
| `annual_home_rent_potential` | `mhc_homes.home_rent_monthly_avg * mhc_sites.park_owned_homes * 12` | `$` | 2 |
| `poh_rent_share` | `annual_home_rent_potential / (annual_pad_revenue_potential + annual_home_rent_potential)` | `%` | 4 |
| `price_per_site` | `valuation.purchase_price / mhc_sites.total_sites` | `$` | 2 |
| `noi_per_site` | `noi_model.net_operating_income / mhc_sites.total_sites` | `$` | 2 |
| `expense_ratio` | `noi_model.expenses.total_operating_expenses / noi_model.income.effective_gross_income` | `%` | 4 |
| `loan_per_site` | `debt_structure.loan_amount / mhc_sites.total_sites` | `$` | 2 |
| `dscr`, `debt_yield`, `ltv`, `ltc` | as the builtin packs state them, over `noi_model`, `debt_structure`, `valuation.purchase_price` and the declared `sources_uses.uses.total` | | |

The current evaluator cannot express this array-product sum under its
no-collection-iteration invariant. A stated `weighted_pad_rent_monthly` scalar
is one possible representation, but the draft has not pinned its source,
verification rule or relationship to `site_types[]`; it is not a silent
fallback. `annual_pad_revenue_potential` and `poh_rent_share` depend on the
unresolved first row. Acceptance requires a complete representation and
conformance plan that preserve the invariant without adding collection
iteration.

### Validations (`CC-MOD-MH-*`)

| code | severity | rule | message |
|---|---|---|---|
| MH-01 | error | `mhc_sites.park_owned_homes == null \|\| mhc_sites.park_owned_homes <= mhc_sites.total_sites` | park-owned homes exceed sites |
| MH-02 | error | `mhc_sites.occupied_sites <= mhc_sites.total_sites` | occupied sites exceed sites |
| MH-03 | error | `mhc_homes.homes_count == null \|\| mhc_homes.homes_count == mhc_sites.park_owned_homes` | the home inventory disagrees with the site roll |
| MH-04 | error | `mhc_homes.poh_occupancy == null \|\| mhc_homes.poh_occupancy <= 1` | park-owned-home occupancy exceeds 100% |
| MH-05 | warning | every `mhc_utilities.utilities[]` row states a `method` | a billed utility states no billing method |

### Example document

`examples/Desert-Palms-MHC-Apache-Junction-AZ.uwx.md`: 212 sites in 3 site types, 38 park-owned homes, all-age,
water and sewer on RUBS, trash included, electric direct-billed. Every standard section is stated, so the builtin
cross-checks evaluate.

## Compatibility analysis

- Additive only. No format or protocol text changes and no version moves (RFC 0039's pattern).
- A document that does not list the module in `modules:` is unaffected.
- A core-only reader sees `multifamily` with the fallback warning, and loses only the site and home figures.
- No builtin calc pack, Excel layout or size-registry row changes.

## Conformance impact

- A runtime conformance suite under `conformance/modules/runtime/manufactured-housing/`: the example, plus fixtures
  `01-all-toh` (no park-owned homes), `02-with-poh`, `03-poh-exceeds-sites` (MH-01), `04-occupied-exceeds-sites`
  (MH-02), `05-home-inventory-mismatch` (MH-03) and `06-utility-without-method` (MH-05).
- Each fixture pins its calculation results and validation codes.
- `gen-conformance-cases` regenerates the runner cases, and `verify-packages` gains the package.

## Reference implementation

Follows this RFC's acceptance, on a separate branch and PR, as RFC 0039 did. StackUW vendors the release and exports
parks under `org.uwmd.manufactured_housing` with its `modules:` frontmatter (StackUW `CAP-015` MH-8).

## Alternatives considered

- **A builtin `manufactured_housing` class.** The builtin set is closed for 1.x (§2.2), and the module path needs no
  spec change.
- **A `multifamily` document with the sites stated as units.** This loses the pad/home split and the site count,
  which are the class's own facts, and misstates the size denominator.
- **Publishing class defaults.** A module cannot (`AssetClassDefaults` is keyed to the builtin enum). A core RFC,
  "modules may publish class defaults", would be separate and is not needed here.

## Unresolved questions

1. Which stated and verifiable per-site rent representation replaces the
   proposed array-product Σ? The current §VIII evaluator has no collection
   iteration. A scalar such as `weighted_pad_rent_monthly` needs explicit
   source and consistency semantics before this module can be accepted;
   collection iteration is not an option in this RFC.
2. Should the module ship advisory thresholds, for example a warning for low physical occupancy or a high
   park-owned-home share? This draft ships none. A threshold is a market judgement, and the module publishes no
   defaults.
3. RV and transient sites are out of this module. Should `mhc_sites` state an `rv_sites` count for disclosure only,
   with a warning that the module models none of its revenue?

## Prior art

RFC 0003 (module-declared asset classes), RFC 0006 (the first module), and RFC 0039 (the data-centre module, the
template this follows).
