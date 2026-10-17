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

No observation is claimed until frozen evidence is committed. This is not a new
financial convention, replacement kernel, accuracy guarantee, conformance
baseline, receipt authentication rule, compatibility layer or RFC acceptance.
Original4204/178/4730 evidence and all prior artifacts remain unchanged.
