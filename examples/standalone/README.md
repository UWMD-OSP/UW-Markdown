# Standalone UW document kit

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
Member paths are relative to that manifest, so the package can be regenerated
with the CLI after a source edit:

```text
npm run build
node packages/uwmd-cli/bin/uwmd.mjs package create examples/standalone/package/manifest.json --output examples/standalone/package/standalone-demo.uwpkg.zip
node packages/uwmd-cli/bin/uwmd.mjs package verify examples/standalone/package/standalone-demo.uwpkg.zip
```

The package contains a text source-evidence stand-in rather than a real lease
file. Its digest demonstrates byte identity only; it does not claim authenticity,
completeness, or legal effect.

