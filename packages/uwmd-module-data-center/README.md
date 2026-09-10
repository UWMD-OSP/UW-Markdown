# @uwmd/module-data-center

The **first product module on a module-declared asset class** for
[UW Markdown](https://uwmd.org) — the implementation of
[RFC 0039](../../docs/rfcs/0039-data-center-module.md).

RFC 0003 opened the asset-class enum to modules and RFC 0006 shipped the first
module, but hospitality is a *builtin* class, so the module system's two halves
had never run together on a real vertical. Data centers are the obvious first:
they are the asset class every "why not `industrial`?" conversation was about,
the revenue unit is kilowatts rather than square feet, and the per-unit metrics
the §XIII size-intensive registry refuses to hand a custom class (§X.2.4) are
exactly the ones the vertical runs on.

This package declares `org.uwmd.data_center` (fallback `industrial`), adds the
three sections that make a document a data center, and computes the
kW-denominated figures a buyer actually asks about. Like the hospitality
module, it is built against the published surface of `@uwmd/core` and nothing
else.

## Use

```ts
import {
  createModuleRegistry,
  evaluateModuleCalculations,
  resolveAssetClass,
  validateAgainstModules,
  parseUWFile,
} from '@uwmd/core';
import { DATA_CENTER_MODULE } from '@uwmd/module-data-center';

const registry = createModuleRegistry({
  modules: [DATA_CENTER_MODULE],
  hostTier: 'tier-3-calc-host',
});

const parsed = parseUWFile(source);
const resolution = resolveAssetClass(parsed.frontmatter.asset_class, registry); // resolved / custom
const calcs = evaluateModuleCalculations(parsed, registry);
const issues = validateAgainstModules(parsed, registry);
```

A host **without** this module resolves a data-center document as `degraded`
under `industrial` with `MOD-FALLBACK-001` (if it holds the declaration) or
`unresolved` with `MOD-MISSING-001` (if it does not). The document's
`modules:` frontmatter names what to load.

Hosts without a TypeScript toolchain read `dist/manifest.json`, generated from
the typed manifest at build time so the two cannot disagree.

## Units

**Every power figure is in kW. Every rate is a fraction. PUE is ≥ 1.**

The market quotes capacity in MW and rent in $/kW/month. Storing both would
invite a factor-of-1000 error that no rule could catch after the fact, so the
module stores one unit throughout and leaves MW to the display layer.

## What it contributes

**The class.** `org.uwmd.data_center`, display name "Data Center", fallback
`industrial`. The fallback is stated rather than omitted because an honest
approximation exists: the *standard* sections of a data-center deal are
ordinary industrial real estate. What a fallback reader loses is every kW
figure — and it will label `price_per_sqft` from the industrial layout, which
for a powered shell is the misleading denominator this module exists to
retire. The example sets `rentable_square_feet` to the building footprint so
that number is at least true, only unhelpful.

**Sections.** `dc_capacity` (required — it is what makes the document a data
center), `dc_power`, `dc_revenue`. Each carries a JSON Schema; core checks
*presence* and a host with a validator SHOULD apply the schema.

**Calculations**, in declaration order, each seeing the ones before it:

| id | Formula | Unit |
|---|---|---|
| `utilization` | `contracted_it_load_kw ÷ critical_it_load_kw` | fraction |
| `commissioned_share` | `critical_it_load_kw ÷ planned_it_load_kw` | fraction |
| `facility_load_kw` | `critical_it_load_kw × design_pue` | kW |
| `annual_facility_kwh_at_contract` | `contracted_it_load_kw × design_pue × 8760` | kWh |
| `annual_power_cost` | stated bill, else `annual_facility_kwh_at_contract × utility_rate_per_kwh` | $ |
| `power_cost_per_kw_month` | `annual_power_cost ÷ (contracted_it_load_kw × 12)` | $ |
| `annual_rent_revenue` | `rent_per_kw_month × contracted_it_load_kw × 12` | $ |
| `blended_revenue_per_kw_month` | `(rent + interconnection + services) ÷ (contracted_it_load_kw × 12)` | $ |
| `rent_index` | `rent_per_kw_month ÷ market_rent_per_kw_month` | x |
| `price_per_commissioned_kw` | `quick_metrics.purchase_price ÷ critical_it_load_kw` | $ |
| `noi_per_commissioned_kw` | `noi_model.net_operating_income ÷ critical_it_load_kw` | $ |

The last two are the point of the RFC. A custom class gets no entry in the
size-intensive registry, so the standard `price_per_unit` slot stays empty for
a data center; the module supplies the per-kW metrics itself, reading the
**standard** sections (`quick_metrics` is frontmatter, `noi_model` is a
standard section). The §VIII.2 resolver reaches both from a module formula —
that was the open question RFC 0039 was written to answer, and the answer is
yes, with no change to core.

**Validations.** Each rule asserts what must be **true**, fires on `false`, and
stays **silent on `null`**:

| Code | Severity | Catches |
|---|---|---|
| `CC-MOD-DC-01` | error | PUE below 1.0 — physically impossible. |
| `CC-MOD-DC-02` | warning | Design PUE above 1.6 — legacy-grade efficiency. |
| `CC-MOD-DC-03` | error | Commissioned load above the planned build-out. |
| `CC-MOD-DC-04` | warning | Contracted load above commissioned — pre-leased phases; a schedule question. |
| `CC-MOD-DC-05` | warning | Utility feed below the facility load at design PUE. |
| `CC-MOD-DC-06` | warning | Measured PUE more than 15% above design. |
| `CC-MOD-DC-07` | warning | Contracted rent more than 15% below the comp set. |

`CC-MOD-DC-04` is a warning because pre-leasing future phases is the normal
hyperscale shape; the number is not wrong. `CC-MOD-DC-05` likewise: a pending
utility upgrade is a cost line, not a defect. `CC-MOD-DC-07`'s
`market_rent_per_kw_month == null` guard is the same idea as the hospitality
module's: without it every data center without a comp set would carry a
permanent below-market warning.

## The example

[`examples/Mesa-Gateway-Data-Center-Mesa-AZ.uwx.md`](../../examples/Mesa-Gateway-Data-Center-Mesa-AZ.uwx.md)
is the corpus's first custom-class example — 10,000 kW commissioned, 12,500
planned, 11,000 contracted, PUE 1.25, $150/kW-month against a $187.50 comp —
chosen so every calculation is an exact decimal. It is deliberately imperfect:
a pre-leased phase 2 and a below-market contract, so `CC-MOD-DC-04` and
`CC-MOD-DC-07` both fire on one file and nothing else does.
`test/fixtures/mesa-gateway-data-center.uwx.md` is the same bytes, and a test
keeps it that way. The
[`conformance/modules/runtime/`](../../conformance/modules/runtime/) suite
derives five more scenarios from it — PUE below one, no comp set, the required
section removed, the same file relabelled `industrial` (where the module must
not run at all), and the module absent (the RFC 0003 fallback path on a
product module).

MIT. Part of the [UW Markdown](https://github.com/UWMD-OSP/UW-Markdown) monorepo.
