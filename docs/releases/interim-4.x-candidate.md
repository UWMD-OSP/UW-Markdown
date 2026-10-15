# Interim 4.x release candidate: compatibility decision required

Drafted **2026-10-15** on `main` at `79d4c92e`. This record is a candidate,
not a release preparation. It changes no manifest, version literal or
lockfile, and authorizes no tag or publication.

## Why this replaces the 5.0.0 preparation

PR #342 first prepared the generation on `main` as core/CLI **5.0.0**: commit
`431740d8`, kept on branch `backup/release-5.0.0-preparation-431740d8`. That
numbering followed semver from the CLI breaks below.

On 2026-10-15 the owner directed otherwise ([ROADMAP](../../ROADMAP.md),
"Reserved milestone"):

- **5.0 is reserved for the coordinated public launch.** It is not for a
  routine release, even one with CLI breaking changes.
- **Interim 4.x releases continue** under the current policy, applied
  honestly.
- **A break that would ordinarily need a major is flagged** with
  alternatives, not mislabeled.

So the next interim generation cannot ship as 5.0.0. It cannot ship as a 4.x
minor with the breaks either. This record states the breaks, the
alternatives and their exact versions. The engineering and verification
evidence from the 5.0.0 preparation still applies to the code and is kept
below.

## The compatibility issue

`main` since `v4.2.0` contains the following changes. Every one was
reproduced against published `@uwmd/cli@4.2.0` and the packed candidate (see
the [readiness assessment](https://github.com/UWMD-OSP/UW-Markdown/blob/main/docs/reviews/2026-10-14-next-release-readiness.md)
§3).

| Change | 4.2.0 behavior | `main` behavior | Classification |
|---|---|---|---|
| Closed flag vocabulary (#328) | Unknown flags ignored, exit 0. `validate --stage` advertised in its usage string; `export --compact` an alias of `--no-superseded` | Exit 1 before any work, naming the flag | **Breaking.** It refuses invocations 4.2.0 accepted and, for `--stage`, advertised. Under semver it needs a core major. |
| `init` file argument (#332, D-02) | Ignored; writes `new-deal.uwx.md`, exit 0 | Exit 1, names `--output` | **Breaking** in the same sense: a command that succeeded now fails. |
| `verify` stated metrics (#332, D-01) | Never checked; a wrong stated cap rate printed `OK`, exit 0 | `FAIL`, exit 1; `--json` adds `stated_metrics` | **A conformance fix.** Protocol §II.2 item 2 already requires it, so this is not a new rule. **Flagged**, because a pipeline that passed a wrong document now fails. |
| `package verify` semantic digests (#334, D-10) | Every stated digest `unverifiable`, exit 0 | Stale digest: `PKGVER-003`, exit 1 | **A conformance fix** against RFC 0018. Flagged for the same reason. |
| Missing-signing messages (#332, D-04) | Raw resolver error | Actionable message, same exit code | Fix. |
| `uwmd-report` output name (#336) | `deal.uwx.pdf` | `deal.pdf` | Fix. It ships in a 0.x minor anyway. |
| Signing and report `engines.node >=20` (#339) | `>=18.4.0` / `>=18.0.0` (both already failed on Node 18) | `>=20.0.0` | **Breaking for two 0.x packages.** A minor is the honest label: signing 0.6.0, report 0.9.0. Not affected by the 5.0 reservation. |

Core's library API is unchanged: `dist/index.d.ts` and the browser entry are
byte-identical to 4.2.0. Only the CLI (core's bin and `./cli` export) breaks.
Format 3.0 and Protocol 4.1.0 do not move.

## Alternatives (owner decision)

Each alternative keeps 5.0 unused and labels every change honestly.

### A. Make the refusals compatible; ship 4.3.0 (recommended)

Change the two CLI refusals so that 4.2.0 invocations behave as they did and
the problem becomes visible:

- **Unknown flags.** Print a warning on stderr naming the flag and the
  accepted ones, then continue with 4.2.0's exit code.
- **`export --compact`.** Restore it as a deprecated alias of
  `--no-superseded`. Warning and ignoring it would silently change the
  output.
- **`validate --stage`.** Warn that it is ignored, which it always was.
- **`init <name>`.** Warn and keep 4.2.0's behavior: write `new-deal.uwx.md`,
  and still refuse to overwrite.
- **At the 5.0 launch.** The refusals return as part of the coordinated
  breaking-change set.

D-01, D-04, D-10, the report fix and the Node floors ship unchanged.

| Package | Published | 4.3.0 generation |
|---|---|---|
| `@uwmd/core`, `@uwmd/cli` | 4.2.0 | **4.3.0** (additive: warnings, the `stated_metrics` member and the conformance fixes) |
| `@uwmd/signing` | 0.5.0 | **0.6.0** (Node `>=20`; pins core 4.3.0) |
| `@uwmd/report` | 0.8.30 | **0.9.0** (Node `>=20`; output-name fix; pins core 4.3.0) |
| `@uwmd/excel` | 0.9.18 | **0.9.19** (repins core 4.3.0) |
| `@uwmd/verify`, batch, lake | 0.2.0, 0.9.1, 0.3.1 | unchanged, not republished |

- **Cost.** An implementation PR before preparation. It switches the gate in
  `cli-args.ts` and `cli.ts` from refuse to warn, restores the `--compact`
  alias, and rewrites the tests that assert exit 1: 5 in `cli-args.test.ts`
  and 8 in `cli.smoke.test.ts`. It also updates the #328 and #332 CHANGELOG
  entries and Format §6.2's "there is no `--stage` option".
- **Trade-off.** A misspelled security flag such as `--document-signture`
  warns but no longer fails until 5.0. 4.2.0 did not even warn.
- **Optional variant.** An environment variable that opts into the strict
  refusal. It would add a public surface, so it is not recommended without
  an owner decision.

### B. Leave the refusals out of the interim release; ship 4.3.0

Revert #328 and the `init` refusal from #332 on `main`, release the rest as
4.3.0, and re-land both for the 5.0 launch. The versions are the same as A.

- **Cost.** Two reverts, their tests removed, and a re-land later.
- **Trade-off.** Users get no warning in the meantime, so this is weaker than
  A.
- **Variant B′.** A `release/4.x` maintenance branch cut from `v4.2.0`, with
  the fixes cherry-picked as 4.2.1 or 4.3.0. It leaves `main` untouched, but
  the cherry-picks conflict with #328's edits to `cli.ts`, and the branch's
  CHANGELOG has to be reconciled back onto `main`. It carries more release
  process risk.

### C. No interim core/CLI release until the 5.0 launch

Keep `main` as it is and publish nothing until launch. The tag names the
core version, so signing, report and Excel also wait.

- **Cost.** None now.
- **Trade-off.** `@uwmd/cli@4.2.0`, the npm `latest`, keeps printing `OK` for
  a wrong stated metric (D-01), and signing and report keep declaring Node 18
  support they lack.

### Not offered

- **5.0.0.** Reserved for the coordinated public launch.
- **4.3.0 with the refusals as they are.** A breaking CLI change labeled a
  minor is the mislabeling the policy forbids.

### Questions for the owner

1. **A, B, B′ or C?**
2. **Should D-01 and D-10's exit-code changes ship in an interim release?**
   This record treats them as fixes: the standard already requires them, and
   a verifier that exits 0 on a failed check is the defect. The other choice
   is to report the findings with exit 0 until 5.0. That keeps a
   non-conforming verifier published, and is not recommended.

## Draft upgrade notes (for whichever generation ships)

These apply to whichever generation ships. Under A, the first two items
become deprecation warnings.

- **`uwmd` refuses unknown flags with exit 1.**
  - `validate --stage` and `validate --strict` were never read.
  - `export --compact` was an undocumented alias; use `--no-superseded`.
  - A misspelled flag is now an error instead of a silent pass.
- **`uwmd init` takes no file argument.** Use `uwmd init --output
  my-deal.uwx.md`.
- **`uwmd verify` exits 1** when a stated metric disagrees with its
  recomputation (Protocol §II.2 item 2). `--json` adds `stated_metrics`.
- **`uwmd package verify` exits 1** with `PKGVER-003` when a stated semantic
  digest is stale (RFC 0018). A digest it cannot compute stays
  `unverifiable`, exit 0.
- **`uwmd-report deal.uwx.md`** writes `deal.pdf` / `deal.report.html`.
- **Node 20 or later** is required for `@uwmd/signing` (including the CLI's
  `sign-document`, `--signing` and `--document-signature`) and for
  `@uwmd/report`. The other packages keep Node 18.

## Verification evidence carried from the 5.0.0 preparation

This evidence was measured on `431740d8`. Its code is identical to `main` at
`79d4c92e`; only the version numbers and release records differ. It holds
for any of the alternatives except where A or B changes the CLI gate. In
that case the CLI checks are re-run on the new code.

Run locally on Linux, Node 24.21.0:

| Gate | Result |
|---|---|
| `verify-versions`, `verify-lockfile`, `verify-packages`, `release:check`, `verify-indexes`, `verify-codes` (277), `validate-schemas` (62) | pass |
| `node scripts/verify-release.mjs --tag v5.0.0` on that tree | pass. Not valid for any interim version: tag mode is re-run on the actual prepared tree |
| `npm run typecheck:tests`, `npm run lint` | pass (one pre-existing Biome warning) |
| `npm test` | 4,115 tests in 183 files, all pass |
| `npm run conformance` | 1,089 pass, 0 fail |
| `npm run gen-conformance-cases -- --check`, `npm run examples:verification`, `npm run docs:build` | pass |
| GitHub Actions on PR #342 at `431740d8` | all 14 checks pass, Windows Node 20 included |

**Consumer checks.** The eight packages were packed and installed together
into an empty directory.

- **Portable driver:** `--no-skip` gives 350/350.
- **D-01 and D-10:**
  - a wrong stated metric gives `FAIL`, exit 1;
  - the demo package gives `{"status":"verified",…}`, exit 0.
- **Report:** writes `deal.report.html`.
- **Refused invocations:** `validate --stage`, `export --compact`,
  `init x.uwx.md` and `verify --josn` each exit 1. These four results change
  under A or B.
- **Runtime matrix** (Node 18.0.0, 18.20.8, 20.0.0, 20.20.2, 22.23.3,
  24.21.0):
  - every package declaring `>=18` works on Node 18;
  - signing and report fail on Node 18, as their `>=20` floor declares;
  - everything passes on Node 20 and later.
- **Tarball comparison with the published archives:**
  - verify and batch are byte-identical;
  - lake differs in its README only;
  - core differs in `cli*.js`, `version.*`, `package.json` and its README;
    `index.d.ts` and the browser entry are identical.
- **Signing:** no static `node:` import, so it still bundles for a browser.

## Next steps

1. The owner chooses an alternative and answers question 2.
2. Under A or B, an implementation PR, then a re-run of the CLI checks above.
3. A release-prepared commit for the chosen version (wiki 11, state 2), with
   tag mode re-run on it.
4. Tagging and publication only on explicit owner authorization.
