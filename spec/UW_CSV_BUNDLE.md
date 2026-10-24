# UW CSV Bundle 2.0

**Status:** Release candidate
**Representation ID:** `uw-csv-bundle`
**Representation version:** `2.0.0`
**Media type:** `application/vnd.uwmd.csv-bundle+zip`
**File extension:** `.uw.csv.zip`

## 1. Scope

UW CSV Bundle is a deterministic, model-fidelity encoding of UW Document
Envelope 2.0. It uses normalized long-form CSV tables so nested values,
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
one of `annotation`, `meta`, `content`, or `block-extra`; `meta` reconstructs
`content._meta`, while `content` excludes that subtree.

Every object and array has a row whose `value_json` is respectively canonical `{}` or `[]`. Scalars carry
canonical JSON in `value_json`. JSON Pointer escaping follows RFC 6901. Root
objects use the empty pointer. This preserves empty containers, scalar types,
array order, null versus absence, unsafe object keys, and arrays longer than
single-digit indices without type inference.

`block_ref` is the exact JSON Pointer to that block in the envelope. It is local
to the encoding and is not a durable business identifier.

## 3a. Complete descriptors

`document.csv` has exactly `envelope_version,format_version,generated_at_json,generator_json,semantic_digest,deal_id_json,deal_name_json,extra_json,empty_collections_json`. `extra_json` is an object disjoint from all known outer model members. `empty_collections_json` is an array of closed `{path,kind}` records, strictly sorted by canonical JSON Pointer path, with no duplicate decoded addresses, aliases or overlapping populated descendants. The admitted locations are `/superseded/<section>` with kind `array` and `/sections/<section>` with kind `object`; an empty builtin variant map still fails full model schema admission. Grammar refusal precedes semantic digest comparison. Refreshing a byte inventory cannot make an overlapping descriptor lawful.

`blocks.csv` has exactly `block_ref,collection,section_json,variant_json,ordinal,state,extension_mode`. For a single extension, `block_ref` is `/extensions/<escaped id>/block`, mode is `single`, ordinal empty and variant is the exact nullable annotation identity. For variant extensions it is `/extensions/<escaped id>/blocks/<index>/block`, mode is `variants`, ordinal is that canonical contiguous array index and variant is the record identity. Other collections leave extension mode empty. Superseded/append-only block ordinals are contiguous canonical decimal indices. Descriptors must agree with the reconstructed model. Received row order has no semantic meaning; ordinals and identities do.

Every block has annotation, meta, content and block-extra scope roots. `meta` reconstructs `_meta`; content must not restate it. `block-extra` is an object disjoint from annotation/content/prose and preserves all other full block members. `prose.csv` retains present empty strings as well as nonempty prose. Reject missing/unused rows, duplicate decoded paths, pointer aliases, missing parents, scalar descendants, hidden values inside container tokens and noncanonical array indices. Raw manifests and every embedded JSON cell reject duplicate decoded JSON names and non-I-JSON values before object construction. Do not repair received extension ordering or guess a wrapper mode.

## 4. Manifest and integrity

The manifest contains:

- `bundle_version: "2.0.0"`, `envelope_version: "2.0"`, `canonicalization_version: "2.0"`, and `format_version: "3.0"`;
- the Envelope 2.0 `semantic_digest`;
- a sorted inventory of every payload file with path, media type, UTF-8 byte
  length, SHA-256 digest, fidelity, and optional view profile;
- view descriptors with profile, source sections, column schema version, and
  spreadsheet-safety policy; and
- `normalized_value_encoding: "canonical-json"` and
  `csv_dialect: "rfc4180"`.

`manifest.json` does not hash itself. A decoder MUST reject missing, unlisted,
duplicate, size-mismatched, or hash-mismatched payload files. After rebuilding
the envelope, it MUST validate Envelope 2.0 and verify that the reconstructed
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
- invalid UTF-8 names, invalid CRCs, inconsistent local/central names or sizes;
- excessive compressed size, expanded size, file count, or compression ratio;
  and
- a central directory outside the archive.

The reference limits are 50 MiB compressed, 200 MiB expanded, 100 files, and a
100:1 per-entry compression ratio with a 1 MiB allowance. All extracted text
files must be valid UTF-8. Inventory exact extracted bytes before text decoding
can consume a BOM; an uninventoried BOM refuses. Actual STORE, DEFLATE and
permitted streaming data-descriptor archives use the same bounded inspector.

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
