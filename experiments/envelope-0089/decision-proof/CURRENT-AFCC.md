# Fresh accepted-main reconciliation (unapproved Envelope research)

Accepted RFC0090 changed production parser/validation/registry source and
Format/Protocol text. The original b2-only helper checks correctly refuse that
new closure. Their helpers, original maps, observations and raw streams remain
byte-identical; they were not overwritten, relabeled or broadly allowlisted.
This separate checkpoint actually executes the same authentication observations
against exact accepted main `afcc615897aca301c7b5ec070bba7c0bd253e4ef`.

`auth-current.mjs` must equal the original `auth-review.mjs` byte-for-byte after
exactly one HISTORICAL_BASE substitution from b2 to afcc; `check-current.mjs`
asserts that complete equality. It validates every original helper/schema/Receipt
identity. The only changed contract files are Format and Protocol, with old b2
and current afcc Git identities checked separately. Every historical source hash
is checked against b2; the current observer checks every current source against
afcc and records every actual compiled runtime module. Both source/module path
sets must match their complete historical sets: no widened source allowlist.
The incidental unused XML syntax dependency entry and unchanged package lock are
also pinned; this is not a new third-party package-integrity attestation.

First creation and subsequent read-only replay both pass the actual seven-model,
42-mutation-pair,14-label-pair matrix and four real-backend Receipt5.5 controls.
All behavioral fields deep-equal the original observations: complete source and
model evidence, signature bytes/payloads, subjects/results digests, admission,
refusal messages/states, keys and actual backend counts. The comparison excludes
ONLY the explicitly named production source-base/source-hash/compiled-hash maps;
those maps are separately recorded and enforced exactly by the current replay.
No signature, refusal, result or other material cell is waived. No actor-related
behavior delta occurred in these particular admission-gated examples; this does
not claim RFC0090 changed nothing in general validation or receipt policy.

The original evidence SHA256 remains
`a231af9b4f46f40a25c3c1527752c50d70da65997118d8944a040cdfd361dc2b`;
the original Receipt5.5 observation remains
`b33a2975bdac1b790da63689c276237ee5a96aa7ba815fc9bc75ec8da550e554`.
New `frozen/current-main-afcc.json` and `frozen/current-receipt-afcc.json` retain
fresh source/compiled/spec/helper identities and actual results. Raw four-command
streams and SHA256/counts are separately stored in `frozen/current-replay-afcc/`.
First creation refuses existing destinations; all normal checks are read-only.

```sh
node experiments/envelope-0089/decision-proof/check-current.mjs --verify-root <fresh-source-pinned-verifier> --check
node experiments/envelope-0089/decision-proof/receipt-current.mjs --verify-root <fresh-source-pinned-verifier> --check
node experiments/envelope-0089/decision-proof/current-evidence.mjs
```

The first frozen execution is Windows x64 Node24.14.1 with the integrator's
explicit file-URL build: executed at2834a69c, whose entire verify source equals
afcc; final5ec commit changed docs only. The collected maps pin179 source files
and86 compiled runtime modules. A later runtime must independently pass all
material comparisons; this local evidence is not a claim that CI or another
platform has already passed. CI needs the exact b2 and afcc Git objects, and the
ordinary fresh build, rather than a historical production compatibility path.

This is research replay provenance, not acceptance of Envelope0089, a new
canonicalizer, financial receipt implementation or broader V.13 source domain.
Receipt5.5 matching-digest behavior remains accepted and unchanged. No schema,
production API, numerical result, artifact version, release or launch is changed.
The existing Envelope minimal-versioned direction remains an owner proposal.
