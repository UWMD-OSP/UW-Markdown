# Actual procedure alternatives for RFC 0088

**UNACCEPTED research and owner direction proposal.** This comparison specifies
three implementable designs and their missing evidence. No production evaluator,
financial convention, conformance answer, dependency, version or receipt changes.
The owner may choose an architecture without accepting RFC 0088. Algorithms A/B
and the fractional part of C are **not implemented or executed in this lab**.

## Recommendation and smallest decision

Develop **A, the exact pinned fdlibm procedure for all exponent classes**, with
independent word-level TS/Python ports and measured accuracy, while using B as an
independent correctly-rounded comparison implementation if its packaging and
resource requirements can be met. A specifies one reproducible answer; it does
not promise mathematical correct rounding. A is a recommendation for proposal
completion, not permission to activate it. If primitive correct rounding is an
owner requirement, choose B's contract instead and resolve its resource problem
before acceptance; do not relabel A as correctly rounded.

C is genuinely implementable for every finite integral exponent and has a cheap
operation bound. It does **not** remove A's fractional/log/exp dependency. Its
integer answers and refusal points differ, and no measured package-size or
performance advantage here justifies an additional integer convention. Recommend
against C as a distinct contract without that demonstrated benefit. A can already
use its pinned exponent 1/2/0.5 fast paths; replacing more branches by C would
create a fourth procedure, not optimize A transparently.

The smallest owner choice is **procedure-specific exact answers (develop A) or
correctly-rounded primitives (develop B)**, preserving the existing financial
operation graphs, VIII.5 and solver rules in either case. C is a concrete rejected
recommendation, not an unstated default. Complete the chosen domain/error/resource
and compatibility evidence before returning the RFC for acceptance. No literal
version or launch date is proposed.

| Question | A: pinned fdlibm throughout | B: MPFR binary64 contract | C: integer graph + A fractional kernel |
|---|---|---|---|
| Actual power procedure | Exact eight-file source closure below, `__ieee754_pow(x,y)` for integral and fractional y | Exact word adapter below, `mpfr_pow(...,MPFR_RNDN)` then ternary-preserving binary64 subnormal step | Reciprocal-first binary graph below if y is exactly integral; otherwise A's `__ieee754_pow` |
| Log / exp | Exact `__ieee754_log` / `__ieee754_exp` bodies | `mpfr_log` / `mpfr_exp` with same adapter | Same A bodies; no host fallbacks |
| Answer guarantee | Procedure-specific; no universal correct-rounding claim | Correctly-rounded primitive, assuming library guarantee and adapter are fulfilled | Ordered basic-operation result for integers, procedure-specific approximation otherwise |
| Domain / range | All finite input words through proposed real-domain/special table; final nonfinite refusal | Same table; final nonfinite refusal; mathematical primitive range handled by library+adapter | Same table, but an integer basic-operation nonfinite refuses immediately; rounded zero retained |
| Primitive work bound | Existing source analysis: fixed branches, only sqrt has bounded word loops; port must preserve that closure | 53-bit destination does not bound internal precision or allocation; no portable hostile-input maximum established | At most 1,024 iterations / 1,077 basic operations for integer path; A bound for fractional/log/exp |
| Executable evidence here | Word adapters only; no complete port | Correct-rounding API contract only: unpatched4.2.2 build and reduced-range adapter unexecuted/unverified; generic upstream BUGS and exact patch applicability unresolved; rational double-rounding hazard is not MPFR execution | Independent rational and JS integer implementations, 24 frozen cases; fractional/log/exp unimplemented |
| Shipping cost / feasibility | 43,025 source bytes in pinned C closure, not a bundle measurement; TS/Python software ports still required | Native C MPFR+GMP, or a separately built/validated Wasm distribution plus bindings; no JS/Python/OS package measurements | Small integer graph plus essentially A's remaining closure; integer counter up to 1,024 bits |
| Dependency / license | No new runtime dependency required by a software port; retain Sun source notice | MPFR LGPL v3-or-later; GMP LGPLv3-or-later or GPLv2-or-later dual licensing in selected archive; distribution/linking review needed | Same notices/closure obligation as A, plus new independently authored graph |
| Main blocker | Complete independent ports, constant-word/site mapping and measured accuracy/domain/impact | Exact patch/known-bug applicability, actual reduced-range adapter and counterexample tests, deployment/license review and resource policy/proof | New rounding semantics without measured benefit; still incomplete fractional kernel |

## Common boundaries, explicitly proposed rather than accepted

`B(op)` is one binary64 basic operation with nearest/even rounding, gradual
underflow and no FMA, reassociation, retained excess precision or flush-to-zero.
Input decimal conversion is a separate contract. Primitive results retain signed
zero; final VIII.5 normalizes reported zero under its existing rules. Null/type
propagation remains at the existing evaluator boundary; these word-level labs
only investigate numeric operands.

Finite-word admission comes before all specials, so a nonfinite operand does not
become successful merely because y=0 or x=1. For admitted finite inputs, proposed
power dispatch is: y=+0/-0 returns +1 (including 0^0); signed zero with negative
y refuses; signed zero with positive y returns -0 only for a negative zero base
and exactly odd integral y, otherwise +0; a negative nonzero base with a
nonintegral y refuses. Positive unit base returns +1; negative unit requires an
integer y and returns its exact parity sign. Other finite real-domain inputs go
to the selected procedure. The parity of 2^53-1 is odd; every represented integer
of magnitude at least 2^53 is even. This uses **represented input values**, not an
original decimal token's unrepresented integer.

Proposed log domain is finite x>0, with log(1)=+0; zero/negative inputs refuse.
Exp admits finite inputs, returns +1 for either signed-zero input and +0 on true
underflow; final overflow refuses. Power finite rounded underflow, including
negative zero for negative-base odd integer powers, is distinct from overflow or
invalid input. Exact public error mapping and timing against existing financial
errors still need a complete accepted table. Lab status strings are not new
protocol codes.

All alternatives require every financial basic operation at the already proposed
explicit B boundary; selecting correctly-rounded primitives does not make an
entire composed expression correctly rounded. A kernel must be able to evaluate
its own specified exceptional control expressions: do not impose C's immediate
basic-operation refusal on A's internal `huge*huge`, `tiny*tiny` or invalid-result
construction. A/B check the adapted primitive's final result after input/domain
selection, not every internal algorithmic temporary.

## A: exact fdlibm procedure, no integer substitution

Identity is the unchanged eight-file source manifest,
not the label “fdlibm”, “StrictMath” or whichever libm ships with a host.
In particular [Netlib e_pow.c](https://netlib.org/fdlibm/e_pow.c),
`763b86baa63eb3518b43f7f3e44e5ed10992b62650f4a45c3a2ea6015e6d5122`,
has the source identifier `e_pow.c 1.5 04/04/22 SMI`. Its bytes were rechecked for
this comparison; the completed eight-file audit was not repeated. Netlib URLs are
mutable; the eight content hashes define the candidate. No claim of equivalence
to every Java/OpenJDK release follows from the StrictMath precedent.

The exact arithmetic graph is the source body and frozen constants with explicit
word semantics, not a newly fitted polynomial. For general power it normalizes
subnormal |x| by 2^53, selects the 1 or 1.5 interval, forms split high/low log2
terms with the pinned L1..L6 polynomial, splits y by clearing its low word,
multiplies high/low pieces in source association, applies the source overflow and
underflow tests, then evaluates its pinned P1..P5 reduced exponential and scales
by a power of two. The |y|>2^31 and >2^64 branches, near-one expansion and sign
parity remain exactly as written. Exponents +1/-1/+2 use x, B(1/x), B(x*x);
positive x with exponent +0.5 uses the pinned software sqrt, not host sqrt.
General negative powers are handled by this same source graph, not a universal
reciprocal of a previously computed positive power. Its internal split log2 and
exponential are **not** calls to the standalone log/exp functions.

`log` and `exp` are separately the exact pinned e_log.c/e_exp.c range reduction,
polynomial and scaling graphs. The sqrt, scalbn, fabs and copysign closure is
mandatory. The source/adapter study
records its conditional bound (at most 76 sqrt loop-body executions under the
specified word mapping); this is not a complete evaluator cost bound. No exponent-
sized multiplication loop is used. Implement every C signed/unsigned32 operation,
carry/borrow, conversion, 0/32 shift and high/low insertion through an explicit
site map; the C header's aliasing and signed shifts cannot be copied blindly.
Pin **all** constant binary64 words, including constants with no hexadecimal
comment, and each parenthesized B operation. That map and constants are pending
port artifacts; their absence is why this is not an executable complete candidate.

A covers the proposed finite domain algorithmically, but source comments about
accuracy are not a proof of worst-case ULP error. Measure against independent
correct-rounding evidence, keep any counterexample, and choose an explicit
accuracy claim before acceptance. No unmeasured “within one ULP” claim is made.
The original Sun notice permits use/copy/modification/distribution with notice;
an eventual port must preserve it rather than label copied material solely MIT.

## B: concrete MPFR 4.2.2 / GMP 6.3.0 binary64 adapter

[sources.json](./sources.json) freezes official archives and the exact manual,
pow/log/exp/subnormal/conversion/license member hashes. MPFR 4.2.2 archive:
`b67ba0383ef7e8a8563734e2e889ef5ec3c3b898a01d00fa0a6869ad81c6ce01`
(1,505,596 bytes); GMP 6.3.0 archive:
`a3c2b80201b89e68616f4ad30bc66aee4927c3ce50e33929ca819d5c43538898`
(2,094,196 bytes). These hashes identify whole unpatched source distributions,
including their helper dependencies. Selected member hashes make review precise;
they are not an audited minimal MPFR closure. Archives were read inertly, not
installed/built/executed. HTTPS certificate verification was enabled; upstream
release signatures were not checked, so hashes are not a signature claim.

The [versioned MPFR 4.2.2 manual](https://www.mpfr.org/mpfr-4.2.2/mpfr.html),
especially Rounding-Related Functions, Assignment Functions, Conversion Functions
and Transcendental Functions, is the primary API contract. Candidate adapter:

1. Save exponent-range/flag state in a dedicated or proven thread-local context;
   create inputs and output at precision **53**. Before loading or computing,
   set/check `emin=-1073`, `emax=1024`. MPFR's [.5,1) exponent convention differs
   from the usual binary64 unbiased exponent. Restore state on all exits; do not
   race process-global settings in a build without the required isolation.
2. Decode each finite input word: normal `s=(2^52+fraction)` and
   `e=exponent_field-1075`; subnormal `s=fraction`, `e=-1074`. Apply sign to the
   integer s and call `mpfr_set_z_2exp(input,s,e,MPFR_RNDN)`, requiring exact
   ternary zero. This represents the exact binary64 value at precision 53.
   For zero use `mpfr_set_zero(input,+1/-1)` separately: integer zero loading
   would erase -0. No decimal reparse or language `long` truncation is allowed.
3. Apply the common input/special table above, then use precisely `mpfr_pow`,
   `mpfr_log` or `mpfr_exp` with `MPFR_RNDN` and destination precision 53. Generic
   `mpfr_pow` receives the exact input exponent object even for huge integers;
   do not narrow y through `pow_si`/`pow_uj`. `mpfr_powr` and a user-level
   `mpfr_exp(B(y*mpfr_log(x)))` are different procedures. MPFR can internally
   increase precision and rescale; calling its primitive is not a graph of
   user-visible 53-bit log, multiply and exp intermediates.
4. Retain the **actual operation's ternary return** `t`, then call
   `t=mpfr_subnormalize(output,t,MPFR_RNDN)` under that same range. This rounds
   to the binary64 subnormal grid 2^-1074 and preserves direction needed to
   avoid double rounding. Do not set t=0, independently round an approximation,
   or change emin only after the operation. NaN/infinity are rejected as final
   outcomes; nonzero inexact/underflow flags alone are not failures.
5. Encode the final finite result without another approximate conversion.
   For zero read sign separately and emit its exact zero word. For nonzero,
   `mpfr_get_z_2exp` yields exact signed integer z and exponent e with value
   z*2^e. Let k=floor(log2(|z|))+e, using integer bit length. If k>=-1022,
   normalize to integer S in [2^52,2^53), set field=k+1023 and fraction=S-2^52.
   Otherwise compute integer Q=|z|*2^(e+1074) exactly, require
   1<=Q<2^52, and emit subnormal fraction Q. Attach sign; all right shifts
   must have zero discarded bits. This proves no conversion rounding occurs.
   An alternative `mpfr_get_d` path requires a tested IEEE binary64 C double
   and this same successful subnormal step first, not an arbitrary53-bit
   approximation followed by double conversion.

The MPFR API guarantees correctly-rounded target-precision operations. The
subnormal adapter supplies binary64's missing grid; correct rounding is not
inferred from choosing precision 53 alone. A new exact-rational test illustrates
an actual failure of that shortcut: with u=2^-1074 and
v=1.5u-2^-1128, unbounded-exponent precision 53 rounds to 1.5u, then a naïve
binary64 conversion chooses 2u, although v rounds directly to u. Negative v has
the analogous -u/-2u discrepancy. This proves the need for ternary preservation;
it is **not** a claim that this lab executed MPFR or that a particular pow input
produces v. Real pow/log/exp subnormal vectors must exercise the library adapter.

The selected src/pow.c and src/log.c use precision-growing Ziv loops. A precision 53
destination neither fixes their working precision nor bounds time/memory. The
whole archive pins implementation identity, but no proven maximum over all
admitted binary64 input pairs is established here. A wall-clock timeout is not
a portable numerical refusal. A narrower deterministic resource contract would
need a justified precision/work bound or explicit new domain/refusal; neither is
selected. Out-of-memory/host failure must not become a valid numerical answer.

The pinned archive's `BUGS` file records generic overflow/underflow and reduced-
exponent-range caveats. The API guarantee is not a proof that this unexecuted
build/adapter has no implementation defect. The [official version page](https://www.mpfr.org/mpfr-4.2.2/)
currently reports patch level2; the archive frozen here is explicitly the
unpatched4.2.2 identity, not a tested patch-level2 distribution. Before any oracle
or shipping claim, reconcile actual patch bytes/known-bug applicability and run
the selected primitive's reduced-range/subnormal adversarial tests. Any changed
source revision requires new provenance; no silent patched-library substitution
is authorized by these hashes.

MPFR is a C/GMP dependency. A browser port needs a separately reproducible Wasm
build, exact bindings/context/flags, memory policy, notices and independent test
coverage. A Python package wrapping an arbitrary installed MPFR version is not
this adapter. No dependency or binaries are added here. Shipping size, startup,
per-call cost, allocator limits and threading are **unmeasured**. The archive
license files identify MPFR LGPL v3-or-later and GMP's LGPLv3-or-later/GPLv2-or-later choice; actual
link/distribution obligations need review before adoption. This source analysis
does not approve an external runtime dependency.

## C: executable integer graph with A's unimplemented fractional path

`hybrid_reference.py` independently derives each step from exact Fractions and
the existing midpoint helper; `hybrid.mjs` executes native basic binary64 mul/div,
never host pow/log/exp. Exponent classification is exact from the whole binary64
word. A negative exponent first computes f=B(1/x); a positive exponent uses f=x.
The counter is the exact magnitude of the represented integer y:

```text
a=+1; n=abs(exact_integer(y))
f=B(1/x) if y<0 else x
while n>0:
    if n is odd: a=B(a*f)
    n=floor(n/2)
    if n>0: f=B(f*f)
return a
```

Common specials precede this graph. Every executed nonfinite basic result stops
with local `intermediate_nonfinite`; rounded zero is retained and does not stop
the remaining finite graph. There is no unused final square, final reciprocal,
exponent32 narrowing, 2^53 safe-integer restriction or exponent256 lab admission.
A finite integral exponent has bit length<=1024 and popcount<=53: at most 1023
squares plus 53 accumulator multiplies, plus 1 initial reciprocal for negative y.
Thus at most 1077 basic operations; the bound excludes word parsing/classification
and enclosing financial expression/solver work. These constants are structural
bounds, not new input refusals or financial conventions.

The actual full hybrid would call A for all nonintegral positive-base powers and
for log/exp, with the same finite/domain/final adapter. In this executable lab,
that path explicitly returns `fdlibm_fractional_required` with no answer. Do not
mistake successful integer vectors for whole-domain power or Verifier conformance.

## Frozen new evidence and earlier counterexamples

[inputs.json](./inputs.json) has 24 fixed word pairs; [evidence.json](./evidence.json)
freezes classifications, independent exact step results/counts/trace hashes and
the old bounded mathematical reference where applicable. No random host-generated
power values or new financial expected answers are used. The reused rational
helper hash and new reference/input hashes are in evidence; every preceding lab
blob is unchanged. Huge-input mathematical answers remain `outside_oracle_scope`
except hand-proved unit/zero/underflow identities; no giant rational exponent or
arbitrary decimal precision is used as an unbounded oracle.

| Frozen new control | Integer-graph result / exact scope |
|---|---|
| 0.5^MAXfinite | +0 after 1076 operations; exact real result below half-minsub |
| 2^(-MAXfinite) | +0 after 1077 operations, including reciprocal |
| (-0.5)^(2^53-1) | -0 after 105 operations; exact odd parity |
| (1+2^-52)^(2^53) | Graph word `401d8e64b16f0b93`, 54 operations; mathematical CR answer not claimed |
| (1+2^-52)^257 | `3ff0000000000101`, 10 operations; no 256 cap |
| Word601dd55745cbb7ed raised to-2 | Nonzero subnormal `000012688b70e62b`; agrees with bounded exact mathematical reference |
| 2^.5 | `fdlibm_fractional_required`; independent bounded mathematical word `3ff6a09e667f3bcd` is not substituted |
| 1.1^-31 (exact represented operands) | Graph `3faaacadc6ed30d0`, one-rounded mathematical `3faaacadc6ed30ca` |

Previously frozen evidence is reused rather than regenerated:

- [Power lab](../power-procedures/README.md): sequential versus squaring at
  1.0001^127; reciprocal-late loses the 1e155^-2 representable subnormal;
  primitive RN-even/subnormal/zero controls. C retains reciprocal-first's known
  1.1^-31 difference from a correctly-rounded primitive. None of these records
  gives A's unimplemented general-path result.
- [Cash lab](../cash-graphs/README.md): candidate graphs change reported money
  1.00/1.01 and -1.00/-1.01, result-array canonical preimages/digests and IRR's
  exact endpoint10 versus no bracket or bisection-required. Ten fixed synthetic
  cash inputs do not estimate prevalence. These comparisons are **not** A/B
  execution results and do not establish A-versus-B financial output differences.

## End-to-end consequences shared by the alternatives

Each alternative composes its exact P/L/E with RFC0088's explicit financial
operation table; none selects a different annuity formula or solver. Periodic
NPV is b=B(1+r), d=P(b,t), term=B(amount/d), ordered accumulation from +0.
Dated XNPV remains term=B(amount*P(b,-year_fraction)) in source order, with the
existing day-count/year-fraction rules. Integer-looking year fractions do not
permit exchanging these associations. PMT/PV/FV/NPER use the RFC's B-parenthesized
closed forms and exact r==0 branches. Tiny nonzero rates for which B(1+r)==1 do
not enter a zero-rate branch, and no log1p/expm1 stabilization is implicit.

IRR still evaluates periodic NPV at -0.999 and 10, forms the binary64 sign product,
follows the existing bracket-failure and exact lower-then-upper endpoint order,
then bisects at most 200 times with abs(NPV)<1e-9 or half interval<1e-12. No
Newton polish, bracket expansion, flow scaling or new tolerance is proposed.
XIRR retains its separately accepted solver with the dated graph. Kernel output
changes can change a bracket sign or later branch; frozen endpoint evidence
already proves that this is consequential. No candidate's complete bisection
trajectory is executed by these labs. Do not promote missing-kernel/refused/
bisection-required evidence to a root, computed result or result digest.

Only the final value passes through existing VIII.5's shortest-decimal/string
exponent-shift, half-away reporting rule once. Primitive RN-even is distinct;
rounding exact binary fractions half-away or prequantizing discount factors would
change that rule. The old cash controls freeze result-array preimages, not issued
receipts. The selected candidate still needs exact public evaluateCalc, assertion,
receipt and real spreadsheet-recalculation evidence, with the supported engine,
precision and result/refusal scopes stated explicitly.

Numerical activation changes the Protocol calculation contract and needs a new
verifier **engine version** with exact dependent pins. It does not rename the
engine, amend source/block/document-signature subjects or require a new receipt
wire field by assumption. Preserve all original receipt/source artifacts.
Different-engine disagreement follows RCP-07 after earlier receipt digest and
signature checks; version difference with agreement is not itself unverifiable.
The demonstrated same-engine/runtime-disagreement gap remains disclosed and is
not retroactively excused. New financial values can change result digests and
new signatures over those subjects, never authorize rewriting historical ones.

Follow the owner's pre-release clean break: update current consumers to the
accepted procedure, enumerate old/new result/refusal and source/module impacts,
and choose Protocol/package versions and activation explicitly. No dual evaluator,
legacy numerical reader, runtime selector, automatic old receipt rehash or
migration compatibility shell is proposed. Archived evaluator reproduction is
separate evidence, not a fallback contract. RFC0085 and extension-envelope0089
remain separate; 5.0 launch reservation and release authority are unchanged.

## Exact acceptance checklist after an architectural direction

1. Freeze the chosen algorithm, constants and word/site adapter, input/special/
   final-error table and structural resource proof. A needs complete independent
   ports; B needs actual adapter execution plus resource/deployment resolution;
   C needs the entire A fractional/log/exp closure as well as its integer graph.
2. Execute both signed zeroes, 0^0, y=+/-1/+2/+0.5, negative base with integer/
   fractional exponent, log0/negative/1/near1, exp signed0 and overflow/underflow
   neighbors. Sweep sqrt subnormal normalization, pow's interval/split thresholds,
   scalbn boundaries and all constant-word/0/32-shift mappings. Keep exact input
   and result words; no tolerance-only pass.
3. Add independent mathematical midpoint/interval certificates for actual A/B
   hard pow/log/exp inputs, including binary64 subnormal ties and neighboring
   inputs. For B deliberately verify operation ternary survives subnormalize;
   tests must fail a t=0/naïve get_d mutant. The exact rational v example above
   is a prerequisite, not a replacement for actual primitive input vectors.
4. Freeze complete periodic/datetime/annuity and full IRR/XIRR trajectories,
   bracket-product/endpoint/error precedence, tiny-rate cancellation, money/rate/
   ratio/custom quantization ties and source-token precision. Compare candidate
   against every affected current conformance case without rebaselining it.
5. Independently execute TS/Python ports across supported runtime/OS/architecture
   rows, with versions/input/source hashes and retained failure logs. Current
   Node18.0/20/22/24, three-OS focused CI is an integrator checkpoint; its results
   must be recorded by the integrator, not inferred here. It cannot certify the
   still-unimplemented A/B/fractional parts. Measure browser/runtime cost and
   actual supported spreadsheet recalculation, not retained caches.
6. Record old/new raw/refusal/reported/result-array/digest outcomes and all six
   receipt scenarios in RFC0088, with unchanged earlier authentication precedence.
   Complete the explicit domain/compatibility/version decision before accepting
   or activating the numerical contract. No contract change is authorized here.

## Focused new checks and provenance

```sh
python -B experiments/numerical-0088/integer-dispatch/freeze.py --check
python -B -m unittest discover -s experiments/numerical-0088/integer-dispatch -p "test_*.py" -v
node experiments/numerical-0088/integer-dispatch/hybrid.test.mjs
```

The direct JS file uses assertions and is suitable for Node18.0 without assuming
its `--test` CLI. It emits one success line after every frozen classification and
result/trace agrees; nonzero exit retains failure. Freeze checks never overwrite
existing expectations. Six new Python methods include the exact subnormal adapter
hazard and hand-proved huge-exponent parity/operation bounds. Local observations
are recorded with the commit checkpoint; proposed CI rows are not claimed here.
No prior numerical audit, old lab or full workspace suite is repeated.

Actual local observation: Python **3.12.3**, Node **24.14.1**, Windows 11 build
26200 AMD64/x64. Freeze check, all **6** new Python methods and all **24** JS
classification/result/trace comparisons pass. This is one-host evidence; no
MPFR/fdlibm kernel execution or cross-runtime/OS observation is implied.

| New artifact | SHA-256 |
|---|---|
| inputs.json | `9b37fb8f29b9995a20feb75a72588b6a736f57f4ffc6d48d4d6b4bcf7fd103e3` |
| evidence.json | `ab23318bb0f6be44c021132f738e54a19598492a68814e5012cd0374377c545d` |
| hybrid_reference.py | `87b04c8f44d5407382fc237dd79a7fd0ff9b1fe7f7e8523106311c575af98682` |
| hybrid.mjs | `b9e867766cf04c6dd9f82d18411af23c0080deefee1ddb31effc8d49aa656347` |
| sources.json | `5032aa4587ce916ae30ca88e91131b7afb394eed94cd221c95a0fd8290074a60` |
