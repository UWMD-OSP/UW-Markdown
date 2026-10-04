# 11 — Build, release & governance

## Monorepo & tooling

- **Package manager:** npm **workspaces** (`packages/*`). No turbo, no pnpm, no
  lerna. Lockfile: `package-lock.json`. Node `>=18`.
- **Lint:** Biome 1.9.4 (`biome.json`), lint-only.
- **Tests:** Vitest 3.x per package.
- **Build:** TypeScript `tsc` per package (root `build` fans out via
  `--workspaces --if-present`).
- **Schema validation:** Ajv 8 + `ajv-formats` (root devDeps).

Root `package.json` scripts:

Script | Does
---|---
`npm run build` | `tsc` across all workspaces
`npm test` | Vitest across all workspaces
`npm run test:coverage` | `@uwmd/core` coverage
`npm run cli -- <cmd>` | Run the CLI from source (`packages/uwmd-cli/bin/uwmd.mjs`)
`npm run conformance` | `scripts/run-conformance.mjs` (tiers 1,2,3 + `lite` by default)
`npm run validate-schemas` | `scripts/validate-schemas.mjs`
`npm run verify-packages` | `scripts/verify-packages.mjs` — what `npm pack` would actually ship
`npm run verify-lockfile` | `scripts/verify-lockfile.mjs` — every `@uwmd/*` reference links to this tree, and cross-package pins match declared versions
`npm run verify-versions` | `scripts/verify-versions.mjs` — the `VERSIONS.md` matrix matches every package manifest and the `protocol.ts` constants
`npm run verify-indexes` | `scripts/verify-indexes.mjs` — the schema/RFC indexes match files on disk; tests cover automatic RFC discovery and site version metadata
`npm run verify-codes` | `scripts/verify-codes.mjs` — every code an implemented RFC or the format spec promises is one `@uwmd/core` actually emits, and every emitted validation family is registered in protocol §XI
`npm run verify-release` | `scripts/verify-release.mjs` — every CHANGELOG section marked `### Released` has its tag, with no exception, and a dated generation's records are final and publication-neutral (`release-state.mjs`); `-- --tag vX.Y.Z` checks the tree as that release
`npm run lint` / `npm run format` | Biome lint / format

> Typical loop after a core change: `npm run build && npm test && npm run
> conformance`. `@uwmd/core`'s `prepublishOnly` chains build + test + conformance
> + schema validation, so a publish can't skip them.

## Versioning (semver-per-surface)

Independent versions, tracked in [`VERSIONS.md`](../../VERSIONS.md):
- **Format** — `FORMAT_VERSION` in `protocol.ts` (2.0) and `uw_version` in files.
- **Protocol** — `PROTOCOL_VERSION` in `protocol.ts` (Stable 2.21.0 after
  RFC 0070 shipment and independent publication verification; published
  core/CLI 2.17.0 pair with it and Format 2.0. Historical core/CLI 2.16.0
  retain stable Protocol 2.20.0).
  A test in `protocol.test.ts` asserts it matches the matrix row in `VERSIONS.md`, so the
  two cannot drift apart silently. That test covered *only* the protocol row,
  which is why the protocol row stayed correct while the package rows went
  stale through the 1.4.0 release; `verify-versions` now covers every row.
- **Packages** — each `package.json`; consult the current matrix rather than
  assuming every package has core's version. Dependents pin `@uwmd/*` to an exact
  version, so a core bump is a repin of all of them in the
  same change — `npm run verify-lockfile` fails if one is forgotten. Because the
  pin is exact, every dependent must also take its own version bump: a
  republished `0.2.0` carrying a different pin is not something npm allows, so
  leaving one behind means its repin never ships.

**Cutting a `@uwmd/core` release** touches seven things beyond `package.json`,
each with a guard that fails loudly if you miss it:

1. `CORE_VERSION` in `src/version.ts` — a literal, so the browser bundle has it.
   `version.test.ts` asserts it matches the manifest.
2. The dependents' pins and their own versions (above). `verify-lockfile`.
3. The two `conformance/receipts/issue/` baselines, which record the issuing
   engine — regenerate with `--tier=receipts --update`.
4. `conformance/receipts/verify/03-result-disagrees/receipt.json`, whose
   `engine_version` must be the **new** one or `RCP-07` reclassifies the
   scenario from `failed` to `unverifiable`. See
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
all six supported publishing packages (core, CLI, signing, batch, hospitality and data-center)** (below). The tag is the trigger, so a missing
publisher fails the job after every gate has already passed.
- **Packs / defaults** — `MULTIFAMILY_PACK.version`, `MULTIFAMILY_DEFAULTS.version`.

Changelog: [`CHANGELOG.md`](../../CHANGELOG.md), Keep-a-Changelog format,
per-surface sections. A prepared candidate belongs in the current matrix and
an explicitly unpublished changelog section, alongside its release plan (for
example, the [2.14.0 record](../releases/2.14.0-candidate.md)). A merged
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
       pairings (four through 2.17.0; six afterward);
     - a core row that pairs with `PROTOCOL_VERSION`, and a CLI that pins core
       exactly;
     - a Protocol row with no annotation;
     - a protocol status line in publication-independent wording, such as
       `Accepted release contract (RFC NNNN)`.
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
   - the protocol status line moving to `Stable`.

At `v2.14.0` and `v2.15.0`, the release commit only dated the heading, so
their tagged trees still call their own packages candidates and their
protocol unreleased. StackUW's re-vendor found it (its UPSTREAM-020). The
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

  A tag on a stale, undated or prematurely "released" tree publishes nothing.
- **`release:check`.** It fails if that step goes missing.

Source may still run ahead between releases, as Protocol 2.20.0 did against
published 2.15.0's 2.19.0 before 2.16.0 shipped. Run the tag check on the
release-prepared tree before tagging:

```
node scripts/verify-release.mjs --tag vX.Y.Z
```

## CI / CD (`.github/workflows/`)

- **`ci.yml`** — on push/PR: a lint job (Node 20, Biome) and a build+test job
  (Node 20 & 22 matrix) that installs, builds, tests, and runs conformance
  tiers 1–3. Tier 4 is excluded (non-deterministic / operator-driven).
- **`release.yml`** — on `v*` tags: build, full test, then `npm publish` for
  `@uwmd/core`, `@uwmd/cli`, `@uwmd/signing`, `@uwmd/batch`,
  `@uwmd/module-hospitality`, and `@uwmd/module-data-center`. Authentication is **npm trusted publishing
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

## Official first-party module distribution

The owner approves `@uwmd/module-hospitality` and `@uwmd/module-data-center`
together as official public npm packages. This is packaging/release governance,
not a new normative feature: Format 2.0, Protocol 2.21.0, accepted module contracts,
IDs, compatibility fields and runtime/signature behavior are unchanged. No RFC
is required solely to distribute these existing implementations.

**Ordinary releases only.** Both join the existing four packages in `release.yml`.
First official publication waits for the next ordinary owner-authorized UWMD
generation; no module-only trigger or new tag family exists. Releases through
2.17.0 retain their actual four-package publication scope. `release-packages.mjs`
selects four rows for generations at or below 2.17.0 and six afterward, including
patch generations; this boundary does not select the next release version.
Historical tags and publication records stay immutable.

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
in `VERSIONS.md` without a build. `release:check` covers all six supported
packages, including exact core dependencies, public exports and OIDC metadata.
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

**Account prerequisite / bootstrap.** Confirm publish rights in the npm `@uwmd`
scope and public visibility for each module. An anonymous 404 alone does not prove
name availability or account ownership. npm requires a package to exist before
configuring its trusted publisher. Its documented staged-publishing bootstrap can
create a public `0.0.0-stage` placeholder while leaving the staged artifact
unavailable until human 2FA approval. Staging requires npm >=11.15.0 and Node
>=22.14.0, newer npm than the ordinary workflow's 11.5.1 pin. Use separate owner
account tooling; this workflow performs no staging/bootstrap.

If either name is genuinely new, the owner may stage a disposable bootstrap
prerelease containing no module implementation, never the intended module release
version (staged versions reserve their version). Do not approve that bootstrap
artifact as an official module release. Confirm the placeholder permits the
package Settings → Trusted Publisher configuration, with GitHub Actions,
`UWMD-OSP`, `UW-Markdown`, `release.yml`, allowed action `publish`, environment
blank. If placeholder ownership/settings do not work as documented, stop for an
account decision; do not improvise a real-module manual publication. Provisioning
and its placeholder/stage evidence must be recorded before authorizing the next
tag. Account actions and 2FA are performed by the human owner.

Current official references, checked for this implementation:
[npm trusted publishers](https://docs.npmjs.com/trusted-publishers/),
[npm trust prerequisites](https://docs.npmjs.com/cli/v11/commands/npm-trust/),
[staged publishing](https://docs.npmjs.com/staged-publishing/), and
[staged version reservation](https://docs.npmjs.com/cli/v11/commands/npm-stage/).
The trusted-publisher overview now documents multiple publishers; the CLI trust
page still contains older single-configuration language. Use the current web
settings and confirm the account state rather than relying on the old restriction.

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
Excel/report/lake or other package was unintentionally published.

npm/Sigstore package provenance and `ModuleManifest.signature` are distinct trust
layers. These manifests remain unsigned; a host requiring signed manifests may
refuse them. Preserve the existing synchronous/async verification boundary.

## Governance & RFCs

- Model: owner-led until outside contributions begin
  ([`GOVERNANCE.md`](../../GOVERNANCE.md)). The owner can accept and implement
  changes immediately. External PRs require owner review; after the first external
  PR merges, normative RFCs also receive a 14-day public comment window.
- **Normative = anything that changes the spec, protocol, schemas, or
  conformance contract.** That includes most things this wiki's recipes touch when
  they alter behavior: new sections, new validation codes that change conformance,
  new calc semantics, new asset classes.
- RFCs live in [`docs/rfcs/`](../rfcs/), numbered from `0000-template.md`.
  Read the index and each RFC's status before treating it as future work:
  signing (0002/0010), capability tokens (0011), iterative determinism (0024),
  calendar math (0034), and distribution waterfalls (0035/0036) are implemented.
  RFC 0040 (signed block roles) and RFC 0041 (period-indexed addressing)
  shipped in core/CLI 2.7.0. RFCs 0042–0044 shipped in core/CLI 2.8.0 with
  Protocol 2.11.0; their RFC status is `implemented`. Standalone Excel remains
  unpublished. RFCs 0062 and 0063 shipped in core/CLI 2.14.0 with Protocol
  2.18.0; their RFC status is `implemented`.
- Other process docs: [`CONTRIBUTING.md`](../../CONTRIBUTING.md),
  [`MAINTAINERS.md`](../../MAINTAINERS.md), [`SECURITY.md`](../../SECURITY.md),
  [`ROADMAP.md`](../../ROADMAP.md).

## When does my change need an RFC?

Change | RFC?
---|---
Fix a parser/validator/calc bug | No (editorial)
Add a Vitest test or non-malformed Tier-1 fixture | No
Add a derived metric to an existing pack | Usually no (additive), but coordinate
Change a validation code's meaning/severity | Yes (changes conformance)
Add/rename a standard section or `_meta` field | Yes (format spec)
Add a new asset class / pack contract | Yes (`0003`)
Change edit semantics, cascade order, calc grammar | Yes (protocol)
Anything touching `spec/` or `spec/schemas/` | Yes
