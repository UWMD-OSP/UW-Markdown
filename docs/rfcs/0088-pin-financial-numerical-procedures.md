---
rfc: 0088
title: Resolve financial power and transcendental reproducibility
status: accepted
author: UWMD maintainers
created: 2026-10-15
accepted: 2026-10-18
affects:
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0088: Pinned numerical procedures and authenticate-first receipts

## Owner acceptance — 2026-10-18

> RFC 0088 accepted: architecture A, one exact pinned fdlibm procedure for pow, exp and log across every exponent class, with authenticate-first receipt precedence, as drafted at 86a20fe5.

The owner also accepts the measured spreadsheet-parity findings as export-contract
limits. This PR activates the accepted contract in the standard, reference
implementation and conformance. It assigns no package/specification version and
authorizes no release, tag or publication. Issue #356 is resolved by the exact
procedure, rather than a host-libm name, runtime selector or separate integer
power algorithm. Architecture B is not selected. Stability rearrangements using
log1p/expm1 remain outside this acceptance.

## Accepted decisions

- All pow/exp/log calls use the same exact pinned procedure, including fractional,
  integral, negative and exceptional exponent classes.
- Preserve financial associations, defaults/null/type checks, quantizer and IRR/
  XIRR solver. No financial model generation or new metric convention is added.
- Verify a supplied receipt signature before computation and any refusal verdict,
  after the established wire/source/subject/dependency preflights.
- Public pinnedPow/pinnedExp/pinnedLog are the same function bindings used by
  internal financial consumers and re-exported by verify/browser and core/browser.
- Native spreadsheet formulas are a limited export representation. UWMD verifies
  the stated record, never the spreadsheet's recomputation.

## Primitive, admission and resource contract

**Procedure identity and arithmetic.** Use the exact eight-file closure in
[`sources.json`](https://github.com/UWMD-OSP/UW-Markdown/blob/03872a5f03a9c6d0238e464b1ee423182bef2455/experiments/numerical-0088/pinned-fdlibm/sources.json),
with all constants decoded from the certified binary64 words in
[`constants.json`](https://github.com/UWMD-OSP/UW-Markdown/blob/03872a5f03a9c6d0238e464b1ee423182bef2455/experiments/numerical-0088/pinned-fdlibm/constants.json)
and the complete
[`WORD-SITES`](https://github.com/UWMD-OSP/UW-Markdown/blob/03872a5f03a9c6d0238e464b1ee423182bef2455/experiments/numerical-0088/pinned-fdlibm/WORD-SITES.md)
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

The public calc guards remain part of the accepted contract. Do not
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
[`DOMAIN-RESOURCE`](https://github.com/UWMD-OSP/UW-Markdown/blob/03872a5f03a9c6d0238e464b1ee423182bef2455/experiments/numerical-0088/pinned-fdlibm/DOMAIN-RESOURCE.md).

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
consumer evidence supports the specified procedure; no whole-formula RN or universal one-ULP guarantee is asserted.


## Ordered financial graphs

B rounds each basic operation to binary64 nearest/ties-even; P and L are the
pinned power/log procedures. Flow accumulation stays left to right. Omitted
optional fv/pv defaults remain zero only at their existing builtin boundary.

| Function | Accepted ordered graph |
|---|---|
| Periodic NPV | `b=B(1+r)`; for index `t=0..n-1`, `d=P(b,t)`, `term=B(flow[t]/d)`, `sum=B(sum+term)` starting at positive zero. |
| IRR | Existing bracket/endpoints/bisection/tolerances/200-step refusal, using this NPV graph; preserve current multiplication sign tests and midpoint associations. No Newton step, flow normalization or outside-bracket fallback. |
| PMT | If `r==0`, `B(pv/n)`; otherwise `b=B(1+r)`, `d=P(b,-n)`, `den=B(1-d)`, result `B(B(pv*r)/den)`. |
| FV | If `r==0`, `B(pv+B(pmt*n))`; otherwise `g=P(B(1+r),n)`, `a=B(pv*g)`, `c=B(B(pmt*B(g-1))/r)`, result `B(a+c)`. |
| PV | If `r==0`, `B(B(pmt*n)+fv)`; otherwise `d=P(B(1+r),-n)`, `a=B(B(pmt*B(1-d))/r)`, `c=B(fv*d)`, result `B(a+c)`. |
| NPER | Current observed sequence: if `r==0`, refuse `pmt==0`, then `B(B(pv-fv)/pmt)`; otherwise `a=B(pmt-B(fv*r))`, `b=B(pmt-B(pv*r))`; refuse `b==0`, then evaluate `q_guard=B(a/b)` and refuse `q_guard<=0`. Repeat `q=B(a/b)`; evaluate `num=L(q)` before `base=B(1+r)`, `den=L(base)`, result `B(num/den)`. Retain the raw-log and final-result boundaries specified above. Retain closed form; no iterative amortization search. |
| XNPV | Existing integer day count divided last into binary64 `t`; `b=B(1+r)`, `term=B(amount*P(b,-t))`, left-to-right binary64 sum. Do not replace multiplication by division, even at integer-looking `t`. |
| XIRR | Existing VIII.9.3 solver, using this XNPV graph; no native Excel solver substitution. |

Annuity number/type/arity checks remain as implemented at the accepted checkpoint:
PMT rejects exactly zero periods, without introducing a positive-integer period
restriction. FV/PV retain negative/fractional numeric periods and their existing
zero-rate branches. NPER keeps its zero-rate/payment, zero-denominator and quotient
sign guards in the displayed order. Final nonfinite handling remains the existing
consumer/evaluator policy; do not add a finite-intermediate guard or infer debt
schedules from these expressions.

## Receipt authentication and verdict precedence

The following order is normative in Receipt §5.1 and implemented directly by
verifyReceipt. It changes no receipt wire field, subject canonicalization or
result-digest algorithm.

1. Malformed receipt wire values retain the typed transport refusal. A record
   that cannot canonicalize is unverifiable/RCP-09.
2. Compare the subject digest: mismatch is failed/RCP-01, or unverifiable/RCP-10
   when the canonicalization identities make the mismatching digests incomparable.
3. A held referenced-input digest mismatch is failed/RCP-12. Otherwise collect
   unavailable input RCP-11, pack RCP-05/06 and signature-backend RCP-08 findings
   in that existing order; return unverifiable before authentication/computation.
4. Authenticate a supplied signature exactly once over receiptSigningPayload.
   Invalid signature or malformed-Unicode signing input is failed/RCP-01, with no
   recomputed member; malformed Unicode does not reach the backend. Supplied
   backend exceptions propagate through the existing transport boundary. Unsigned
   receipts acquire no authentication claim.
5. Recompute. A typed financial refusal is failed/RCP-03 with recomputed:[],
   including when engine identity differs. This is not a finite-result disagreement.
6. Compare complete finite result coverage and values using existing RCP-02/03
   rules. A disagreement with different engine name/version is unverifiable,
   leading with RCP-07; otherwise it is failed. Engine identity alone is no issue.
7. Only after agreement, check the stated results_digest; corruption or an
   uncanonicalizable result string is failed/RCP-04. Otherwise return verified.

## Spreadsheet export contract

A spreadsheet's native recalculation of exported formulas may differ from the
pinned procedure beyond about eleven significant digits, and may return errors
on IEEE edge cases, including subnormals and overflow. These are accepted
export-contract limits, not defects in the pinned procedure. This is not a
universal promise of agreement through eleven digits. Keep the existing financial
graphs and quantizer; do not change arithmetic to obtain a spreadsheet answer.
UWMD verifies the stated record, never the spreadsheet's recomputation.

The ten-control study executed LibreOffice24.2.7.2 420(Build:2), including changed
input and full restore:13 comparison agreements, one finite12-place POWER/ROUND
export disagreement and six #NUM! cells. H4 native284.851576559724 versus pinned
284.851576559723 is retained as observed. Raw-word differences are reported
separately. Internal POWER Infinity producing a finite NPV zero, a public primitive
refusal and a spreadsheet error remain distinct outcomes.

## Evidence and conformance

The accepted draft checkpoint is86a20fe5f95f56bad5766f559817b6f7ef102b2c:
[ordinary CI](https://github.com/UWMD-OSP/UW-Markdown/actions/runs/39108903528)
and [numerical research](https://github.com/UWMD-OSP/UW-Markdown/actions/runs/39108903513).
Its independent native/Python/TypeScript raw procedures, word/constants/resource
proofs, mathematical controls, composed financial/refusal/quantizer trajectories,
current1106-case impact, real-signature precedence matrix, browser and named-engine
spreadsheet observations remain scoped evidence, not a universal accuracy claim.
The exact procedure has measured accuracy; no correctly-rounded primitive or
whole-financial-formula guarantee is inferred. Existing cancellation and solver
edge behavior is deliberately retained.

Current activation conformance adds direct production primitive/refusal/IRR
controls and authenticate-first state coverage. Direct unmodified production
financial results are compared with the separately implemented Python reference;
old host-substitution/AST-relocation probes are not activation evidence.
No unrelated frozen expectation is changed to obtain a pass. Final integration
uses exact-head and exact-main CI, recorded in PR #357.

Research inputs and reproducible commands remain in
[the numerical review](https://github.com/UWMD-OSP/UW-Markdown/blob/main/docs/reviews/2026-10-15-numerical-determinism-356.md) and
[experiment directory](https://github.com/UWMD-OSP/UW-Markdown/tree/86a20fe5f95f56bad5766f559817b6f7ef102b2c/experiments/numerical-0088).
Earlier draft alternatives and pending-gate notes at that checkpoint do not
supersede this accepted contract.
