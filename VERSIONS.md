# Versions

UW Markdown ships three independently-versioned surfaces. The format
spec, the protocol spec, and each implementation package each carry
their own semver per the policy in
[CHANGELOG.md](CHANGELOG.md#versioning). This file is the
authoritative compatibility matrix.

## Why three streams?

A format change is not an implementation change. Adopters who write
their own parsers/validators need to pin against the *format* version,
not the reference library version. The reference library will release
patches and features faster than the format will evolve; tying them
together would force every adopter to track every library release.

The same logic applies to the protocol: a Tier-2 editor and a Tier-3
calc host can be released independently as long as both honor the
same protocol version.

## Current matrix

| Surface | Version | Pairs with |
|---|---|---|
| `.uw.md` format spec | **2.0** | authors `uw_version: "2.0"`; reads `"1.0"` / `"1.1"` / `"2.0"` (format v2 §1.2) |
| UW Protocol | **2.8.0** | format ≥ 1.0 (explicit period addressing, RFC 0041; unreleased implementation) |
| `@uwmd/core` | **2.6.2** | format 2.0 (reads 1.x), protocol 2.8.0 in source; published 2.6.2 pairs with 2.6.0 |
| `@uwmd/cli` (CLI) | **2.6.2** | `@uwmd/core` 2.6.2 |
| `@uwmd/excel` | **0.8.10** | `@uwmd/core` 2.6.x, format 1.1 multifamily pack |
| `@uwmd/report` | **0.8.10** | `@uwmd/core` 2.6.x, format spec §7.1/§7.2 |
| `@uwmd/batch` | **0.8.5** | `@uwmd/core` 2.6.x, `.uwx.md` collections + corpus fact table (first published at 0.8.0, 2026-09-03) |
| `@uwmd/signing` | **0.2.10** | `@uwmd/core` 2.6.x, protocol §V.11 + §XIV capability tokens (0.1.0 published 2026-09-01 pairs core 1.8.x) |
| `@uwmd/module-hospitality` | **0.1.0** (unpublished) | `@uwmd/core` 2.6.x, protocol §X module system |
| `@uwmd/module-data-center` | **0.1.0** (unpublished) | `@uwmd/core` 2.6.x, protocol §X module system + §X.2 declared class `org.uwmd.data_center` (RFC 0039) |
| `tools/web-editor` | **0.8.0** (private) | `@uwmd/core` 2.6.x browser entry |
| `tools/web-viewer` | n/a (single-file HTML, no package) | format ≥ 1.0 |
| `tools/vscode-uwmd` | **0.2.0** | format 1.1 |

## Historical 1.1+ interchange release plan

The table below preserves the original RFC 0014 release plan and its then-current
statuses. It is historical, not a list of outstanding work; use the current matrix
above and the changelog for shipped versions.

| Surface | Candidate version | Status |
|---|---:|---|
| `.uw.md` format | 1.1 (unchanged) | No syntax change proposed. |
| UW Protocol | 1.2.0 | Representation descriptors, negotiation, and HTTP/MCP binding profiles implemented. |
| `@uwmd/core` | 1.1.0 | Envelope 1.0, JSON/XML/CSV codecs, digest helpers, registry, and binding adapters implemented. |
| `@uwmd/cli` | 1.1.3 | `formats`, digested export, and Markdown/JSON/XML/CSV `convert` implemented. |
| UW Document Envelope | 1.0 | Stable schema and core implementation complete; not yet published. |
| UW JSON mapping | 1.0.0 | Core implementation complete; release pending. |
| UW XML mapping | 1.0.0 | Deterministic mapping, secure codec, XSD, and conversion tests implemented; release pending. |
| UW CSV bundle | 1.0.0 | Normalized model codec, safe deterministic ZIP, and six views implemented; release pending. |
| HTTP binding | 1.0.0 | Optional companion profile, OpenAPI 3.1 contract, and core adapters implemented; release pending. |
| MCP binding | 1.0.0 | Optional companion profile, resources/tool shapes, and reference adapters implemented; release pending. |

These were candidate versions when the plan was written. See the
[1.1+ interchange release plan](docs/releases/1.1-plus-interchange-plan.md).

## Compatibility rules

1. **Format minor versions are additive.** A 1.2 file may use new
   sections or fields that a 1.1 reader doesn't understand; the reader
   MUST still parse known sections per protocol §III.1 ("unknown
   sections render as default cards"). 1.x files must never break a
   1.0 reader's ability to read them.
2. **Protocol minor versions strengthen requirements monotonically.**
   A 1.1-conformant tool is automatically 1.0-conformant. New required
   behavior in a 1.x protocol is opt-in for 1.0 tools and becomes
   normative at the next major.
3. **Library majors require explicit re-pinning.** `@uwmd/core` 2.x
   may break the calling shape; 1.x will not. Patches and minors are
   safe to update through normal `npm install`.
4. **The format and protocol majors move together.** A `.uw.md` v2
   file requires UW Protocol v2 to be fully read.

## Pinning recommendations

For new integrations, target Format 2.0 and the current Protocol 2.x contract
listed above. Pin `@uwmd/core@^2` for readers, editors, calc hosts, and agent hosts,
or `@uwmd/cli@^2` for CLI scripts. Readers retain the documented 1.x format
compatibility. An agent host installs a provider SDK only if it uses that provider;
`@anthropic-ai/sdk` remains an optional peer.

## Release coordination

When a release crosses surfaces (e.g. a format minor that requires
library changes), the order is:

1. Spec change merged to `main` with the new version number.
2. Schemas updated and validated in CI.
3. Library release on the matching version.
4. Tools that depend on the new behavior bumped to consume the new
   library.
5. CHANGELOG entry summarizing the cross-surface release.

Single-surface releases (a library patch with no spec change, a
tools-only fix) follow normal semver and don't need coordination.

## History

For per-release details see [CHANGELOG.md](CHANGELOG.md). For why a
specific design was made the way it was, see
[`docs/rfcs/`](docs/rfcs/) or the relevant spec section.
