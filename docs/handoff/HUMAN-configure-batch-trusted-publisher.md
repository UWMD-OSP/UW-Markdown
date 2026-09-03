# HUMAN: configure the `@uwmd/batch` trusted publisher for the v2.3.0 tag

**Why you, why now.** The owner decision of 2026-09-03 is to publish
`@uwmd/batch` (0.8.0, never published) so the underwriter.cc screener can
`npx @uwmd/batch` without cloning the repo. `release.yml` now publishes it on
every `v*` tag whenever its manifest version is not already on npm — the
**v2.3.0 tag will attempt this publish**. Authentication is npm trusted
publishing (OIDC): there is no token, and only an npm account owner can create
the trusted-publisher binding. No agent can do this step.

## The step (~3 minutes, on npmjs.com)

`@uwmd/batch` has never been published, so — exactly as with `@uwmd/signing`
at 1.9.0 — the binding is created either up front or after a manual bootstrap:

1. Sign in to npmjs.com as the `@uwmd` org owner.
2. If npm offers **org-level → Packages → Add trusted publisher** (newer UI):
   create one for package name `@uwmd/batch` directly.
3. Otherwise the first publish must be manual to create the package, then bind:
   - `cd packages/uwmd-batch && npm publish --access public` from a logged-in
     machine (`npm login` first). This puts 0.8.0 live.
   - Then: package page → **Settings → Trusted publisher → GitHub Actions**.
4. Binding values (identical to core/cli/signing):
   - Organization or user: `UWMD-OSP`
   - Repository: `UW-Markdown`
   - Workflow filename: `release.yml` (filename only, with `.yml`)
   - Allowed actions: publish
   - Environment: leave blank

## What happens if you skip it

The v2.3.0 tag publishes `@uwmd/core`, `@uwmd/cli`, and `@uwmd/signing`
normally (they run first) and then the `@uwmd/batch` step fails with
`ENEEDAUTH`. Recovery is clean: configure the publisher, then **re-run the
failed job** — every publish step skips versions already live, so the re-run
finishes batch without conflicting on the others.

## When done

- Verify: `npm view @uwmd/batch` resolves and the package page shows the
  trusted publisher.
- Delete this file (and the long-stale
  `HUMAN-configure-signing-trusted-publisher.md`, whose step completed at
  1.9.0) in the PR that records the verification.
