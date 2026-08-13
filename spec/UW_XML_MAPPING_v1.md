# UW XML Mapping 1.0

**Status:** Release candidate
**Representation ID:** `uw-xml`
**Representation version:** `1.0.0`
**Media type:** `application/vnd.uwmd.document+xml`
**File extension:** `.uw.xml`
**Namespace:** `https://uwmd.org/ns/document/1`

## 1. Scope

UW XML is a deterministic, model-fidelity encoding of the UW Document Envelope
1.0. It preserves every envelope value, including unknown extension members,
JSON scalar types, array order, prose, provenance, and superseded history. It
does not preserve the original Markdown byte stream.

The envelope contract and semantic-equivalence rules are defined by RFC 0014.
This document defines only the XML mapping. The XSD in
`spec/schemas/uw-document-envelope.xsd` provides structural tooling support;
the codec performs the normative type, duplicate-member, envelope, and digest
checks that XSD 1.0 cannot express.

## 2. Document element

The document MUST be UTF-8 XML 1.0 with this root:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<uw:document xmlns:uw="https://uwmd.org/ns/document/1"
             envelope-version="1.0"
             format-version="1.1">
  <!-- envelope members -->
</uw:document>
```

`envelope_version` and `format_version` map to the two required root
attributes. Every other envelope member maps to a child element.

## 3. Values

Every value element MUST carry `uw:type`, with exactly one of `object`, `array`,
`string`, `number`, `boolean`, or `null`.

| Envelope value | XML form |
|---|---|
| object | Child members inside an element with `uw:type="object"` |
| array | Ordered, repeated `<uw:item>` children inside `uw:type="array"` |
| string | XML character data inside `uw:type="string"` |
| number | A finite JSON-number lexical value inside `uw:type="number"` |
| boolean | Exactly `true` or `false` inside `uw:type="boolean"` |
| null | An empty element with `uw:type="null"` |

Empty strings, empty objects, empty arrays, and null remain distinct. Absent
members remain distinct from present null members. Non-finite numbers are not
part of the envelope value model and MUST be rejected.

## 4. Object member names

A member name matching `[A-Za-z_][A-Za-z0-9._-]*`, except the reserved names
`item` and `member`, maps directly to an element in the UW namespace. All other
names MUST use `uw:member` with the exact key in a `name` attribute. Consumers
MUST restore that attribute value as the object key and MUST reject duplicate
keys after restoration.

```xml
<uw:frontmatter uw:type="object">
  <uw:deal_id uw:type="string">deal-123</uw:deal_id>
</uw:frontmatter>
<uw:member uw:type="object" name="vendor/path">
  <uw:member uw:type="string" name="space key">preserved</uw:member>
</uw:member>
```

No key sanitization, case folding, or namespace interpretation is permitted.

## 5. Deterministic encoding

The reference encoder MUST:

1. emit the XML declaration and `uw:document` root exactly as shown above;
2. order known top-level members as `generated_at`, `generator`,
   `semantic_digest`, `frontmatter`, `sections`, `pipeline_log`,
   `custom_calculations`, `custom_scenarios`, `extensions`, `superseded`, then
   unknown members in Unicode code-unit sort order;
3. sort nested object keys in Unicode code-unit order;
4. preserve array order;
5. use two-space indentation, LF line endings, and a final LF;
6. escape XML text and attributes without changing their decoded values; and
7. encode finite numbers using the JavaScript/JSON shortest round-trippable
   lexical form, with negative zero encoded as `0`.

Whitespace used to indent object and array content is not part of the envelope.
Whitespace inside a string value is significant.

## 6. Integrity

Before encoding, the writer MUST stamp `semantic_digest` using the Envelope 1.0
canonical semantic digest. A decoder receiving a digest MUST verify it before
returning the document. Consequently, semantically equivalent UW JSON and UW
XML documents have the same digest even though their bytes differ.

## 7. Secure decoding

Conforming decoders MUST disable or reject DTDs, entity declarations, external
entities, external resource loading, and executable transforms. They MUST set
finite input-size and nesting-depth limits and MUST reject duplicate object
members, undeclared value types, unexpected attributes/elements, invalid XML
1.0 characters, and digest mismatches.

The reference codec defaults to 10 MiB and 64 value levels. It rejects any
input containing a `DOCTYPE` or `ENTITY` declaration before XML parsing. XML's
five predefined entities and numeric character references remain supported.

## 8. Reference API and CLI

`@uwmd/core` exports `UW_XML_CODEC`, `stringifyUWXml`, `parseUWXml`,
`parseUWXmlVerified`, and the shared `CORE_CODEC_REGISTRY`. Registry and CLI
decoding use the verified entry point; the general parser permits unsigned XML
for inspection while still verifying any digest it receives.

```sh
uwmd convert deal.uwx.md --to uw-xml
uwmd convert deal.uw.xml --to uw-json
uwmd convert deal.uw.json --to xml --stdout
uwmd formats --json
```

Input representation is detected from `.uwx.md`, `.uw.md`, `.uw.json`, or `.uw.xml`.
Machine inputs must carry a valid semantic digest. `json` and `xml` are CLI
aliases for the canonical `uw-json` and `uw-xml` representation IDs.
