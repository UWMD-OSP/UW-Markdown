# Interim 4.x release candidate: compatibility decision required

Drafted **2026-10-15** and revised after owner review the same day, on `main`
at `e8ed8eb6`. This record is a candidate,
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

## Owner review (2026-10-15)

The owner did not approve the first Option A. Turning unknown flags back
into warnings would let a misspelled or unsupported security-sensitive flag
succeed again. The owner directed a modified evaluation:

- **Unknown and misspelled flags** stay strictly refused.
- **Documented flags, undocumented aliases and ignored positionals** are
  classified separately; a historical exit 0 is not automatically a
  contract.
- **`validate --stage` and `export --compact`** keep honest, compatible
  behavior through narrow deprecated options if that is possible.
- **`init <name>`:** determine whether it was ever a contract.
- **D-01 and D-10** keep their failure detection and exit codes.
- **Version check:** decide whether the result can honestly ship as 4.3.0.
  If not, evaluate a 4.x maintenance branch.

The first Option A, and the B and C of the previous revision, are
withdrawn in favor of the analysis below.

## What 4.2.0 documented

The question is which `uwmd` invocations 4.2.0 declared as its interface.
The audit covered:

- 4.2.0's `--help` text (Commands and Options);
- every `Usage:` string in its `cli.ts`;
- the GitHub README, the `@uwmd/cli` and `@uwmd/core` READMEs and wiki 08;
- Format spec Part VI, all at `v4.2.0`.

It matched these against `main`'s `COMMAND_FLAGS` and against which flags
each 4.2.0 command actually read.

- **99 documented (command, flag) pairs.** `main` accepts all but three. One
  of those, `modules --tier`, is a false positive: both `modules`
  subcommands accept it.
- **`validate --stage`** is in `validate`'s usage string
  (`uwmd validate <file> [--stage <stage>] [--institution <config.json>]
  [--json]`) and in Format §6.2. 4.2.0's `cmdValidate` never read it. Only
  `init` reads `--stage`.
- **`compose --parts`** is in `--help`'s option list ("Fragment directory
  (compose, resolve, --resolved)"). `compose`'s own usage string offers
  `--out-dir`, and 4.2.0's `cmdCompose` read only `--out-dir`. So
  `compose --parts X` exited 0 and wrote the fragments to `./parts`, not `X`.
- **`export --compact`** appears in no help text, usage string or doc. 4.2.0's
  `cmdExport` treated it as `--no-superseded`: an undocumented, working
  alias.
- **`validate --strict`** is not documented for `validate`. The help line
  for `--strict` names no command, and only `parse` read it, which `main`
  still accepts.
- **`init <name>`** never appears in the CLI's help, its usage string or the
  `@uwmd/cli` README, which all say `init [--output <file>]`. Only the GitHub
  README quick start showed `npx @uwmd/cli init my-deal.uwx.md`, from
  2026-08-13 until #333 corrected it. The CLI ignored the argument and wrote
  `new-deal.uwx.md`. The quick start's next step, `validate my-deal.uwx.md`,
  therefore exited 1: the documented workflow never worked end to end. This
  was a README defect, not a CLI contract.

## Compatibility matrix

The proposed 4.3.0 keeps strict rejection and adds three narrow deprecated
behaviors. A success is "misleading" when it reports something that did not
happen.

| Invocation | Published 4.2.0 | `main` | Proposed 4.3.0 | Documentation obligation | Release impact |
|---|---|---|---|---|---|
| Unknown or misspelled flag on any command (e.g. `verify --document-signture=x`) | Ignored; `OK`, exit 0. A misleading success for security flags | Exit 1, names the flag and the accepted ones | **As `main`** | CHANGELOG upgrade note (exists) | Undeclared input refused; a safety fix, not a contract break |
| Correctly spelled security flags (`--signing`, `--keystore`, `--document-signature`, `--integrity`, `--policy`, `--key`, `--capability-token`) | Accepted | Accepted | **Unchanged** | none | none |
| `validate --stage <s>` | Documented; ignored; exit by validation alone, whatever the readiness for `s` | Exit 1, unknown flag | **Deprecated, narrow.** `s` must be a `deal_stage`; another value exits 1. If `stage_readiness[s]` is false, exit 1 with "not ready for `s`", reported as readiness, not as a validation failure. Otherwise the result is 4.2.0's, plus a deprecation warning. | Usage string and help mark it deprecated; Format §6.2's "there is no `--stage` option" (from #340) is corrected editorially; wiki 08; CHANGELOG deprecation | Changes the outcome only where 4.2.0's exit 0 was misleading (the D-01 class). It uses the normative `stage_readiness` computation (Format stage table, RFC 0028); no new rule |
| `export --compact` | Undocumented alias of `--no-superseded`; worked | Exit 1, unknown flag | **Deprecated alias of `--no-superseded`** with a stderr warning | CHANGELOG deprecation; help | Fully compatible |
| `compose --parts <dir>` | Documented in help; ignored; fragments go to `./parts` (misleading) | Exit 1, unknown flag | **Deprecated alias of `--out-dir`.** Exit 1 if both are given and differ | Correct help's `--parts` annotation; CHANGELOG | Changes the outcome only where 4.2.0 was misleading |
| `validate --strict` | Not documented for `validate`; ignored | Exit 1 | **As `main`** | CHANGELOG | Undeclared input refused |
| `init <name>` | Ignored; writes `new-deal.uwx.md`, exit 0. Shown only in the GitHub README example, which never worked | Exit 1, names `--output` | **As `main`** | README fixed in #333; CHANGELOG upgrade note (exists) | Undeclared input refused; never a working contract |
| `verify` with a wrong stated metric (D-01) | `OK`, exit 0 | `FAIL`, exit 1, `stated_metrics` | **As `main`** | CHANGELOG (exists) | Conformance fix (Protocol §II.2 item 2) |
| `package verify` with a stale semantic digest (D-10) | `UNVERIFIABLE`, exit 0 | `FAILED`, `PKGVER-003`, exit 1. An uncomputable digest stays `UNVERIFIABLE`, exit 0 | **As `main`** | CHANGELOG (exists) | Conformance fix (RFC 0018) |

**Implementation cost (not started).** It touches:

- `COMMAND_FLAGS`: `stage` for `validate`, `compact` for `export`, `parts`
  for `compose`;
- three handlers in `cli.ts`, plus a deprecation-warning helper;
- the tests that pin those three refusals: 4 references in
  `cli-args.test.ts` and 1 in `cli.smoke.test.ts`;
- new CLI tests for each deprecated path, including `--stage` ready, not
  ready and unknown;
- the documentation in the matrix.

The unknown-flag refusal and its tests stay as they are.

## Can it ship as 4.3.0?

**Yes, on one stated principle the owner should confirm.** Under semver per
surface, the CLI's public interface is what 4.2.0 declared: its help, usage
strings, READMEs and spec text. Under the proposal:

- every declared invocation either behaves as in 4.2.0, or changes only
  where 4.2.0 reported a success that was not true;
- input 4.2.0 never declared is refused (misspelled flags, `validate
  --strict`, a positional `init` argument).

The first is the same class of correction as D-01 and D-10. The second is a
defect fix, not removed API. That makes the generation a minor:

| Package | Published | Interim |
|---|---|---|
| `@uwmd/core`, `@uwmd/cli` | 4.2.0 | **4.3.0**. New: deprecation notices and the `stated_metrics` JSON member, beside the fixes |
| `@uwmd/signing` | 0.5.0 | **0.6.0** (Node `>=20`; pins core 4.3.0) |
| `@uwmd/report` | 0.8.30 | **0.9.0** (Node `>=20`; output-name fix; pins core 4.3.0) |
| `@uwmd/excel` | 0.9.18 | **0.9.19** (repins core 4.3.0) |
| `@uwmd/verify`, batch, lake | 0.2.0, 0.9.1, 0.3.1 | unchanged, not republished |

Format 3.0 and Protocol 4.1.0 stay where they are, and 5.0 stays reserved.

**Residual risk, flagged.** A script that passed a flag 4.2.0 silently
ignored will exit 1. The upgrade notes name this; it is the safety property
the owner asked to keep.

If the owner instead treats every historical exit 0 as contract, this
cannot be 4.3.0. In that case only the maintenance branch below can ship an
interim release.

**`init <name>` alternative.** If the owner considers the README example
binding, honoring the argument as the output name is also honest and
compatible. It writes the file the README promised; with `--output` present
and different, it exits 1. Recommended instead: keep the refusal. The CLI
never declared the argument, and the refusal names `--output`.

## Fallback: a 4.x maintenance branch

This branch would be cut from `v4.2.0` as `release/4.x`. It would backport
the correctness fixes and leave the strict CLI changes on `main` for the 5.0
launch.

- **Backport:**
  - D-01 (`verify` stated metrics) and D-10 (`package verify` digests);
  - D-04 messages;
  - the report output name;
  - the Node floors (#339);
  - the D-01/D-10 regression tests.
- **Versions:** 4.2.1 for core/CLI if the backport is fixes only. Signing
  0.6.0, report 0.9.0 and Excel 0.9.19 as above.
- **Costs:**
  - #332's `verify` change sits on top of #328's edits to `cli.ts`, so the
    cherry-picks need hand resolution;
  - the branch needs its own CHANGELOG section, and a `[4.2.1]` record
    reconciled back onto `main` so `verify-release` still matches tags;
  - `release.yml` publishes from any tagged commit, but no tag has come from
    a branch before.
- **The decisive drawback:** the branch would keep 4.2.0's silent acceptance
  of misspelled security flags, because the refusal is the #328 change it
  leaves out. It does not reintroduce the defect, but it leaves it unfixed
  in the interim line. Backporting #328 to fix it brings back the same
  classification question as above.

**Recommendation.** Ship the modified 4.3.0 from `main`. Use the maintenance
branch only if the owner rejects the classification principle.

## Questions for the owner

1. **Confirm the principle:** declared 4.2.0 interface = contract;
   undeclared, silently ignored input may be refused in a 4.x minor.
2. **Approve the three deprecated behaviors:**
   - `validate --stage` as a readiness gate;
   - `export --compact` as an alias;
   - `compose --parts` as an alias of `--out-dir`.

   Or name any to drop.
3. **`init <name>`:** keep the refusal (recommended), or honor it as the
   output name.
4. **Authorize the implementation PR.** The release preparation comes after
   it.

## Draft upgrade notes (for the interim generation)

- **`uwmd` refuses unknown and misspelled flags with exit 1,** naming the
  flag and the accepted ones. 4.2.0 ignored them, so a misspelled
  verification or signing flag looked like a passed check.
- **Deprecated, still accepted** (removal planned for 5.0):
  - `validate --stage <deal_stage>` now exits 1 when the document is not
    ready for that stage;
  - `export --compact` means `--no-superseded`;
  - `compose --parts <dir>` means `--out-dir <dir>`.
- **`uwmd init` takes no file argument.** Use `--output my-deal.uwx.md`.
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
for the proposed 4.3.0 except for the three deprecated paths, whose CLI
checks are re-run on the implementation.

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
  `init x.uwx.md` and `verify --josn` each exit 1. Under the proposal, the
  first two change to the deprecated behaviors.
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

1. The owner answers the four questions above.
2. An implementation PR for the deprecated behaviors, with CLI tests, then a
   re-run of the CLI and consumer checks.
3. A release-prepared commit for 4.3.0 (wiki 11, state 2), with tag mode
   re-run on it.
4. Tagging and publication only on explicit owner authorization.
