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

Release 2.19.0 pairs core/CLI 2.19.0 with Protocol 2.23.0 and Format 2.0.
Protocol 2.23.0 carries two accepted RFCs: RFC 0075's `senior` preference
when the hedge and escrow rules read `debt_structure`, and RFC 0076's
`HDG-08` refusal of a stated hedge whose loan or cash lines cannot be selected
(§V.12.1). Neither adds a module capability, so no new §X `requires_protocol`
floor applies. Format stays 2.0: RFC 0077 defines
`exit_analysis.net_proceeds_to_equity` and adds two optional fields (§4.9).
The generation also includes the SDK-free strict TypeScript declarations for
the optional Anthropic provider. Signing 0.2.23, batch 0.8.18, Excel 0.9.11,
report 0.8.23, lake 0.2.7 and both module packages 0.1.11 pin core 2.19.0
exactly. Core's optional signing peer is 0.2.23. The workflow scope is core,
CLI, signing, batch and both module packages. Excel, report and lake remain
source-only. Module manifest contracts remain 0.1.0. Release preparation and
subsequent publication evidence are separate records.

Release 2.18.0 pairs core/CLI 2.18.0 with Protocol 2.22.0 and Format 2.0.
Protocol 2.22.0 carries two RFCs:
RFC 0071's `is_calendar_date` predicate (§VIII.3), and RFC 0074's dependent
declaration overrides (§VII.3). Each comes with a §X `requires_protocol` floor of
`>=2.22.0`. The generation also includes the refusal of unrelated §VII.3
declaration conflicts, CLI validation and receipt reporting clarity, and the
`uwmd init` and `--version` fixes. Signing 0.2.22, batch 0.8.17, Excel
0.9.10, report 0.8.22, lake 0.2.6 and both module packages 0.1.10 pin core
2.18.0 exactly. Core's optional signing peer is 0.2.22. The workflow scope is
core, CLI, signing, batch and both module packages. For the modules, 0.1.10
is their first public generation. Excel, report and lake remain source-only.
Module manifest contracts remain 0.1.0. RFCs 0071 and 0074 are implemented;
Protocol 2.22.0 is Stable. Core/CLI 2.18.0, signing 0.2.22, batch 0.8.17 and
both modules 0.1.10 are published from immutable annotated `v2.18.0` on
`4e0a8c18091377fa25800dc2b16954a636be1d83` through trusted publishing with
provenance. Release run 37795279528 succeeded; all registry versions, `latest`,
`gitHead`, signatures, attestations, Rekor checks, 482 published files, 210
delivered-CLI portable cases and an isolated consumer of both modules were
independently verified. No other package generation shipped. Preparation and
[publication evidence](https://github.com/UWMD-OSP/UW-Markdown/blob/main/docs/releases/2.18.0-publication.md)
remain separate records.

Release 2.17.0 pairs core/CLI 2.17.0 with Protocol 2.21.0 and Format 2.0.
Protocol 2.21.0 carries RFC 0070's closed replacement-funding union and exact
modeled-payment binding, with synchronous structural validation and separate
async digest verification. RFC 0070 is implemented; Protocol 2.21.0 is Stable.
Its implementation merged via PR #245 at
`d83837d2dc3049ffeadb5f27a42e3f0deb2b83af`. The generation also
includes the subsequently merged multifamily pack 1.0.1 deal-level cash-on-cash
correction. Signing 0.2.21, batch 0.8.16, Excel 0.9.9, report 0.8.21, lake
0.2.5 and both module packages 0.1.9 pin core 2.17.0 exactly. Core's optional
signing peer is 0.2.21. The workflow scope remains core, CLI, signing and
batch; the other package generations remain source-only. Module manifest
contracts remain 0.1.0. Core/CLI 2.17.0, signing 0.2.21 and batch 0.8.16 are
published from immutable annotated `v2.17.0` on
`98dc5e4a040cf04f7b907a76e3d83825868d1d9f` through trusted publishing with provenance.
Release run 37172975077 succeeded; all registry versions, `latest`, `gitHead`,
signatures, attestations, Rekor checks, 462 published files and 158 delivered-CLI
portable cases were independently verified. No other package generation shipped.
Preparation and [publication evidence](https://github.com/UWMD-OSP/UW-Markdown/blob/main/docs/releases/2.17.0-publication.md)
remain separate records.

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
| UW Protocol | **2.23.0** | format ≥ 1.0; RFC 0075 hedge `senior` preference and RFC 0076 refused-selection `HDG-08` on 2.22.0; carried by core/CLI 2.19.0 |
| `@uwmd/core` | **2.19.0** | format 2.0 (reads 1.x), protocol 2.23.0 |
| `@uwmd/cli` (CLI) | **2.19.0** | `@uwmd/core` 2.19.0 |
| `@uwmd/excel` | **0.9.11** (source only; stale `0.3.0` on the registry, deprecated 2026-10-02) | `@uwmd/core` 2.19.0, format 2.0, explicit contextual calculations |
| `@uwmd/report` | **0.8.23** (source only; stale `0.3.0` on the registry, deprecated 2026-10-02) | `@uwmd/core` 2.19.0, format spec §7.1/§7.2 |
| `@uwmd/batch` | **0.8.18** | `@uwmd/core` 2.19.0, `.uwx.md` collections + corpus fact table (first published at 0.8.0, 2026-09-03) |
| `@uwmd/lake` | **0.2.7** (source only) | `@uwmd/core` 2.19.0, RFC 0049 warehouse projection; no database driver dependency. Lake schema **0.2** — not backward compatible with 0.1, which could not load a container fact |
| `@uwmd/signing` | **0.2.23** | `@uwmd/core` 2.19.0, protocol §V.11 + §XIV capability tokens (0.1.0 published 2026-09-01 pairs core 1.8.x) |
| `@uwmd/module-hospitality` | **0.1.11** | `@uwmd/core` 2.19.0, protocol §X module system |
| `@uwmd/module-data-center` | **0.1.11** | `@uwmd/core` 2.19.0, protocol §X module system + §X.2 declared class `org.uwmd.data_center` (RFC 0039) |
| `tools/web-editor` | **0.8.0** (private) | `@uwmd/core` 2.19.0 browser entry |
| `tools/web-viewer` | n/a (single-file HTML, no package) | format ≥ 1.0 |
| `tools/vscode-uwmd` | **0.2.0** | format 1.1 |


### Official module compatibility

The owner approves hospitality and data-center together as official first-party
public npm packages. Distribution support is in the ordinary tag workflow.
Neither module was published in 2.17.0 or earlier; 0.1.10, pairing core 2.18.0,
is their first public generation.

Package semver identifies an immutable npm artifact. Contract `version` identifies
the manifest contract required by document `modules[].version` and module
`depends_on`; it is not an npm version or an installation instruction.
`manifest_version` identifies the manifest schema. These three do not move in
lockstep. Exact core repins require new package versions, while contract versions
stay unchanged absent an actual contract change. The ranges below are the existing
manifest compatibility requirements, not a new loader policy.

| Module package | Module ID | Package version | Contract version | manifest_version | requires_protocol | requires_format | requires_tier | Core pin |
|---|---|---|---|---|---|---|---|---|
| `@uwmd/module-hospitality` | `org.uwmd.hospitality` | **0.1.11** | **0.1.0** | `1` | `>=1.0.0` | `>=1.1` | `tier-3-calc-host` | `2.19.0` |
| `@uwmd/module-data-center` | `org.uwmd.datacenters` | **0.1.11** | **0.1.0** | `1` | `>=2.5.0` | `>=1.1` | `tier-3-calc-host` | `2.19.0` |

Data-center's declared asset class remains `org.uwmd.data_center`, distinct from
its module ID. `verify-versions` reads typed source literals and package manifests
to check every column without requiring a build. `verify-packages` additionally
checks the built manifest against emitted JSON and the typed metadata.

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
