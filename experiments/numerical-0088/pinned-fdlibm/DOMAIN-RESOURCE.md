# Raw domains, wrapper observation and resource bound

**Unaccepted isolated research.** This file separates source-kernel values from
current public-builtin observations and eventual RFC decisions. Nothing here is
an accepted domain restriction, numerical convention, public API or error code.

## Raw binary64 interface

`kernel.mjs` exports `pow(x,y)`, `log(x)`, `exp(x)`, `sqrt(x)`, `scalbn(x,n)`,
`copysign(x,y)`, `fabs(x)`. Floating operands must be primitive Numbers; all IEEE
classes, including infinities and NaNs, are in the raw source interface.
`scalbn` n must be an integer in [-2147483648,2147483647], matching C int32;
its argument validation throws a local RangeError outside that API domain.
None of the numerical helpers calls the public wrapper or checks every internal
value for finiteness. No general fractional path is refused or left unimplemented.

| Helper / input class | Raw outcome follows pinned source |
|---|---|
| pow, either signed-zero y | +1, even for NaN/infinite x. This branch precedes NaN processing. |
| pow, NaN x or y except the previous case | Arithmetic NaN. |
| pow, finite nonzero negative x and nonintegral finite y | Arithmetic NaN, not a local public refusal. |
| pow, signed-zero x and nonzero finite y | Signed zero for positive y, signed infinity for negative y; negative sign only for -0 base and odd integral y. |
| pow, finite x and integral/fractional finite y in real domain | Exact pinned source path, including source range behavior. Negative exponents do not imply universal reciprocal of positive pow. |
| pow, |x|=1 and infinite y | NaN under this pinned source, distinct from merely imposing a mathematical convention. |
| pow, infinite x and finite nonzero y | Infinity for positive y, zero for negative y; negative sign only for negative base with odd integral y. |
| pow, infinite y and finite |x| other than1 | Source growth/decay branches give positive infinity or +0; exponent0 case remains earlier. |
| log, +/-0 | -Infinity. |
| log, negative finite x / -Infinity | NaN. |
| log, +Infinity / NaN | +Infinity / NaN; log(1)=+0. |
| exp, +/-0 / +Infinity / -Infinity / NaN | +1 / +Infinity / +0 / NaN. Other inputs follow reduction/polynomial/scaling, including final overflow and subnormal output. |
| sqrt, +/-0 / +Infinity / NaN | Same signed zero / +Infinity / NaN. Negative finite/-Infinity produce NaN. |
| scalbn, +/-0 / +/-Infinity / NaN | Source preserves signed zero/infinity; NaN remains NaN. Other inputs use signed32 exponent-sum/source overflow and gradual underflow branches. |
| fabs, copysign | Word masks/sign transfer, no domain or finite-result refusal. |

Raw generated NaN payload/sign and IEEE exception status flags are not portable
comparison claims. A reference comparison matches NaNs by class. Finite result
words, zero sign and infinity sign are exact subjects. In particular, the source
uses invalid division/overflow expressions deliberately; replacing these with a
blanket exception or finite-intermediate refusal changes its behavior.

## Separate current-policy observation wrapper

`wrappers.mjs` is an executable observation adapter to the present builtin guard
structure, with its computational primitive replaced by this unaccepted candidate.
It returns local research records, not production CalcResult or CalcError objects.
It is **not** a new normative policy and is **never imported by the raw kernel**.

| Boundary | Observed current guard structure retained by `currentPolicy` |
|---|---|
| All four wrappers | Arity first; each argument accepts null or typeof number (no blanket finite admission); all argument type checks precede pow's null result. Null propagates after type checking. |
| pow | Guard final result finite; Infinity^0 and NaN^0 can return1, while negative fractional and overflow outcomes refuse. |
| exp | Guard final result finite; exp(-Infinity) can return0 while exp(+Infinity)/exp(NaN) refuse. |
| log | Reject n<=0; +Infinity is returned and NaN propagates by existing comparison behavior. No added finite-result guard. |
| sqrt | Reject n<0; -0 is retained, +Infinity is returned and NaN propagates. No added finite-result guard. |

The adapter uses observed code CALC-TYPE-001 only as metadata. It records arity,
type, domain and nonfinite_result as **local reason strings**, not new protocol
codes or a claim that messages/result structures are byte-identical to production.

This differs from an earlier finite-first proposed domain. Applying finite-first
admission would be a separate owner decision; it cannot be slipped into this port.
Current-policy wrappers do not settle original-source admission, verifier state
or receipt failure precedence. An input type shape is distinct from an IEEE value
reached by an internal expression.

For example the candidate can return Infinity for a large positive power, and an
internal `amount / Infinity` can subsequently return finite0. Calling public pow's
finite-result guard there would refuse earlier and change periodic NPV. Focused
tests check this distinction. They do not replace the integrator's separate
production `irr`/`npv` and receipt-precedence reproductions. No solver graph,
endpoint order, sign-product test, tolerance, iteration cap or receipt rule is
changed by this lab. Final VIII.5 quantization is absent from raw helpers and
remains separate from primitive RN-even rounding.

## Deterministic scalar resource bound

Power, logarithm, exponential, scalbn, copysign and fabs have no loops or recursion.
Pow calls only fabs, scalbn or software sqrt from this same closed module; sqrt's
only loops are the four source digit/normalization loops. Its raw negative,
zero, infinity and NaN branches return before normalization.

For positive finite sqrt operands under the explicit word model:

1. A nonzero52-bit subnormal significand requires at most2 low-to-high transfer
   iterations of21 bits. The following high normalization search requires at
   most20 single-bit iterations. These separate maxima give a conservative bound;
   they need not occur together.
2. The high digit mask starts at0x00200000 and shifts logically until0: exactly22
   iterations. The low digit mask starts at0x80000000: exactly32 iterations.
3. Thus **at most76 loop-body iterations** per sqrt, and at most76 inside any one
   top-level pow call; other helpers execute none. Every loop body has fixed
   finite scalar word/basic operations and no dynamic precision or allocation.

This is a structural bound over the specified binary64/signed32 interface, not a
new cap or a measured clock-time claim. Only one sqrt call occurs on pow's+0.5
fast path; there is no exponent-sized integer loop or host-transcendental call.
There is constant scalar state, one fixed8-byte adapter DataView and fixed module
constant tables. `fromBits` accepts exactly16 hexadecimal digits, so its BigInt
conversion is bounded to64 bits; raw kernel arithmetic does not use BigInt.

Total document parsing, AST size, many calls, ordered cash summation, existing
IRR/XIRR bisection, Python accuracy proof generation, JSONL IO and optional
instrumentation are outside this scalar bound. No throughput, bundle size,
spreadsheet parity or hostile-document budget has been measured here. An
independent reviewer must validate the mapped source sites and whole-program
resource composition before any standard/evaluator claim.
