# HUMAN: record the single-maintainer continuity arrangements

**Why you, why now.** The launch-readiness review flagged the
single-maintainer bus factor: if the sole maintainer is unavailable,
nobody can publish, fix a security issue, or transfer control of the
npm org, the GitHub org, or the `uwmd.org` domain. The *note* is easy;
the *arrangements* it records are personal decisions and account
actions only you can make.

## The decisions (yours alone)

1. **Successor or dead-man's policy.** Either name a person who gets
   access if you're unavailable for N months, or state explicitly that
   the project's continuity plan is its MIT license + public repo
   ("anyone may fork; the npm org may go dormant"). Both are
   legitimate; saying nothing is the only wrong answer.
2. **Account recovery.** Ensure the `UWMD-OSP` GitHub org and `@uwmd`
   npm org each have either a second owner account or documented
   recovery (e.g., recovery codes in the same estate arrangements as
   your other credentials). The `uwmd.org` registrar account likewise.
3. **Security contact continuity.** Whoever inherits also inherits the
   security@uwmd.org promise (see `HUMAN-security-alias.md`).

## The step (~15 minutes once decided)

Paste something like the following into `MAINTAINERS.md` (adjust to
your actual decisions — the agent can wordsmith once the substance is
decided, but should not invent it):

```markdown
## Continuity

UW Markdown currently has a single maintainer. The continuity plan:

- The specification, corpus, and reference implementation are MIT
  licensed and fully public; the project is forkable at any time and
  no private infrastructure is required to use or implement it.
- <Named successor / or: no successor is currently named.> If the
  maintainer is unresponsive for <N> months, <successor> gains owner
  access to the GitHub org, the @uwmd npm org, and uwmd.org
  <or: the community should treat the org as dormant and fork>.
- npm publishes are tag-triggered via OIDC trusted publishing; no
  tokens exist to leak or inherit. Control of publishing IS control
  of the GitHub org.
```

## When done

- MAINTAINERS.md carries the continuity section reflecting your actual
  decisions; the status doc's "single-maintainer bus factor" flag
  comes off; delete this file in the same PR.
