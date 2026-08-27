# @uwmd/module-hospitality

The **reference module** for [UW Markdown](https://uwmd.org) — the
implementation of [RFC 0006](../../docs/rfcs/0006-hospitality-module.md), and
the first real consumer of the protocol §X module system.

It does two things, and the first is why the second exists.

**1. It proves the module contract works for an external module.**
`ModuleManifest` and its friends were specified and never loaded by anything
that shipped, so every assumption in the types was unverified. This package is
built against the published surface of `@uwmd/core` — no privileged access, no
internal imports — because a reference module that reached inside the library
would demonstrate nothing about what an external author can actually do.

**2. It makes hospitality first-class.** The `hospitality` asset class is in the
v1 enum, but the standard sections have nowhere to put ADR, occupancy, brand
fees, or F&B. Today a hotel deal stuffs them into `noi_model.other_income` and
loses the structure — the exact loss the module system exists to prevent.

Why a module rather than new standard sections: the same argument would then
apply to gas stations, life sciences, and data centers, and the standard would
grow a section per vertical for whoever asked most recently.

## Use

```ts
import { createModuleRegistry, evaluateModuleCalculations, validateAgainstModules, parseUWFile } from '@uwmd/core';
import { HOSPITALITY_MODULE } from '@uwmd/module-hospitality';

const registry = createModuleRegistry({
  modules: [HOSPITALITY_MODULE],
  hostTier: 'tier-3-calc-host',
});

const parsed = parseUWFile(source);
const calcs = evaluateModuleCalculations(parsed, registry);
const issues = validateAgainstModules(parsed, registry);
```

Hosts without a TypeScript toolchain read `dist/manifest.json`, which is
generated from the typed manifest at build time so the two cannot disagree.

## What it contributes

**Sections.** `hotel_metrics` (required), `hotel_brand`,
`hotel_food_beverage`. Each carries a JSON Schema. Core checks *presence* of
required sections; it does not validate contents against the schema, because
`@uwmd/core` takes no JSON Schema dependency — see the layering invariant. A
host that already has a validator should apply the schema itself.

**Calculations**, in declaration order, each seeing the ones before it:

| id | Formula |
|---|---|
| `revpar` | `adr × occupancy` |
| `total_room_revenue` | `adr × occupancy × available_room_nights` |
| `room_revenue_per_key` | `total_room_revenue ÷ key_count` |
| `revpar_index` | `revpar ÷ market_revpar` |
| `fb_gross_margin` | `(fb_revenue − fb_cogs − fb_labor) ÷ fb_revenue` |

Order is load-bearing — `revpar_index` divides `revpar`, so `revpar` must be
declared first.

**Validations.** Each rule asserts what must be **true**, and fires when it
evaluates to `false`:

| Code | Severity | Catches |
|---|---|---|
| `CC-MOD-HOSP-01` | warning | RevPAR more than 15% below the comp set. |
| `CC-MOD-HOSP-02` | error | Occupancy stored as a percentage (`72`) rather than a fraction (`0.72`). |
| `CC-MOD-HOSP-03` | warning | Total franchise fee burden over 13% of room revenue. |

A rule that evaluates to `null` stays **silent**. A document carrying no
`hotel_brand` has not violated a rule about franchise fees; it has said nothing
about them, and reporting absence as violation would fire every module rule on
every partial file — which is most files, most of the time. `CC-MOD-HOSP-01`'s
explicit `market_revpar == null` guard is the same idea: without it, every hotel
without an STR report would carry a permanent underperformance warning.

## Occupancy is a fraction

`0.72`, never `72`. This is the format-wide rule for every rate, and it is
called out here because hotel operators say "72" and a module that accepted it
would let a 100× error through every downstream calculation.
`CC-MOD-HOSP-02` is an **error**, not a warning, for that reason — and note
that `revpar` still *computes* from a percentage, to a number a hundred times
too large. Only the rule catches it.

## The fixture

`test/fixtures/boutique-hotel-austin.uwx.md` is an 80-key property on South
Congress, and it is deliberately **not** a clean deal: RevPAR runs below the
comp set and the flag's fee burden is over 13%, so both warning rules fire and
both branches are covered by one file. The
[`conformance/modules/runtime/`](../../conformance/modules/runtime/) suite
derives four more scenarios from it — no comp set, occupancy as a percentage,
the required section removed, and the same file relabelled as office (where the
module must not run at all).

MIT. Part of the [UW Markdown](https://github.com/UWMD-OSP/UW-Markdown) monorepo.
