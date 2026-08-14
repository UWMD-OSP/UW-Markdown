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

Registry-level behavior (dependency load order, version-range satisfaction,
duplicate module ids) is asserted in `packages/uwmd-core/src/modules.test.ts`
rather than here, because a fixture file holds one manifest and those properties
are about how several interact.

`accept/` fixtures load against `tier-4-agent-host`, the maximal host, so they
assert manifest validity rather than host capability. Tier gating has its own
unit test.

Nothing here executes a module. v1 modules are declarative — formulas are parsed
and shape-checked at load, never run — and module signing (RFC 0002) and custom
asset-class identifiers (RFC 0003) remain v2 work.
