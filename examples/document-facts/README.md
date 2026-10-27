# Synthetic source-fact examples

All statements, identities and figures are QA fixtures. The JSON payloads are
byte-for-byte copies of RFC0129’s original three worked examples. UWX adds
ordinary metadata and a purpose descriptor. `.view.uw.md` files are complete
source views, not compilable deal summaries.

Build current source from the repository root, then run:

```sh
node examples/document-facts/check.mjs
```

The script validates all three examples and returns read-only candidates against
`target.uwx.md`; it writes nothing. Quote amount/rate may be candidates for the
explicit senior block. Quote ceilings, OM asking price/NOI and appraisal
conditions remain visible without becoming calculated underwriting. A selected
appraisal fact never changes underwritten value. Applying a candidate needs a
separate host provenance operation.

Use the [library guide](../../docs/document-facts.md) for source inventories,
exact variants/currency, package predecessor retention, errors and binding scope.
The existing `source_note` role plus `abstracts`/`contributes_to`/`supersedes`
member links carry these documents in a package; no new package role is defined.
Only the public library operations are claimed. No CLI/MCP/HTTP fact binding or
Lite compilation is implemented, and no npm release is implied.
