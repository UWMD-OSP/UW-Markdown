# 11 — Build, release & governance

## Monorepo & tooling

- **Package manager:** npm **workspaces** (`packages/*`). No turbo, no pnpm, no
  lerna. Lockfile: `package-lock.json`. Node `>=18`, except
  `@uwmd/signing` and `@uwmd/report`, which declare Node `>=20` (global Web
  Crypto; `playwright-core`).
- **Lint:** Biome 1.9.4 (`biome.json`), lint-only.
- **Tests:** Vitest 3.x per package.
- **Build:** TypeScript `tsc` per package (root `build` fans out via
  `--workspaces --if-present`, in the root `workspaces` order: `uwmd-verify`
  first, then `uwmd-core`, because every other package compiles against one or
  both of their `dist/`).
- **Schema validation:** Ajv 8 + `ajv-formats` (root devDeps).

Root `package.json` scripts:

Script | Does
---|---
`npm run build` | `tsc` across all workspaces
`npm test` | Vitest across all workspaces
`npm run test:coverage` | `@uwmd/verify` then `@uwmd/core` coverage, each against its own floor
`npm run cli -- <cmd>` | Run the CLI from source (`packages/uwmd-cli/bin/uwmd.mjs`)
`npm run conformance` | `scripts/run-conformance.mjs` (every indexed Reader, Verifier, profile and starter-product check by default)
`npm run validate-schemas` | `scripts/validate-schemas.mjs`
`npm run verify-packages` | `scripts/verify-packages.mjs` — what `npm pack` would actually ship
`npm run verify-lockfile` | `scripts/verify-lockfile.mjs` — every `@uwmd/*` reference links to this tree, and cross-package pins match declared versions
`npm run verify-versions` | `scripts/verify-versions.mjs` — the `VERSIONS.md` matrix matches every package manifest (`@uwmd/verify` included) and the `protocol.ts` constants (`packages/uwmd-verify/src/protocol.ts`)
`npm run verify-indexes` | `scripts/verify-indexes.mjs` — the schema/RFC indexes match files on disk, and `CLAUDE.md` stays a pointer to `AGENTS.md`; tests cover automatic RFC discovery and site version metadata, and `scripts/spec-refs.mjs` checks that every `§` target in the Format and Protocol specs, every `spec_ref` in `protocol.ts`, and every spec link into `spec/` or `docs/starter/` resolves
`npm run verify-codes` | `scripts/verify-codes.mjs` — every code an implemented RFC or the format spec promises is one the library (`@uwmd/verify` or `@uwmd/core`) actually emits, and every emitted validation family is registered in protocol §XI
`npm run verify-release` | `scripts/verify-release.mjs` — every CHANGELOG section marked `### Released` has its tag, with no exception, a dated generation's records are final and publication-neutral (`release-state.mjs`), and a publishing package whose dependencies changed since the previous release tag has a new version (it warns between releases and fails when preparing or tagging one); `-- --tag vX.Y.Z` checks the tree as that release
`npm run lint` / `npm run format` | Biome lint / format

> Typical loop after a core change: `npm run build && npm test && npm run
> conformance`. `@uwmd/verify`'s and `@uwmd/core`'s `prepublishOnly` chain
> build + test + conformance + schema validation (core's builds verify first),
> so a publish can't skip them.
>
> The verify-* guards hardcode their workspace lists. A new package passes
> them unchecked unless it is added to each: `verify-lockfile` (which also
> fails when a root workspace is missing from its list), `verify-versions`
> (a matrix row), `verify-packages` (pack and type-check), and
> `release-packages.mjs` with `check-release-readiness.mjs`. `@uwmd/verify`
> was added to all of them in RFC 0083 Phase 2.

## Versioning (semver-per-surface)

Independent versions, tracked in [`VERSIONS.md`](../../VERSIONS.md):
- **Format** — `FORMAT_VERSION` in `protocol.ts` (`@uwmd/verify`; 3.0, RFC 0081) and
  `uw_version` in files. It equals the one member of
  `SUPPORTED_FORMAT_VERSIONS`; a reader refuses every other version.
- **Protocol** — `PROTOCOL_VERSION` in `protocol.ts` (Stable 4.1.0 after
  RFC 0084 shipped and publication was independently verified; published
  core/CLI 4.2.0 pair with it and Format 3.0. Historical core/CLI 4.0.0,
  4.0.1 and 4.1.0 retain Stable Protocol 4.0.0 with Format 3.0,
  core/CLI 3.0.0 retain Stable Protocol 3.0.0 with Format 2.1,
  and 2.21.0 retain Stable Protocol 2.25.0). It equals the one member of
  `SUPPORTED_PROTOCOL_VERSIONS`, and `protocol.test.ts` asserts both labels
  equal their supported sets.
  A test in `protocol.test.ts` asserts it matches the matrix row in `VERSIONS.md`, so the
  two cannot drift apart silently. **Protocol 3.0.0** (RFC 0078) made
  conformance the **Reader** and **Verifier** tiers plus optional profiles.
  **Protocol 4.0.0** (RFC 0081) removes every compatibility clause: the host
  honors only 4.0.0 module ranges, and 3.0.0 is the last release that read
  older formats or honored older module contracts. From 3.0 the Protocol version moves only when what a
  document *means* or how it is *verified* changes (format, verification rules,
  receipts, module system, metric dictionary). Starter-product changes (calc
  engine code, defaults, editor, viewer/report, Excel, agents, the
  [starter guide](../starter/README.md)) version their packages only; there is
  no starter-guide version (D13). That test covered *only* the protocol row,
  which is why the protocol row stayed correct while the package rows went
  stale through the 1.4.0 release; `verify-versions` now covers every row.
- **Packages** — each `package.json`; consult the current matrix rather than
  assuming every package has core's version. Dependents pin `@uwmd/*` to an exact
  version, so a core bump is a repin of all of them in the
  same change — `npm run verify-lockfile` fails if one is forgotten.
  `@uwmd/verify` (RFC 0083) versions independently from 0.1.0 and pins no
  `@uwmd/*` package; core, signing, batch and lake pin it exactly, so a verify
  bump is a repin (and version bump) of those four. Its `VERIFY_VERSION`
  (`packages/uwmd-verify/src/version.ts`) is the engine identity every receipt
  records, including receipts issued through core (verify computes them), held
  to its manifest by its `version.test.ts`. Because the
  pin is exact, every dependent must also take its own version bump: a
  republished `0.2.0` carrying a different pin is not something npm allows, so
  leaving one behind means its repin never ships.

**Owner release rule,2026-10-17:** every @uwmd npm package goes to5.0.0
at the official public launch, together. Every prelaunch release uses4.x.x,
from main as needed, including incompatible changes. Do not produce migration
notes, deprecation paths, consumer-breakage analyses, bump recommendations or
preservation/repair work for prelaunch documents, signatures, receipts or
artifacts. See the rule at the top of AGENTS.md/CLAUDE.md and [VERSIONS](../../VERSIONS.md).
Format/Protocol remain separate contracts. Current RFC, deterministic verification,
conformance and source-integrity gates remain. No release is prepared here;
5.0.0 publication still requires separate explicit owner launch approval.

**Cutting a `@uwmd/core` release** touches seven things beyond `package.json`,
each with a guard that fails loudly if you miss it:

1. `CORE_VERSION` in `src/version.ts` — a literal, so the browser bundle has it.
   `version.test.ts` asserts it matches the manifest. A release that bumps
   `@uwmd/verify` moves `VERIFY_VERSION` (`packages/uwmd-verify/src/version.ts`)
   the same way, held by verify's own `version.test.ts`, and one that bumps
   `@uwmd/signing` moves `SIGNING_VERSION`
   (`packages/uwmd-signing/src/version.ts`), a literal again so the package has
   no static `node:` import and bundles for the browser; signing's
   `version.test.ts` holds it to the manifest.
2. The dependents' pins and their own versions (above). `verify-lockfile`, and
   `verify-release` for a package whose dependency set changed since the last
   release while its version did not.
3. When the release moves `VERIFY_VERSION` (any `@uwmd/verify` bump), the two
   `conformance/receipts/issue/` baselines, which record the computing engine
   (`@uwmd/verify` and `VERIFY_VERSION`, RFC 0083; not core's version) —
   regenerate with `npm run conformance -- --suite=receipts --update`. A core
   bump alone does not move them.
4. On the same condition, every `conformance/receipts/verify/` receipt whose
   expected verdict is `failed` and that the current engine issued:
   `03-result-disagrees`, `10-rehashed-one-cent` and
   `11-rehashed-subquantum-ratio`. Each names `engine: "@uwmd/verify"`, and its
   `engine_version` must be the **new** `VERIFY_VERSION` or `RCP-07`
   reclassifies the scenario from `failed` to `unverifiable`. Their
   `results_digest` does not cover it, so the edit is by hand. See
   [09](09-conformance-testing.md#conformance-corpus-conformance).
5. The `Current matrix` rows in [`VERSIONS.md`](../../VERSIONS.md) — both the
   version cell and the "pairs with `@uwmd/core` 1.x" notes. `verify-versions`.
   This was the unguarded one: the 1.4.0 release left the matrix advertising
   1.3.0, and nothing went red until it was found by hand.
6. **Finalize the generation in the commit the tag lands on.** Date the
   CHANGELOG heading and make the matrix rows, the protocol status line and the
   section headings final and publication-neutral. Add no `### Released`. See
   [the three release states](#the-three-release-states). `verify-release`, and
   `release.yml` again before it publishes.
7. **Push the `v<version>` tag.** This is the step that actually ships:
   `release.yml` triggers on `v*` and on nothing else. `verify-release`.

**1.4.0 is why step 7 is written down.** Steps 1–5 were all done for it and the
tag never was, so the publish job never ran — npm went from 1.3.0 to 1.5.0 and no
1.4.0 of any package exists. Nothing caught it, and nothing could have: the three
existing guards compare repo files to each other, and all of them agreed on a
version nobody had published. `verify-release` closes that by comparing every
CHANGELOG section marked `### Released` against the git tags, with no
exception. `### Released` is added only after the tag exists, so `main` can
never claim a release that has no tag.

Before pushing the tag, confirm a **trusted publisher exists on npmjs.com for
every publishing package of the generation**: seven for 4.0.x (core, CLI,
signing, batch, Excel, report and lake) and eight from 4.1.0, which adds
`@uwmd/verify` (below). `@uwmd/verify` is a new package name: npm requires it
to exist before its trusted publisher can be configured, so the owner
provisions it with the bootstrap under "Account prerequisite / bootstrap"
before the first tag that publishes it. That is an owner prerequisite, not a
workflow step. The tag is the trigger, so a
missing publisher fails the job after every gate has already passed.
- **Packs / defaults** — `MULTIFAMILY_PACK.version`, `MULTIFAMILY_DEFAULTS.version`.

Changelog: [`CHANGELOG.md`](../../CHANGELOG.md), Keep-a-Changelog format,
per-surface sections. A prepared candidate belongs in the current matrix and
an explicitly unpublished changelog section. Preparation plans, publication
evidence and reconciliation working notes belong in the private maintainer
workspace. Public proof is CHANGELOG, VERSIONS, GitHub Releases and npm provenance;
no public release-record file is required. A merged
candidate is not a tagged or npm-published release.

### The three release states

A generation passes through three states on `main`, each with its own
records. A tag is immutable, so each record belongs to the first state in
which it is true, and the tagged tree must say nothing whose truth changes
when the release workflow runs.

1. **Candidate.** The candidate bumps the manifests and labels itself a
   candidate:
   - the CHANGELOG heading reads `## [X.Y.Z] - release candidate (unpublished)`;
   - the matrix rows read `(candidate; published <previous>)`;
   - a protocol the packages newly carry reads `(accepted, unreleased)`.

   Nothing checks a candidate.
2. **Release-prepared.** This is the one-commit release PR that the owner tags.
   Its records are final and publication-neutral: as true before the workflow
   publishes as after it. Write "Core/CLI X.Y.Z pair with Protocol P", not "are
   published" and not "will be published".
   - **Required:**
     - the dated heading `## [X.Y.Z] - YYYY-MM-DD`, with the complete release
       contents;
     - bare matrix version cells for the generation's publishing packages, with exact
       pairings (four through 2.17.0; six through 2.21.x; nine from 2.22.0 through
       3.x; seven for 4.0.x; eight from 4.1.0);
     - a core row that pairs with `PROTOCOL_VERSION`, and a CLI that pins core
       exactly;
     - a Protocol row with no annotation;
     - a protocol status line in publication-independent wording, such as
       `Accepted release contract (RFC NNNN)`;
     - an empty `## [Unreleased]`: every entry has moved into the dated
       section. Subsection headings and HTML comments may stay.
   - **Forbidden:**
     - `candidate`, `unreleased` or `unpublished` anywhere describing the
       generation, in a section heading, a row or the matrix prose;
     - `published <previous>` on a row;
     - "no release tag or publication yet";
     - `### Released` and any other claim that npm publication happened.

   The RFC stays `accepted`.
3. **Released and verified.** The post-publication reconciliation runs only
   after the tag exists and the workflow has published. It adds:
   - the `### Released` block and the explicit npm publication statements;
   - the release run;
   - registry versions, dist-tags and `gitHead`;
   - signature, integrity and provenance checks, with Rekor indexes;
   - the comparison of published files with a local build;
   - the portable driver against the published CLI;
   - the RFC moving from `accepted` to `implemented`;
   - the protocol status line moving to `Stable`;
   - a comment on each closed `awaiting-release` issue naming the released
     version, and removal of the label
     ([Issue intake](#issue-intake-and-adopter-reports)).

At `v2.14.0` and `v2.15.0`, the release commit only dated the heading, so
their tagged trees still call their own packages candidates and their
protocol unreleased. StackUW's re-vendor found it (its adopter report 020). The
owner decided on 2026-10-02 to fix future tags and not to cut a `v2.15.1` for
that metadata, so both historical tags stay as they are.

The guards:

- **`verify-release` (CI).** It enforces state 2's records as soon as the
  heading is dated, so a stale release PR fails CI. It also requires every
  `### Released` section to have its tag, so a premature `### Released` fails
  too.
- **`release.yml`.** It re-runs the check as
  `verify-release.mjs --tag "$GITHUB_REF_NAME"` before installing anything.
  - Tag mode adds the tag/core/CLI/`PROTOCOL_VERSION` pairing and the dated
    heading.
  - It refuses a `### Released` in the tagged version's own section.
  - It refuses any entry under `## [Unreleased]`.

  A tag on a stale, undated or prematurely "released" tree publishes nothing.
- **`release:check`.** It fails if that step goes missing.

**The release-cut invariant: a release tag names a commit whose
`[Unreleased]` is empty.** Work can merge to `main` after the preparation
under the same version records. 2.18.0 was prepared at `4e0a8c1`, then
RFCs 0075–0077 merged under `[Unreleased]`, and tag mode passed that `main`
as `v2.18.0`. Tagging it would have published them as 2.18.0, and npm never
takes a version back. Every `v2.*` tag through `v2.17.0` already meets the
invariant. Ordinary CI, without `--tag`, accepts a non-empty `[Unreleased]`,
because that is how `main` looks between releases. Only prose, list items
and code count as entries; blank lines, headings, comments, thematic breaks
and link reference definitions do not. If a tag fails here, tag the
preparation commit, or prepare again with the entries in the dated section.

Source may still run ahead between releases, as Protocol 2.20.0 did against
published 2.15.0's 2.19.0 before 2.16.0 shipped. Run the tag check on the
release-prepared tree before tagging:

```
node scripts/verify-release.mjs --tag vX.Y.Z
```

## CI / CD (`.github/workflows/`)

- **`ci.yml`** — on push/PR: a lint job (Node 20, Biome) and a build+test job
  (Node 20 & 22 matrix) that installs, builds, tests, and runs every indexed
  conformance check (Reader, Verifier, profiles and starter products), the
  portable driver with `--no-skip`, and the capability-skip controls. No live
  model is called: agent checks run as deterministic replays.
  The release-record job also observes public npm package identities and the
  prepared versions' registry state without publishing, only in release-prepared
  state (dated current-version section, no Released marker, empty Unreleased).
  Ordinary development records skip this external availability dependency.
  For a dated generation with empty `[Unreleased]` and no `### Released`, it runs tag-mode record checks
  without creating a tag. Ordinary development and post-publication records keep
  their existing checks. Anonymous registry reads cannot confirm account-side
  trusted publisher settings. Prepared generations also run
  `scripts/check-prepared-consumers.mjs` on Node20: actual archives are packed,
  installed outside the workspace and checked through strict root/browser
  declarations, CLI and public receipt/signing/Excel/report APIs. This is package
  integration evidence, not another financial implementation or live Excel.
  An explicit manual CI request can select `verify-publication` with the approved
  `release-commit`. This request runs the publication job without duplicating
  ordinary development jobs; PR/push CI still runs all its normal gates. The
  read-only job checks the annotated tag target, uncached
  registry identities/dist-tags, tarball hashes, registry signatures/attestations,
  exact downstream installs, strict declarations and public APIs, then drives the
  published CLI through portable conformance. It uploads its registry/signature/
  portable evidence. It is skipped for ordinary development PRs and pushes; it
  never publishes or changes trusted-publisher settings.
- **`release.yml`** — on `v*` tags: build, full test, then `npm publish` for
  the eight packages `@uwmd/verify`, `@uwmd/core`, `@uwmd/cli`,
  `@uwmd/signing`, `@uwmd/batch`, `@uwmd/excel`, `@uwmd/report` and
  `@uwmd/lake`. `@uwmd/verify` publishes first because core, signing, batch
  and lake pin it exactly, and core second because the rest pin it exactly;
  `release:check` enforces that every package publishes after each `@uwmd/*`
  package it pins. `@uwmd/verify` joins from 4.1.0 (RFC 0083); 4.0.x published
  the other seven. Excel, report and lake joined after 2.21.x; each already
  existed on npm, which a trusted publisher requires (a deprecated stray
  `0.3.0` of Excel and report, and lake `0.2.9`, published by hand from
  `v2.21.0` on 2026-10-11). Authentication is **npm trusted publishing
  (OIDC)** — no `NPM_TOKEN`, no secret of any kind. The runner trades the
  `id-token: write` permission for a short-lived token scoped to this repo and
  workflow, and provenance is attached automatically.

  It needs a trusted publisher configured **per package** on npmjs.com (org
  `UWMD-OSP`, repo `UW-Markdown`, workflow `release.yml`, allowed action
  `publish`, environment blank). Current npm web settings support multiple
  trusted publishers (up to ten); a separately authorized recovery workflow does
  not require replacing the ordinary release publisher. Confirm actual account
  settings before recovery, and prefer rerunning the ordinary release after a
  partial failure. Node stays pinned at 22.14.0
  because that is npm's documented minimum for OIDC, and the job upgrades npm
  to 11.5.1 for the same reason — the bundled 10.x cannot do it.

  Before this, the job used a long-lived `NPM_TOKEN` secret. The 1.3.0 release
  is what exposed the cost: the token had expired, the tag-triggered publish
  died at `ENEEDAUTH` after passing every gate, and the release went out by
  hand instead. A credential that expires silently between releases is one that
  is always broken exactly when it is needed.
- **`CODEOWNERS`** routes spec / schema / reference-library paths to the BDFL.
- **`labels.yml`**: on a push to `main` that changes `.github/labels.json`,
  creates or updates every label it lists. It never deletes a label. The
  `verify-issue-forms` CI job holds the issue forms and `docs/FEEDBACK.md` to
  that manifest, because GitHub silently drops a form label that doesn't
  exist. Three labels were missing that way until 2026-10-04.

## Official first-party module distribution

The owner approves `@uwmd/module-hospitality` and `@uwmd/module-data-center`
together as official public npm packages. This is packaging/release governance,
not a new normative feature: Format 2.0, Protocol 2.21.0, accepted module contracts,
IDs, compatibility fields and runtime/signature behavior are unchanged. No RFC
is required solely to distribute these existing implementations.

> **RFC 0081 Phase 4 deleted both packages.** Hospitality's and data
> center's official content is builtin in `@uwmd/core` (RFC 0080). Both shells
> published their final 0.2.0 in the 3.0.0 release, and both names were
> deprecated on npm on 2026-10-11 (Retirement, below). From 4.0.0 the release
> publishes seven packages (eight from 4.1.0, which adds `@uwmd/verify`). This
> section is the record of how they were
> distributed; official asset classes are never module classes now, and
> modules are for third parties.

**Ordinary releases only.** Both joined the existing four packages in `release.yml`
from 2.18.0; no module-only trigger or new tag family exists. Releases through
2.17.0 retain their actual four-package publication scope. `release-packages.mjs`
selects four rows for generations at or below 2.17.0, six through 2.21.x
(including patch generations), nine from 2.22.0 through 3.x, seven for 4.0.x
and eight from 4.1.0. These boundaries record history and do not select the
next release version, with one exception: RFC 0083 fixed the eight-package
boundary at 4.1.0 ahead of time, because core/CLI 4.1.0 is the release that
first publishes `@uwmd/verify` (RFC 0083 Decisions). The module rows are names only: their sources no longer exist. Historical tags and
publication records stay immutable.

**Retirement (RFC 0080 §6).** The 3.0.0 transition release publishes 0.2.0 of
both packages, pinning core 3.0.0 and declaring nothing; it is their final
version. After the release run succeeds and publication is verified, the owner
deprecates both names on npm. This is an account step that needs the owner's
npm login and 2FA, so the workflow does not do it:

```
npm deprecate @uwmd/module-hospitality "Retired: hospitality is a builtin asset class in @uwmd/core 3.0.0 and later (RFC 0080). Use @uwmd/core; no module install is needed."
npm deprecate @uwmd/module-data-center "Retired: data_center is a builtin asset class in @uwmd/core 3.0.0 and later (RFC 0080). Use @uwmd/core; no module install is needed."
```

Deprecating a name marks every version, so existing installs keep resolving
and only show the message. Record the deprecation in the post-publication
reconciliation. Both packages left `release.yml` and the workspace in RFC
0081 Phase 4, after the release that shipped their final version.

**Done 2026-10-11.** 3.0.0 published 0.2.0 of both packages (release run
38163964522), and the owner then ran both commands. The registry shows the
message on every version of each name, `0.0.0-stage` through `0.2.0`; see the
[3.0.0 publication record](../releases/3.0.0-publication.md#module-package-retirement).
RFC 0081 Phase 4 then removed both from `release.yml`, the workspace and
the guards; `release-packages.mjs` keeps their names only for the
generations that shipped them. 4.0.0 is the first release without them.

**Independent versions and explicit loading.** npm package semver identifies the
artifact; manifest `version` identifies its contract; `manifest_version` identifies
the schema. Document `modules[].version` and manifest `depends_on` refer to the
contract, not npm package semver, and install nothing. The host installs exact
package/core versions, commits its application lockfile, imports the module and
calls the existing public registry/runtime APIs. Browser hosts use
`@uwmd/core/browser`. The JSON manifest is available through each package's
`/manifest.json` export. There is no discovery, automatic download/update, or
remote execution service. Both current manifest contracts stay 0.1.0.

**Package releases.** Exact core pins remain mandatory. Every core bump changes
those pins and therefore requires each module's own package-version bump. Other
module releases occur when package contents/pins change; a repin or packaging
change alone does not change the manifest contract version. Before first
publication, the current never-published 0.1.9 artifacts can be prepared without
resetting their versions. Future generation preparation must update the module
READMEs' installation examples and pending-first-publication wording to the
selected exact versions, using publication-neutral wording in the tagged tree.

**Build and verification.** Build before packing: module builds generate
`dist/manifest.json` from the typed object. Tarballs include ESM, declarations,
view models, exported JSON, README, package metadata and the complete root MIT
notice. `verify-packages` checks artifacts, license equality and manifest parity;
`verify-versions` checks the package/contract/schema/ID/ranges/tier/core columns
in `VERSIONS.md` without a build. `release:check` covers all eight publishing
packages, including exact `@uwmd/*` dependencies (`@uwmd/verify` pins none,
core pins verify, every other package pins core or verify), public exports,
OIDC metadata and the publication order (`@uwmd/verify` first, then every
package after each one it pins). `verify-packages` also installs only
`@uwmd/verify`'s tarball and its runtime dependencies in an empty directory,
type-checks a consumer of both entries and runs it. `verify-packages` refuses a publishing
package with a workspace-only dependency (`file:`, `link:`, `workspace:`), an
inexact `@uwmd/*` pin, or an export or bin target missing from its tarball.
Repository workspace-link rules remain unchanged; external consumers correctly
resolve published npm packages rather than repository workspace links.

**Registry and recovery.** Each publish step uses the tested public-registry probe.
Only a recognized package 404 or an absent version in valid package metadata means
`absent`; HTTP authentication/throttling/server errors, timeouts, redirects,
malformed responses and network failures stop the job. A confirmed existing
version is skipped without republishing or changing its dist-tags. npm publication
is sequential, not atomic. After a partial failure, record what landed, correct
only the documented prerequisite, and rerun the ordinary workflow. Do not move a
tag or manually publish to bypass a failed gate.

**Account prerequisite / bootstrap.** This applies to every new first-party
package name. The last one was `@uwmd/verify`, first published with core/CLI
4.1.0; its bootstrap evidence is in the
[4.1.0 publication record](../releases/4.1.0-publication.md#name-bootstrap).
npm configures a trusted publisher only for a package that already
exists, and `release.yml` publishes only through one, so a new name has to be
created by hand before the first tag that publishes it. Confirm publish rights
in the npm `@uwmd` scope first; an anonymous 404 does not prove that the name is
free or that the account owns it. The workflow does none of this. The owner
does it from their own npm login, with 2FA (`npm trust` needs a current npm 11
and a web login, `npm login --auth-type=web`):

1. **Publish a disposable placeholder, never the intended release version.**
   For `@uwmd/verify` that is `0.0.0-bootstrap.0`: a `package.json` (name,
   that version, `license: MIT`, a description saying it is a placeholder) and
   a README, with no implementation, published from an empty directory with
   `npm publish --access public --tag bootstrap`. Never publish 0.1.0, or any
   version the release will carry, by hand. The tag run's registry probe would
   find it, skip it as already published, and the package would ship that
   version without provenance and from no tagged tree; npm never takes a
   version back. (Lake 0.2.9, published by hand from `v2.21.0`, was safe only
   because the release that added lake to the workflow published 0.2.10.)
2. **Bind the trusted publisher:**

   ```
   npm trust github @uwmd/verify --file release.yml --repo UWMD-OSP/UW-Markdown --allow-publish -y
   ```

   This is the same configuration as package Settings → Trusted Publisher:
   GitHub Actions, `UWMD-OSP`, `UW-Markdown`, `release.yml`, allowed action
   `publish`, environment blank. Confirm it with `npm trust list @uwmd/verify`.
3. **Deprecate the placeholder version**, and only that version:

   ```
   npm deprecate @uwmd/verify@0.0.0-bootstrap.0 "Placeholder that created the package name for trusted publishing; it contains no implementation. Install 0.1.0 or later."
   ```

   npm may route a brand-new name's first publish through staged publishing
   ("Your package is being processed"). It then creates its own
   `0.0.0-stage` version at once and lands the placeholder minutes later, and
   until it lands the name reads as 404 and `npm deprecate` fails with E404.
   The trust binding works during that window. `@uwmd/verify` went this way on
   2026-10-14: the placeholder appears after 0.1.0 in the registry's `time`
   field. Deprecate `0.0.0-stage` too, with the same kind of message, as
   lake's was.

4. **Record the evidence before authorizing the tag:** the placeholder's
   version and dist-tags (`npm view @uwmd/verify --json`), its deprecation
   message, and the `npm trust list` output, on the release PR. The
   post-publication record carries it into `docs/releases/`. The first ordinary release then
   publishes the real version as `latest`, with provenance.

If the placeholder or the trust binding does not behave as described, stop for
an account decision; do not improvise a manual publication of a real version.

Current official references, checked for this procedure:
[npm trusted publishers](https://docs.npmjs.com/trusted-publishers/),
[`npm trust`](https://docs.npmjs.com/cli/v11/commands/npm-trust/) and
[`npm deprecate`](https://docs.npmjs.com/cli/v11/commands/npm-deprecate/).
The trusted-publisher overview documents multiple publishers per package; the
CLI trust page still contains older single-configuration language. Confirm the
account state rather than relying on the old restriction.

**Independent post-publication verification.** Extend the existing
[2.17.0 procedure](../releases/2.17.0-publication.md) to both module packages:
registry versions, `latest`, `gitHead`, tarball hashes/integrity, npm signatures,
DSSE/SLSA attestations, authenticated Sigstore trust, Rekor timestamps/inclusion
proofs/checkpoints, and file-by-file comparison against the tagged build. Run an
isolated consumer with exact registry-installed core/modules through Node,
browser-safe exports, TypeScript declarations, JSON parity, compatibility checks
and existing module fixtures. Retain durable evidence under `docs/releases/`.
For a skipped unchanged artifact, verify its original publication commit and
provenance rather than claiming it was republished by the new run. Confirm no
package outside the generation's scope was unintentionally published.

npm/Sigstore package provenance and `ModuleManifest.signature` are distinct trust
layers. These manifests remain unsigned; a host requiring signed manifests may
refuse them. Preserve the existing synchronous/async verification boundary.

## Governance & RFCs

- Model: owner-led until outside contributions begin
  ([`GOVERNANCE.md`](../../GOVERNANCE.md)). The owner can accept and implement
  changes immediately. External PRs require owner review; after the first external
  PR merges, normative RFCs also receive a 14-day public comment window.
- **Normative = anything that changes the spec, protocol, schemas, metric
  dictionary or conformance contract.** That includes most things this wiki's
  recipes touch when they alter behavior: new sections, new validation codes
  that change conformance, new calc notation or numeric semantics, new or
  changed metric definitions in `spec/metrics/`, new official asset classes
  (each a full builtin, RFC 0080).
- **Starter products are not normative** (RFC 0078). A change that only touches
  the calc engine's code, defaults and the cascade, refinement, the editor,
  viewer/report, Excel, the agents or a `docs/starter/` page needs no RFC and
  no Protocol version. It still needs its tests, a CHANGELOG entry and a
  package version at release. Numbers are never a judgment call either way: a
  new default, formula or rounding choice goes to the maintainers.
- **Conformance claims under Protocol 3.0** are a tier (`reader` or
  `verifier`) plus `profiles` (`module`, `integrity`, `representations`,
  `portfolio`, `sensitivity`, `stochastic`). An RFC states which tier or
  profile its change affects, under "Conformance impact". Editor and agent
  hosting claims are starter-product compatibility claims, outside the Protocol.
- RFCs live in [`docs/rfcs/`](../rfcs/), numbered from `0000-template.md`.
  Read the index and each RFC's status before treating it as future work:
  signing (0002/0010), capability tokens (0011), iterative determinism (0024),
  calendar math (0034), and distribution waterfalls (0035/0036) are implemented.
  RFC 0040 (signed block roles) and RFC 0041 (period-indexed addressing)
  shipped in core/CLI 2.7.0. RFCs 0042–0044 shipped in core/CLI 2.8.0 with
  Protocol 2.11.0; their RFC status is `implemented`. Standalone Excel is in
  the release workflow from 3.0.0. RFCs 0062 and 0063 shipped in core/CLI 2.14.0 with Protocol
  2.18.0; their RFC status is `implemented`.
- Other process docs: [`docs/FEEDBACK.md`](../FEEDBACK.md),
  [`CONTRIBUTING.md`](../../CONTRIBUTING.md),
  [`MAINTAINERS.md`](../../MAINTAINERS.md), [`SECURITY.md`](../../SECURITY.md),
  [`ROADMAP.md`](../../ROADMAP.md).

## Issue intake and adopter reports

Adopters, independent implementers and users report through three issue forms:
bug or interoperability, spec question, and capability request. Security
reports go to `security@uwmd.org` instead. The lifecycle, the label taxonomy,
the deal-data boundary and the maintainer triage steps live in one place,
[`docs/FEEDBACK.md`](../FEEDBACK.md). Change them there, together with
`.github/labels.json`, and the `verify-issue-forms` guard keeps them in step.

What a maintainer must remember:

- **Classify with the RFC test.** Exactly one category label remains after
  triage. Add `needs-rfc` only when resolving the report changes what a
  conforming implementation must do, or has to select new semantics because
  the contract is genuinely ambiguous (the table below).
- **Treat drift as reconciliation, not a ranking.** The specs, normative
  schemas and normative conformance corpus are one joint contract, and none
  outranks the others in general. Establish the already-governed behavior
  from all of them plus the introducing RFC and the release evidence, then
  correct whichever artifact departs from it.
- **Comment on every change of state.** Label changes don't notify the
  reporter, so a label change alone tells them nothing.
- **Close the loop at release.** After a release publishes, comment on every
  `is:issue is:closed label:awaiting-release` issue with the version, then
  remove the label.
- **Cite both IDs.** A fix, CHANGELOG entry or RFC that came from a report
  cites the issue and the reporter's own tracker ID, if one was given, the way
  earlier entries cite StackUW's `UPSTREAM-NNN`.
- **Keep deal data out of fixtures.** Fixtures are synthetic even when a real
  deal exposed the problem.

The machine-readable report question was evaluated and declined for now; see
the [adopter feedback review](../reviews/2026-10-04-adopter-feedback-loop.md).

## When does my change need an RFC?

Change | RFC?
---|---
Fix a parser/validator/calc bug | No (editorial)
Add a Vitest test or a well-formed `documents/fixtures/` fixture | No
Add or change a metric definition (dictionary entry + its pack mirror) | Yes (metric dictionary, RFC 0078)
Change a validation code's meaning/severity | Yes (changes conformance)
Add/rename a standard section or `_meta` field | Yes (format spec)
Add a new official asset class | Yes (full builtin, RFC 0080); third-party classes use modules
Change provenance rules (§V.2–§V.4), integrity, calc notation or numeric model | Yes (protocol)
Change starter behavior: cascade order, defaults, editor mechanics, view models, display, agents | No (starter guide + package semver); numerics still go to maintainers
Anything touching `spec/` or `spec/schemas/` | Yes

<<<<<<< HEAD
The required index gate also enforces tracked-content identity policy. Its exact
public-handle exceptions are the maintainer and code-owner files; other matches
fail regardless of directory. Retained historical evidence with redactions is
not public release proof. Launch-day file moves and slimming are separate work.
=======
Direct `node scripts/verify-packages.mjs` resolves npm's JavaScript entry on
Windows and launches it with the current Node executable and argument array.
The npm script entry still uses npm_execpath; no shell quoting or command shim
execution is needed. Required Windows CI exercises the direct invocation after
building the packages.
>>>>>>> origin/main
