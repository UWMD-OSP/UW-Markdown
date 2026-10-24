# UW Document Envelope 2.0

The full model and complete source subject are defined by accepted [RFC 0089](../docs/rfcs/0089-lossless-extension-envelope.md), D1–D6. The executable shape is [uw-document-envelope.schema.json](schemas/uw-document-envelope.schema.json). This contract is distinct from the portable parse minimum and the source-authentication admission guard.

## Model and current extensions

The Envelope has `envelope_version: "2.0"`, `format_version: "3.0"`, frontmatter, builtin `sections`, the three append-only arrays, `extensions` and `superseded`. Every collection is present. Each full block has `annotation`, complete JSON `content` (including `_meta`) and optional `prose`. Unknown outer and block members are retained. Absent values, null, empty strings/objects/arrays, and scalar types remain distinct; JCS identifies negative zero with zero.

An extension entry is exactly one closed wrapper:

```json
{"mode":"single","block":{"annotation":{"section":"x_example"},"content":{}}}
```

or `{"mode":"variants","blocks":[{"variant":null,"block":...},{"variant":"default","block":...}]}`. These fragments illustrate wrappers only; full carrier blocks must satisfy the referenced block schema. A variants entry is nonempty; each record has exactly `variant` and `block`. Identities are null or strings and equal `block.annotation.variant ?? null`. Records have unique identities in null-first, then UTF-16 code-unit order. Decoders refuse duplicates and noncanonical order instead of repairing it. Null, `""` and `"default"` are distinct. Collection keys, annotation section and `_meta.section` agree; active extensions cannot be marked superseded.

## Source selection and accounting

Generic role opt-in is evaluated from active blocks: presence of `_role` and an explicit variant in that section activates variant selection. Historical roles do not activate it. An active peer need not itself declare a role. Extensions use exact nullable identities; builtin parallel sections retain their existing default-key rule.

Within a selection identity, the last physical active occurrence is current regardless of revision. Replacing a selected occurrence appends that prior occurrence to history at that event. Explicit history appends at its physical event. Do not change the prior annotation or metadata to label history. A history-only extension has no invented current entry. Fresh-source projection accounts for every physical occurrence exactly once, including equal-valued occurrences. Mutable and assembled model projection commits its current full model; retained metadata evidence is not an immutable source certificate. Append-only collection shapes and source order remain unchanged.

The public parsed API uses `UWExtensionEntry<T>` with the same tagged wrappers. Full carrier readers retain unknown outer/block members in `envelopeExtras` on the parsed record/block; these data members survive ordinary snapshots. `envelopeProsePresent` preserves an explicitly empty block prose value. These are parsed implementation fields, not additional Envelope members. Extra values must be disjoint from the known full model members. Unrepresented parsed members refuse instead of disappearing from a commitment.

The portable extension projection has the same wrappers, with each block projected to `{meta?,content}`. `meta` is present iff `_meta` was authored, including null. `content` removes only `_meta` and `_notes`, retaining `_role`, `_overrides` and any ordinary member named `content`. Annotation/prose echoes are not required by that minimum.

## Admission and subject

All JSON carriers, manifests and embedded JSON cells reject duplicate decoded member names before construction, nonfinite binary64 values and unpaired Unicode surrogates. Direct models must be plain JSON values: inspect all own property descriptors without invoking getters, reject hidden/accessor/symbol/undefined/function members, sparse arrays and array extras; intrinsic array length is structural. Plain and frozen JSON remain admitted. Stamping admits and snapshots the input before copying or asynchronous hashing; a successful stamp matches its returned model. No universal hostile-Proxy safety is claimed.

Full carrier schema admission requires complete block metadata and frontmatter. Complete source projection and low-level semantic commitments impose JSON-value and exact occurrence accounting without importing full carrier validation. V.13 keeps its stricter existing source guard, including refusal of repeated/historical extensions and ambiguous selections. Receipt issuance keeps its own admission and may record validation findings without blocking issuance. A validity finding does not describe deal quality.

The complete identity is `uw-envelope-semantic`, canonicalization version `2.0`: remove only top-level `generated_at`, `generator` and `semantic_digest`, apply RFC 8785, hash UTF-8 with SHA-256 and render lowercase `sha256:<hex>`. Whole-model consumers use this identity deliberately. V.9 block content, V.11 six signed fields, V.12 selected payment vector, receipt results and signing-input commitments retain their separately specified scopes. A fresh stamp does not rebind a plan; rebinding is an explicit reviewed action.

## Representations

UW JSON representation 2.0.0 serializes this full model. [UW XML 2.0](UW_XML_MAPPING.md) and [UW CSV Bundle 2.0](UW_CSV_BUNDLE.md) are total mappings of it. Unknown full-model values cannot be silently discarded on conversion. Markdown writers must reproject and compare the complete semantic value, refusing models they cannot express; they cannot invent roles, variants, history flags or metadata.

A schema-valid carrier is not financial verification. Source authentication, receipt policy, engine identity and financial recomputation retain their own ordered state machines.
