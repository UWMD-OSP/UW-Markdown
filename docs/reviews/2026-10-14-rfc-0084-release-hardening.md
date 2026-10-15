# RFC 0084 independent verification and release hardening

Review date: **2026-10-14** (America/Phoenix). Status: **verification with
two fixes.** Reconciled against canonical `UWMD-OSP/UW-Markdown` `main` at
`7c2b9d84` (merge of PR #325), which carries Format 3.0, accepted and
unreleased Protocol 4.1.0, and the published 4.1.0 package generation
(core/CLI 4.1.0, `@uwmd/verify` 0.1.0, signing 0.4.0, batch 0.9.0, Excel
0.9.17, report 0.8.29, lake 0.3.0). The fixes landed in PR #326. Release
preparation for the next generation is a separate record under
`docs/releases/`.

This review was run as an external party would run it: the published
packages were installed from npm into empty directories, the candidate was
installed from `npm pack` tarballs into another, and nothing below relies on
workspace links except the repository's own gates, which say so.

## 1. State of the repository

| Class | What |
|---|---|
| Published | 4.1.0 generation on npm, `latest` for all eight names; Protocol 4.0.0, Format 3.0. `uwmd --version` from the registry prints core 4.1.0 / verify 0.1.0 / Protocol 4.0.0 / Format 3.0. |
| Implemented, unreleased | RFC 0084 document snapshot signatures (PR #325, `226b78a2`..`468ac0e5`); the #322 canonical-encoding refusal (PR #324, `38cc0959`); `PROTOCOL_VERSION` 4.1.0. Every package manifest still carries its published version. |
| Accepted normative requirements | Protocol §V.13 and the §V.11.2 clarification, `uw-document-signature.schema.json`, the `document-signature-verification` capability, codes `INT-09`..`INT-15`, the `conformance/document-signatures/` suite (15 scenarios, 14 portable cases) and the three `conformance/signing/blocks/07`-`09` encoding refusals. RFC 0084 is `accepted`; RFC 0082 (PR #314) is a `draft` with no implementation. |
| Open defects found here | `uwmd init` overwrote an existing file; `@uwmd/signing` could not load in a browser. Both fixed in PR #326 (§4). |
| Deferred | §6. |

CI evidence for `7c2b9d84`: run 38649835849, all 14 checks green, including
"Build, test, and conformance (Windows, Node 20)", the Node 20 and 22 Linux
matrix, coverage, the web editor and the VS Code extension.

## 2. RFC 0084 verification

Method: the RFC, Protocol §V.13, the schema, the fixtures and
`packages/uwmd-verify/src/document-signatures.ts`, `integrity.ts`,
`envelope.ts`, `parser.ts`, `packages/uwmd-signing/src/documents.ts`,
`verify.ts`, `base64.ts` and `packages/uwmd-core/src/cli.ts` were read
together, then exercised through the packed candidate rather than the
workspace.

| Requirement | Finding |
|---|---|
| Document-level semantic commitment | The subject is `computeEnvelopeDigest(toUWEnvelope(parsed, { includeSuperseded: true }))`: RFC 8785 over the envelope minus `generated_at`, `generator`, `semantic_digest`. `integrity-canonical.ts` sorts keys by UTF-16 code unit, serializes numbers by ECMAScript `ToString` with `-0` as `0`, escapes per §3.2.2 and throws on non-finite numbers and BigInt. The signing input is the artifact with only `sig` removed; `documentSigningPayload` was checked to contain `kind`, `kid`, `alg`, `signed_at` and the whole subject and never `sig`. |
| Block signatures stay independently meaningful | The six-field block signing input is unchanged. Fixtures 02 (relabel), 03 (flip) and 04 (splice) verify 3/3 block signatures and fail document authentication with `subject_mismatch`; the CLI reports `signatures_verified: 3` beside `document_signature.state: failed`. |
| Source-block membership and lifecycle accounting | `resolveDocumentSigningSubject` observes every fence through `ParseOptions.onBlock` before routing, then requires each scanned block's `content` object to appear exactly once across the projected collections, by object identity. Deleting history (05), duplicate active keys regardless of revision (13 and the unit suite), repeated or superseded `x_*` blocks, and `_meta.section` disagreeing with the fence all refuse. Reordering independent sections preserves the digest; editing retained prose (15) or frontmatter (06) does not. |
| Duplicate keys, unsupported constructs, ambiguity | Duplicate decoded JSON members (including `a` vs `a`), duplicate restricted-YAML members, flow mappings, anchors, unclosed fences, malformed JSON, repeated or unknown fence tokens, non-boolean `superseded`, non-integer `v` and the `__proto__`/`constructor`/`prototype` keys refuse with `DocumentSigningError` (`INT-15`). |
| Canonical encoding and malformed artifacts | `wellFormed` requires 86 characters with zero unused low bits for Ed25519/ES256 and 128 for ES384; `verifyRawSignature` re-encodes the decoded bytes and requires the exact raw width (64 or 96). Padding (10), extra characters and non-zero unused bits are `failed/malformed`; the schema's `allOf` pins the same lengths. |
| The four states | `unsigned` only for a null or absent artifact; `unverifiable` for `no_backend`, `unknown_kid`, `backend_error` and `unsupported_version`; `failed` for `malformed`, `bad_signature`, `algorithm_mismatch`, `subject_mismatch`, `malformed_source`. Order is shape, version, source projection and digest, then cryptography, as §V.13.3 states, so a changed snapshot with an unknown key is `failed`, not `unverifiable`. `requireDocumentSignature` makes every state but `verified` fail integrity; an unrequired `failed` still fails. |
| No financial-correctness claim | Neither the signer nor the verifier touches a pack, defaults or validation; fixture 01 authenticates a record whose `stated` metric counts are 0/0/0, and the CLI prints "Document snapshot authentication: verified" on a separate line from validation. |
| No parser reduction loses source | The parser's revision-based reduction still runs for ordinary reads, but the guard refuses to sign or verify any source where it would have chosen a winner (duplicate active key) or dropped a block (extension history). Across the corpus (§3.5) every refusal traces to a block the Format already classes as `META-01` or to a deliberate malformed fixture; no well-formed document is refused. |
| Stale digests and filtered objects | `verifyDocumentSignature` takes the source text, not a digest. `verifyChain` recomputes the envelope digest of the parsed object it was handed and reports `failed/malformed_source` when it differs from the authenticated raw source (unit test mutates `frontmatter` after parsing). |
| Browser and Node | `document-signatures.ts` imports only package-internal modules; the verify bundle built for the browser carries one guarded dynamic `import("node:crypto")` and no static `node:` import. In the Claude desktop browser pane (Chromium, Web Crypto present) the packed candidate verified fixture 01 with the conformance Ed25519 key, failed fixture 02 with `subject_mismatch`, and completed an ES256 `signDocument` → `verifyDocumentSignature` round trip including the padded-signature refusal. That run needed the signing fix in §4.2. |

Spec, schema and implementation agree. No contradiction between normative
surfaces was found, so nothing was escalated under that heading.

One observation for release preparation rather than a defect: a receipt
issued by the candidate names engine `@uwmd/verify` `0.1.0` with
`protocol_version` `4.1.0`, and the published 0.1.0 verifies it as
`verified` because engine identity is name and version only (UW Receipt
§5.3). Two engines with one identity cannot ship; `VERIFY_VERSION` must move
in the release that publishes Protocol 4.1.0, which the versioning policy
already requires for the additive API.

## 3. Verification evidence

All commands ran on Linux (kernel 7.0), Node 24.21.0 and npm 11.19.0 from
the repository root unless noted. Node 20.20.2 and 22.23.3 were obtained
with `npx -p node@20` and `npx -p node@22` for the consumer runs.

### 3.1 Repository gates on `main` `7c2b9d84`

| Command | Result |
|---|---|
| `npm run build` | pass |
| `npm test` | 4,070 tests in 181 files across eight workspaces, all pass (verify 2,580; core 956; CLI 135; Excel 205; signing 119; lake 65; batch 7; report 3) |
| `npm run typecheck:tests` | pass |
| `npm run lint` | pass; one pre-existing warning, `tools/docs-site/.vitepress/theme/HomePage.vue:5` unused `PARKVIEW` |
| `npm run validate-schemas` | 62 pass |
| `npm run conformance` | 1,087 pass (reader 26, verifier 686, starter 106, integrity 32 including document-signatures 01–15, module 76, representations 135, portfolio 14, sensitivity 5, stochastic 7) |
| `npm run gen-conformance-cases -- --check` | current |
| `npm run conformance:profiles` | pass; capability-skip controls behave as RFC 0030 specifies |
| `npm run test:coverage` | verify 94.77 / 87.25 / 99.02 / 94.77 against floors 93 / 86 / 98 / 93; core 95.83 / 82.23 / 98.95 / 95.83 against 94 / 81 / 97 / 94. One run under heavy concurrent load exited 1 on a vitest worker RPC timeout, not a threshold; both suites passed when rerun alone. |
| `npm run verify-versions`, `verify-lockfile`, `verify-packages`, `verify-indexes`, `verify-codes`, `verify-release`, `verify-issue-forms`, `release:check` | pass |
| `npm run docs:build` | pass (VitePress, after `npm --prefix tools/docs-site ci`) |

### 3.2 Portable conformance driver (RFC 0004)

`python3 conformance/runner/runner.py --impl <cli> [--no-skip] --manifest-out …`

| Implementation | Result |
|---|---|
| Candidate CLI from `npm pack` tarballs, installed in an empty directory | 350/350 with `--no-skip`: reader 17, verifier 281, integrity 14, module 1, starter products 37 |
| Published `@uwmd/cli@4.1.0` from npm | 336/350; the 14 `document-signature-verification` cases skipped as a capability it does not claim, no failures |

### 3.3 Isolated consumers of the published packages

| Consumer | Result |
|---|---|
| `@uwmd/verify@0.1.0` alone (no `@uwmd/core` on disk; 13 packages installed, `fast-xml-parser` and `fflate` the only runtime dependencies) | Strict TypeScript (`strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `skipLibCheck: false`) compiles. Parses and validates `examples/Parkview-Apts-Glendale-AZ.uwx.md` (19 sections, `warnings`), `verifyStatedMetrics` 5/0/0, `verifyChain` ok, main and browser entries export the same names. Verifies a receipt issued by the published CLI as `verified`; a one-micro-unit edit to `computation.results[0].value` is `failed` `RCP-03`. Identical on Node 20, 22 and 24. |
| `@uwmd/core@4.1.0` | Strict TypeScript compiles; every one of `@uwmd/verify`'s 376 exports is re-exported from both `@uwmd/core` and `@uwmd/core/browser`; `migrateUWFile` is absent (RFC 0081). |
| `@uwmd/cli@4.1.0` | `--version` prints core 4.1.0 / verify 0.1.0 / Protocol 4.0.0 / Format 3.0. `init`, `parse`, `validate --json`, `verify` on the example work; `verify --signing` on `conformance/signing/blocks/01` passes and on `02-signed-tampered` exits 1 with `INT-04` and `INT-07`; `receipt issue` and `receipt verify` work; a missing input exits 1. Two defects: `init --output` onto an existing file prints `Created:` and overwrites; an unknown flag such as `--document-signature=…` is ignored and the command exits 0 with "OK". |

### 3.4 Isolated consumers of the candidate (`npm pack` of `7c2b9d84`)

| Consumer | Result |
|---|---|
| `@uwmd/verify` tarball alone | Strict TypeScript compiles against the new types (`UWDocumentSignature`, `DocumentSignatureResult` with an exhaustive `switch`, `DocumentSignatureVerifier`). Without a backend: `unsigned`, `unverifiable/no_backend`, `failed/subject_mismatch` on the relabeled fixture even when an injected backend accepts everything; `verifyChain` with `requireDocumentSignature` is `ok: false` while `unverifiable`; the default `verifyChain` result has no `document_signature` field. Identical on Node 20, 22 and 24. |
| verify + core + CLI + signing tarballs | `--version` prints Protocol 4.1.0. All 14 CLI document-signature fixtures return the expected state, reason and exit code. `sign-document` reproduces fixture 01's artifact byte for byte with `--signed-at`; signs the Parkview example; refuses an existing `--out`, `--out` equal to the source or the key, a public key store as a signer, `--resolved`, and a missing key store or artifact, each with exit 1. A one-character frontmatter edit is `failed/subject_mismatch` (`INT-11`); a CRLF copy stays `verified`. The candidate verifies a receipt issued by the published core and reports the tampered one `RCP-03`. |

### 3.5 Corpus sweep

Every `.uw.md` and `.uwx.md` under `conformance/` and `examples/` (803 files)
was passed to `resolveDocumentSigningSubject`. 368 authenticate, including
every document under `examples/`. 61 do not parse (UW Lite sources without
`uw_version`, and the malformed-fixture set). 374 refuse: 198 blocks have no
`_meta`, 174 have an empty `_meta.lifecycle`, one is the flat-`_meta`
fixture, one is `document-signatures/13-duplicate-active`. Format §2.5
already classes a `_meta` without `lifecycle` as `META-01`; these are
calculation fixtures that were never full Format 3.0 blocks, and Protocol
§V.13.2 requires the object `lifecycle` with boolean `superseded`. No
conformance expectation was changed.

### 3.6 Platform coverage

| Platform | How |
|---|---|
| Linux, Node 24 | every command above, executed locally |
| Linux, Node 20 and 22 | the consumer programs in §3.3 and §3.4, executed locally |
| Windows, Node 20 | CI only: run 38649835849 job "Build, test, and conformance (Windows, Node 20)" on `7c2b9d84`; not executed here |
| Browser | the Claude desktop browser pane (Chromium) loading esbuild `--platform=browser --external:node:*` bundles of `@uwmd/verify/browser` and `@uwmd/signing` from the candidate tarballs; see §2 and §4.2 |

## 4. Defects and fixes (PR #326)

### 4.1 `uwmd init` overwrote existing files

`cmdInit` wrote with a plain `writeFileSync`. A second `uwmd init`, or
`--output` naming an existing deal file, replaced the record and its
provenance and printed `Created:`. Reproduced on the published CLI and the
candidate. Fix: refuse an existing target by derived default name or explicit
`--output`, exit 1 naming the path, and write with `flag: 'wx'`. Precedent:
`sign-document` already requires a new output file. Regression test:
`packages/uwmd-cli/test/cli.smoke.test.ts`, "init refuses to overwrite an
existing file".

### 4.2 `@uwmd/signing` could not load in a browser

Since 0.3.1 (4.0.1 release) `version.ts` read the manifest through
`createRequire` from `node:module`, a static import no browser resolves,
while the README promises "Node ≥ 18.4 or a modern browser" and every
algorithm runs on Web Crypto. Reproduced: the browser bundle of the published
0.4.0 fails with "Failed to fetch dynamically imported module". Fix:
`SIGNING_VERSION` is a literal again, the `CORE_VERSION`/`VERIFY_VERSION`
pattern, held to the manifest by `version.test.ts`, which now also fails on
any static `node:` import in the package. The file-backed key store keeps its
guarded dynamic `node:fs`. After the fix the same page completes the Ed25519
verification and ES256 round trip described in §2.

### 4.3 Documentation corrected in the same PR

CLI help (missing `--document-signature`, `--key`, `--out`, `--signed-at`;
signing flags filed under `sign-document`), the CLI README command table
(no `verify`, `receipt` or `sign-document`; `compact` misdescribed), the
`@uwmd/verify` README (no mention of document authentication or how to read
its states), wiki 08 and wiki 11.

## 5. Normative contract versions and required package versions

Format 3.0 is unchanged. Protocol 4.1.0 is accepted and unreleased. By the
policy in wiki 11 and the RFC 0083 precedent, the generation that publishes
it needs: `@uwmd/verify` 0.1.0 → 0.2.0 (additive API, new Protocol constants
and codes); core and CLI 4.1.0 → 4.2.0 (additive exports and commands, a new
exact verify pin); signing 0.4.0 → 0.5.0 (new exports, stricter encoding
refusal, repins); batch 0.9.0 → 0.9.1 and lake 0.3.0 → 0.3.1 (verify repin);
Excel 0.9.17 → 0.9.18 and report 0.8.29 → 0.8.30 (core repin). A verify
bump moves the two `conformance/receipts/issue/` baselines and the
`engine_version` of the three `failed` receipts under
`conformance/receipts/verify/` (wiki 11, items 3 and 4). The owner's launch
plan (2026-10-13) separately decides lockstep 5.0.0 for launch day; the
interim generation above follows the written policy and is renumbered, not
reworked, if the owner prefers to go straight to 5.0.0.

## 6. Deferred findings

- The CLI ignores unknown flags. On 4.1.0, `verify … --document-signature=x
  --keystore=k` exits 0 with "OK". A closed flag vocabulary per command
  would make a misspelled or unsupported security flag an error. Not changed
  here: it touches every command's parsing.
- `tools/docs-site/.vitepress/theme/HomePage.vue:5` declares an unused
  constant (Biome warning). Cosmetic.
- `toUWEnvelope` still defaults `generator` to `@uwmd/core` from
  `@uwmd/verify` (known RFC 0083 follow-up; outside the digest).
- Calculation fixtures whose blocks carry no `_meta` or an empty `lifecycle`
  cannot be authenticated (§3.5). That is the specified behavior; whether
  the corpus should carry complete `_meta` everywhere is a corpus-hygiene
  question, not a verifier one.
