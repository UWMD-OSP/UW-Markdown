---
rfc: 0014
title: Define extensible multi-format interchange
status: draft
author: jaredmaxey
created: 2026-07-25
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0014: Define extensible multi-format interchange

## Summary

Define a format-neutral UW Document Envelope and an extensible codec contract for
representing the same underwriting record as `.uw.md`, `.uw.json`, `.uw.xml`, or
a normalized CSV bundle. `.uw.md` remains the canonical human-authored and
byte-preserving record. JSON becomes the primary machine interchange encoding;
XML and CSV bundles are deterministic projections of the same envelope. Separate
view exports remain deliberately lossy. The RFC also defines representation
discovery and negotiation for HTTP APIs and Model Context Protocol (MCP) servers,
plus a registry that allows later encodings without another protocol redesign.

## Motivation

The codebase already contains two concepts that look similar but have different
guarantees:

- `uwjson.ts` serializes provenance, prose, annotations, variants, extensions,
  and superseded history and can rehydrate a `ParsedUWFile`.
- `renderer.ts` emits convenient JSON and a one-row CSV of selected values. These
  outputs omit information and cannot reconstruct the source model.

That distinction is not yet normative. As a result, an API or AI integration can
reasonably call either output "UW JSON," and a future CSV implementation could
silently discard audit history. XML also needs a defined mapping; generic
JSON-to-XML conversions disagree on arrays, nulls, attributes, ordering, and
extension values.

The current `ImplementationManifest.capabilities` union compounds the problem.
Adding `render-xml`, `read-json`, `write-json`, and similar tokens for every new
encoding grows without describing media type, direction, fidelity, streaming, or
size constraints.

AI and MCP consumers need compact structured results for common queries and
stable resource representations for complete records. HTTP clients need ordinary
content negotiation, cache validators, and explicit errors. Both should use the
same codecs instead of implementing transport-specific serializers.

## Proposed change

### 1. Separate model, encoding, view, and transport

The specification MUST distinguish four layers:

1. **UW Document Envelope** — the format-neutral semantic record.
2. **Encoding** — a reversible representation of that envelope, such as UW JSON.
3. **View** — an explicitly lossy projection for display, analytics, or prompting.
4. **Transport binding** — delivery through files, HTTP, MCP, or another protocol.

A transport MUST NOT change the semantics of an encoding. A view MUST identify
itself as a view and MUST NOT claim lossless or model-equivalent round-trip.

`.uw.md` remains the canonical authoring representation. It is the only v1
representation with a byte-preserving Tier-2 edit contract. Other encodings
round-trip the envelope, not the original Markdown byte stream.

### 2. UW Document Envelope

The normative envelope starts from the existing `UWJsonDocument` shape:

```ts
interface UWDocumentEnvelope {
  envelope_version: string;
  format_version: string;
  generated_at?: string;
  generator?: string;
  frontmatter: UWFrontmatter;
  prose: Record<string, string>;
  sections: Record<string, UWEnvelopeBlock | Record<string, UWEnvelopeBlock>>;
  pipeline_log: UWEnvelopeBlock[];
  custom_calculations: UWEnvelopeBlock[];
  custom_scenarios: UWEnvelopeBlock[];
  extensions: Record<string, UWEnvelopeBlock>;
  superseded: Record<string, UWEnvelopeBlock[]>;
}
```

The implementation MAY retain `uwjson_version` as an alias during migration, but
the neutral schema MUST use `envelope_version`. The envelope version governs the
container shape; `format_version` governs UW section semantics. Codec and bundle
versions are independent and MUST NOT be inferred from either field.

An envelope block MUST preserve the existing annotation, `_meta` provenance,
content, and prose values. JSON object member order is not semantic. Array order,
absent versus present values, JSON scalar types, variants, and superseded order
are semantic and MUST be preserved.

`generated_at` and `generator` are volatile serialization metadata. They MUST be
excluded when calculating semantic equivalence.

### 3. Fidelity classes

Every representation descriptor MUST declare one of these fidelity classes:

| Fidelity | Guarantee |
|---|---|
| `source` | Preserves the authoring byte stream under the Tier-2 edit rules. |
| `model` | Decodes to a semantically equivalent UW Document Envelope. |
| `view` | Deliberately omits or transforms data for a named use case. |

`.uw.md` is `source`. UW JSON and UW XML are `model`. The normalized CSV bundle
defined below is `model`; wide analytical CSVs are `view`.

Two envelopes are semantically equivalent when their canonical JSON forms are
byte-equal after removing volatile serialization metadata. Canonical JSON and
SHA-256 follow Protocol v1 §V.9 and RFC 8785. Encoders SHOULD emit a
`semantic_digest` using `sha256:<lowercase hex>`; decoders that receive it MUST
verify it before returning a document.

### 4. Representation registry and codec contract

`ImplementationManifest` gains an additive `representations` array. Existing
`render-*` capability tokens remain valid for v1 compatibility but are
deprecated for interchange discovery.

```ts
type RepresentationFidelity = 'source' | 'model' | 'view';
type RepresentationDirection = 'read' | 'write';

interface RepresentationCapability {
  id: string;                    // e.g. "uw-json"
  media_types: string[];
  file_extensions: string[];
  directions: RepresentationDirection[];
  fidelity: RepresentationFidelity;
  representation_version: string;
  view?: string;                 // required when fidelity === "view"
  streaming?: boolean;
  max_bytes?: number;
}

interface UWCodec<TInput = unknown, TOutput = unknown> {
  readonly descriptor: RepresentationCapability;
  decode(input: TInput, options?: DecodeOptions): UWDocumentEnvelope;
  encode(document: UWDocumentEnvelope, options?: EncodeOptions): TOutput;
}
```

`@uwmd/core` will expose `CodecRegistry`, `registerCodec`,
`decodeUWDocument`, `encodeUWDocument`, and `negotiateRepresentation`.
Registration MUST reject duplicate IDs and ambiguous media types unless an
explicit priority is supplied. Core codec IDs are reserved with the `uw-`
prefix; third-party codecs SHOULD use a reverse-domain ID.

Negotiation MUST select by exact media type, then structured suffix, then
wildcard, honoring quality values where the transport supports them. When two
representations tie, the server preference order is UW JSON, UW Markdown, UW
XML, then CSV bundle. A caller MAY require a minimum fidelity; a `view` MUST
never satisfy a request for `model` or `source`.

### 5. UW JSON

UW JSON is the primary machine interchange encoding.

| Property | Value |
|---|---|
| Codec ID | `uw-json` |
| File extension | `.uw.json` |
| Media type | `application/vnd.uwmd.document+json` |
| Fidelity | `model` |
| Character encoding | UTF-8 |

Its wire shape is the UW Document Envelope. A JSON Schema 2020-12 document is
the semantic schema authority shared by all codecs. Unknown envelope members
MUST be preserved by a read/write implementation unless a future envelope
version declares otherwise.

The existing renderer JSON remains available as the `deal-summary` view. It
SHOULD be renamed at the API boundary to prevent confusion with UW JSON and uses
`application/vnd.uwmd.view+json; profile="deal-summary"`.

### 6. UW XML

UW XML is a deterministic XML 1.0 mapping of the envelope.

| Property | Value |
|---|---|
| Codec ID | `uw-xml` |
| File extension | `.uw.xml` |
| Media type | `application/vnd.uwmd.document+xml` |
| Namespace | `https://uwmd.org/ns/document/1` |
| Fidelity | `model` |
| Character encoding | UTF-8 |

The root is `<uw:document>`. Envelope properties map to child elements in the
schema order. Objects use named child elements; arrays use repeated `<uw:item>`
children. JSON strings, numbers, booleans, and nulls use `uw:type` only where
the schema or an extension does not determine the type. XML attributes are
limited to envelope/format versions, discriminators, and identifiers; business
values MUST remain elements.

XML decoders MUST disable DTDs and external entity resolution and MUST enforce
document-depth, entity, and input-size limits. They MUST reject duplicate
singleton elements and values that cannot be represented in the JSON semantic
model. An XSD MAY assist XML tooling, but the JSON Schema and mapping rules are
the semantic authority.

### 7. UW CSV bundle

A single wide CSV cannot represent nested values, variants, provenance, prose,
extensions, and superseded history without unstable, asset-class-specific
columns. UW CSV is therefore a directory or ZIP bundle, not one CSV file.

| Property | Value |
|---|---|
| Codec ID | `uw-csv-bundle` |
| File extension | `.uw.csv/` or `.uw.csv.zip` |
| ZIP media type | `application/vnd.uwmd.csv-bundle+zip` |
| Fidelity | `model` |
| Character encoding | UTF-8 with header row |

The required files are:

| File | Purpose |
|---|---|
| `manifest.json` | Bundle, envelope, and format versions; semantic digest; file inventory and SHA-256 hashes. |
| `frontmatter.csv` | One row per frontmatter value, keyed by JSON Pointer and carrying JSON type. |
| `blocks.csv` | One row per block with a deterministic `block_ref`, collection, section, variant, history position, annotation, and provenance. |
| `fields.csv` | Long-form block content: `block_ref`, JSON Pointer, JSON type, and canonical JSON value. |
| `prose.csv` | Scope/reference and exact prose text, including quoted newlines. |

`block_ref` is an encoding-local JSON Pointer into the envelope, not a durable
business identifier. This avoids adding unstable IDs to existing `.uw.md`
blocks while providing deterministic joins within a bundle.

CSV follows RFC 4180 conventions with UTF-8 and CRLF records. Canonical JSON in
the value column preserves numbers, booleans, null, arrays, and objects without
type guessing. Implementations MUST defend against ZIP path traversal,
decompression bombs, excessive file counts, and spreadsheet formula injection.
Formula escaping is a presentation policy and MUST be reversible before digest
verification.

Asset-specific wide files such as `rent_roll.csv` or
`operating_statement.csv` MAY appear under `views/`. Each MUST be listed in the
manifest with `fidelity: "view"` and a stable profile ID. They are never required
to reconstruct the envelope.

### 8. HTTP API binding

An HTTP binding SHOULD expose a stable deal resource such as
`GET /v1/deals/{deal_id}` and use `Accept` for representation negotiation. The
default response is UW JSON. Responses MUST include `Content-Type`, SHOULD
include `ETag` derived from the semantic digest, and MUST include
`Vary: Accept` when negotiation is used.

Unsupported request media types return `415 Unsupported Media Type`; no
acceptable response representation returns `406 Not Acceptable`. Writes SHOULD
use `If-Match` to prevent lost updates. PATCH operations target the envelope
model, not serialized byte offsets. Source-preserving Markdown edits continue
to use the Tier-2 edit operations.

Views are requested explicitly through a media-type profile or a documented
`view` parameter. A server MUST NOT return a view when a client requested a
model-fidelity representation.

### 9. MCP binding

An MCP server SHOULD expose each deal as a resource with a stable URI and an
explicit MIME type. Resource templates SHOULD provide representation and view
parameters where the host supports them. Complete UW JSON and UW XML documents
may be returned as text resources; ZIP bundles MUST be returned as binary
resources or resource links, not text.

The reference binding defines these tools:

| Tool | Purpose |
|---|---|
| `uwmd.get_document` | Retrieve a model representation or named view. |
| `uwmd.validate` | Validate an envelope and return structured issues. |
| `uwmd.convert` | Convert between registered model representations. |
| `uwmd.apply_edit` | Apply a protocol edit with optimistic concurrency. |
| `uwmd.list_representations` | Discover codecs, directions, fidelity, and limits. |

Tool results SHOULD use `structuredContent` for compact JSON results and declare
an output schema. For compatibility with MCP clients that only consume content
blocks, a serialized JSON text block SHOULD accompany structured content.
Large or binary results SHOULD be resource links. MCP prompts and agent context
SHOULD request an existing context profile or named view rather than loading a
complete audit envelope by default.

MCP is a transport binding only: the tool names above MUST delegate to the same
codec registry, validator, and editor used by file and HTTP integrations.

### 10. Future encodings

New encodings require a registered descriptor, deterministic mapping, security
limits, and conformance fixtures; they do not require new manifest fields.
Likely candidates include JSON Lines for event streams, CBOR or MessagePack for
compact interchange, and Arrow or Parquet for analytical views. Protobuf is
deferred until the project can govern field numbers and unknown-field behavior.

No future encoding may claim `model` fidelity unless it preserves every
envelope value and passes the cross-format equivalence corpus.

### 11. Delivery phases

1. **Envelope and UW JSON:** publish the neutral envelope schema, migrate
   `uwjson_version`, and add semantic digest/equivalence tests.
2. **Registry and negotiation:** land the codec API, manifest descriptors, and
   HTTP/MCP binding specifications.
3. **UW XML:** implement the namespace mapping, secure parser, and fixtures.
4. **UW CSV bundle:** implement normalized tables, ZIP safety, and view profiles.
5. **Additional codecs:** accept separately reviewed codecs against the same
   registry and conformance contract.

Each phase can ship independently after the RFC is accepted. No phase is a v1.0
release blocker.

## Compatibility analysis

- **Existing `.uw.md` files:** remain valid and canonical. No migration is
  required.
- **Tier-1 Readers:** retain v1 conformance. Reading an additional representation
  is an opt-in capability.
- **Tier-2 Editors:** retain the current byte-preserving Markdown contract.
  Editing model encodings requires the new write capability but does not weaken
  Markdown guarantees.
- **Tier-3 Calc Hosts and Tier-4 Agent Hosts:** operate on the same parsed model.
  Transport and codec selection are additive.
- **Existing `.uw.json` users:** the initial implementation accepts both
  `uwjson_version` and `envelope_version` and emits both during one minor release.
  A later major version may stop emitting the alias after a deprecation notice.
- **Existing renderer JSON/CSV users:** outputs remain available as named views.
  CLI aliases may warn before any rename.
- **Modules:** section and extension payloads are preserved; no module manifest
  change is required.

The proposed media types use the vendor tree until UWMD can pursue formal media
type registration. Clients MUST also be able to select by codec ID in local
APIs where MIME negotiation is unavailable.

## Conformance impact

Existing fixtures do not change. Add `conformance/representations/` with:

- one golden envelope covering every collection, a variant, multiline prose,
  Unicode, null versus absent values, extensions, and superseded history;
- JSON, XML, CSV-directory, and CSV-ZIP encodings of that envelope;
- malformed fixtures for duplicate XML singletons, DTD/XXE, invalid scalar
  types, missing CSV files, hash mismatches, ZIP traversal, and size limits;
- media negotiation cases including quality values, wildcards, minimum fidelity,
  `406`, and `415` outcomes;
- MCP resource/tool shapes and HTTP headers;
- view fixtures proving lossy outputs cannot advertise `model` fidelity.

Every model codec MUST pass:

```text
decode(encode(envelope)) ≡ envelope
digest(decode(json)) = digest(decode(xml)) = digest(decode(csv-bundle))
```

Language-agnostic execution should use the runner proposed by RFC 0004. Until
then, the TypeScript reference runner gates the reference implementation.

## Reference implementation

- **Files affected:** `packages/uwmd-core/src/uwjson.ts`, new `envelope.ts`,
  `codec.ts`, `uwxml.ts`, and `uwcsv.ts`; `protocol.ts`; schema files under
  `spec/schemas/`; CLI export/convert commands; new representation fixtures.
- **API surface:** `UWDocumentEnvelope`, `RepresentationCapability`, `UWCodec`,
  `CodecRegistry`, `encodeUWDocument`, `decodeUWDocument`,
  `negotiateRepresentation`, and semantic digest helpers.
- **Migration:** `UWJsonDocument` becomes a deprecated type alias for
  `UWDocumentEnvelope`. Existing `toUWJson`, `parseUWJson`, and `fromUWJson`
  delegate to the JSON codec.
- **Views:** existing `renderJson` and `renderCsv` keep their output shape but are
  documented and exposed as `deal-summary` views.
- **Test plan:** unit tests per codec; property-based round trips; golden
  cross-format digests; hostile input tests; manifest and negotiation tests; CLI
  integration tests; MCP/HTTP contract examples validated against their schemas.

The implementation is follow-up work. The current RFC establishes names and
boundaries before code is added.

## Alternatives considered

### Make JSON the canonical authoring format

JSON is excellent interchange but loses Markdown's narrative editing experience
and cannot satisfy the existing byte-preserving Tier-2 contract. Keeping
Markdown canonical and JSON primary for machines serves both audiences.

### Use a generic JSON-to-XML converter

Generic converters make incompatible choices for arrays, nulls, attributes, and
invalid XML names. A defined namespace and mapping is more work but supports
independent implementations and stable round trips.

### Emit one wide CSV

A wide sheet is convenient for BI imports but cannot faithfully represent the
open, nested envelope across asset classes. Normalized long-form tables retain
the model; optional wide view files preserve convenience.

### Add one capability token per operation and format

Tokens are simple initially but cannot express fidelity, versions, media types,
limits, or future codecs. A descriptor array is additive and discoverable.

### Define transport-specific data models

Separate HTTP and MCP schemas would drift from file serialization. Reusing one
envelope and registry keeps validation, conversion, and conformance centralized.

## Unresolved questions

1. Should the final neutral field be `envelope_version` or
   `document_version`, and how long should `uwjson_version` be emitted?
2. Should CSV ZIP use a vendor `+zip` media type or `application/zip` with a
   profile parameter until registration guidance is settled?
3. Does v2 need durable block IDs, or is deterministic JSON-Pointer identity
   sufficient outside collaborative merge workflows?
4. Which HTTP paths belong in the core protocol versus an OpenAPI companion
   specification?
5. Should the MCP binding use stable HTTPS resource identities, a registered
   `uwmd:` URI scheme, or allow servers to choose while preserving deal IDs?
6. What input-size limits should the reference codecs choose by default?

## Prior art

- RFC 8785 supplies the existing canonical JSON and digest basis.
- RFC 6839 and RFC 7303 define structured syntax suffix behavior for JSON, ZIP,
  and XML media types.
- RFC 9110 defines HTTP representation negotiation and status semantics.
- MCP resources provide URI-identified text or binary content with MIME types;
  resource templates provide parameterized discovery, and MCP tools support
  structured output plus resource links.
- Frictionless Data packages and W3C CSV on the Web demonstrate manifest-backed,
  multi-table CSV interchange, though UW CSV uses its own envelope-specific
  normalization.
