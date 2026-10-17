# Standalone UW document kit

The current positive examples are the newly authored
[2026-10-17 kit](authored-2026-10-17/README.md). It retains RFC0048's promise that
positive examples parse and validate, with explicit metadata, full composition
equivalence and a new package. The owner accepted RFC0091 and all six authored
review declarations on2026-10-17. Integration requires exact-head CI; no version
allocation, release or publication is authorized.

The original `lease-abstract-v1`, `source-note-v1`, `inline-deal` and
`externalized-deal` files below are **metadata-incomplete historical examples**.
Their six absent canonical review booleans are not inferred from narrative data.
Their original ZIP, embedded copies, subject/signature/receipt evidence and source
bytes remain unchanged. Do not regenerate the historical ZIP. Its member-digest
verification does not imply current whole-document validity or new-semantic
authentication. Original fidelity and composition checks remain active; the
zero-error positive profile assertions now exercise the newly authored examples.

## Historical kit documentation

The following records the original example surfaces. Its package manifest and
members remain an immutable historical fixture; use the new kit for authoring.


This worked-example kit implements the adoption scope in [RFC 0048](../../docs/rfcs/0048-standalone-document-kit.md).
It demonstrates the existing profile, fragment, composition, and deal-package
surfaces without adding a new profile or financial calculation.

## Example matrix

| Example | Demonstrates | Boundary to notice |
|---|---|---|
| [`lease-abstract-v1.uwx.md`](lease-abstract-v1.uwx.md) | A sourced `lease-abstract-v1` document with an explicitly ambiguous term and a not-stated term. | Facts stay descriptive; `null` carries a status and asserted terms carry locators. |
| [`lease-abstract.json`](lease-abstract.json) | The public `LeaseAbstract` API shape used by `uwmd lease validate` and `uwmd lease project`. | The rent-roll projection is lossy and does not annualize or resolve conflicts. |
| [`source-note-v1.uwx.md`](source-note-v1.uwx.md) | A source-note document with attributable diligence context. | It is evidence/context, not an underwriting record. |
| [`parts/`](parts/) | Standalone rent-roll, T-12 operating-statement, and dated cash-flow fragments. | Each `.uwpart.md` parses independently and carries its own provenance. |
| [`inline-deal.uwx.md`](inline-deal.uwx.md) / [`externalized-deal.uwx.md`](externalized-deal.uwx.md) | An all-in-one record and an equivalent rent-roll externalization. | Resolution compares semantic meaning, not source bytes. |
| [`package/standalone-demo.uwpkg.zip`](package/standalone-demo.uwpkg.zip) | A package containing the externalized deal, profile documents, fragments, and source evidence. | The ZIP is the fidelity boundary; source evidence is never inlined into context. |

The package input manifest is [`package/manifest.json`](package/manifest.json).
Member paths are relative to that manifest, for historical identity verification. Do not overwrite the historical archive;
use the new kit's manifest when authoring a package:

```text
npm run build
node packages/uwmd-cli/bin/uwmd.mjs package verify examples/standalone/package/standalone-demo.uwpkg.zip
```

`package verify` checks every member's byte digest against the manifest and,
for UWX records and the lossless model encodings (UW JSON, UW XML, UW CSV
bundle), recomputes each stated `semantic_digest` (RFC 0018). The demo package
prints `VERIFIED` and exits 0. A record whose content changed while its
`semantic_digest` did not prints `FAILED` with `PKGVER-003` and exits 1, even if
its byte digest was refreshed. A member whose representation cannot be
canonicalized here (UW Lite, or a record the reader refuses) is
`UNVERIFIABLE`, meaning "not checked", not "tampered", and exits 0. Through
CLI 4.2.0 every stated semantic digest was `UNVERIFIABLE`
([launch audit](../../docs/reviews/2026-10-14-launch-onboarding-audit.md) D-10).

The package contains a text source-evidence stand-in rather than a real lease
file. Its digest demonstrates byte identity only; it does not claim authenticity,
completeness, or legal effect.

