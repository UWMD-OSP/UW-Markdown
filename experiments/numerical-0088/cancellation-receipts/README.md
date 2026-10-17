# Natural cancellation outcomes through actual receipts (unaccepted)

This bounded study reuses exactly two word-input cases from the frozen
`cancellation-accuracy` study: PMT and PV at negative rate `bc90000000000001`,
period1, unit amount and other0, precision12. It never re-executes the36-case
rational oracle,4204/178 raw controls or4730-row trajectory matrix. The exact
real reference reports1, while the pinned ordered candidate reports0.25/4.
These remain separate mathematical/procedure observations, not new financial
expected answers, tolerance choices or stabilized formulas.

The current host and in-memory candidate each call actual `issueReceipt` with
an explicit synthetic pack/source and the existing engine name plus synthetic
version metadata. Newly issued artifacts are signed with the deliberately
public disposable test key already used by the prior composed-receipt study.
Every signed artifact is new research output; none authenticates an original
conformance receipt, producer or historical regime. Changing verifier version
options is a controlled metadata comparison, never a numerical dispatch switch.

Actual `verifyReceipt` runs12 primary controls: one host PV own agreement;
two candidate own agreements; host-issued PV to candidate with same/different
version, invalid signature or absent backend; candidate-issued PMT back to host
under those four conditions; and candidate PV back to host. A separate baseline
loader repeats one host control to check instrumentation. Host issuance can
legitimately agree with the candidate on another runtime; assertions distinguish
that observed branch instead of forcing the old Windows0/refusal outcomes.

Full newly issued unsigned/signed objects, exact source/pack/inputs, payloads,
backend calls, primitive offsets/events/transforms and command logs are frozen.
The independent offline checker reconstructs the accepted signature projection
`canonicalize({...receipt,signature:null})`, checks result digests and source
bindings, verifies the12 real signature outcomes, and rejects three detached
payload controls. It uses the pinned accepted canonicalizer, not a new signing
domain or custom JCS implementation. Byte-valid signatures do not prove trust,
economic correctness or a new whole-formula accuracy guarantee.

```sh
python -B experiments/numerical-0088/cancellation-receipts/capture.py --capture NEW_DIRECTORY
python -B experiments/numerical-0088/cancellation-receipts/capture.py --check experiments/numerical-0088/cancellation-receipts/evidence
node experiments/numerical-0088/cancellation-receipts/check.mjs
```

Capture refuses an existing destination and snapshots all pinned source/
reference and compiled-JS bytes before/after. Consumed host/candidate scratch
artifacts are also checked immutable. `probe.mjs candidate INPUT OUTPUT` accepts
plain or gzip host records, so the separately frozen Windows host PV receipt
can later be replayed under another actual candidate runtime without fabricating
a fresh local-host disagreement. That optional execution needs its own actual
source/runtime/command provenance; merely supporting the input is not evidence
that it ran. The integrator owns CI/publication; no workflow change is made here.

No observations are claimed until the evidence manifest is committed. All
previous evidence, production arithmetic, solver/quantizer/receipt behavior,
schemas/corpus, component versions and draft RFC state remain unchanged.
