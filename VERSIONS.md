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
| `.uw.md` format spec | **1.1** | files declaring `uw_version: "1.0"` or `"1.1"` |
| UW Protocol | **1.11.0** | format ≥ 1.0 |
| `@uwmd/core` | **1.8.0** | format 1.1, protocol 1.11.0 |
| `@uwmd/cli` (CLI) | **1.8.0** | `@uwmd/core` 1.8.0 |
| `@uwmd/excel` | **0.7.0** | `@uwmd/core` 1.8.x, format 1.1 multifamily pack |
| `@uwmd/report` | **0.7.0** | `@uwmd/core` 1.8.x, format spec §7.1/§7.2 |
| `@uwmd/batch` | **0.6.0** | `@uwmd/core` 1.8.x, `.uwx.md` collections |
| `@uwmd/signing` | **0.1.0** (unpublished) | `@uwmd/core` 1.8.x, protocol §V.11 |
| `@uwmd/module-hospitality` | **0.1.0** (unpublished) | `@uwmd/core` 1.8.x, protocol §X module system |
| `tools/web-editor` | **0.7.0** (private) | `@uwmd/core` 1.8.x browser entry |
| `tools/web-viewer` | n/a (single-file HTML, no package) | format ≥ 1.0 |
| `tools/vscode-uwmd` | **0.2.0** | format 1.1 |

## Planned 1.1+ interchange train

Accepted RFC 0014 defines a coordinated but independently versioned release train:

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

These are candidate versions, not the current compatibility matrix. They become
authoritative only after RFC acceptance, implementation, conformance, and the
corresponding release entry in `CHANGELOG.md`. See the
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

| If you're building... | Pin to... |
|---|---|
| A read-only viewer | format ≥ 1.0, protocol ≥ 1.0, `@uwmd/core@^1` |
| An editor | format ≥ 1.1, protocol ≥ 1.1, `@uwmd/core@^1` |
| A calc host | format = 1.1, protocol = 1.1, `@uwmd/core@^1.0`, multifamily pack 1.x |
| An agent host | format ≥ 1.1, protocol ≥ 1.1, `@uwmd/core@^1`, plus an LLM SDK of your choice — `@anthropic-ai/sdk` is an optional peer, installed only if you use the bundled Anthropic provider |
| A CLI script that calls `uwmd` | `@uwmd/cli@^1` |

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
