# Bounded composed cancellation accuracy (unaccepted)

This experiment separates three questions: the exact real value of an existing
closed form, the reproducible ordered binary64 graph with candidate A, and that
same graph with one ideal correctly rounded power of its already-rounded base.
The last is a mathematical counterfactual, not an implemented MPFR adapter or
candidate B execution. It cannot restore information already rounded out of
`1 + rate`. No stabilized financial graph or accuracy tolerance is selected.

The fixed 36 scalar controls use PMT/PV/FV, exact unit amounts, other value zero,
specified rate words, integer periods 1/360 and final precision 12. Rates cover
signed zero, both sides/ties of the asymmetric binary64 gaps around one, and an
ordinary positive rate. These are synthetic algorithm inputs, not authored
underwriting models. The admitted research domain/resource bound is separate
from any proposed production admission restriction.

`reference.py` uses only exact Fraction real arithmetic for `(1+r)^n` and the
existing closed forms, then certifies the whole-expression RN-even word with
an adjacent-midpoint proof. It separately evaluates each ordered basic operation
with rational RN-even and an ideal correctly rounded integer power. No host
transcendental, float, Decimal, native candidate or production import supplies a
mathematical expected answer. Existing reporting reference applies the accepted
VIII.5 shortest-decimal-string quantizer to the resulting binary64 word, rather
than substituting exact-real decimal rounding or primitive RN-even for VIII.5.

The independently implemented JS and Python candidates use the previously frozen
complete pinned kernels. Full operand/result traces are preserved. Actual current
BUILTINS, quantizeDecimal and evaluateCalc execute via explicit own dist imports;
unmodified/baseline controls check instrumentation and candidate injection changes
only primitive powers. Nonfinite raw results and final evaluator/quantizer refusal
are separate recorded facts. Source/kernel/input/evidence/dist bytes are checked
before/after; capture refuses an existing destination.

```sh
python -B -m unittest discover -s experiments/numerical-0088/cancellation-accuracy -p "test_*.py" -v
python -B experiments/numerical-0088/cancellation-accuracy/capture.py --capture NEW_DIRECTORY
python -B experiments/numerical-0088/cancellation-accuracy/capture.py --check experiments/numerical-0088/cancellation-accuracy/evidence
```

The frozen observation is described below. This is not a new
financial convention, replacement kernel, accuracy guarantee, conformance
baseline, receipt authentication rule, compatibility layer or RFC acceptance.
Original4204/178/4730 evidence and all prior artifacts remain unchanged.

The first capture at47ba12cd stopped at the actual parser because its generated
scalar envelope omitted required `uw_version`. No evidence destination was
created; scratch `uwmd-cancellation-accuracy-zqo3x91f` preserves the first attempt.
The harness now supplies the current required Format declaration. No parser,
numerical operation, mathematical reference or expected answer was changed.

## Actual bounded observation

The capture at `4573db257fc315ea2b4b311dab58ac54b9f9b6b7` / tree
`2d4019c5f4fdc99449facc3fc0e54a7dc9881dcd` records CPython 3.12.3,
Windows AMD64 and Node 24.14.1 / V8 13.6.233.17-node.44. Manifest SHA-256 is
`c51f42016d76fea22c2de86767c72979daaf1135aed5dc418a0b670685d4d24c`.
Sixteen compressed artifacts preserve 591583 original raw bytes, including exact
real rational certificates, separate ideal-power traces, 200 complete candidate
operation rows in **each** JS/Python graph execution, all actual builtin/evaluator/
quantizer outcomes, primitive events/transforms and command logs. All 103 pinned
source/reference and 86 compiled-JS identities remain unchanged before/after.

Across these 36 inputs, A and the ideal-power ordered graph have **identical raw
words in every case**. Both differ from whole-real-formula RN in 30 cases. After
the existing decimal-string quantizer, 21 finite outputs differ and five raw
infinities are refused, while all exact-real reference results remain finite.
The other ten reported outputs agree; this includes errors hidden by final
quantization. These counts are a bounded comparison, not an error-rate estimate
for financial documents or a global worst-case bound.

| Material one-period input | Candidate/ideal ordered graph | Exact real formula, then binary64 RN and separate VIII.5 |
| --- | --- | --- |
| PMT, rate `3ca0000000000000` (+2^-53) | Raw +infinity; evaluator/quantizer CALC-TYPE-001 | Reports `1` |
| PV/FV, same rate | Reports `0`; exact relative real error `1` (100%) | Reports `1` |
| PMT, next larger positive rate `3ca0000000000001` | Reports `0.5` | Reports `1` |
| PV, same next larger rate | Reports `2` | Reports `1` |

Exact rational numerator/denominator pairs, word answers and complete operation
traces are machine-readable in `evidence/python.json.gz`; no decimal diagnostic
or host power is used as a mathematical oracle. The research domain is only the
listed rate words, integer periods 1/360, unit amount/zero other value and precision
12. Exact powers require exponent magnitude at most360. The midpoint search has
at most63 binary-search iterations per rounding; this is an oracle execution
bound, **not** a new financial or production kernel resource limit. The actual
largest exact-real numerator/denominator in these certificates has 38169 bits.

### New host/candidate outcomes are local, not universal

Unmodified and baseline-loader boundaries agree for all36 cases. The Windows
Node24.14.1 host differs naturally from the candidate at **two** additional
one-period cases, both at rate `bc90000000000001` (just beyond the negative
half-gap around1):

| Case | Actual host | Actual isolated candidate | Exact-real reference reporting |
| --- | --- | --- | --- |
| PMT | Raw -infinity, final CALC-TYPE-001 | Raw `3fd0000000000001`, reports `0.25` | `1` |
| PV | Reports `0` | Raw `400ffffffffffffe`, reports `4` | `1` |

These are new finite/refusal/reporting consequences, not the old IRR endpoint
case. The ideal correctly rounded primitive agrees with the candidate, yet the
whole financial formula remains inaccurate: changing only the primitive cannot
restore the original rate lost/perturbed in rounding `1+r`, or remove cancellation
in `1-d` / `growth-1`. No receipt is newly issued here, so these changes are **not**
claimed as executed receipt outcomes or authenticated receipt differences. The
existing actual receipt precedence study remains separately frozen. Other hosts
and input domains must be measured; do not generalize these two host results.

## Acceptance consequence and the prior 17 ordinary jobs

The owner can choose a reproducible exact procedure while explicitly limiting
its accuracy claim, or require a separately specified end-to-end accuracy goal
and evidenced stable financial graphs/domains before acceptance. Merely choosing
primitive B's stronger mathematical rounding promise does not meet that second
objective for these unchanged graphs. A remains the provisional lean research
direction; this evidence does not choose a replacement formula, tolerance,
zero-rate cutoff, rejection domain or stabilized log1p/expm1 procedure.

Published head `9c0322a76d57ec6ef269e2ed64b2aed01a7f59aa` ordinary run
[39061421563](https://github.com/UWMD-OSP/UW-Markdown/actions/runs/39061421563)
reports17 successful jobs and one skipped publication observation. Its workflow
runs production tests/conformance on Node20/22 and WindowsNode20, controls and
genuine Reader projections in three Python jobs, plus schema/lint/index/version/
release/lockfile/editor/extension/coverage guards. The three Python jobs also
exercise the frozen raw-kernel controls; LinuxNode20 performs the existing
19-control real-receipt capture, Astra replay and frozen trajectory checks.
Those are actual scoped regression/reproduction results. No one of those17 jobs
proves an exhaustive binary64 domain, a global fdlibm error bound, whole-formula
accuracy, stabilized graphs, all day counts/consumers, spreadsheet recalculation,
receipt trust or owner acceptance. This new36-case experiment was absent from
that head and is not certified by that green run. Optional research39061421580
was cancelled, never a pass; historical native/kernel evidence keeps its recorded
source/runtime scope. New workflow execution remains integrator-owned.
