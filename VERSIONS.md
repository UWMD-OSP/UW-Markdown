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

Release 2.16.0 pairs core/CLI 2.16.0 with Protocol 2.20.0 and Format 2.0.
Protocol 2.20.0 adds RFC 0069's four optional top-level student-housing
`rent_roll` fields: `occupied_beds`, `preleased_beds`, `preleased_as_of`
and `preleased_term_start`. The `BED-NN` error family validates a stated
count's type, capacity and measurement dates. Pack formulas are unchanged.
RFC 0069 is implemented; Protocol 2.20.0 is stable. Core/CLI 2.16.0, signing
0.2.20 and batch 0.8.15 are published from the immutable `v2.16.0` tag on
`a1ca815e2aee5da374caf7627ba3702849ecd257`, through trusted publishing with
SLSA provenance. Signing and batch pin core 2.16.0 exactly. Release run
37075007121 succeeded; registry `latest`, `gitHead`, signatures, attestations,
Rekor records, published file comparisons and all 101 delivered-CLI portable
cases were independently verified. The other package generations are source-only.
Publication evidence is recorded separately from the tagged preparation tree.

Release 2.15.0 paired core/CLI 2.15.0 with Protocol 2.19.0 and Format 2.0.
Protocol 2.19.0 adds RFC 0066. Ordinary calc identifiers select one block of a
variant-map section by §VIII.2: an explicit variant, then the calculation's
declared `section_roles`, then RFC 0040's generic order. Ambiguity refuses as
`CALC-RESOLVE-002` instead of a silent `null`. The cascade, refinement and the
Excel converter share that selection. Jared's owner decisions of 2026-10-02
(D1–D3) set that contract and the 2.15.0 target; RFC 0066 is now
`implemented`. Core/CLI 2.15.0, signing 0.2.19 and batch 0.8.14 are published
from the `v2.15.0` tag with SLSA provenance through trusted publishing (OIDC).
The release workflow publishes those four and no others.

Release 2.14.0 paired core/CLI 2.14.0 with Protocol 2.18.0 and Format 2.0.
Protocol 2.18.0 adds RFC 0063's explicit final-period exclusive-boundary
admission to the **2.17.1** RFC 0062 same-day errata. Jared accepted both RFCs
on 2026-09-24 (RFC 0063 at `f04b34a`); they integrated on canonical `main` at
`e49eb43` and `413a645` and are now `implemented`. The 2.17.1 errata decision
remains recorded below. Core/CLI 2.14.0, signing 0.2.18 and batch 0.8.13 were
published from the `v2.14.0` tag.

Release 2.13.0 paired core/CLI 2.13.0 with Protocol 2.17.0 and Format 2.0.
Protocol 2.17.0 added §VIII.10 step 5 and the `WF-10`–`WF-15` clawback codes
(RFC 0059) and the `REC-NN` recovery family (RFC 0058), on top of the
`LSE-NN` / `HDG-NN` / `ESC-NN` / `CAPX-NN` families 2.15.0 registered.
The reference modules have never been published. Excel and report are
**not published at their current versions**, but the registry does serve a stale
`0.3.0` of each, pushed by hand on 2026-08-16 during the 1.3.0 manual release and
never unwound; both declare `@uwmd/core` `1.3.0`. Neither is maintained at that
version. Jared deprecated both on 2026-10-02, and the registry shows the
deprecation message on each `0.3.0`. `verify-versions` reconciles the
manifests against this file and never contacts the registry, which is why the
earlier flat "unpublished" claim went unchallenged. Module package 0.1.1 only repins core; the typed module manifests
retain their independent 0.1.0 contract version. Package, Format and Protocol
versions advance independently.

| Surface | Version | Pairs with |
|---|---|---|
| `.uw.md` format spec | **2.0** | authors `uw_version: "2.0"`; reads `"1.0"` / `"1.1"` / `"2.0"` (format v2 §1.2) |
| UW Protocol | **2.20.0** | format ≥ 1.0; RFC 0069 student bed counts (`BED-NN`) on 2.19.0; carried by core/CLI 2.16.0 |
| `@uwmd/core` | **2.16.0** | format 2.0 (reads 1.x), protocol 2.20.0 |
| `@uwmd/cli` (CLI) | **2.16.0** | `@uwmd/core` 2.16.0 |
| `@uwmd/excel` | **0.9.8** (source only; stale `0.3.0` on the registry, deprecated 2026-10-02) | `@uwmd/core` 2.16.0, format 2.0, explicit contextual calculations |
| `@uwmd/report` | **0.8.20** (source only; stale `0.3.0` on the registry, deprecated 2026-10-02) | `@uwmd/core` 2.16.0, format spec §7.1/§7.2 |
| `@uwmd/batch` | **0.8.15** | `@uwmd/core` 2.16.0, `.uwx.md` collections + corpus fact table (first published at 0.8.0, 2026-09-03) |
| `@uwmd/lake` | **0.2.4** (source only) | `@uwmd/core` 2.16.0, RFC 0049 warehouse projection; no database driver dependency. Lake schema **0.2** — not backward compatible with 0.1, which could not load a container fact |
| `@uwmd/signing` | **0.2.20** | `@uwmd/core` 2.16.0, protocol §V.11 + §XIV capability tokens (0.1.0 published 2026-09-01 pairs core 1.8.x) |
| `@uwmd/module-hospitality` | **0.1.8** (source only) | `@uwmd/core` 2.16.0, protocol §X module system |
| `@uwmd/module-data-center` | **0.1.8** (source only) | `@uwmd/core` 2.16.0, protocol §X module system + §X.2 declared class `org.uwmd.data_center` (RFC 0039) |
| `tools/web-editor` | **0.8.0** (private) | `@uwmd/core` 2.16.0 browser entry |
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

### RFC 0062 errata treatment (released in 2.14.0)

The owner selected Protocol 2.17.1 for reconciliation of contradictory released
requirements. This patch changes PS-02 applicability and permits unique-date
cash-flow selection despite duplicate dates elsewhere. It does not claim
byte-identical validation verdicts with 2.17.0. The existing minor-version
monotonicity rule does not resolve contradictory requirements; this narrowly
recorded erratum reconciles them without general relaxation of period rules.
See [RFC 0062](docs/rfcs/0062-same-day-cash-flow-selection.md), accepted by Jared
on 2026-09-24 and released in core/CLI 2.14.0 on 2026-10-02. This is not a
blanket patch policy for new
protocol features.

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

Whatever the release, the commit the tag lands on finalizes its generation in
this file. Its rows carry no `candidate`, `unreleased` or
`published <previous>` wording, and its prose stays publication-neutral, for
example "Release X.Y.Z pairs core/CLI X.Y.Z with Protocol P". It claims no
publication. The post-publication reconciliation adds the publication
statements and evidence. `npm run verify-release` and `release.yml` enforce
this; see "The three release states" in
`docs/wiki/11-build-release-governance.md`.

## History

For per-release details see [CHANGELOG.md](CHANGELOG.md). For why a
specific design was made the way it was, see
[`docs/rfcs/`](docs/rfcs/) or the relevant spec section.
