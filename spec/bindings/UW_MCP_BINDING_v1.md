# UW Markdown MCP Binding 1.0

**Status:** Stable companion profile
**Binding version:** 1.0.0
**Protocol:** UW Protocol 1.2.0
**Envelope:** UW Document Envelope 1.0

## 1. Scope

This optional profile exposes UW Markdown records to Model Context Protocol
clients. It defines stable resource identities, five tool contracts, result
placement, and concurrency behavior. It does not require a particular MCP SDK or
transport and does not alter any UW representation.

## 2. Resources

The canonical deal resource URI is:

```text
https://uwmd.org/deals/{deal_id}
```

The discoverable RFC 6570 resource template is:

```text
https://uwmd.org/deals/{deal_id}{?representation,view}
```

Omitted `representation` means `uw-json`. Supported model values are `uw-json`,
`uw-xml`, and `uw-csv-bundle`. Supported view values are `deal_summary`,
`rent_roll`, `operating_statement`, `debt`, `valuation`, and `sources_uses`.
A server returns `406`-equivalent tool errors when a requested view's source
section is absent.

Resource contents MUST declare their registered MIME type:

- UW JSON and UW XML are MCP text resource contents;
- named CSV views are UTF-8 text resources with `text/csv; charset=utf-8`;
- UW CSV ZIP bundles are MCP blob resource contents containing base64 ZIP bytes,
  or resource links resolved by another authorized endpoint.

A resource variant URI identifies a representation of the canonical deal; it is
not a second deal identity.

## 3. Tool result rule

Small results SHOULD use `structuredContent`. The same value serialized as one
compact JSON text content block SHOULD accompany it for clients that do not
consume structured results. Complete documents and binary artifacts SHOULD be
resource links rather than members of `structuredContent`.

Tool errors use `isError: true` with a compact text explanation and SHOULD also
provide structured `code`, `message`, and retry/precondition details. Servers
MUST NOT expose stack traces or confidential source bodies in tool errors.

## 4. Tools

### `uwmd.get_document`

Input:

```json
{
  "deal_id": "deal_123",
  "representation": "uw-json",
  "view": null
}
```

`representation` defaults to `uw-json`. `view` is mutually exclusive with a
non-default representation. The structured result contains `deal_id`,
`resource_uri`, `representation_id` or `view`, `fidelity`, `media_type`, and
`semantic_digest`; content also includes a `resource_link`.

### `uwmd.validate`

Input requires `deal_id`. The server loads and validates the current envelope
through the core validator. Structured output contains `deal_id`, `resource_uri`,
`semantic_digest`, `overall_status`, `stage_readiness`, and `issues`.

### `uwmd.convert`

Input requires `deal_id` and `target_representation`; `source_representation` is
optional when the server loads a stored envelope. Conversion MUST decode once to
the shared envelope and encode through the target registry codec. Output uses
the same compact metadata and resource-link pattern as `get_document`.

### `uwmd.apply_edit`

Input requires `deal_id`, `if_match`, a UW Protocol `EditOperation`, and actor
context (`actor`, `source`, optional confidence and agent identity). The server
MUST use the Tier-2 editor and strong semantic `If-Match` comparison. Structured
output contains the new `semantic_digest`, `etag`, assigned version where
applicable, and whether a prior block was superseded. The updated document is a
resource link, not an inline structured document.

### `uwmd.list_representations`

Input is an empty object. Structured output contains the resource template,
ordered representation descriptors, fidelity/directions/limits, and named view
profiles.

## 5. Tool annotations

Servers SHOULD annotate `get_document`, `validate`, `convert`, and
`list_representations` as read-only. `apply_edit` is not read-only or idempotent;
it is retry-safe only when the caller retains the original `if_match`, because a
successful first call changes the ETag and a duplicate call then fails `412`.

## 6. Context efficiency

Agents SHOULD request a named view or existing UW context profile before loading
a complete audit envelope. Full JSON/XML is appropriate for reconstruction,
conversion, or detailed review. CSV ZIP bundles SHOULD remain resource links
unless the client explicitly needs the files.

Servers SHOULD return validation issue arrays, representation descriptors, edit
receipts, and deal summaries directly as structured content. They SHOULD NOT
return prose-heavy full documents in tool metadata.

## 7. Security

MCP hosts and servers remain responsible for authentication, authorization,
consent, and tenant isolation. `deal_id` is not an authorization boundary. An
implementation MUST authorize both the canonical deal and the requested
representation/resource link.

Resource resolution MUST apply the same codec size, UTF-8, XML entity, digest,
and ZIP extraction protections as file and HTTP entry points. Servers MUST NOT
accept arbitrary resource URIs as filesystem paths.

## 8. Reference API

`@uwmd/core` exports `createUWMCPResource`,
`createUWMCPGetDocumentResult`, `createUWMCPValidationResult`,
`createUWMCPListRepresentationsResult`, `applyUWMDSourceEdit`, and
`createUWMCPApplyEditResult`. The returned shapes match MCP text, blob,
resource-link, and dual structured/text result semantics without coupling core
to a specific SDK release.
