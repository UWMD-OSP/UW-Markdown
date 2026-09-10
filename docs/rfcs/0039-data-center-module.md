---
rfc: 0039
title: Data-center module — the first product module on a module-declared asset class
status: implemented
author: jaredmaxey
created: 2026-09-09
affects:
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0039: Data-center module — the first product module on a module-declared asset class

> RFC 0003 opened the asset-class enum to modules and RFC 0006 shipped
> the first module — but hospitality is a *builtin* class, so the
> module system's two halves have never been exercised together on a
> real vertical. Data centers are the obvious first: they are the
> asset class every "why not `industrial`?" conversation in RFC 0003
> was about, the revenue unit is kilowatts rather than square feet, and
> the per-unit metrics the §XIII size-intensive registry refuses to
> hand a custom class (§X.2.4) are exactly the ones the vertical runs
> on. If RFC 0003 generalizes, this module proves it; where it does
> not, this RFC is where the gap gets named. No spec change; protocol
> and format versions do not move.

## Summary

Ship `@uwmd/module-data-center`, a second reference module built
against the published surface of `@uwmd/core`, declaring the custom
asset class `org.uwmd.data_center` (fallback `industrial`), three
sections (`dc_capacity`, `dc_power`, `dc_revenue`), eleven
kilowatt-denominated calculations, and seven validations. The module
is the first *shipped* consumer of `declares_asset_classes`; the
existing `com.example.data_center` fixture under
`conformance/modules/asset-classes/` stays as the resolution fixture
and is not replaced. A new example document and a
`conformance/modules/runtime/` suite land with it.

## Motivation

- **RFC 0003 has a fixture consumer but no product consumer.** The
  resolution rules (§X.2), `MOD-FALLBACK-001`, `MOD-DEPENDENCY-UNDECLARED`
  and the three-segment identifier grammar are exercised only by a
  four-line fixture manifest that declares one `required_sections`
  entry and nothing else. Whether a module that declares a class *and*
  supplies sections, calculations, and validations for it composes
  cleanly — required sections from the declaration versus `required:
  true` on the section, the fallback render of a document whose
  headline numbers live in module sections a Tier-1 reader cannot
  interpret — is unverified. RFC 0006's lesson was that the module
  system's real gaps only surfaced when a real module was built; the
  custom-class half deserves the same treatment.
- **Data centers are being underwritten as `industrial` today**, which
  is the misuse RFC 0003 §Motivation named. The standard sections have
  nowhere to put critical IT load, PUE, redundancy topology, rent per
  kW-month, or the power pass-through terms that decide whether an
  operator's margin is 60% or 20%. A data-center deal authored against
  the standard sections loses every number a buyer actually asks
  about, and `price_per_sqft` on a powered shell is a meaningless
  denominator.
- **The per-unit question is the real test of §X.2.4.** A hotel is
  priced per key and the builtin size-intensive registry knows it. A
  data center is priced per commissioned kW (or MW) and the registry
  *cannot* know it — §X.2.4 refuses custom classes an entry on purpose.
  So the module must supply `price_per_commissioned_kw` and
  `noi_per_commissioned_kw` itself, from the standard sections' figures
  and its own capacity section. Whether that is enough, or whether a
  later RFC needs to let a module declare a per-unit denominator under
  controlled conditions, is a question this RFC is designed to answer
  with evidence rather than argument (§Unresolved).

## Proposed change

### New package: `@uwmd/module-data-center`

```
packages/uwmd-module-data-center/
├── package.json
├── scripts/emit-manifest.mjs   # the RFC 0006 shape: TS is the source of truth, dist/manifest.json is emitted
├── src/
│   ├── index.ts                # the typed ModuleManifest + exports
│   ├── view-models.ts          # SectionViewModel[] for the three sections
│   └── index.test.ts
├── test/fixtures/
│   └── mesa-gateway-data-center.uwx.md
└── README.md
```

TypeScript is the manifest source of truth and `dist/manifest.json` is
generated at build time — the RFC 0006 implementation note 2 decision,
adopted as-is.

### Identifiers

| | Value | Rule |
|---|---|---|
| Module id | `org.uwmd.datacenters` | reverse-DNS, the project's own namespace (as `org.uwmd.hospitality`) |
| Asset-class id | `org.uwmd.data_center` | three segments; final segment is not a builtin (§2.2a, `INVALID-ASSET-CLASS-002`) |
| Fallback | `industrial` | stated: a reader without the module renders `property`, `noi_model`, `dcf`, `debt` under the industrial view; the `dc_*` sections render as generic blocks |

The fallback is deliberate rather than omitted. RFC 0003 says to omit
`fallback` when no approximation is honest; here one is — the
*standard* sections of a data-center deal are ordinary industrial
real estate (a building, a lease, an NOI), and only the module
sections are not. What the fallback reader loses is stated in
§Compatibility.

The `com.example.data_center` class in `conformance/modules/asset-classes/`
is a different namespace and stays untouched. It is the resolution
fixture (four byte-identical documents, verdict depends on the reader);
this module is a product. `MOD-ASSET-CLASS-CONFLICT-001` does not
apply — different identifiers.

### Manifest

```ts
const MANIFEST: ModuleManifest = {
  manifest_version: '1',
  id: 'org.uwmd.datacenters',
  name: 'Data Center Underwriting Module',
  version: '0.1.0',
  description: 'Declares the org.uwmd.data_center asset class; adds capacity, power-economics and revenue sections; kW-denominated calculations; PUE, utility-feed and utilization validations.',
  authors: ['UW Markdown contributors'],
  license: 'MIT',
  requires_protocol: '>=2.5.0',
  requires_format: '>=1.1',
  requires_tier: 'tier-3-calc-host',
  declares_asset_classes: [{
    id: 'org.uwmd.data_center',
    display_name: 'Data Center',
    fallback: 'industrial',
    required_sections: ['dc_capacity'],
    optional_sections: ['dc_power', 'dc_revenue'],
  }],
  sections: [ /* below */ ],
  calculations: [ /* below */ ],
  validations: [ /* below */ ],
  view_models: [...DATA_CENTER_VIEW_MODELS],
};
```

`requires_protocol: '>=2.5.0'` because the module's fixture carries
`dcf.returns.tax_basis` (RFC 0038) and its validations are read
alongside the RFC 0037 coverage channel; there is nothing in the
module that needs 2.5.0 *mechanically*, but a module pinned below the
protocol its own fixture needs is a lie the loader cannot catch.

### Sections

Every rate is a **fraction** (format-wide rule); every power figure is
in **kW** (the market quotes MW for capacity and $/kW/month for rent —
one unit avoids the ×1000 mistake that the hospitality module's
occupancy-as-percent rule exists to catch in its own domain).

**`dc_capacity`** (required — it is what makes the document a data
center):

| Field | Type | Meaning |
|---|---|---|
| `critical_it_load_kw` | number ≥ 0 | Commissioned critical IT load — the capacity that can be sold today. |
| `planned_it_load_kw` | number ≥ 0 | Full build-out critical load. Equals `critical_it_load_kw` when no further phases exist. |
| `contracted_it_load_kw` | number ≥ 0 | Load under signed contract (leased/committed), including pre-leased future phases. |
| `utility_feed_kw` | number ≥ 0 | Utility power available at the meter today. |
| `design_pue` | number ≥ 1 | Design power usage effectiveness: total facility power ÷ IT power. |
| `measured_pue` | number ≥ 1 or null | Trailing measured PUE; null when the facility is not yet operating. |
| `redundancy` | enum `n`, `n_plus_1`, `n_plus_2`, `2n`, `2n_plus_1` | Electrical/mechanical topology. Not the Uptime tier — see §Unresolved. |
| `raised_floor_sf` | integer ≥ 0 or null | White space. Null for powered shells. |
| `design_density_kw_per_rack` | number ≥ 0 or null | Average design density. |

**`dc_power`** (optional):

| Field | Type | Meaning |
|---|---|---|
| `utility_rate_per_kwh` | number ≥ 0 | Blended $/kWh, all charges. |
| `billing` | enum `metered_pass_through`, `all_in`, `breakered` | How power is billed to tenants. |
| `power_margin` | number ≥ 0 or null | Landlord margin on power as a fraction of cost; meaningful only under `all_in` / `breakered`. |
| `stated_annual_power_cost` | number ≥ 0 or null | The operator's stated annual utility bill, when known. |

**`dc_revenue`** (optional; the calcs that need it stay `null` without
it, §VIII.2):

| Field | Type | Meaning |
|---|---|---|
| `lease_type` | enum `powered_shell`, `wholesale_turnkey`, `retail_colocation`, `hyperscale_build_to_suit` | Predominant lease structure. |
| `rent_per_kw_month` | number ≥ 0 | Weighted-average contracted rent, $/kW/month, on `contracted_it_load_kw`. |
| `interconnection_revenue_annual` | number ≥ 0 | Cross-connects, meet-me-room. |
| `services_revenue_annual` | number ≥ 0 | Remote hands and other services. |
| `market_rent_per_kw_month` | number ≥ 0 or null | Comp rent; null means no comp set was obtained. |

### Calculations

Declaration order is load-bearing — the runtime threads
`prior_results`, so each row may read only the rows above it.

| id | Formula | Unit | round_to |
|---|---|---|---|
| `utilization` | `dc_capacity.contracted_it_load_kw / dc_capacity.critical_it_load_kw` | `%` | 4 |
| `commissioned_share` | `dc_capacity.critical_it_load_kw / dc_capacity.planned_it_load_kw` | `%` | 4 |
| `facility_load_kw` | `dc_capacity.critical_it_load_kw * dc_capacity.design_pue` | `kW` | 2 |
| `annual_facility_kwh_at_contract` | `dc_capacity.contracted_it_load_kw * dc_capacity.design_pue * 8760` | `kWh` | 0 |
| `annual_power_cost` | `dc_power.stated_annual_power_cost != null ? dc_power.stated_annual_power_cost : annual_facility_kwh_at_contract * dc_power.utility_rate_per_kwh` | `$` | 2 |
| `power_cost_per_kw_month` | `annual_power_cost / (dc_capacity.contracted_it_load_kw * 12)` | `$` | 2 |
| `annual_rent_revenue` | `dc_revenue.rent_per_kw_month * dc_capacity.contracted_it_load_kw * 12` | `$` | 2 |
| `blended_revenue_per_kw_month` | `(annual_rent_revenue + dc_revenue.interconnection_revenue_annual + dc_revenue.services_revenue_annual) / (dc_capacity.contracted_it_load_kw * 12)` | `$` | 2 |
| `rent_index` | `dc_revenue.rent_per_kw_month / dc_revenue.market_rent_per_kw_month` | `x` | 4 |

Two calcs reference **standard** sections, and they are the point of
the RFC:

| id | Formula | Unit | round_to |
|---|---|---|---|
| `price_per_commissioned_kw` | `quick_metrics.purchase_price / dc_capacity.critical_it_load_kw` | `$` | 2 |
| `noi_per_commissioned_kw` | `noi_model.noi / dc_capacity.critical_it_load_kw` | `$` | 2 |

These are the per-unit metrics §X.2.4 withholds from the registry,
supplied by the module instead. Whether module formulas may read
standard sections (`quick_metrics`, `noi_model`) is settled at
implementation: the hospitality module reads only its own sections, so
the runtime's scope for standard sections is unproven. If the scope
does not reach them, the implementation MUST NOT widen the runtime
silently for one module; it stops and this RFC's §Unresolved gets the
answer (a runtime change is its own small RFC, since it changes what
every third-party manifest can read).

### Validations

Each rule asserts what must be TRUE; it fires on `false` and stays
silent on `null` — the RFC 0006 note 1 posture.

| Code | Severity | Rule | Message |
|---|---|---|---|
| `CC-MOD-DC-01` | error | `dc_capacity.design_pue >= 1` | PUE cannot be below 1.0 — total facility power includes the IT load. |
| `CC-MOD-DC-02` | warning | `dc_capacity.design_pue <= 1.6` | Design PUE above 1.6 — legacy-grade efficiency; confirm cooling topology and the power pass-through terms. |
| `CC-MOD-DC-03` | error | `dc_capacity.critical_it_load_kw <= dc_capacity.planned_it_load_kw` | Commissioned load exceeds the planned build-out. |
| `CC-MOD-DC-04` | warning | `dc_capacity.contracted_it_load_kw <= dc_capacity.critical_it_load_kw` | Contracted load exceeds commissioned load — pre-leased phases; confirm the delivery schedule and any rent-commencement gaps. |
| `CC-MOD-DC-05` | warning | `facility_load_kw <= dc_capacity.utility_feed_kw` | Utility feed is below the facility load at design PUE — confirm the utility upgrade, its cost, and its date. |
| `CC-MOD-DC-06` | warning | `dc_capacity.measured_pue == null \|\| dc_capacity.measured_pue <= dc_capacity.design_pue * 1.15` | Measured PUE more than 15% above design — the power pass-through economics are not what the design assumed. |
| `CC-MOD-DC-07` | warning | `dc_revenue.market_rent_per_kw_month == null \|\| rent_index >= 0.85` | Contracted rent more than 15% below market — verify the comp set or the lease vintage. |

`CC-MOD-DC-04` is a warning and not an error because pre-leasing future
phases is the normal hyperscale shape; the number is not wrong, it is
a schedule question. `CC-MOD-DC-05` likewise: utility upgrades pending
are common and are a cost line, not a defect.

### Example document

`examples/Mesa-Gateway-Data-Center-Mesa-AZ.uwx.md` — the Arizona
series already has one document per builtin class; this is the first
custom-class example, and it is deliberately imperfect the way the
hospitality fixture is: contracted load above commissioned (a
pre-leased phase 2) and a comp rent the contract runs under, so
`CC-MOD-DC-04` and `CC-MOD-DC-07` both fire on one file. The
`modules:` frontmatter entry is present, so `MOD-DEPENDENCY-UNDECLARED`
does not fire.

## Compatibility analysis

- **Existing `.uw.md` files** — no impact. Nothing changes for a
  builtin class; the enum is untouched (RFC 0003 note 1).
- **Tier-1 readers without the module** — a data-center document
  resolves `degraded` under `industrial` with `MOD-FALLBACK-001`. What
  such a reader shows: address, purchase price, NOI, debt, returns,
  the DCF — all correct. What it cannot show: any kW figure, and it
  will label `price_per_sqft` from the `industrial` layout if the
  document carries square footage, which for a powered shell is the
  misleading denominator this RFC exists to retire. The example
  document sets the property square footage to the *building*
  footprint and carries `raised_floor_sf` separately so that at least
  the number is not wrong, only unhelpful. This is the honest fallback
  and §X.2.3 already marks it degraded.
- **Tier-2 editors** — ordinary edit policies; the `dc_*` sections are
  ordinary sections.
- **Tier-3 calc hosts** — the module's calcs run through
  `evaluateModuleCalculations`; no core change unless the
  standard-section scope question (above) says otherwise, in which
  case the change is its own RFC.
- **Tier-4 agent hosts** — the §4.27-style prohibition on inventing
  terms applies by analogy: an agent MUST NOT invent a PUE, a
  redundancy topology, or a utility feed figure; the fields are
  `null`/absent until a source supplies them.
- **Modules** — manifest schema unchanged. This RFC is a *use* of the
  existing surface.

No spec change. Protocol and format versions do not move. The module
is published as `@uwmd/module-data-center@0.1.0`, the first module
package after hospitality; the release ritual's package list grows by
one.

## Conformance impact

New in `conformance/modules/runtime/` (beside the hospitality suite):

| Scenario | Pins |
|---|---|
| `02-data-center-fixture` | The module against its own example: eleven calcs compute (or nine, if the standard-section scope question closes "no"); `CC-MOD-DC-04` and `CC-MOD-DC-07` fire; no error. |
| `03-data-center-pue-below-one` | `design_pue: 0.85` → `CC-MOD-DC-01` (error). |
| `04-data-center-no-comp` | `market_rent_per_kw_month: null` → `CC-MOD-DC-07` silent, `rent_index` null. |
| `05-data-center-required-section` | `dc_capacity` removed → `MOD-SECTION-MISSING`. |
| `06-data-center-as-industrial` | The same file relabelled `asset_class: industrial` with no `modules:` — nothing from the module runs (the hospitality suite's "relabelled office" twin). |
| `07-data-center-fallback` | Module not loaded → `degraded`, `MOD-FALLBACK-001`, display name absent. This is the RFC 0003 resolution path on a *product* module, not the fixture one. |

Existing fixtures unchanged, including `conformance/modules/asset-classes/`.
`docs/wiki/13-status.md` gains a module row; `ROADMAP.md` gains the
0039 row.

## Reference implementation

- **Files:** `packages/uwmd-module-data-center/` (new; copy the
  hospitality package's `package.json`, `tsconfig*.json` and
  `scripts/emit-manifest.mjs` verbatim, then change names), the example
  document, the six runtime fixtures, `conformance/modules/README.md`
  table, `docs/wiki/13-status.md`, `ROADMAP.md`, the RFC index,
  `CHANGELOG.md`, `VERSIONS.md` (new package row), the release
  workflow's publish matrix (`.github/workflows/release.yml`) and
  `verify-versions` if it enumerates packages.
- **API surface:** the package's exports (`DATA_CENTER_MODULE_ID`,
  `DATA_CENTER_MODULE_VERSION`, `DATA_CENTER_MANIFEST`,
  `DATA_CENTER_VIEW_MODELS`). No change to `@uwmd/core` exports.
- **Test plan:** `index.test.ts` loads the manifest through the
  published `loadModule` / `createModuleRegistry`, resolves the
  example's class as `custom` with the module loaded and `degraded`
  without it, evaluates every calc against hand-worked figures
  (choose the example's numbers so every calc is an exact decimal:
  10,000 kW commissioned, 12,500 kW planned, 11,000 kW contracted,
  design PUE 1.25, $150/kW/month), asserts each validation on a
  document built to fire it, and asserts the manifest loads with zero
  `PROTO-MOD-*` issues. The build must emit `dist/manifest.json` and
  the emitted file must load standalone.
- **Effort:** small-to-medium. The package is mechanical after
  hospitality; the standard-section scope question is the only place
  discovery can happen.

## Implementation notes (deviations from the proposal)

Shipped 2026-09-09. The module is
[`@uwmd/module-data-center`](../../packages/uwmd-module-data-center/README.md);
the example is `examples/Mesa-Gateway-Data-Center-Mesa-AZ.uwx.md`; the
runtime scenarios are `conformance/modules/runtime/06-…11-…`. No spec
change; protocol and format versions do not move.

**1. Standard sections ARE in scope for a module formula — the one
expected discovery closed "yes".** `evaluateModuleCalculations` hands
`evaluateCalc` the whole parsed file, and the §VIII.2 resolver walks
frontmatter first (so `quick_metrics.purchase_price` resolves), then any
section by id (so `noi_model.*` resolves), then `prior_results`. Nothing
about the hospitality module's own-sections-only habit was a limit of
the runtime; it was a limit of hospitality. Both per-unit calcs ship,
pinned at $16,000/kW and $1,120/kW on the example, and no runtime RFC
follows. The second unresolved question (a module-declared per-unit
denominator) now has its evidence: the module's `price_per_commissioned_kw`
sits beside an empty standard `price_per_unit` slot, exactly as §X.2.4
intends, and nothing so far argues for `declares_size_intensive`.

**2. A declaring module was not scoped to its declared class — the
unexpected discovery, and the only core change.** `ModuleManifest.asset_classes`
is typed to the builtin enum (`PROTO-MOD-008` refuses a custom id there),
and the runtime's applicability filter read *only* that field, treating
its absence as "applies to every document". A module that declares a
custom class and lists no builtin — this one — therefore ran against
every file in the corpus and would have raised `MOD-SECTION-MISSING` for
`dc_capacity` on every office deal. This is the composition gap the
Motivation predicted ("required sections from the declaration versus
`required: true` on the section … is unverified"), one level down.
`applicableModules` in `module-runtime.ts` now treats
`declares_asset_classes[].id` as classes the module applies to, alongside
`asset_classes`; a module naming neither still applies to all. This is
not the standard-section widening the RFC forbade — it changes *when* a
class-declaring module runs, not *what* any manifest can read — and the
prior behaviour was not one any host could have wanted. Unit test in
`module-runtime.test.ts`; conformance `10-data-center-as-industrial`
pins it on the product module.

**3. `noi_model.net_operating_income`, not `noi_model.noi`.** The RFC
named a field the format does not carry. The `noi_model` section's NOI
field is `net_operating_income` (format §4, and every calc pack reads it
so); the calc reads that.

**4. Conformance scenarios are numbered `06`–`11`, not `02`–`07`.** The
RFC's table reused the hospitality suite's numbers; `runtime/02-…05-…`
already exist. The scenarios are otherwise the RFC's six, in its order,
and the runner now dispatches on `expected.module` across both packages
and accepts the RFC 0003 resolution keys (`expected_status`,
`known_declarations`, `load_module: false`) so the fallback scenario can
be asserted without a second suite.

**5. `07-data-center-pue-below-one` fires four codes, not one.** With
`design_pue: 0.85` and nothing else changed, the fixture's measured PUE
of 1.32 is now far more than 15% above design, so `CC-MOD-DC-06` fires
alongside `CC-MOD-DC-01`, and `DC-04`/`DC-07` fire as they do on the
fixture. Pinned as such rather than editing a second field to silence a
rule that is, in that scenario, correct.

**6. `requires_protocol: '>=2.5.0'` for a different reason than stated.**
The RFC said the fixture carries `dcf.returns.tax_basis`; the example
follows the industrial example's section set and carries no `dcf`. The
pin stays at 2.5.0 because the module's findings are read alongside the
RFC 0037 coverage channel and the RFC 0038 return basis, both of which
entered at 2.5.0.

**7. The package fixture and the example are one document.** RFC 0006
note 6 kept the hospitality fixture separate from the public hotel
example; here the example *is* the first custom-class example and the
fixture is its byte-identical copy, with a test that fails if they
drift. The conformance deal files are derived from it by one edit each.

**8. Not touched, by instruction:** `CHANGELOG.md` released blocks,
`VERSIONS.md` existing rows, and `.github/workflows/release.yml` (a
release branch is moving versions in parallel). `VERSIONS.md` gained the
one new package row; `verify-versions`, `verify-lockfile` and
`verify-packages` gained the one new entry each. The release workflow's
publish matrix is left for the release branch — the module is unpublished,
as hospitality is.

## Alternatives considered

1. **Add `data_center` to the builtin enum.** Rejected: it is the
   status quo RFC 0003 exists to end, and it would need a spec bump,
   a size-intensive registry entry, an Excel layout and a calc pack —
   the full builtin cost — for one vertical. The module route is what
   the format promised; if it cannot carry a data center, that is the
   finding.
2. **Extend the existing fixture module (`com.example.datacenters`)
   into the product.** Rejected: the fixture's value is that its four
   documents are byte-identical and its manifest is minimal, so the
   resolution verdict is visibly about the reader. Growing it into a
   real module would blur that demonstration, and `com.example` is
   not a namespace anyone should ship under.
3. **Model capacity in MW and rent in $/kW/month, as the market
   quotes them.** Rejected: mixed units invite a factor-of-1000 error
   that no rule can catch after the fact. One unit (kW) throughout,
   with the view models free to display MW.
4. **Carry the Uptime Institute tier (`tier_iii`, `tier_iv`) as a
   field.** Deferred (§Unresolved): "Tier III" is a certification
   mark as well as a design vocabulary, and most facilities that
   market a tier are not certified. The redundancy topology is the
   fact; the tier is a claim about it.
5. **Ship life sciences, manufactured housing and medical office in
   the same RFC.** Rejected for the RFC 0006 reason: one module proves
   the custom-class contract; build the rest against the proven
   contract. Data centers go first because they stress §X.2.4 (the
   per-unit denominator) hardest.

## Unresolved questions

- **Standard-section scope in module formulas.** ~~Whether
  `evaluateModuleCalculations` resolves `quick_metrics.purchase_price`
  and `noi_model.noi` for a module calc.~~ **Settled 2026-09-09: yes,
  with no runtime change** — see implementation note 1. Both per-unit
  calcs ship in 0.1.0.
- **A module-declared per-unit denominator.** If the two per-unit
  calcs work, a host still cannot show `price_per_unit` for a
  data-center file, because the §XIII registry does not know the
  class — so the standard per-unit slot stays empty while the module's
  own `price_per_commissioned_kw` sits beside it. That may be exactly
  right (§X.2.4's reasoning stands) or it may argue for a narrowly
  scoped `declares_size_intensive` on the declaration, gated to the
  declaring module's own class. Evidence first.
- **Uptime tier as a field.** See alternative 4. Proposed name if it
  lands later: `stated_uptime_tier` with `certified: boolean`, so the
  claim and the certification are separate facts.
- **Power revenue under `all_in` billing.** Under all-in or breakered
  billing the landlord earns a margin on power; `dc_power.power_margin`
  records it but no calc yet folds it into `blended_revenue_per_kw_month`
  because the mechanics differ by contract (margin on cost versus a
  fixed $/kW power charge). A `power_revenue_annual` field or calc is
  the likely follow-on once a document needs it.
- **Excel.** Custom classes get no Excel layout (§X.2.4). The
  hospitality module has one in `@uwmd/excel` because `hospitality` is
  a builtin; whether `@uwmd/excel` should accept a module-supplied
  layout is a separate question for whoever needs the workbook.

## Prior art

- **RFC 0003** (the declaration and resolution rules this exercises)
  and **RFC 0006** (the module shape, the null-is-not-false rule, TS
  as manifest source of truth — all adopted unchanged).
- **The Green Grid's PUE definition** (total facility energy ÷ IT
  equipment energy) — the vocabulary source for `design_pue` /
  `measured_pue`; PUE ≥ 1 by construction is `CC-MOD-DC-01`.
- **Uptime Institute Tier Standard: Topology** — the vocabulary behind
  the `redundancy` enum, referenced without adopting the tier marks.
- **Industry rent quoting convention** ($/kW/month on contracted
  critical load; capacity in MW) — the unit decision in alternative 3.
