---
rfc: 0079
title: 'Verify stated metrics at their stated precision; one cash-on-cash definition'
status: implemented
author: codex (owner direction, Jared 2026-10-10)
created: 2026-10-10
accepted: 2026-10-10
affects:
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0079: Verify stated metrics at their stated precision; one cash-on-cash definition

## Summary

Check the unrounded dictionary result at the statement's precision, raised to
the metric's minimum comparison precision and capped at `round_to`. Coarse
statements verify if correct and fail if wrong; they do not become unverifiable.
Unify all nine income-class cash-on-cash definitions on multifamily's year-1
levered flow / total equity and lazy NOI-minus-debt-service fallback. Unify
all ten LTV definitions on underwritten value, with purchase-price fallback.
An independent receipt defect fix removes the obsolete reported-output tolerance.

## Motivation

Term sheets and offering memoranda legitimately state fewer places than the
engine's reporting ceiling. The comparison must retain their source precision,
check the unrounded formula once, and still reject coarse incorrect claims.
The original RFC 0078 lender census exposed precision differences, a pair of
incorrect Sonoran DSCR statements, and Agave's correct LTV under a denominator
already used by CC-02 and capital-stack `ltv_through`. Review established that
the first brief's purchase-price-only decision and refusal for coarse spelling
would contradict those facts. Jared revised the directions below.

Eight cash-on-cash definitions used sponsor contributions rather than aggregate
equity. Their worked examples have an unambiguous single non-debt source, which
can be explicitly recorded as aggregate equity without a financing convention.
The runtime must still require that statement instead of inferring it.

## Owner direction (Jared, 2026-10-10; revised after PR #301 review)

These current directions supersede the original brief where revised. The reasons
record the facts surfaced during review, not additional unresolved questions.

| # | Revision / current direction | Reason |
|---|---|---|
| D1 — refined | Compare the unrounded dictionary value at `min(max(stated_decimals, minimum_stated_decimals), round_to)`, half away from zero (§VIII.5), with no double rounding. A coarse statement is checked at the minimum: exact `0.07` verifies, LTC `0.6` verifies raw `0.601852` at 1%, and DSCR `1.5` versus `1.7` fails. Remove the insufficient-precision/unverifiable branch. | Review showed that fewer written decimals do not make a correct stated number unknowable. The original minimum-as-admission rule produced unnecessary unverifiable findings and hid coarse wrong claims. |
| D1 — minimum revision | `cap_rate`, `debt_yield` and `cash_on_cash` use 3 fractional decimals (0.1%). Other justified minimums stay as recorded in Decisions. | Jared revised the proposed 0.01% minimum to permit common coarser yield statements while retaining a comparison floor. |
| D2 — revised | Every class's LTV is loan / `valuation.underwritten_value`, falling back to `valuation.purchase_price` when no underwritten value is stated. Restore Agave's `0.4938` and original notes. | CC-02 and capital-stack `ltv_through` already use this denominator; one definition repo-wide. Agave's 24M loan / 48.6M underwritten value proves its original figure was correct. |
| D3 — retained | Every existing income-class cash-on-cash uses multifamily's stated Y1 levered flow / total equity, falling back to NOI minus debt service; absent total equity is null. | One deal-level return definition, independent of sponsor/LP allocations. |
| D3 — example supplementation | State `sources_uses.equity_metrics.equity_total` in the eight examples whose sole non-debt source is one sponsor-equity line, equal to that line, and document the identity in each `_notes`. Agave stays null. Tell non-multifamily producers that they now need this field for cash-on-cash. | Each of the eight totals is an identity of explicit stated fields, not an inferred allocation. Agave's mezz/preferred/common stack makes the aggregate ambiguous. |

The receipt defect below is an independent **Fixed** item, not part of D1–D3.

## Decisions

| Question | Decision | Precedent / justification |
|---|---|---|
| Cap rate, debt yield and cash-on-cash minimum | 3 stored fractional decimals: 0.1%, for every class-scoped entry with these ids. | Revised D1, Jared 2026-10-10. This is a comparison floor, not an admission requirement; more precisely stated values still compare more precisely. |
| Ratio (`x`) minimum | 2 decimals: 0.01x, including DSCR and the existing density ratio. | [Fannie Mae's conventional term sheet](https://multifamily.fanniemae.com/financing-options/conventional-properties-term-sheet) states DSCR to hundredths. Reuse the existing ratio unit family for density; its definition and 4-dp reporting ceiling remain unchanged. |
| Other percentage minimum | 2 stored fractional decimals: 1%. Applies to LTV/LTC, occupancy/pre-lease rates, expense/recovery/labor/care/GOP ratios, component NOI shares and land ratios. | Fannie's term sheet uses whole-percent leverage and occupancy. The floor compares coarse claims at whole-percentage precision, including Riverside LTC `0.6`. |
| Dollar-per-area minimum | 2 decimals for ids containing `sqft`, `psf` or `nrsf`, including mixed-use allocated area metrics. | Small area intensives need cents; [JLL Income Property Trust's per-SF operating disclosures](https://www.sec.gov/Archives/edgar/data/1314152/000162828026025755/jlliptapril2026posam.htm) illustrate cent precision. Retain §VIII.5's existing currency quantum as the ceiling. |
| Other dollar minimum | 0 decimals for per-unit/key/bed/acre metrics, ADR/RevPAR/RevPOR/monthly rents and mixed-use dollar subtotals. | Whole-dollar OM summaries are legitimate; [Pebblebrook's hotel summary](https://www.sec.gov/Archives/edgar/data/1474098/000147409814000084/ex992reverebostonsummaryshee.htm) quotes ADR in whole dollars. Cents still compare when stated. |
| Raw primary-size minimum | 0; exact finite-number identity with `round_to: null`. | RFC 0078 Phase 2 extraction and Protocol §XIII; no size rounding or quantity inference. |
| Precision representation and API | Retain source-token decimals, trailing zeroes and exponent shifts, after decoding representation units. The comparison API rejects absent/invalid precision arguments with `CALC-TYPE-001`; coarse precision never creates an unverifiable state. | Refined D1; source readers preserve precision and parsed numbers do not. Typed caller errors follow the existing quantizer's argument validation. No new document or module-manifest field. |
| Comparison boundary | Quantize the unrounded result once at `min(max(stated_decimals, minimum_stated_decimals), round_to)`; quantize the stated number only above the reporting ceiling. No new tolerance. | Refined D1 and §VIII.5's shared binary64 / half-away-from-zero quantizer; the existing double-rounding negative remains binding. |
| LTV denominator | Use stated underwritten value, with a lazy purchase-price fallback, in all ten dictionary entries, packs and Excel layouts. Do not substitute the price for a stated zero/invalid value. | Revised D2; CC-02 and capital-stack `ltv_through`. Existing type/division refusal behavior remains intact. |
| Cash-on-cash and example equity | Keep multifamily's exact expression, lazy Y1 selection and role-free fallback in all nine income classes. Producers state total equity; eight single-source examples now carry documented field identities. Agave stays null and land gains no income metric. | D3 and its supplementation; Format §4.19. No runtime sponsor substitution, debt summation or projected flow. |
| Pack versions | Multifamily moves from 1.0.1 to 1.0.2 for its LTV correction; the other nine corrected packs become 1.0.1 in this PR. Receipt fixtures name current packs, and old-pack refusal stays intact. | Existing multifamily correction precedent and receipt `RCP-06` identity handling. Do not reuse a released pack identity for a changed expression. |
| Example value corrections | Restore Agave byte-for-byte from main, including its correct LTV and notes. Keep only Sonoran's two proven DSCR corrections; add only the eight owner-directed equity identities. | Revised D2 and the review's evidence instruction. No other example LTV changes and no ambiguous equity assembly. |
| Version | Keep Format 2.0 and the current Protocol label/constant; move the Protocol label at release preparation. | Semver per surface and RFC 0078's unreleased Protocol 3.0 preparation. No new dependency or calculation grammar. |

## Proposed change

### Stated precision

Every dictionary entry carries `minimum_stated_decimals`: a comparison floor,
not a requirement on source spelling. Calculations use an integer from zero
through `round_to`; raw sizes use zero. Schema and `protocol.ts` agree.
Source `1.20` has two decimals, `1.2` one, and `1.200e-2` five. Lite `5.50%`
and UWX `0.0550` both carry four stored-fraction decimals. Optional display
strings never set precision.

A verifier computes the dictionary formula unrounded in binary64, then
quantizes once at `min(max(s, m), round_to)`. At/below the ceiling the stated
number itself is compared; above it the statement is quantized at the ceiling.
Equality verifies and finite disagreement fails. Missing usable inputs remain
unverifiable, but coarse numeric statements never become unverifiable solely
because they have fewer written decimals. The API requires precision as an input
and uses typed caller errors for missing/invalid arguments. No precision inference
from a parsed double, hidden tolerance, or double rounding is introduced.
For example, raw `1.24495` at two decimals is `1.24`; rounding it first to four
then two incorrectly yields `1.25`. Raw finite sizes stay exact.

### One LTV and one cash-on-cash

Every class uses:

```text
debt_structure.loan_amount / (valuation.underwritten_value != null ? valuation.underwritten_value : valuation.purchase_price)
```

This is the denominator used by CC-02 and capital-stack `ltv_through`.
A stated zero/invalid value keeps the existing typed refusal; the fallback is
for absent/null values only. All lender-side senior-role preferences stay intact.

Every existing income class uses:

```text
sources_uses.equity_metrics.equity_total == null ? null : (dcf.annual_cash_flows.Y1.net_cash_flow_levered != null ? dcf.annual_cash_flows.Y1.net_cash_flow_levered : noi_model.net_operating_income - debt_structure.annual_debt_service) / sources_uses.equity_metrics.equity_total
```

Y1 is selected by stated year independently of array order. Zero/negative flows
are preserved; the fallback is lazy and role-free. Missing total equity is null;
zero equity keeps the division-by-zero refusal. **Non-multifamily producers now
need to state `sources_uses.equity_metrics.equity_total` for cash-on-cash.**
A producer may document it as the identity of a sole non-debt source. The
runtime does not derive it, allocate sponsor/LP cash, project flows, sum tranches
or assemble an ambiguous stack. Land gains no cash-on-cash metric.

## Fixed

### Receipt reported-output equality (independent defect)

Both rehashed one-cent/subquantum negative fixtures incorrectly verified on main
under the old relative tolerance. This is independent of the three owner
financial directions: reported receipt values are already quantized outputs and
their digests are exact. Receipt §5.2 and the reference verifier now require exact
full-`round_to` output equality, superseding `1e-6 × max(1, |a|, |b|)`.
Document statement precision does not reduce receipt output/digest precision.
The historical public constant remains deprecated and unused for compatibility;
existing engine/pack mismatch precedence, signatures and digest algorithms stay
intact. Current-version negatives fail with RCP-03.

## Example evidence

Agave is restored byte-for-byte from `origin/main`, including `_notes`. Its senior
LTV is `24,000,000 / 48,600,000`, stated as `0.4938`; CC-02 and capital-stack
sizing agree. Other builtin examples either have underwritten value equal to
purchase price or lack it, so no other example LTV changes.

Only these inconsistent stated values remain corrected:

| Example | Address | Before | After | Evidence |
|---|---|---|---|---|
| Sonoran Self-Storage | `quick_metrics.dscr` | `1.3153` | `1.3161` | Stated NOI 672,000 / stated annual debt service 510,606, quantized at 4 dp. |
| Sonoran Self-Storage | `debt_structure.dscr` | `1.3153` | `1.3161` | Same inputs and quantization. |

The following explicit aggregate-equity fields each equal the example's sole
non-debt sponsor source. Every sources/uses `_notes` records the field identity;
no money is added, no allocation is inferred, and the fallback CoC values remain
the examples' prior numeric values:

| Class / example | Stated sole equity source | Added `equity_total` | Cash-on-cash (fraction) |
|---|---|---|---|
| office / Riverside | `sources.sponsor_equity` | 2,150,000 | `0.003488` |
| retail / Cactus Crossing | `sources.sponsor_equity` | 7,842,500 | `0.051296` |
| industrial / Ironwood | `sources.sponsor_equity` | 12,760,000 | `0.043111` |
| self_storage / Sonoran | `sources.sponsor_equity` | 3,560,000 | `0.045335` |
| hospitality / Saguaro | `sources.sponsor_equity` | 11,370,000 | `0.059674` |
| senior_housing / Ocotillo | `sources.sponsor_equity` | 13,224,000 | `0.058396` |
| student_housing / Mill Ave | `sources.sponsor_equity` | 25,700,000 | `0.030041` |
| mixed_use / Roosevelt Row | `sources.equity_sponsor` | 14,000,000 | `0.048000` |

Agave remains uncomputed for cash-on-cash: mezz plus preferred/common equity
leave total equity ambiguous. Both Parkview Extended records remain unchanged.
Riverside LTC remains literally `0.6` and is now checked at the 1% minimum.
The [lender report](../../conformance/metrics/README.md) freezes every one of the
original 143 selected addresses: **143 verified, 0 failed, 0 unverifiable**.
All 35 former precision disagreements verify. The report gives counts per
example; failures remain findings rather than being suppressed.

## Compatibility analysis

Existing records still parse and validate with the same Format 2.0 schema. No
new document or module-manifest field is required for structural validity.
Dictionary metadata adds comparison minimums; readers preserve source precision.
Coarse complete claims now verify or fail at the floor. Cash-on-cash producers
need the existing total-equity path, and the example updates demonstrate an
explicit field identity without adding inference to the runtime.

LTV/cash-on-cash corrections intentionally change pack expressions under the
revised owner directions. Pack identities move as recorded in Decisions; old
versions retain RCP-06 unverifiable handling. Correctly issued receipts agree
exactly. Incorrect receipt results previously accepted under the old tolerance
now fail (or remain unverifiable under existing engine-mismatch precedence).
No canonicalization, signatures, provenance or quantizer algorithm changes.
Package/Protocol release labels move at preparation. No new dependency.

## Conformance impact

- The lender baseline retains all 143 addresses, source decimals and comparison
  decimals; no coarse statements are removed. No input/default/cascade inference.
- Precision controls cover exact/coarse `0.07`, wrong `0.07`, DSCR `1.5` vs `1.7`,
  LTC `0.6`, minimum/ceiling selection, half-bp ties, exponents, trailing zeroes,
  cent noise and the original double-rounding trap.
- All ten LTV definitions prove stated-value preference, lazy price fallback,
  missing inputs and zero/type-invalid refusal. All nine income-class CoC tests
  retain Y1/zero/negative/lazy-fallback/missing-equity controls.
- Dictionary/pack/size parity remains exact in both directions. Excel layouts
  bind underwritten value and total equity alongside the shared formulas;
  test oracles retain optional blanks and exact formula/input round trips.
- Two independent receipt negatives retain RCP-03 after digest rehashing; old
  engine/pack mismatch handling stays protected.

## Reference implementation

`calc/stated-precision.ts` exports `getStatedDecimals`, `compareStatedMetric` and
`StatedMetricComparison` from core/browser. The independent lender combines only
the dictionary, source readers, section resolver, expression evaluator and this
comparison boundary. Pack expressions and Excel named inputs change together,
including mixed-use property inputs. Full reporting quantization is unchanged.
The receipt verifier separately removes the obsolete relative comparison.

## Alternatives considered

- Always compare at `round_to`: rejects valid coarser statements.
- Refuse spelling below the minimum: superseded by refined D1; compare at the floor.
- Double round reported values: can change the verdict.
- Purchase-price-only LTV: superseded by D2; contradicted CC-02 and stack sizing.
- Infer total equity in the runtime: hides evidence gaps; producers state it.
- Apply relative receipt tolerance to document claims: mixes distinct contracts.

## Unresolved questions

None for this scope. Any remaining lender failures are recorded findings.
Ambiguous equity assembly and future metrics remain separate contracts.

## Prior art

RFC 0078's independent verification boundary; RFC 0023's quantization contract;
CC-02 and capital-stack LTV; Format §4.19 and multifamily's total-equity correction.
The monetary/ratio minimums use the reporting examples linked in Decisions;
these are UWMD policy choices, not standards imposed by those publishers.
