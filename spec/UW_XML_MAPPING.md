# UW XML Mapping 2.0

**Status:** Accepted contract (RFC 0089)  
**Representation ID/version:** `uw-xml` / `2.0.0`  
**Media type:** `application/vnd.uwmd.document+xml`  
**File extension:** `.uw.xml`  
**Namespace:** `https://uwmd.org/ns/document/2`

## 1. Total model mapping

UW XML encodes the entire [Envelope 2.0](UW_ENVELOPE.md), including unknown outer/block values, exact tagged extensions, annotations, metadata, prose and history. It does not preserve Markdown bytes. The root is `document` in the mapping namespace, with exactly the unqualified attributes `envelope-version="2.0"` and `format-version="3.0"`. It has exactly one `value` child encoding the entire model; root versions must agree with the enclosed model.

Every element is in the mapping namespace. Namespace prefixes are arbitrary admitted XML names, including default namespaces; element matching uses expanded names. Mapping attributes are unqualified. Reserved XML/XMLNS bindings, undeclared prefixes, duplicate expanded attributes and unexpected mapping names/attributes refuse.

## 2. Values and strings

`value` has exactly one unqualified attribute `type`, one of `object`, `array`, `string`, `number`, `boolean`, `null`.

| Type | Content |
|---|---|
| object | Ordered `member` children, each with exactly `name-json` and one `value` child |
| array | Ordered `value` children |
| string | Canonical ASCII JSON string lexical token S below |
| number | Finite JCS number token, with negative zero encoded as `0` |
| boolean | `true` or `false` |
| null | Empty content |

Object members may be received in any order; decoded duplicate names refuse before construction. The deterministic encoder sorts object keys in UTF-16 code-unit order and preserves array order. Object/array structure permits XML whitespace only between child elements. Scalar whitespace is data and must satisfy its token grammar.

S starts/ends with double quotes. Escape quote as `\"` and backslash as `\\`. Encode every UTF-16 code unit below U+0020 or at/above U+007F as lowercase `\u` plus four hex digits, including DEL. Supplementary characters use paired surrogate escapes; unpaired surrogates refuse. Other printable ASCII is literal. Short escapes and alternate spellings refuse. Decode XML entities/references exactly once, then decode the JSON string token and require its re-encoding to equal S. This preserves JSON NUL and noncharacters through lawful lexical escapes without admitting illegal XML characters.

```xml
<uw:document xmlns:uw="https://uwmd.org/ns/document/2" envelope-version="2.0" format-version="3.0"><uw:value type="object">...</uw:value></uw:document>
```

The ellipsis above is explanatory, not a valid document value. Actual contents must reconstruct a full schema-admitted, stamped Envelope.

## 3. XML admission and limits

Use UTF-8, XML 1.0 Fifth Edition character/Name/namespace rules. One initial BOM is permitted. An optional declaration is allowed only at the original start after that BOM, with lowercase `xml`, required `version='1.0'`, optional UTF-8 encoding (case-insensitive value) and optional `standalone='yes'|'no'` in that order. XML whitespace and either quote delimiter follow XML declaration grammar; malformed declarations refuse. End-of-line normalization precedes reference decoding. Literal attribute tabs/newlines normalize to spaces; referenced whitespace is retained.

The five predefined entities and valid decimal/hex numeric references decode once in text, attributes and namespace values. `&#0;`, invalid scalar references and illegal literal XML characters refuse. DTDs, entity declarations, comments, other processing instructions, external resources and transforms are forbidden. Reject structural mixed content, malformed names, unmatched tags, extra roots and trailing non-whitespace. Do not narrow Fifth Edition name admission to the host XML library's older name table.

Reference limits are 50 MiB input, JSON value depth less than128 and XML syntax depth less than384. The independent Python reader validates names/characters and performs an injective prefix-token alpha-renaming before ElementTree; it does not transform values or references and does not call Node. Conformance exercises Python3.12.3 and the selected3.12 runtime separately on Windows/Linux.

## 4. Integrity and API

Writers admit the full carrier model and stamp the complete semantic subject. Decoders perform grammar, duplicate-name and model admission before digest comparison, and require a matching stamp. `stringifyUWXml`, `parseUWXml`, `parseUWXmlVerified` and `UW_XML_CODEC` expose the same current regime. The XSD supplies structural tooling only; exact S, namespace, type/content, schema and digest checks remain decoder obligations.
