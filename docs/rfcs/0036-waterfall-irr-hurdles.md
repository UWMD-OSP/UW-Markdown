---
rfc: 0036
title: IRR-hurdled waterfall tiers — a closed-form boundary, not a nested solve
status: implemented
author: jaredmaxey
created: 2026-09-07
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0036: IRR-hurdled waterfall tiers — a closed-form boundary, not a nested solve

> Takes up the first item RFC 0035 reserved: `until_lp_irr` on a `split`
> tier, refused by `WF-01` since 2.3.0 "until a future RFC specifies the
> boundary solve." This RFC specifies it — and the specification is not
> the one 0035 §C sketched. The sketch was a bisection on the boundary
> amount with `xirr` as the objective, which nests a 200-iteration
> root-solve inside another root-solve and inherits `xirr`'s refusal
> cases mid-walk. The boundary has a **closed form** under the
> hurdle-rate balance identity the industry already uses, and that is
> what is proposed. Protocol 2.5.0 → 2.6.0 (a new capacity rule in
> §VIII.10 step 3; drafted against 2.3.0, the number moved under it
> while 0037/0038 shipped); the format version does not move.
>
> **Implemented 2026-09-09** under owner-led governance (accept +
> implement in one change). The corpus scan the Compatibility section
> calls for found zero non-increasing `until_lp_em` ladders, so the
> monotone rule ships as `WF-01` for both hurdle kinds; no `WF-04`.

## Summary

Allow a `split` tier to be capped by an LP **IRR hurdle**
(`until_lp_irr`) alongside — or instead of — the equity-multiple hurdle
RFC 0035 shipped. The tier pays until the LP's dated flows, including
the payment being made, reach the hurdle rate; the next tier takes over.
The capacity is closed-form: the LP's *hurdle balance* at the row date
is the future value, compounded at the hurdle rate under the series'
own day count, of every LP flow so far — the amount the LP must receive
now for its flows to have a net present value of zero at the hurdle
rate. No iteration is introduced anywhere; `xirr` is still computed
only for the reported outcome, by the unchanged §VIII.9.3 procedure.
Laddered promotes (`12% → 15% → 18%`) and combined hurdles (`1.5x
*and* 12%`) follow directly. `verifyWaterfall` stays a verifier; the
Tier-3 calc engine is untouched.

## Motivation

- **This is the promote structure the market actually quotes.** RFC
  0035 shipped equity-multiple hurdles because they are closed-form and
  deferred IRR hurdles as "the classic scope trap." But an LPA that
  reads "80/20 until the LP achieves a 12% IRR, 70/30 until 15%, 60/40
  thereafter" is the common case, not the exotic one; an
  equity-multiple-only ladder cannot state it, so a sponsor-side
  underwriting still has no home for its headline promote and every
  host recomputes it privately — the exact gap 0035 set out to close.
- **The reserved syntax is a refusal with a known design.** 0035 §C
  and format §4.27 both name the solve and refuse the field. A
  reservation is meant to be short-lived; every 2.3.0–2.5.0 file that
  wants an IRR ladder is currently forced to either misstate its terms
  as a multiple or leave the waterfall out.
- **The sketched design would have been wrong to build.** Bisecting on
  the boundary amount `x` with `g(x) = xirr(F ∪ {(t, lp_share·x)})` as
  the objective (a) nests the §VIII.9.3 bisection inside another
  bisection — up to 200 × 200 `xnpv` evaluations per tier per row —
  and (b) makes tier capacity *undefined* whenever `xirr` refuses (no
  sign change over the bracket, which is exactly the state of the LP's
  flows before its first distribution). The closed form has neither
  problem: `xnpv` is a finite sum with no refusal case (§VIII.9.2).
- **Two engines must agree on the flip.** "IRR hurdle" has as many
  dialects as day counts: some models test the hurdle at period end,
  some compound the balance monthly, some solve the IRR and compare.
  Writing the identity down normatively is what makes the promote
  comparable across implementations — the RFC 0034/0035 division of
  labor, unchanged.

## Proposed change

### A. Format: §4.27 `split` tier gains `until_lp_irr`

In the `tiers[].split` description, replace the reserved-and-refused
sentence with:

> The optional `until_lp_irr` (a fraction in (0, 1)) caps the tier where
> the LP's dated flows — every contribution and distribution to date,
> including this tier's payment at this row's date — reach that
> internal rate of return under the series' day count (Protocol
> §VIII.10, hurdle balance). `until_lp_em` and `until_lp_irr` MAY both
> be stated on one tier; the tier then ends only when **both** hurdles
> are met (the larger capacity governs). A capped split MUST have
> `lp_share > 0` whichever hurdle caps it. Across the ladder, successive
> `until_lp_irr` values MUST strictly increase, as MUST successive
> `until_lp_em` values (a later tier hurdled at or below an earlier one
> has capacity zero by construction and would pay nothing, silently).

The `WF-01` rule list changes accordingly: remove "the reserved
`until_lp_irr` refused"; add "`until_lp_irr` in (0, 1)" and "successive
hurdles of one kind strictly increasing." The "Deliberately deferred"
paragraph drops IRR-hurdled tiers.

Schema: `until_lp_irr: { "type": ["number", "null"], "exclusiveMinimum":
0, "exclusiveMaximum": 1 }` on the `split` variant; the reservation
note is removed. No new section, no format version movement (additive
field on an existing optional section — the RFC 0034 erratum precedent).

### B. Protocol: §VIII.10 step 3, the capped-`split` capacity (normative)

**Protocol 2.5.0 → 2.6.0.** Replace the `split` bullet with:

> - `split` — paid `lp_share` / `gp_share`. A capped tier's capacity is
>   the **larger** of the capacities its stated hurdles impose (both
>   must be met before the tier ends); the final tier is unbounded.
>   - `until_lp_em`: `max(0, until_lp_em × lp.contributions −
>     lp.distributions) / lp_share` (unchanged from 2.3.0).
>   - `until_lp_irr` (= `h`): let `F` be the LP's dated flows so far —
>     every contribution outflow and distribution inflow appended by
>     earlier rows **and by earlier tiers of this row**, at their
>     anchor-relative `t` (§VIII.9.2) — and `t_row` this row's `t`.
>     The LP's **hurdle balance** is
>     `B = −xnpv(F, h) × (1 + h) ^ t_row`
>     (§VIII.9.2's sum, accumulated in flow order; the same `t` values
>     the outcome `xirr` will use). Capacity is `max(0, B) / lp_share`.
>     `B ≤ 0` means the LP has already achieved the hurdle and the tier
>     pays nothing.
>
>   The hurdle test is the balance identity, **not** a comparison
>   against a solved `xirr`: `xnpv(F ∪ {(t_row, B)}, h) = 0` exactly,
>   so a tier that fills lands the LP at the hurdle rate by
>   construction, without iteration. The reported outcome `xirr` is
>   still the §VIII.9.3 procedure over the final flows; at a filled
>   boundary the two agree to within that procedure's stopping
>   tolerance, which the §VIII.9.4 `%` quantum (6 dp) absorbs.

And one sentence at the end of step 3: "An implementation MUST NOT
determine a tier boundary by iterating on `xirr`; §VIII.9.3 remains the
only permitted iteration and it runs only in step 4."

**Why the identity is the definition and not merely an implementation
of "LP IRR ≥ h".** For conventional LP flows (contributions, then
distributions) the two coincide. For flows with a capital call *after*
a distribution, `xnpv(·, r)` need not be monotone in `r`, "IRR ≥ h" can
be ambiguous (multiple roots) or undefined (no root), and two engines
solving for the IRR could legitimately disagree on whether the hurdle
was met. The balance identity is single-valued for every finite flow
list and is what LPA models mean operationally ("the LP's capital
account compounds at the hurdle rate until it is paid down"). Making it
the normative definition is what makes the flip deterministic;
`verify-irr-hurdle-interleaved-call` pins exactly the case where the
two readings could differ.

### C. Validator: `WF-01` grammar

`checkWaterfall` gains, on `split` tiers:

- `until_lp_irr` present → MUST be a number in (0, 1); else `WF-01`
  at `tiers[i].until_lp_irr` (the reservation refusal is deleted).
- A split capped by either hurdle MUST have `lp_share > 0` (the existing
  rule, now covering both fields).
- The final tier MUST be uncapped by either field (the existing rule,
  now covering both).
- **Monotone ladders:** across `split` tiers in order, each stated
  `until_lp_irr` MUST exceed every earlier stated `until_lp_irr`, and
  each stated `until_lp_em` MUST exceed every earlier stated
  `until_lp_em`; else `WF-01` at the offending tier. Compared at the
  rate / ratio quantum respectively.

Remediation text for each lands in `BUILTIN_REMEDIATIONS` under the
existing `WF` family; no new code family, no new capability — the
change slots under `validate` (structure) and the existing verifier
surface (arithmetic) per RFC 0030.

### D. What this RFC does not change

- No calc-engine surface: no grammar tokens, no builtins, no
  `CalcResult` shape. `computeWaterfall` gains one `case` branch; it
  calls `xnpvOf`, which already exists and is closed-form.
- No new party model, no clawback, no crystallization (still deferred,
  §Unresolved). No `capital_stack` change; `CS-WATERFALL-UNSUPPORTED`
  stays.
- No Excel emit (the §4.26 literals posture).
- `stated_outcomes` / `stated_schedule` shapes are unchanged — an
  IRR-hurdled ladder is verified by the same two comparisons.

## Compatibility analysis

- **Existing files.** Every 2.5.0-valid file stays valid: `until_lp_irr`
  was refused, so no file carries it; `until_lp_em` semantics are
  byte-for-byte the 2.3.0 rule. **One tightening:** the monotone-ladder
  rule newly refuses a non-increasing `until_lp_em` sequence. Such a
  ladder has a dead tier and was never meaningful, but it was legal.
  Implementation MUST scan the corpus and examples for one before
  accepting the tightening; if any exists, the rule lands for
  `until_lp_irr` only and the `until_lp_em` half becomes a warning
  (`WF-04`, new) — the CC-15/CC-16 posture. Expected result: zero hits
  (the only EM-hurdled document in the repo is the single-tier
  `verify-em-hurdle-boundary` fixture). **Scan result (2026-09-09):
  zero hits.** `until_lp_em` appears in `conformance/waterfall/
  verify-em-hurdle-boundary/case.json` and
  `reject-capped-final-split/deal.uwx.md` (one capped tier each), in
  `validator.waterfall.test.ts` / `waterfall.test.ts` (one capped tier
  each), and nowhere under `examples/` or `spec/`; no document carries
  two EM-hurdled tiers. The tightening ships as `WF-01` for both kinds.
- **Tier-1 readers:** additive under `validate`. **Tier-2:** ordinary
  edit policies. **Tier-3:** untouched by construction. **Tier-4:** the
  §4.27 prohibition already covers hurdle levels ("an agent MUST NOT
  invent tier terms, splits, or hurdle levels"); no new text.
- **Modules:** no manifest change.
- **Protocol skew:** a 2.3.0–2.5.0 host reading a 2.6.0 file with
  `until_lp_irr` reports `WF-01` (its reservation refusal) — a visible,
  correct refusal rather than a silent mis-allocation. That is the
  §XII.4 posture and needs no shim.
- **Receipts:** unaffected — the waterfall verdict is not a receipt
  output.

## Conformance impact

**Existing fixtures that change:**

- `conformance/waterfall/reject-reserved-irr-hurdle/` — the document
  becomes valid. Rename to `verify-irr-hurdle-*` or delete; the
  reservation is gone and a fixture asserting it would assert a stale
  refusal. Proposed: delete, since the new `verify-` cases cover the
  field and `reject-irr-hurdle-out-of-range` covers the grammar.
- `validator.waterfall.test.ts` — the "rejects the reserved
  until_lp_irr" case flips to the range check.

**New scenarios in `conformance/waterfall/` (every pinned number
generated by the verifier, never hand-computed — the RFC 0034 rule; the
single-shot cases are chosen so the hand check is trivial anyway):**

| Scenario | Pins |
|---|---|
| `verify-irr-hurdle-boundary` | `−1,000,000` at t0, `+1,150,000` at t1, `equity_split` 100/0, ROC → 80/20 `until_lp_irr` 0.12 → 60/40. The hurdled tier pays LP exactly `120,000` and GP `30,000`, then nothing remains; LP `xirr` verifies at `0.12` (6 dp) — the boundary lands on the hurdle. |
| `verify-irr-hurdle-crossing` | Same ladder, `+2,500,000` at t1: tier 2 fills at `150,000` and hands `1,350,000` to 60/40 — LP `1,930,000`, GP `570,000`, stated schedule cell-for-cell. |
| `verify-irr-ladder` | ROC → 80/20 to 10% → 70/30 to 15% → 60/40 over a five-row series; each hurdled tier's fill pinned in the schedule; LP `xirr` above 15%. |
| `verify-irr-hurdle-already-met` | A series whose ROC-plus-earlier distributions already exceed the hurdle: the hurdled tier's capacity is `≤ 0`, it appears in no schedule row, and the next tier absorbs the cash. |
| `verify-irr-hurdle-interleaved-call` | A capital call after a distribution (`−1,000,000`, `+300,000`, `−200,000`, `+1,500,000` on 2026-01-01, 2027-01-01, 2027-07-02, 2029-01-01 — t = 0, 1, 547/365, 1096/365 under act/365f), ROC → 80/20 to 12% → 60/40. Pins the balance-identity payment: the hurdled tier pays the LP `366,097.17` (F credits both ROC receipts and the mid-hold call) — the case where "solve the IRR and compare" and the identity could diverge, resolved by definition. *(As implemented; the draft's `1,265,667.32` was a hand figure for a ladder without a ROC tier at exact t = 1.5 / 3, and hand figures are not pinned.)* |
| `verify-combined-hurdles-irr-binds` / `-em-binds` | One tier stating both `until_lp_em: 1.5` and `until_lp_irr: 0.12`. Over a five-year hold the IRR balance (`762,888.96`) exceeds the 1.5x headroom (`500,000`) and binds; over a one-year hold the multiple binds (LP `500,000` / GP `125,000`). |
| `verify-compound-pref-then-irr` | 8% `compound_annual` pref → catch-up → 80/20 until 12% IRR → 60/40: the pref receipts are LP inflows in `F`, so the hurdle balance already credits them; promote pinned. |
| `reject-irr-hurdle-out-of-range` | `until_lp_irr: 1.2` and `until_lp_irr: 0` → `WF-01`. |
| `reject-irr-hurdle-non-increasing` | 15% then 12% → `WF-01` at the second tier. |
| `reject-irr-hurdle-lp-share-zero` | `lp_share: 0` with `until_lp_irr` → `WF-01`. |
| `reject-irr-hurdle-on-final-split` | The terminal tier capped by IRR → `WF-01`. |

Twelve directories (the combined-hurdle twin is its own scenario); one
deleted: corpus 385 → 396. The `verify-irr-hurdle-boundary`
case also serves as the regression pin for the identity itself: if an
implementation ever "improves" the boundary by solving `xirr`, the LP
`xirr` still reads `0.12` but the schedule cell moves by the solver's
tolerance and the pinned cent disagrees.

## Reference implementation

- **Files:** `waterfall.ts` (the `split` capacity branch; `until_lp_irr`
  on `WaterfallTierSplit`; import `xnpvOf`), `validator.ts`
  (`checkWaterfall` rules in §C + `BUILTIN_REMEDIATIONS` rows),
  `spec/schemas/section-distribution-waterfall.schema.json`,
  `spec/UW_FORMAT_SPEC_v1.md` §4.27, `spec/UW_PROTOCOL_v1.md` §VIII.10 +
  version line + §XVI, `protocol.ts` (`PROTOCOL_VERSION` 2.6.0),
  `conformance/waterfall/` per the table, `CHANGELOG.md`, the waterfall
  rows in `docs/wiki/13-status.md`, `ROADMAP.md`, and the RFC index.
- **API surface:** no new exports. `WaterfallTierSplit.until_lp_irr?:
  number | null` is the only type change (additive).
- **Test plan:** unit tests in `waterfall.test.ts` pinning the hurdle
  balance against a hand-worked single-shot case (`B = 120,000` at
  `h = 0.12`, `t = 1`), the "already met" zero-capacity path, the
  combined-hurdle `max`, and the boundary-vs-`xirr` agreement to 6 dp
  (asserted with `toBe` on the quantized value, not `toBeCloseTo`);
  `validator.waterfall.test.ts` for each new `WF-01` branch; the
  cash-conservation property test extends unchanged to IRR-hurdled
  ladders (Σ tier payments = row amount); the conformance suite above.
- **Effort:** small — one capacity branch and four grammar checks. The
  spec text is most of the work, as it should be.

## Alternatives considered

1. **Bisection on the boundary amount (the 0035 §C sketch).** Rejected,
   §Motivation: nested iteration, capacity undefined where `xirr`
   refuses, and 40,000 `xnpv` evaluations per tier per row in the
   worst case. It also would have made the *boundary* depend on the
   §VIII.9.3 stopping tolerance — a schedule cell that moves at the
   twelfth decimal between implementations that both conform.
2. **Test the hurdle on the solved IRR after each row ("did the LP
   reach 12% yet?").** Rejected: it is a period-end test, so the flip
   happens at the *next* row, over-paying the hurdled tier by up to a
   whole distribution. Wrong by the LPA's own reading and
   implementation-dependent in the interleaved-call case.
3. **Express the IRR hurdle as a `compound_annual` pref tier.** The
   identity shows they are cousins — a hurdle balance *is* a compound
   pref balance on all LP flows — but a pref tier accrues on
   `unreturned` capital only and pays pro-rata pari passu with the GP,
   while a hurdle is an LP-only cap on a *split*. Forcing one into the
   other misstates the ladder.
4. **A separate `hurdle` object (`{ kind: "irr" | "em", value }`)
   instead of two fields.** Cleaner in the abstract, but it would
   change the shipped `until_lp_em` shape, and the two-field form reads
   the way an LPA does ("until 1.5x and 12%"). Not worth a migration.
5. **Allow non-monotone ladders and let dead tiers be.** Rejected: a
   tier that can never pay is a misstatement of the partnership terms,
   and the format's posture is to refuse a structure that cannot mean
   what it says (the `gp_share ≤ target_promote` precedent).

## Unresolved questions

- **"Any" semantics for combined hurdles.** This RFC ships "both must be
  met" (the larger capacity). An LPA reading "until 1.5x *or* 12%,
  whichever first" would need a `hurdle_mode: "any"` (the smaller
  capacity). Deferred until a document needs it; the field name is
  proposed here so a later RFC does not invent another.
- **GP-side hurdles** (`until_gp_irr`). No LPA the author has seen
  hurdles on the GP's return; left out rather than reserved.
- **Clawback / crystallization** — still deferred from 0035; unchanged
  by this RFC, though an IRR ladder makes the clawback question more
  pressing (a promote paid on an interim hurdle that later un-earns
  itself). A terminal true-up tier remains the likely shape.
- ~~**The `until_lp_em` monotonicity tightening** — error or warning,
  decided by the corpus scan in §Compatibility.~~ **Resolved:** the scan
  found zero non-increasing EM ladders (see §Compatibility), so it
  ships as `WF-01` (error) for both hurdle kinds; no `WF-04`.

## Prior art

The "hurdle balance" / "IRR hurdle account" method in standard LPA
waterfall models (the LP's capital account compounding at the hurdle
rate until paid down) — the operational meaning every model agrees on
even when their solved-IRR tests disagree. Internally: RFC 0035 (the
ladder and walk this extends; §C's reservation and sketch), RFC 0034
(`xnpv`, anchor-relative `t`, and the day-count registry the balance
compounds under), RFC 0024 (why a boundary must never depend on an
iterative solver's tolerance).
