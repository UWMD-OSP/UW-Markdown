# RFC 0089 isolated candidate

This directory exercises the proposed complete Envelope and carrier contract.
RFC 0089 remains draft. Nothing here activates a production codec, export or
signature capability. The candidate branch and its PR must remain unmerged.

After the normal workspace install and build, run:

```sh
node --test conformance/candidate-0089/carriers.test.mjs conformance/candidate-0089/authentication.test.mjs conformance/candidate-0089/refusals.test.mjs conformance/candidate-0089/consumers.test.mjs
```

The dedicated workflow runs these controls on Windows and Linux with Node 22
and Python 3.12. Reports and actual carriers go to
`node_modules/.cache/rfc0089-evidence` and CI artifacts, outside public sources.
Reports include complete-model/preimage commitments, physical source counts,
both carrier directions, boundary-specific refusals and code identities.

`cases.json` freezes 18 physical-source cases and two complete direct models.
Expectations extend the independent red-team controls but the new additions
are builder-authored. `freeze-fixtures.py` is an explicit authoring utility,
never a test or CI step. Python uses the separately authored Reader/JCS and a
separate codec reconstruction; execution agreement is not independent review
of newly authored fixtures or evidence closure.

`build-runtime.mjs` creates an isolated fork of the actual compiled producer
and verifier state machines under the cache. It substitutes the proposed
complete projector and canonicalization identity; financial algorithms remain
the native implementation. Tests issue and verify actual ephemeral Ed25519
artifacts, assert exact diagnostic precedence, exercise receipt recomputation,
and check a once-bound reserve plan without automatically updating its digest.
Private keys are never written. V9 block, V11 signing and V12 selected-vector
subjects remain distinct from the complete-source subject.

The consumer inventory closes over current source-identity call sites and
records scope explicitly. Production adoption of those call sites belongs to
the postacceptance integration gates. The candidate uses a depth limit of 128,
50 MiB XML input, and the current configurable ZIP resource policy; a bounded
resource refusal is not a semantic claim that larger abstract JSON is illegal.
Acceptance requires the RFC's whole gate matrix and independent finding closure.
