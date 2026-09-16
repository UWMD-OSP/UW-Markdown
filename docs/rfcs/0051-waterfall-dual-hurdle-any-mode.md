---
rfc: 0051
title: 'Distribution waterfall dual-hurdle "any" mode (hurdle_mode: "any" | "both")'
status: implemented
accepted: 2026-09-15
author: jaredmaxey
created: 2026-09-13
depends_on:
  - 0035
  - 0036
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0051: Distribution waterfall dual-hurdle "any" mode

## Summary and boundary

Standard real-estate limited partnership agreements (LPAs) often hurdle a promote
split on achieving either an equity multiple or an internal rate of return,
whichever occurs first ("until 1.5x MOIC or 12% IRR, whichever occurs first").
RFC 0036 shipped IRR hurdles with "both must be met" semantics and reserved
`hurdle_mode: "any"` for future adoption.

This RFC lifts `hurdle_mode` into the normative contract for `distribution_waterfall`
(§4.27, Protocol §VIII.10):

- `hurdle_mode?: "both" | "any" | null` on `split` tiers;
- when omitted, defaults to `"both"` (the larger capacity governs, preserving
  complete backward compatibility);
- when set to `"any"`, the tier ends as soon as either hurdle is satisfied (the
  smaller capacity governs);
- stating `hurdle_mode` on a tier that does not state both `until_lp_em` and
  `until_lp_irr` is rejected as a grammar error (`WF-01`).

Clawback, crystallization, and GP-side hurdles remain outside this scope.

## Motivation

Under RFC 0035 and RFC 0036, a tier stating both `until_lp_em` and `until_lp_irr`
unconditionally required both hurdles to be met:

```json
{ "type": "split", "lp_share": 0.8, "gp_share": 0.2, "until_lp_em": 1.5, "until_lp_irr": 0.12 }
```

In a fast exit (e.g. year 1), a 12% IRR hurdle requires only $120,000 profit on
$1,000,000 capital, whereas a 1.5x EM hurdle requires $500,000 profit. Under
"both" semantics, the 1.5x multiple binds ($500,000 LP distribution). If the LPA
specified "or whichever is achieved first", the tier should have ended at
$120,000 LP distribution, stepping up the GP promote split earlier. Without
`hurdle_mode: "any"`, modeling this partnership agreement required manual tier
munging or was unrepresentable.

## Normative format change

In `UW_FORMAT_SPEC_v1.md` §4.27:

Add `hurdle_mode` as an optional field on `split` tiers:

- **Type:** `"both" | "any" | null`. Default: `"both"`.
- **Grammar rule (`WF-01`):** `hurdle_mode` MAY only appear on a `split` tier
  where **both** `until_lp_em` and `until_lp_irr` are non-null. A document that
  states `hurdle_mode` on a tier without both hurdles MUST be refused with
  `WF-01`.
- **Final tier rule:** The final tier MUST be an uncapped `split` (no hurdles, and
  therefore no `hurdle_mode`).

## Normative protocol change

In `UW_PROTOCOL_v1.md` §VIII.10 (Step 3: Hurdle balance and tier capacity):

For a `split` tier at row date $t$:
Let $C_{\text{EM}} = \max(0, \text{until\_lp\_em} \times \text{contributions} - \text{distributions}) / \text{lp\_share}$.
Let $C_{\text{IRR}} = \text{hurdleBalance}(\text{flows}, \text{until\_lp\_irr}, t) / \text{lp\_share}$.

1. If only `until_lp_em` is stated: $\text{cap} = C_{\text{EM}}$.
2. If only `until_lp_irr` is stated: $\text{cap} = C_{\text{IRR}}$.
3. If both are stated:
   - If `hurdle_mode` is `"any"`: $\text{cap} = \min(C_{\text{EM}}, C_{\text{IRR}})$.
   - If `hurdle_mode` is `"both"` or omitted: $\text{cap} = \max(C_{\text{EM}}, C_{\text{IRR}})$.

Both capacities floor at zero, so the resulting capacity is always non-negative.
When $\text{cap} = 0$, the tier is exhausted and pays nothing at this row.

## Schema changes

In `spec/schemas/section-distribution-waterfall.schema.json`, add `hurdle_mode` to
the `split` tier item schema:

```json
"hurdle_mode": {
  "type": ["string", "null"],
  "enum": ["both", "any", null],
  "description": "When both until_lp_em and until_lp_irr are stated, selects whether the tier ends when both hurdles are met ('both', default) or whichever is met first ('any'). Stating hurdle_mode without both hurdles is an error (WF-01)."
}
```

## Compatibility

1. **Additive and opt-in:** Existing documents omit `hurdle_mode` and evaluate
   identically under the default `"both"` semantics.
2. **Byte preservation:** Tier-2 editors preserve bytes outside modified tiers.
3. **No solver iterations:** Hurdle balances remain closed-form via
   $\text{hurdleBalance}$, ensuring IEEE-754 bit-exactness across runtimes.
