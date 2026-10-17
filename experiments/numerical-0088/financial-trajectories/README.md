# Full periodic and dated financial trajectories (unaccepted research)

This isolated checkpoint composes the pinned Python and JS power kernels with
current Protocol VIII.3/VIII.9 NPV/IRR and PMT graphs. It is not a producer model,
production evaluator, owner numerical decision or conformance claim. Nineteen
fixed synthetic word-input cases cover full bisection, endpoint/no-bracket,
value/interval stopping, zero/tiny values, exceptional raw results, source-order
cancellation, actual/365f leap/same-date rows and fractional PMT periods.

Every source-order arithmetic and power operand/result, evaluation, bracket,
iteration, short-circuit, residual, sign product, tolerance, update and exit is
recorded. Raw infinities/NaNs are carried internally; no new intermediate guard,
solver polish or tolerance is added. The dated graph remains amount multiplied
by negative power, while periodic graphs divide by positive powers.

Python is independently authored and calls the complete isolated Python kernel.
The separate JS graph injects either the pinned JS power or host exponentiation.
Actual production builtin/dated/quantizer APIs are executed unmodified and via
the existing isolated ESM loader; loader source strings change only in memory.
Host graph agreement with unmodified production and loader-baseline agreement
are checked before candidate composition agreement. Source and dist bytes must
remain unchanged.

Python reporting reuses the existing independently exact-rational shortest
round-trip decimal and decimal-string-shift evidence implementation. It does not
round the exact binary rational directly or rely on Python repr. Each finite
raw result and eight reporting controls are checked against actual production
quantizeDecimal; reporting refusal is distinct from raw builtin return/refusal.
The reused reference's input/domain/resource limits remain; it is not a new
production quantizer or full independent Python financial implementation.

Original NaN bits stay in full raw artifacts. A separate projection drops only
NaN word bits for portable class comparison. It never normalizes signed zero,
infinity sign, finite words, state, operation order or any solver decision.

Existing actual-production receipt evidence is pinned and reused rather than
replayed: astra-review observations/integration identity map and the earlier
focused financial receipt source/results. These contain the RCP-03 versus
RCP-07/backend precedence controls, including the same primitive-transition IRR
source. No old receipt is rewritten or authenticated under new semantics and no
new receipt rule, version, signature domain or migration layer is introduced.

Focused commands:

```sh
python -B -m unittest discover -s experiments/numerical-0088/financial-trajectories -p "test_*.py" -v
python -B experiments/numerical-0088/financial-trajectories/capture.py --capture NEW_OUTPUT_DIRECTORY
python -B experiments/numerical-0088/financial-trajectories/capture.py --check FROZEN_OUTPUT_DIRECTORY
```

First creation refuses an existing directory. Check mode only verifies exact
raw/compressed hashes and executed source identities; it never replays graphs.
## Actual local evidence

The [frozen manifest](evidence/manifest.json) records executed checkout
`5c034dd063aa3e57a6d42d0384a768a700cb1c14`, tree
`80d24a81ce7dfc2f578e51832945eb65df3ad6e6`, every executed
helper/input/kernel/reference/receipt-evidence hash, all five child commands and
exits, current production source hashes, and every dist hash before/after.
All five child commands exit zero. Exact runtimes: CPython 3.12.3 Windows 11
AMD64, Node 24.14.1 / V8 13.6.233.17-node.44. This is one observed host.

**19 cases, 4730 candidate rows:** independently executed Python and JS have
identical complete candidate traces/results/reporting under the separately
stored NaN-class projection. Original raw JSON from both implementations remains
frozen independently, including original NaN words. Portable projection SHA-256:
`082c7ded4e258a983af451faa53580e24eff5bcfa9ff992768fa3e87a07d2883`.
This is a hash of explicitly normalized comparison data, never a relabeled raw
word-stream hash or a universal cross-platform claim.

The ordinary and multi-period IRRs take 42 midpoint evaluations each, the
scaled-flow interval-tolerance case takes 44, and the leap/same-date XIRR takes
39. The full operation/evaluation/bracket/iteration/update/exit rows remain in
`python.json.gz`, `js_candidate.json.gz` and `js_host.json.gz`. The candidate's
ordinary, multi-period and dated roots stop on value tolerance; scaled flows
stop on interval tolerance. Zero/tiny/endpoint/no-bracket and nonfinite endpoint
controls retain the existing source branches, not newly chosen financial rules.

All raw results/refusals match actual production boundaries in their declared
mode. Unmodified production also agrees with the baseline loader. Every finite
reported result and eight quantization controls agrees with the actual
production decimal-string quantizer. Primitive rounding and final reporting
remain separate; nonfinite raw NPV/PMT values are recorded before the reporting
refusal. This is not an evaluateCalc/receipt integration claim for every case.

The sole final result/refusal change in these fixed controls is the known
`irr_primitive_transition`: host returns the high endpoint 10 while the pinned
candidate refuses CALC-IRR-DIVERGE. Source-order operation words can differ in
other controls without changing the final reported value or exit. This study
adds the complete trajectories, not a new prevalence estimate or a repeat of
the original endpoint investigation.

For that transition, every flow word was independently checked equal to the
prior actual `irr-original-endpoint` observation. Its existing eight historical
receipt variants per mode remain source-pinned: candidate recomputation refusal
reaches RCP-03 with zero supplied-backend calls; missing backend reaches RCP-08;
finite-disagreement RCP-07 controls remain in the separate preserved evidence.
Those were actual API executions, not a synthetic receipt-state calculation.
This capture does not execute receipts again or claim new authentication proof.

The 21 compressed raw/log/transform/event/projection artifacts and manifest
retain all input/output rows, not aggregate-only proof. Loader transform records
pin exact read and returned source hashes/sites; recorded primitive events make
actual production power injection visible. Protected source, reference inputs,
old observations and dist bytes stayed identical. Five focused Python methods
and focused Biome lint pass. The first attempted capture reached a harness-only
typed-error extraction error (`CalcError.proto.code` versus `.code`); no evidence
directory was created. The corrected extraction changes no arithmetic or expected
answer. The final capture above succeeds; its raw stderr streams retain loader
warnings rather than suppressing them.

## Remaining limits

This is a coherent bounded composition: periodic NPV/IRR, actual/365f dated
NPV/XIRR and closed-form PMT. Full amortization schedules, PV/FV/NPER, the other
day-count conventions, arbitrary date/source validation, all branch/limit cases,
whole-domain accuracy, complete stated-figure/receipt integration, new signature
or source admission, Python Reader/Verifier conformance, browser and spreadsheet
parity remain outside this checkpoint. No iteration-cap exhaustion was observed.
The power calls record primitive operands/results; internal kernel arithmetic
is governed by the separate isolated kernel/source evidence, not expanded into
this solver trace. No platform, old corpus or nine-job native research run was
repeated. No normative, version, production or legacy-support change follows.
