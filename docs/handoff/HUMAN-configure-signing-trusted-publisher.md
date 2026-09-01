# HUMAN: configure the `@uwmd/signing` trusted publisher before the next `v*` tag

**Why you, why now.** The owner decision of 2026-09-01 is to publish
`@uwmd/signing` (currently 0.1.0, unpublished). `release.yml` now publishes it
on every `v*` tag whenever its manifest version is not already on npm — so the
**next release tag (1.9.0) will attempt this publish**. Authentication is npm
trusted publishing (OIDC): there is no token, and only an npm account owner
can create the trusted-publisher binding. No agent can do this step.

## The step (~3 minutes, on npmjs.com)

`@uwmd/signing` has never been published, and npm only shows Trusted Publisher
settings for an existing package — so the binding is created at first publish
or via the org's publishing settings, depending on npm's current UI:

1. Sign in to npmjs.com as the `@uwmd` org owner.
2. If npm offers **org-level → Packages → Add trusted publisher** (newer UI):
   create one for package name `@uwmd/signing` directly.
3. Otherwise the first publish must be manual to create the package, then bind:
   - `cd packages/uwmd-signing && npm publish --access public` from a logged-in
     machine (`npm login` first). This puts 0.1.0 live.
   - Then: package page → **Settings → Trusted publisher → GitHub Actions**.
4. Binding values (identical to core/cli):
   - Organization or user: `UWMD-OSP`
   - Repository: `UW-Markdown`
   - Workflow filename: `release.yml` (filename only, with `.yml`)
   - Allowed actions: publish
   - Environment: leave blank

## What happens if you skip it

The next `v*` tag publishes `@uwmd/core` and `@uwmd/cli` normally (they run
first, as a matched pair) and then the `@uwmd/signing` step fails with
`ENEEDAUTH`. Recovery is clean: configure the publisher, then **re-run the
failed job** — every publish step skips versions already live, so the re-run
finishes signing without conflicting on core/cli.

## When done

- Verify: `npm view @uwmd/signing` resolves (after the first publish) and the
  package page shows the trusted publisher.
- Delete this file in the same PR that records the verification, and update
  the `@uwmd/signing` row in `VERSIONS.md` from "(unpublished)" when 0.1.0 is
  actually live.
