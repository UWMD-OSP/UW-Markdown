# RFC 0088 composed cash graphs — unaccepted evidence

This bounded follow-up composes the [three research power graphs](../power-procedures/README.md)
with declared financial associations and existing reporting rules. It does not
select a numerical contract or implement a financial engine. No production
imports, solver changes, schema/fixture/baseline changes, receipt issuance,
versions, RFC acceptance, historical artifact rewriting or new dependencies.
The previous runtime investigation, source audit and 40-input lab are not rerun
or modified. Scope is ten synthetic cash vectors and ten reporting controls.

## Contract versus candidate

The fixed reference is the accepted [Protocol VIII.3 solver and VIII.5 reporting](https://github.com/UWMD-OSP/UW-Markdown/blob/7eaa174cf1a4e22fd254dd491eabf3d93f8d94d5/spec/UW_PROTOCOL.md)
and [Receipt3.2 result-array commitment](https://github.com/UWMD-OSP/UW-Markdown/blob/7eaa174cf1a4e22fd254dd491eabf3d93f8d94d5/spec/UW_RECEIPT.md).
The numerical procedure selected for power remains unaccepted. A finite word
pair and a graph result here do not amend an admitted input domain or public
refusal code. The lab intentionally preserves the distinction between a
mathematical quantity, a particular ordered procedure and its reported result.

**Periodic association:** `base=B(1+rate)`; for each authored index t, compute
`factor=P(base,t)`, `term=B(flow[t]/factor)`, then `acc=B(acc+term)` from +0 in
source order. No compensated sum, sign-separated sum or repeated reciprocal
optimization is substituted. `B` is one binary64 nearest/even operation. `P`
is one of the previous three graphs, including its explicitly unaccepted
immediate nonfinite-intermediate refusal policy and lab budget.

**IRR scope:** evaluate only the existing lo=-0.999 and hi=10, their NPV values,
the binary64 product used for the sign test, then exact endpoint precedence
(lo first, then hi). A same-sign bracket records the existing prospective
`CALC-IRR-DIVERGE`; endpoint roots record the exact endpoint. Otherwise report
`bisection_required` without a root, reported value or result digest. There is
no bisection loop in this harness, and no new stopping rule, tolerance, endpoint,
interval extension, polishing or normalization. A candidate-kernel refusal is
separate from a proven same-sign bracket and is not relabeled as no real root.

**Dated association:** `B(amount*P(B(1+rate),-t))`, summed in source order.
Inputs freeze prederived year-fraction words only; no date/day-count verifier is
implemented or certified. A half-year control reports `fractional_kernel_required`
without a value/digest. An integral-looking dated exponent retains multiplication
by a negative power; it is not replaced by periodic division.

## Independent reference and traces

[cash_reference.py](cash_reference.py) imports only the earlier isolated exact
power reference and Python standard-library integer/rational/encoding tools.
It creates no float and uses no Decimal, repr, host power/libm or production code.
Every new basic operation is rounded by exact rational midpoint comparison.
[evidence.json](evidence.json) records every financial intermediate: `1+rate`,
power call/result plus its primitive-step trace hash, term division/multiplication,
ordered accumulator and bracket product. The unchanged earlier reference can
reconstruct the exact nested primitive trace; this file stores its hash rather
than duplicate every multiplication for every repeated endpoint call.

The separate [JS runner](cash_candidates.mjs) independently executes those graphs
and ordinary binary64 operations, native decimal conversion and SHA-256. Tests
compare full new financial traces and reporting preimages against frozen rational
answers, not against other Node versions or production output. This establishes
these cases on one host, not full Verifier or cross-platform conformance.

## Decimal-string reporting is a separate boundary

The rational reference selects the shortest round-tripping decimal by exact
candidate distances, with even coefficient on a tie. It then shifts that decimal
exponent, rounds the shifted rational once to binary64, applies the existing
half-away integer step (including the binary64 addition of 0.5), rebuilds from
the rounded integer decimal, and normalizes zero positive. Oversized/nonfinite
shift fallback remains explicit. It does not round the exact underlying binary
fraction directly and does not use Python repr or a precision guess.

The [ECMAScript2025 no-argument toExponential rule](https://tc39.es/ecma262/2025/multipage/numbers-and-dates.html#sec-number.prototype.toexponential)
uses a shortest uniquely identifying decimal. The runner uses that native
boundary; the oracle derives frozen decimal candidates independently. The small
ASCII-only result arrays use the exact number tokens with canonical object-key
order per [RFC8785](https://www.rfc-editor.org/rfc/rfc8785.html#section-3.2.2.3).
This is not a newly adopted serializer or a universal conversion-proof claim.

In particular, the exact binary64 word commonly spelled 1.005 is *below* the exact
decimal 201/200. Direct exact-binary rounding at cents would produce 1.00, while
its shortest decimal shifts to binary64 100.5 and the accepted reporting boundary
produces 1.01. Controls freeze both adjacent words, both signs, +/-2.5 at 0 places,
negative zero and the smallest subnormal. Primitive nearest/even and final
half-away reporting are never interchanged or applied twice.

## Concrete consequences

Hex words, not labels, define all operands in [inputs.json](inputs.json). Money
boundary amounts were constructed from exact rational candidate-factor midpoints;
IRR terminal amounts are fixed factor words for 11^31. No host power generated an
operand. These are adversarial controls, not a real deal or prevalence estimate.

| Fixed control | Sequential-late | Binary-late / binary-early |
|---|---|---|
| `money-tie-positive` | Raw `3ff0147ae147ae13`; reported 1.00 | Raw `3ff0147ae147ae15`; reported 1.01 |
| `money-tie-negative` | Raw `bff0147ae147ae13`; reported -1.00 | Raw `bff0147ae147ae15`; reported -1.01 |
| `upper-sequential-root` | NPV(hi)=0; endpoint 10 | NPV(hi)>0; no bracket |
| `upper-binary-root` | NPV(hi)<0; bisection required, no guessed root | NPV(hi)=0; endpoint 10 |
| `zero-endpoint-precedence` | Both endpoints zero; return lo by existing order | Same |
| `root-outside-bracket` | No bracket; no outside root | Same |
| Source order `[1e16,1,-1e16]` versus `[1e16,-1e16,1]`, r=0 | +0 versus 1 | Same source-order distinction |
| `dated-fractional-missing` | Missing fractional kernel, no value/digest | Same |
| `dated-reciprocal-range` | Nonfinite intermediate, no value/digest | Late refuses; early retains raw subnormal, subsequently reported 0 |

The result-array preimages below follow the existing shape but are research
projections, not an actual evaluateCalc run, issued receipt or accepted expected
financial answer:

```json
[{"calc_id":"money_tie_positive","computed":true,"value":1}]
[{"calc_id":"money_tie_positive","computed":true,"value":1.01}]
```

Their independent SHA-256 digests are respectively:

```text
sha256:b8888741e639f393645f9bb3bcefb55118a13e4056e6c1a3c24e1512db9d2f66
sha256:1b5ad96e330a4ccccedb88694d89136968eab358092a0f6c7ba32c89cc63b49c
```

A failed or incomplete procedure gets no invented numeric result, no fabricated
computed:false/null success and no result-array digest. Numerical result, solver
admission, quantization, canonical result bytes and any future signed receipt
are separate evidence layers. A hash alone does not establish the missing solver
or a correct financial statement.

## Receipt compatibility and clean break

These consequences are compatible with keeping the receipt wire shape. A later
accepted numerical change still needs governed Protocol and verifier engine
version/dependent-pin accounting. Different-engine *recomputation disagreement*
uses existing RCP-07 only after earlier source/digest/signature checks. Different
engine identity with agreement is not alone a refusal. Same-engine runtime
disagreement remains the demonstrated gap; this lab does not retroactively
change the engine identity or infer an issuing runtime.

Source bytes, block hashes and existing document-signature subjects stay unchanged
from arithmetic alone. Old receipt/source/signature artifacts remain original
evidence, with no automatic reissue, dual-hash/evaluator fallback, migration
shim or historical-support claim. Prospective new artifacts must be separately
issued under the approved regime. No release number, 5.0 preparation, new receipt
field or RFC 0085 history policy follows from this experiment.

## Reproduction, provenance and limits

From repository root, no install:

```sh
python -B experiments/numerical-0088/cash-graphs/freeze_cash.py --check
python -B -m unittest discover -s experiments/numerical-0088/cash-graphs -p "test_*.py" -v
node --test experiments/numerical-0088/cash-graphs/cash_candidates.test.mjs
```

The first-creation generator refuses to overwrite evidence. Actual focused
validation on 2026-10-16: Python 3.12.3 and Node 24.14.1, Windows AMD64; five Python
methods and two JS tests passed (30 cash graph/traces, 10 reporting controls).
No prior audit, first-wave lab or full suite was rerun. Evidence freezes exact
input, reference-source and predecessor-source hashes. Exact LF hashes:

```text
inputs.json          af47f285697348708503a751e23c0609b33a93499a617a23f0b55bef7c666ea2
evidence.json        52d2e355780645eaa0020fcd5d49dd0eb2a6f9ceabec1e618203472f73bcc165
cash_reference.py    fa53dd358bcbe35f65b11ee206cb6d0295f2a34e53ed1b286e405e586e9c4bf2
cash_candidates.mjs  8d78252349a7744f5c9d25ebc3343da1768de5aa903c003acaf6dbf16b41572c
```

**Proposed integration checkpoint, not completed CI:** run the frozen first-wave
and cash commands independently on the supported Node 20/22/24 runtime lines and
Python across Linux, Windows and macOS; record exact versions, OS, architecture,
input hashes and counts. Reuse these frozen expected bytes without regeneration.
No Node process is an oracle for Python. A runtime/OS combination or ARM64 target
not actually exercised remains unclaimed. The integrator owns any shared CI
change. General fractional/log/exp kernels, full solver trajectories/refusal
measurement, annuity domains, source-token precision, whole-corpus impact and
actual scoped spreadsheet recalculation remain separate required evidence before
advertising their respective guarantees. Those gaps cannot be hidden by these
endpoint or money-boundary results.
