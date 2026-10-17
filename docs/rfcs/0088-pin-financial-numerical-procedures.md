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

The concrete comparison in section 6 now recommends developing one pinned
procedure across positive, negative and fractional exponents. Its bounded integer
alternative remains distinct. Do **not** impose a universal reciprocal rule now.
PMT/PV/FV cannot be changed merely by replacing
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
language-neutral standard. The owner provisionally prefers A for further isolated evaluation; no procedure is accepted for production.

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
| D2: Positive integer powers | Sequential multiplication; fixed exponentiation-by-squaring graph; or a correctly-rounded power primitive | Develop candidate A below: one exact pinned fdlibm procedure for all exponent classes, with measured accuracy. Candidate B is the concrete correctly-rounded alternative if that stronger objective is required. Sequential discount factors remain a distinct alternative, not an interchangeable optimization. |
| D3: Negative powers | Reciprocal of positive product; product of reciprocals; scaled integer procedure; or the same range-safe correctly-rounded primitive | Use the same selected A/B primitive for negative powers; reject universal reciprocal-of-positive-product because of the demonstrated lost subnormal. C pins reciprocal-first squaring but changes rounding and still needs A for fractional powers. |
| D4: Transcendentals | Fully specified portable approximation algorithm/version; or correctly-rounded mathematical contract with demonstrated implementations | Compare the exact eight-file fdlibm closure (A) against the MPFR4.2.2/GMP6.3.0 adapter (B) below. Recommend A proposal completion; universal correct rounding would select a distinct B guarantee. Neither is accepted. |
| D5: Financial graphs | Preserve current closed-form associations and zero branches; or adopt stability-oriented `log1p`/`expm1`/rearranged formulas | First pin the existing graphs below, replacing only primitive dependencies if approved. Consider stability changes separately after measuring cancellation. Do not silently widen solver domains or call tiny rates zero. |
| D6: Range and resources | Admit the present finite input domain with bounded kernel implementation; or specify narrower admitted domains and exact refusals | Prefer preserving the presently admitted domain where practicable. Any necessary restriction needs an explicit affected-input table and owner approval; the experimental 10,000-step cap is not a limit proposal. Do not mistake the existing AST-node budget for a bound on work inside one builtin. |
| D7: Compatibility | Governed Protocol revision and new engine version with existing receipt wire semantics; or introduce a separately versioned procedure selector/receipt mechanism | Prefer a governed Protocol revision and new verifier engine version, preserving receipt wire/signature subjects unless measured migration needs prove insufficient. Exact revisions and activation remain an owner decision. Follow the pre-release clean break; no legacy evaluator or hidden same-version procedure replacement. |
| D8: Evidence | TS-only or host-power agreement; or frozen vectors plus genuinely independent implementations and platform coverage | Require frozen independent TS/Python evidence, corpus impact and actual scoped spreadsheet recalculation before claiming the corresponding guarantees. A runtime-pinned reference release alone does not close #356. |

#### Immediate owner direction versus engineering completion

The eight rows above separate consequences; they are not eight requests to
approve unspecified algorithms. The smallest architectural choice is now concrete:
**develop A's exact pinned fdlibm procedure, or require B's correctly-rounded
primitives through the specified MPFR binary64 adapter**. Recommend A, conditional
on complete independent ports, accuracy and domain/resource evidence. C's integer
hybrid is executable but not recommended as a distinct contract without measured
benefit; it still requires A's fractional/log/exp closure. Choosing an architecture
authorizes completing the proposal, not activating it or accepting this RFC.

Keep financial associations, the quantizer and solver unchanged in either path.
Stability-oriented log1p/expm1 rearrangements remain a separate explicit decision.
Retain current receipt wire/signature subjects with a new verifier engine version
and governed Protocol revision after impact measurement. Follow the owner's
pre-release clean break without historical evaluator fallbacks or compatibility
layers. Exact versions and activation remain owner-controlled.

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

The [MPFR 4.2.2 manual](https://www.mpfr.org/mpfr-4.2.2/mpfr.html) demonstrates a
correctly-rounded multiple-precision route, with GMP dependency and explicit
rounding/exponent controls. Its native model does not directly supply binary64
subnormals; emulation requires range configuration and subnormal handling.
This supports using it as a research accuracy oracle, not assuming a lean
browser/runtime dependency or a fixed work bound. Licensing and distribution
also need review before any dependency decision.

The source identities are now frozen in the source-only closure study and the
concrete comparison below. The next implementation study must complete independent
isolated TS/Python ports of the selected proposal, reproduce exact procedure
outputs and compare mathematical accuracy separately. A correctly configured
MPFR adapter is a candidate accuracy reference, not an already executed oracle.
Keep input hashes, hard rounding/range cases, complete financial graphs and
runtime/browser/package costs distinct from receipt-result impact. No complete
A/B kernel is implemented or selected here, and the prototypes change no current
evaluator or conformance expectation.

The [candidate-source closure study](https://github.com/UWMD-OSP/UW-Markdown/blob/main/docs/reviews/2026-10-15-fdlibm-closure-356.md)
now freezes eight exact Netlib source hashes and identifies the power helper
closure, conditional fixed-word resource bound and required bit-adapter rules.
Power includes a square-root fast path and a scaling/copy-sign dependency;
porting only three transcendental bodies would leave that candidate incomplete.
This source-only result does not select a kernel, establish accuracy, certify a
port or replace the outstanding domain/error and independent-vector evidence.
The linked study now also provides isolated independent JS/Python word-adapter
experiments and fixed bit-pattern tests for extraction/insertion, signed words,
whole-word shifts and carry/borrow. These are prerequisite research only; no
complete numerical kernel or financial expected answer is supplied.

#### Actual procedure alternatives — owner recommendation, not acceptance

The [concrete procedure comparison and new integer lab](https://github.com/UWMD-OSP/UW-Markdown/blob/0be37dd2e13491e6840ed81f1de3da8a49efbee8/experiments/numerical-0088/integer-dispatch/README.md)
specify the following concrete design alternatives. Their **implementation/evidence
status differs**; a specified API adapter is not executable evidence. The lab
includes exact source/archive hashes, special/domain tables, conversion and work
limits, cost/license feasibility, old frozen counterexamples and acceptance tests.

| Candidate | Exact procedure and integer/negative convention | Status and consequence |
|---|---|---|
| **A — recommended proposal direction** | The exact eight-file Netlib closure, including `e_pow.c` SHA-256 `763b86baa63eb3518b43f7f3e44e5ed10992b62650f4a45c3a2ea6015e6d5122`, with explicit binary64 constants, basic-operation boundaries and defined word-site mapping. Call `__ieee754_pow` for integral and fractional exponents, including its pinned +1/-1/+2/+0.5 fast paths, split log2/general exponential graph, huge-exponent branches and scaling; log/exp use their separate pinned bodies. No running-product or universal reciprocal substitution. | The full isolated JavaScript raw closure now exists, including fractional powers, exact constants and software helpers. Independent mathematical/native/corpus evidence is separately scoped below; a full independent Python kernel and whole-domain accuracy/consumer proof remain incomplete. Guarantee is exact procedure output, **not** universal mathematical correct rounding. |
| **B — if primitive correct rounding is required** | MPFR **4.2.2** / GMP **6.3.0**, exact binary64-word loading, destination precision 53, exponent range emin=-1073/emax=1024 set before operations, named `mpfr_pow`/`mpfr_log`/`mpfr_exp` with MPFR_RNDN, **actual operation ternary** passed to `mpfr_subnormalize`, then exact word encoding. No integer-width cast, powr, host libm or exp(y*log(x)) substitute. | Correct-rounding API contract, not a verified implementation: unpatched4.2.2 and the reduced-range adapter are unexecuted, with upstream BUGS and exact patch applicability unresolved. Actual range/subnormal/counterexample tests are required; precision 53 alone cannot establish this guarantee. Internal Ziv precision growth/allocation has no demonstrated universal hostile-input bound. Native/Wasm packaging, license and independent adapter tests remain required. |
| **C — explicit hybrid, not recommended without measured benefit** | For every exactly integral finite binary64 y, decode its full exact integer magnitude, form f=B(1/x) first for negative y, then binary squaring with ordered accumulator multiplies and no unused final square; immediately refuse any nonfinite basic result. Fractional powers and log/exp use exactly A. | Only C's integer branch is wired in its lab; the separate new A prototype does not establish a complete tested hybrid. At most1024 loop iterations /1077 basic operations, without a 256 cap or safe-integer restriction. Distinct rounding/refusal semantics; no measured bundle or speed saving justifies a separate contract. |

Recommend **A across all exponent classes**, rather than adding C merely because
its integer implementation is shorter. A's general fractional power already
needs the same helper closure; C does not remove that dependency and introduces
a different graph at integer exponents. Frozen reciprocal-first versus one-rounded
power controls disagree (1.1^-31 gives words `3faaacadc6ed30d0` versus
`3faaacadc6ed30ca`). Earlier money/IRR controls already prove that changing an
integer graph can change reported values and endpoint/refusal branches. Those
are comparisons of existing experimental graphs, **not measured A-versus-B
outputs**. No source comment or host vote is a substitute for that pending test.

For B, source provenance pins MPFR archive SHA-256
`b67ba0383ef7e8a8563734e2e889ef5ec3c3b898a01d00fa0a6869ad81c6ce01`
and GMP archive SHA-256
`a3c2b80201b89e68616f4ad30bc66aee4927c3ce50e33929ca819d5c43538898`,
plus exact manual, implementation and license member hashes. Archives were read
inertly with verified HTTPS; upstream release signatures were not checked. No
library is installed or added as a dependency. MPFR LGPL v3-or-later, GMP's dual
license, browser/native distribution cost and context isolation require review.
A preserves the original Sun notice; no port or bundle-size claim follows from
its 43,025 source bytes.

The specified B adapter decodes each normal/subnormal word as signed integer
significand times an exact power of two, loads with `mpfr_set_z_2exp` and handles
signed zero separately. After the selected operation, subnormal rounding must
retain its actual ternary; an arbitrary precision 53 approximation followed by
`mpfr_get_d` is **not** the proposed correctly-rounded procedure. With u=2^-1074,
exact v=1.5u-2^-1128 rounds to u; precision 53 then naïve double conversion rounds
to 2u. The new rational control proves that hazard without claiming MPFR execution
or a pow/log/exp input producing v. Final finite MPFR output is encoded through
exact `mpfr_get_z_2exp` integer shifts (no nonzero discarded bits), with zero sign
preserved. Actual primitive boundary vectors must still test the adapter.

All three designs preserve the explicit financial operation table in this RFC:
periodic amount/divisor remains distinct from dated amount*negative-power;
primitive nearest/even remains distinct from final VIII.5 decimal-string
half-away quantization. IRR/XIRR bracket, endpoint precedence, stopping criteria
and tolerances remain unchanged. A complete solver trajectory is not supplied by
the endpoint-only lab. Existing RCP-07 precedence and its same-engine disagreement
gap remain disclosed; numerical changes neither rewrite source/signature subjects
nor historical receipts. Follow a versioned clean break, with no legacy evaluator,
new runtime field or compatibility shell inferred from this comparison.

Acceptance tests must cover complete independent word/constant/site maps, each
kernel's real special/range branches and hard mathematical rounding certificates;
B must fail a ternary-discarding subnormal-adapter mutant. Add full financial
trajectories, final quantizer neighbors, affected current-corpus manifests,
public assertion/result-array/receipt cases and actual supported spreadsheet
recalculation. Measure the selected implementation on supported runtimes/OS and
architectures with retained hashes/versions/failures. Six new Python methods and
24 independent JS classification/result/trace records pass on one Windows AMD64
host (Python3.12.3, Node24.14.1); this proves neither complete A/B/C portability
nor the pending integrator CI matrix. Architecture direction, final RFC acceptance,
implementation conformance and publication remain separate checkpoints.

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

#### Executable dispatch and graph alternatives — still unaccepted

The isolated [power procedure lab](https://github.com/UWMD-OSP/UW-Markdown/blob/0be37dd2e13491e6840ed81f1de3da8a49efbee8/experiments/numerical-0088/power-procedures/README.md)
now freezes 40 binary64 operand pairs and compares three fully ordered integer
graphs: sequential products with reciprocal last, binary squaring with reciprocal
last, and binary squaring with reciprocal first. All round each basic operation
to binary64 and stop at the first nonfinite intermediate under an explicit
**experimental** refusal policy. The 256-step exponent admission is only a lab
budget, not a proposed standard limit. No graph is selected for a financial name.

A separate exact-rational oracle establishes one-rounded mathematical answers
for the bounded dyadic-exponent controls by comparing exact adjacent binary64
midpoints; it uses no host pow, libm, Decimal precision guess or reference-engine
output. General fractional exponents remain explicitly outside its evidence
scope, and the candidate runner reports `fractional_kernel_required` rather
than substituting a host power. Frozen words, oracle-source/input hashes, exact
root certificates, operation counts and per-step trace hashes make the finite
research evidence reproducible. Independent JS graph execution matches the
rationally derived 120 frozen graph results/traces on the measured Windows host;
this is neither a complete portable kernel nor independent financial conformance.

The lab makes signed-zero/exponent-zero, huge integer parity, negative fractional
domain, reciprocal placement, subnormal ties, unused-square overflow and
nearest/even primitive rounding concrete alternatives for review. Its finite
negative-power counterexample distinguishes intermediate-range refusal from
mathematical final underflow. Squaring and sequential graphs can differ from
each other and from correctly rounded power. Agreement on a handful of roots
cannot settle the general fractional/log/exp implementation or accuracy contract.

NPV/IRR still require composed graph/endpoint/refusal evidence, and final VIII.5
quantization must be tested independently of primitive nearest/even rounding.
No solver, quantizer, financial expectation, receipt subject, source/block hash,
engine identity, RFC status or release version changes. Existing receipt checks
retain their precedence; no historical fallback evaluator, automatic rehash or
new runtime identity is proposed. See the lab's measured limits before treating
any row as an acceptance-ready whole-domain guarantee.

#### Composed endpoint and reporting controls — not a complete solver

The [cash-graph follow-up](https://github.com/UWMD-OSP/UW-Markdown/blob/0be37dd2e13491e6840ed81f1de3da8a49efbee8/experiments/numerical-0088/cash-graphs/README.md)
freezes ten synthetic cash vectors and ten reporting controls independently from
exact rational arithmetic. Three candidate power graphs feed source-ordered
periodic division and the existing IRR bracket/product/endpoint checks. Complete
financial intermediate words and nested primitive-trace hashes are retained.
No bisection executes: a case needing it reports `bisection_required` without
claiming a root, result or digest. Dated prederived year fractions retain
amount-times-negative-power, with the missing fractional kernel explicit.

A deliberately constructed money-boundary pair changes reported values from
1.00 to 1.01 and from -1.00 to -1.01 across graphs. The lab separately freezes
the resulting canonical result-array bytes/digests under the existing VIII.5
decimal-string-shift boundary. Its rational shortest-decimal derivation is not
Python repr, exact-binary decimal rounding or a new production quantizer. Other
controls expose endpoint 10 versus no bracket, source-order cancellation and
subnormal reporting versus intermediate refusal. These are synthetic candidate
consequences, not prevalence estimates, actual issued receipts or accepted
financial expected answers.

Five new Python methods and two JS tests pass the new traces/reporting controls
on one Windows AMD64 host. The README proposes frozen-data checks over supported
Node/Python/runtime/OS combinations for an integrator checkpoint; that coverage
has not run here and is not inferred from existing production CI. No previous
audit/lab/full suite was repeated. Receipt precedence, the same-engine runtime
gap and clean-break compatibility remain as stated below; source/block/signature
subjects and existing artifacts are not rewritten. General fractional kernels,
complete solver trajectories, corpus impact and actual spreadsheet evidence
remain distinct acceptance work.

### 7. Research, acceptance and production are separate gates

1. **Provisional direction:** the owner prefers A for further isolated evaluation.
   B remains an alternative if correctly rounded primitives prove necessary; C
   has not demonstrated sufficient benefit. This is not RFC acceptance or
   authorization for production integration or activation.
2. **Independent pre-acceptance research:** complete an isolated executable
   procedure, exact constants/word maps, domains, exception/public-refusal rules
   and deterministic resource analysis. Independently exercise it against
   pinned reference implementations and mathematical certificates over declared
   domains. Retain complete inputs, words, failures and exact source/runtime/
   platform/compiler identity. Measure financial trajectories, existing-corpus
   results AND refusals, reporting boundaries and receipt compatibility BEFORE
   the owner evaluates acceptance. Do not activate or rebaseline to do research.
3. **Owner acceptance:** return a complete evidenced revision with no TBD kernel,
   host-math escape, unspecified word site, hidden finite-intermediate refusal
   or machine-dependent numerical timeout. Resolve the receipt exception and
   authentication precedence conflict, retained solver edge cases, historical
   identity consequences and the exact compatibility/version scope. Green CI
   and a complete prototype do not accept this RFC.
4. **Separately controlled production integration:** only after acceptance and
   authorization, integrate the contract into reference packages and independent
   implementations, synchronize approved specs/schemas/conformance changes and
   run exact-head package, receipt and Excel gates. Research implementations
   required by gate 2 cannot be deferred until this gate. Existing arithmetic,
   expectations and receipt behavior remain unchanged now.
5. **Claims and release:** actual independent platform/browser and spreadsheet
   evidence must support every advertised scope. Unmeasured exports/profiles
   stay explicitly limited. Obtain separate activation/version/release approval;
   no public 5.0 preparation follows implicitly.

The existing Stochastic normal-tail tolerance in VIII.8.3 remains unchanged.
A pinned logarithm can improve an implementation without changing that optional
profile's normative guarantee or expectations. Primitive RN-even, final VIII.5
quantization, public refusals and verification verdicts are distinct boundaries.

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

### 8. Astra review and complete isolated A research

The owner's provisional preference is A for evaluation, not acceptance. The
external Astra report is independently classified in the existing
[Issue #356 review](https://github.com/UWMD-OSP/UW-Markdown/blob/55b1b1ccfa7c52346f40d57f760f29214bd4fa78/docs/reviews/2026-10-15-numerical-determinism-356.md#astra-review-intake-and-independent-verification).
It is not automatically authoritative. That intake records the report hash,
current production/spec/fixture reconciliation, receipt precedence qualification,
IRR underflow/tolerance mechanisms, NPV internal exceptional values, complete
consumer inventory and remaining evidence limits.

The [isolated A candidate](https://github.com/UWMD-OSP/UW-Markdown/blob/6260e9fefd48f96b4b22a9e9396cfc34d43b609f/experiments/numerical-0088/pinned-fdlibm/README.md)
implements every raw integer/fractional power, log/exp and helper path, exact
constant words, explicit C word-site interpretations, raw IEEE exceptional
values, separate current-policy wrappers and deterministic scalar resources.
It has no host-transcendental fallback. Independent mathematical certificates
retain five one-ULP discrepancies among 178 controls; neither a universal
correct-rounding claim nor a global one-ULP bound follows. Native/compiler and
cross-runtime results are separately recorded by exact run/artifact identity.
A complete independent Python kernel and whole-domain accuracy remain gates.

The exact existing-corpus manifest retains all 1,089 case identities and protected
input hashes. Both measured modes pass all assertions, with 671 aligned primitive
word differences and no captured reported-number/refusal differences. This is
not full compatibility proof: 108 cases lack visible actual bindings and only
10 of 20 eligible numeric sites are exercised. Targeted public financial/receipt
controls and explicit unknown cells remain separate from unchanged expectations.

Fresh current-behavior probes reproduce irr(0,0)=-0.999 through lower-endpoint
precedence, and irr of two positive 1e-200 flows=4.5005 through sign-product
underflow followed by absolute-value tolerance. The NPV overflow example returns
finite zero internally, while public pow refuses its nonfinite result. Use a
source-bound rate; scientific-notation literals are outside the calc grammar.
No solver, quantizer, null/type rule or internal refusal policy is silently fixed.

The targeted study reaches the ten static numerical sites absent from that
corpus trace: 48 public financial cases, five starter debt cases and 24 historical
receipt checks. It demonstrates actual A-induced changes: the twelve-decimal
power result changes while its default-six result agrees; original endpoint IRR
10 becomes CALC-IRR-DIVERGE. The untouched old IRR receipt reaches failed/RCP-03
even for a different engine marker, without supplied-backend execution. Finite
power disagreement instead reaches RCP-07. These are measured compatibility
consequences, not a synthetic pack-swap assumption or approved new receipt rules.

Current receipt recomputation refusal returns failed/RCP-03 before engine
attribution and execution of a supplied signature backend. Missing-backend
RCP-08 is earlier, and results_digest corruption is later than successful value
agreement. RCP-07 does not cover every success-to-refusal transition. The joint
compatibility/precedence decision must be resolved before acceptance; production
behavior and historical subjects/signatures remain unchanged now.

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
  and exact dependent pins; existing Receipt5.3 RCP-07 handles successful finite recomputation disagreement across different engines. A recomputation exception instead returns failed/RCP-03 before engine attribution and execution of a supplied signature backend; a version bump alone does not cover that transition. Different
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
  and state the clean-break activation for current consumers. Do not rewrite
  conformance to
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
| Malformed receipt, subject or held-input digest | Preserve wire rejection and decisive early subject/held-input mismatch checks. Results digest is a separate later check. |
| Signature availability and validity | Missing backend yields RCP-08 before recomputation. A supplied backend is invoked only after successful recomputation; a throw bypasses it, including an invalid signature. Resolve this joint spec/implementation precedence conflict before acceptance; preserve behavior now. |
| Same engine identity, changed-runtime recomputation disagrees | Existing different-engine RCP-07 does not cover this demonstrated problem. Disclose it; do not retroactively change the stored identity or infer an original runtime from its version. |
| Different engine versions, recomputation agrees | Version difference alone does not establish unverifiability; follow existing receipt checks. |
| Different engines, successful finite recomputation disagrees | Existing RCP-07 follows supplied signature verification and precedes results-digest corruption checking. It cannot authenticate an unchecked signature. |
| Original success becomes recomputation refusal | Current failed/RCP-03 and empty recomputed list occur before engine attribution/supplied-backend execution. RCP-07 does not cover this case. State and authentication/error precedence require explicit approval. |
| Results digest alone is corrupt | RCP-04 is reached after successful recomputation and result agreement, never after an earlier refusal/disagreement. |
| New receipt changes engine metadata or results | Engine metadata alone changes the signed receipt payload; changed reported results can also change results_digest while source/subject stay unchanged. Retain original artifacts; new issuance is distinct evidence. |
| Archived old evaluator used for historical reproduction | Record exact evaluator/runtime evidence separately. It can reproduce a chosen environment but cannot prove the old host-power contract was portable. Do not add automatic fallback or claim historical identity without this evidence. |

Recommend retaining the current receipt wire format initially. If supporting two
numerical regimes requires a selector or schema change after compatibility
measurement, return that precise contract for separate owner approval. No
historical receipt may be reissued or rewritten solely to remove a disagreement;
newly issued evidence must be distinguishable from the original.

## Conformance impact

No expected output changes are authorized in this draft. Before acceptance and production integration,
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

Production follow-up only after acceptance and separate authorization: `@uwmd/verify`'s `calc/builtins.ts`, numeric
kernel if selected, `cash-flow-series.ts` and dependent procedures. Core
re-exports verify; no model-generation engine or new package is proposed.
Public exports and error changes must be enumerated in that implementation PR.

Current draft contains isolated observation/reference/candidate experiments, not
replacement production financial code or a Python implementation delta. It claims
neither calc-evaluate nor Reader/Verifier conformance. Python implementation work
continues independently; the numerical oracle here is not an accepted solver.

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
   unchanged historical receipt evidence and the clean-break activation. No old
   receipt may be rewritten.
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
