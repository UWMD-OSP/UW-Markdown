# UW Markdown HTTP Binding 1.0

**Status:** Stable companion profile
**Binding version:** 1.0.0
**Protocol:** UW Protocol 1.2.0
**Envelope:** UW Document Envelope 1.0

## 1. Scope

This profile carries registered UW Markdown representations over HTTP. It is
optional: implementing it is not required by any UW Protocol conformance tier.
The binding delegates all serialization, validation, and editing to the shared
codec registry and protocol implementation.

Normative words such as MUST and SHOULD use RFC 2119 meanings.

## 2. Resource identity and endpoints

The stable public identity of a deal is:

```text
https://uwmd.org/deals/{deal_id}
```

Deployment endpoints are configurable and need not share that origin. A
reference API exposes:

```text
GET   /v1/deals/{deal_id}
PUT   /v1/deals/{deal_id}
PATCH /v1/deals/{deal_id}
GET   /v1/representations
```

A representation query parameter is not used for model encodings; clients use
`Accept`. Lossy views MAY use `?view={profile}` and MUST identify their fidelity.

## 3. Registered media types

| Codec | Media type | Body |
|---|---|---|
| UW JSON 1.0 | `application/vnd.uwmd.document+json` | UTF-8 text |
| UW XML 1.0 | `application/vnd.uwmd.document+xml` | UTF-8 text |
| UW CSV Bundle 1.0 | `application/vnd.uwmd.csv-bundle+zip` | ZIP bytes |

A missing `Accept` defaults to UW JSON. Negotiation follows Protocol 1.2 exact,
`type/*`, and `*/*` rules. Preference ties resolve JSON, XML, then CSV bundle for
the codecs implemented in this release. A model request MUST NOT receive a
view.

## 4. Read responses

A successful response MUST include:

- `Content-Type` for the selected representation;
- `Vary: Accept`;
- `ETag` equal to the quoted semantic digest, for example
  `"sha256:0123…cdef"`;
- `UWMD-Semantic-Digest` containing the unquoted digest.

It SHOULD include `Content-Length`. Binary bundle responses SHOULD use
`Content-Disposition: attachment` with `.uw.csv.zip`.

`If-None-Match` supports `*`, strong tags, and weak comparison for reads. A match
returns `304 Not Modified` without a body. The semantic digest excludes volatile
generator fields, so the ETag changes only when underwriting semantics change.

## 5. Writes and concurrency

`PUT` consumes a registered readable media type and replaces the model record.
An update SHOULD require `If-Match`; creation SHOULD use `If-None-Match: *`.
Servers MUST decode and verify the representation through the registered codec
before storing it.

`PATCH` consumes a UW Protocol `EditOperation` and an actor context. It targets
the model while delegating source-preserving Markdown mutation to the Tier-2
editor. Existing records MUST require `If-Match`. A successful edit returns the
new semantic ETag and a resource link or negotiated representation.

Strong `If-Match` comparison is required. `*` matches any current resource;
weak tags never satisfy a write precondition.

## 6. Status and error mapping

| Status | Code | Meaning |
|---:|---|---|
| 400 | `BINDING_*` | Malformed body, UTF-8, identifier, or adapter input |
| 406 | `REPRESENTATION_NOT_ACCEPTABLE` | No writable representation satisfies `Accept` |
| 409 | protocol edit code | Tier-2 edit rejected by policy or current state |
| 412 | `BINDING_PRECONDITION_FAILED` | `If-Match` is stale |
| 415 | `REPRESENTATION_UNSUPPORTED_MEDIA_TYPE` | Unsupported request `Content-Type` |
| 428 | `BINDING_PRECONDITION_REQUIRED` | Required `If-Match` is absent |

Error responses SHOULD use `application/problem+json` and include stable `code`
and `message` members. Protocol-subsystem errors SHOULD preserve the normative
`ProtocolError` category and pointer/remediation fields.

## 7. Security and limits

Servers MUST authenticate and authorize writes according to their deployment;
this profile defines no identity system. Public deployments MUST use TLS.
Implementations MUST apply each codec's declared `max_bytes` and parser limits
before materializing untrusted input. CSV ZIP extraction MUST retain the limits
and path protections in UW CSV Bundle 1.0.

ETags are concurrency/cache validators, not authorization tokens or signatures.
Logs SHOULD record actor, selected representation, semantic digest, outcome, and
protocol edit identity without logging complete confidential deal bodies.

## 8. Reference API

`@uwmd/core` exports `createUWHTTPResponse`, `decodeUWHTTPRequest`,
`assertUWIfMatch`, `uwmdETag`, and `uwmdDealResourceURI`. The example OpenAPI 3.1
contract is [`UW_HTTP_API_v1.openapi.json`](UW_HTTP_API_v1.openapi.json).
