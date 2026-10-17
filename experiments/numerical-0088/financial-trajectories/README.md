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
Observation counts and remaining measured coverage will be recorded after the
first focused capture. There is no platform/full-corpus/native research rerun.
