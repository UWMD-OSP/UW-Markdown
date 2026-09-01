---
rfc: 0008
title: Lease-up modeling section for value-add and ground-up deals
status: implemented
author: jared
created: 2026-04-27
revised: 2026-09-01
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0008: Lease-up modeling section for value-add and ground-up deals

> **Implemented 2026-09-01** at protocol **1.11.0**, exactly as revised below
> with two recorded refinements: (1) the verifier's issue codes are
> `LU-NCF-DISAGREES` / `LU-SUMMARY-DISAGREES` / `LU-UNEVALUABLE` (the
> `CS-SIZING-*` naming precedent — verifier codes share the family prefix but
> live outside `BUILTIN_REMEDIATIONS`, which registers validator codes only);
> (2) both unresolved questions below were resolved as leaned — one CC-15 seam
> (no `quick_metrics` cross-check; CC-01 already makes it transitive), and
> CC-15 reads only the `base` variant (falling back to the sole/default one).
> Types live in `lease-up.ts` beside the verifier, like `capital-stack.ts`,
> rather than `types.ts` as the file list below guessed.

> **Revised 2026-09-01** against everything implemented since the April draft.
> The core instinct survives untouched — the schedule is **data, not
> formulas**, so the Tier-3 no-iteration invariant is never in play. What
> changed: the section is classified as a **state-and-verify** structure with
> a deterministic three-state verifier (the RFC 0026 pattern, which did not
> exist in April; a variable-length period array is exactly the shape that
> pattern was built for); the proposed `CC-11` code was renumbered to `CC-15`
> because RFC 0019 took `CC-11` for the mixed-use class gate; structural rules
> get their own `LU-NN` family (the `MU-NN`/`CS-*` precedent), registered
> under the `validate` capability per RFC 0030; examples use the RFC 0031
> actor/resolution vocabulary; and the claim that the hospitality module
> shipped a `revpar_ramp` is corrected — it did not, so this section is the
> first period-schedule shape in the format and should be designed as the
> reusable one.

## Summary

Add a `lease_up_schedule` section (format spec **§4.25**) that models the
trajectory from current to stabilized rents over a defined window. Today the
format jumps straight from `rent_roll` (a snapshot in time) to `noi_model` (a
stabilized projection) with no structured representation of the path between
them. This RFC defines a section that captures monthly or quarterly periods
during the lease-up phase, the assumption set that drives them, and a
deterministic verifier for the stated figures.

## Motivation

Two of the most common scenarios in CRE underwriting cannot be cleanly
represented today:

1. **Value-add multifamily** — the buyer's `rent_roll` is the current snapshot
   but the underwritten NOI assumes 18 months of natural turnover at higher
   rents. The path from one to the other (turnover rate, market rent
   assumption, vacancy during lease-up, capex per unit) is the entire
   investment thesis, but there is no section to put it in.
2. **Ground-up development / lease-up of new construction** — there is no
   rent_roll at acquisition (the building doesn't exist yet); just a projected
   month-by-month absorption curve. Today this gets stuffed into `extensions`
   or `_notes` with no structure.

Without a normative section, every implementer reinvents the schema. The
Riverside office example had to put its lease-up assumptions in
`deal_context._notes` rather than a structured block.

## Proposed change

### Format spec (§4.25 — `lease_up_schedule`)

A **state-and-verify** structure, the same classification as `capital_stack`
(§4.24): the Tier-3 calc engine never reads it by pack formula, so a
variable-length period array is safe, and every stated aggregate is
recomputed by a deterministic verifier rather than by any sandbox primitive.
Multi-variant (like `operating_statement`), so base / upside / downside
scenarios coexist under `variant=`.

```json uw:section=lease_up_schedule variant=base source=manual ts=... v=1
{
  "_meta": { "source": "manual", "resolution": "user_input", "...": "..." },
  "model_type": "natural_turnover" | "absorption_curve",
  "period_granularity": "monthly" | "quarterly",
  "stabilization_target": "2027-Q4",
  "assumptions": {
    "monthly_turnover_rate": 0.04,
    "market_rent_psf_at_stabilization": 22.00,
    "vacancy_during_lease_up": 0.18,
    "concession_months_per_lease": 1,
    "tenant_improvement_psf": 35.00,
    "leasing_commission_rate": 0.06
  },
  "schedule": [
    {
      "period": "2026-Q3",
      "occupied_sf": 31000,
      "leased_sf": 31000,
      "in_place_rent_psf": 21.50,
      "market_rent_psf": 22.00,
      "vacancy_rate": 0.27,
      "rent_revenue": 166375,
      "concessions": -5400,
      "ti_lc_capex": -42500,
      "net_cash_flow": 118475
    }
  ],
  "stabilized_summary": {
    "occupied_sf": 40500,
    "occupancy_rate": 0.953,
    "annualized_egi": 858000,
    "annualized_noi": 478000
  }
}
```

Normative details the April draft left open, now pinned:

- **Rates are fractions** (`0.04`, not `4`), like everywhere else in the
  format — the draft's `*_pct` field names implied percent and are renamed.
- **Period grammar**: `YYYY-Qn` (quarterly) or `YYYY-MM` (monthly), uniform
  per schedule as declared by `period_granularity`, strictly increasing,
  gap-free. A schedule that skips a quarter is asserting something it does
  not say.
- **`model_type` gates nothing structurally** — `natural_turnover` with no
  `rent_roll` in the file is a warning (`LU-04`), not a refusal, because a
  compose-time fragment may carry the schedule without the roll.
- **Multi-variant** via the existing `MULTI_VARIANT_SECTIONS` mechanism;
  variant names are free-form (`base`, `downside`), not enumerated.

### The verifier (`verifyLeaseUpSchedule`)

A sibling of `verifyCapitalStack` / `verifyRollup`: three-state
(`verified` / `failed` / `unverifiable`), quantized per §VIII.5 before
comparison, over a **fixed, closed recompute vocabulary**:

- Each period's `net_cash_flow` = `rent_revenue + concessions + ti_lc_capex`
  (all stated; a period omitting a component is `unverifiable` for that row,
  not `failed`).
- `stabilized_summary.occupied_sf` and `occupancy_rate` against the final
  period (`occupancy_rate` needs a size denominator — resolved via the §XIII
  size-intensive registry, which is what it exists for; no denominator →
  `unverifiable`).
- Period-grammar and monotonicity violations are validator errors (`LU-NN`),
  not verifier findings — structure is validation, arithmetic is
  verification.

### Validator codes

New **`LU-NN`** family (registered in `VALIDATOR_CODE_FAMILIES` under
`validate`, per RFC 0030 §III.6a — same registration shape `SRC-NN` used):

| Code | Severity | Trigger |
|---|---|---|
| `LU-01` | error | A `period` outside the grammar, or mixed granularity within one schedule. |
| `LU-02` | error | Periods not strictly increasing, or gapped. |
| `LU-03` | error | Empty `schedule`, or `stabilization_target` earlier than the first period. |
| `LU-04` | warning | `model_type: natural_turnover` with no `rent_roll` present in the document. |

And one cross-section check, **`CC-15`** (the draft's `CC-11` was taken by
RFC 0019):

> The final `schedule` period MUST agree with `noi_model`'s stabilized
> figures within the declared tolerance `LEASE_UP_STABILIZED_TOLERANCE`
> (2%, a named exported constant). Disagreement emits `CC-15`, severity
> `warning`.

The tolerance is deliberate and documented, not a softness: unlike `CC-01`
(one number restated in two places, exact by RFC 0023), the schedule's final
period and `noi_model` are **two different models** of stabilization — a
trajectory endpoint and a stabilized-year projection — and demanding exact
agreement would force producers to hand-tune one to echo the other,
destroying the independent-model signal the check exists to read.

### Calc engine

**Unchanged — this is the load-bearing feasibility fact.** The schedule is
stated data; the existing path traversal
(`lease_up_schedule.schedule[5].rent_revenue`) and variadic `sum()` let a
custom calculation read specific cells. No iteration, no time axis, no new
builtins, no grammar change — consistent with the standing rule that new
calc capabilities ship as declarations and overrides, never grammar
extensions. The hold-period cash-flow primitive some future work may want
(the capital-stack waterfall's blocker) is **not** needed here and stays out
of scope.

### Deliberately deferred

- **Excel emit** — the RFC 0007 precedent: there is no ad-hoc lease-up
  renderer to replace, so a Lease-Up sheet is additive future work, not part
  of this RFC.
- **`dcf` coupling** (`derive_dcf_from_lease_up`) — useful, adds coupling;
  define the data shape first (the April draft's own recommendation, kept).
- **Defaults-table entries** — lease-up assumptions are the deal thesis, not
  defaultable background; nothing enters the cascade tables.
- **A shared period-schedule primitive** — if the hospitality module later
  wants a RevPAR ramp, it should reuse this section's period grammar; noted
  so the two cannot drift, but no abstraction is built ahead of the second
  consumer.

## Compatibility analysis

- **Existing `.uwx.md` / `.uw.md` files** — unaffected; the section is
  opt-in, and no stage requires it (`STAGE_REQUIREMENTS` untouched — a
  stabilized acquisition legitimately has no lease-up story).
- **Tier-1 Reader** — additive; unknown-section rendering already covers it,
  and a view model ships for readers that want structure.
- **Tier-2 Editor** — additive; opaque-JSON editing works today.
- **Tier-3 Calc Host** — additive; path traversal over the existing AST.
- **Tier-4 Agent Host** — additive. Agents MAY write the section; the host
  stamps `agent/<id>` + `resolution` per RFC 0031.
- **Modules** — extension sections coexist; a module lease-up section keeps
  working.
- **Receipts** — untouched; the verifier is document-level like
  `verifyCapitalStack`, not a receipt amendment.

## Conformance impact

New named suite `conformance/lease-up/` (the `capital-stack` precedent),
plus Tier-1 rejections:

- `valid/value-add-turnover/` — 24-month natural-turnover multifamily;
  verifier `verified`, no `CC-15`.
- `valid/ground-up-absorption/` — absorption curve with no `rent_roll`;
  parses clean, no `LU-04` (model_type is `absorption_curve`).
- `verify/stated-sum-disagrees/` — a period's `net_cash_flow` off by one
  cent post-quantization → `failed`.
- `verify/missing-denominator/` — no size intensive resolvable →
  `unverifiable`, distinct from `failed`.
- `reject/` — one fixture per `LU-01`…`LU-03`; `LU-04` and `CC-15` as
  warning fixtures.

## Reference implementation

- `spec/UW_FORMAT_SPEC_v1.md` — new §4.25 + §5.3 rows for `CC-15`/`LU-NN`.
- `spec/schemas/section-lease-up-schedule.schema.json` — new.
- `packages/uwmd-core/src/types.ts` — `LeaseUpSchedule`, `LeaseUpPeriod`.
- `packages/uwmd-core/src/lease-up.ts` — `verifyLeaseUpSchedule` (+ sibling
  test), `LEASE_UP_STABILIZED_TOLERANCE`.
- `packages/uwmd-core/src/validator.ts` — `LU-01`…`LU-04`, `CC-15`.
- `packages/uwmd-core/src/protocol.ts` — remediations, `LU` family
  registration, §4.25 view model, `MULTI_VARIANT_SECTIONS` entry.
- `packages/uwmd-core/src/renderer.ts` — period table in chat/summary.
- Protocol version: minor bump (new normative codes + verifier contract).

## Alternatives considered

1. **Stuff lease-up into `assumptions`.** Rejected — assumptions are scalars;
   a period schedule is tabular and gets crushed.
2. **`x_lease_up` extension.** Rejected — every implementer reinvents the
   schema; this is the promote-to-standard case (Appendix C.7).
3. **Extend `noi_model` with pre-stabilization periods.** Rejected — conflates
   the snapshot model with the trajectory model.
4. **A calc-engine time axis / iteration primitive.** Rejected here as it was
   for the capital stack: state-and-verify expresses the schedule without
   widening the sandbox, and the corpus keeps its static-analyzability.

## Unresolved questions

- Should `stabilized_summary.annualized_noi` also cross-check against
  `quick_metrics.noi_underwritten` (a second `CC-15`-style row), or is one
  tolerance-checked seam enough? Leaning one seam — `noi_model` already
  reconciles to `quick_metrics` via `CC-01`, so a second check would be
  transitive noise.
- Variant semantics for `CC-15`: check every variant against `noi_model`, or
  only `base`? Leaning: only the variant named by a new optional
  `noi_model`-side pointer, defaulting to `base` — a downside scenario is
  *supposed* to disagree with stabilized NOI.

## Prior art

- Argus's "Tenant Schedule" + "Vacancy Allowance" curves model the same
  trajectory with tighter cash-flow coupling.
- Excel underwriting models almost universally have a "Lease-Up" tab; this
  RFC gives that tab a normative schema.
- `capital_stack` (§4.24) — the in-repo precedent this section's
  classification, verifier shape, and variable-length-array safety argument
  are copied from.
