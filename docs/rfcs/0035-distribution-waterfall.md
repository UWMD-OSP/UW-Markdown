---
rfc: 0035
title: Distribution waterfall — state-and-verify promote, pref, and catch-up over a dated series
status: draft
author: jaredmaxey
created: 2026-09-02
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0035: Distribution waterfall — state-and-verify promote, pref, and catch-up over a dated series

> The third leg of the sequencing RFC 0026 §E wrote down: *(1) this RFC —
> stack + sizing + pref return/accrual; (2) a hold-period cash-flow RFC
> that gives the format a multi-period series; (3) the waterfall RFC
> that states-and-verifies distributions over it.* Legs 1 and 2 are
> implemented (RFCs 0026 and 0034). This is leg 3, built exactly on the
> shape §E prescribed and on §VIII.9's day counts and `xirr`.

## Summary

Register a `distribution_waterfall` section (§4.27): the tiered split
of a deal's equity cash flows between an aggregate **LP** and the
**GP** — return of capital, a preferred return accrued under a §VIII.9.1
day count, a GP catch-up, and residual promote splits with optional
equity-multiple hurdles — as the **fourth state-and-verify structure**.
The section names a `cash_flow_series` variant (RFC 0034) as its cash
vector, states the tier ladder and the outcome metrics (LP/GP
contributions, distributions, MOIC, XIRR, total promote), and a
deterministic `verifyWaterfall` **recomputes the entire allocation** —
period by period, tier by tier — from the stated terms, reporting
three-state. The Tier-3 calc engine is untouched; `capital_stack`
(§4.24) is untouched, and its `CS-WATERFALL-UNSUPPORTED` boundary
stays: the waterfall lives in its own section, never inside the stack.
Protocol 2.2.0 → 2.3.0 (new §VIII.10, the allocation procedure).

## Motivation

- **RFC 0026 §E documented this and refused it**, because "it needs
  the multi-period cash-flow primitive first, and that primitive is
  itself RFC-sized." RFC 0034 shipped that primitive; the stated
  precondition is gone and the enforced boundary
  (`CS-WATERFALL-UNSUPPORTED`) is now a boundary with nothing on the
  other side.
- **A promote is the one headline number a sponsor-side underwriting
  cannot state today.** The format carries the stack (§4.24), the pref
  rate and accrual mode (0026 §C), and the dated equity flows (§4.26)
  — but "LP gets a 9% pref, GP catches up to 20%, 80/20 thereafter,
  LP nets a 1.62x / 13.8%" has no home, so every host recomputes it
  privately and no receipt covers it. This is exactly the class of
  number the standard exists to make comparable, and — like `xirr`
  before RFC 0034 — two conforming engines handed the same terms today
  would disagree, because waterfall semantics have as many dialects as
  day counts do.
- **Argus-parity for underwriter.cc**: promote structures are the
  partnership half of parity; the vendor computes them already, and the
  standard's job is to verify the stated result deterministically (the
  RFC 0034 division of labor, unchanged).

Non-motivation, to bound scope: this RFC does not model fund-level
(cross-deal) waterfalls — a `.uwx.md` is one deal, so the American /
European distinction collapses to deal-level here; a future portfolio
composite can roll deal outcomes up via RFC 0021. It does not model
clawback or crystallization (deferred, §Unresolved). It does not add
n-party splits — v1 is aggregate-LP versus GP, the granularity at which
promotes are actually quoted.

## Proposed change

### A. Format: §4.27 `distribution_waterfall` (new section)

Registered in the base format document (Part IV, count 27 → 28
subsections; per the RFC 0034 erratum, **the format version does not
move** for additive section registration). Asset-class independent,
**multi-variant** (`variant=base|upside|...`, the `stress_tests`
rules), OPTIONAL at every stage.

**Fields.**

- `cash_flow_ref` — `{ "variant": "<name>" }`: the `cash_flow_series`
  variant holding the **equity** cash vector. Negative amounts are
  equity contributions (capital calls); positive amounts are
  distributable cash. The series' own `day_count` governs every year
  fraction in this section.
- `equity_split` — `{ "lp": 0.90, "gp": 0.10 }`: each party's share of
  every contribution. MUST sum to 1.0. The GP share is co-invest; the
  promote is separate and comes from the tiers.
- `tiers` — the ordered ladder, closed `type` vocabulary:
  1. `return_of_capital` — pro-rata by unreturned contributed capital.
  2. `preferred_return` — `{ "rate": 0.09, "accrual": "simple" |
     "compound_annual" }`: accrues on each party's unreturned capital
     (pari passu — both parties' capital earns pref in v1), paid
     pro-rata by accrued balance.
  3. `catch_up` — `{ "gp_share": 1.0, "target_promote": 0.20 }`: the
     stated share of this tier's cash goes to the GP until the GP's
     cumulative **profit** (distributions above its own capital + pref)
     equals `target_promote` of total profit distributed so far.
  4. `split` — `{ "lp_share": 0.80, "gp_share": 0.20, "until_lp_em":
     2.0? }`: residual split; the optional `until_lp_em` equity-multiple
     hurdle caps the tier at the point cumulative LP distributions reach
     that multiple of LP contributions, then the next `split` tier
     takes over. The final tier MUST be an uncapped `split`.
  A ladder MUST contain at most one `return_of_capital`, at most one
  `preferred_return`, at most one `catch_up`, and at least one `split`;
  order MUST be as listed (any of the first three MAY be absent).
- `stated_outcomes` — the headline claims, all optional, each verified
  when present: per party `contributions`, `distributions`, `moic`,
  `xirr`; plus `promote_total` (GP distributions above its pro-rata
  capital + pref) and `profit_total`.
- `stated_schedule` — optional: one entry per distribution date —
  `{ "date", "by_tier": [{ "tier": <index>, "lp": <amt>, "gp": <amt> }] }`.
  When present it MUST match the recomputed allocation row-for-row;
  when absent only `stated_outcomes` are checked. Either way the
  verifier recomputes the full allocation — the schedule is display
  detail, not the source of truth.

**Validator family `WF-NN` (structure only, the lease-up split):**
- `WF-01` (error) — ladder grammar: unknown tier type, duplicate
  singleton tiers, out-of-order ladder, no uncapped final `split`,
  shares outside [0,1], `equity_split` not summing to 1.0 (compared at
  the ratio quantum), a `rate` outside (0, 1), or a non-positive
  `until_lp_em`.
- `WF-02` (error) — `cash_flow_ref` names a variant absent from the
  document's `cash_flow_series`, or the document has no
  `cash_flow_series` at all. (A compose-time fragment carrying only the
  waterfall downgrades this concern to the verifier's `unverifiable`,
  the LU-04 precedent — see Unresolved.)
- `WF-03` (error) — the referenced series has no contribution (no
  negative amount): a waterfall over pure inflows has no capital to
  return and every tier is vacuous.

### B. Protocol: §VIII.10 — the allocation procedure (normative)

**Protocol 2.2.0 → 2.3.0.** Two conforming engines MUST produce
identical allocations. The procedure (evaluated in binary64, amounts
quantized only at the reporting boundary per §VIII.5):

1. **Walk the referenced series in row order.** Maintain per party
   `unreturned` (capital), `accrued_pref`, `distributed`, and the
   party's dated flow list (for `xirr`).
2. **Accrual.** At each row, let `Δt = yearfrac(prev_date, date,
   day_count)` (§VIII.9.1; the series' convention; `prev_date` is the
   prior row's date, the anchor for the first). For each party:
   `simple`: `accrued_pref += unreturned × rate × Δt`;
   `compound_annual`: `accrued_pref = (accrued_pref + unreturned) ×
   ((1 + rate)^Δt − 1) + accrued_pref` — i.e. the unpaid pref itself
   compounds. Accrual happens **before** the row's cash is applied.
   Same-date rows accrue `Δt = 0` (no double accrual).
3. **Contribution rows** (`amount < 0`): each party's `unreturned`
   increases by its `equity_split` share of `|amount|`; the share is
   appended to the party's dated flows as an outflow.
4. **Distribution rows** (`amount > 0`): the cash fills the ladder in
   order. Within each tier, the tier's rule fixes both the split and
   the tier's **capacity**; cash beyond capacity falls to the next
   tier. Capacities: `return_of_capital` — Σ unreturned;
   `preferred_return` — Σ accrued_pref; `catch_up` — the amount `x`
   with `gp_share·x` bringing GP cumulative profit to `target_promote`
   of (total profit so far + `x`) — closed-form:
   `x = (target_promote × P − G) / (gp_share − target_promote)` with
   `P` = profit distributed before this tier plus this row's earlier
   tiers and `G` = GP profit so far (a non-positive or infinite `x`
   means the tier is filled; `gp_share ≤ target_promote` is a `WF-01`
   grammar refusal, not a runtime case); capped `split` — the amount
   bringing cumulative LP distributions to `until_lp_em × LP
   contributions to date`; final `split` — unbounded. Payments reduce
   `unreturned` / `accrued_pref` in their tier and append to each
   party's dated flows as inflows.
5. **Outcomes.** After the walk: per party `contributions`,
   `distributions`, `moic` = distributions ÷ contributions, `xirr` by
   the §VIII.9.3 procedure over the party's dated flows;
   `promote_total` = GP distributions − (GP return-of-capital + GP
   pref receipts); `profit_total` = Σ distributions − Σ contributions.
6. **Verification** (`verifyWaterfall`, three-state): stated outcomes
   compare at the §VIII.9.4 quanta (`$`→2, `x`→4, `%`→6); a stated
   schedule compares per cell at the currency quantum; a stated `xirr`
   whose recomputation raises (§VIII.9.3 refusal) is `failed`; a
   missing/structurally-invalid referenced series makes everything
   `unverifiable`, never a guess. Failure outranks indeterminacy.

`verifyWaterfall` is a TypeScript verifier — a sibling of
`verifyCapitalStack` / `verifyLeaseUpSchedule` / `verifyCashFlowSeries`
— NOT calc-engine surface: no grammar tokens, no builtins, no
`CalcResult` changes. The variable-length walk is safe for exactly the
reason the other three are.

### C. What this RFC does not change

- `capital_stack` (§4.24) is untouched and `CS-WATERFALL-UNSUPPORTED`
  **stays**: partnership tiers still do not belong inside the debt
  stack. The two sections are siblings (the stack is the liability
  side; the waterfall is the equity side), and a future cross-check
  (waterfall contributions vs. the stack's common-equity tranche) is
  deferred.
- No pack, no defaults entries, no Excel emit (the RFC 0034
  Newton-parity posture extends here: any future Waterfall sheet emits
  literals).
- **IRR hurdles are deferred, with the design named** (§Unresolved):
  an IRR-hurdled tier boundary requires solving for the intra-period
  amount that brings LP `xirr` to the threshold — a monotone
  root-solve that should reuse the §VIII.9.3 bisection constants when
  taken up. v1 ships equity-multiple hurdles, which are closed-form;
  `until_lp_irr` is reserved syntax, refused by `WF-01` until then.

## Compatibility analysis

Existing files: unaffected — new optional section; 1.x readers hold it
under §XII.2 unknown-section tolerance. Tier-1: additive (`WF-NN` under
the `validate` capability). Tier-2: ordinary edit policies. Tier-3:
untouched by construction. Tier-4: one prohibition mirroring 0026 —
an agent MUST NOT invent tier terms, splits, or hurdle levels; they are
partnership terms from the operating agreement. Modules: no change.
Nothing breaks; no deprecation path needed.

## Conformance impact

New suite `conformance/waterfall/`, sketched:

- **verify/** — a classic 90/10, 8% pref (simple), 100% catch-up to
  20%, 80/20 residual over a 5-year quarterly-ish series: all stated
  outcomes `verified`; the same deal with a stated schedule matching
  row-for-row; a `failed` case (promote overstated past the cent);
  an `unverifiable` case (ref names a variant that is structurally
  invalid); a compound-pref twin proving the accrual modes diverge;
  a no-catch-up ladder (pref then straight split); an EM-hurdled
  ladder (80/20 until 1.5x, 70/30 after) crossing the hurdle
  mid-period, pinning the boundary split.
- **reject/** — `WF-01` (out-of-order ladder; capped final split;
  `gp_share ≤ target_promote`), `WF-02` (dangling ref), `WF-03`
  (no contributions).

Roughly 10–12 scenarios. Every pinned number generated by the
verifier, never hand-computed (the RFC 0034 erratum made this a rule).

## Reference implementation

- **Files:** `waterfall.ts` (types + the §VIII.10 walk +
  `verifyWaterfall`; imports `datedFlowsOf`/`xirrOf`/`yearfrac` from
  the RFC 0034 modules), validator `checkWaterfall` (`WF-01..03` +
  remediations + the `WF` code family), schema
  `section-distribution-waterfall.schema.json`, chat/summary renderer
  rows, section registry + view model, exports in both barrels.
- **Test plan:** unit tests pinning each tier rule against hand-worked
  small cases (incl. the catch-up closed form and the EM boundary), the
  accrual modes against §VIII.9.1 year fractions, a property test that
  allocations conserve cash per period (Σ tier payments = row amount),
  and the conformance suite above.

## Alternatives considered

1. **Extend `capital_stack` with tiers.** Rejected by RFC 0026 §E
   itself and by the enforced boundary: the stack is one point in time
   (RFC 0033); a waterfall is a process over time. Mixing them forces
   every stack consumer to understand periods.
2. **State-only (no recomputation) — verify sums, trust splits.**
   Rejected: the whole value is that two engines agree on the promote.
   A verifier that trusts the splits verifies nothing a spreadsheet
   didn't.
3. **A calc-engine primitive.** Rejected on the standing doctrine; the
   walk is a verifier, like the three siblings before it.
4. **Full generality now (n parties, IRR hurdles, clawback,
   American/European).** Rejected as the classic scope trap 0026
   avoided: each is additive later (parties → a keyed map, IRR hurdles
   → the reserved syntax + bisection, clawback → a terminal true-up
   tier), and none is needed to state the promote structure the market
   actually quotes at deal level.

## Unresolved questions

- **IRR hurdles** (`until_lp_irr`) — the bisection-on-boundary-amount
  design is sketched in §C; take up when an adopter needs laddered IRR
  promotes verified. Reserved, refused until specified.
- **Clawback / crystallization** — deferred; likely a terminal
  true-up entry rather than per-period state.
- **Fragment-only waterfalls** — whether `WF-02` should downgrade to a
  warning for compose-time fragments (the LU-04 precedent) or stay an
  error. Proposed: stay an error; a waterfall without its cash vector
  is not reviewable, unlike a schedule without its rent roll.
- **Stack cross-check** — verifying waterfall contributions against
  the `capital_stack` common-equity tranche (a `CC-NN`); needs corpus
  evidence first, the CC-15/CC-16 posture.

## Prior art

ILPA's reporting conventions and the standard LP/GP promote
literature (return of capital → pref → catch-up → carried splits);
Excel LPA models — which disagree with each other, which is the point.
Internally: RFC 0026 §E (the documented shape this fills), RFC 0034
(the series, day counts, and `xirr` this consumes), RFC 0021 §6 (the
state-and-verify pattern, fourth instance).
