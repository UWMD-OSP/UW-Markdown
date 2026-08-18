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
`npm run lint` / `npm run format` | Biome lint / format

> Typical loop after a core change: `npm run build && npm test && npm run
> conformance`. `@uwmd/core`'s `prepublishOnly` chains build + test + conformance
> + schema validation, so a publish can't skip them.

## Versioning (semver-per-surface)

Independent versions, tracked in [`VERSIONS.md`](../../VERSIONS.md):
- **Format** — `FORMAT_VERSION` in `protocol.ts` (1.1) and `uw_version` in files.
- **Protocol** — `PROTOCOL_VERSION` in `protocol.ts` (1.4.0). A test in
  `protocol.test.ts` asserts it matches the matrix row in `VERSIONS.md`, so the
  two cannot drift apart silently. That test covered *only* the protocol row,
  which is why the protocol row stayed correct while the package rows went
  stale through the 1.4.0 release; `verify-versions` now covers every row.
- **Packages** — each `package.json` (`@uwmd/core` 1.4.0, `@uwmd/cli` 1.4.0,
  `@uwmd/excel` 0.3.0, `@uwmd/report` 0.3.0, `@uwmd/batch` 0.2.0). Dependents pin
  `@uwmd/*` to an exact version, so a core bump is a repin of all of them in the
  same change — `npm run verify-lockfile` fails if one is forgotten. Because the
  pin is exact, every dependent must also take its own version bump: a
  republished `0.2.0` carrying a different pin is not something npm allows, so
  leaving one behind means its repin never ships.

**Cutting a `@uwmd/core` release** touches five things beyond `package.json`,
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
- **Packs / defaults** — `MULTIFAMILY_PACK.version`, `MULTIFAMILY_DEFAULTS.version`.

Changelog: [`CHANGELOG.md`](../../CHANGELOG.md), Keep-a-Changelog format,
per-surface sections. Candidate versions and unaccepted RFC work belong in a
release plan, not in the current matrix or shipped changelog. The active
post-v1.0 plan is
[`docs/releases/1.1-plus-interchange-plan.md`](../releases/1.1-plus-interchange-plan.md).

## CI / CD (`.github/workflows/`)

- **`ci.yml`** — on push/PR: a lint job (Node 20, Biome) and a build+test job
  (Node 20 & 22 matrix) that installs, builds, tests, and runs conformance
  tiers 1–3. Tier 4 is excluded (non-deterministic / operator-driven).
- **`release.yml`** — on `v*` tags: build, full test, then `npm publish` for
  `@uwmd/core` and `@uwmd/cli`. Authentication is **npm trusted publishing
  (OIDC)** — no `NPM_TOKEN`, no secret of any kind. The runner trades the
  `id-token: write` permission for a short-lived token scoped to this repo and
  workflow, and provenance is attached automatically.

  It needs a trusted publisher configured **per package** on npmjs.com (org
  `UWMD-OSP`, repo `UW-Markdown`, workflow `release.yml`). npm allows only one
  per package, which is the reason `publish-cli-recovery.yml` needs the
  temporary repoint documented in its header. Node stays pinned at 22.14.0
  because that is npm's documented minimum for OIDC, and the job upgrades npm
  to 11.5.1 for the same reason — the bundled 10.x cannot do it.

  Before this, the job used a long-lived `NPM_TOKEN` secret. The 1.3.0 release
  is what exposed the cost: the token had expired, the tag-triggered publish
  died at `ENEEDAUTH` after passing every gate, and the release went out by
  hand instead. A credential that expires silently between releases is one that
  is always broken exactly when it is needed.
- **`CODEOWNERS`** routes spec / schema / reference-library paths to the BDFL.

## Governance & RFCs

- Model: owner-led until outside contributions begin
  ([`GOVERNANCE.md`](../../GOVERNANCE.md)). The owner can accept and implement
  changes immediately. External PRs require owner review; after the first external
  PR merges, normative RFCs also receive a 14-day public comment window.
- **Normative = anything that changes the spec, protocol, schemas, or
  conformance contract.** That includes most things this wiki's recipes touch when
  they alter behavior: new sections, new validation codes that change conformance,
  new calc semantics, new asset classes.
- RFCs live in [`docs/rfcs/`](../../docs/rfcs/), numbered, from
  `0000-template.md`. Open drafts cover locale negotiation (0001), module signing
  (0002), custom asset classes (0003), conformance runner v2 (0004), stochastic
  calcs (0005), hospitality module (0006), sensitivity tables (0007), lease-up
  modeling (0008), `_meta` v2 reorg (0009), signed blocks (0010), capability
  tokens (0011), corpus retrieval (0013), and the post-v1.0 machine-interchange
  train (0014).
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
