# Interim 4.x integration and release preparation

## Current integration and preparation (2026-10-15)

Codex owns integration and release preparation under explicit owner instruction.
The [4.3.0 preparation record](4.3.0-preparation.md) and PR351 supersede PR342's
old package proposal. PR350 merged `8099d55d`, PR347 merged `d452d0f5`, and PR348
merged `65a55a80`, each after all14 required CI jobs passed on its exact final
head. The prior Phase1 conclusion did not cover these subsequently demonstrated
implementation defects. M04/M09 still require semantic decisions; RFC0085/86/87
remain drafts and PR349 remains held.

The revised matrix is core/CLI4.3.0, verify0.2.1, signing0.6.0, batch0.9.2,
Excel0.9.19, report0.9.0 and lake0.3.2. Verify now changes, so both batch and lake
repin and release; all dependents carry exact pins. The receipt engine identity
and its five designated identity fixtures move under the existing contract.
Format3.0, Protocol4.1.0 and financial definitions remain unchanged. The accepted
#346 CLI compatibility assessment below still applies.

Public npm reads from the existing CI release-record job independently observed
all eight published versions at the4.2.0 generation on2026-10-15T15:33:35Z,
with gitHead `238dbf35`. Local GitHub/npm DNS failures remain failures, not
publication evidence. The preparation record keeps the new validation results
separate from prior successful CI and local subprocess failures. Tags, npm
publication, production deployment and account changes require separate owner
authorization. No5.0 preparation is authorized.

## Previous candidate assessment (historical; version proposal superseded)

#### Previous candidate: compatibility decision required

Drafted **2026-10-15**, then revised twice that day after owner review and
after the compatibility implementation (#346). Current against `main` at
`c4d50dbe`. This record is a candidate,
not a release preparation. It changes no manifest, version literal or
lockfile, and authorizes no tag or publication.

### Why this replaces the 5.0.0 preparation

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

### Owner review (2026-10-15)

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

### What 4.2.0 documented

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

### Owner approval and implementation (2026-10-15)

The owner approved a bounded 4.3.0 compatibility implementation. This is a
scoped compatibility decision for this release, not a blanket
reinterpretation of semver:

- **Strict rejection stays.** Unknown and misspelled flags still fail before
  the command runs.
- **`validate --stage` is restored as deprecated.** It warns and reports
  readiness from the existing `stage_readiness`. It does not turn
  `stage_readiness: false` into a validation failure, and it does not
  change `validate`'s exit semantics.
- **`export --compact` and `compose --parts`** are restored as deprecated
  aliases; contradictory `compose` directories are refused.
- **`init <name>`** stays refused.
- **D-01 and D-10** are kept.

PR #346 implements this and merged at `c4d50dbe`. The behavior below was
demonstrated on that code, not projected.

**Reconciliation with Format §2.2 and Part V.** §2.2 fixes the seven
`deal_stage` values. §5.1 requires validators to compute `stage_readiness`,
and reports gaps only for the *declared* stage, as `DQ-06` info,
"reportable but not refusable". A report-only `--stage` therefore adds no
rule and no issue. No normative ambiguity was found, so nothing needed
escalating.

### Compatibility matrix (demonstrated)

Published `@uwmd/cli@4.2.0` and the packed tarballs of `main` at
`c4d50dbe` were each installed in an empty directory and run on the same
inputs.

| Invocation | Published 4.2.0 | Candidate (`main`) | Documentation | Release impact |
|---|---|---|---|---|
| `verify` with a wrong stated metric (D-01) | `OK`, exit 0 | `FAIL`, exit 1, `stated_metrics` | CHANGELOG Fixed | Conformance fix (Protocol §II.2 item 2) |
| `package verify` demo / stale semantic digest (D-10) | `UNVERIFIABLE` 0 / `UNVERIFIABLE` 0 | `VERIFIED` 0 / `FAILED` 1 (`PKGVER-003`) | CHANGELOG Fixed | Conformance fix (RFC 0018) |
| `verify --document-signture` / `--signign` / `--integrty` | `OK`, exit 0 | refused before running, exit 1 | CHANGELOG Changed; wiki 08 | Undeclared input refused (safety fix) |
| `validate --stage closing` (document not ready for closing) | `CLEAN`, exit 0 | `CLEAN`, exit 0. Deprecation warning on stderr; report line "Requested with --stage closing: incomplete (reported only…)" | CHANGELOG Deprecated; Format §6.2; wiki 08; help | Compatible |
| `validate --stage closing --json` | JSON, exit 0 | stdout identical; readiness line on stderr | same | Compatible |
| `validate --stage underwriting` (not a `deal_stage`) | `CLEAN`, exit 0 | exit 1, lists the seven stages | same | Misleading input refused |
| `validate <document with errors> --stage scope` | `ERRORS`, exit 1 | `ERRORS`, exit 1, plus warning | same | Compatible |
| `validate --strict` | `CLEAN`, exit 0 (never read) | exit 1, unknown flag | CHANGELOG | Undeclared input refused |
| `export --compact` | history dropped | byte-identical output (`generated_at` aside), plus warning | CHANGELOG Deprecated; help | Compatible |
| `compose --parts frags` | 3 fragments in `./parts`, none in `frags/` | 3 in `frags/`, none in `./parts`, plus warning | CHANGELOG Deprecated; help corrected | The documented option now does what it said |
| `compose --parts a --out-dir b` | wrote to `b`, exit 0 | exit 1, nothing written | CHANGELOG Deprecated | Contradiction refused |
| `init my-deal.uwx.md` | wrote `new-deal.uwx.md`, exit 0 | exit 1, names `--output` | README fixed (#333); CHANGELOG | Undeclared input refused |
| `init --output my-deal.uwx.md` | exit 0 | exit 0 | — | Unchanged |

Tests in #346 pin each row except the published-4.2.0 column:

- **Unit:** `DEPRECATED_FLAGS` is pinned to exactly the three flags and kept
  out of usage strings.
- **CLI (13 new cases, spawning the real binary):** every compatibility case
  above, plus nine misspelled verification, signing and integrity flags
  across five commands, and deprecated names refused on other commands.
- **Gates on #346 (local, Node 24):** all pass, including `npm test`
  (4,133 tests in 183 files) and conformance 1,089/0. GitHub Actions: all 14
  checks pass; Vercel was rate-limited.

### Is core/CLI 4.3.0 defensible?

**Yes, under the owner's scoped compatibility decision.** Every invocation
4.2.0 declared and that functioned either behaves as before, or now does
what its documentation said:

- `validate --stage` keeps its result and exit status and adds a readiness
  report;
- `export --compact` keeps its output;
- `compose --parts` writes where documented.

Every change in exit status falls into one of these groups:

- **Wrong success corrected:** D-01 and D-10, as the standard requires.
- **Misleading input refused:** a value that is not a `deal_stage`, and
  contradictory `compose` directories.
- **Undeclared input refused:** misspelled flags, `validate --strict` and a
  positional `init` argument. None of these was a functioning public
  contract.

The additions are deprecation notices, the readiness line and the
`stated_metrics` JSON member. That makes a minor:

| Package | Published | Interim |
|---|---|---|
| `@uwmd/core`, `@uwmd/cli` | 4.2.0 | **4.3.0** |
| `@uwmd/signing` | 0.5.0 | **0.6.0** (Node `>=20`, a 0.x breaking change; pins core 4.3.0) |
| `@uwmd/report` | 0.8.30 | **0.9.0** (Node `>=20`; output-name fix; pins core 4.3.0) |
| `@uwmd/excel` | 0.9.18 | **0.9.19** (repins core 4.3.0) |
| `@uwmd/verify`, batch, lake | 0.2.0, 0.9.1, 0.3.1 | unchanged, not republished |

Format 3.0 and Protocol 4.1.0 stay where they are, and 5.0 stays reserved.

**Residual risk, named in the upgrade notes.** A script that passed a flag
4.2.0 silently ignored now exits 1. The owner chose this deliberately for
verification safety.

**The maintenance branch is not needed.** Its only advantage was avoiding
the classification question, which the owner has now decided for this
release. It would also have left misspelled security flags silently
accepted in the 4.x line.

**The financial audit (#343, PR #345)** found no release-blocking financial
implementation defect. Its open items (M04, M09) need RFCs, so none is
waiting to join this release.

### Remaining owner decisions

1. **Authorize the 4.3.0 release preparation** at the versions above. That
   is a one-commit release-prepared PR under wiki 11: manifests, pins,
   literals, lockfile, CHANGELOG `[4.3.0]`, records, and tag mode for
   `v4.3.0`. Tagging and publication need separate authorization.
2. **Removal timing.** The deprecated spellings say they "will be removed in
   a future major release". Whether that is at 5.0 belongs to the pending
   launch versioning policy (ROADMAP), so it is not asserted here.

### Draft upgrade notes (for 4.3.0)

- **`uwmd` refuses unknown and misspelled flags with exit 1,** naming the
  flag and the accepted ones. 4.2.0 ignored them, so a misspelled
  verification or signing flag looked like a passed check.
- **Deprecated, still accepted:**
  - `validate --stage <deal_stage>` reports that stage's readiness. It does
    not change the result or exit status, and a value outside the seven
    stages exits 1.
  - `export --compact` means `--no-superseded`.
  - `compose --parts <dir>` means `--out-dir <dir>`; contradictory values
    exit 1.
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

### Verification evidence carried from the 5.0.0 preparation

This evidence was measured on `431740d8`. Its code is identical to `main` at
`79d4c92e`; only the version numbers and release records differ. The three
deprecated paths were added afterwards by #346. Their checks are in the
matrix above, measured on `c4d50dbe`.

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

### Next steps

1. The owner authorizes the 4.3.0 release preparation, or not.
2. If authorized: a release-prepared commit (wiki 11, state 2), with tag
   mode `v4.3.0`, the full gates and the isolated consumer checks re-run on
   it.
3. Tagging and publication only on separate explicit owner authorization.
