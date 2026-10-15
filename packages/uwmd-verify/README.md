# @uwmd/verify

The reference implementation of the UW Markdown (`.uw.md`) standard: everything
a party needs to **read and verify** an underwriting document, and nothing it
does not ([RFC 0083](https://github.com/UWMD-OSP/UW-Markdown/blob/main/docs/rfcs/0083-verify-package-split.md)).

- **Reader:** parse `.uw.md`, UWX and UW Lite, and read sections, variants and
  block roles.
- **Validation:** the format and protocol rules, including the builtin
  asset-class rules.
- **Calculation:** the sandboxed safe-expression evaluator with §VIII.5
  quantization, day counts, dated flows and stated-precision comparison.
- **Stated-figure verifiers:** cash-flow series, lease-up, waterfall, reserve
  accounts and draws, replacement funding, capital stack and property cash flows.
- **Metric dictionary:** `spec/metrics/builtin.json` shipped as data, and
  `verifyStatedMetrics`.
- **Receipts, integrity and modules:** issue and verify receipts, block hash
  chains and provenance, and the module system.
- **Profiles:** representations (envelope, UW JSON, UW XML, UW CSV, deal
  packages), portfolio, sensitivity and stochastic.

It has no `@uwmd/*` dependency. Its only runtime dependencies are
`fast-xml-parser` and `fflate`, which the representation codecs use.

## Install

```sh
npm install @uwmd/verify
```

## Basic use

```ts
import { parseUWFile, validateUWFile, verifyStatedMetrics } from '@uwmd/verify';

const parsed = parseUWFile(source);
const validation = validateUWFile(parsed);
const report = verifyStatedMetrics(parsed);
// report.counts: { verified, failed, unverifiable }
// report.evidence: one entry per stated metric, with the reason when it is unverifiable
```

The browser entry `@uwmd/verify/browser` exports the same surface. No module
imports a `node:` builtin statically; SHA-256 uses Web Crypto in a browser and
`node:crypto` in Node, loaded only when Node is detected. A browser bundler
should treat `node:crypto` as external; the guarded dynamic import is never
evaluated in a browser.

## Document snapshot authentication (RFC 0084, Protocol §V.13)

`verifyDocumentSignature(source, artifact, { signatureVerifier })` checks a
detached document signature against the **source text actually supplied**: it
freshly parses the source, accounts for every section block (history included),
recomputes the `uw-envelope-semantic` digest and only then asks the injected
backend to check the signature bytes. This package carries no cryptography;
`@uwmd/signing` supplies the backend (`createDocumentSignatureVerifier(store)`)
and the signer (`signDocument`).

```ts
import { verifyDocumentSignature } from '@uwmd/verify';

const result = await verifyDocumentSignature(source, artifact, { signatureVerifier });
switch (result.state) {
  case 'verified':     // artifact admitted, trusted key, signature valid, subject digest equal
  case 'unsigned':     // no artifact supplied
  case 'unverifiable': // present but unchecked: unknown key, no backend, unsupported version
  case 'failed':       // malformed artifact or source, bad signature, or a different snapshot
}
```

Required authentication accepts only `verified`. A verified block signature
(§V.11) attributes one block to its signer; it says nothing about variant
labels, current/superseded state, frontmatter or which blocks the document
contains, so block-signature counts never upgrade `unsigned` or
`unverifiable`. A verified document signature authenticates the snapshot a
signer assembled; it does not establish that its figures are correct.
`verifyChain(parsed, { documentSignature, documentSignatureVerifier,
requireDocumentSignature })` reports the same result as
`IntegrityResult.document_signature`, separately from the block counts.

Signing and verification refuse a source the envelope cannot represent
faithfully: a block without an object `_meta.lifecycle` and boolean
`superseded`, a `_meta.section` that disagrees with its fence, two active
blocks for one selection key, repeated or superseded `x_*` extension blocks,
duplicate JSON or frontmatter members, or an ambiguous fence annotation. Such
a source reports `failed` with reason `malformed_source` (`INT-15`).

## `@uwmd/verify` and `@uwmd/core`

`@uwmd/core` is the starter toolkit (editor, renderer, report, defaults and
cascade, refinement, display formatting, the Excel emitter, agents and the CLI)
built on this package. It depends on `@uwmd/verify` at an exact version and
re-exports its whole surface, so code that imports from `@uwmd/core` keeps
working unchanged.

Two behaviors differ when you call this package directly:

- `evaluateCalc` and `evaluateModuleCalculations` return no `display` string.
  The field is optional (`calc-result.schema.json`); `@uwmd/core` adds it.
- A receipt issued here names `@uwmd/verify@<VERIFY_VERSION>` as its
  issuer; through `@uwmd/core` the issuer is `@uwmd/core`. Either way the
  engine is this package (`@uwmd/verify`, `VERIFY_VERSION`), the code that
  computes the results, so a verifier holding only this package checks a
  core-issued receipt as the same engine.

Specification, examples and conformance fixtures:
[github.com/UWMD-OSP/UW-Markdown](https://github.com/UWMD-OSP/UW-Markdown).
