---
rfc: 0088
title: Resolve financial power and transcendental reproducibility
status: draft
author: UW Markdown Working Group
created: 2026-10-15
affects:
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0088: Resolve financial power and transcendental reproducibility

## Summary

Investigate and resolve [Issue #356](https://github.com/UWMD-OSP/UW-Markdown/issues/356)
independently of the optional stated-result assurance profile in #355. Preserve
RFC0078's verifier/product boundary and RFC0083's package split. This draft
proposes explicit ordered numeric procedures and range contracts before claiming
cross-runtime identity. It does **not** select or implement the issue's suggested
running-product rule, fractional-power concession, or new validation obligation.
Existing Protocol4.1.0, Format3.0, receipts and expectations remain unchanged.

## Motivation

Protocol VIII.3 pins IRR's bracket/bisection but leaves exponentiation implicit.
VIII.9.2/9.3 likewise depend on fractional powers. VIII.5's final quantization
cannot guarantee equality when upstream values straddle a rounding boundary.

The same compiled current-main verifier at a18ed8ee produces the following through
the actual `evaluateCalc` boundary, not just a host-language math demonstration:

| Declaration | Node18.0/18.20/20.0/20.20/22.23 | Node24.21 |
|---|---|---|
| `pow(1.2,31)`, `round_to:12` | 284.851576559723 | 284.851576559724 |
| Existing results-array SHA-256 | `61ccb1ceeb458dbd3bad9aa381effd8d6e826a2bf77b53435d76228267f084c4` | `5ea98e7cfada4cf05903ec3492ddcc733888d3c4f5f65242602d46fea80d55f2` |

IRR over `[-1, ...19 zeroes, 6.727499949325601e20]` refuses on Node20/22 and
returns10 on Node24. These are synthetic boundary controls, not a frequency
estimate or reproduction of the adopter's unavailable private deal. An independent
Python3.12 arithmetic oracle agrees with Node24 for the finite tested cases;
this is neither a full independent Verifier nor multi-platform proof.
See the [initial evidence](https://github.com/UWMD-OSP/UW-Markdown/issues/356#issuecomment-6206424881).
Reproduction, observations and limitations are recorded in
`docs/reviews/2026-10-15-numerical-determinism-356.md` and its adjacent scripts.

The implementation dependency is legitimate but a conforming reference engine
cannot settle unspecified normative arithmetic by itself. Choosing another
answer is a governed contract change, not a routine bug fix.

## Proposed change

### 1. Scope and operation inventory

| Surface | Current contract / risk | Required decision before implementation |
|---|---|---|
| `npv`, internal periodic IRR NPV | VIII.3 `sum flows[t]/(1+r)^t`; IRR endpoints, order and stopping pinned | Integer discount-factor procedure, left-to-right accumulation, finite/range semantics; do not substitute reciprocal multiplication for division without deciding its rounding |
| `pmt`, `pv`, `fv` | Closed form required; table gives financial names but not complete scalar expressions/association/domain | Pin exact closed forms, signs, operation order, zero-rate branch, integer/fractional/negative period domains; changing debt balances/ADS is consequential |
| `nper` | Explicit log quotient, binary64, zero/domain boundary behavior needs complete specification | Pin log, operation order, cancellation behavior, zero-rate/refusal cases; no iterative replacement |
| `pow` | `base ** exp`, nonfinite refusal | Finite domain, signed zero, negative base/integer exponent, zero exponent, range, integer/fractional split and resource bounds |
| `xnpv`, `xirr` | VIII.9 ordered amount times negative power over exact day-count-derived exponent | Fractional/negative power procedure; preserve multiplication versus division choice; pin XIRR's existing solver and errors |
| `log`, `exp` | Host transcendental functions | Exact portable procedure or correctly-rounded requirement with independent evidence |
| `sqrt`, stochastic profiles, expression powers | Related numeric consumers | Inventory downstream reach; do not claim integer discounting resolves every function/profile |
| Quantization | VIII.5 once, VIII.5.1 source precision | Preserve the quantizer and defaults; test adjacent ties, negative ties, overflow and token precision; do not add tolerance |

### 2. Candidate normative language — deliberately not accepted

The final accepted revision must replace symbolic powers with an exact operation
graph for every admitted domain. The following is a **candidate for bounded
nonnegative integer discounting**, not approved replacement specification:

> For a nonnegative integer exponent n in the admitted finite domain, compute
> b = binary64(1 + rate), d = 1. For k = 1 through n, set d = binary64(d * b).
> The term MUST be binary64(amount / d). Terms MUST be added to an accumulator
> initially zero in source order. Hosts MUST NOT use power-by-squaring, library
> pow, fused multiply-add, reassociation, or a rounded intermediate substitute.

This requires an explicit resource/range domain before acceptance. A counter
bounded only by safe-integer n is not a usable hostile-input contract. The
experiment's 10,000-step cap is **not** a proposed standard limit. Finite inputs
can still yield overflowing products, underflowing denominators, cancellation,
or nonfinite sums. Decide which existing error applies and where it is tested;
do not silently return zero, extend the root bracket, or weaken the stop rule.
An all-zero stream and endpoint-root cases must retain their explicit semantics.
VIII.3 also currently says only IRR/XIRR may iterate. An accepted recurrence
must explicitly reconcile that sentence: a bounded numeric primitive is not a
new iterative financial solver, but that distinction cannot be left implicit.
No iterative NPER or amortization-schedule solver is authorized by this draft.

### 3. Negative powers and accuracy are separate

The issue's `1 / positive_product(b,n)` loses a representable subnormal:
`(1e155)^(-2)` is near1e-310, but `b*b` overflows, yielding reciprocal0.
`product(1/b,n)` avoids that particular overflow but rounds differently and can
accumulate error. Exponentiation by squaring is efficient but another procedure.
An exponent-scaled significand/exponent implementation could preserve range, but
its renormalization, rounding and final underflow must be fully pinned.

Recommend assessing bounded positive discounting independently, then selecting a
range-safe negative-power procedure with exact vectors. Do **not** impose a
universal reciprocal rule now. PMT/PV/FV cannot be changed merely by replacing
one operator while leaving allowed periods and parentheses implicit.

Determinism does not imply best numerical accuracy. A 100-digit Decimal control
over the exact binary64 input shows the candidate repeated product for
`1.00000001^10000` about2.46 native ULP from the high-precision value versus
about0.46 for this platform's power. Near-zero rates also cause cancellation in
`1-(1+r)^(-n)` and division by tiny r. `log1p`/`expm1` may improve stability but
would introduce new procedures and require acceptance; they are not silent fixes.

### 4. Fractional powers / logarithms

Recommended objective: a portable deterministic numerical kernel, with an exact
algorithm/version or correctly-rounded contract and demonstrated implementations.
Evaluate dependency footprint, licensing, browser/Python availability, special
cases, decimal-to-binary conversion and subnormals before selecting a kernel.
`exp(y*log(x))` is not equivalent to correctly rounded pow without its own ordered
definition. Merely naming libm or a runtime version is insufficient for a
language-neutral standard. This draft selects no library.

Reject a blanket promise that equality after quantization is automatic. Adjacent
values can straddle an admitted tie. Permitting two quantized answers requires
explicit new comparison/receipt semantics; it would contradict exact digest and
parity promises unless those are also governed changes. Do not use an unstated
tolerance, label a disagreed assertion verified, or pretend restricting only
display precision fixes the issue. A temporary documented runtime limitation is
evidence management, not normative cross-runtime conformance.

### 5. Acceptance prerequisites

Before acceptance, this draft needs a complete operation/domain/error table;
chosen negative and fractional procedures; resource bounds; independently generated
known-answer vectors; compatibility measurements over current corpus/deals; and
the numerical guarantee the standard actually promises. The current observation
archive contains aggregate counts and selected first examples, not the full
experimental stream. Some stress inputs are generated with Python native power;
freeze exact input bytes with an input digest and generation provenance before
promoting any experiment to normative vectors. Expected answers must then follow
the accepted procedure, not whichever host generated the stress input. The
concrete candidate above is intentionally narrower than a complete replacement
numeric contract.

## Compatibility analysis

- **Reader / source identity:** parsing, original payloads, source bytes, block
  hashes and document-signature subjects do not change. A changed recomputation
  must never rewrite signed historical data. Old documents can remain readable
  while their asserted calculations need version-aware evaluation.
- **Verifier:** replacing powers changes permitted raw/quantized values and even
  solver refusals. Normative Protocol revision and independent package versions
  must be chosen under current policy after impact measurements, not concealed
  as a non-normative formula cleanup. This RFC does not assign release versions.
- **Receipts:** VIII.5 already requires quantized calc-result digests. The observed
  public-boundary result changes that digest even without unquantized signing.
  Same engine/version under another runtime can currently disagree and be blamed
  as failure. An eventual kernel change requires a new verifier engine identity
  and exact dependent pins; existing Receipt5.3 RCP-07 handles a disagreement
  across different engine identities subject to existing precedence. Different
  engine identity alone does not make an agreeing receipt unverifiable. No new
  runtime field, signature domain or receipt wire version is presumed. If one is
  needed, specify it separately and obtain owner approval.
- **Modules / profiles / consumers:** expressions and downstream debt/returns can
  change even if schemas do not. Inventory current dictionary/packs, optional
  profiles, browser consumers and Excel emission. A package boundary cannot make
  incompatible normative arithmetic optional. No new generation capability is
  required from adopters. Historical Tier3 names in the template are replaced by
  today's Reader/Verifier and optional-profile model.
- **Migration:** retain old receipt/source artifacts unchanged, publish measured
  old/new results and refusal differences, version the accepted contract honestly,
  and identify supported verification histories. Do not rewrite conformance to
  bless one host's observations. Timing remains owner-controlled; no 5.0 release
  preparation is authorized.

## Conformance impact

No expected output changes are authorized in this draft. Before implementation,
produce an exact manifest of affected existing `conformance/calc/`, dated-flow,
receipt and profile cases. Candidate-versus-current experiments are not that
normative manifest and do not replace it.

Proposed positive/negative controls:

1. Existing cross-runtime power/quantization/result-digest case above, plus the
   exact IRR endpoint/refusal and stressed cancellation inputs.
2. Nonnegative exponent0/1, negative bases with admitted integer exponent, signed
   zero, negative exponent, representable subnormal, overflowing intermediate,
   underflow, nonfinite final and bounded-resource refusal.
3. Left-to-right sum and term operation order; same-date/source order; no FMA or
   algebraic transformation; scaling flows can affect the fixed value tolerance
   and must not be silently normalized.
4. Positive/negative rounding ties and their immediate binary64 neighbors at
   money/rate/ratio/custom precision; source-token precision and no double round.
5. PMT/PV/FV zero/tiny/negative rates, fractional/negative periods only if admitted,
   long maturities, NPER zero/domain/log cancellation, with finite/error controls.
6. Dated XNPV/XIRR at leap days and irregular dates; integer-looking year fractions
   do not authorize changing amount-times-negative-power to division.
7. Independent Python and TS kernel vectors on multiple runtimes/OS/architectures;
   portable driver wrapping Node does not count as independent verification.
8. Old/new engine receipt agreement, cross-engine disagreement RCP-07, same-engine
   disagreement, result digest/signature preservation and historical source checks.
9. Actual spreadsheet recalculation for supported claims with its engine/version;
   native Excel XIRR does not override UWMD's pinned solver. Cached values are not
   recalculation evidence.

## Reference implementation

Follow-up only after acceptance: `@uwmd/verify`'s `calc/builtins.ts`, numeric
kernel if selected, `cash-flow-series.ts` and dependent procedures. Core
re-exports verify; no model-generation engine or new package is proposed.
Public exports and error changes must be enumerated in that implementation PR.

Current draft contains read-only observation scripts and an incomplete independent
Python seed (quantization/calendar/ordered cash totals), not replacement TS
financial code. It claims neither calc-evaluate nor Reader/Verifier conformance.
The Python numeric oracle is an experiment, not an alternative accepted solver.

## Alternatives considered

- **Keep host pow and claim bit identity:** contradicted by the measured case.
- **Pin Node or copy reference outputs into Python:** useful environment pinning
  for reproducibility of one tool, not independent standard implementation.
- **Universal sequential product:** fixes operation order but not all domains,
  negative-power range, stability or fractional functions.
- **Correctly-rounded kernel everywhere, including integer powers:** potentially
  stronger accuracy and range than a product rule, at implementation cost; must
  compare against ordered-product contract and existing expectations.
- **Quantized-only or tolerant identity:** not a shortcut around boundary cases;
  would need explicit weaker verification/digest semantics and owner approval.
- **Generate a full underwriting engine:** unrelated to closing this numeric
  contract gap and inconsistent with the agreed scope of #355.

## Unresolved questions

1. Choose the numerical guarantee and complete integer/negative/fractional/log/exp
   contract, including accuracy objectives versus reproducible operation order.
2. Approve exact domains/resource bounds/error behavior where the current text is
   incomplete; confirm whether stronger correctness requires dependency choices.
3. Choose compatibility activation and versioning after measurements, including
   historical receipt verification support. No old receipt may be rewritten.
4. Approve independent-platform and spreadsheet evidence required for advertised
   guarantees before the coordinated launch; no artificial release deadline.

The owner has authorized this investigation, **not accepted these choices**.
RFC0085 provenance and RFC0086/0087 financial reconciliation remain separate
draft workstreams. Narrow #355 assertion/ledger assurance uses the chosen kernel
only after acceptance and does not reopen RFC0078.

## Prior art

- [ECMA-262 Number::exponentiate](https://tc39.es/ecma262/multipage/ecmascript-data-types-and-values.html#sec-numeric-types-number-exponentiate)
  permits implementation-approximated exponentiation; it does not pin a UWMD
  cross-runtime answer.
- [Python math documentation](https://docs.python.org/3/library/math.html)
  describes platform C-library wrapping; a Python implementation alone does not
  select a portable transcendental algorithm.
- RFC0023, RFC0024 and RFC0034 establish final quantization and solver/day-count
  procedures. This proposal closes their demonstrated dependency gap rather than
  treating outside modeling conventions as authority.
