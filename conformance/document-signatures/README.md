# Document snapshot signatures (RFC 0084)

These synthetic records use the published test-only conformance signing key.
Its private JWK is not a production credential. Regenerate with
`node scripts/gen-document-signature-fixtures.mjs` after building the workspaces.

The baseline has signed T12, budget and historical T12 blocks. Relabeling,
reactivating history and splicing a block leave all three block signatures
valid but must fail the detached document subject comparison. Deleting history,
changing frontmatter or retained prose also fails. JSON indentation changes preserve
the envelope semantic digest. Other cases pin absence, unknown keys, malformed
encoding, edited signing metadata, unsupported versions and source ambiguity.

`signing-input.json` contains the exact RFC 8785 payload without `sig`.
Every scenario includes source, detached artifact and its authentication state.
All but the unchecked-backend API case also provide a portable CLI baseline.
The optional Integrity capability is `document-signature-verification`.

A valid document signature authenticates a semantic snapshot; it does not
establish that its numbers are correct or every block author endorsed the
assembly. Source-block accounting is tested independently in the verifier's
unit suite, including all collections, duplicate active keys, extension history,
duplicate JSON/YAML members and ambiguous annotations.
