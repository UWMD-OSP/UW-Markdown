# HUMAN: choose and enable the public RFC comment venue

**Why you, why now.** [`GOVERNANCE.md`](../../GOVERNANCE.md) promises a
14-day comment window once collaborative governance activates, and the
launch-readiness review flagged that no public venue exists for those
comments. Picking the venue is a governance decision, and enabling it
is a repo admin setting — both owner-only.

## The decision

**Recommended: GitHub Discussions on this repo, with an "RFCs"
category.** Reasons: zero new infrastructure, same identity as issues
and PRs, threads survive and are linkable from RFC frontmatter, and it
keeps the existing rule ("discussion happens in the relevant issue,
RFC, or pull request") intact — Discussions just adds the pre-PR,
open-comment space the 14-day window needs.

Alternatives if you prefer: a pinned "RFC discussion" issue label
(lowest friction, but threads get noisy), or an external forum
(rejected implicitly by the no-new-infrastructure bias — more to
moderate, split identity).

## The step (~5 minutes, on github.com)

1. Repo → Settings → General → Features → check **Discussions**.
2. In the Discussions tab, create a category **RFCs** (Announcement
   type is fine — maintainers open a thread per RFC; anyone replies).
3. Open one seed thread ("RFC process — start here") linking
   `docs/rfcs/README.md`.

## When done

- Tell the agent (or note in the PR): GOVERNANCE.md's discussion
  section and `docs/rfcs/README.md` should gain one line pointing at
  the Discussions category, and the status doc's "no public RFC venue"
  flag comes off. Delete this file in that PR.
