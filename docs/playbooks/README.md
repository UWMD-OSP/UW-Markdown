# Playbooks

How UW Markdown grows. Each playbook lists what a change of that kind must
deliver, in one pull request where possible, and how to tell it is finished.
They apply now and after the public launch.

| Playbook | Use it when |
|---|---|
| [Adding an official asset class](ADD_ASSET_CLASS.md) | The standard should know a new property type, with full builtin support |
| [Adding or changing a metric](ADD_METRIC.md) | A dictionary metric is added, or an existing definition changes |
| [Third-party modules](THIRD_PARTY_MODULE.md) | Someone outside the project extends UW Markdown for their own class or calculations |
| [Release rules after launch](RELEASE_RULES.md) | Versions, deprecations, comment windows, keys and disclosure once 5.0.0 ships |

Background these playbooks rely on:

- [GOVERNANCE.md](../../GOVERNANCE.md): owner-led and collaborative modes, and
  what a normative change needs.
- [CONTRIBUTING.md](../../CONTRIBUTING.md): local development, RFCs and the PR
  checklist.
- [VERSIONS.md](../../VERSIONS.md): the three version streams and the launch rule.
- Wiki [11, Build, release and governance](../wiki/11-build-release-governance.md),
  including "When does my change need an RFC?".
- Wiki [12, Recipes](../wiki/12-recipes.md): smaller, single-step changes.
