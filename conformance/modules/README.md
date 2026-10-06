# Module manifest conformance fixtures

Recorded fixtures for the v1 declarative module loader (`modules.ts`). Run with:

```bash
npm run conformance -- --tier=modules
```

The suite runs by default alongside the other tiers. It needs no network and no
API key.

## What each fixture asserts

Every fixture is checked twice.

**1 — Loader verdict.** `accept/` manifests must load. `reject/` manifests must
be refused, and every code listed in the sibling `.expected.json` must actually
appear in the reported errors. Extra codes are permitted; missing ones fail.
Codes are matched, not messages, so wording can be improved without touching
fixtures.

**2 — Schema parity.** The same manifest is validated against the normative
[`spec/schemas/module-manifest.schema.json`](../../spec/schemas/module-manifest.schema.json)
with ajv, and the two verdicts must agree.

Parity is the point of this suite. `@uwmd/core` cannot depend on a JSON Schema
validator — the layering invariant admits only the Anthropic SDK as a runtime
dependency — so the loader is hand-written and can drift from the normative
document with nothing to notice. It had. When this suite was written the loader
and the schema disagreed on **seven of eight** probes: `sections`, `view_models`,
and `agent_layers` had no runtime validation at all, unknown keys were accepted
everywhere, and `id` ignored the schema's minimum length. The `deal_stages` enum
had also gone stale in the other direction, omitting the `scope` stage that
shipped in the v1.1 train.

ajv is a root devDependency and the conformance runner is a root script, so this
costs nothing at runtime and does not touch the package's dependency graph.

## Declared divergences

A `reject/` fixture may set `schema_divergence` in its `.expected.json` when the
loader is deliberately stricter than JSON Schema can express. This is the *only*
permitted disagreement, it is always in the same direction — loader refuses,
schema accepts — and each instance must state its reason in the fixture.

Two exist today:

| Fixture | Why the schema cannot express it |
|---|---|
| `08-nondeterministic-calc` | JSON Schema can type `deterministic` as boolean but cannot require the value `true`. |
| `09-unparseable-formula` | JSON Schema cannot parse the safe-expression grammar; only the loader can tell whether a formula is well-formed. |

A divergence in the opposite direction — loader accepts, schema refuses — is
always a bug, and the suite fails on it with no opt-out.

## What this suite does not cover

Dependency load order, version-range satisfaction and duplicate module ids are
asserted in `packages/uwmd-core/src/modules.test.ts` rather than here, because
a fixture file holds one manifest and those properties are about how several
interact. Protocol §VII.3 declaration conflicts are the exception: see
`registry/` below.

`accept/` fixtures load against `tier-4-agent-host`, the maximal host, so they
assert manifest validity rather than host capability. Tier gating has its own
unit test.

Nothing in `accept/` or `reject/` executes a module: those fixtures assert that
a manifest *loads*. Module signing is under `../signing/modules/` (RFC 0002) and
custom asset-class *resolution* under `asset-classes/` (RFC 0003).

## `runtime/` — a loaded module doing something

The suite that runs modules (RFC 0006). Each `<scenario>/` holds a
`deal.uwx.md` and an `expected.json` naming the package under test in
`module`; the runner imports that package the way any host would, builds a
registry from it, and asserts `expected_calcs` (by id, exact value, `null`
for "inputs absent") and `expected_codes` (the full set of module findings,
`MOD-SECTION-MISSING` included). A scenario may also assert the RFC 0003
resolution verdict with the same keys as `asset-classes/` (`expected_status`,
`expected_fallback`, `expected_issue_code`, `expected_display_name`) and may
run with the module *not* loaded (`load_module: false`, the declaration held
out of band via `known_declarations: true`).

| Scenario | Module | Pins |
|---|---|---|
| `01-hospitality-fixture` | `@uwmd/module-hospitality` | Five calcs; `CC-MOD-HOSP-01` and `-03`; no error. |
| `02-no-comp-set` | hospitality | `market_revpar: null` → `revpar_index` null, `CC-MOD-HOSP-01` silent. |
| `03-occupancy-as-percent` | hospitality | `occupancy: 72` → `CC-MOD-HOSP-02` (error); RevPAR still computes, 100x too large. |
| `04-required-section-missing` | hospitality | `hotel_metrics` removed → `MOD-SECTION-MISSING`; `-03` still fires. |
| `05-wrong-asset-class` | hospitality | Relabelled `office` → nothing runs. |
| `06-data-center-fixture` | `@uwmd/module-data-center` | Eleven calcs, including `price_per_commissioned_kw` and `noi_per_commissioned_kw` read from the **standard** sections; `CC-MOD-DC-04` and `-07`; no error. |
| `07-data-center-pue-below-one` | data-center | `design_pue: 0.85` → `CC-MOD-DC-01` (error); `-06` follows, since measured 1.32 is now far above design. |
| `08-data-center-no-comp` | data-center | `market_rent_per_kw_month: null` → `rent_index` null, `CC-MOD-DC-07` silent. |
| `09-data-center-required-section` | data-center | `dc_capacity` removed → `MOD-SECTION-MISSING`; capacity calcs null; `-07` still fires from `dc_revenue`. |
| `10-data-center-as-industrial` | data-center | Relabelled `industrial`, no `modules:` → nothing runs, no `MOD-SECTION-MISSING` for the block still present. |
| `11-data-center-fallback` | data-center | Module not loaded, declaration held → `degraded`, fallback `industrial`, `MOD-FALLBACK-001`, no display name. |

The two families differ in one thing that matters: hospitality is a
*builtin* class the module enhances (`asset_classes: ['hospitality']`), and
the data center is a *declared* class (`declares_asset_classes`, RFC 0003)
the module owns. `10-…` is the scenario that pins the runtime scoping a
declaring module to its declared class — the gap RFC 0039 found.

## `registry/` — declaration conflicts and overrides (Protocol §VII.3, RFC 0074)

Each scenario holds two or more synthetic manifests, `<key>.module.json`,
and an `expected.json` listing cases. A case names a load `order` and
expects either a refusal, as the exact set of codes the registry reports, or
a registry that loads. Every manifest must also satisfy the schema and load
alone, so a refusal can only come from the interaction.

A loaded case may also assert the following against the shared
`registry/deal.uwx.md`:

- `expected_owners`: which module's declaration is in effect, per namespace;
- `expected_evaluation_order`: the module calculation outcomes, in order;
- `expected_calcs`: calculation values;
- `expected_view_model_display_names`;
- `expected_codes`: the module findings.

The runner also fails any case that evaluates one calculation id twice.

Ownership is read through the reference library's internal accessor
(`declarationOwnersOf` in `dist/modules.js`). The protocol gives view
models no consumer through which an override is otherwise observable, and
the accessor is deliberately not public API. Another implementation maps the
assertion onto its own registry.

**Protocol floor.** Under Protocol §X (RFC 0074 P6), a manifest that
redeclares an id declared by a module it names in `depends_on` must declare
a `requires_protocol` floor at the first release containing RFC 0074. Most
scenarios from 05 on contain such a manifest. That release is not yet
chosen, so these fixtures use `>=1.0.0`, and release preparation raises
them.

| Scenario | Pins |
|---|---|
| `01-section-unrelated` | Same section id, no dependency: `PROTO-MOD-080` in both orders. |
| `02-calculation-unrelated` | Same calculation id, no dependency: `PROTO-MOD-081` in both orders. Before §VII.3 was enforced, both loaded and registry order decided the value. |
| `03-view-model-unrelated` | Same view-model `section_id`, no dependency: `PROTO-MOD-082` in both orders. |
| `04-sibling-dependents-unrelated` | B and C both depend on A but not on each other, so they are unrelated: `PROTO-MOD-081` in both orders. |
| `05-dependent-pair-not-a-conflict` | B depends on A: B's section, calculation and view model are all in effect, and the calculation is evaluated once. B listed first: `PROTO-MOD-027`. |
| `06-section-override` | B makes A's required section optional: no `MOD-SECTION-MISSING`. |
| `07-calculation-override` | The replacement runs where B declares it: A's calculations, then `b_first`, `shared_calc` = 20, `b_after` = 21. |
| `08-view-model-override` | B's view model is in effect. |
| `09-override-dependency-later-reader-refused` | A reads `shared_calc` after declaring it: `PROTO-MOD-083`. |
| `10-override-sibling-reader-refused` | Another dependent of A reads `shared_calc`: `PROTO-MOD-083` in both valid orders. |
| `11-override-reader-depends-on-overrider` | C depends on the overriding module, so it reads the replacement. |
| `12-override-scope-narrower-refused` | The override applies to a disjoint class: `PROTO-MOD-084`. |
| `13-override-scope-covering-allowed` | Unscoped and broader overrides both load. |
| `14-override-reads-before-own-refused` | B reads `shared_calc` before its own replacement: `PROTO-MOD-083`. |
| `15-unrelated-reader-refused` | A reader with no dependency on the overriding module: `PROTO-MOD-083` in every order, including listed before the dependency. |
| `16-transitive-only-pair-refused` | A and C declare `shared_calc`, and C names only B: `PROTO-MOD-081` (P1.4). |
| `17-override-text-not-a-read` | `shared_calc` as a string, later segment, bracket key and period-path head is not a read, so the override loads. |
| `18-override-scope-section-refused` | Scope applies to a section override: `PROTO-MOD-084`. |
| `19-override-scope-view-model-refused` | Scope applies to a view-model override: `PROTO-MOD-084`. Split from 18 because refusals compare code sets. |
| `20-override-self-read-refused` | The replacement reads its own id (`x = x * 10`): `PROTO-MOD-083`. |
| `21-chain-override-dependent-reader-refused` | C overrides B while D, a dependent of B, reads the id: `PROTO-MOD-083` in both valid orders. |
| `22-override-past-current-owner-refused` | Two dependents of A both redeclare A's id: `PROTO-MOD-081` in either order (P1.2, P1.3). |
| `23-first-declarer-earlier-reader-allowed` | A reads the id before declaring it, the one exemption: the override loads. |
| `24-override-scope-narrower-and-unscoped-refused` | A narrower override, and a scoped override of an unscoped module: `PROTO-MOD-084` each. |

Against the registry before #267, scenarios 01–04 fail. Against the registry
before RFC 0074, scenarios 05–24 fail, except 22, a sibling refusal #267
already made.
