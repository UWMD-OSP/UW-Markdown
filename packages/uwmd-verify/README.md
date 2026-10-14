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
`node:crypto` in Node, loaded only when Node is detected.

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
