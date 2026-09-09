# Maintainers

This file lists the people with commit access to UW Markdown and what
they own. See [`GOVERNANCE.md`](./GOVERNANCE.md) for how maintainers
are added and how decisions get made.

## Current maintainers

| Handle | Role | Areas of ownership |
|---|---|---|
| [@jaredmaxey](https://github.com/jaredmaxey) | BDFL | Everything (spec, `@uwmd/core`, conformance corpus, tools, governance) |

UW Markdown is currently a solo project. Maintainer additions follow
the promotion path documented in [`GOVERNANCE.md`](./GOVERNANCE.md#promotion-path).

## Areas of ownership

When the maintainer count grows, the following areas get assigned
owners (reflected in [`.github/CODEOWNERS`](./.github/CODEOWNERS)):

- **Format spec** — `spec/UW_FORMAT_SPEC_v1.md`
- **Protocol spec** — `spec/UW_PROTOCOL_v1.md`
- **JSON Schemas** — `spec/schemas/**`
- **Reference library** — `packages/uwmd-core/`
- **Conformance corpus** — `conformance/`, `scripts/run-conformance.mjs`
- **Web viewer** — `tools/web-viewer/`
- **CI / release tooling** — `.github/workflows/`, `scripts/`
- **Governance docs** — `GOVERNANCE.md`, `CONTRIBUTING.md`, `MAINTAINERS.md`,
  `SECURITY.md`, `CODE_OF_CONDUCT.md`, `ROADMAP.md`

## Continuity

UW Markdown currently has a single maintainer. The continuity plan,
decided by the owner on 2026-09-09:

- The specification, the conformance corpus, and the reference
  implementation are MIT licensed and fully public. The project is
  forkable at any time, and no private infrastructure is required to
  use, implement, or certify against it. **That is the plan.**
- **No successor is currently named.** If the maintainer is
  unresponsive for **six months** — no commits, no releases, and no
  reply to a security report or a pinned issue — the community should
  treat the `UWMD-OSP` GitHub org, the `@uwmd` npm org, and `uwmd.org`
  as dormant and fork. A fork that keeps the conformance corpus is a
  conforming implementation; nothing about conformance depends on this
  org staying alive.
- npm publishes are tag-triggered via OIDC trusted publishing; no
  long-lived tokens exist to leak or inherit. Control of publishing IS
  control of the GitHub org.
- The [`security@uwmd.org`](./SECURITY.md) promise ends with the
  maintainer under this plan: after the six-month threshold, report
  vulnerabilities against the fork you use.
- Account recovery for the three accounts above is the maintainer's
  responsibility and lives outside this repository.

Naming a successor, or shortening the threshold, is an edit to this
section and a note in `CHANGELOG.md`; it is not a governance change.

## Emeritus maintainers

None yet.

## Contact

For security reports: see [`SECURITY.md`](./SECURITY.md).
For everything else: open an issue or PR.
