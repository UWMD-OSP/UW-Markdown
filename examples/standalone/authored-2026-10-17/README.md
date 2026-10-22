# Authored standalone positive kit — 2026-10-17

Synthetic examples: every name, party and figure is fictional. They demonstrate
the accepted profiles, fragments, composition and packaging (RFC 0048, RFC 0091).

## Identities and provenance

Author: `analyst`; authored at `2026-10-17T21:34:15Z`.
Canonical provenance source: `system/standalone-kit`. Each block's `notes` records
its deliberate review/lifecycle decision below; narrative review_status and flags
are not a source for these decisions. All blocks are new revision-1 heads.

| Artifact | New document or logical-record identity | Package member ID |
|---|---|---|
| [lease-abstract-v1.uwx.md](lease-abstract-v1.uwx.md) | `doc:standalone:2026-10-17:lease-abstract` | `example:standalone:2026-10-17:lease-abstract-v1` |
| [source-note-v1.uwx.md](source-note-v1.uwx.md) | `note:standalone:2026-10-17:transcription` | `example:standalone:2026-10-17:source-note-v1` |
| [inline-deal.uwx.md](inline-deal.uwx.md) | `uw_standalone_authored_2026_10_17` | `example:standalone:2026-10-17:inline-deal` |
| [externalized-deal.uwx.md](externalized-deal.uwx.md) | `uw_standalone_authored_2026_10_17` | `example:standalone:2026-10-17:externalized-deal` |

The two deal carriers share one logical record identity and canonical metadata:
RFC0048 requires the full resolved externalized model and digest to equal the
inline model. Their physical identities are distinct member IDs and byte hashes,
not distinct financial records. No frontmatter or metadata is excluded to make
the comparison pass.

## Six authored top-level block declarations

| Artifact / block | human_review_required | superseded | Authored reason |
|---|---|---|---|
| `lease-abstract-v1.uwx.md` / `deal_context` | `true` | `false` | Human review is required before using this illustrative abstract with unresolved legal terms; revision 1 is the current block of a new document. |
| `source-note-v1.uwx.md` / `deal_context` | `true` | `false` | Human review is required to compare this illustrative transcription with an actual source; revision 1 is the current block of a new note. |
| `inline-deal.uwx.md` / `property` | `false` | `false` | This deliberately authored fictional property only demonstrates structure and requires no human fact-review for that purpose; revision 1 is the new record head. |
| `inline-deal.uwx.md` / `rent_roll` | `true` | `false` | Human review is required before relying on these illustrative tenant rows as underwriting inputs; revision 1 is the new record head. |
| `externalized-deal.uwx.md` / `property` | `false` | `false` | This deliberately authored fictional property only demonstrates structure and requires no human fact-review for that purpose; revision 1 is the new record head. |
| `externalized-deal.uwx.md` / `rent_roll` | `true` | `false` | Human review is required before relying on these illustrative tenant rows as underwriting inputs; revision 1 is the new record head. |

The two false property flags concern a deliberately authored fictional structural
example; they do not assert that a real property was reviewed or financially
verified. Review-required true remains a valid positive validation example.

## Fragments and source boundaries

The five [parts](parts/) have new part IDs and complete authored metadata with
review required true and superseded false; their one-line reason is in
[declarations.json](declarations.json). Numeric amounts and dates remain stated
illustrative data, with no new calculation. The dated fragment uses Format
§4.26 `series`.

The source-evidence text is illustrative material, not an executed lease. The
package context omits its bytes and reports `not_transferred`.

## Package

[manifest.json](package/manifest.json) declares `pkg:standalone:authored:2026-10-17`.
[standalone-authored.uwpkg.zip](package/standalone-authored.uwpkg.zip) contains all
four records, five fragments and the source-evidence stand-in. All record
copies, raw hashes and four semantic digests are checked.

```text
npm run build
node packages/uwmd-cli/bin/uwmd.mjs package verify examples/standalone/authored-2026-10-17/package/standalone-authored.uwpkg.zip
```

The package is regenerated from its manifest and members (`uwmd package
create`). Package VERIFIED means member byte/semantic identity, not truth or
complete financial verification.

## Current verification scope

Tests cover the six authored declarations, strict absent-flag findings, actual
CLI exits/partitions and read-only behavior, complete composition equality,
member/raw/semantic digest checks, native-host repeat encoding and package
source-context separation.
