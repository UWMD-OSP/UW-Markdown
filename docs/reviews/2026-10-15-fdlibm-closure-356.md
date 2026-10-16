# RFC 0088 candidate kernel closure and bounded-work study

Date: 2026-10-15 (America/Phoenix). Scope: draft RFC 0088 / #356 / PR #357.
This is a source-only feasibility study of one candidate, not a kernel selection,
implementation, accuracy test or accepted numerical procedure. It supplements
[the existing cross-runtime evidence](2026-10-15-numerical-determinism-356.md);
the completed 4,310-vector investigation was not repeated.

## Reproducible candidate identity

The adjacent [source manifest](2026-10-15-fdlibm-closure-356.sources.json) freezes
the exact eight public Netlib source-file lengths and SHA-256 hashes read for
this study. The URLs are mutable; byte identity is checked before inspection.
It identifies a candidate source snapshot, not a verified fdlibm release archive
or the implementation used by any particular Java runtime. No third-party
source or runtime dependency is vendored or added to a package.

Run the [read-only audit](2026-10-15-fdlibm-closure-356.audit.py):

```sh
python docs/reviews/2026-10-15-fdlibm-closure-356.audit.py
python docs/reviews/2026-10-15-fdlibm-closure-356.audit.py --source-dir /path/to/exact/source/files
```

The first command downloads only those public sources. The second checks an
already obtained snapshot offline. Both fail on a byte/hash or loop-token
mismatch and execute no downloaded code. Loop-token checking is a lexical guard
after stripping comments, not a C parser, call-graph proof or numerical oracle.
The helper and control-flow analysis below was reviewed manually against the
hashed source. Successful hashing does not validate any arithmetic claim.

## Closed candidate graph

| Entry point | Called computational helpers | Proposed research linkage |
|---|---|---|
| `__ieee754_pow` | `sqrt`, `fabs`, `scalbn` | Map to the exact helper bodies below, with separately specified bit access and arithmetic semantics. |
| `__ieee754_log` | None | Its own reduction/polynomial graph, not an invocation of the power routine. |
| `__ieee754_exp` | None | Its own reduction/polynomial graph, not a host exponential. |
| `__ieee754_sqrt` | None | The software digit-by-digit body in `e_sqrt.c`. |
| `scalbn` | `copysign` | Include the underflow/sign path, not a host `pow(2,n)` substitution. |
| `fabs`, `copysign` | None | Explicit sign-bit transformations. |
| All seven bodies | `fdlibm.h` high/low word access | Replace historical pointer macros with specified binary64 word operations. |

The power function uses its square-root fast path for positive bases and exponent
0.5; its general path performs its own split logarithm/exponential work. Calling
the separate candidate `log` and `exp` instead changes its graph. Raw `sqrt`
and `scalbn` references are externally linked names in this source: compiling
only `e_pow.c` can silently leave host-library dependencies. Exact helper
mapping therefore belongs in the candidate definition.
Sources: [power](https://netlib.org/fdlibm/e_pow.c),
[logarithm](https://netlib.org/fdlibm/e_log.c),
[exponential](https://netlib.org/fdlibm/e_exp.c),
[square root](https://netlib.org/fdlibm/e_sqrt.c),
[scaling](https://netlib.org/fdlibm/s_scalbn.c),
[absolute value](https://netlib.org/fdlibm/s_fabs.c) and
[copy sign](https://netlib.org/fdlibm/s_copysign.c).

This research graph excludes POSIX/SVID wrappers, errno behavior and
`__kernel_standard`. They are not called by these raw bodies. UWMD admission,
null propagation and existing typed refusals still require their own complete
adapter table; the C routines' NaN/infinity outputs are not a new UWMD error
contract. Optional-profile closure remains a separate inventory.

## Resource result and its limits

Inspection of the hashed bodies shows no loops in power, logarithm, exponential,
scaling, absolute value or copy sign. Their scalar control-flow length does not
grow with the magnitude of an integer exponent. No arbitrary exponent-step cap
is needed merely to bound these candidate bodies.

The software square root has four loops. Under explicit unsigned 32-bit word
operations and finite positive binary64 inputs, the normalization loop that
transfers the low word executes at most twice; the following left-shift search
executes at most 20 times. Its two digit loops start with bit masks
`0x00200000` and `0x80000000` and shift logically toward zero, giving exactly
22 and 32 iterations when reached. Thus at most 76 total loop-body iterations
are needed per square-root call; special cases can return earlier.
This is a control-flow bound inferred from the fixed word widths, not a measured
timing, proof of a completed port, or arbitrary input restriction.
See [the square-root source](https://netlib.org/fdlibm/e_sqrt.c).

It supports studying preservation of today's finite scalar input domain without
a sequential-product exponent cap. It establishes no accuracy guarantee.
Parsing, expression size, repeated calls and IRR/XIRR's existing per-stream
solver work remain outside this scalar bound. No browser/TypeScript/Python code
size, allocation, startup or execution benchmark has been performed.

## Portability obligations exposed by the closure

The historical [header](https://netlib.org/fdlibm/fdlibm.h) accesses words through
C pointer casts and architecture-dependent endianness macros. It cannot itself
serve as the portable bit-operation contract. A research port needs exact
high/low 32-bit extraction/insertion, signed versus unsigned interpretation,
two's-complement wrapping and shift-count rules. Python integers do not wrap;
JavaScript bitwise operators use signed words and masked shift counts. Preserve
the graph's intended word operations explicitly rather than translating syntax.

In particular, the square-root normalization includes a shift by `32-i`:
when `i=0`, copying the spelling across languages does not establish its
meaning. Signed left shifts and carry/borrow tests need the same review.
This is a porting obligation; this study neither compiles the C nor certifies
its behavior under a particular compiler's undefined/implementation-defined
operations. The 76-iteration result is conditional on the defined word model.

Every constant must be pinned by binary64 bits, including constants without
annotated hexadecimal words. Every floating operation must round to binary64 in
the chosen order with gradual underflow. Exclude reassociation, contraction and
excess-precision retention. The square-root body's rounding-mode probes must be
resolved under the stated nearest/ties-even primitive model, not copied as
claims that all hosts expose or preserve C floating exception flags. C/Python
division-by-zero behavior also differs. Keep raw-kernel special values separate
from UWMD error timing. These requirements are part of the experimental port
specification, not changes to Protocol VIII.5 or the financial graphs.

The source notices permit redistribution with their notices preserved. A later
adaptation must retain the applicable Sun notices rather than treating the
candidate as newly authored MIT-only UWMD code. This manifest contains metadata
only. A dependency or distribution decision remains outside this study.

## Next bounded experiment and acceptance boundary

Use this exact closure for an isolated candidate port only if that candidate is
chosen for study. Specify the bit adapter first; independently author TS and
Python paths from the pinned algorithm and adapter. Freeze input bytes plus
binary64 operand encodings before executing either. Compare the power 0.5 path,
signed zero, smallest/largest subnormal boundaries, huge signed exponents,
negative-base parity, normalization carries and scaling underflow explicitly.
Record raw candidate answers, independently justified accuracy-oracle answers,
composed financial outcomes and final quantization separately.

No host-majority answer, source hash, finite-work bound or Java name settles D1–D8.
The precise remaining decisions are the numerical guarantee and selected
procedure, complete admitted domains/refusal timing, approved financial graphs
and stability scope, compatibility activation/versioning, and the evidence needed
for independent-platform and spreadsheet claims. No RFC is accepted, numerical
expectation changed, historical receipt rewritten or release prepared here.
