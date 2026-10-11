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

Verify a stated metric at the precision its source number actually carries,
subject to a dictionary minimum and the metric's existing reporting ceiling.
Quantize the unrounded formula result once. Unify all nine income-class
cash-on-cash definitions on year-1 levered cash flow over total invested equity,
with multifamily's existing NOI-minus-debt-service fallback. LTV stays loan over
purchase price. This implements the owner's three decisions in one PR.

## Motivation

RFC 0078 Phase 2 extracted the dictionary and found 39 disagreements in 143
example statements. Thirty-five involved precision; four were duplicated example
data errors. A three-decimal DSCR can be right even though the engine reports
four decimals. Checking only at the reporting ceiling rejects valid term-sheet
statements. The extraction also exposed sponsor-only denominators in eight
cash-on-cash definitions, contrary to Format §4.19's total-equity definition.
Receipt §5.2 still described a pre-quantization relative tolerance.

## Owner direction (Jared, 2026-10-10)

These directions are binding. The implementation minima below are selected under
D1 from reporting practice and recorded separately in the Decisions table.

| # | Direction |
|---|---|
| D1 | A stated metric verifies when the dictionary value, computed unrounded and quantized half-away-from-zero (§VIII.5) to the decimals the stated value carries, equals that statement, provided those decimals meet the entry's minimum stated precision. Propose and justify the minimums from term-sheet/OM practice. More decimals than `round_to` compare at `round_to`. No double rounding. |
| D2 | LTV remains loan amount divided by purchase price. |
| D3 | Every class's existing `cash_on_cash` uses multifamily's year-1 levered cash flow over total equity; when no levered flow is stated, fall back to NOI minus debt service. Missing total equity is null. This changes the definition for eight other classes; check their documents' paths and report changed examples. |

## Decisions

| Question | Decision | Precedent / justification |
|---|---|---|
| Cap rate, debt yield and cash-on-cash minimum | 4 stored fractional decimals: 0.01%. Applies to every class-scoped entry with these ids. | D1; cap/debt yields are quoted in basis points. [Safehold's valuation assumptions](https://www.sec.gov/Archives/edgar/data/1095651/000109565126000024/safe-20260730x8k.htm) and [Starwood's debt-yield disclosures](https://www.sec.gov/Archives/edgar/data/1465128/000114036126009390/ny20063510x3_ars.pdf) show two-decimal percentages. Apply the same yield floor to cash-on-cash. |
| Ratio (`x`) minimum | 2 decimals: 0.01x, including DSCR and the existing density ratio. | [Fannie Mae's conventional term sheet](https://multifamily.fanniemae.com/financing-options/conventional-properties-term-sheet) states DSCR to hundredths. Reuse the existing ratio unit family for density; its definition and 4-dp reporting ceiling remain unchanged. |
| Other percentage minimum | 2 stored fractional decimals: 1%. Applies to LTV/LTC, occupancy/pre-lease rates, expense/recovery/labor/care/GOP ratios, component NOI shares and land ratios. | Fannie's term sheet uses whole-percent leverage and occupancy. A whole-percentage floor allows summary operating ratios without accepting ten-percentage-point granularity. More precisely stated figures still compare more precisely. |
| Dollar-per-area minimum | 2 decimals for ids containing `sqft`, `psf` or `nrsf`, including mixed-use allocated area metrics. | Small area intensives need cents; [JLL Income Property Trust's per-SF operating disclosures](https://www.sec.gov/Archives/edgar/data/1314152/000162828026025755/jlliptapril2026posam.htm) illustrate cent precision. Retain the existing §VIII.5 currency quantum as the ceiling. |
| Other dollar minimum | 0 decimals for per-unit/key/bed/acre metrics, ADR/RevPAR/RevPOR/monthly rents and mixed-use dollar subtotals. | Whole-dollar OM summaries are legitimate; [Pebblebrook's hotel summary](https://www.sec.gov/Archives/edgar/data/1474098/000147409814000084/ex992reverebostonsummaryshee.htm) quotes ADR in whole dollars. This floor permits that reporting while keeping cents when actually stated. |
| Raw primary-size minimum | 0; retain exact finite-number identity with `round_to: null`. | RFC 0078 Phase 2 extraction and Protocol §XIII. These selectors do not gain rounding or fractional quantity inference. |
| Precision representation | Count numeric source-token decimals, including trailing zeroes and exponent shifts; decode representation units before comparison. Missing or insufficient precision is unverifiable. | D1 and RFC 0078 D11: optional display strings carry no verification meaning. Existing UWX `rawJson`, frontmatter source and Lite anchors preserve the evidence; parsed numeric values do not. No new document field is required. |
| Comparison boundary | Quantize the unrounded dictionary result once at `min(stated_decimals, round_to)`; compare the stated value at the same ceiling. No added tolerance. | D1 and §VIII.5's shared binary64 / half-away-from-zero quantizer; avoids double rounding. Minimum precision is dictionary verification metadata, not a new module-manifest property. |
| Receipt results | Exact equality of full-`round_to` outputs; supersede the stale relative tolerance in spec and runtime. Retain the old exported constant, deprecated and unused, for source compatibility. | RFC 0023's quantized outputs and digests. Receipt output precision is distinct from document statement precision; rehashing a changed number must not make it valid. |
| Cash-on-cash scope and identity | Apply multifamily's exact expression, paths, lazy Y1 selection and role-free debt fallback to all nine existing income-class entries; no new land metric. Eight corrected pack versions become 1.0.1. | D3, Format §4.19 and multifamily pack 1.0.1. Do not derive total equity from sponsor contributions, project a flow or sum debt tranches. |
| Example corrections and findings | Correct only Agave's two LTV copies and Sonoran's two DSCR copies from their explicit inputs. Preserve insufficient-precision and missing-input findings. | D2 and the owner instruction to report remaining findings. No zero padding, inferred equity or suppressed assertions to clear the corpus. |
| Version | Keep Format 2.0 and the current Protocol label/constant. Move the Protocol label at release preparation. | Semver per surface; RFC 0078's unreleased Protocol 3.0 preparation pattern. No dependency or calculation grammar change. |

## Proposed change

### Stated precision

Protocol §VIII.5.1 and `spec/metrics/README.md` define the procedure.
Every dictionary entry MUST carry `minimum_stated_decimals`. Calculations use
an integer in `[0, round_to]`; raw size selectors use zero. The dictionary schema
checks the floor/ceiling relationship, and `protocol.ts` mirrors these fields.
A source token `1.20` carries two decimal places; `1.2` carries one.
`1.200e-2` carries five. Percent spellings decode to stored-fraction precision:
Lite `5.50%` and UWX `0.0550` both carry four. Optional display text is not evidence.

A Verifier MUST retain the source precision. Below-minimum or unavailable
precision is unverifiable. Do not silently pad zeroes or obtain precision by
stringifying a parsed number. The formula is evaluated in binary64 without
intermediate rounding. Quantize its unrounded result once at the lower of the
statement precision and `round_to`. At/below the ceiling, compare against the
stated value itself; above it, quantize the statement at the ceiling. Equality
verifies, a finite disagreement fails, and absent/null/refused inputs remain
unverifiable. There is no additional tolerance. For example, `1.24495` at two
decimals is `1.24`; rounding it first to four and then two incorrectly gives
`1.25`. Raw finite size identity remains unrounded and needs no precision token.

### One cash-on-cash

The following expression is identical across all nine existing income entries:

```text
sources_uses.equity_metrics.equity_total == null ? null : (dcf.annual_cash_flows.Y1.net_cash_flow_levered != null ? dcf.annual_cash_flows.Y1.net_cash_flow_levered : noi_model.net_operating_income - debt_structure.annual_debt_service) / sources_uses.equity_metrics.equity_total
```

Y1 is selected by its stated year independently of array order. Zero/negative
flows are preserved; the fallback is lazy and declares no debt role. Missing
total equity stays null; zero equity retains the typed division-by-zero refusal.
Land gains no income metric. No sponsor/LP allocation, loan amortization, cash
projection, owner-cash assembly or debt-tranche summation is introduced.

### Receipts

Receipt §5.2 now requires exact equality of reported quantized outputs at full
`round_to`. This supersedes its old relative tolerance in the reference verifier.
Document metric statements can verify more coarsely without reducing receipt
output or digest precision. The exported historical tolerance constant remains
available, deprecated, and unused by verification.

## Example evidence

All eight changed-class worked examples state NOI, annual debt service and
sponsor equity. **None states `equity_metrics.equity_total` or a Y1 levered flow.**
Do not invent either. Their computed outputs change as follows; none has a
numeric `cash_on_cash` statement selected by the lender fixture:

| Class / example | Prior reported cash-on-cash (fraction) | New result |
|---|---|---|
| office / Riverside | `0.003488` | null |
| retail / Cactus Crossing | `0.051296` | null |
| industrial / Ironwood | `0.043111` | null |
| self_storage / Sonoran | `0.045335` | null |
| hospitality / Saguaro | `0.059674` | null |
| senior_housing / Ocotillo | `0.058396` | null |
| student_housing / Mill Ave | `0.030041` | null |
| mixed_use / Roosevelt Row | `0.048000` | null |

Multifamily is unchanged: both Parkview Extended records have total equity and
Y1 flow; Agave lacks total equity and remains null. Land remains outside the
income metric. No example financial input is added.

Only these four inconsistent stated values are corrected, keeping their original
four-place source precision:

| Example | Address | Before | After | Evidence |
|---|---|---|---|---|
| Agave Court | `quick_metrics.ltv` | `0.4938` | `0.5000` | Stated loan 24,000,000 / stated purchase price 48,000,000. |
| Agave Court | `debt_structure.ltv` | `0.4938` | `0.5000` | Same inputs; appraised value 49,000,000 is not the dictionary denominator. |
| Sonoran Self-Storage | `quick_metrics.dscr` | `1.3153` | `1.3161` | Stated NOI 672,000 / stated annual debt service 510,606, quantized at 4 dp. |
| Sonoran Self-Storage | `debt_structure.dscr` | `1.3153` | `1.3161` | Same inputs and quantization. |

The lender fixture now has **128 verified, 0 failed, 15 unverifiable** statements.
It clears **34 of the 35** prior precision disagreements. Riverside's LTC token
`0.6` is below the proposed two-fractional-decimal minimum and stays unverifiable.
Fourteen previously exact claims also omit required precision: cap-rate copies
in Cactus, Riverside and Sonoran, and LTV copies in Mill Ave, both Parkview
Extended records, Saguaro and Sundance. These are precision findings, not
inconsistent input/value evidence, so their tokens are preserved. Every address,
source precision and outcome is frozen in `conformance/metrics/expected.json`.
The [conformance report](../../conformance/metrics/README.md) lists counts per example.

## Compatibility analysis

Existing records still parse and validate with the same Format 2.0 schema. No
new field is required in a document or module manifest; readers/editors and
private calculations are unaffected. Dictionary consumers must read the added
minimum field and retain source precision when verifying metric statements.
Statements too coarse to satisfy their minimum become unverifiable rather than
being treated as zero or made structurally invalid. Numeric-only callers can use
`compareStatedMetric` with precision supplied by their representation reader;
precision cannot be inferred from a parsed double.

The eight cash-on-cash corrections intentionally change those definitions under
D3. Their pack versions move from 1.0.0 to 1.0.1 following multifamily's correction
precedent; a receipt naming the previous version retains `RCP-06` unverifiable
handling. Correctly issued receipts still agree exactly. Incorrect receipt
results previously accepted under the old tolerance now fail (or are
unverifiable under the existing engine-mismatch precedence). No signature,
canonicalization, input-provenance, rounding default or digest algorithm changes.
Package/Protocol release labels move separately at preparation. No new dependency.

## Conformance impact

- `conformance/metrics/expected.json`: retains every one of 143 addresses, adds
  source precision, changes comparison precision and records the 15 remaining
  findings explicitly. `numeric-tokens.mjs` reads JSON/frontmatter/Lite source
  spellings without packs/defaults/cascade. Existing controls remain.
- Additional metric controls cover trailing zeroes, exponents, escaped keys,
  nested/addressed tokens, content envelopes, insufficient/missing precision,
  output ceilings, no double rounding and common cash-on-cash across nine classes.
  Cent-noise, one-cent tampering, negative ties and missing/type-invalid inputs
  remain negative controls.
- `conformance/receipts/verify/10-rehashed-one-cent` and
  `11-rehashed-subquantum-ratio` prove recomputing a tampered results digest does
  not excuse a disagreement below the obsolete tolerance. Existing receipt
  mismatch precedence and code family remain unchanged.
- Exact dictionary/pack equivalence and size-registry completeness still bind
  every entry. New minimum metadata is validated independently of the engine
  declaration shape. Core/Excel tests cover every income class, stated Y1,
  zero/negative flows, missing equity, lazy fallback and exact output parity.

## Reference implementation

`calc/stated-precision.ts` exports `getStatedDecimals`, `compareStatedMetric` and
`StatedMetricComparison` from core and browser. The comparison is independent
of packs/defaults/cascade and takes an unrounded result plus source precision.
The lender fixture combines only dictionary definitions, readers, the expression
evaluator and this comparison boundary. The eight pack formulas and their Excel
input bindings change together, including mixed-use property inputs. Calc
reporting still quantizes at full `round_to`. Receipts remove the relative
comparison; the old constant is retained for API compatibility.

## Alternatives considered

- Always compare at `round_to`: rejects valid lower-precision statements.
- Round the reported engine value again: double rounding can change the verdict.
- Infer precision or append trailing zeroes: asserts evidence the source lacks.
- Keep sponsor-only equity or infer total equity: contradicts D3 and hides gaps.
- Use the old receipt relative tolerance for document statements: makes a large
  dollar amount's allowed error unrelated to its stated precision.

## Unresolved questions

None for this scope. The 15 example precision findings and eight absent-equity
example gaps remain reported evidence; resolving them requires an explicit
producer statement, not another financial convention. Further metrics and cash
assembly contracts remain separate work.

## Prior art

RFC 0078's independent verification boundary, RFC 0023's quantization contract,
Format §4.19 and the multifamily pack's total-equity correction. Reporting examples
from Fannie Mae, Safehold, Starwood, JLL and Pebblebrook are linked in Decisions;
the minimums are UWMD policy choices based on that practice, not standards imposed
by those organizations.
