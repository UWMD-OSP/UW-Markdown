# HUMAN: release 2.18.0

Everything an agent can do for 2.18.0 is prepared. The steps below need your
GitHub merge rights, your npm account, or your authority to tag. Do them in
order; each one says what to bring back.

**What ships:** core/CLI **2.18.0**, Protocol **2.22.0**, Format **2.0**.
- **RFC 0071:** `is_calendar_date`.
- **RFC 0074:** dependent module overrides.
- **Also:** the §VII.3 unrelated-conflict refusal, CLI reporting clarity, the
  `uwmd init` and `--version` fixes, and the early-year day-count fix.
- **Packages:** signing **0.2.22** and batch **0.8.17**. It is also the first
  publication of `@uwmd/module-hospitality` and `@uwmd/module-data-center`,
  both **0.1.10**.

## 1. Merge the three feature PRs: done

You merged #272, #273 and #274 on 2026-10-06. Merging #273 accepted RFC 0074.
The preparation is rebased onto that `main`, and its tree is byte-identical
to the one that passed the full gate.

## 2. Create the two module packages on npm (new: ~20 minutes)

Neither module name exists on the registry. On 2026-10-05,
`npm view @uwmd/module-hospitality` and `npm view @uwmd/module-data-center`
both returned 404. npm lets you configure a trusted publisher only on a
package that already exists. So without this step, the `v2.18.0` tag would
publish core, CLI, signing and batch, then fail on both modules, leaving a
partial release.

Follow [wiki 11, "Account prerequisite / bootstrap"](../wiki/11-build-release-governance.md#official-first-party-module-distribution).
In short:

- **Placeholder.** For each module, create the package with a disposable
  bootstrap prerelease. Use npm's
  [staged publishing](https://docs.npmjs.com/staged-publishing/), which needs
  npm **>= 11.15.0** and Node **>= 22.14.0** locally.
  - The placeholder must contain **no module implementation**.
  - It must **never** use version `0.1.10`, because a staged version
    reserves that number. The wiki's example is `0.0.0-stage`.
  - Do not approve the placeholder as a real release.
- **Visibility.** Confirm both packages are public, in the `@uwmd` scope you
  can publish to.
- **Stop condition.** If the placeholder does not let you open
  **Settings → Trusted Publisher**, stop and tell me. Do not hand-publish a
  real module version to work around it.

**Bring back:** the placeholder version you used for each package, and
whether it is visible on the registry.

## 3. Trusted publishers on all six packages

On npmjs.com, open each package's **Settings → Trusted Publisher**:

| Package | State |
|---|---|
| `@uwmd/core`, `@uwmd/cli`, `@uwmd/signing`, `@uwmd/batch` | existing; reconfirm |
| `@uwmd/module-hospitality`, `@uwmd/module-data-center` | **new**; configure |

Enter these values, literally:
- **Provider:** GitHub Actions
- **Organization:** `UWMD-OSP`
- **Repository:** `UW-Markdown`
- **Workflow:** `release.yml`
- **Allowed action:** `publish`
- **Environment:** *blank*

**Bring back:** "all six confirmed".

## 4. Merge the preparation PR

This is [#275](https://github.com/UWMD-OSP/UW-Markdown/pull/275), `release: prepare 2.18.0 (Protocol 2.22.0,
Format 2.0)`. It is one PR whose records are final and publication-neutral.
Merge it when its CI is green. The merge commit is the commit you tag.

## 5. Tag (only you can trigger the publish)

From an up-to-date `main` whose head is the preparation merge:

```bash
git checkout main
```

```bash
git pull --ff-only
```

```bash
npm run release:check
```

```bash
node scripts/verify-release.mjs --tag v2.18.0
```

If both pass:

```bash
git tag -a v2.18.0 -m "UWMD 2.18.0 (Protocol 2.22.0, Format 2.0)"
```

```bash
git push origin v2.18.0
```

The tag push is the trigger. `release.yml` publishes the six packages
sequentially. If a step fails partway, do not move the tag and do not hand
publish. Tell me what landed; wiki 11's recovery is to fix the prerequisite
and rerun the ordinary workflow.

**Bring back:** the release run URL.

## After the tag (agent work)

I run the independent post-publication verification for all six packages,
extending the 2.17.0 procedure to the modules. Then I write the reconciliation:
`### Released`, RFCs 0071 and 0074 to `implemented`, and Protocol 2.22.0 to
Stable.
