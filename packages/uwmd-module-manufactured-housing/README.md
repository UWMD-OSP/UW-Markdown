# @uwmd/module-manufactured-housing

Source-only reference implementation of [RFC 0068](../../docs/rfcs/0068-manufactured-housing-module.md).
Package **0.1.0** pins `@uwmd/core` **2.21.0** exactly. This package is outside
the release workflow and publish set; no npm installation is advertised.
Build this repository with `npm run build` to generate `dist/manifest.json`.

The permanent asset class is `org.uwmd.manufactured_housing`, declared by
`org.uwmd.manufactured_housing_module` (contract **0.1.0**, manifest schema **1**).
A future builtin promotion requires an explicit equivalence contract so document
identity and keyed benchmark series do not split (issue #263 / draft RFC 0073).
Document `modules[].version` names the manifest contract, not the package version.

Load explicitly in a host from this workspace:

```ts
import { createModuleRegistry, parseUWFile, evaluateModuleCalculations,
  validateAgainstModules, resolveAssetClass } from '@uwmd/core';
import { MANUFACTURED_HOUSING_MODULE } from '@uwmd/module-manufactured-housing';

const registry = createModuleRegistry({
  modules: [MANUFACTURED_HOUSING_MODULE], hostTier: 'tier-3-calc-host',
});
const file = parseUWFile(source);
const resolution = resolveAssetClass(file.frontmatter.asset_class, registry);
const results = evaluateModuleCalculations(file, registry);
const issues = validateAgainstModules(file, registry);
```

Browser hosts use these APIs from `@uwmd/core/browser`; the typed manifest has
no runtime dependency on the Node core entry. Hosts can instead read the emitted
JSON through `@uwmd/module-manufactured-housing/manifest.json`.

## Inputs and calculations

Required `mhc_sites` contains whole `total_sites` (at least one),
`occupied_sites` and `park_owned_homes` (zero through total sites), nonnegative
`weighted_pad_rent_monthly`, and `as_of_date`. Pad rent is stated with `_meta`
provenance: a site-count-weighted monthly average across **all** sites, occupied
at in-place rent and vacant at stated asking rent. It excludes home rent, fees,
utilities reimbursements and RV/transient income. All money uses document currency.
`poh_home_rent_monthly` averages **all** park-owned homes on the same in-place /
asking basis, excludes pad rent, and is required and nonnegative when homes exist;
with zero homes it must be absent or null.

The six calculations are physical occupancy, annual pad rent potential, POH
share, annual home rent potential, price per site (from `valuation.purchase_price`),
and NOI per site (from `noi_model.net_operating_income`). Currency results round
once to two decimals; fractions to four, under the shared binary64 quantizer.
Missing inputs yield null. With no POH, home revenue is null and POH share is zero.

Seven error rules `CC-MOD-MH-01`–`07` enforce requiredness and ranges. A missing
section emits only `MOD-SECTION-MISSING`; numeric type errors emit the existing
`MOD-RULE-ERROR`, naming the rule, plus `MOD-CALC-ERROR` for affected calculations.
Section schemas are descriptive and are **not** enforced by the core runtime.
Date checking is presence-only; malformed/impossible dates are not refused.
Adoption of RFC 0071's date predicate is a separate module revision.

## Fallback and scope

A host holding the class declaration but not loading the module resolves
`degraded` under `multifamily`, with `MOD-FALLBACK-001`. Only fallback view models
are granted; sites are not units. Without a declaration the class is unresolved.
The module supplies no builtin pack, defaults, Excel layout, size-registry row,
generic debt metrics, POH share of rent, rent-to-NOI reconciliation, RV income,
site-type schedule, or market thresholds.

[Desert Palms](../../examples/Desert-Palms-MHC-Apache-Junction-AZ.uwx.md) is a
synthetic, source-attributable teaching example; its package fixture is identical.
The runtime corpus pins every calculation and rule, null/zero distinctions,
non-numeric fields, date presence, builtin isolation and degraded fallback.

MIT. Part of the UW Markdown monorepo.
