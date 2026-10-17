# Authored standalone positive kit — 2026-10-17

These are newly authored fictional examples under the owner's RFC0048 disposition.
They demonstrate accepted profiles, fragments, composition and packaging. They do
not repair or reauthenticate the original kit. RFC0091 remains draft and unmerged.

## Identities and provenance

Author: `codex/standalone-kit-2026-10-17`; authored at `2026-10-17T21:34:15Z`.
Canonical provenance source: `system/standalone-kit`. Each block's `notes` records
its deliberate review/lifecycle decision below; narrative review_status and flags
are not a source for these decisions. All blocks are new revision-1 heads.

| Artifact | New document or logical-record identity | Package member ID |
|---|---|---|
| [lease-abstract-v1.uwx.md](lease-abstract-v1.uwx.md) | `doc:standalone:2026-10-17:lease-abstract` | `example:standalone:2026-10-17:lease-abstract-v1` |
| [source-note-v1.uwx.md](source-note-v1.uwx.md) | `note:standalone:2026-10-17:transcription` | `example:standalone:2026-10-17:source-note-v1` |
| [inline-deal.uwx.md](inline-deal.uwx.md) | `uw_standalone_authored_2026_10_17` | `example:standalone:2026-10-17:inline-deal` |
| [externalized-deal.uwx.md](externalized-deal.uwx.md) | `uw_standalone_authored_2026_10_17` | `example:standalone:2026-10-17:externalized-deal` |

The two deal carriers share one NEW logical record identity and canonical metadata:
RFC0048 requires the full resolved externalized model and digest to equal the
inline model. Their physical identities are distinct member IDs and byte hashes,
not distinct financial records. No frontmatter or metadata is excluded to make
the comparison pass. The API abstract and source handle are new identities too.

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
illustrative data, with no new calculation. The newly authored dated fragment
uses accepted Format §4.26 `series` rather than the historical fixture's `flows`
member, preserving the two original rows unchanged. The original remains intact.

The source-evidence text is newly authored illustrative material, not an executed
lease or evidence that an original was reviewed. The package context omits its
bytes and reports `not_transferred`.

## New package

[manifest.json](package/manifest.json) declares `pkg:standalone:authored:2026-10-17`.
[standalone-authored.uwpkg.zip](package/standalone-authored.uwpkg.zip) contains all
four new records, five new fragments and the new source-evidence stand-in. All
record copies, raw hashes and four semantic digests are checked. Example/member
IDs and the package are new; no public version was allocated.

```text
npm run build
node packages/uwmd-cli/bin/uwmd.mjs package verify examples/standalone/authored-2026-10-17/package/standalone-authored.uwpkg.zip
```

The new package can be regenerated only from its NEW manifest and members. Do
not regenerate or overwrite the original historical ZIP. Package VERIFIED means
member byte/semantic identity, not truth or complete financial verification.

## Historical preservation

[history.json](history.json) pins the original subjects, ZIP, receipt/signature
fixtures, sources and schemas, plus exact prior index/metric expectation bytes.
The latter receive only additive cases for these new records. All older
expectations and original fidelity/composition assertions remain active.
The four original profiles are metadata-incomplete historical examples and retain
six META-02 errors under the draft candidate; there is no legacy exception.
