# HUMAN: deprecate the two stray registry packages

> **Status 2026-09-15.** The four trusted publishers below are **confirmed set**
> by the owner. What remains is the deprecation at the bottom, which needs an
> `npm login` first — the token in `~/.npmrc` is expired (`npm whoami` returns
> 401), which is why an agent could not run it.

## Original handoff: confirm npm trusted publishers before the next release tag

**Why you, why now.** Release authentication is npm trusted publishing (OIDC),
configured per package in the npm web console under your account — no token
exists in this repo and an agent cannot reach those settings. The `v*` tag is
the trigger, so a package whose trusted publisher is missing or wrong fails
*after* every gate has passed, which is exactly how 1.3.0 went out by hand.

## What needs a publisher — and what does not

`release.yml` publishes **four** packages. Those are the four that need a
trusted publisher, and the only four:

| Package | Needs a publisher? |
|---|---|
| `@uwmd/core` | **Yes** |
| `@uwmd/cli` | **Yes** |
| `@uwmd/signing` | **Yes** |
| `@uwmd/batch` | **Yes** |
| `@uwmd/excel` | **No — nothing publishes it.** See the decision below. |
| `@uwmd/report`, `@uwmd/module-*` | **No** — unpublished by design. |

A trusted publisher authorizes one repo + workflow to publish one package.
Setting one up for a package no workflow publishes authorizes a release that
never fires — it is not harmful, just inert, and it implies a publication
policy the repo does not have.

## The step (~5 minutes, on npmjs.com)

For **each** of `@uwmd/core`, `@uwmd/cli`, `@uwmd/signing`, `@uwmd/batch`:

1. Sign in at <https://www.npmjs.com>, go to the package page, then
   **Settings** → **Trusted Publisher**.
2. Choose **GitHub Actions** and enter, literally:
   - Organization or user: `UWMD-OSP`
   - Repository: `UW-Markdown`
   - Workflow filename: `release.yml`
   - Environment: *leave blank* — `release.yml` does not use a GitHub
     Environment, and naming one here makes the OIDC claim fail to match.
3. Save.

npm allows **one** trusted publisher per package. That single-slot limit is why
`publish-cli-recovery.yml` exists and documents a temporary repoint in its
header — if you ever need that recovery path, the publisher has to be pointed at
it and then pointed back.

## What "done" looks like

All four package pages show a trusted publisher reading `UWMD-OSP/UW-Markdown`
with workflow `release.yml` and no environment. Nothing else changes; there is
no token to copy and nothing to paste into GitHub.

## THE REMAINING STEP: deprecate `@uwmd/excel@0.3.0` and `@uwmd/report@0.3.0`

`VERSIONS.md` called both of these "unpublished". Both are live on the registry
at `0.3.0`, pushed **2026-08-16** eight seconds apart — the 1.3.0 manual-release
session — and both declare `"@uwmd/core": "1.3.0"`. Anyone running
`npm install @uwmd/excel` or `@uwmd/report` today gets a build many minors
behind this repo, pinned to a core nine minors old.

Nothing caught it: `verify-versions` reconciles the manifests against
`VERSIONS.md` and never contacts the registry, so the claim was never checked
against what npm actually serves. The matrix is corrected in the same commit as
this file.

`@uwmd/report` was not part of the original question, but it has the identical
defect from the identical cause, so it is included here. Drop the second command
if you want excel handled alone.

### Commands

Your local token is expired, so log in first:

```
npm login
```

Then:

```
npm deprecate @uwmd/excel@0.3.0 "Not maintained at this version. @uwmd/excel is developed in UWMD-OSP/UW-Markdown and is not currently published; this 0.3.0 was a stray 2026-08-16 publish pinned to @uwmd/core 1.3.0. Use the repository."
```

```
npm deprecate @uwmd/report@0.3.0 "Not maintained at this version. @uwmd/report is developed in UWMD-OSP/UW-Markdown and is not currently published; this 0.3.0 was a stray 2026-08-16 publish pinned to @uwmd/core 1.3.0. Use the repository."
```

Deprecation is reversible — `npm deprecate <pkg>@0.3.0 ""` clears it. It does
not unpublish, so nothing already installed breaks; new installs simply warn.

### What "done" looks like

```
npm view @uwmd/excel@0.3.0 deprecated
npm view @uwmd/report@0.3.0 deprecated
```

Each prints the message rather than nothing.

## What to bring back

Confirmation that both deprecations took, so `VERSIONS.md` can move from
"pending deprecation" to "deprecated" in the release commit.

**The release is paused until this comes back** — not because the tag depends on
it, but because the version matrix should tell the truth about the registry in
the same release that publishes from it.
