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

The [owner rule (2026-10-17)](../../VERSIONS.md#public-launch-compatibility-policy-owner-decision-2026-10-16)
reserves5.0.0 for the coordinated official public launch of every @uwmd npm
package. All prelaunch releases use4.x.x. This work has no prelaunch backward
compatibility, migration, old-artifact retention, deprecation or version-bump
recommendation gate. Current numerical correctness, source-integrity and receipt
authentication rules still require explicit contracts and independent evidence.
This draft neither accepts arithmetic nor authorizes a release or publication.

### Owner direction — 2026-10-17 (binding direction; RFC remains draft)

The owner selected **architecture A**: the exact pinned fdlibm procedure for
`pow`, `exp` and `log`, with the same power procedure for every exponent class,
including negative powers. B is not selected. Keep the existing financial
associations, final quantizer and solver unchanged. Stability changes using
`log1p`, `expm1` or rearranged financial graphs are separate future work.

The owner also directed **AUTHENTICATE FIRST**: verify a supplied signature before
assigning a recomputation-refusal verdict. Missing backend, malformed source/
subject, value disagreement and result-digest precedence must be specified and
tested together. The bounded proposal below preserves existing preflight checks
and moves supplied-signature validation before any financial recomputation.
That preservation follows current Receipt §5.1 precedent; it is not an additional
owner decision about a new ordering before subject or pack admission.

The eventual public `@uwmd/verify` (or its core re-export) must expose the **same
primitive functions** that internal financial calculations use, so StackUW can
call that procedure directly. Raw primitive results, public calc domain guards,
final refusal and quantization remain distinct boundaries. No model generation
feature, alternate kernel, runtime selector or compatibility implementation is
part of this direction.

These instructions select the architecture and authentication direction, not
final RFC acceptance, production activation, version numbers or publication.
Remaining work is an exact domain/error/resource contract, independent final
consumer and public-API evidence, governed receipt text/tests and an accurate
current conformance-impact assessment. Known composed cancellation and solver
edge behavior stays disclosed; no stronger financial accuracy guarantee is
inferred from the selected primitive or approval to keep the current graphs.

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

### 2. Prior sequential-product alternative — not selected

The selected A procedure replaces symbolic powers through its complete pinned
word/operation contract. The following previously studied sequential-product
alternative is **not selected**. It remains a counterexample to treating numeric
procedures as interchangeable, not a proposal for current activation:

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
language-neutral standard. The owner has selected A as the architecture; final
RFC acceptance and production activation remain separate gates.

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
known-answer vectors; impact measurements over current corpus/deals; and
the numerical guarantee the standard actually promises. The current observation
archive contains aggregate counts and selected first examples, not the full
experimental stream. Some stress inputs are generated with Python native power;
freeze exact input bytes with an input digest and generation provenance before
promoting any experiment to normative vectors. Expected answers must then follow
the accepted procedure, not whichever host generated the stress input. The
concrete candidate above is intentionally narrower than a complete replacement
numeric contract.

### 6. Selected direction and engineering completion

The owner has selected A and unchanged financial associations. The table now
records that direction and the work required to complete its proposal. It is not
RFC acceptance, and comparison-only alternatives do not authorize B research or
new stability procedures.

| Decision | Selected direction / remaining scope | Consequence |
|---|---|---|
| D1: Guarantee | One exact result/refusal for each admitted input and ordered procedure; or allow multiple answers within an explicit error envelope | Retain one exact result/refusal. Reported-value equality alone is insufficient at quantization ties, and an error envelope would require new comparison/digest semantics. Do not promise that every financial formula is a correctly rounded evaluation of its entire real-valued expression. |
| D2: Positive integer powers | **A selected.** | Use the exact pinned fdlibm power, including its existing integer fast paths; sequential multiplication, a new squaring graph and B are not selected. |
| D3: Negative and fractional powers | **A selected for all exponent classes.** | No universal reciprocal-of-positive-product rule, exp/log substitute or alternate integer kernel. Reproduce the selected procedure and its subnormal/overflow/special-case behavior. |
| D4: Transcendentals | **A pow/exp/log selected; B not selected.** | Pin the eight-file fdlibm closure, constant words and exact operation/word semantics. Correct-rounding comparisons remain accuracy evidence, not a requirement to implement B. |
| D5: Financial graphs | **Keep existing associations, quantizer and solver.** | Measure and disclose cancellation, exceptional values and current refusals. log1p/expm1, rate cutoffs, new tolerances, stable rearrangements or solver changes require separate governed work. |
| D6: Range and resources | Admit the present finite input domain with bounded kernel implementation; or specify narrower admitted domains and exact refusals | Prefer preserving the presently admitted domain where practicable. Any necessary restriction needs an explicit affected-input table and owner approval; the experimental 10,000-step cap is not a limit proposal. Do not mistake the existing AST-node budget for a bound on work inside one builtin. |
| D7: Production activation | Accept the numerical and receipt contract after independent evidence; activate production separately. | No prelaunch support, migration, artifact-retention or version-recommendation work. All @uwmd packages launch together at5.0.0; prelaunch releases use4.x.x under the owner rule. This draft assigns no versions and grants no publication authority. |
| D8: Evidence | TS-only or host-power agreement; or frozen vectors plus genuinely independent implementations and platform coverage | Require frozen independent TS/Python evidence, corpus impact and actual scoped spreadsheet recalculation before claiming the corresponding guarantees. A runtime-pinned reference release alone does not close #356. |

#### Selected architecture versus engineering completion

The architecture choice is resolved: A supplies every pow/exp/log invocation.
Do not continue implementation research for B or treat the old integer hybrid
as an activation alternative. Complete the chosen proposal and its independent
proofs; raw primitive agreement does not establish whole-financial-formula RN.

The current financial graph, quantizer and solver associations remain unchanged.
The owner-selected authentication direction is a separate bounded verification
procedure correction, governed with the full precedence table below. Its
isolated proposal is executable without activating production behavior.

The public primitive entry points must call the same pinned kernel used by
future activated financial paths. A second public implementation, host-math
fallback or StackUW-only numerical procedure would defeat that requirement.
Raw IEEE special values do not authorize public calc wrappers to accept inputs
that their existing domains refuse, or early refusal of internal intermediates.

Complete domains/refusal points, resource evidence, public function boundaries
and independent vectors are engineering completion work for selected A. Return a concrete restriction
for approval only if preserving today's admitted domain proves impractical; do
not ask the owner to approve an unspecified cap. The established request for
independent evidence is not permission to choose an algorithm from whichever
runtime wins a comparison.

Native spreadsheet power/logarithm functions must be tested against the selected
contract rather than presumed interchangeable with its primitives. Identify the
supported workbook formulas, actual recalculation engine/version and any live
formula versus retained-literal limitations before advertising parity. If a
selected procedure cannot be reproduced through an existing export path, return
that precise export impact for review; do not silently redefine the
financial metric, substitute a cache for independent recalculation, or broaden a
limited spreadsheet observation into a universal Excel guarantee.

#### Proposed complete primitive, admission and resource contract

The following makes the selected A direction explicit for final review. It is
**draft governed text**, not a claim that Protocol VIII or production consumers
already use it. It introduces no new financial convention or narrower input cap.
The source/word/constants artifacts below define one procedure; matching a host
libm name or merely agreeing after reporting quantization is insufficient.

**Procedure identity and arithmetic.** Use the exact eight-file closure in
[`sources.json`](../../experiments/numerical-0088/pinned-fdlibm/sources.json),
with all constants decoded from the certified binary64 words in
[`constants.json`](../../experiments/numerical-0088/pinned-fdlibm/constants.json)
and the complete
[`WORD-SITES`](../../experiments/numerical-0088/pinned-fdlibm/WORD-SITES.md)
map. The map resolves historical C aliasing, signed overflow, signedness,
carry/borrow and whole-word shifts; unspecified C behavior is not inherited.
Each floating basic operation rounds to binary64 nearest/ties-even with gradual
underflow in the source association. No FMA, reassociation, excess-precision
retention, host pow/log/exp/sqrt, reciprocal-of-positive-pow replacement or
exp(log(x)*y) substitute is permitted. Source +1/-1/+2/+0.5 fast paths remain
part of the one pow procedure; they are not alternative dispatch policies.

High/low words are endian-independent signed32/unsigned32 views. Word addition
and subtraction wrap modulo2^32; signed comparisons and unsigned comparisons
follow the site map. Right shifts distinguish arithmetic from logical; count32
produces sign extension for arithmetic shift and zero for logical/left shift,
not JavaScript's masked count0. Counts at every admitted site lie in0..32.
Integer-to-float conversions are exact in their specified ranges; the guarded
exp conversion truncates toward zero. Generated NaN payload/sign and floating
exception flags are outside the portable result contract. All finite words,
signed zeros and signed infinities are exact outputs; compare NaNs by class.

**Three separate admission layers.** Preserve these boundaries and their order:

| Layer | Admission and result/refusal rule |
|---|---|
| Shared raw public functions | `pinnedPow(base, exponent)`, `pinnedExp(value)` and `pinnedLog(value)` accept primitive binary64 numbers, including NaN/infinities and signed zero. Reject a nonnumber at the first checked parameter with typed `CALC-TYPE-001`; do not coerce, infer a default or propagate null. Pow checks base before exponent. Return raw IEEE outputs with no quantization or financial finite-result guard. Verify/browser/core expose the same function identities. |
| Internal financial procedure | Call the same raw kernel at each existing pow/log/exp site. Retain the exact existing ordered financial graphs, optional-argument/default/null/type rules, solver checks and each consumer's own final-result policy. Do not call the public calc builtin as an internal primitive or add a blanket finite-intermediate guard. |
| Public calc/evaluator and stated-result consumers | Keep current arity/type/null admission and domain/final checks at their existing boundaries. Apply VIII.5 and VIII.5.1 only where the current consumer requires them. A public calculation refusal, a raw exceptional value, a verification result and a receipt verdict remain distinct results. |

The existing public calc guards are part of this proposal, not permission to
replace them with finite-first admission:

| Calc primitive | Retained policy around the raw primitive |
|---|---|
| `pow` | Two arguments, number-or-null type checks in argument order before null propagation; nonfinite final raw result refuses `CALC-TYPE-001`. |
| `exp` | One number-or-null argument; null propagates; nonfinite final raw result refuses `CALC-TYPE-001`. |
| `log` | One number-or-null argument; null propagates; input<=0 refuses `CALC-TYPE-001`. No new local finite-result guard: +Infinity and NaN follow the current wrapper, with downstream result policy still separate. |
| `sqrt` | Its current public wrapper stays unchanged (one number-or-null argument, negative input refuses, signed zero preserved); A's internal software sqrt is a closed helper, not a newly selected public sqrt policy. |

Raw pow returns+1 for either signed-zero exponent before checking NaN, NaN for
negative finite base with nonintegral finite exponent, source-signed zero or
infinity for signed-zero/infinite bases, and NaN for abs(base)=1 with infinite
exponent. Other integral, fractional, negative and huge exponents follow the
same source reduction/range/scaling procedure. Raw log maps signed zero to
-Infinity, negative finite/-Infinity to NaN, +Infinity to +Infinity and1 to+0.
Raw exp maps signed zero to1, +Infinity to +Infinity, -Infinity to+0 and NaN to
NaN; finite overflow and gradual underflow follow its exact source body. The
complete helper/special-case table is
[`DOMAIN-RESOURCE`](../../experiments/numerical-0088/pinned-fdlibm/DOMAIN-RESOURCE.md).

For example an overflowing internal power can be a valid intermediate in NPV:
finite_amount/Infinity may become finite0. The public pow builtin would refuse
that same power result. NPER's raw log intermediates must likewise not acquire
public log admission. Keep the existing IRR bracket, endpoint precedence,
sign-product underflow, absolute stopping tolerance and bisection unchanged,
including the documented all-zero and tiny-positive edge outcomes. A stronger
primitive or a spreadsheet's preferred answer does not authorize solver repair.

**Resources.** All scalar pow/log/exp/scalbn/fabs/copysign bodies are loop-free
and nonrecursive apart from the one possible software-sqrt call in pow's+0.5
branch. Software sqrt has at most2 normalization transfers,20 normalization
search iterations,22 high-digit and32 low-digit iterations: a conservative76
loop-body bound per sqrt and hence per raw pow. There is no exponent-sized
loop, dynamic precision, numeric timeout or arbitrary exponent cutoff. Scalar
state is fixed; word construction has fixed64-bit size. Internal scalbn's
exponent is signed32, shifts stay within the mapped ranges, and its source
+/-50000 branches are existing range logic, not newly chosen admission caps.

This scalar bound does not bound document size, AST/call count, cash-flow length
or total verifier work. Existing IRR/XIRR solver and input/AST budgets remain
separate and unchanged. Platform throughput, browser packaging and actual
spreadsheet recalculation must be measured for their advertised scope; a
constant scalar bound is not proof of those guarantees. No new domain restriction
has been found necessary by this reconciliation. Native/Python/TypeScript and
consumer evidence must independently support the specified procedure before
acceptance; no whole-formula RN or universal one-ULP guarantee is asserted.

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

The source-only closure study and comparison below are earlier bounded evidence.
Complete isolated JS/Python A kernels now exist and are recorded below. Remaining
implementation work concerns the actual public entry points, exact consumer/domain
contracts and independently measured final compositions. Mathematical certificates
remain separate accuracy evidence; no B implementation is selected or required.
Keep input hashes, hard rounding/range cases, complete financial graphs and
runtime/browser/package costs distinct from receipt-result impact. The earlier source-only comparison did not implement a complete kernel. Current
A JS/Python implementations are recorded below; A is now selected. This does not
activate a current evaluator or conformance expectation, or select B.

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

#### Earlier procedure comparison — A now selected; no B implementation gate

The [concrete procedure comparison and new integer lab](https://github.com/UWMD-OSP/UW-Markdown/blob/0be37dd2e13491e6840ed81f1de3da8a49efbee8/experiments/numerical-0088/integer-dispatch/README.md)
specify the following concrete design alternatives. Their **implementation/evidence
status differs**; a specified API adapter is not executable evidence. The lab
includes exact source/archive hashes, special/domain tables, conversion and work
limits, cost/license feasibility, old frozen counterexamples and acceptance tests.

| Candidate | Exact procedure and integer/negative convention | Status and consequence |
|---|---|---|
| **A — selected architecture; RFC still draft** | The exact eight-file Netlib closure, including `e_pow.c` SHA-256 `763b86baa63eb3518b43f7f3e44e5ed10992b62650f4a45c3a2ea6015e6d5122`, with explicit binary64 constants, basic-operation boundaries and defined word-site mapping. Call `__ieee754_pow` for integral and fractional exponents, including its pinned +1/-1/+2/+0.5 fast paths, split log2/general exponential graph, huge-exponent branches and scaling; log/exp use their separate pinned bodies. No running-product or universal reciprocal substitution. | The full isolated JavaScript raw closure now exists, including fractional powers, exact constants and software helpers. Independent mathematical/native/corpus evidence is separately scoped below; the independent raw Python kernel is complete in its scoped checkpoint. Whole-domain accuracy and final consumer proof remain distinct incomplete gates. Guarantee is exact procedure output, **not** universal mathematical correct rounding. |
| **B — not selected; earlier comparison only** | MPFR **4.2.2** / GMP **6.3.0**, exact binary64-word loading, destination precision 53, exponent range emin=-1073/emax=1024 set before operations, named `mpfr_pow`/`mpfr_log`/`mpfr_exp` with MPFR_RNDN, **actual operation ternary** passed to `mpfr_subnormalize`, then exact word encoding. No integer-width cast, powr, host libm or exp(y*log(x)) substitute. | Correct-rounding API contract, not a verified implementation: unpatched4.2.2 and the reduced-range adapter are unexecuted, with upstream BUGS and exact patch applicability unresolved. Actual range/subnormal/counterexample tests are required; precision 53 alone cannot establish this guarantee. Internal Ziv precision growth/allocation has no demonstrated universal hostile-input bound. No further B implementation, packaging or adapter testing is required by the selected-A workstream. |
| **C — not selected; earlier hybrid comparison** | For every exactly integral finite binary64 y, decode its full exact integer magnitude, form f=B(1/x) first for negative y, then binary squaring with ordered accumulator multiplies and no unused final square; immediately refuse any nonfinite basic result. Fractional powers and log/exp use exactly A. | Only C's integer branch is wired in its lab; the separate new A prototype does not establish a complete tested hybrid. At most1024 loop iterations /1077 basic operations, without a 256 cap or safe-integer restriction. Distinct rounding/refusal semantics; no measured bundle or speed saving justifies a separate contract. |

The owner selected **A across all exponent classes**. The prior evidence against adding C merely because
its integer implementation is shorter remains relevant: A's general fractional power already
needs the same helper closure; C does not remove that dependency and introduces
a different graph at integer exponents. Frozen reciprocal-first versus one-rounded
power controls disagree (1.1^-31 gives words `3faaacadc6ed30d0` versus
`3faaacadc6ed30ca`). Earlier money/IRR controls already prove that changing an
integer graph can change reported values and endpoint/refusal branches. Those
are comparisons of existing experimental graphs, **not measured A-versus-B
outputs**. B comparison is not an active pending test under the selected direction.

The following retained B-adapter description is earlier comparison evidence,
not a current implementation or acceptance work item. Its source provenance pins
MPFR archive SHA-256
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
preserved. Such adapter tests would be necessary only if a later separate decision
selected B; they are not selected-A gates.

All three designs preserve the explicit financial operation table in this RFC:
periodic amount/divisor remains distinct from dated amount*negative-power;
primitive nearest/even remains distinct from final VIII.5 decimal-string
half-away quantization. IRR/XIRR bracket, endpoint precedence, stopping criteria
and tolerances remain unchanged. A complete solver trajectory is not supplied by
the endpoint-only lab. Existing RCP-07 precedence and its same-engine disagreement
gap remain disclosed; numerical changes neither rewrite source/signature subjects
nor historical receipts. Apply the launch policy without a legacy evaluator,
pre-5 procedure selector or compatibility shell. This comparison does not require
a new runtime field or authorize old artifacts under new numerical semantics.

Selected-A acceptance tests must cover independent word/constant/site maps, its
real special/range branches and hard mathematical rounding certificates. The old
B-adapter mutant is not an acceptance gate. Add full financial
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
| NPER | Current observed sequence: if `r==0`, refuse `pmt==0`, then `B(B(pv-fv)/pmt)`; otherwise `a=B(pmt-B(fv*r))`, `b=B(pmt-B(pv*r))`; refuse `b==0`, then evaluate `q_guard=B(a/b)` and refuse `q_guard<=0`. Repeat `q=B(a/b)`; evaluate `num=L(q)` before `base=B(1+r)`, `den=L(base)`, result `B(num/den)`. Raw-log specials and admitted-domain/refusal approval remain separate. Retain closed form; no iterative amortization search. |
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
gap and launch-contract requirements remain as stated below; source/block/signature
subjects and existing artifacts are not rewritten. General fractional kernels,
complete solver trajectories, corpus impact and actual spreadsheet evidence
remain distinct acceptance work.

### 7. Research, acceptance and production are separate gates

1. **Owner direction:** A is selected for pow/exp/log and all exponent classes;
   B is not selected. Keep financial associations, quantizer and solver unchanged.
   Authenticate a supplied signature before financial recomputation/refusal, with
   the joint preflight/result precedence specified below. This is not final RFC
   acceptance or production activation.
2. **Independent pre-acceptance research:** complete an isolated executable
   procedure, exact constants/word maps, domains, exception/public-refusal rules
   and deterministic resource analysis. Independently exercise it against
   pinned reference implementations and mathematical certificates over declared
   domains. Retain complete inputs, words, failures and exact source/runtime/
   platform/compiler identity. Measure financial trajectories, existing-corpus
   results AND refusals, reporting boundaries and receipt authentication/error
   precedence BEFORE the owner evaluates acceptance. Existing measured comparisons
   can be reused where relevant; no prelaunch compatibility or retention work is
   required. Do not activate or rebaseline to do research.
3. **Owner acceptance:** return a complete evidenced revision with no TBD kernel,
   host-math escape, unspecified word site, hidden finite-intermediate refusal
   or machine-dependent numerical timeout. Resolve the receipt exception and
   authentication precedence conflict and retained solver edge cases for the
   launch contract. There is no prelaunch version recommendation or artifact-
   retention prerequisite. Green CI and a complete prototype do not accept this RFC.
4. **Separately controlled production integration:** only after acceptance and
   authorization, integrate the contract into reference packages and independent
   implementations, synchronize approved specs/schemas/conformance changes and
   run exact-head package, receipt and Excel gates. Research implementations
   required by gate 2 cannot be deferred until this gate. Existing arithmetic,
   expectations and receipt behavior remain unchanged now.
5. **Claims and release:** actual independent platform/browser and spreadsheet
   evidence must support every advertised scope. Unmeasured exports/profiles
   stay explicitly limited. Follow the owner rule: coordinated @uwmd5.0.0 only at
   approved launch,4.x.x beforehand. Obtain separate activation and explicit
   launch/publication authorization; this draft grants none.

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

The owner has selected architecture A, without accepting the final RFC or
activating production. Earlier provisional comparisons remain scoped evidence. The
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
The independent raw Python kernel checkpoint below closes the missing source
implementation; whole-domain accuracy and independent composed-financial,
quantization and receipt evidence remain separate gates.

The exact existing-corpus manifest retains all 1,089 case identities and protected
input hashes. Both measured modes pass all assertions, with 671 aligned primitive
word differences and no captured reported-number/refusal differences. This is
not a complete impact assessment: 108 cases lack visible actual bindings and only
10 of 20 eligible numeric sites are exercised. Targeted public financial/receipt
controls and explicit unknown cells remain separate from unchanged expectations.
The later focused financial study reached the other ten sites:20/20 have now
been exercised in the union. The108 uncaptured bindings and independent final
consumer proof remain distinct gaps; neither is filled by site reach alone.

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
power disagreement instead reaches RCP-07. These are measured behavioral and
identity consequences, not a synthetic pack-swap assumption or approved new
receipt rules. The 24 historical receipt checks remain audit evidence; the launch
policy does not require cross-regime verification of those pre-5 receipts.

Current receipt recomputation refusal returns failed/RCP-03 before engine
attribution and execution of a supplied signature backend. Missing-backend
RCP-08 is earlier, and results_digest corruption is later than successful value
agreement. RCP-07 does not cover every success-to-refusal transition. The owner has now selected authentication before recomputation. The exact joint
preflight/authentication/refusal/value/digest procedure and tests below must be
reviewed before acceptance, independently of any prelaunch support obligation. Production
behavior and historical subjects/signatures remain unchanged now.

## Launch numerical and receipt contract

The2026-10-17 owner rule removes all prelaunch compatibility, migration,
version-recommendation and artifact-preservation work. Prior observations are
available research inputs; no replay, repair or preservation of prelaunch
receipts is an acceptance requirement. Current read-only verification and
source/digest correctness remain mandatory.

A selected procedure must state its raw result/refusal, VIII.5 reporting and
receipt recomputation behavior. Receipt identity is an authenticated current
contract, not a reason to support an earlier numerical regime. No new engine
name, runtime field, signature domain or receipt wire shape is presumed.

### Owner-directed authenticate-first receipt proposal

The existing implementation computes before checking a supplied signature. The
owner-selected direction moves authentication before any financial computation,
while retaining the existing earlier source/subject and decidability checks.
The following is the **draft complete ordered procedure**, not activated text:

| Order | Condition | Draft result / work boundary |
|---|---|---|
| 0 | Receipt wire assertion fails | Preserve the existing typed parse/assertion transport refusal. No invented verdict or generic code. |
| 1 | Record cannot canonicalize | unverifiable/RCP-09; no signature backend or recomputation. |
| 2 | Subject digest differs | failed/RCP-01, or unverifiable/RCP-10 for noncomparable canonicalization versions; no backend or recomputation. |
| 2a | A held referenced input digest differs | failed/RCP-12 before the indeterminate group; no backend or recomputation. |
| 3 | Missing input, unknown/different pack, missing signature backend | unverifiable; keep existing issue order: missing-input RCP-11 entries, then RCP-05/06, then RCP-08. No backend or recomputation. |
| 4 | Signature present and backend supplied | Construct the exact current receiptSigningPayload. Invalid Unicode in that payload or invalid signature => failed/RCP-01, with no recomputed member because computation did not run. Invoke the backend once. Unsigned receipts skip this stage and acquire no signature-authentication claim. |
| 4 transport | Backend throws | Preserve its existing transport exception; do not invent a validation code or continue to computation. |
| 5 | Authenticated (or unsigned) recomputation throws | failed/RCP-03 with recomputed:[] as currently. Engine metadata does not turn this exception into a finite disagreement. |
| 6 | Successful recomputation lacks outputs or values differ | Existing RCP-02/03 comparison; different engine name/version => unverifiable with leading RCP-07. Supplied signature has already validated. |
| 7 | Values agree but stated results_digest does not recompute | failed/RCP-04. This cheap corruption check never skips computation or outranks signature/value failure. |
| 8 | All applicable stages succeed | verified; source correctness, numeric agreement and actual signature authentication remain separate assertions. |

This proposal allocates no new code, receipt shape, engine name, package version
or numeric comparison tolerance. Omitting unevaluated recomputed output on an
authentication failure uses the existing optional result member; it does not
fabricate empty financial results. Current production behavior is unchanged.

The isolated authenticate-first lab relocates the actual compiled signature AST
stage ahead of the actual compute try-block only in an explicit queried research
module. It leaves production source/dist bytes untouched. Real disposable
Ed25519 controls bind current issued receipts to independently canonicalized
signing payloads. The synthetic refusal context deliberately supplies a changed
pack declaration to force a typed compute failure; it does not claim that a
trusted published pack may change in place or prove financial accuracy.

The module/profile/browser and spreadsheet consumer inventory remains relevant
because these consumers must implement the selected current procedure. A
package boundary does not make normative arithmetic optional. No generation
product or expanded underwriting engine is needed to resolve this RFC.

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
8. Launch-admitted engine agreement/disagreement, authentication/error precedence,
   result digest/signature subjects and source checks under the approved contract.
   Reuse relevant existing evidence without adding prelaunch compatibility or
   historical-artifact retention requirements.
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

## Remaining acceptance work

Architecture A, unchanged financial associations/quantizer/solver and
authenticate-first direction are resolved owner instructions. Do not return
those choices for repeated approval or implement B. The remaining gates are:

1. Independently review the proposed complete primitive/admission/resource
   contract above against DOMAIN-RESOURCE, WORD-SITES, constants and actual public
   exports. Raw number/CALC-TYPE-001 boundaries, internal intermediates and current
   final-result guards are now explicit draft text, not missing algorithms. The seven
   raw helpers, exact constants/words and conservative76-loop bound already exist;
   missing implementation or a new raw-kernel study is not the gate. No host-math
   escape, dynamic timeout, new cutoff or hidden finite guard may be introduced.
2. Independently verify the public primitive entry points and their identity with
   the kernel used by every activated financial consumer. Cover number-type
   boundaries, signed zero, subnormals, negative/fractional/huge exponents and
   log/exp special/range paths without claiming universal correct rounding.
3. Close independent final-result/refusal/reporting proof for seven verifier
   sites already reached by the corpus: capital-stack amortized ADS(1), waterfall
   scale/hurdle/compound preference(3), normal-tail logs(2), recovery reporting(1).
   All20 eligible numerical sites have been reached by the corpus plus focused
   financial study; reach is not independent whole-consumer proof. Existing eight
   financial families and quantizer evidence are reusable. Preserve exact null,
   default and conditional behavior; independently execute current platform/browser
   paths and actual scoped recalculation for advertised spreadsheet parity.
4. Review the joint receipt proposal above and its real-crypto state controls;
   synchronize accepted normative receipt wording, implementation and conformance
   only after final RFC acceptance. No supplied invalid signature may be hidden by
   financial refusal. Keep malformed source/subject, unavailable dependencies,
   finite disagreement, engine attribution and digest precedence explicit.
5. Produce the exact current affected conformance manifest, closing108 old
   capture cells without visible actual bindings and covering current corpus
   additions, with exact output/refusal/code attribution. Complete independent
   material-claim review and required exact-final-head CI. Disclose current
   composed accuracy/refusal limitations without selecting stable new graphs or
   inferring a whole-formula accuracy promise. RFC acceptance and activation stay
   separate; no version allocation, publication or launch is authorized.

The owner has selected the directions above, **not accepted the final RFC**.
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


### Observed native/reference checkpoint (research only)

The frozen native evidence at
`experiments/numerical-0088/native-reference/evidence/run-38993665625/` retains
all9 original GitHub artifact ZIPs, their API-verified digests and an offline
verifier. Three strict compiler builds and six Node streams agree on4204 frozen
inputs (3435 exact non-NaN words,769 NaN classes). Every build retains the five
mathematical counterexamples above. This is finite compiler/runtime evidence,
not universal accuracy, a complete independent Python kernel or owner acceptance.
The actual historical checkout was the PR test merge a6d05240, with source hashes
matching0c2f; future research runs explicitly check out their reviewed head and
record additional actual executable provenance. Missing historical fields are
not invented. The same source graphs, exact-rational expectations, conformance
and receipt rules remain unchanged.

### Independent raw Python procedure checkpoint (unaccepted)

The [new isolated Python implementation](https://github.com/UWMD-OSP/UW-Markdown/blob/cd4a9daa52c09c7f0f856cd02f47ee0a44b9ad30/experiments/numerical-0088/python-fdlibm/README.md)
implements the same seven raw helpers directly from the frozen C, independently
structured from the JS candidate, including all integer/fractional powers. It
uses explicit binary64 words, signed32/unsigned32 operations, IEEE zero division
and bounded scalar control flow; there is no host-transcendental fallback.
The exact constant-word table is shared rational-derived evidence data, not a
second independent derivation of constants. Nothing imports it into production.

At the committed one-host observation, CPython3.12.3 Windows AMD64 independently
matches all4204 operands against each of three frozen native-C streams:3435
exact non-NaN words and769 NaN classes. The178 mathematical controls retain173
agreements and the same five adjacent-word counterexamples. Eleven focused
controls include arithmetic prerequisites, word/count32 behavior, independent
negative-unit parity, sqrt loop bounds, raw/public separation, evidence tamper
refusal and JSONL input refusal. Original expected evidence is never regenerated.
The record pins actual observer commit/tree, all implementation/input/source/
archive hashes and every bounded mathematical discrepancy.

Ordinary CI conditionally checks out the reviewed PR head and reuses its three
existing Python jobs for this research, retaining separately named observation
artifacts. A workflow definition is not an execution result: record actual run,
head, runtime, architecture and hashes before claiming those platforms. Earlier
nine-platform JS/native evidence keeps its original source scope. Independent
complete financial graphs/IRR trajectories, final decimal-string quantization,
reported assertions and receipt authentication/error precedence are not supplied
by this raw kernel. Universal correct rounding/global accuracy, applicable
spreadsheet evidence and owner acceptance/activation remain unresolved gates.

### Complete bounded financial trajectories (unaccepted)

The [composed trajectory study](https://github.com/UWMD-OSP/UW-Markdown/blob/d8e16f7dc34c0b92729f55d32a8ec8b0aa050f80/experiments/numerical-0088/financial-trajectories/README.md)
connects the independent Python raw kernel to current periodic NPV/IRR,
actual/365f XNPV/XIRR and PMT procedures. Nineteen fixed word-input cases retain
4,730 complete candidate operation/evaluation/bracket/iteration/update/exit
rows. Separate JS graphs agree with Python under an explicitly separate
NaN-class comparison projection; original NaN bits remain in the raw archives.
Actual unmodified production agrees with the host graphs and baseline loader;
actual isolated power injection agrees with the candidate graphs. Every finite
reported result and eight boundary controls agree with the production decimal-
string quantizer through an independent rational reporting reference.

The original capture pins checkout5c034dd0/tree80d24a81, CPython3.12.3 Windows
AMD64 and Node24.14.1/V8 13.6.233.17-node.44. Twenty-one compressed artifacts
preserve all raw traces, distinct comparison projection, actual API outputs,
loader events/transforms and command logs. The sole final result/refusal change
in these controls is the known endpoint10 to CALC-IRR-DIVERGE transition;
its exact21flow words link to the preserved actual receipt RCP-03/RCP-07/backend
controls. Those receipt executions are reused evidence, not newly performed
cryptographic authentication or a new precedence rule.

Ordinary Node20 CI reuses its build/Python runtime for focused controls, immutable
archive/source verification and a separate complete observation archive. Record
actual run/head/runtime/artifact identities before calling that execution green.
The earlier raw-kernel three-platform results are independent evidence; neither
they nor this original one-host capture supplies three-platform financial proof.
Remaining gates include other financial graphs/day counts, whole-domain accuracy,
complete stated-figure/receipt integration and advertised spreadsheet parity.
No iteration-cap exhaustion was observed. Owner acceptance of the complete
procedure/accuracy/refusal contract and separate production activation remain
required; no arithmetic, schema, fixture, receipt, package version or launch state
changes in this study.

### Composed receipt and real-signature closure (unaccepted)

The [isolated composed-receipt study](https://github.com/UWMD-OSP/UW-Markdown/blob/3e968cdf/experiments/numerical-0088/composed-receipts/README.md)
adds actual issuance and verification under the pinned numerical candidate after
accepted main `afcc615897aca301c7b5ec070bba7c0bd253e4ef` / RFC 0090. It reuses
one frozen independent Python multi-period IRR result without rerunning the
4730-row study. Newly issued unmodified, baseline-loader and candidate receipts
agree exactly; the reported word is `3fb6c64e16bf6113`. The same existing engine
name and explicitly synthetic experiment versions exercise finite agreement and
engine-metadata distinctions without allocating a production identity.

The original capture records checkout `f29258a2` / tree `b8a2bda3`, Windows
AMD64, CPython 3.12.3, Node 24.14.1 / V8 13.6.233.17-node.44 and OpenSSL 3.5.5.
Thirteen compressed raw artifacts retain 19 actual candidate controls, complete
receipts/signing payloads, backend calls, 1886 candidate primitive events and
85 loader transformations, plus separate unmodified/baseline observations.
The 105 source/reference and 86 compiled-JS identities are unchanged before and
after execution. Every edited or re-signed receipt is a new synthetic artifact
using a deliberately public disposable Ed25519 test key; none authenticates a
historical original or establishes issuer trust.

Separate post-capture verification binds all 19 receipt objects to their exact
accepted `canonicalize({...receipt, signature: null})` signing payloads and their
source bytes, independently of the observed `receiptSigningPayload` call. It
checks 18 real signature outcomes (14 valid, four invalid; one other control is
unsigned), and three in-memory detached-payload negatives. A finite synthetic
wrong-value control with a newly valid signature preserves same-engine RCP-03
versus other-version RCP-07/RCP-03; a retained invalid signature gives RCP-01.
This is an explicit result-tampering control, not a newly observed natural
host/candidate finite disagreement.

The exact old endpoint source/receipt is reused solely as input to newly signed
clones. Candidate recomputation refusal produces RCP-03 before backend invocation
for both byte-valid and invalid signatures; no original signature is claimed.
Earlier unavailable-backend, subject, reference and pack exits retain their
accepted behavior. The experiment preserves existing precedence, including this
refusal-before-backend behavior; it proposes no authentication workaround.

The [separate integration accounting](https://github.com/UWMD-OSP/UW-Markdown/blob/3e968cdf/experiments/numerical-0088/integration/README.md)
keeps the original Astra identity file and historical trajectory manifest/raw
artifacts byte-exact. A successor Astra map pins accepted-afcc Protocol/index
identities, with all numerical/receipt implementation hashes unchanged; the
actual API replay still matches every frozen behavioral field. A separate
trajectory verifier admits only the exact historical-to-afcc Protocol identity
transition and requires every other source/helper/input/reference to match. No
old capture is relabeled as an afcc execution or rebaselined. This one-host
closure does not supply full cross-platform financial/receipt proof, universal
accuracy, all graph/day-count/stated-figure coverage, issuer trust or RFC
acceptance. Owner procedure/accuracy/refusal choices and production activation
remain open under the major-5 launch policy.

### Composed accuracy and cancellation checkpoint (unaccepted)

The [bounded cancellation study](https://github.com/UWMD-OSP/UW-Markdown/blob/b2c16fcf/experiments/numerical-0088/cancellation-accuracy/README.md)
adds36 new exact scalar PMT/PV/FV controls, including both neighbors/ties of the
binary64 `1+rate` collapse boundary, signed zero and integer periods1/360. It
preserves exact-rational real-formula certificates, the ordered graph with an
ideal correctly rounded power, independently executed pinned JS/Python graphs,
and actual builtin/evaluator/decimal-string-quantizer outcomes. The ideal-power
graph is a mathematical counterfactual of the already-rounded base, **not** an
executed MPFR adapter, new financial graph or primitive-B implementation claim.

In this bounded domain, A and the ideal-power graph agree on all36 raw words;
30 differ from whole-real-formula RN-even. After the existing12-place VIII.5
procedure,21 finite values differ and five nonfinite raw results are refused
while the exact-real reference remains finite. At rate word `3ca0000000000000`
(+2^-53), one-period PMT refuses, while PV/FV report0 instead of reference1;
the latter have exact relative real error1. The next positive rate word gives
reported PMT0.5/PV2 instead of reference1. Both input-base rounding and later
cancellation are material: correctly rounding only the power primitive cannot
restore a discarded rate or imply whole-formula accuracy.

Two additional natural WindowsNode24.14.1 host/candidate changes occur at
negative rate word `bc90000000000001`, one period: host PMT raw-infinity/refusal
becomes candidate reporting0.25, and host PV reporting0 becomes candidate4;
the exact-real references report1. These are local measured financial
reporting/refusal differences, not the historical IRR endpoint or newly executed
receipt differences. Original receipts and all old4204/178/4730 evidence remain
unchanged. Any receipt consequences still require their own actual API evidence.

Capture4573db25/tree2d4019c5 records WindowsAMD64, CPython3.12.3 and
Node24.14.1/V8 13.6.233.17-node.44. Sixteen compressed artifacts preserve591583
raw bytes and200 complete ordered rows per candidate graph implementation;
103 source/reference and86 compiled-JS identities remain unchanged. The rational
oracle is bounded to listed word inputs, exact unit/zero scalar amounts, integer
periods1/360 and12-place reporting; midpoint search is at most63 iterations.
Its38,169-bit maximum exact certificate is a research resource observation,
not a proposed production domain/work limit or a universal accuracy proof.

**Earlier D1/D5 recommendation, superseded as an open direction choice:**
this capture demonstrated that primitive accuracy alone cannot imply whole-formula
accuracy. The later2026-10-17 owner direction selects A and keeps the existing
financial associations, quantizer and solver. These measured large errors and
refusals remain disclosed limits of those graphs; no stable rearrangement, new
zero-rate cutoff, tolerance or B implementation is selected. Final RFC acceptance
still requires the exact domain/error/resource contract and honest accuracy claims.

Published9c0322a7 ordinaryCI39061421563 has17 successful jobs and one skipped
publication observation: production Node20/22 and WindowsNode20 gates, three
Python foundation/raw-kernel jobs and the named repository/tooling guards.
LinuxNode20 also executed the previous19-control actual receipt matrix and
immutable historical trajectory checks. These are scoped regressions; this new
36-case study was absent from that head. Green17 does not establish exhaustive
primitive accuracy, all financial graphs/day counts, a global composed error
bound, spreadsheet recalculation or owner acceptance. Optional research
39061421580 was cancelled, never passed. Frozen historical cross-platform
artifacts retain their original source/runtime scopes.

### Natural cancellation receipts and bidirectional precedence (unaccepted)

The [two-input actual receipt study](https://github.com/UWMD-OSP/UW-Markdown/blob/aa83459d/experiments/numerical-0088/cancellation-receipts/README.md)
connects the new cancellation counterexamples to actual issuance/verification,
without repeating the36-case oracle or4730-row financial graph capture. It uses
only PMT/PV at frozen negative rate word `bc90000000000001`, one period, unit
amount/zero other value and12-place reporting. The previously certified
whole-real reference reports1; the candidate reports0.25/4. The comparison
keeps mathematical accuracy, exact procedural output and authentication separate.

On the captured WindowsNode24.14.1 host, actual PMT issuance throws
RCP_COMPUTATION_FAILED and produces no partial receipt. Host PV issues0;
the candidate actually issues0.25/4. No result is edited to manufacture a
finite disagreement. Host and candidate PV unsigned receipts have identical
source subject and every other field except naturally computed results and
results_digest. Every issued/signed artifact is newly synthetic, uses the
existing engine name with explicit research-version metadata, and is signed by
a deliberately public disposable test key. None authenticates an original
conformance receipt or establishes a producer's identity/trust.

Twelve primary real-API controls preserve the following accepted current
behavior, with one separate baseline-loader instrumentation repeat:

| New natural case | Actual verdict / codes | Real backend calls |
| --- | --- | --- |
| Candidate's own PMT/PV receipts | Verified despite disagreement with whole-real reference accuracy | 1 each |
| Host-issued PV verified by candidate, same engine/version labels | Failed RCP-03 | 1 |
| Same PV receipt, different verifier-version option | Unverifiable RCP-07/RCP-03 | 1 |
| Corrupted research signature on host PV | Failed RCP-01 | 1 |
| Candidate PMT back to refusing host: valid signature at same/different version; invalid signature at same version | Failed RCP-03 on recomputation refusal | 0 |
| Missing backend on the signed bridge inputs | Unverifiable RCP-08 | 0 |
| Candidate PV back to host | Failed RCP-03 | 1 |

The host's own PV agreement supplies the remaining positive control. All12
receipt/source/result-digest/signing-payload bindings and real signature outcomes
(10 byte-valid/two invalid) are independently checked offline through the pinned
accepted canonicalizer; three detached-payload negative controls refuse. Seven
primary backend invocations are recorded. Independently checking byte validity
when the actual API returned before its backend is **not** API authentication.
No authentication workaround or new refusal precedence is introduced.

Capture00ee57d7/treeaeb86cb4 records WindowsAMD64, CPython3.12.3,
Node24.14.1/V8 13.6.233.17-node.44/OpenSSL3.5.5;16 compressed artifacts
preserve193176 raw bytes. All106 source/reference and86 compiled-JS identities
are unchanged, and consumed host/candidate scratch artifacts remain byte-exact.
Manifest SHA-256 is
`8fa5f57a05b7c7607ff172c2a5fc7175789ebe76a0648e13ac7ae6725c117b22`.

Matching hosts follow their actually observed agreement branches, rather than
being forced to exhibit the original Windows refusal/0 result. The candidate
probe also accepts the frozen newly issued Windows host record as a gzip input
for a separately recorded cross-runtime replay; support for that command alone
is not an observed Linux execution. The earlier Linux36-case host agreement and
all original raw studies/receipts retain their original scope. No new global
runtime/domain/accuracy guarantee, production activation, component version,
legacy regime or automatic artifact reissuance follows.

This closes the natural financial-output-to-receipt evidence gap for these two
inputs, including the reverse finite-to-refusal path. The remaining owner choice
is the complete procedure/accuracy/refusal contract and the joint receipt policy
already identified above. A successfully verified candidate receipt demonstrates
repeatable stated procedure/signature checking; it cannot by itself establish
useful whole-formula accuracy. No stable financial formula, tolerance, numerical
selector or new signing domain is selected, and RFC0088 remains draft.

### Complete bounded NPER log-consumer checkpoint (unaccepted)

The [14-input NPER study](https://github.com/UWMD-OSP/UW-Markdown/blob/56526800/experiments/numerical-0088/nper-log-quotient/README.md)
adds independent composed log-quotient evidence, distinct from the old178 scalar
and4730-row power-consumer studies. Exact real-input log intervals use rational
atanh-series tails, exact interval division and midpoint RN certification; ideal
positive-log rounding on already-rounded graph inputs remains a separate
counterfactual with explicit raw IEEE specials, not an executed MPFR/B adapter.
Five mathematically undefined expressions are classified separately from actual
builtin/evaluator return or refusal. No new real-domain admission rule is inferred.

Nine real-expression answers are certified: two zero-rate rational branches and
seven log-quotient interval proofs, all complete at80terms. The two independent
candidate graph executions retain141 ordered guard/operation rows, including
the guard's ratio division and its repeated calculation, numerator log before
base/denominator log, short-circuit refusals and original exceptional-value bits.
The NPER table above now records that actual sequence rather than its earlier
abbreviated denominator-log-first presentation. This is a draft research-record
correction, not production activation or a new normative financial procedure.

A and the ideal-log graph have equal result/refusal in all14 inputs. Actual
unmodified/baseline/candidate boundaries agree on the captured WindowsNode24
runtime; no new host difference or universal platform claim follows. Among nine
certified real results, two finite outputs are one adjacent word from whole-real
RN but report the same12-place value; two nonfinite outputs refuse despite
finite mathematical answers; one raw negative-zero output reports0 against
reference1. Individually correctly rounded positive-real logs do not establish
whole-formula RN: an exact dyadic rate/payment/pv/fv case with real result3
returns word `4007ffffffffffff`, while certified whole-real RN is
`4008000000000000`. Both report3 at the existing final boundary.

At rate-1, the current raw internal `log(0)` gives -infinity and the quotient
returns+0/report0, although the real log-quotient expression is undefined.
Rate-2 instead reaches raw NaN and final CALC-TYPE-001. Applying the public log
wrapper's domain guard internally would change these observed semantics; this
study does not do so. These controls expose the exact real-domain/IEEE-special/
final-refusal decision still owed by a complete acceptance contract, without
selecting a new rate cutoff, stable log1p formula, iterative solver or tolerance.

Capture7747e60d/tree7bcfa001 records WindowsAMD64, CPython3.12.3,
Node24.14.1/V8 13.6.233.17-node.44. Sixteen compressed artifacts preserve314642
raw bytes and all104 source/reference plus86 compiled-JS identities unchanged.
Manifest SHA-256 is
`d9582a6764e4b7c403f87860ee33e64417769843eaeb591a386e7341da1a2141`.
The largest certificate is34671bits; at most256oracle-series terms/63midpoint
search iterations are a bounded research procedure, not a production work limit.
Original NaN bits remain raw, with class-only comparison explicitly separate.

This closes one log-consumer evidence gap for14 fixed four-argument word inputs.
It does not establish a global accuracy/resource bound, null/nonfinite/defaulted
argument semantics, other financial consumers/day counts, spreadsheet parity or
new receipt consequences. Existing cancellation/receipt/native/platform artifacts
remain unchanged. The later owner direction selects A and unchanged financial
associations; stronger primitive rounding alone does not resolve these observed
composed accuracy limitations. Complete the exact financial-domain/refusal contract
and independent evidence before final RFC acceptance. No new stability graph or
production/schema/corpus/version change follows from this observation.


### All-three-day-count financial checkpoint (unaccepted)

The [dated-conventions study](https://github.com/UWMD-OSP/UW-Markdown/blob/1a52efd965a6acebbcac2f82108e2a2b618aafca/experiments/numerical-0088/dated-conventions/README.md)
adds48 fixed word-input cases/21,969 complete candidate trace rows across
actual/365f, actual/360 and30/360us. Separate JS civil-era and Python complete-year
calendars agree with actual production yearfrac words; independent candidate
financial graphs agree through complete XNPV/XIRR, source-row order, bisection,
refusal and VIII.5 reporting. Years0000/0099/0100/9999, leap and same-date rows,
31st-day clamps and the intentionally absent February NASD adjustment are covered.

Capture63fc5a5d/tree1623b6d4 records one WindowsAMD64/CPython3.12.3/
Node24.14.1 execution; all five command exits are0. Thirty-nine finite returns
and nine existing refusals agree with actual production boundaries in each mode.
One natural host/A XNPV difference survives12-place reporting for a leap/same-date
30/360us case:23000.59185661716 versus23000.591856617175. No new receipt is
issued or verified for it, and no accuracy claim is inferred from matching traces.

Five focused methods pass. Existing NPER14 and earlier primitive/financial/
receipt matrices are reused unchanged, not rerun. Complete consumer/domain/
resource evidence, independent financial platforms, current launch receipt
precedence and advertised spreadsheet recalculation remain explicit acceptance
work. No production, schema, conformance, version or RFC state is activated.


### CI scope for the current continuation

Published draft head090a4d97506dbbead091d0d64692528b49e132ae has completed
successful ordinary CI39066289328 and numerical research CI39066289340. These
are existing exact-head results, not execution evidence for the later NPER14 or
all-convention48 studies. Their Windows local observations and focused controls
are established separately above. Final integration-head CI is **pending**.

The integration checkpoint will execute new current NPER14 and all-convention48
captures on Linux/Node20 and retain their actual command/result scopes in the
existing PR. Cancelled numerical jobs remain cancelled evidence; a green ordinary
job or an archived matching manifest cannot be substituted for an executed
financial study. A future successful Linux capture supplies that declared
platform only, not an unmeasured macOS financial run or universal accuracy proof.
Old source/archive retention guards and foreign prelaunch-receipt replay are
retired under the owner rule; current focused financial/refusal/authentication
controls remain. No final-head CI success or owner acceptance is claimed here.


### Selected-direction authentication procedure checkpoint (unaccepted)

The owner direction above is now exercised by the
[authenticate-first proposal](https://github.com/UWMD-OSP/UW-Markdown/blob/5e5c1b0967a151fa9e47f758e8bd41418024dc66/experiments/numerical-0088/authenticate-first/README.md).
Capture20aae888/tree048dc8ca executes six groups with26 state rows: one actual
current counterexample and25 proposed states, using current public model APIs
and real disposable Ed25519 signatures. Eleven backend invocations include seven
valid cryptographic checks, three invalid checks and one intentional transport
throw. The invalid-signature/typed-compute-refusal counterexample changes from
current RCP-03 with backend0 to proposed RCP-01 with backend1 and no compute.
Valid-signature refusal authenticates first, then keeps RCP-03/recomputed:[].

The joint matrix preserves existing wire/source/subject/held-input/pack/missing-
backend preflights, finite result coverage/value/engine attribution and later
results_digest corruption. It separately tests malformed Unicode signature
payload rejection and backend-throw transport. Authentication failures omit
unevaluated recomputed output. Current canonical payloads are independently bound
to the actual backend inputs, and complete synthetic receipts/signatures/results
are in the execution output for independent inspection.

This is one WindowsAMD64/Node24.14.1/V813.6.233.17-node.44/OpenSSL3.5.5 run.
All six methods pass with0 failures/skips/cancellations;271 current source/dist/
fixture identities match before and after. No numerical matrix is repeated and
no production verifier, spec, schema, corpus, version or RFC state changes.
Independent review, final normative/conformance synchronization and exact-final-
head CI remain required. This proves the bounded selected authentication direction,
not final RFC acceptance, issuer trust, financial accuracy or platform universality.
