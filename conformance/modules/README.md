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

## `registry/` — two modules declaring one id (Protocol §VII.3)

Each scenario holds two or more synthetic manifests, `<key>.module.json`,
and an `expected.json` listing cases. A case names a load
`order`. It expects either a refusal, as the exact set of codes the registry
reports, or a loaded registry. A loaded registry is checked for which module's
declaration is in effect, and for calc values, view-model names and module
findings on the shared `registry/deal.uwx.md`, and optionally for calculation
evaluation order. Every manifest must also satisfy the schema and load alone,
so a refusal can only come from the interaction.

The runner reads ownership through the reference library's internal
`declarationOwnersOf`. The protocol gives a view model no consumer through
which an override would otherwise be observable, and the accessor is not
public API.

| Scenario | Pins |
|---|---|
| `01-section-unrelated` | Same section id, no dependency: `PROTO-MOD-080` in both orders. |
| `02-section-dependent` | B depends on A and makes the section optional: B's declaration applies, so there is no `MOD-SECTION-MISSING`. B listed first: `PROTO-MOD-027`. |
| `03-calculation-unrelated` | Same calculation id, no dependency: `PROTO-MOD-081` in both orders. Before §VII.3 was enforced, both loaded and registry order decided the value. |
| `04-calculation-dependent` | B declares `b_first`, then overrides `shared_calc` with `b_first * 10`. A's declaration is suppressed. B's runs once, where B declares it, so it reads `b_first` (20), and B's later `b_after` reads the override (21). Each module keeps its declaration order. A's later `a_after` does not read `shared_calc`, so the override is allowed. B listed first: `PROTO-MOD-027`. |
| `07-calculation-override-reader-refused` | As 04, but A declares `reads_shared = shared_calc + 10` after `shared_calc`. B's override would run after it and leave it with no value, so the registry refuses: `PROTO-MOD-083`. B listed first: `PROTO-MOD-027`. |
| `08-calculation-override-other-reader-refused` | B and C both depend on A. C reads `shared_calc`, and B overrides it. C does not depend on B, so it is not guaranteed to run after the replacement: `PROTO-MOD-083`, in the order A, C, B and in A, B, C. |
| `09-calculation-override-chain-reader-allowed` | C depends on B, the current owner, so it always runs after the replacement and reads B's value (3). |
| `10-override-scope-narrower-refused` | A applies to multifamily, and B overrides but applies only to hospitality. On the multifamily deal, neither declaration would run: `PROTO-MOD-084`. |
| `11-override-scope-covering-allowed` | B names no asset class, so it applies everywhere A does. Its declaration runs on the multifamily deal. |
| `05-view-model-unrelated` | Same view-model `section_id`, no dependency: `PROTO-MOD-082` in both orders. |
| `06-view-model-dependent` | B's view model is in effect. B listed first: `PROTO-MOD-027`. |

Against the registry before this suite existed, all six original scenarios fail.
