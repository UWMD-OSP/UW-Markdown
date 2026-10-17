# Observed native/reference evidence — research run 38993665625

**UNACCEPTED finite-corpus research evidence.** These are original downloaded
GitHub artifact ZIPs, not regenerated observations or normative expected answers.
All nine archive SHA-256 digests were independently recomputed from ZIP bytes and
matched the GitHub artifact API's reported digests. Archives total427,489 bytes;
their exact results, provenance and logs remain unchanged inside them. No binary
or source from an archive is executed by the offline verifier.

[Research run38993665625](https://github.com/UWMD-OSP/UW-Markdown/actions/runs/38993665625)
completed successfully with6 Node jobs and3 native compiler jobs for published PR
head `0c2f01cd8bc37746d66d7c52a7bc80a225ee000e`. **Actual checkout was the PR test
merge** `a6d05240e80325019a87bac6a5426a6b61fccc8d`, tree
`d570ddede60e939ea89fb9227fe28d71d2aeb399`, parents main
`3eee0fbab3f5682dc345804782994dc22d321fae` and that head. Every Node report records
this merge checkout, and source/input hashes were checked against the published
head. Do not describe this as exact-head execution. A later exact-head workflow
checkpoint and enhanced collector fields do not alter this historical evidence.

## What actually matched

Each of the three native builds and six Node streams has all **4,204** frozen
operands in the declared order, with matching identities and no missing results.
All **3,435 non-NaN words match exactly**, including2389 nonzero finite values,
468 positive zeros,80 negative zeros and498 infinities with preserved sign.
The other769 records are NaNs compared by class; their sign/payload is explicitly
normalized to null and is not a portability claim. Cross-row normalized-stream
SHA-256 is `08c1ecb9d6e8c0ef4281c496386a80d21eca9ba01829cc4f5a3d9e0c287cc3ac`.

| Native row | Observed compiler | Architecture / instrumentation |
|---|---|---|
| Ubuntu | GCC13.3.0 | Linux x86_64; strict binary64 flags and defined-word adapter |
| Ubuntu | Clang18.1.3 | Linux x86_64; same adapter plus undefined-behavior sanitizer |
| macOS | Apple Clang21.0.0 | arm64; same strict flags and defined-word adapter |

| Node row | Actual Node / V8 | Architecture |
|---|---|---|
| Ubuntu18 floor |18.0.0 /10.1.124.8-node.13 |x64 |
| Ubuntu20 |20.20.2 /11.3.244.8-node.38 |x64 |
| Ubuntu22 |22.23.3 /12.4.254.21-node.57 |x64 |
| Ubuntu24 |24.21.0 /13.6.233.17-node.53 |x64 |
| Windows24 |24.21.0 /13.6.233.17-node.53 |x64 |
| macOS24 |24.21.0 /13.6.233.17-node.53 |arm64 |

Full compiler versions, flags, Python/runtime/runner versions, individual ZIP/member
hashes, source/input identities, case counts and output hashes are in
[manifest.json](manifest.json) and the archived original `provenance.json` files.
All recorded command exits are zero; all completion checks passed and tracked
source hashes were unchanged. Native execution and JS stderr are empty. Compiler
warnings remain intact: historical __P macro redefinitions and dangling-else
warnings. They were reviewed and not relabeled as warning-free builds. Sanitizer
success is scoped to this adapted source, build and operand stream, not arbitrary
historical C or a proof that no undefined operation exists elsewhere.

## Accuracy counterexamples are confirmed, not removed

Every native build and Node stream reproduced these five procedure words, each
one ULP from the separately certified mathematical nearest/even word:

| Input | Native and JS procedure word | Mathematical word |
|---|---|---|
| exp(word3fd62e41ffffffff) | `3ff6a09e0c594ff2` | `3ff6a09e0c594ff3` |
| exp(1) | `4005bf0a8b14576a` | `4005bf0a8b145769` |
| pow(2,-0.5) | `3fe6a09e667f3bcc` | `3fe6a09e667f3bcd` |
| pow(exact represented1.2,31) | `4071cda00ebe20d6` | `4071cda00ebe20d7` |
| pow(2,1.5) | `4006a09e667f3bcc` | `4006a09e667f3bcd` |

These now corroborate pinned-source procedure results under the measured builds,
not merely a JS translation observation. They contradict universal correct
rounding for this exact candidate, and they establish no worst-case error bound.
They are not a vote selecting numerical semantics. The mathematical baseline,
source graph and existing candidate observations were not rewritten.

## Historical provenance limits

Original native reports did **not** include checkout commit/tree, exact Node/V8
identity, compiled-binary hash, driver/candidate hashes or full compile command.
Those fields are deliberately marked missing in the manifest, not fabricated or
inferred from another job. Native artifacts are associated by immutable artifact
IDs/digests with this successful workflow run, and their eight source hashes,
input digest, compiler version, adapter substitutions, flags and complete outputs
were checked. The six separate Node reports provide direct checkout and source
hash evidence. Manifest driver hashes derived from the published Git tree are
labeled as such; they were not fields in the old native report.

The provenance-only follow-up adds actual execution identity fields for **future**
runs, with private absolute build/checkout paths represented by placeholders.
It does not retroactively attest a binary identity or a missing native runtime
version. No local C toolchain execution was performed to produce this archive.

## Read-only verification

```sh
python -B experiments/numerical-0088/native-reference/evidence/run-38993665625/verify.py
```

This checks all original archive and member bytes, the pinned4,204-input corpus,
every native and Node result/identity/order, exact non-NaN words and NaN class,
recorded source/provenance hashes and all five accuracy countercases. It neither
compiles C nor reexecutes historical tests, regenerates evidence or contacts the
network. It requires the recorded input revision/candidate hashes; a changed
future candidate is not silently compared as if it were this one.

No production evaluator, public wrapper, solver, receipt/signature subject,
conformance expectation, version, release, dependency or RFC status changes.
Independent Python implementation, complete financial/receipt/quantizer impact,
spreadsheet recalculation and universal accuracy/resource claims remain outside
this finite observation. Architecture preference is separate from acceptance.
