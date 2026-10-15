# Public-launch onboarding audit (published 4.2.0)

Review date: **2026-10-14** (America/Phoenix). Status: **audit; no release
decision.** Reconciled against `UWMD-OSP/UW-Markdown` `main` at `dd21bf12`
(merge of PR #329), which carries the published 4.2.0 generation and one
unreleased change, PR #328 (closed CLI flag vocabulary). Nothing here was
tagged or published, and no normative text changed.

This review was run as a new adopter would run it: the published packages were
installed from npm into empty directories, and each README was followed as
written. Only §2's `main` column and the gates named in §6 use the workspace.

## 1. State of the repository

| Class | What |
|---|---|
| Published (`latest`) | `@uwmd/verify` 0.2.0, core/CLI 4.2.0, signing 0.5.0, batch 0.9.1, lake 0.3.1, Excel 0.9.18, report 0.8.30; Protocol 4.1.0 (Stable), Format 3.0. Annotated `v4.2.0` on `238dbf35`, reconciled by PR #329 ([publication record](../releases/4.2.0-publication.md)). `uwmd --version` from the registry prints core 4.2.0 / verify 0.2.0 / Protocol 4.1.0. |
| Unreleased on `main` | PR #328 (`6d5346ed`, merged as `8d996645`): every CLI command refuses flags outside its closed vocabulary (`COMMAND_FLAGS`). It is the only package-source change since `v4.2.0` (`packages/uwmd-core/src/cli.ts`, `cli-args.ts`). |
| Open PRs at start | None. |

## 2. Next release version for PR #328

The question was which version the next generation takes under the
semver-per-surface policy (CHANGELOG "Versioning", wiki 11, VERSIONS.md
"Compatibility rules"). This section does not assume a lockstep launch number.

**Evidence.** The same invocations were run against the registry-installed
`@uwmd/cli@4.2.0` and against `main`, built from `dd21bf12`, on
`examples/Parkview-Apts-Glendale-AZ.uwx.md`:

| Invocation | 4.2.0 exit | `main` exit |
|---|---:|---:|
| `validate deal --stage screening` | 0 | 1 |
| `validate deal --stage=screening --json` | 0 | 1 |
| `export deal --compact --stdout` | 0 | 1 |
| `diff deal deal --json` | 0 | 1 |
| `summary deal --json` | 0 | 1 |
| `verify deal --integrity --document-signture=x.json --keystore=k.json` (typo) | 0 | 1 |
| `verify deal --intgrity` (typo) | 0 | 1 |
| `validate deal`, `verify deal --integrity --json`, `parse deal --compact`, `export deal --no-superseded --stdout`, `diff deal deal`, `summary deal`, `render deal --format summary`, `--help`, `--version` | 0 | 0 |

`--stage` on `validate` was not an undocumented accident. 4.2.0 prints
`Usage: uwmd validate <file> [--stage <stage>] …` itself, and the Format spec
documents `uwmd validate <file> [--stage <stage>]` (§6.2). VERSIONS.md tells
script authors to "pin `@uwmd/cli@^4` … for CLI scripts", and rule 3 says
minors and patches "will not" break the calling shape. A script written to
4.2.0's own usage text fails on `main`.

**Classification.** PR #328 is an incompatible change to the CLI's public
interface, so the CLI takes a **major**. The CLI program is core's public
`./cli` export (`@uwmd/core/cli`, wiki 03), so core changes the same way, and
`check-release-readiness.mjs` requires core and CLI to carry one version. Its
safety rationale (a mistyped `--document-signature` passed as `OK`) explains
why the change is right. It does not make the change compatible. A minor would
be defensible only if `validate --stage` and `export --compact` were still
accepted. That would add the compatibility aliases the maintainer process rules
out, so it is not recommended.

| Surface | Next version | Reason |
|---|---|---|
| `@uwmd/cli` | **5.0.0** | Documented invocations now exit 1 |
| `@uwmd/core` | **5.0.0** | Same program (`./cli` export); core = CLI version (`check-release-readiness`) |
| `@uwmd/signing` | 0.5.1 | Repin only: it pins core exactly. Precedent: a core major with no signing change took a patch (3.0.0 → signing 0.2.26). Core's optional signing peer moves with it |
| `@uwmd/excel` | 0.9.19 | Repin only (pins core) |
| `@uwmd/report` | 0.8.31 | Repin only (pins core) |
| `@uwmd/verify` | 0.2.0, unchanged | No source change. `VERIFY_VERSION` and the receipt baselines do not move |
| `@uwmd/batch`, `@uwmd/lake` | 0.9.1, 0.3.1, unchanged | They pin only verify. `release.yml` skips a version already on npm |
| Protocol / Format | 4.1.0 / 3.0, unchanged | The CLI is a starter product (RFC 0078); nothing normative moves |

The tag would be `v5.0.0` because tags follow core's version. That is a
consequence of PR #328 alone, not a lockstep generation: five of the eight
packages do not reach 5.0.0. Fixes in §4 that ship in the same generation
(D-01, D-02) are themselves CLI behavior changes and fit inside the same major.
Preparing, tagging or publishing needs owner authorization.

## 3. Clean-room onboarding results

Environment: Linux, Node 24.21.0 (plus Node 18.20.8, 20.20.2 and 22.23.3
through `npx -p node@<n>`), npm 11, TypeScript 5.6.3, esbuild 0.24.0, and the
Chromium 152 browser pane of the Claude desktop app.

| Check | Result |
|---|---|
| `@uwmd/verify` alone (`npm install @uwmd/verify`) | 10 packages, no `@uwmd/*` dependency. The README's "Basic use" runs as written. Parkview gives 5/0/0 stated metrics. Receipts issue and verify. |
| Strict TypeScript consumer (`strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `skipLibCheck: false`, NodeNext) importing `@uwmd/verify`, `/browser`, `@uwmd/core`, `@uwmd/core/browser` and `@uwmd/signing` | `tsc` exit 0. It runs under Node type stripping. |
| Browser bundles (esbuild, `--platform=browser`) | `@uwmd/verify`, `@uwmd/verify/browser` and `@uwmd/core/browser` bundle with `node:crypto` external, as the verify README says. `@uwmd/signing` fails until `node:fs` is also external (D-05). |
| Browser execution (Chromium) | One bundle of verify/browser and signing ran all four scenarios below in the page: 5/0/0 and 4/1/0 metrics, receipt `verified` then `failed`, document signature `verified` then `failed`. |
| CLI from npm (`@uwmd/cli@4.2.0`) | `init --output`, `validate`, `verify`, `receipt issue`/`verify` and `sign-document` with `verify --document-signature` all work once `@uwmd/signing` is installed beside the CLI. See D-01 to D-04. |
| Node floors (`engines`) | verify and the CLI run on Node 18.20.8. `@uwmd/signing` declares `>=18.4.0` and fails on 18.20.8 (D-06). CI tests Node 20 and 22 only. |
| Four verification scenarios, library | All behave as specified on Node 20, 22 and 24 (§5). |

## 4. Defects found

| ID | Severity | Defect | Evidence | Disposition |
|---|---|---|---|---|
| D-01 | **Launch blocker** | `uwmd verify` never recomputes stated metrics. A document whose stated `quick_metrics.cap_rate` is 0.0601 against a record that gives 0.0551 prints `✓ OK` and exits 0, with or without `--validate --integrity --policy` and with `--json`. No CLI command reports it: `validate` exits 0 and `receipt issue` does not compare stated figures. Protocol §I defines verifying as including "stated figures agree", and §II.2 item 2 makes a disagreeing stated value "a verification failure". The library's `verifyStatedMetrics` reports it correctly (4/1/0). | Registry 4.2.0 and `main` behave the same. | Fix in its own PR: `verify` runs `verifyStatedMetrics`, reports the evidence, and a `failed` metric fails the command. That PR records the exit-code and `unverifiable` handling decisions. |
| D-02 | **Launch blocker** | The root README quick start fails at step 2. `npx @uwmd/cli init my-deal.uwx.md` ignores the positional and writes `new-deal.uwx.md`. The next line, `npx @uwmd/cli validate my-deal.uwx.md`, then exits 1 with `file not found`. `init` takes `--output`, and it silently drops a positional argument, the same class of defect #328 fixed for flags. | Registry 4.2.0 and `main`. | Docs PR: use `init --output my-deal.uwx.md`. Code: `init` should refuse a positional instead of ignoring it. |
| D-03 | Should fix (security hygiene) | `@uwmd/cli`'s npm description advertises `npx uwmd init\|parse\|validate\|render\|run`, and the bin header comment says the same. The unscoped `uwmd` package does not exist on npm (`npm view uwmd` gives E404), so anyone who registers it receives every `npx uwmd` a reader types. | `packages/uwmd-cli/package.json` `description`; `bin/uwmd.mjs` header; registry 404. | Docs/package metadata: say `npx @uwmd/cli`. The owner decides whether to register a placeholder `uwmd` name (an account action). |
| D-04 | Should fix | Errors are misleading when `@uwmd/signing` is absent. `sign-document` prints a raw `Cannot find package '@uwmd/signing' imported from …/core/dist/cli.js` with no install hint. `verify --document-signature` says `--signing needs the optional @uwmd/signing package`, naming a flag the user did not pass. | `cli.ts` `signingOptions` and the `sign-document` case; registry 4.2.0. | Small CLI fix, same PR family as D-01. |
| D-05 | Should fix (docs) | `@uwmd/signing` does not bundle for the browser unless `node:fs` is external (`loadKeyStoreFile`'s guarded dynamic import). The signing README says it works in "a modern browser" but, unlike verify's README, does not tell bundlers which builtins to externalize. | esbuild: `Could not resolve "node:fs"` at `keystore-file.js:50`. | Signing README: name `node:crypto` and `node:fs` as externals. |
| D-06 | Should fix | `@uwmd/signing` declares `engines.node >=18.4.0` and its own error says "needs Node >= 18.4", yet on Node 18.20.8 `generateSigningKeyPair` fails with `SIG_NO_CRYPTO` (no `globalThis.crypto.subtle` without a flag). | `npx -p node@18 node …` | Raise the floor to what CI tests (20), or document the flag. Packaging metadata change for the maintainers. |
| D-07 | Should fix (docs) | `validate --stage` and `export --compact` are still documented after #328 refuses them. Format spec §6.2 shows `uwmd validate <file> [--stage <stage>]`. Part VI is also stale more broadly: `render` formats `pdf`/`docx`, `run --agent`, and `compact` writing to the pipeline log. | `spec/UW_FORMAT_SPEC.md` §6.1–6.7. | Part VI lives under `spec/`, so whether it is normative is a maintainer call before an edit. Until then it is recorded, not changed. |
| D-08 | Should fix (docs) | Stale version statements a new user reads: README "What ships in v1" says Protocol 4.0.0; VERSIONS.md "Pinning recommendations" says "target … the Protocol 4.0.0 contract" and `@uwmd/cli@^4` for scripts. The signing README says "core owns the normative, crypto-free half" (verify owns it since RFC 0083) and "protocol 1.x does not define". | Files as named. | Docs PR. |

| D-09 | Should fix | `uwmd compact` output fails `uwmd verify`. On `examples/parkview-after-L6.uwx.md` (verify exit 0), `compact --output` removes one superseded block. The result then fails with `POL-02 [risk_assessment] … requires supersede_on_edit but version 2 has no superseded prior versions` (exit 1). Format spec §6.5 also says compact appends a `compact` pipeline-log entry, and it appends none. | Registry 4.2.0. | Needs a design call: compact versus the supersede policy. Recorded here, not changed. |
| D-10 | Should fix | `uwmd package verify examples/standalone/package/standalone-demo.uwpkg.zip` prints `UNVERIFIABLE` for all three records ("semantic digest could not be checked here") and exits 0. The CLI calls `verifyUWDealPackage` without a `semanticDigestOf` (`cli-packages.ts`), so no package can reach `VERIFIED`. The standalone README shows the command with no expected result. | Registry 4.2.0; `cli-packages.ts`, `deal-package-zip.ts`. | Code fix in its own PR. |

Further documentation findings are in §7.

## 5. Verification scenarios

PR #330 adds them as `examples/verification/`, runnable outside the
repository against the npm packages and gated in CI. Results on the published
`@uwmd/verify` 0.2.0 and `@uwmd/signing` 0.5.0 (Node 20 and 22):

| Scenario | Result |
|---|---|
| Valid document (Agave Court) | Validation clean; 8 stated metrics `verified` |
| Incorrect stated metric (cap rate 0.0600, record gives 0.0542) | `quick_metrics.cap_rate` `failed`, 7/1/0. The CLI does not catch it (D-01). |
| Tampered receipt | Untouched `verified`. A result edited in the receipt gives `failed` `RCP-03`. The record changed after issuance gives `failed` `RCP-01`. Both follow UW Receipt §5.1 precedence. |
| Document snapshot authentication | Signed document `verified`. A changed document gives `failed` (`subject_mismatch`, CLI `INT-11`, exit 1). An untrusted key gives `unverifiable` (`unknown_kid`, CLI `INT-13`, exit 1). |

## 6. Launch blockers

1. **D-01**: the reference CLI's `verify` passes a document whose stated
   figures disagree with its record.
2. **D-02**: the first two commands of the README quick start fail.
3. **Release of PR #328** as core/CLI 5.0.0 (§2) needs owner authorization.
   Until then `main` documents behavior (`--stage`, `--compact`) the next
   release removes (D-07).

D-03 to D-10 and the §7 findings do not block a technical launch, but each is something a new
adopter hits on day one.

Gates run for this record: `verify-indexes`, `verify-release` and the
docs-site build.

## 7. Documentation audit

The sweep was read-only. It covered README.md, the package READMEs,
`docs/starter/`, wiki 03, 08 and 12, `docs/TOOLS.md`, `docs/UW_RECEIPTS.md`,
`examples/**`, VERSIONS.md, Format spec Part VI and the hand-written
docs-site pages. It checked 147 `uwmd` invocations against `COMMAND_FLAGS`
and the CLI switch, and 26 `@uwmd/*` imports against each package's
`exports` with the TypeScript checker.

**What passed.** Except as listed, every documented flag and command exists
and all 26 imports resolve. The docs-site quickstart tutorial matches real
output step by step. All 20 `.uwx.md` examples validate and verify with exit 0.

Findings not already in §4:

| Where | What it says | What is true | Severity |
|---|---|---|---|
| Format spec §6.2 | `validate` output with 4 stages | Real output has 7 stages (scope through monitoring) plus `errors`, `warnings`, `info`, `coverage` and `replacement_funding_verification` | Should fix (with D-07) |
| Format spec §6.4 | `render --format pdf\|docx` | Core refuses both ("Use @uwmd/report"); the usage string lists json, csv, chat, summary | Should fix (with D-07) |
| Format spec Part VI | The toolchain interface | Omits `verify`, `receipt issue`/`verify` and `sign-document`, the Verifier's own operations | Should fix (with D-07) |
| wiki 08 (closed flags) | Unknown flags are refused; "through CLI 4.1.0" they were ignored | Published `latest` 4.2.0 still ignores them (#328 is unreleased; the 4.2.0 publication record says so). It should read "from the next release" | Should fix |
| VERSIONS.md pinning | Pin `@uwmd/core@^4` "for readers, verifiers" | No guidance for `@uwmd/verify`, the verifier-only package. As a 0.x package, `^0.2.0` stops before 0.3 | Should fix (with D-08) |
| `tools/docs-site/ai/index.md` | "Authoring: UW Format 2.0" | Only Format 3.0 is read; others are refused (`UNSUPPORTED_FORMAT_VERSION`) | Should fix: an AI author follows it |
| `packages/uwmd-report/README.md` | `uwmd-report deal.uw.md …` | A Lite `.uw.md` is refused (`UNSUPPORTED_FORMAT_VERSION`); `.uwx.md` works | Should fix |
| `packages/uwmd-cli/README.md` | `diff` on "two `.uw.md` files"; `uwmd layers <file>` | `diff` refuses Lite; `layers` takes no file | Should fix / nit |
| `packages/uwmd-excel/README.md` | Mirrors `MULTIFAMILY_STARTER_PACK` in `@uwmd/core` | That symbol does not exist; it is `MULTIFAMILY_PACK` | Should fix |
| `docs/starter/defaults-and-cascade.md` | Tables published "under `@uwmd/core/defaults`", pinnable via institution config | No such subpath (core exports `.`, `./browser`, `./cli`; tables come from the root); no pinning field found | Should fix |
| `docs/downloads/templates/blank-{screener,analyst}.uw.md` | Served as downloads | UWX content under the Lite name; `validate` reports 17 Lite errors each | Should fix |
| wiki 12 | `NAMED_INPUTS`/`NAMED_RANGE_MAP` in `uwmd-excel/src/multifamily.ts` | They do not exist (`MULTIFAMILY_LAYOUT`) | Nit |
| Nits | `docs/TOOLS.md` "Protocol 3.0 tier"; lake README "pairs with `@uwmd/core` 3.0.0"; CLI README "(2.8.0)/(2.9.0)" headings and "Protocol 2.12.0"; `UW_RECEIPTS.md` sample pack `@1.0.1` (now 1.0.2); the README writes `.uw.xml`/`.uw.json` into the clone's `examples/` | — | Nit |

**Missing verification steps.** None of these produce or read a document and
then verify it: the README quick start (no `verify` or receipt step, no
expected output), the canonical CLI block in `docs/TOOLS.md` (no
`uwmd verify`), the core README basic use (no `verifyStatedMetrics`,
`verifyChain` or receipt), the "your first file" tutorial (issues a receipt
but never runs `receipt verify`, and does not mention that its file computes
0/8), and the signing README CLI flow (no expected output, and no way to make
`signer.json`). The signing flow does work with a hand-made Ed25519 JWK.
`examples/verification/` (PR #330) is the minimal verified path to link from
these.

## 8. Not covered

- The Excel, report, batch and lake packages beyond install resolution.
- The web editor, the viewer and the VS Code extension.
- Windows and macOS. CI covers Windows for the workspace, not the registry
  install.
- A standalone verifier CLI (`uwmd-verify` bin). It does not exist yet, so a
  party holding only `@uwmd/verify` has the library and no command line.

## 9. Follow-up (2026-10-14)

PRs #330 and #331 merged. Dispositions since:

| ID | Status |
|---|---|
| D-01, D-02, D-04 | Fixed in PR #332 (CLI). `verify` runs `verifyStatedMetrics` in its validate phase; `init` refuses a file argument and the README says `--output`; one loader names the flag or command when `@uwmd/signing` is missing. Ten CLI-level tests, eight of which fail on the unfixed `cli.ts`. |
| D-03, D-05, D-08, §7 | Corrected in the onboarding documentation PR. No normative text changed. |
| D-06 | Signing README now states the real requirement (Node 20+, or Node 18 with `--experimental-global-webcrypto`, which passes scenario 4). `engines` still says `>=18.4.0`: owner decision. |
| D-07 | Format spec Part VI not edited: owner decision whether it is normative. |
| D-09 | Traced (below); a normative inconsistency, now draft RFC 0085 (PR #335, §11). Not changed. |
| D-10 | Traced (below); implementation defect against RFC 0018. Fixed in PR #334 (§10). |

**D-09: `compact` output fails `verify` (`POL-02`).** The two sides follow two
different normative texts. Format §2.7 says "The `uwmd compact` command strips
superseded blocks and leaves only current versions", and §6.5 says compact
removes every superseded block. Protocol §V defines `POL-02` as an error by a
stated heuristic: under a `supersede_on_edit` policy (`agent/*`, `document/*`
and the catch-all), "`_meta.lifecycle.revision > 1` with no superseded prior
revisions visible". `verifyProvenance` (`integrity.ts`) implements exactly
that. So every compacted section whose head is past revision 1 is, by the
Protocol's own test, indistinguishable from an illegal `section_replace`.
Neither implementation departs from its own text. The one implementation gap
is that compact appends no `compact` pipeline-log entry, which §6.5 says it
does. Even with that entry, `POL-02` does not read the log. Resolving this
means one of: compact output is declared a non-verifiable presentation copy
(starter-only, no normative change); `POL-02` recognizes compaction
(normative, needs an RFC and possibly a new marker); or compact is withdrawn
under invariant 5 ("supersede, don't destroy"). **Owner decision; nothing
changed.**

**D-10: `package verify` never reaches `VERIFIED`.** `verifyUWDealPackage`
(`deal-package-zip.ts`) is three-state by design. It checks byte digests itself
and checks a member's `semantic_digest` only through an injected
`semanticDigestOf`, reporting `unverifiable` when none is supplied. The CLI
(`cli-packages.ts` `cmdPackageVerify`) supplies none. RFC 0018 (implemented)
says "A UW member's semantic digest MUST verify when the implementation
supports its representation; otherwise the package is `unverifiable`". The
reference implementation does support it: for all three UW members of
`examples/standalone/package/`, the manifest's `semantic_digest` equals the
`uw-envelope-semantic` digest `@uwmd/verify` computes
(`computeEnvelopeDigest(toUWEnvelope(parseUWFile(…)))`, also the receipt
subject digest). So the CLI's `unverifiable` violates RFC 0018. It also has a
security consequence. A member whose content changed, with its byte `sha256`
updated in the manifest but its `semantic_digest` stale, should be `failed`
(`PKGVER-003`) but reports `UNVERIFIABLE` and exits 0. The smallest fix
supplies `semanticDigestOf` from the CLI for UWX members and returns `null`
for representations it cannot canonicalize. That touches core only;
defaulting it inside `@uwmd/verify` would need a verify release and move the
receipt baselines. No normative change is needed.

Other defects found while correcting the documentation:

- `uwmd-report` names its output `deal.uwx.pdf` / `deal.uwx.report.html` for
  `deal.uwx.md`. `defaultOutputName` strips only `.uw.md`. Its usage string
  still says `<input.uw.md>`, which it refuses.
- `docs/starter/defaults-and-cascade.md` §V.8 says consumers "MAY pin a
  specific table version via institution config". No such configuration
  field exists. The sentence is starter guidance and was left for the owner.
- `docs/downloads/templates/blank-{screener,analyst}.uw.md` are UWX content
  under the Lite name (17 Lite errors each). They are served download URLs, so
  renaming or regenerating them is left for the owner.
- `uwmd verify` applies only replacement funding among the Protocol §II.2
  item 3 stated-figure verifiers. The others have their own commands. Whether
  `verify` should run them all is a product decision.

## 10. D-10 correction evidence

**Contract reconciled.** RFC 0018 (implemented) requires a UW member's
`semantic_digest` to verify when the implementation supports the
representation, and `unverifiable` otherwise. The semantic digest is RFC
0014's `uw-envelope-semantic` digest. `verifyUWDealPackage` is unchanged and
three-state: an equal digest verifies, a different one fails (`PKGVER-003`),
and `null` is `unverifiable`. Before this change nothing exercised the
supplied-digest path: the `packages` conformance invariants
(`verify-clean`, `verify-tampered`) use manifests with no `semantic_digest`,
and the one CLI test pinned the defect (a bogus digest on a checkable UWX
member expected `unverifiable`).

**Supported representations.** For `examples/verification/deal.uwx.md`,
the UWX parse and the `uw-json`, `uw-xml` and `uw-csv-bundle` codecs in
`CORE_CODEC_REGISTRY` all give the same envelope digest
(`sha256:4c7b1784…8518`), and each model encoding's stamped `semantic_digest`
equals it. UW Lite is excluded. A Lite receipt subject uses the separate
`uw-lite-financial` canonicalization, and RFC 0018 does not say which one a
Lite member's `semantic_digest` uses. That is an owner question; until it is
answered, Lite members stay `unverifiable`.

**Reproduction.** `standalone-demo.uwpkg.zip` with `deal:parkview`'s
`deal_name` edited, its `sha256` refreshed and its `semantic_digest` left
stale. On `main` before the fix it prints `UNVERIFIABLE` for all three
records and exits 0, the same verdict as the untouched package. After the
fix the untouched package prints `VERIFIED` (exit 0), and the altered one
prints `FAILED` with `PKGVER-003 [deal:parkview]` (exit 1). An archive with
its declared source evidence removed is refused at decode,
`[PKGZIP-006]` (exit 1), before and after.

**Regression tests.**
- Core `cli-packages.test.ts`, 8 new tests: digest parity across all four
  representations; `null` for Lite, PDF, non-UTF-8, a refused `uw_version`
  and malformed JSON; a valid package (exit 0); a stale UWX digest and a
  stale UW JSON digest (exit 1, `PKGVER-003`); Lite `unverifiable` (exit 0,
  no `PKGVER-003`); a refused record `unverifiable`, not failed; and no
  stated digest, checked on bytes only.
- CLI smoke, 2 spawned tests: the demo package verifies (exit 0), and the
  stale variant fails (exit 1).
- Verify `deal-package.test.ts`, 2 tests: the PKGZIP-006 refusal and the
  library's three-way `semanticDigestOf` contract.

Against the unfixed `cli-packages.ts`, both smoke tests and 6 of the 8 core
tests fail. The two that pass are the guards that a refused record and an
unstated digest are not turned into failures.

## 11. Status after RFC 0085 analysis (2026-10-14)

PRs #334 (D-10) and #336 (the `uwmd-report` output name and usage text)
merged after a final diff review. Every GitHub Actions check was green; only
the Vercel preview was red, from the free-tier deployment rate limit (a
quota, not a build). Nothing was tagged or published. Format 3.0, Protocol
4.1.0 and the published package versions are unchanged.

**RFC 0085 (draft, PR #335)** now:

- separates six properties: payload recoverability, commitment authenticity,
  payload verification against the commitment, parent-hash continuity,
  document-signature validity and older-reader behavior;
- compares in-document stubs, a detached authenticated compaction manifest,
  externally archived full history, and withdrawing `compact` as a
  verifiable-document operation.

Two measurements corrected its first draft:

- A Format 3.0 reader *accepts* a payload-elided superseded block and
  ignores a `compacted` member. On an unhashed chain it verifies `✓ OK` with
  `POL-02` satisfied.
- Stripping a *signed* historical payload is today an `INT-07` error.
  `document-signatures/01-valid` with its superseded block elided gives
  `INT-04` + `INT-07`, `signatures_verified` 3 → 2, `ok: false`. Stubs
  therefore weaken a current guarantee unless stubbed history is reported as
  a distinct non-verified state.

**Fail-closed investigation (no edit made).** Do existing requirements
already prohibit an unqualified successful integrity result for a chain
whose declared predecessor is absent? **No.**

- Protocol §V.10, Format §3.4 and `uwmd-block.schema.json` define
  `parent_hash` as "null on a chain root". But §V.10 rule 2 covers only "the
  prior block", and §V.10's editor rule stamps `parent_hash =
  prior.content_hash` on every edit. That includes a permitted
  `section_replace`, which discards the prior block (§V.2).
- `editor.integrity.test.ts` pins `verifyChain` → `ok: true` on a hashed
  `manual` replace.
- A local experiment applied the existing `INT-01` comparison to a root with
  a non-null `parent_hash`. It was reverted and never committed. Reference
  conformance stayed 1,089/0 and portable 350/350.
  `document-signatures/03-flip` and `05-delete-history` would gain `INT-01`
  under `json-subset` expectations that still hold. One unit test failed:
  that legitimate replace.

Any fail-closed behavior is therefore a normative change: an `INT-01`
reading, a new code, or a qualified `IntegrityResult`. Each also needs a
decision on how `section_replace` stamps a hashed chain. The schema needs no
change in any case. RFC 0085 §5 lists the implications.

**Verified and fixed on `main` (unreleased):**

| Fix | PR |
|---|---|
| D-01 `verify` stated metrics, D-02 `init`/README, D-04 signing errors | #332 |
| D-03, D-05, D-08, §7 documentation | #333 |
| D-10 package semantic digests | #334 |
| `uwmd-report` output name | #336 |

The four verification scenarios run in CI (#330).

**Verified, normative decision needed:**

- D-09: compaction versus `POL-02`, and compaction laundering a broken chain
  (RFC 0085 §9 questions 1, 2, 5, 6).
- A dangling `parent_hash` with no visible predecessor passes, and is also
  produced by a hashed `section_replace` (RFC 0085 §9 questions 3–4).
- D-07: whether Format spec Part VI is normative.
- Which canonicalization a UW Lite package member's `semantic_digest` uses
  (Lite members stay `unverifiable` until decided).

**Verified, owner (non-normative) decision needed:**

- whether `@uwmd/verify` should default `semanticDigestOf` (needs a verify
  release);
- D-06, the signing `engines` floor;
- the `blank-*.uw.md` download URLs (delete, redirect or real Lite);
- starter §V.8's table-pinning sentence;
- whether `uwmd verify` should run every §II.2 item 3 verifier;
- registering a placeholder for the unscoped `uwmd` npm name (account
  action);
- authorizing the next release.

**Launch blockers remaining.**

1. **Release-gated.** D-01 and D-02 are fixed on `main` but not published.
   `@uwmd/cli@4.2.0`, the current `latest`, still prints `OK` for a wrong
   stated metric, and the README quick start fails against it. They stay
   launch blockers until a release is authorized and published.
2. **Decision-gated.** A hashed chain whose history was removed (by
   `compact` or by hand) verifies `OK` (RFC 0085 §1.2, §5). For a standard
   whose purpose is verification, this should be decided before launch.
   Whether it blocks launch is an owner call.

No other open technical blocker was found.
