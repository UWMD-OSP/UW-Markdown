# Versions

Format and Protocol are separate normative surfaces. npm packages follow the
owner release rule below: prelaunch 4.x.x, then a coordinated 5.0.0 public launch.
From launch, people see one public number, **UWMD 5.x**, for the packages and the
standard; each record keeps declaring its Format version, and this file maps
every UWMD release to the Format and Protocol versions it carries
([release rules](docs/playbooks/RELEASE_RULES.md#one-public-number)).
This file also records the versions actually released.

## Current matrix

| Surface | Version | Pairs with |
|---|---|---|
| `.uw.md` format spec | **3.0** | authors and reads `uw_version: "3.0"` only; any other or absent version is `UNSUPPORTED_FORMAT_VERSION` (Format §2.2, Protocol §XII.3) |
| UW Protocol | **4.1.0** | format 3.0 only; RFC 0084 adds detached document snapshot authentication (§V.13) to the 4.0.0 contract; carried by core/CLI 4.3.0. Core/CLI 4.0.0, 4.0.1 and 4.1.0 carry Protocol 4.0.0 |
| `@uwmd/verify` | **0.2.1** | format 3.0, protocol 4.1.0; the reference implementation of the standard (RFC 0083), with no `@uwmd/*` dependency; `@uwmd/core` 4.3.0 depends on it exactly and re-exports it |
| `@uwmd/core` | **4.3.0** | format 3.0, protocol 4.1.0; `@uwmd/verify` 0.2.1 |
| `@uwmd/cli` (CLI) | **4.3.0** | `@uwmd/core` 4.3.0 |
| `@uwmd/excel` | **0.9.19** | `@uwmd/core` 4.3.0, format 3.0, explicit contextual calculations |
| `@uwmd/report` | **0.9.0** | `@uwmd/core` 4.3.0, format spec §7.1/§7.2 |
| `@uwmd/batch` | **0.9.2** | `@uwmd/verify` 0.2.1, `.uwx.md` collections + corpus fact table (first published at 0.8.0, 2026-09-03) |
| `@uwmd/lake` | **0.3.2** | `@uwmd/verify` 0.2.1, RFC 0049 warehouse projection; no database driver dependency. Lake schema **0.2** — not backward compatible with 0.1, which could not load a container fact |
| `@uwmd/signing` | **0.6.0** | `@uwmd/verify` 0.2.1 and `@uwmd/core` 4.3.0, protocol §V.11, §V.13 document snapshot signatures and §XIV capability tokens; signs and verifies `_meta.integrity` under the Format 3.0 block digest (0.1.0 published 2026-09-01 pairs core 1.8.x) |
| `tools/web-editor` | **0.8.0** (private) | `@uwmd/core` 4.3.0 browser entry |
| `tools/web-viewer` | n/a (single-file HTML, no package) | format 3.0 |
| `tools/vscode-uwmd` | **0.2.0** | format 3.0; `@uwmd/verify` 0.2.1 (`file:` link) |

Release 4.3.0 pairs core/CLI 4.3.0 with the unchanged Protocol 4.1.0 and
Format 3.0. Verifier 0.2.1 repairs capital-stack and lease-up comparison
quantization under the existing Protocol VIII.5 rule; receipts name
`@uwmd/verify` 0.2.1 as the engine. Core/CLI 4.3.0 reject unknown flags and
false verification. The CLI accepts `validate --stage` for stage readiness,
`export --compact` to omit superseded blocks, and `compose --parts` as an
output-directory alias.
Signing 0.6.0 and report 0.9.0 declare their Node 20 floor; Excel 0.9.19 preserves
source financial aggregates and discloses retained-literal editing limits.
Batch 0.9.2 and lake 0.3.2 pin verifier 0.2.1. All eight exact package pins move
with their independently versioned packages. Core's optional signing peer is
0.6.0. No metric formula, Format/Protocol/receipt schema version, pack version or
draft RFC status changes. Receipt disagreements across engine identities retain
the existing RCP-07 `unverifiable` behavior. See the
[preparation record](https://github.com/UWMD-OSP/UW-Markdown/blob/main/docs/releases/4.3.0-preparation.md).
All 8 versions are published and independently checked from annotated `v4.3.0`
on `80c68c3d0950948c85a1d3a90c02cd05f3a650a4` (2026-10-15). Registry
integrity/provenance and fresh consumers pass; see the
[publication record](https://github.com/UWMD-OSP/UW-Markdown/blob/main/docs/releases/4.3.0-publication.md).

## Why three streams?

A format change is not an implementation change. Adopters who write
their own parsers/validators need to pin against the *format* version,
not the reference library version. The reference library will release
patches and features faster than the format will evolve; tying them
together would force every adopter to track every library release.

The same logic applies to the protocol: an editor and a verifier can be
released independently as long as both honor the same protocol version.

<a id="public-launch-compatibility-policy-owner-decision-2026-10-16"></a>
## Public launch rule (owner decision, 2026-10-17)

The owner rule at the top of AGENTS.md and CLAUDE.md
supersedes earlier compatibility and artifact-preservation directions.
5.0.0 is exclusively the official public launch: **every @uwmd npm package
moves to 5.0.0 together then**. All prelaunch releases use 4.x.x and may ship
from main as needed, including incompatible changes.

Before launch there is zero backward compatibility. Do not prepare migration
notes, deprecation paths, consumer-breakage analyses, version-bump recommendations
or preservation/repair of prelaunch documents, signatures, receipts or artifacts.
The project owner is the sole prelaunch consumer; prelaunch documents are not public inputs.
Drop compatibility-only and artifact-preservation-only work. Current numerical,
verification, read-only source-integrity and conformance requirements remain;
those are current contracts, not legacy support obligations.

Format and Protocol remain distinct normative surfaces; the coordinated 5.0.0
rule applies to npm package releases, and "UWMD 5.x" names those releases and
the standard they carry. A record declares its Format version, not the UWMD
number. Earlier release entries below report what
was released, not versions to repeat or compatibility commitments. No package
number, release, tag or publication is changed by recording this rule. The
public launch still requires separate explicit owner approval, and normative
changes still require RFC discipline and synchronized specifications/conformance.

## Release history

Release 4.2.0 pairs core/CLI 4.2.0 with Protocol 4.1.0 and Format 3.0.
Protocol 4.1.0 carries RFC 0084: an optional detached document snapshot
signature over the existing `uw-envelope-semantic` digest (Protocol §V.13),
with the Integrity capability `document-signature-verification`, codes
`INT-09`–`INT-15` and the `conformance/document-signatures/` suite. It is an
additive change to how a document is verified, so the Protocol takes a minor
and the Format does not move. `@uwmd/verify` 0.2.0 carries the new API and
constants; core 4.2.0 re-exports it, adds the `sign-document` and
`--document-signature` CLI surface and pins verify 0.2.0 exactly. Signing
0.5.0 adds `signDocument`, `createDocumentSignatureVerifier` and
`loadDocumentSigningKey`, refuses non-canonical signature encodings (#322),
loads in a browser again, and pins verify 0.2.0 and core 4.2.0. Batch 0.9.1
and lake 0.3.1 pin verify 0.2.0; Excel 0.9.18 and report 0.8.30 pin core
4.2.0. Core's optional signing peer is 0.5.0. Receipts name `@uwmd/verify`
0.2.0 as their engine; a receipt issued by 0.1.0 whose results disagree
reports `RCP-07` `unverifiable` (UW Receipt §5.3). `uwmd init` refuses to
overwrite an existing file. The workflow scope is eight packages, verify
first: verify, core, CLI, signing, batch, Excel, report and lake. Protocol
4.1.0 is Stable. All eight packages are published from annotated tag
`v4.2.0` on `238dbf35a8654e2f8394088b9c3982159b11af8f` through trusted
publishing with provenance. Release run 38663508062 succeeded. All registry
versions, `latest`, `gitHead`, signatures, attestations, Rekor checks, 672
published files (eight archives byte-equal to a local pack), 350
delivered-CLI portable cases and isolated consumers of all eight packages, of
`@uwmd/verify` alone and of batch and lake without core were independently
verified; RFC 0084 is `implemented`. Neither module package published again.
No other package generation shipped. Preparation and
[publication evidence](https://github.com/UWMD-OSP/UW-Markdown/blob/main/docs/releases/4.2.0-publication.md)
remain separate records.

Release 4.1.0 pairs core/CLI 4.1.0 with Protocol 4.0.0 and Format 3.0, the
same contract as 4.0.0 and 4.0.1, and adds a package: `@uwmd/verify` 0.1.0,
the reference implementation of the standard (RFC 0083). Verify holds
everything a party needs to read and verify a `.uw.md`, pins no `@uwmd/*`
package, and depends only on `fast-xml-parser` and `fflate`. Core is the
starter toolkit on top of it: it depends on verify 0.1.0 exactly and
re-exports its whole surface from both entries, so no 4.0.x import breaks.
Core takes a minor for the new dependency and the additive exports. No
normative text changes, so neither the Protocol nor the Format version moves,
and no conformance expectation, issue code, metric definition or stated value
changes. Receipts name `@uwmd/verify` 0.1.0 as their engine, including
receipts issued through core and the CLI. A receipt issued by core 4.0.1 or
earlier names `@uwmd/core` as its engine, so when its results disagree a
4.1.0 or verify verifier reports `RCP-07` `unverifiable`, not `failed` (UW
Receipt §5.3). Signing 0.4.0 pins verify 0.1.0 and core 4.1.0. Batch 0.9.0
and lake 0.3.0 pin verify 0.1.0 in place of core. Excel 0.9.17 and report
0.8.29 pin core 4.1.0 exactly. Core's optional signing peer is 0.4.0. The
workflow scope is eight packages, verify first: verify, core, CLI, signing,
batch, Excel, report and lake. Protocol 4.0.0 stays Stable. All eight
packages are published from annotated tag `v4.1.0` on
`9d18a13c236b6ee46857382a25ec75c0ff6ccf86` through trusted publishing with
provenance; `@uwmd/verify` 0.1.0 is that name's first release and its
`latest`. Release run 38509776606 succeeded. All registry versions,
`latest`, `gitHead`, signatures, attestations, Rekor checks, 666 published
files, 336 delivered-CLI portable cases and isolated consumers of all eight
packages, of `@uwmd/verify` alone and of batch and lake without core were
independently verified; RFC 0083 is `implemented`. Neither module package
published again. No other package generation shipped. Preparation and
[publication evidence](https://github.com/UWMD-OSP/UW-Markdown/blob/main/docs/releases/4.1.0-publication.md)
remain separate records.

Release 4.0.1 pairs core/CLI 4.0.1 with Protocol 4.0.0 and Format 3.0, the
same contract as 4.0.0. It is a patch: nothing normative moves, so neither
the Protocol nor the Format version does. It carries three fixes. The starter
sources & uses footing counts a typed `uses.renovation` as budget plus
contingency (RFC 0081 §7; Format §4.8 now states the rule), `@uwmd/signing`
reports its own manifest version as `SIGNING_VERSION`, and the private web
editor reads its own name and version. No conformance expectation, issue
code, metric definition or stated value changes. Signing 0.3.1, batch 0.8.23,
Excel 0.9.16, report 0.8.28 and lake 0.2.12 pin core 4.0.1 exactly. Core's
optional signing peer is 0.3.1. The workflow scope is the same seven
packages: core, CLI, signing, batch, Excel, report and lake. Protocol 4.0.0
stays Stable. All seven packages are published from lightweight tag `v4.0.1`
on `442dfc6aecfb591ce744f00776a9e2c7a601854c` through trusted publishing with
provenance. Release run 38429239833 succeeded. All registry versions,
`latest`, `gitHead`, signatures, attestations, Rekor checks, 616 published
files, 336 delivered-CLI portable cases and an isolated consumer of all seven
packages were independently verified; the published signing 0.3.1 exports
`SIGNING_VERSION` `'0.3.1'`. Neither module package published again. No other
package generation shipped. Preparation and
[publication evidence](https://github.com/UWMD-OSP/UW-Markdown/blob/main/docs/releases/4.0.1-publication.md)
remain separate records.

Release 4.0.0 pairs core/CLI 4.0.0 with Protocol 4.0.0 and Format 3.0.
Protocol 4.0.0 carries one RFC: RFC 0081 removes every
backward-compatibility path. Format 3.0 is the 2.1 shape with each alternate
spelling removed (bare blocks with one nested `_meta`, the block digest over
the payload minus `_meta`, one home for each fact, builtin class identifiers
only) and is the only format the reference implementation reads: any other or
absent `uw_version` is refused as `UNSUPPORTED_FORMAT_VERSION`. Protocol 4.0.0
is the only protocol contract; module manifests state `requires_conformance`
and optional `requires_profiles` in place of `requires_tier`, and their
ranges must admit Protocol 4.0.0 and Format 3.0. The Reader and Verifier
tiers, the six profiles and the metric dictionary are unchanged, and no
financial value changes. **3.0.0 is the last release that reads older
formats** (1.0, 1.1, 2.0 and 2.1) and honors older module contracts; 4.0.0
ships no migrator (CHANGELOG 4.0.0 gives the migration path). Signing 0.3.0,
batch 0.8.22, Excel 0.9.15, report 0.8.27 and lake 0.2.11 pin core 4.0.0
exactly. Core's optional signing peer is 0.3.0. The workflow scope is seven
packages: core, CLI, signing, batch, Excel, report and lake. The two module
packages, final at 0.2.0 and deprecated on npm, are not part of this or any
later release. RFC 0081 is implemented; Protocol 4.0.0 is Stable. All seven
packages are published from immutable annotated `v4.0.0` on
`d52a42394be238b00c55942afc1a31cc5c00061b` through trusted publishing with
provenance. Release run 38339991109 succeeded and was the first to publish
seven packages. All registry versions, `latest`, `gitHead`, signatures,
attestations, Rekor checks, 614 published files, 336 delivered-CLI portable
cases and an isolated consumer of all seven packages were independently
verified. Neither module package published again; both stay at their final,
deprecated 0.2.0. No other package generation shipped. Preparation and
[publication evidence](https://github.com/UWMD-OSP/UW-Markdown/blob/main/docs/releases/4.0.0-publication.md)
remain separate records.

Release 3.0.0 pairs core/CLI 3.0.0 with Protocol 3.0.0 and Format 2.1.
Protocol 3.0.0 carries three accepted RFCs. RFC 0078 makes the Protocol the
verification contract: the conformance tiers are **Reader** and **Verifier**
with six optional profiles (`module`, `integrity`, `representations`,
`portfolio`, `sensitivity`, `stochastic`), the editor and agent-host material
moves to the non-normative starter products guide, and the metric dictionary
(`spec/metrics/`) is normative. The four Protocol 2.x tier names stay readable,
deprecated, through 3.x. RFC 0079 adds stated-metric comparison precision
(§VIII.5.1) and one LTV and cash-on-cash definition for every class. RFC 0080
registers the `CLS-NN`, `CC-DC-NN`, `CC-MH-NN` and `CC-HOSP-NN` families for
the two new builtin classes and the folded-in hospitality content. None adds a
module capability, so no new §X `requires_protocol` floor applies, and the
reference host keeps honoring the 2.25.0 module contract so modules written
for `^2` keep loading. Format 2.1 (RFC 0080) authors the `data_center` and
`manufactured_housing` builtins and their standard sections, and reads 2.0 and
the whole 1.x line unchanged. Signing 0.2.26, batch 0.8.21, Excel 0.9.14,
report 0.8.26, lake 0.2.10 and both module packages 0.2.0 pin core 3.0.0
exactly. Core's optional signing peer is 0.2.26. The workflow scope is nine
packages: core, CLI, signing, batch, Excel, report, lake and both module
packages. The two module packages at 0.2.0 are declaration-free compatibility
shells and their final version (RFC 0080 §6); their manifest contracts are
0.2.0. RFCs 0078, 0079 and 0080 are implemented; Protocol 3.0.0 is Stable.
All nine packages are published from immutable annotated `v3.0.0` on
`44ab7347a8a3054fc377e19e85f89ad6f1539dea` through trusted publishing with
provenance. Release run 38163964522 succeeded and was the first to publish
Excel, report and lake. All registry versions, `latest`, `gitHead`,
signatures, attestations, Rekor checks, 638 published files, 332
delivered-CLI portable cases and an isolated consumer of all nine packages
were independently verified. The owner deprecated both module package names
on npm on 2026-10-11, every version. No other package generation shipped.
Preparation and
[publication evidence](https://github.com/UWMD-OSP/UW-Markdown/blob/main/docs/releases/3.0.0-publication.md)
remain separate records.

Release 2.21.0 pairs core/CLI 2.21.0 with Protocol 2.25.0 and Format 2.0.
Protocol 2.25.0 carries one RFC: RFC 0065's `RDB-NN` reserve draw
binding code family (§III.6a) with its separately invoked verifier binding
reserve draws to gross expenditure (§VIII.12). It adds no module capability, so no
new §X `requires_protocol` floor applies. Format stays 2.0: RFC 0065 adds only
an optional external, digested binding plan identified by §4.28, with no new
section or required field. Signing 0.2.25, batch 0.8.20, Excel 0.9.13, report
0.8.25, lake 0.2.9 and both module packages 0.1.13 pin core 2.21.0 exactly.
Core's optional signing peer is 0.2.25. The workflow scope is core, CLI,
signing, batch and both module packages. Excel, report and lake remain
source-only. Module manifest contracts remain 0.1.0. RFC 0065 is implemented;
Protocol 2.25.0 is Stable. Core/CLI 2.21.0, signing 0.2.25, batch 0.8.20 and
both modules 0.1.13 are published from immutable annotated `v2.21.0` on
`6e5ffaf75425d35554c57d72bea28c59c6047839` through trusted publishing with
provenance. Release run 38088657045 succeeded; all registry versions,
`latest`, `gitHead`, signatures, attestations, Rekor checks, 498 published
files, 325 delivered-CLI portable cases (46 of them RFC 0065 binding cases),
the published `verify-reserve-draws` command and an isolated consumer of both
modules were independently verified. No other package generation shipped.
Preparation and
[publication evidence](https://github.com/UWMD-OSP/UW-Markdown/blob/main/docs/releases/2.21.0-publication.md)
remain separate records.

Release 2.20.0 pairs core/CLI 2.20.0 with Protocol 2.24.0 and Format 2.0.
Protocol 2.24.0 carries two RFCs: RFC 0072's `DQ-07`–`DQ-09`
scenario and build-to-rent identity warnings with their remediation entries,
and RFC 0064's `RSV-NN` reserve-account code family (§III.6a) with its
separately invoked balance verifier (§VIII.11). Neither adds a module
capability, so no new §X `requires_protocol` floor applies. Format stays 2.0:
RFC 0072 defines the frontmatter `scenario` vocabulary and
`asset_subtype: build_to_rent`, and RFC 0064 adds the optional
`reserve_accounts` section (§4.28). The generation also includes the §VIII.5
quantizer fix for an integral decimal shift. Signing 0.2.24, batch 0.8.19,
Excel 0.9.12, report 0.8.24, lake 0.2.8 and both module packages 0.1.12 pin
core 2.20.0 exactly. Core's optional signing peer is 0.2.24. The workflow
scope is core, CLI, signing, batch and both module packages. Excel, report and
lake remain source-only. Module manifest contracts remain 0.1.0. RFCs 0064
and 0072 are implemented; Protocol 2.24.0 is Stable. Core/CLI 2.20.0, signing
0.2.24, batch 0.8.19 and both modules 0.1.12 are published from immutable
annotated `v2.20.0` on `020e8b088307ac53a0023bfc0b881c31fb40db91` through
trusted publishing with provenance. Release run 38064763014 succeeded; all
registry versions, `latest`, `gitHead`, signatures, attestations, Rekor
checks, 494 published files, 279 delivered-CLI portable cases, the published
core's cent quantization and an isolated consumer of both modules were
independently verified. No other package generation shipped. Preparation and
[publication evidence](https://github.com/UWMD-OSP/UW-Markdown/blob/main/docs/releases/2.20.0-publication.md)
remain separate records.

Release 2.19.0 pairs core/CLI 2.19.0 with Protocol 2.23.0 and Format 2.0.
Protocol 2.23.0 carries two RFCs: RFC 0075's `senior` preference
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
source-only. Module manifest contracts remain 0.1.0. RFCs 0075, 0076 and 0077
are implemented; Protocol 2.23.0 is Stable. Core/CLI 2.19.0, signing 0.2.23,
batch 0.8.18 and both modules 0.1.11 are published from immutable annotated
`v2.19.0` on `139268f34be9550287d8782e44767a9f7e8273b1` through trusted
publishing with provenance. Release run 37950962666 succeeded; all registry
versions, `latest`, `gitHead`, signatures, attestations, Rekor checks, 482
published files, 228 delivered-CLI portable cases and an isolated consumer of
both modules were independently verified. No other package generation
shipped. Preparation and
[publication evidence](https://github.com/UWMD-OSP/UW-Markdown/blob/main/docs/releases/2.19.0-publication.md)
remain separate records.

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
Excel converter share that selection. The owner's decisions of 2026-10-02
(D1–D3) set that contract and the 2.15.0 target; RFC 0066 is now
`implemented`. Core/CLI 2.15.0, signing 0.2.19 and batch 0.8.14 are published
from the `v2.15.0` tag with SLSA provenance through trusted publishing (OIDC).
The release workflow publishes those four and no others.

Release 2.14.0 paired core/CLI 2.14.0 with Protocol 2.18.0 and Format 2.0.
Protocol 2.18.0 adds RFC 0063's explicit final-period exclusive-boundary
admission to the **2.17.1** RFC 0062 same-day errata. The owner accepted both RFCs
on 2026-09-24 (RFC 0063 at `f04b34a`); they integrated on canonical `main` at
`e49eb43` and `413a645` and are now `implemented`. The 2.17.1 errata decision
remains recorded below. Core/CLI 2.14.0, signing 0.2.18 and batch 0.8.13 were
published from the `v2.14.0` tag.

Release 2.13.0 paired core/CLI 2.13.0 with Protocol 2.17.0 and Format 2.0.
Protocol 2.17.0 added §VIII.10 step 5 and the `WF-10`–`WF-15` clawback codes
(RFC 0059) and the `REC-NN` recovery family (RFC 0058), on top of the
`LSE-NN` / `HDG-NN` / `ESC-NN` / `CAPX-NN` families 2.15.0 registered.
At 2.13.0 the reference modules had never been published, and Excel and
report were not published at their then-current versions. The registry does
serve a stray `0.3.0` of each, pushed by hand on 2026-08-16 during the 1.3.0
manual release; both declare `@uwmd/core` `1.3.0` and neither was maintained at
that version. The owner deprecated both on 2026-10-02, and the registry shows the
deprecation message on each `0.3.0`. `verify-versions` reconciles the
manifests against this file and never contacts the registry, which is why the
earlier flat "unpublished" claim went unchallenged. From the 3.0.0 generation
Excel and report are in the release workflow at their current versions, both
above the deprecated `0.3.0`. Lake `0.2.9` was published by hand on 2026-10-11
from the `v2.21.0` tag to create the package for its trusted publisher; lake
is in the release workflow from 3.0.0 as well. Module package 0.1.1 only repins core; the typed module manifests
retain their independent 0.1.0 contract version. Package, Format and Protocol
versions advance independently.

### Official module compatibility

`@uwmd/module-hospitality` and `@uwmd/module-data-center` were declaration-free
compatibility shells after RFC 0080. Their 0.2.0 generation, pairing core
3.0.0, published on 2026-10-11 and is the final version of each; the owner
deprecated both package names on npm the same day. RFC 0081 deleted both
packages from the repository, and from 4.0.0 the release publishes seven
packages, so no later release publishes them. The
hospitality and data-center content is builtin in `@uwmd/core`, and the
`org.uwmd.data_center` identifier is refused like any other namespaced builtin
suffix (`INVALID-ASSET-CLASS-002`).

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

## Development and release policy

Apply the 2026-10-17 owner rule above. Earlier release descriptions are not
compatibility obligations. Use the current source, accepted RFCs and conformance
for development; do not maintain old readers, receipts, APIs or document repair
paths for prelaunch consumers. Current source/digest correctness remains part of
verification. No prelaunch migration guide or version-bump recommendation is
required.

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

RFC 0080 (3.0.0): Format 2.1 authors two new official builtins; all twelve have full standard and starter support. Release 3.0.0 pairs it with Protocol 3.0.0. Both official module packages shipped 0.2.0 as declaration-free compatibility shells, their final version, and are deprecated on npm; their manifest contracts are 0.2.0.

RFC 0081 (4.0.0): one format and one protocol. Format 3.0 and Protocol 4.0.0 are the only versions the reference implementation reads; 3.0.0 is the last release that reads Format 1.x and 2.x. Both official module packages are deleted from the repository, and releases publish seven packages.
