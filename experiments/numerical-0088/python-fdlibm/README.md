# Independent Python pinned-fdlibm research candidate

UNACCEPTED. This stdlib-only adaptation reads the pinned C procedure, not JS
implementation code or host-transcendental outputs. It is an isolated research
kernel, never imported by production Python, financial packages or conformance.
It does not accept RFC 0088 or select a new accuracy/domain/error contract.

`kernel.py` implements all seven raw helpers, including integral, negative and
fractional pow. Independent Python structure separates negative-base parity,
pow's split log2, and pow's residual exponential/scaling phases. Standalone log
and exp remain their distinct C algorithms; pow never substitutes exp(y*log(x)).
The exact common constant-word table is shared input evidence, not an independent
constant derivation. Its frozen SHA and all eight primary upstream hashes are
pinned in `evidence-inputs.json`. Sun permissions are retained in kernel.py and
the unchanged upstream copies. No JS runtime or third-party dependency is used.

Word extraction uses struct's explicit big-endian binary64 encoding. Python's
unbounded integers are reduced explicitly at signed32/unsigned32 assignment and
overflow sites. pow phase integers are range-bounded before shifts/conversion;
scalbn k+n wraps modulo 2^32, including its source recovery branch. sqrt retains
both restoring-digit loops, explicit unsigned carries/borrows, and the count32
transfer-as-zero interpretation. Left shifting negative words means low32 bits,
right shifting signed words is arithmetic, and unsigned count32 returns zero.
No Python shift-count masking or C pointer aliasing is inherited.

Every floating arithmetic operator is a separate Python binary64 operation;
association follows the C expressions, with no FMA or algebraic stabilization.
`divide` maps Python's zero-division exception to raw IEEE NaN/signed infinity.
No host pow/log/exp/sqrt/fabs/copysign/scalbn or arbitrary-precision real evaluator
is used by the kernel. Input/output NaNs are compared by class; NaN payloads,
exception flags and alternate rounding modes are not portable guarantees.
This requires nearest/even binary64 basic arithmetic and gradual underflow; it
is not a software emulation of arbitrary Python float platforms.

Resource control is scalar and deterministic: pow/log/exp/scalbn/fabs/copysign
have bounded branch graphs; sqrt has at most two transfer bodies, twenty
leading-bit search bodies, 22 high-digit and 32 low-digit bodies (76 total),
plus bounded rounding. pow can invoke sqrt once, or scalbn once, not recursion.
No input-selected precision escalation, external calls or timing-based refusal.
The raw API expects decoded binary64 Python floats and signed32 scalbn integers.
`run.py` provides the existing raw JSONL word protocol. Invalid records fail as
harness errors, not synthetic numerical answers. JSONL stream length is caller
controlled; the scalar bound does not bound a whole unbounded input stream.

`wrappers.py` separately models the current public boundary over decoded floats:
null/type/arity handling; log <=0 and sqrt <0 domain checks; only pow/exp refuse
nonfinite results. Raw internal infinities remain usable (e.g. a later division
can return finite zero). This adapter neither implements the complete Python
calc evaluator nor changes its supported capabilities or manifest.

Focused commands (existing expected evidence is read-only):

```sh
python -B -m unittest discover -s experiments/numerical-0088/python-fdlibm -p "test_*.py" -v
python -B experiments/numerical-0088/python-fdlibm/check_evidence.py
python -B experiments/numerical-0088/python-fdlibm/run.py < inputs.jsonl
```

The evidence checker reads the existing 4204 frozen operands and three archived
native-C output streams, plus 178 independent mathematical certificates. It
records finite/signed-zero/infinity words separately from NaN classes, and keeps
mathematical disagreements visible. A new optional --output path is opened
exclusively: existing files cannot be overwritten. No baseline generation mode.

## Observed bounded revision

Eleven focused unittest methods pass on **CPython 3.12.3, Windows 11 build
26200, AMD64**. The final observation was generated from checkout
`461de70e8bc6911799f3cfa7083b1d85d3b7c86d`, tree
`e63e11db44efd9f176c2d3d072763848f33fcc91`; its five Python source
hashes identify the actual executed observer/kernel/runner/wrapper/test files.
The subsequent commit adds this record and prose, not a new numerical graph.

`observations.json` SHA-256:
`c47588ec623352ada82f4916f599af1d6f8e3601014dd4176d15bd3ca677b114`.

The new Python calculation agrees with **4204/4204 existing frozen inputs** in
EACH of the three historical native archives: **3435 exact finite/zero/infinity
words and 769 NaN classes** per archive. These are three archived compiler streams,
not three newly executed Python platforms or a rerun of those compilers. Python
ran once on the Windows host above. There is no new Node execution or JS oracle.

Against the **178 unchanged exact mathematical references**, 173 output words
agree and these same five positive-output discrepancies remain (one ULP each):

| Fixed mathematical control | Python candidate word | Mathematical word |
|---|---|---|
| exp(input `3fd62e41ffffffff`) | `3ff6a09e0c594ff2` | `3ff6a09e0c594ff3` |
| exp(1) | `4005bf0a8b14576a` | `4005bf0a8b145769` |
| pow(2,-0.5) | `3fe6a09e667f3bcc` | `3fe6a09e667f3bcd` |
| pow(exact represented 1.2,31) | `4071cda00ebe20d6` | `4071cda00ebe20d7` |
| pow(2,1.5) | `4006a09e667f3bcc` | `4006a09e667f3bcd` |

The recorded distance is the signed raw integer-word difference; these five
positive outputs make magnitude one an adjacent-word/one-ULP difference. The
references remain mathematical answers, while this record reports approximation
results. Do not change either graph or reference to manufacture agreement.

`evidence-inputs.json` pins each existing upstream, constant, input, mathematical
and native-archive file. Key exact SHA-256 identities:

| Input | SHA-256 |
|---|---|
| 4204 operands (`native-reference/inputs.json`) | `8af9d8851e4ac9857844250ebaa8c7bd083556f6e53d2184a24c7fdd1b027703` |
| 178 mathematical operands | `cb0079655db3c641bb4e7a04708dadc43be20ee34a9b04e16fccd3694e585911` |
| Mathematical certificates | `4d388ee0be56d3f39ad20c13975fa0b283e0e410126235f5768a6411a987faca` |
| Common exact constant words | `e9793112e7a5d0e2c1ccb2f8d8dd9bbc35608598cf725cb8e5ee44117dad59d9` |

The tests include exact-rational negative-unit parity at exponent/low-word edges;
IEEE zero division; signed-zero/subnormal/negative-power controls; scalar sqrt
loop tracing; type/null/public-versus-internal exception separation; static
host-transcendental escape checks; mathematical discrepancies; and refusal of a
tampered frozen constant file. The raw JSONL driver refuses malformed words.
All commands consume existing evidence; none regenerate expected words.

## Procedure coverage and remaining evidence

| Raw helper | Complete selected C behavior retained |
|---|---|
| pow | Exponent zero before NaN; +1/-1/+2/+0.5 branches; negative-base integral parity; zero/infinity/NaN; huge exponents and near-one reduction; split-log2/high-low product; residual exponential; signed normal/subnormal/overflow/underflow scaling. In particular, abs(base)=1 with infinite exponent returns NaN in this source contract. |
| log | Zero -> -infinity; negative -> NaN; NaN/+infinity classes; subnormal normalization; near-one and both polynomial association branches. |
| exp | NaN/+infinity/-infinity branches; finite overflow/underflow; tiny-input sum; both reduction intervals; normal/subnormal output scaling. |
| sqrt | Raw signed zero, negative/NaN/infinity, subnormal normalization, both restoring digit loops, carry/borrow and nearest/even rounding probes. |
| scalbn | Signed32 exponent admission, source-specific extreme-n branches, explicit k+n wrap/recovery, normal/subnormal scaling, zero/NaN/infinity. |
| fabs / copysign | Binary64 sign-word replacement without a host libm operation. |

The 76-body bound refers to sqrt's numerical recurrence/normalization loops.
Fixed-length 16-character constant-word decoding is additional bounded work,
not a precision escalation. Integer-to-float conversions are exact bounded
scale values; exp's float-to-integer conversion truncates only after finite
threshold checks. Direct caller misuse or unsupported arithmetic environment
is a harness/API error; no new numerical/financial refusal is inferred.

Finite source reproduction does not prove every branch, whole-domain accuracy,
universal correct rounding or a global one-ULP bound. Complete independent
financial operation graphs/IRR trajectories, VIII.5 decimal-string quantization,
reported assertion behavior and receipt authentication/refusal still require
separate work. This kernel does not implement those layers. Independent Python
platform coverage, browser and spreadsheet parity remain unobserved here. No
old corpus or nine-platform job is rerun. The provisional A research preference
is not numerical/RFC acceptance, production activation or release approval.
