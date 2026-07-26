# UW Markdown — JSON Schemas

Normative JSON Schemas for protocol types that cross integration
boundaries. Tools written in any language can validate against these
without reverse-engineering [`@uwmd/core/protocol.ts`](../../packages/uwmd-core/src/protocol.ts).

All schemas use [JSON Schema 2020-12](https://json-schema.org/draft/2020-12/schema)
and publish under the `https://uwmd.org/schemas/` `$id` prefix
(placeholder pending hosting decision; current canonical location is
this directory).

| Schema | Mirrors | Spec section |
|---|---|---|
| [`uwmd-block.schema.json`](uwmd-block.schema.json) | `UWBlock` + `UWMeta` | Format §2.4–§2.6 |
| [uw-document-envelope.schema.json](uw-document-envelope.schema.json) | UWDocumentEnvelope | RFC 0014 / Envelope 1.0 |
| [`edit-operation.schema.json`](edit-operation.schema.json) | `EditOperation` (discriminated union) | Protocol §V |
| [`protocol-error.schema.json`](protocol-error.schema.json) | `ProtocolError` | Protocol §XI |
| [`implementation-manifest.schema.json`](implementation-manifest.schema.json) | `ImplementationManifest` | Protocol §I.4 |
| [`calc-result.schema.json`](calc-result.schema.json) | `CalcResult` | Protocol §VIII |
| [`issue-remediation.schema.json`](issue-remediation.schema.json) | `IssueRemediation` | Protocol §III.6 |
| [`module-manifest.schema.json`](module-manifest.schema.json) | `ModuleManifest` | Protocol §X |

## Validating a schema

```bash
npx --yes ajv-cli compile -s spec/schemas/<name>.schema.json
```

CI runs this on every PR for all schemas in this directory.

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
