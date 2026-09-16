---
rfc: 0059
title: 'Waterfall clawback as a terminal true-up'
status: implemented
accepted: 2026-09-16
implemented: 2026-09-16
author: claude
created: 2026-09-16
depends_on:
  - 0035
  - 0036
  - 0051
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0059: Waterfall clawback as a terminal true-up

## Summary

RFC 0035 shipped the distribution waterfall and deferred clawback. RFC 0036
added IRR hurdles and deferred it again, noting that an IRR ladder makes it
*more* pressing: a promote paid on an interim hurdle can later un-earn itself.
Protocol §XVI records the expected shape — "a terminal true-up tier, not
per-period state."

This contract implements that shape. It adds an optional `clawback` provision to
`distribution_waterfall` and a stated `clawback_amount` outcome verified against
a closed-form recomputation. It introduces no iteration, no per-period
crystallization state, and no GP-side hurdle.

It extends the existing `WF-NN` family rather than opening a new one.

## Motivation

The waterfall verifier already walks return-of-capital → preferred → catch-up →
split over a §4.26 dated series and recomputes `promote_total`, `profit_total`
and each party's `moic` / `xirr` (`packages/uwmd-core/src/waterfall.ts`). What
it cannot express is the provision that governs what happens when that walk
overpays the GP.

The overpayment is not hypothetical, and RFC 0036 named the mechanism precisely.
A deal distributes strongly in years 2–4, clears a 12% IRR hurdle, and pays
promote. A weak exit in year 7 drags the LP's final IRR to 9%. The LP's
lifetime position now sits below the hurdle the promote was paid on. Every
institutional LP agreement in this shape carries a clawback; the document has
no way to say so, and no way to record the amount.

Concretely, today:

- `stated_outcomes` can claim `promote_total: 4,180,000` and the verifier will
  confirm the walk produces it — while the LP's own `xirr` in the same object
  sits below the hurdle that promote was earned on, and nothing connects the two.
- A reviewer reading the document cannot tell whether the promote is final or
  subject to return.
- The single most negotiated term in the LP agreement — whether the clawback is
  net of tax, and whether it is capped at promote received — is unrecordable.

## Proposed change

### Format §4.27 — the `clawback` provision

Add an optional object on `distribution_waterfall`:

```json
"clawback": {
  "basis": "lp_preferred_shortfall | lp_irr_floor | lp_em_floor",
  "floor_rate": 0.12,
  "floor_multiple": null,
  "net_of_tax_rate": 0.37,
  "cap": "promote_received"
}
```

Normative rules:

- `basis` is a **closed vocabulary**.
  - `lp_preferred_shortfall` — the floor is the LP's return of capital plus the
    preferred return already declared by the `preferred_return` tier. No extra
    input; refuse with `WF-11` if the waterfall has no such tier.
  - `lp_irr_floor` — `floor_rate` REQUIRED, a fraction in `(0, 1)`.
  - `lp_em_floor` — `floor_multiple` REQUIRED, a number `> 1`.
- `cap` is `"promote_received"` and no other value. A GP cannot owe back more
  than it was paid; a provision that says otherwise is a different instrument
  and is out of scope. Stating any other value is `WF-12`.
- `net_of_tax_rate`, when stated, is a fraction in `[0, 1)` and is **stated,
  not derived**. This RFC does not model the GP's tax position; it records the
  rate the agreement names and applies it arithmetically.

### `stated_outcomes.clawback_amount`

```json
"stated_outcomes": {
  "promote_total": 4180000.0,
  "clawback_amount": 612400.0
}
```

### Verification — closed form, step 5 of the §VIII.10 walk

After the existing walk completes, and only when `clawback` is present:

1. Compute the LP's **floor requirement** at the terminal date:
   - `lp_preferred_shortfall` → LP contributions plus accrued preferred at the
     declared tier's rate and accrual, which the walk already computes;
   - `lp_em_floor` → `floor_multiple × lp_contributions`;
   - `lp_irr_floor` → the RFC 0036 **hurdle balance**,
     `B = −xnpv(F, h) · (1 + h)^t`, evaluated over the LP's dated flows at the
     terminal row. This is the same closed form RFC 0036 uses for `until_lp_irr`
     and is reused verbatim. **No bisection, no iteration on `xirr`.**
2. `shortfall = max(0, floor_requirement − lp_distributions_total)`.
3. `gross_clawback = min(shortfall, promote_total)` — the `cap`.
4. `clawback_amount = gross_clawback × (1 − net_of_tax_rate)` when the rate is
   stated, otherwise `gross_clawback`.
5. Compare to `stated_outcomes.clawback_amount` at the currency quantum
   (`WATERFALL_VERIFY_DECIMALS.currency`, 2dp), consistent with every other
   figure the verifier checks.

That the whole computation is closed-form matters: the calc engine has no
iteration, and a clawback design that needed a nested solve would be
unreachable. Reusing RFC 0036's hurdle balance is what makes the IRR basis
implementable at all.

### Validator codes (extending `WF-NN`)

| Code | Severity | Refuses |
|---|---|---|
| `WF-10` | error | A `basis` outside the closed vocabulary, or a basis missing its required input |
| `WF-11` | error | `lp_preferred_shortfall` on a waterfall with no `preferred_return` tier |
| `WF-12` | error | A `cap` other than `"promote_received"` |
| `WF-13` | error | `net_of_tax_rate` outside `[0, 1)`, or stated as a percent |
| `WF-15` | warning | A `clawback` provision on a waterfall whose series has no terminal distribution — the provision is unexercisable as stated |

**Erratum (implementation).** The draft above also specified `WF-14` for a
`clawback_amount` that disagrees with the recomputation. That code was not
implemented and should not be: the waterfall splits validator codes (`WF-01`–
`WF-03`, structure) from verifier issue codes (`WF-OUTCOME-DISAGREES`,
arithmetic), and a stated-figure disagreement is squarely the latter. Adding a
`WF-NN` for it would have created a second, parallel spelling of a refusal the
verifier already reports. A stated amount on a waterfall with **no** provision
is likewise `WF-UNEVALUABLE` rather than a failure — there is no recomputed
figure to disagree with. This is the same class of erratum RFCs 0034–0036
recorded against their own drafts.

### Library surface

No new export. `verifyWaterfall` gains the step; `WaterfallStatedOutcomes` gains
`clawback_amount?: number | null`; a `DistributionWaterfall.clawback?` field is
added. All additive.

## Compatibility analysis

- **Existing `.uw.md` files** — unaffected. A waterfall with no `clawback`
  behaves byte-identically and takes exactly the path it takes today; the step
  is gated on the provision's presence. One conformance fixture proves it.
- **Existing implementers** — Tier-1 and Tier-2 unaffected. A Tier-3 Calc Host
  that implements §VIII.10 must add step 5 to stay conforming for documents
  that use it; documents that do not use it are unchanged. Tier-4 agents may
  state the amount but never compute it (invariant 1).
- **Modules** — no manifest change.
- **Protocol** — additive: §VIII.10 gains step 5, `WF-NN` gains six codes.
  Minor bump.
- **Excel parity** — the clawback is a single terminal figure, not a schedule
  row, so the one-pack-drives-both invariant is satisfied by emitting it as a
  stated cell. No new rounding boundary: it quantizes at the same `round_to`
  as every other currency figure in the verifier.

## Conformance

- One engine-produced fixture per basis (`lp_preferred_shortfall`,
  `lp_irr_floor`, `lp_em_floor`) where a clawback is genuinely owed.
- One fixture where the LP clears its floor and the clawback is exactly zero —
  the case most likely to be got wrong by an implementer who forgets the
  `max(0, …)`.
- One fixture where the shortfall exceeds promote received, proving the cap
  binds.
- One `net_of_tax_rate` fixture.
- One absent-case fixture proving an unchanged waterfall verifies as before.
- One fixture per refusal `WF-10`–`WF-14`, plus the `WF-15` warning.

Delete nothing: unlike RFC 0036, this RFC retires no reserved-and-refused
fixture, because clawback was deferred in prose rather than reserved in syntax.

## Alternatives considered

1. **Per-period crystallization state.** Rejected, and RFC 0035 rejected it
   first. Tracking crystallized versus at-risk promote per distribution needs
   state the walk does not carry and produces a different answer depending on
   when the reader stops. The terminal true-up is what LP agreements actually
   settle on.
2. **Bisection on the clawback amount.** Rejected. It was the obvious design
   before RFC 0036 produced the closed-form hurdle balance; with that in hand,
   iteration buys nothing and costs determinism. This is the same erratum RFC
   0036 recorded against RFC 0035's own sketch.
3. **A `clawback` tier in the tier list.** Rejected. Tiers consume cash moving
   forward; a clawback moves cash backward after the last row. Modelling it as
   a tier would put a negative distribution in the schedule and break the
   `by_tier` invariants.
4. **GP-side hurdles (`until_gp_irr`) in the same RFC.** Rejected as
   uncoordinated scope. §XVI deliberately left `until_gp_irr` out rather than
   reserved; it deserves its own contract.

## Unresolved questions

- **Interim clawback escrows.** Many agreements escrow a share of promote
  rather than relying on a terminal claim. That is a sources-and-uses / reserve
  question adjacent to RFC 0056's escrow vocabulary, and is deliberately out of
  scope here. Whether it should be reserved-and-refused now, the `HDG-02`
  posture, or simply left unnamed, is a reviewer call.
- **Whether `WF-15` should be an error.** A clawback on a waterfall with no
  terminal distribution is arguably as unreviewable as `WF-02`'s missing cash
  vector. Proposed as a warning because the provision may be legitimately
  stated ahead of the exit.
- **Tax gross-up beyond a flat rate.** Real agreements sometimes use the
  highest marginal rate then in effect rather than a stated one. Proposed:
  carry the stated rate only, consistent with this project's refusal to model
  tax positions.
