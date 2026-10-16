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

### 6. Concrete owner decision proposal

This section is a **decision-ready recommendation**, not an accepted numerical
revision. The choices below narrow the remaining work; choosing a direction does
not fill an unspecified kernel or authorize implementation. No option is selected
by merging investigation evidence while the RFC remains `draft`.

| Decision | Concrete alternatives | Recommendation and consequence |
|---|---|---|
| D1: Guarantee | One exact result/refusal for each admitted input and ordered procedure; or allow multiple answers within an explicit error envelope | Retain one exact result/refusal. Reported-value equality alone is insufficient at quantization ties, and an error envelope would require new comparison/digest semantics. Do not promise that every financial formula is a correctly rounded evaluation of its entire real-valued expression. |
| D2: Positive integer powers | Sequential multiplication; fixed exponentiation-by-squaring graph; or a correctly-rounded power primitive | First compare a fully pinned portable power procedure with a correctly-rounded primitive. Recommend an exact specified answer for integer and fractional powers, not an unmeasured accuracy promise. Sequential discount factors remain a distinct alternative, not an interchangeable optimization. |
| D3: Negative powers | Reciprocal of positive product; product of reciprocals; scaled integer procedure; or the same range-safe correctly-rounded primitive | Require the chosen portable procedure to handle the admitted negative-power range; reject universal reciprocal-of-positive-product because of the demonstrated lost subnormal. Measure a pinned range-safe algorithm against a correctly-rounded alternative before selection. |
| D4: Transcendentals | Fully specified portable approximation algorithm/version; or correctly-rounded mathematical contract with demonstrated implementations | First assess a pinned fdlibm/StrictMath-style procedure against a correctly-rounded alternative, using independent reproduction and accuracy evidence. A procedure-specific exact answer and a mathematically correctly-rounded answer are different guarantees; neither is selected yet. |
| D5: Financial graphs | Preserve current closed-form associations and zero branches; or adopt stability-oriented `log1p`/`expm1`/rearranged formulas | First pin the existing graphs below, replacing only primitive dependencies if approved. Consider stability changes separately after measuring cancellation. Do not silently widen solver domains or call tiny rates zero. |
| D6: Range and resources | Admit the present finite input domain with bounded kernel implementation; or specify narrower admitted domains and exact refusals | Prefer preserving the presently admitted domain where practicable. Any necessary restriction needs an explicit affected-input table and owner approval; the experimental 10,000-step cap is not a limit proposal. Do not mistake the existing AST-node budget for a bound on work inside one builtin. |
| D7: Compatibility | Governed Protocol revision and new engine version with existing receipt wire semantics; or introduce a separately versioned procedure selector/receipt mechanism | Prefer a governed Protocol revision and new verifier engine version, preserving receipt wire/signature subjects unless measured migration needs prove insufficient. Exact revision numbers and supported historical verification paths remain an owner decision. No hidden same-version procedure replacement. |
| D8: Evidence | TS-only or host-power agreement; or frozen vectors plus genuinely independent implementations and platform coverage | Require frozen independent TS/Python evidence, corpus impact and actual scoped spreadsheet recalculation before claiming the corresponding guarantees. A runtime-pinned reference release alone does not close #356. |

#### Immediate owner direction versus engineering completion

The eight rows above separate consequences; they are not eight requests to
approve unspecified algorithms. The immediate architectural choice is whether
to develop the recommended single exact-result contract through a fully pinned,
range-safe algorithm with measured accuracy, or require mathematically
correctly-rounded primitives. First investigate the former against the latter;
bounded sequential discounting remains a separate candidate rather than the
default for every power. Preserve the current
quantizer and solver structure in either proposal; tolerance-based verification
would be a separate compatibility alternative, not an implementation shortcut.
A second owner choice is whether stability-oriented financial rearrangements
belong in this same revision; recommend holding them separately. A third is the
migration policy: recommend existing receipt wire/signature subjects with an
explicitly versioned numerical contract and new verifier engine version; exact
activation and historical support follow measured impact, not a version assigned
in this draft. These direction choices do not accept the RFC.

Kernel selection, complete domains/refusal points, resource evidence and frozen
independent vectors are engineering completion work. Return a concrete restriction
for approval only if preserving today's admitted domain proves impractical; do
not ask the owner to approve an unspecified cap. The established request for
independent evidence is not permission to choose an algorithm from whichever
runtime wins a comparison.

Native spreadsheet power/logarithm functions must be tested against the selected
contract rather than presumed interchangeable with its primitives. Identify the
supported workbook formulas, actual recalculation engine/version and any live
formula versus retained-literal limitations before advertising parity. If a
selected procedure cannot be reproduced through an existing export path, return
that precise compatibility impact for review; do not silently redefine the
financial metric, substitute a cache for independent recalculation, or broaden a
limited spreadsheet observation into a universal Excel guarantee.

#### Feasibility evidence and next bounded study

[Oracle's StrictMath specification](https://docs.oracle.com/en/java/javase/24/docs/api/java.base/java/lang/StrictMath.html)
provides a precedent for specifying reproducible algorithm results using fdlibm
5.3 and explicit arithmetic/bit-conversion rules. It does not establish that
any C build or untested Python/TypeScript port is interchangeable. The original
Netlib sources describe [power](https://netlib.org/fdlibm/e_pow.c) as nearly
rounded and give error analyses for [logarithm](https://netlib.org/fdlibm/e_log.c)
and [exponential](https://netlib.org/fdlibm/e_exp.c); these are not universal
correct-rounding guarantees. A pinned procedure must also close over its
constants, helper functions, bit operations and special cases.

The [MPFR manual](https://mpfr.org/mpfr-current/mpfr.html) demonstrates a
correctly-rounded multiple-precision route, with GMP dependency and explicit
rounding/exponent controls. Its native model does not directly supply binary64
subnormals; emulation requires range configuration and subnormal handling.
This supports using it as a research accuracy oracle, not assuming a lean
browser/runtime dependency or a fixed work bound. Licensing and distribution
also need review before any dependency decision.

The next engineering study should freeze candidate source bytes/hash and the
complete helper closure, develop isolated experimental TS/Python implementations
from the specified procedure independently of each other, and compare algorithm
reproduction and mathematical accuracy separately. Java StrictMath can test the
former candidate; appropriately configured MPFR can test the latter. Freeze
input bytes, measure hard rounding/range cases and complete financial graphs,
and report runtime/browser/package cost and receipt-result changes. Then return
one concrete proposal for owner acceptance. No candidate kernel is implemented
or selected here. Experimental prototypes are research evidence, not changes to
the current evaluator, conformance expectations or financial contract.

#### Candidate primitive meaning and unresolved cases

For the correctly-rounded alternative, let `B(op)` mean one IEEE754 binary64 basic
operation rounded to nearest, ties to even, without contraction, excess-precision
retention, flush-to-zero or reassociation. Input decimal conversion and final
VIII.5 quantization remain separate boundaries. Let `P(x,y)`, `L(x)` and `E(x)`
mean the correctly-rounded binary64 values of their respective mathematical
power, natural-log and exponential functions over their **explicitly admitted
real domains**. Correct rounding is a semantic requirement, not permission to
implement `P` as `E(B(y*L(x)))` or to use any host libm without proof.

This notation alone is not a complete replacement contract. Before acceptance,
the domain table must enumerate finite input requirements, null/type propagation,
positive and negative zero, `0^0`, zero with negative exponents, negative bases
with integer versus fractional exponents, log boundaries, infinity/NaN results,
gradual underflow and signed-zero results. It must distinguish a correctly rounded
zero after genuine underflow from zero caused by an overflowing intermediate.
The evidence does not yet justify a particular library, its hardest rounding
cases or a universal runtime/resource bound. Do not substitute a tolerance for
that missing evidence. Existing null/error behavior outside the agreed change
must remain explicit, rather than being inherited accidentally from a kernel.
The scope manifest must also close over `sqrt` and each affected optional-profile
primitive; deciding three transcendental functions alone does not establish a
whole-Verifier or whole-profile numerical guarantee. Unimplemented optional
profiles must remain unclaimed rather than being counted as tested.

A sequential alternative needs a different exact definition: multiplication
order, exponent domain, maximum work, negative-base parity, overflow/underflow
behavior and every refusal point. Computing a stream's successive positive
discount factors once may avoid quadratic repeated work, but is equivalent to
restarting from one only where the specified intermediate/refusal graph proves
it. A low-level numeric recurrence or kernel is not an iterative financial
solver; acceptance must explicitly reconcile VIII.3's existing iteration wording.

#### Candidate financial operation graphs for review

The following preserves current reference associations as a **proposal**; the
normative financial-name table does not itself establish all of them. `B`
applies to each displayed basic operation, source flows accumulate left to right,
and omitted `fv`/`pv` arguments mean zero only where the builtin already defines
that optional argument. These expressions are not a mandate to generate debt
schedules, select underwriting assumptions or produce a model.

| Function | Exact candidate graph, subject to domain/error approval |
|---|---|
| Periodic NPV | `b=B(1+r)`; for index `t=0..n-1`, `d=P(b,t)`, `term=B(flow[t]/d)`, `sum=B(sum+term)` starting at positive zero. |
| IRR | Existing bracket/endpoints/bisection/tolerances/200-step refusal, using the candidate NPV graph; preserve current multiplication sign tests and midpoint associations. No Newton step, flow normalization or outside-bracket fallback. |
| PMT | If `r==0`, `B(pv/n)`; otherwise `b=B(1+r)`, `d=P(b,-n)`, `den=B(1-d)`, result `B(B(pv*r)/den)`. |
| FV | If `r==0`, `B(pv+B(pmt*n))`; otherwise `g=P(B(1+r),n)`, `a=B(pv*g)`, `c=B(B(pmt*B(g-1))/r)`, result `B(a+c)`. |
| PV | If `r==0`, `B(B(pmt*n)+fv)`; otherwise `d=P(B(1+r),-n)`, `a=B(B(pmt*B(1-d))/r)`, `c=B(fv*d)`, result `B(a+c)`. |
| NPER | If `r==0`, `B(B(pv-fv)/pmt)`; otherwise `a=B(pmt-B(fv*r))`, `b=B(pmt-B(pv*r))`, `q=B(a/b)`, `den=L(B(1+r))`, result `B(L(q)/den)`. Retain closed form; no iterative amortization search. |
| XNPV | Existing integer day count divided last into binary64 `t`; `b=B(1+r)`, `term=B(amount*P(b,-t))`, left-to-right binary64 sum. Do not replace multiplication by division, even at integer-looking `t`. |
| XIRR | Existing VIII.9.3 solver, using the candidate XNPV graph; no native Excel solver substitution. |

Domains and error timing are a separate acceptance item. In particular, PMT's
current source rejects zero periods but does not actually reject every negative
period; the error's “n must be >0” prose is not evidence of a complete normative
domain. Do not classify a fractional-period observation as an ordinary mortgage
counterexample or silently make periods positive integers. Specify admitted
negative/fractional periods for each annuity builtin, the `r<=-1` cases and real
solution conditions, and nonfinite intermediate versus final-value handling.
IRR/XIRR's pinned bracket-failure and exact endpoint behavior remain their own
rules, not generic primitive-error defaults. Preserve the distinction between
an asserted result the pinned procedure refuses and inputs that cannot be
verified; selecting a kernel must not silently reclassify either verdict.

A correctly-rounded primitive does not remove cancellation in `1+r`, `1-d`,
`g-1` or the log quotient. For example, a sufficiently small nonzero `r` may make
`B(1+r)==1`; taking the zero-rate branch based on that comparison would change
the graph. Preserve the exact `r==0` branch in the initial proposal, measure these
cases, and return the approved refusal when the procedure cannot return a finite
value. Any stabilized alternative requires a separate explicit graph, accuracy
objective and impact table. It cannot be smuggled in as an implementation of the
same ordered expression.

### 7. Acceptance checkpoints versus implementation gates

1. **Owner direction checkpoint:** choose D1–D8 or request an explicit alternative.
   This authorizes completing a selected proposal, not implementation or changing
   RFC status. The recommendation is exact ordered results, a feasibility comparison of
   pinned range-safe procedures against correctly-rounded primitives, preserved
   financial graphs and receipt wire/signature subjects. No primitive or accuracy
   contract is selected before the evidence/domain decisions described above.
2. **RFC acceptance checkpoint:** return one complete primitive/domain/error and
   resource contract, selected kernel or implementable correctly-rounded strategy,
   admitted annuity domains, special-case table, exact financial graphs, numeric
   boundary/quantization rules, affected-contract manifest and receipt migration.
   No “TBD kernel” or host-dependent escape hatch may remain in the normative
   guarantee. The owner explicitly accepts that complete revision under governance.
3. **Implementation and evidence gate:** only after acceptance, implement the
   chosen contract in independent TS/Python paths; add approved conformance cases;
   measure every changed result/refusal over existing corpus and supported
   consumers; run package/receipt/Excel gates. Merging this evidence-only draft
   neither opens this gate nor changes any conformance expectation.
4. **Claim/publication gate:** require the actual independent-platform evidence
   for every advertised scope, owner-approved compatibility/version activation
   and release authorization. Documentation can disclose current limitations in
   the meantime. No 5.0 preparation, acceptance or publication follows implicitly.

Frozen evidence must identify exact input bytes and their hash, binary64 operand
and expected-result encodings (including signed zero/subnormal cases), declared
precision and expected public result/refusal, operation-graph/kernel revision,
independent oracle derivation, and tested runtime/OS/architecture. Include the
existing observed differences as counterexamples, not answers selected by a
majority of hosts. Independently establish hard rounding cases with justified
bounds; the current 100-digit diagnostic is not a universal correct-rounding
proof. Keep raw primitive vectors, composed financial graphs, final quantization,
public assertions and receipt digests as separate layers so one agreeing digest
does not hide an untested branch or refusal.

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

### Receipt compatibility cases to approve and demonstrate

A new numerical procedure needs a new `@uwmd/verify` engine **version**, not an
invented engine name or runtime identity field. Exact dependent pins and receipt
fixture changes belong to the later approved implementation/release work. A
Protocol change also needs an explicit source/module compatibility plan under
the current supported-version policy; merely incrementing a package does not
amend the normative contract.

| Reverification case | Existing-rule consequence to preserve / required evidence |
|---|---|
| Original source bytes, payload hashes or document signature | Numerical changes do not rewrite them. Preserve the original artifacts and verify their existing subjects independently of recomputation. |
| Receipt format/digest/signature fails an earlier check | Preserve that existing precedence; a new engine must not turn damaged or invalidly signed evidence into an RCP-07 escape. |
| Same engine identity, changed-runtime recomputation disagrees | Existing different-engine RCP-07 does not cover this demonstrated problem. Disclose it; do not retroactively change the stored identity or infer an original runtime from its version. |
| Different engine versions, recomputation agrees | Version difference alone does not establish unverifiability; follow existing receipt checks. |
| Different engine versions, recomputation disagrees | Apply existing RCP-07 subject to preceding checks; distinguish authenticated original receipt evidence from independently reproduced financial results. |
| Archived old evaluator used for historical reproduction | Record exact evaluator/runtime evidence separately. It can reproduce a chosen environment but cannot prove the old host-power contract was portable. Do not add automatic fallback or claim historical identity without this evidence. |

Recommend retaining the current receipt wire format initially. If supporting two
numerical regimes requires a selector or schema change after compatibility
measurement, return that precise contract for separate owner approval. No
historical receipt may be reissued or rewritten solely to remove a disagreement;
newly issued evidence must be distinguishable from the original.

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

1. Resolve D1–D8 at the owner direction checkpoint (§6), including the accuracy objective for a pinned portable procedure versus
   correctly-rounded primitives; sequential discounting is a separate option.
   This chooses proposal development, not RFC acceptance.
2. At the separate acceptance checkpoint (§7), approve a complete kernel,
   special-case/domain/resource/error table and financial graphs. The recommended
   primitive contract is not complete until these details and evidence exist.
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
