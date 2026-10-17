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

The actual original observations are described below. All
previous evidence, production arithmetic, solver/quantizer/receipt behavior,
schemas/corpus, component versions and draft RFC state remain unchanged.

## Actual Windows observation

Capture `00ee57d74442b37a209c9703aef631aa506da142` / tree
`aeb86cb4083dcd65a150b2f9be2e1f9b101cedc9` records Node24.14.1,
V8 13.6.233.17-node.44, OpenSSL3.5.5, CPython3.12.3 and WindowsAMD64.
Manifest SHA-256:
`8fa5f57a05b7c7607ff172c2a5fc7175789ebe76a0648e13ac7ae6725c117b22`.
Sixteen compressed artifacts preserve193176 raw bytes. All106 source/reference
and86 compiled-JS identities remain unchanged before/after. The collector also
preserves the exact consumed host/candidate scratch bytes. No old study was
re-executed or expected artifact rewritten.

| Actual issuance / verification | Result | Real backend calls |
| --- | --- | --- |
| Host PMT issuance | Throws RCP_COMPUTATION_FAILED; no partial receipt | Not applicable |
| Host PV issuance and own verification | Reports0; signed receipt verified | 1 |
| Candidate PMT / PV issuance and own verification | Reports0.25 /4; each signed receipt verified | 1 each |
| Host-issued PV to candidate, same engine/version labels | Failed RCP-03 | 1 |
| Same exact host PV receipt, different verifier version option | Unverifiable RCP-07/RCP-03 | 1 |
| Host PV receipt with deliberately corrupted research signature | Failed RCP-01 | 1 |
| Host PV receipt, absent backend | Unverifiable RCP-08 | 0 |
| Candidate PMT receipt back to host, same/different verifier version | Failed RCP-03 on recomputation refusal | 0 each |
| Candidate PMT with corrupted research signature back to host | Failed RCP-03 on recomputation refusal | 0 |
| Candidate PMT back to host, absent backend | Unverifiable RCP-08 | 0 |
| Candidate PV back to host | Failed RCP-03 | 1 |

These are12 primary actual controls, seven actual backend invocations and12
independently checked signature outcomes (10 byte-valid/two invalid). The baseline
loader additionally repeats the host PV own control once; it matches unmodified
issuance/results/payloads, rather than being counted as a new primary case.
Three offline negative controls reject receipts detached from their recorded
payload after value, metadata or payload edits. The initial lint check found a
required-parameter ordering style issue; its options argument was made explicit
before capture. There was no failed receipt or numeric capture to hide.

Host and candidate PV unsigned receipts have identical source subject and every
other field except naturally computed results/results_digest; no reported value
was edited to manufacture the disagreement. Host PMT produced no receipt; the
reverse controls consume the genuinely candidate-issued artifact. All signatures
are new public-test-key artifacts, and verifier-version options do not activate
a numerical procedure. Engine mismatch alone still does not fail an agreeing
receipt. On an actual host that agrees with A, matching branches are recorded as
verified; the old Windows mismatch is not asserted universal.

## What this closes, and what it does not

Actual receipt execution now connects these two naturally different financial
outcomes to both finite-disagreement and recomputation-refusal precedence. A
candidate receipt reporting0.25 or4 can verify under the same candidate even
though the separately proven whole-real formula reports1: deterministic replay
plus a byte-valid research signature does not supply a whole-formula accuracy
promise or producer trust. The old19-control study's finite disagreement was a
deliberate value-tampering control; these new issued values are untouched actual
calculation outputs. The original studies remain accurately scoped and frozen.

The remaining owner choice is still the procedure/accuracy/refusal contract for
launch, plus the joint receipt behavior already exposed: supplied-backend
signature checks follow successful recomputation, while recomputation refusal
returns before the backend. This experiment preserves that behavior; it does
not authorize accepting new semantics, bypassing authentication, silently
reissuing an original receipt, retaining pre5 numerical regimes, or selecting a
new stable formula/tolerance/refusal. RFC0088 stays draft. A byte-valid signature
checked independently when the real API did not invoke its backend is explicitly
not represented as successful API authentication.
