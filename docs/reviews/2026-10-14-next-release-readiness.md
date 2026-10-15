# Next-release readiness assessment (2026-10-14)

> **Superseded in part (2026-10-15).** The owner reserved 5.0 for the
> coordinated public launch ([ROADMAP](https://github.com/UWMD-OSP/UW-Markdown/blob/main/ROADMAP.md)).
> The core/CLI 5.0.0 plan below is therefore withdrawn. The interim release
> stays on 4.x, and the CLI breaks it identifies (§3.1) need one of the
> alternatives in draft PR #342. The measurements, the Node findings and the
> gate results stand.

A read-only assessment of what the next release would contain, which package
versions it requires, and what still stands between `main` and a publication.
It is not a release-prepared record and authorizes nothing. No manifest,
version literal, tag or npm package was changed. Format **3.0**, Protocol
**4.1.0** and the published package versions are unchanged.

- **Candidate tree:** `origin/main` at `8203f00c` (the merge of PR #337).
- **Baseline:** annotated `v4.2.0` on `238dbf35`, published as
  [docs/releases/4.2.0-publication.md](../releases/4.2.0-publication.md).
- **Earlier evidence:** the
  [launch onboarding audit](2026-10-14-launch-onboarding-audit.md) (D-01 to
  D-10, §9 to §11).

## 1. Result

The candidate is technically sound: every repository gate passes, reference
conformance is 1,089/0 and portable conformance 350/350. Under the
independent versioning policy it requires:

| Package | Published | Candidate | Why |
|---|---|---|---|
| `@uwmd/core` | 4.2.0 | **5.0.0** | The `uwmd` CLI (core's bin and `./cli` export) now refuses invocations 4.2.0 accepted and advertised (§3.1). The library API is byte-identical. |
| `@uwmd/cli` | 4.2.0 | **5.0.0** | Versions with core (`check-release-readiness.mjs`). |
| `@uwmd/signing` | 0.5.0 | **0.5.1** | Its code is unchanged; its exact pin on core moves to 5.0.0 and core's optional peer moves with it. 0.6.0 if the owner raises its `engines` floor and treats that as breaking (§4). |
| `@uwmd/excel` | 0.9.18 | **0.9.19** | Repin core 5.0.0. Its README also changed. |
| `@uwmd/report` | 0.8.30 | **0.8.31** | Default output name fix (#336) and repin core 5.0.0. The same `engines` question as signing (§4). |
| `@uwmd/verify` | 0.2.0 | 0.2.0 | Packed contents byte-identical to the published archive. Not republished. |
| `@uwmd/batch` | 0.9.1 | 0.9.1 | Byte-identical. Not republished. |
| `@uwmd/lake` | 0.3.1 | 0.3.1 | Only its README differs. A 0.3.2 would only refresh the npm page (owner option, not required). |

The tag would be `v5.0.0`, because the tag names the core version.
`release.yml` skips any version already on npm, so verify, batch and lake are
not republished. `VERIFY_VERSION` does not move, so receipts keep naming
engine `@uwmd/verify` 0.2.0 and no receipt baseline changes. The only
version literals to change are `CORE_VERSION`
(`packages/uwmd-core/src/version.ts`) and `SIGNING_VERSION`
(`packages/uwmd-signing/src/version.ts`).

5.0.0 here is a semver consequence of actual CLI breaks. It is not a lockstep
launch number: the other packages move only as far as their own changes and
pins require.

Before preparation, the owner must decide on the Node floor (§4), Format
Part VI (§8, D-07) and the release itself (§10). Two technical defects in the
declared Node support were reproduced (§4).

## 2. What the generation contains

Twenty commits since `v4.2.0`. Every one is on `main` and none is published.

| PR | Change | Shipped files that change |
|---|---|---|
| #328 | Closed CLI flag vocabulary: an unknown flag exits 1 before any file is read | core `dist/cli*.js` |
| #332 | D-01 `uwmd verify` recomputes stated metrics (Protocol §II.2 item 2). D-02 `init` refuses a positional name. D-04 one actionable missing-signing message | core `dist/cli*.js` |
| #334 | D-10 `package verify` checks stated `semantic_digest` values (RFC 0018) | core `dist/cli-packages.js` |
| #336 | `uwmd-report` default output name and usage for `.uwx.md` | report `dist/cli.js` |
| #333 | Onboarding documentation reconciled with 4.2.0 and the spec | READMEs of core, CLI, signing, Excel, report and lake; CLI `package.json` description and bin comment |
| #329, #330, #331, #335, #337 | 4.2.0 reconciliation, verification examples, audit records, draft RFC 0085 | none |

Method: all eight workspaces were packed from the candidate with
`npm pack` and compared file by file with the published archives
(`npm pack @uwmd/<name>@<version>`). Core's `dist/index.d.ts` and its
browser entry are identical. Only `cli.js`, `cli-args.*`, `cli-packages.*`
and the README differ.

## 3. Published versus candidate CLI behavior (reproduced)

Both sets were installed into empty directories: the published 4.2.0
packages from npm, and the eight candidate tarballs.

### 3.1 Compatibility breaks (why core is a major)

| Invocation | `@uwmd/cli@4.2.0` | Candidate |
|---|---|---|
| `validate deal.uwx.md --stage underwriting` | exit 0, `CLEAN` (flag ignored) | exit 1, `unknown flag --stage` |
| `export deal.uwx.md --compact` | exit 0 (alias of `--no-superseded`) | exit 1, `unknown flag --compact` |
| `validate deal.uwx.md --strict` | exit 0 (ignored) | exit 1 |
| `verify deal.uwx.md --josn` (typo) | exit 0, `OK` | exit 1 |
| `init x.uwx.md` | exit 0, writes `new-deal.uwx.md` | exit 1, names `--output` |

4.2.0's `validate` usage advertised `--stage`, and Format spec §6.2 still
shows `uwmd validate <file> [--stage <stage>]`. Refusing an advertised
invocation is a breaking change to core's CLI surface.

The only non-major path would ship the fixes without #328: revert it on a
release branch and ship 4.2.1. This is not recommended. #328 is itself
launch hardening: on 4.2.0, a mistyped `--document-signture` still exits 0
with `OK`.

### 3.2 Fixes

| Check | `@uwmd/cli@4.2.0` | Candidate |
|---|---|---|
| `verify` on `examples/verification/deal.wrong-cap-rate.uwx.md` (D-01) | `✓ OK`, exit 0, on every Node version tested | `✗ FAIL`, exit 1 |
| `verify` on the valid `deal.uwx.md` | `OK`, exit 0 | `OK`, exit 0 |
| `package verify` on `standalone-demo.uwpkg.zip` (D-10) | `UNVERIFIABLE`, exit 0 | `VERIFIED`, exit 0 |
| `uwmd-report deal.uwx.md --format html` | `deal.uwx.report.html` | `deal.report.html` |
| `init --output my-deal.uwx.md` then `validate` (README quick start) | works | works |

Exit-code changes a pipeline may notice:

- `uwmd verify` now fails a document whose stated metric disagrees with its
  recomputation.
- `package verify` fails a member whose semantic digest is stale.

Both bring the CLI into line with existing normative text, so no new rule is
involved. The 5.0.0 notes should still list them.

## 4. Declared Node runtime compatibility (reproduced)

Every manifest declares `engines.node >=18.0.0`; signing declares
`>=18.4.0`. CI tests Node 20 and 22, with Windows on Node 20, and
`release.yml` builds on Node 22.14.0. Node 18 reached end of life on
2025-04-30 and Node 20 on 2026-04-30.

The published 4.2.0 set and the candidate set were each run under six
runtimes. The commands were:

- CLI: `--version`, `init`, `validate`, `verify`, `receipt issue/verify`;
- the four `examples/verification/` scripts;
- `uwmd-excel`, `uwmd-report`, and a `@uwmd/lake` import.

| Runtime | verify, core, CLI (non-signing), batch, lake, Excel | `@uwmd/signing` | `@uwmd/report` |
|---|---|---|---|
| 18.0.0 | pass | **fails**: key generation `SIG_ALGORITHM_UNSUPPORTED` | **fails**: exit 1 |
| 18.20.8 | pass | **fails**: `SIG_NO_CRYPTO` for `sign-document` and `verify --document-signature` | **fails**: exit 1 |
| 20.0.0 | pass | pass (prints a runtime warning) | pass |
| 20.20.2, 22.23.3, 24.21.0 | pass | pass | pass |

The published 4.2.0 set and the candidate behave the same on every row.

- **N-1, report.** `@uwmd/report` depends on `playwright-core ^1.49.0`,
  which now resolves to 1.64.1 (`engines >=20`). On Node 18 it exits 1 with
  "Playwright requires Node.js 20 or higher" before any output, including
  `--format html`. A scan of every package's production dependency tree finds
  no other dependency above Node 18.
- **N-2, signing (D-06).** On Node 18.20.8 without a flag, `globalThis.crypto`
  is absent. `sign-document` and `verify --document-signature` therefore fail
  with `SIG_NO_CRYPTO`, whose message says the package "needs Node >= 18.4"
  (`packages/uwmd-signing/src/algorithms.ts:74`). The comment at line 65
  ("a global from 18.0") is also wrong. With
  `--experimental-global-webcrypto`, verification succeeds. The signing
  README already states Node 20+.

Neither is a normative question. The supported floor is an owner decision.
Options:

- **(a)** Declare what was measured: report and signing `>=20`, the rest
  `>=18`. Also correct the signing message and comment.
- **(b)** A project-wide floor of 20 or 22, since 18 and 20 are both past end
  of life.

(a) only documents existing behavior and fits a patch. (b) drops runtimes
that work today, and some consumers treat that as breaking. Whichever is
chosen, wiki 11's "Node `>=18`" and the package READMEs follow it. Node 24 is
tested locally only. Adding it to the CI matrix is a maintainer change
outside this assessment.

## 5. Gates on the candidate tree

Run on Linux, Node 24.21.0, after `npm ci` and `npm run build` in a clean
worktree of `8203f00c`:

| Gate | Result |
|---|---|
| `verify-versions`, `verify-lockfile`, `verify-indexes`, `verify-codes` (277 codes), `validate-schemas` (62), `verify-packages`, `release:check` | pass |
| `npm run verify-release` | pass. No dependency set changed since `v4.2.0`, so nothing is flagged yet |
| `node scripts/verify-release.mjs --tag v5.0.0` | fails with 3 expected problems: the manifests still say 4.2.0, `[Unreleased]` is not empty, and `[4.2.0]` carries `### Released` in a tree that would be tagged 5.0.0. These are the preparation's work |
| `npm run typecheck:tests`, `npm run lint` | pass (one pre-existing Biome warning in `tools/docs-site`) |
| `npm test` | 4,112 tests in 182 files, all pass |
| `npm run conformance` | 1,089 pass, 0 fail |
| `npm run gen-conformance-cases -- --check` | 350 case files current |
| `npm run examples:verification` | 5 pass |
| `npm run docs:build` | pass (after installing `tools/docs-site`) |
| Portable driver, `--no-skip`, against the candidate tarball CLI | 350/350 |
| Portable driver, `--no-skip`, against published `@uwmd/cli@4.2.0` | 350/350 |

**Conformance coverage gap.** The published 4.2.0 CLI passes all 350
portable cases although it reports `OK` for a wrong stated metric (D-01) and
never verifies a package semantic digest (D-10). No portable case exercises
either behavior through a delivered CLI. The reference runner and the
CLI-level tests from #332 and #334 do cover them.

Adding portable cases would pin existing normative behavior (Protocol §II.2
item 2, RFC 0018), not change any expected result. Whether to add them before
the release is the owner's call.

## 6. Consumer checks

- **Candidate set.** All eight candidate tarballs were installed together
  into an empty directory. `uwmd --version` reports core 4.2.0, verify 0.2.0,
  Protocol 4.1.0 and Format 3.0. The versions are not bumped, which is
  expected.
- **CLI and examples.** The §3 and §4 runs used this install.
- **Signing.** Sign and verify with a throwaway Ed25519 key gives
  `Document snapshot authentication: verified`, exit 0, on Node 20 and later.
- **Carried over from 4.2.0.** These archives are unchanged: verify and batch
  entirely, plus core's library declarations and browser entry. So the
  isolated-consumer results recorded for 4.2.0 still apply: `@uwmd/verify`
  alone under strict TypeScript, browser-safe imports, and batch and lake
  without core.
- **Not run locally:** Windows (CI covers it on Node 20).

## 7. Release-gating and non-gating findings

| Finding | Status | Gates the release? |
|---|---|---|
| D-01, D-02, D-04, D-10, report name | Fixed on `main`, verified against packed tarballs | Fixed. Publication is what closes D-01 for users |
| #328 CLI breaks | Verified | Determines the major (§3.1) |
| N-1 report on Node 18, N-2 signing on Node 18 | Reproduced on published and candidate | Yes: the manifests declare support that does not hold. Fix the metadata in the preparation once the floor is decided |
| D-07 Format Part VI shows `validate --stage` | Verified | Yes: 5.0.0 refuses an invocation the spec text shows. Decide normativity first |
| D-09 compaction versus `POL-02`; dangling `parent_hash` | Normative, draft RFC 0085 | Not by this release: nothing in it changes that behavior. Whether it blocks *launch* is separate (audit §11) |
| Portable coverage gap (§5) | Verified | Owner's call |
| Lake README-only republish | Verified | No |

RFC 0085 now records the owner's provisional direction (§10 of the RFC). It
says complete historical records stay the verifiable authority and
history-stripped outputs are projections. It is a preference, not a
decision; the RFC stays a draft and is not implemented.

## 8. Documentation the preparation must update

- **`CHANGELOG.md`:** a `## [5.0.0]` section with every `[Unreleased]` entry,
  leaving `[Unreleased]` empty. Add an upgrade note listing the refused
  invocations in §3.1 and the exit-code changes in §3.2. Also remove the
  stray blank line inside `### Fixed`.
- **`VERSIONS.md`:**
  - a 5.0.0 paragraph and matrix: core/CLI 5.0.0, signing, Excel and report
    as decided, verify, batch and lake unchanged, Protocol 4.1.0, Format 3.0;
  - the "pairs with `@uwmd/core`" notes;
  - the pinning examples that name 4.2.0.
- **Pairing statements:** wiki 13, `ROADMAP.md`, `docs/TOOLS.md`, wiki 02,
  wiki 10 and the tools' matrix notes.
- **Node floor:** wiki 11's "Node `>=18`", the signing and report READMEs and
  `engines`, as decided in §4.
- **Format spec Part VI** (§6.2 `--stage`, §6.4, §6.5): only after the D-07
  decision. It is under `spec/`, so it is not edited editorially here.
- **`docs/releases/5.0.0-preparation.md`**, later followed by the publication
  record. Use the 4.2.0 records as the template.

## 9. Owner-controlled prerequisites

In order. None of them has been done.

1. Decide the version plan (§1), the Node floor (§4) and D-07 (§8).
2. Authorize a preparation PR: manifests, pins, the two literals, `engines`,
   the records in §8 and `5.0.0-preparation.md`.
3. Merge it with CI green, then wait for `main`'s push CI on the merge
   commit.
4. On the merge commit, `node scripts/verify-release.mjs --tag v5.0.0` must
   pass.
5. Confirm on npmjs.com that the trusted publishers for core, CLI, signing,
   Excel and report still name `UWMD-OSP/UW-Markdown` and `release.yml`. No
   new package name joins, so no bootstrap is needed.
6. Authorize and push the annotated `v5.0.0` tag. `release.yml` then
   re-verifies, builds, tests, runs conformance and publishes, skipping
   versions already on npm.
7. After publication, reconcile: registry versions, provenance, the portable
   driver against the published CLI, isolated consumers, VERSIONS.md, wiki 13
   and `docs/releases/5.0.0-publication.md`.

Account-side items outside the repository:

- registering a placeholder for the unscoped `uwmd` npm name;
- the Vercel free-tier deployment quota, which has rate-limited every PR
  preview today and could delay a docs deployment on release day.

## 10. Unresolved owner decisions

**Gating the release:**

1. Authorize the plan in §1: core/CLI 5.0.0, signing 0.5.1 or 0.6.0, Excel
   0.9.19, report 0.8.31; verify, batch and lake unchanged. The alternative
   is a 4.2.1 without #328 (§3.1).
2. The Node floor: (a) per-package as measured, or (b) project-wide (§4).
3. D-07: whether Format Part VI is normative, and so how its `--stage`
   example is corrected.

**Not gating the release:**

- portable cases for stated metrics and package digests (§5);
- republishing lake for its README;
- Node 24 in CI;
- the earlier owner items in audit §11: the `semanticDigestOf` default in
  `@uwmd/verify`, the Lite member digest canonicalization, the
  `blank-*.uw.md` URLs, starter §V.8, the scope of `uwmd verify`;
- RFC 0085's design direction, and whether D-09 and the dangling-`parent_hash`
  gap block launch.
