# HUMAN: ship 2.14.0 (owner-only steps)

> **Status 2026-10-02.** Every repository gate passed on `main` at `6ad146a`
> under the release toolchain (Node 22.14.0, npm 11.5.1); see the
> [pre-release review](../reviews/2026-09-28-2.14.0-pre-release.md).
>
> - **Step 1 is done.** Jared reconfirmed all four trusted publishers on
>   2026-10-02: GitHub Actions, `UWMD-OSP` / `UW-Markdown`, workflow
>   `release.yml`, environment blank.
> - **Step 2 is done.** The registry shows both deprecations.
> - **Step 3 is done.** Jared authorized `v2.14.0` the same day and authorized
>   the agent to push the annotated tag on the release commit once it is on
>   `main`.
>
> Nothing here changes code.

The tag `v2.14.0` publishes `@uwmd/core` 2.14.0, `@uwmd/cli` 2.14.0,
`@uwmd/signing` 0.2.18 and `@uwmd/batch` 0.8.13 via `release.yml`. No other
package publishes.

## 1. Reconfirm the four trusted publishers (npmjs.com, ~3 min) — **done 2026-10-02**

For each of `@uwmd/core`, `@uwmd/cli`, `@uwmd/signing`, `@uwmd/batch`, open
**Settings → Trusted Publisher**. It must read GitHub Actions,
`UWMD-OSP` / `UW-Markdown`, workflow `release.yml`, **no environment**. They
were confirmed on 2026-09-15. The repository cannot see this setting, and a
wrong one fails the publish after the tag is pushed.

## 2. Deprecate the two stray `0.3.0` packages — **done 2026-10-02**

Jared ran these commands. The registry now returns the message for both
versions, and `VERSIONS.md` records them as deprecated. Kept for the record:

```
npm login
npm deprecate @uwmd/excel@0.3.0 "Not maintained at this version. @uwmd/excel is developed in UWMD-OSP/UW-Markdown and is not currently published; this 0.3.0 was a stray 2026-08-16 publish pinned to @uwmd/core 1.3.0. Use the repository."
npm deprecate @uwmd/report@0.3.0 "Not maintained at this version. @uwmd/report is developed in UWMD-OSP/UW-Markdown and is not currently published; this 0.3.0 was a stray 2026-08-16 publish pinned to @uwmd/core 1.3.0. Use the repository."
npm view @uwmd/excel@0.3.0 deprecated
npm view @uwmd/report@0.3.0 deprecated
```

Each `npm view` must print the message, and on 2026-10-02 both did.
`npm deprecate <pkg>@0.3.0 ""` reverses it.

## 3. Authorize the tag — **done 2026-10-02**

After step 1, tell the agent "publishers confirmed, tag 2.14.0 authorized".
The agent then opens a one-commit release PR that dates the CHANGELOG heading;
the deprecation rows are already updated. After you merge it, either
authorize the agent to push the tag or push it yourself:

```
git fetch origin main
git tag -a v2.14.0 origin/main -m "UWMD 2.14.0 (Protocol 2.18.0)"
git push origin v2.14.0
```

Tag the merged release-PR commit, not an older one. The workflow refuses a
tag that does not match the manifests.

## 4. Afterwards (agent)

Once the workflow is green, the agent checks registry versions and
provenance, marks RFCs 0062 and 0063 `implemented` with the shipped version,
adds the CHANGELOG `### Released` block and reconciles `VERSIONS.md`,
the status wiki, the ROADMAP and active specs. You do nothing further.
