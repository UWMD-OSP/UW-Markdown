# UW CSV Bundle 1.0

**Status:** Release candidate
**Representation ID:** `uw-csv-bundle`
**Representation version:** `1.0.0`
**Media type:** `application/vnd.uwmd.csv-bundle+zip`
**File extension:** `.uw.csv.zip`

## 1. Scope

UW CSV Bundle is a deterministic, model-fidelity encoding of UW Document
Envelope 1.0. It uses normalized long-form CSV tables so nested values,
provenance, variants, prose, extensions, and superseded history round-trip
without asset-class-specific columns. Optional wide CSV files are explicitly
lossy views and are never reconstruction inputs.

The ZIP file is the exchange artifact. The same files exposed as a directory
are the debugging and source-control form.

## 2. Required files

| File | Cardinality | Purpose |
|---|---:|---|
| `manifest.json` | one | Versions, semantic digest, inventory, hashes, views, and safety policies |
| `document.csv` | one data row | Envelope/format versions, volatile metadata, deal identity, and unknown top-level members |
| `frontmatter.csv` | one row/value node | Typed JSON Pointer rows for the complete frontmatter object |
| `blocks.csv` | one row/block | Encoding-local block reference, collection, section, variant, ordinal, and current/superseded state |
| `block_values.csv` | one row/value node | Typed annotation, provenance (`meta`), and content values for each block |
| `prose.csv` | zero or one row/block | Exact prose represented as a JSON string |

Every CSV uses UTF-8, a header row, comma separators, RFC 4180 quoting, CRLF
records, and a final CRLF. The reference encoder quotes every cell.

## 3. Typed value rows

`frontmatter.csv` has columns `pointer`, `json_type`, and `value_json`.
`block_values.csv` adds `block_ref` and `scope` before those columns. `scope` is
one of `annotation`, `meta`, or `content`; `meta` reconstructs
`content._meta`, while `content` excludes that subtree.

Every object and array has a row with an empty `value_json`. Scalars carry
canonical JSON in `value_json`. JSON Pointer escaping follows RFC 6901. Root
objects use the empty pointer. This preserves empty containers, scalar types,
array order, null versus absence, unsafe object keys, and arrays longer than
single-digit indices without type inference.

`block_ref` is the exact JSON Pointer to that block in the envelope. It is local
to the encoding and is not a durable business identifier.

## 4. Manifest and integrity

The manifest contains:

- `bundle_version`, `envelope_version`, and `format_version`;
- the Envelope 1.0 `semantic_digest`;
- a sorted inventory of every payload file with path, media type, UTF-8 byte
  length, SHA-256 digest, fidelity, and optional view profile;
- view descriptors with profile, source sections, column schema version, and
  spreadsheet-safety policy; and
- `normalized_value_encoding: "canonical-json"` and
  `csv_dialect: "rfc4180"`.

`manifest.json` does not hash itself. A decoder MUST reject missing, unlisted,
duplicate, size-mismatched, or hash-mismatched payload files. After rebuilding
the envelope, it MUST validate Envelope 1.0 and verify that the reconstructed
semantic digest equals both the document and manifest digest.

## 5. Wide views

The reference encoder emits these profiles when their source section exists:

| File | Profile | Source |
|---|---|---|
| `views/deal_summary.csv` | `deal_summary` | frontmatter and quick metrics |
| `views/rent_roll.csv` | `rent_roll` | `rent_roll` (one row/unit when units exist) |
| `views/operating_statement.csv` | `operating_statement` | `noi_model` |
| `views/debt.csv` | `debt` | `debt_structure` |
| `views/valuation.csv` | `valuation` | `valuation` |
| `views/sources_uses.csv` | `sources_uses` | `sources_uses` |

Nested objects use dotted column paths. Remaining arrays use canonical JSON in
a cell. These files omit audit structure and MUST declare `fidelity: "view"`.
Cells whose first non-whitespace character is `=`, `+`, `-`, or `@` receive an
apostrophe prefix. The manifest declares `spreadsheet_safety:
"apostrophe-prefix"`. View escaping is intentionally presentation-oriented and
does not affect normalized reconstruction.

## 6. Deterministic ZIP

Writers MUST sort paths, use a fixed ZIP timestamp, and produce identical bytes
for the same stamped envelope and codec version. The reference encoder uses
DEFLATE level 6 and the DOS-compatible timestamp 1980-01-02T00:00:00Z.

## 7. Secure decoding

Before decompression, decoders MUST inspect the central directory and reject:

- absolute, drive-qualified, empty-segment, dot-segment, or backslash paths;
- duplicate paths, symlinks, encrypted entries, multi-disk archives, and ZIP64
  entries unsupported by the implementation;
- invalid UTF-8 names;
- excessive compressed size, expanded size, file count, or compression ratio;
  and
- a central directory outside the archive.

The reference limits are 50 MiB compressed, 200 MiB expanded, 100 files, and a
100:1 per-entry compression ratio with a 1 MiB allowance. All extracted text
files must be valid UTF-8.

## 8. Reference API and CLI

`@uwmd/core` exports directory and ZIP functions plus
`UW_CSV_BUNDLE_CODEC`. The shared registry exposes the ZIP codec.

```sh
uwmd convert deal.uwx.md --to uw-csv-bundle
uwmd convert deal.uw.csv.zip --to uw-json
uwmd convert deal.uw.xml --to csv --output deal.uw.csv.zip
uwmd formats --json
```

`csv` and `csv-bundle` are CLI aliases for `uw-csv-bundle`.
