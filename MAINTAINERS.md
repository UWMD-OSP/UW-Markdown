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

## Emeritus maintainers

None yet.

## Contact

For security reports: see [`SECURITY.md`](./SECURITY.md).
For everything else: open an issue or PR.
