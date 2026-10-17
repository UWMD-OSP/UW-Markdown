# Complete isolated pinned-fdlibm research candidate

**UNACCEPTED, not production or conformance.** This directory implements one
complete JS candidate for the exact Netlib closure identified by `sources.json`.
It contains all seven numerical bodies: pow (integral and fractional), log, exp,
software sqrt, scalbn, copysign and fabs. No fractional path is a placeholder,
no host transcendental is used, and no source power is replaced by an integer
running product. The proposal remains RFC0088 draft; this does not select a
normative kernel, public domain/error policy, version, dependency or release.

## What is executable

| File | Role |
|---|---|
| `upstream/` + `sources.json` | Exact8 original source files/bytes/hash identity, including original Sun notices; `.gitattributes` disables newline conversion. This is the previously pinned source snapshot, not a claimed release archive. |
| `words.mjs` | Endian-independent binary64 extraction/insertion, signed/unsigned32, modulo wrapping, explicit whole-word shifts. |
| `constants.json`, `constants.mjs`, `generate-constants.py` | All C floating tokens converted to exact binary64 words by rational midpoint proof, then decoded by words in the runtime module; implicit small integer-to-float constants included. |
| `kernel.mjs` | All raw source bodies, mapped to explicit word operations and ordered binary64 arithmetic; Sun notice retained. Browser-compatible arithmetic module; no browser execution/bundle claim. |
| `wrappers.mjs` | Separate **current-policy observation** for pow/log/exp/sqrt null/type/domain/result guards. Never called by raw internal powers; no normative acceptance. |
| `run.mjs` | JSONL hex-word raw helper entry for independent native comparison. |
| `candidate.test.mjs` |7 focused groups covering identities/notices/constants, word/carry/shift semantics, all raw helpers, exception/wrapper separation and negative-unit parity across every finite exponent field. |
| `math_reference.py`, `math-inputs.json`, `math-evidence.json`, `freeze-math.py`, `test_math_reference.py` |178 independently certified mathematical controls and5 Python proof tests, generated without candidate/native/float/libm/Decimal. |
| `accuracy.mjs`, `accuracy-observations.json` | Separately labeled candidate observations against those mathematical answers; retains disagreements rather than changing the reference or kernel to match. |

Read [WORD-SITES.md](WORD-SITES.md) for the complete C variable/promotion/word-site
mapping and [DOMAIN-RESOURCE.md](DOMAIN-RESOURCE.md) for raw IEEE domains, wrapper
separation and the conservative76-loop-body scalar bound. These explicit maps
replace pointer aliasing, C signed-overflow/left-shift UB and the sqrt count32
ambiguity; they are part of this **candidate**, not an assertion that ISO C gives
those historical spellings the same meaning on every compiler.

## Exact primitive graph, constants and source identity

Pow retains the exact exponent0/+1/-1/+2/+0.5 paths, negative-base parity, huge
exponent/near-one branches, two-interval split log2/high-low product, pinned
polynomials, final exponential reduction and scaling. Its internal split log and
exponential are not replaced by calls to log/exp. The +0.5 path calls this exact
software sqrt. Log and exp retain their own pinned reduction and coefficients;
scalbn calls this exact copysign. Every floating operator rounds under binary64
nearest/even; original association remains, with no contraction/reassociation or
fixed-point quantizer. Current IEEE exception values remain usable internally.

The runtime constants come only from frozen16-digit binary64 words. The generator
checks all eight original source hashes, removes comments, parses C decimal-token
magnitudes as integer ratios and uses the existing independent adjacent-midpoint
rounder to choose each word. Unary minus remains exact sign inversion. Source
spelling aliases with identical word values can share a runtime constant (for
example huge in exp versus pow). The rational helper's exact hash is recorded;
no Node decimal parser or C compiler decides these expected words.

Original Sun1993/2004 permissions/notices are preserved in upstream/, NOTICE and
the adapted body; this is not an MIT-only relabeling. These local research files
add no external runtime/package dependency and are not imported by production.
Their placement is not approval to distribute a new verifier kernel.

## Independent bounded mathematical evidence and accuracy findings

The178 fixed inputs contain66 sqrt controls (all52 one-hot subnormals and selected
normal/range/word boundaries),13 log controls,11 exp controls,80 scalbn controls
including signed32 extremes, and8 bounded dyadic-power controls. Exact dyadic
input words are frozen before observing candidate output.

The reference uses exact rational midpoint comparisons for sqrt/scaling/bounded
powers. Log has a positive atanh series with a rigorous geometric tail plus
power-of-two reduction; exponential has a positive Taylor series with rigorous
tail and exact reciprocal for negative x. Each log/exp lower/upper rational bound
rounds to the same binary64 word. The proof generator tries bounded80/128/256
series lengths, refusing an uncertified interval rather than guessing precision.
It admits exp |x|<=1 only; bounded power numerator<=256 and dyadic denominator<=16
come from the existing mathematical reference. These are **oracle limits**, not
candidate admission/resource limits. No approximate host answer is authoritative.

On the measured Windows host, **173/178** candidate words match their independently
certified mathematical nearest/even words. Five disagree by exactly1 ULP:

| Control | Candidate word | Independently certified mathematical word |
|---|---|---|
| exp(input word3fd62e41ffffffff) | `3ff6a09e0c594ff2` | `3ff6a09e0c594ff3` |
| exp(1) | `4005bf0a8b14576a` | `4005bf0a8b145769` |
| pow(2,-0.5) | `3fe6a09e667f3bcc` | `3fe6a09e667f3bcd` |
| pow(exact represented1.2,31) | `4071cda00ebe20d6` | `4071cda00ebe20d7` |
| pow(2,1.5) | `4006a09e667f3bcc` | `4006a09e667f3bcd` |

These are measured **JS candidate** discrepancies, pending independent native-C
source-reproduction evidence. They are not evidence that the port matches C,
that fdlibm is universally correctly rounded, or a worst-case error bound. The
initial smoke test incorrectly labeled exp1's candidate word a mathematical known
answer; the independent proof exposed that mistake and the unsupported assertion
was removed. The exact mathematical answer and candidate observation both remain
visible. Never rebaseline mathematics to the candidate or alter the pinned graph
silently to eliminate an accuracy counterexample.

## Raw JSONL protocol

```sh
node experiments/numerical-0088/pinned-fdlibm/run.mjs < inputs.jsonl
```

Each input is one object with `id`, `op`, and `x` as16 lowercase hexadecimal bits.
Pow/copysign add `y` with the same shape; scalbn adds numeric signed32 `n`.
Operations are exactly pow/log/exp/sqrt/scalbn/copysign/fabs. Output is
`{id,op,kind,bits}` with kind finite/infinity/nan. Compare generated NaNs by class,
not payload/sign. Other output words include signed zero and infinity sign.
Invalid record/type/word or out-of-range scalbn n is a runner/API failure, not a
new financial refusal or synthetic numerical result. Empty input lines are ignored.

`kernel.mjs` also directly exports Number-valued helpers with those exact names;
`words.mjs` exports `fromBits(hex16)` and `toBits(number)`. No wrapper admission is
applied to the JSONL raw path. In particular, power can return Infinity before
an internal amount/Infinity division yields finite0; final public pow's finite
result check is not called at that intermediate point.

## Focused checks

```sh
python -B experiments/numerical-0088/pinned-fdlibm/generate-constants.py --check
python -B experiments/numerical-0088/pinned-fdlibm/freeze-math.py --check
python -B -m unittest discover -s experiments/numerical-0088/pinned-fdlibm -p "test_*.py" -v
node experiments/numerical-0088/pinned-fdlibm/candidate.test.mjs
node experiments/numerical-0088/pinned-fdlibm/accuracy.mjs --check
```

Local observation: Python3.12.3, Node24.14.1, Windows11 AMD64/x64. All source/
constant and mathematical freezes,5 Python methods,7 JS groups and the178-row
candidate observation check pass. The last check means **observations match their
record**, including five mathematical discrepancies; it is not178 accuracy passes.
The unit-parity group makes12,282 exact classification checks across all finite
exponent fields, selected significands and signs; it is not12,282 independent
unit methods. No old investigation/lab or full workspace suite was repeated.

## Completeness and remaining risks

The numerical helper closure is implemented completely in this isolated candidate.
Remaining gaps are evidence/review, not an unimplemented fractional placeholder:
independent native-C reproduction with matching word semantics and strict flags,
supported runtime/OS/architecture execution, independent Python port, broader
accuracy/domain analysis and complete financial/public/quantizer/receipt impact.
The integrator owns the native reference and CI; planned coverage is not observed
coverage. A finite corpus cannot prove every word/carry branch or universal
accuracy. There is no claimed native/Java/library equivalence yet.

This lab neither implements a new financial solver nor alters the existing one.
It adds no production import, optional profile, receipt/signature subject, source
rehash, conformance expected answer, baseline, dependency, compatibility fallback,
version or release preparation. Architecture direction and final RFC acceptance
remain separate. Provisional A preference does not convert these observations
into normative arithmetic or authorize the 5.0 launch.


## Style-only source identity update

After checkpoint `cf5277fc8d6738d4e8f30566c385b13654d1451f`, cached Biome1.9.4
applied only useSingleVarDeclarator/useNumberNamespace/useTemplate style rules.
Declarations were split in evaluation order and global Infinity/NaN constants
qualified; no floating operation, association, branch, constant word or wrapper
policy changed. The accuracy record refreshed **only kernel.mjs/run.mjs source
hash metadata**. All178 candidate/result/reference/distance records and following
summary bytes are byte-identical to that checkpoint; the mathematics and input
files are unchanged. Re-execution matches that unchanged record including all five
discrepancies. This is a style identity update, not rebaselining numerical answers.

| Artifact | Prior SHA-256 | Style-only SHA-256 |
|---|---|---|
| kernel.mjs | `2009293e956b55769393f21bbe9bb740bf28f6c561f16612dfc9e07eb6878f66` | `9cea03d62c453d2c6428f076aab1203c04920585f90dcb9815a98967f28fb5be` |
| run.mjs | `02c1f1c9861490d5a9316c17b5510612d1b3d8ef09efabf33f06980df93cd624` | `0c34bdb2f8e6fa9b9a1d5d8532e991b985f7bbe32296950c9a3d7996b6eb1571` |
| accuracy.mjs | `d98347f9a940ca75a29348b71c365389e3fd8a5950dcb81eb0ea0370d31f7a77` | `fb21f5966b269a2a06879650596468613d8558b38caaeabc23939d4c11956ee7` |
| candidate.test.mjs | `e4013ec98a0fe7a6c16a2b112c829c21f02527f1961304c6f1d257296ba404ba` | `e16f86abb47379602ae687a7adf24b79aa623099350df95d37bb87c9d00d4762` |
| accuracy-observations.json | `7e58ff691945950977bd2409cdbb6d53277601b10c91021d440f0b7ac40f58e8` | `98a440d23efea717de7a37758d2c5aad901f60f7c7a1fc34a644b240c3829300` |

Unchanged raw case/summary byte-slice SHA-256: `66650c1295ae31ef5957ac59482a11c456d5cd265578b7be4a84f71dfb06a498`.
