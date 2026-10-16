# RFC 0088 power procedure lab — unaccepted alternatives

This isolated experiment advances D2/D3/D4/D6 of draft RFC 0088. It selects no
financial procedure, admitted UWMD domain, error code, rounding rule or kernel.
Nothing imports it into production or conformance. No package, dependency,
receipt, signature, baseline, release version or RFC status changes. The earlier
cross-runtime 4,310-case investigation and fdlibm source audit are not rerun.

## Exact inputs and independent reference

[inputs.json](inputs.json) freezes 40 exact binary64 operand-word pairs, including
signed zero/subnormals, huge integer parity, adjacent-to-integer exponents,
integer multiplication order, reciprocal range, fractional roots and a general
fraction deliberately outside the oracle's scope. Decimal labels are explanatory;
hex words define the inputs. Input construction used only exact binary identities
and CPython decimal-to-binary64 conversion/struct, never host power. Generation
and focused validation: Python 3.12.3, Node 24.14.1, Windows AMD64, 2026-10-16.
This is one measured environment, not multiple-platform coverage.

[reference.py](reference.py) never constructs a float and imports no math/libm,
Decimal, UWMD implementation or Node. It decodes finite words as exact dyadic
rational values and uses integer arithmetic to compare adjacent binary64
midpoints. Every basic multiplication/division is rounded once to nearest,
ties to even, including gradual underflow. The overflow midpoint is
`MAX_FINITE + 2^970`; ties there overflow. Zero sign comes from the graph's sign
operation, since rational zero alone cannot retain it. Hand-specified tests pin
normal/subnormal ties, both signs and the overflow boundary independently.

The mathematical-power reference admits only exact exponent `p/q` with
`abs(p)<=256` and `q<=16` (binary64 makes q a power of two). For positive base,
compare candidate^q to exact base^p; binary search finds neighboring binary64
values and an exact midpoint comparison selects the nearest/even value. Negative
bases require integer exponents in this lab. Frozen nonexact-root certificates
record both neighbors and the midpoint relation. All comparisons are exact:
there is no chosen decimal precision or unproved high-precision stopping test.
Outside that bounded oracle scope, evidence explicitly says `outside_oracle_scope`.
This is an intentionally costly offline reference, not a production real-power
kernel or proof that all exponents can be handled with that resource bound.

[evidence.json](evidence.json) separately freezes classification, mathematical
reference result/certificate and all three ordered graphs' result/refusal,
operation count and step-trace hash. A trace is the ordered JSON array of
`[operation,left_word,right_word,result_word]` records, encoded without spaces,
then SHA-256. It is research provenance, not an Envelope or receipt digest.
It includes the exact input-file and reference-source hashes. The independent
JS implementation [candidates.mjs](candidates.mjs) executes ordinary binary64
multiplication/division from the stated graph and checks every result and trace
hash against the frozen rational reference; it never invokes pow/log/exp.
This is independence from host transcendental output, not proof of an entire
independent financial Verifier.

## One explicit, unaccepted dispatch alternative

Apply these rows in order before graph execution. These are local research
statuses, not new UWMD verdicts or approved changes to current null/type behavior.

| Inputs | Experimental action |
|---|---|
| Either word nonfinite | `nonfinite_input`, even NaN with exponent zero. Finite-admission-first is a candidate adapter policy, not adoption of all ECMAScript special cases. |
| Exponent +0 or -0 | Return +1, including 0^0, as a candidate owner choice. |
| Base +0/-0, negative exponent | `zero_negative_exponent`; no manufactured finite result. |
| Base +0/-0, positive exponent | Negative zero only for negative-zero base and exactly odd integer exponent; otherwise positive zero. |
| Negative nonzero base, noninteger exponent | `negative_fractional_domain`; no complex result. |
| Base +1, or -1 with integral exponent | Exact signed unit without an exponent-sized loop; parity is defined on the exact binary64 exponent, not a narrowed integer cast. |
| Other integer exponent | Run a selected graph only for absolute exponent <=256; otherwise `lab_budget_refusal`. This bound is solely the experiment budget, not a proposed standard restriction. |
| Other fractional exponent | `fractional_kernel_required`. The separately frozen mathematical reference is evidence for a future kernel; the experiment does not pretend it implements that kernel. |

Integer detection is exact, including the word immediately below 1. Values at
and above 2^53 are integral and even; 2^53-1 is odd. Do not coerce a fractional
exponent, truncate it to a machine word or route an integer-looking XNPV year
fraction through a different financial association. Source type/null admission
is outside this word-only harness and remains an acceptance requirement.

[ECMAScript 2025 Number exponentiation](https://tc39.es/ecma262/2025/multipage/ecmascript-data-types-and-values.html#sec-numeric-types-number-exponentiate)
is a primary-source comparison for special cases, not the UWMD answer: its
general power result is implementation-approximated. The mathematical oracle
above is an independent exact derivation. No MPFR or vendor implementation is
executed, bundled, or presumed to certify it.

## Three exact candidate operation graphs

Let `B(op)` mean one binary64 operation, nearest/even, with gradual underflow,
no FMA/contraction/excess precision, no reassociation, and immediate local refusal
if that operation produces a nonfinite result. A rounded finite subnormal or
signed zero is retained. This refusal policy itself is unaccepted.

- **sequential-late:** `a=+1; f=x; n=abs(integer_y)`; repeat exactly n times
  `a=B(a*f)`. If y<0, finish with `a=B(1/a)`.
- **binary-late:** `a=+1; f=x; n=abs(integer_y)`; while n>0, if n is odd set
  `a=B(a*f)`; then replace n by floor(n/2); only if n>0 set `f=B(f*f)`.
  If y<0, finish with `a=B(1/a)`. No unused final square executes.
- **binary-early:** for y<0 start `f=B(1/x)`; otherwise f=x. Run the same binary
  loop; no final reciprocal. This is a different graph, not an optimization of
  binary-late.

All branches stop at the first nonfinite operation; later operations are not
executed. The frozen trace includes that refused operation. Sequential work is
at most 257 basic operations in this lab. Binary work is bounded by
`2*bit_length(abs(y))-1` plus at most one reciprocal, hence <=18 here; early
specials may need none. Parsing, real fractional kernels, financial expression
length and solver iterations are separate budgets. No claim about source-size,
startup, browser speed, a whole kernel or arbitrary exponent domains follows.

## Measured distinctions, not selected answers

All words below are fixed evidence over the exact input words in inputs.json.
These are raw power results, not financial assertions or final quantization.

| Control | Sequential-late | Binary-late | Binary-early | One-rounded mathematical reference |
|---|---|---|---|---|
| `order-1.0001-127` | `3ff0345929946e2d` | `3ff0345929946e21` | `3ff0345929946e21` | `3ff0345929946e2d` |
| `negative-order-1.1-31` | `3faaacadc6ed30cd` | `3faaacadc6ed30cd` | `3faaacadc6ed30d0` | `3faaacadc6ed30ca` |
| `large-base-negative-two` | nonfinite intermediate | nonfinite intermediate | `000012688b70e62b` | `000012688b70e62b` |
| `half-minsubnormal-power` | +0 | +0 | +0 | +0, exact midpoint ties to even |
| `near-one-sqrt` | fractional kernel required | fractional kernel required | fractional kernel required | `3ff0000000000000`, strictly below the rounding midpoint |

Thus specifying binary squaring alone does not imply correctly rounded power;
reciprocal placement affects both range and rounding. The finite negative-power
case is not evidence that reciprocal-first is universally accurate or range-safe.
A finite positive input producing an unrepresentable positive intermediate is
not the same as a mathematically unrepresentable final result. Underflowed zero
has signed tie/neighbor obligations and must not conceal a prior overflow.

## NPV/IRR, quantization and receipt boundary

This harness deliberately does not implement NPV/IRR or alter their accepted
bracket, endpoints, sign tests, midpoint associations, tolerance or stopping.
A later candidate must compose the selected primitive with the separately
specified financial graph: periodic NPV divides each flow by the factor and
sums in source order; XNPV multiplies amount by a negative power. Replacing one
with the other changes rounding even for an integer exponent. A changed factor
can alter a solver endpoint sign or refusal before any final quantization.
No root-bracket expansion, flow normalization or stabilized annuity formula is
licensed by primitive agreement here.

The rounding tests concern binary64 RN-even at individual operations; they do
not replace VIII.5 half-away-from-zero decimal-string-shift quantization. They
also do not prove equality after money/default/custom quantization. Next evidence
must retain primitive words, full financial operation traces, accepted final
quantization/source precision, public assertion state and quantized result digest
as separate layers, including ties and adjacent words of both signs. No host
ToString or exact-decimal alternative is silently substituted for that existing
quantizer. This lab creates no financial expected answer.

Choosing one graph later is a numerical contract decision with Protocol/engine
identity and affected-consumer accounting. Block/source/document-signature
subjects do not change from arithmetic alone; old receipt artifacts remain
untouched. Existing receipt precedence stays: source/digest/signature refusals
are not excused by a new engine; different-engine recomputation disagreement is
RCP-07, while an engine difference with agreement is not alone a refusal. The
same-engine/different-runtime gap remains disclosed. No dual legacy evaluator,
automatic old-receipt rehash, runtime identity field, historical support promise
or literal release version is added. RFC 0085 and the 5.0 launch reservation
remain separate.

## Reproduction and actual validation

From repository root, without installation:

```sh
python -B experiments/numerical-0088/power-procedures/freeze.py --check
python -B -m unittest discover -s experiments/numerical-0088/power-procedures -p "test_*.py" -v
node --test experiments/numerical-0088/power-procedures/candidates.test.mjs
```

`freeze.py` without --check permits only first creation; it refuses to overwrite
existing evidence. Tests never rewrite vectors. Reference code changes must be
reviewed along with any separately proposed evidence regeneration.

Actual focused results: six Python methods passed; two JS tests passed all 40
classifications and 120 graph-result/trace comparisons. No full suite was run for
this chunk and no untested platform is reported as passed. Exact LF hashes:

```text
inputs.json    ea798c32ade509e09ed556c1335197a528b7d883c3bc4c0cf43b331f2ebe8af5
evidence.json  535c280d7059d417dbbd693b575a9599a1fe043afc7fa3edae47d6ed6f4f7c2e
reference.py   87d3609c85876c4e2c41b5f71b5c8e0377a7c953ab5846ef1f6c09fb736b3808
candidates.mjs 845e448b5af3038db9b203a0d0b0824d95d77f883c156e6c454c1f13b2870581
```

This narrows dispatch, graph, bounded-reference and adversarial-vector work.
It does not establish a general fractional/log/exp kernel, its hardest rounding
cases, a full domain/refusal policy, a complete financial graph or cross-platform
Verifier/spreadsheet conformance. Those are still explicit RFC acceptance items.
