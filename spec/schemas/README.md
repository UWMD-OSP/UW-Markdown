# UW Markdown — Schemas

Normative JSON Schemas for protocol types and a structural XSD for UW XML that
cross integration boundaries. Tools written in any language can validate these
contracts without reverse-engineering the reference TypeScript implementation.

The JSON schemas use [JSON Schema 2020-12](https://json-schema.org/draft/2020-12/schema)
and publish under the `https://uwmd.org/schemas/` `$id` prefix. The XSD targets
the UW XML 1.0 namespace `https://uwmd.org/ns/document/1`. The current canonical
files live in this directory pending publication on `uwmd.org`.

| Schema | Mirrors | Spec section |
|---|---|---|
| [`uwmd-block.schema.json`](uwmd-block.schema.json) | `UWBlock` + `UWMeta` | Format §2.4–§2.6 |
| [uw-document-envelope.schema.json](uw-document-envelope.schema.json) | UWDocumentEnvelope | RFC 0014 / Envelope 1.0 |
| [uw-document-envelope.xsd](uw-document-envelope.xsd) | Structural UW XML 1.0 tooling schema | [UW XML Mapping 1.0](../UW_XML_MAPPING_v1.md) |
| [`edit-operation.schema.json`](edit-operation.schema.json) | `EditOperation` (discriminated union) | Protocol §V |
| [`protocol-error.schema.json`](protocol-error.schema.json) | `ProtocolError` | Protocol §XI |
| [`implementation-manifest.schema.json`](implementation-manifest.schema.json) | `ImplementationManifest` | Protocol §I.4 |
| [`calc-result.schema.json`](calc-result.schema.json) | `CalcResult` | Protocol §VIII |
| [`issue-remediation.schema.json`](issue-remediation.schema.json) | `IssueRemediation` | Protocol §III.6 |
| [`module-manifest.schema.json`](module-manifest.schema.json) | `ModuleManifest` | Protocol §X |
| [`uw-receipt.schema.json`](uw-receipt.schema.json) | `UWReceipt` | [UW Receipt 1.0](../UW_RECEIPT_v1.md) / RFC 0016 |
| [`section-gaps.schema.json`](section-gaps.schema.json) | `SectionGaps` | Protocol §VII |
| [`uw-deal-package-manifest.schema.json`](uw-deal-package-manifest.schema.json) | `UWDealPackageManifest` | RFC 0018 |
| [`uw-market-data.schema.json`](uw-market-data.schema.json) | `market-data-v1` documents | RFC 0022 |
| [`uwpart.schema.json`](uwpart.schema.json) | `.uwpart.md` frontmatter | [UW Composition 1.0](../UW_COMPOSITION_v1.md) §2 / RFC 0021 |
| [`uw-external-section.schema.json`](uw-external-section.schema.json) | `external` section directive | [UW Composition 1.0](../UW_COMPOSITION_v1.md) §3 / RFC 0021 |
| [`uw-rollup.schema.json`](uw-rollup.schema.json) | `portfolio_rollup` payload | [UW Receipt 1.0](../UW_RECEIPT_v1.md) §11 / RFC 0021 §6 |

## Validating a schema

```bash
npx --yes ajv-cli compile -s spec/schemas/<name>.schema.json
```

CI runs JSON Schema validation on every PR. The UW XML codec tests and docs-site build cover the XML mapping; the XSD is also compiled during release verification.

## Updating a schema

The TypeScript types in `@uwmd/core/src/protocol.ts` and `types.ts` are
the canonical definition. When you change one of those types, update
the matching schema here in the **same PR**. Drift between the two is
a normative protocol bug.

If you add a new schema:
1. Place it next to the existing schemas, named `<thing>.schema.json`.
2. Use the `https://uwmd.org/schemas/<thing>.schema.json` `$id`.
3. Add a row to the table above.
4. CI picks it up automatically — no workflow change needed.

Step 3 is enforced: `npm run verify-indexes` fails when a schema is on disk
without a row, or a row links a file that is not. Three schemas had drifted out
of this table before that check existed, which is why it does now.
