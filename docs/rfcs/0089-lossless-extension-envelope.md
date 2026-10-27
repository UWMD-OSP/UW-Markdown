---
rfc: 0089
title: Preserve extension variants in a complete versioned Envelope
status: accepted
author: UWMD maintainers
created: 2026-10-16
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0089: Preserve extension variants in a complete versioned Envelope

## Summary and recommendation

Use a tagged `single`/`variants` extension entry, exact nullable identities,
complete XML/CSV carriers and a separately identified whole-Envelope commitment.
The UWMD maintainers accepted D1–D6 on 2026-10-23 at RFC revision
`a8a33a96eb352cf316c8d22e23c0c5315362babb`, supported by independently reviewed
candidate `2f23cd2705c06a8763d9f27af192da17c2aa3b0a` against main
`6682bfd29967d8b16287333e31912b9a0e4b59d9`. All five candidate findings closed
on bounded independent evidence. Production integration is authorized through
normal implementation review and CI. Candidate closure does not establish
production support; the postacceptance gates below still apply. No release,
publication, deployment or public launch is authorized by this acceptance.

Retain the accepted design below. The required independent red-team and closure
review covered D2's source accounting, D4's bounded lawful domain and D5's
authentication boundary before owner acceptance.
Do not treat hash agreement or the old bounded labs as complete interoperability
proof. Close the evidence gates below before final acceptance/activation; no
unresolved product choice is delegated to a codec author.

## Motivation and current-main reconciliation

Format 2.8 admits active named extension peers under generic role opt-in.
Envelope 1.0 and `ParsedUWFile.extensions` still store one block per extension
id. Current parser extension routing returns before history/variant handling.
On current main, two named extension peers retain only the last; reversing
source order changes which peer survives and the semantic digest. A declared
superseded extension is likewise not retained in its history collection. This
is the live representation gap in [#365](https://github.com/UWMD-OSP/UW-Markdown/issues/365).

The earlier draft's builtin-routing description is stale: main now keeps the
last physical current builtin revision regardless of revision number and
retains overwritten blocks. RFC 0090's physical validation inventory does not
make the reduced Envelope complete or authenticate it. Current JCS rejects
invalid Unicode; that correction is already accepted, not an open gate.
RFC 0088's numerics are accepted. RFCs 0111/0124 require an explicit kept rule
set; RFC 0123 authenticates then recomputes dictionary receipt assertions even
without packs. Preserve those rules rather than the earlier pack-first wording.
RFC 0085 C+D is accepted and implemented on current main: supplied full history
is the subject, record-producing compaction is removed, and an absent declared
predecessor fails INT-01. It does not prove physical extension accounting. Old
reproducers importing the removed compaction export are not current evidence.
The independent red-team reproduced the extension loss/stale-plan blind spot
and actual-ZIP CRC/header/BOM defects; current-main repairs are tracked in
[#545](https://github.com/UWMD-OSP/UW-Markdown/issues/545) and
[#544](https://github.com/UWMD-OSP/UW-Markdown/issues/544), separately from this
RFC's new semantics. Those repairs do not close the complete-candidate gates.

## Accepted contract

### D1 — Tagged entries, unchanged other collection shapes

In the new supported Envelope regime replace only `extensions[id]`:

```ts
type ExtensionEntry =
  | { mode: 'single'; block: EnvelopeBlock }
  | { mode: 'variants'; blocks: Array<{
      variant: string | null;
      block: EnvelopeBlock;
    }> };
```

Wrappers/variant records are closed. `variants.blocks` is nonempty and contains
one current block per exact nullable identity. The outer map key, annotation
section and payload `_meta.section` MUST agree. An annotation variant, if
present, MUST be a string. Record `variant:null` means annotation member absent,
not a null annotation or the string `default`. Preserve full block values;
unknown admitted block members remain allowed. No wrapper discriminator is
inferred from a user label or payload member.

Null sorts first; strings sort by UTF-16 code units, without normalization.
Source projection constructs this order. Decoders MUST refuse duplicate identity,
noncanonical order or identity disagreement rather than sort/deduplicate a
received stamped model. Preserve legal labels including `default`, `content`,
`annotation`, `/`, `~`, empty strings where admitted and supplementary Unicode.
Existing source/unsafe-key admission remains; no new label ban.

### D2 — Route once by exact identity; account for source before reduction

For source projection, active roles plus explicit variant fences opt an
extension into variants mode under Format 2.8. A role on superseded history
alone does not activate it. Collect all active peers, including peers with no
role. An unlabelled peer has null identity, distinct from literal `default`.
A lone explicitly named role-bearing peer is still variants mode. A role-free
source not meeting opt-in retains ordinary singleton selection.

Within one applicable identity, current selection is the **last physically
occurring non-superseded block**, never highest revision. Keep distinct active
peers in the entry; do not aggregate them or move them into history. Preserve
explicit history in `superseded[id]` in physical order with complete authored
annotation/payload/prose. Retain overwritten same-identity prior blocks using
current main's prior-block retention convention; do not fabricate a superseded
lifecycle flag or erase their authored values. Unchanged builtin and append-only
collection shapes/order remain unchanged. An extension with history but no
current block has only a history slot, no invented active entry.

History appends at each physical insertion event: active A, explicit history B,
replacement active C produces history B,A; active A, replacement active C,
explicit history B produces A,B. Do not collect all explicit history first and
then append all overwritten priors.

Keep physical block inventory distinct from current selection and prior-block
storage. Every source block must be accounted for exactly once in its applicable
collection before claiming a complete source projection; equal payload values
are not duplicate physical identities. RFC 0090 validation inventory is neither
an immutable byte attestation nor permission to ignore overwritten source.
V.13's stricter duplicate/source guards remain a separate step (D5).

Directly authored models declare their mode explicitly. Preserve one-peer
variants mode even without a role. Model-to-Markdown MUST refuse if reprojecting
the proposed source cannot preserve exact mode, identities and complete values;
do not invent a role, label, annotation or source history to make it work.
JSON/XML/CSV exchange preserves model intent independent of Markdown emission.

| Input | Required new-regime result |
|---|---|
| Unlabelled singleton, role absent/present | single unless actual explicit-variant opt-in exists |
| Named default, no role | single, retaining annotation |
| Named default with role | variants with one exact string identity |
| base primary + detail peer | variants with both, independent of source order |
| Unlabelled primary + named default | variants with null then string default |
| Role on history only | no activation by that role; history retained |
| Same identity, earlier higher revision | last physical current wins; earlier block retained unchanged as prior |
| Direct one-peer variants, role absent | preserve through model codecs; refuse unrepresentable Markdown |
| Equal physical payloads | preserve both occurrences; equality is not deduplication |
| Interleaved active1, explicit-history2, active3 | current3; history[2,1], preserving current main's explicit/implicit retention convention |

### D3 — Portable minimum is not the authentication subject

Protocol II.6a.6 remains a subset contract, not an imposed internal parser type.
Only extension entries change their minimum shape: the D1 wrapper and exact
record identities, with each block projected as `{meta?,content}`. `meta` copies
authored `_meta` iff present, including explicit null. `content` copies authored
payload members except `_meta` and `_notes`; `_role`, `_overrides` and an ordinary
member named `content` remain payload. Ordered history retains the existing
block minimum. No annotation/prose/source-position echo becomes mandatory in
the minimum. Public reference parsed APIs must be able to carry the exact nullable
collection without coercing it into a default-key map.
An unlabelled singleton and named-default singleton can intentionally have the
same portable `single` minimum when their only difference is annotation echo.
That subset coincidence authenticates neither annotation. Exact `variants`
records still distinguish null from literal default.

The full Envelope preserves complete annotations, payloads, metadata, notes,
prose, outer block extras and unknown outer members, including absent/null/empty
and scalar-type distinctions. The portable minimum cannot reconstruct or
authenticate omitted values. No financial-role-selected view is model fidelity.
Carrier capacity does not widen admission: portable parsing can expose an
authored absent/null `_meta`, while full-Envelope admission requires the current
object-shaped metadata contract. Apply the relevant boundary explicitly.

### D4 — Complete exchange carriers

**JSON.** Serialize D1 directly. Raw JSON carriers and CSV manifests MUST refuse
duplicate decoded member names at every depth, before object construction erases
occurrences. Escaped unique names remain legal; no case/Unicode normalization.
Validate the model's shape, identity and supported stamp before received-digest
comparison. These are new-regime carrier rules, not a blanket new rule for every
existing JSON-taking API or a new receipt diagnostic.

**XML.** Choose the owner's total ASCII JSON-lexical mapping in a separately
identified namespace/codec. Use a generic typed value tree: object members carry
`name-json`, arrays carry ordered values, and string values carry one JSON-string
lexical token. Surround strings with quotes; escape quote/backslash, controls
and every non-ASCII UTF-16 code unit (lowercase `\uhhhh`, paired for valid
supplementary characters); retain other printable ASCII. Then apply XML entity
escaping as transport. Decode once and require exact canonical lexical
re-encoding; reject duplicate decoded names, invalid Unicode and wrong/unknown
mapping attributes/types. This reversibly carries NUL, U+FFFE/U+FFFF, CR/LF/TAB
and valid Unicode in both names and values without narrowing legal JSON.

Use expanded namespace names, not literal prefix spellings; bare mapping
attributes stay unqualified. Correct prefix renaming/default namespace must
preserve values. Reject unbound/wrong/reserved bindings, DTD/external entities
and malformed XML under the existing secure transport boundary. No character
replacement, key sanitization, normalization or XML numeric-reference workaround.

**CSV.** Extend the proposed new mapping, not CSV Bundle 1.0 in place:

- `blocks.csv` has `extension_mode:single|variants` for current extension rows,
  empty for other rows. Single pointer: `/extensions/<escaped-id>/block`;
  variants pointer: `/extensions/<escaped-id>/blocks/<ordinal>/block`.
  Variant is the exact JSON string or null; canonical ordinal exists only for
  variants mode. Require pointer/mode/ordinal/annotation agreement. Escape id
  pointer segments under the existing JSON Pointer rules.
- History retains ordered history ordinals and its existing null non-selection
  descriptor; exact authored historical label stays in annotation rows.
- Add `block-extra` typed-value scope for every block collection. Its root is
  the object's own members except annotation/content/prose, including an empty
  root object. Reconstruct and reject reserved-member overlap before attaching
  the separately reconstructed standard block members. Preserve `_meta` exactly
  once, full prose and nested unknown values under their existing scopes.
- Add `empty_collections_json` in `document.csv`: a canonical JSON array of closed
  `{path,kind}` records for empty builtin variant slots (object) or explicit
  history slots (array). Sort exact pointer paths by UTF-16 units; reject duplicate,
  aliased, wrong-kind/location and overlapping nonempty descriptors. Carrier
  capacity never widens schema admission: an empty builtin variant entry still
  fails current minProperties; empty outer collections/history arrays remain legal.

Retain exact typed-row reconstruction, no duplicate/aliased decoded paths or
conflicting node types, strict UTF-8 and received complete-subject verification.
For actual ZIP, check paths, duplicate names, symlinks, encryption, size/ratio,
CRC and complete manifest inventory under the supported transport policy.
Inventory hashes cover **actual payload bytes before text decoding**, including
BOM bytes; a decoder must not strip bytes before checking the inventory. Existing
allowed compression methods and transport limits are not narrowed to the lab's
STORE-only prototype. The implementation must test actual ZIP, not just CSV
directories, and record resource-limit refusal boundaries.

#### D4a — Frozen executable carrier grammar

The isolated candidate uses the proposed Envelope `2.0`, XML/CSV representation
`2.0.0`, XML namespace `https://uwmd.org/ns/document/2`, and
`uw-envelope-semantic` canonicalization version `2.0`. These identify the actual
supported **candidate** producer/verifier on its unmerged branch; they do not
activate production support or allocate an npm/release version. Acceptance and
production integration must use the reviewed coordinated identities and rerun
the complete matrix; silently relabelling old-regime results is not evidence.

**JSON lexical admission.** A carrier is one RFC8259 JSON value with only JSON
whitespace outside it. The Envelope root is an object. At every object depth,
decoded names are unique, including escaped aliases such as `a`/`\u0061`.
Apply this scanner to the raw JSON document, manifest and every embedded JSON
CSV cell, including `extra_json`, `empty_collections_json`, identity cells and
typed-value cells. Do not first erase occurrences through object construction.
Number tokens use the JSON number grammar and round to finite binary64;
overflow/nonfinite tokens and unpaired Unicode surrogates refuse. No case or
Unicode normalization. JCS determines semantic preimages and scalar reporting;
negative zero canonicalizes to0 under the existing JCS contract.

**Canonical ASCII string token S.** Surround the value with ASCII quotes.
Encode quote as `\"` and backslash as `\\`. Encode every UTF-16 code unit in
U+0000–001F, U+007F and U+0080–FFFF as exactly lowercase `\uhhhh`; all other
ASCII characters U+0020–007E remain literal. Thus LF is `\u000a`, TAB is
`\u0009`, CR is `\u000d`; the short JSON escapes `\n`, `\t`, `\r`, `\b`,
`\f` and `\/` are noncanonical here. Valid supplementary characters use two
paired surrogate escapes; isolated surrogates refuse. The empty name is `""`.
Decode one JSON token, validate Unicode, re-encode S and require exact equality.

**XML tree.** Exactly one expanded-name `{namespace}document` root has the
required unqualified `envelope-version` and `format-version` attributes, equal
to the contained model stamps, and exactly one `{namespace}value` child. Apart
from namespace declarations, these are the root's only attributes. The value
tree carries the **entire Envelope**, including unknown outer members:

| Element/type | Required attributes | Exact content |
|---|---|---|
| `value type="object"` | unqualified `type` only | Zero or more `member` children; decoded names unique. Writers sort by UTF-16 units; readers accept any distinct member order. |
| `member` | unqualified `name-json=S(name)` only | Exactly one `value` child. |
| `value type="array"` | unqualified `type` only | Zero or more `value` children in array order. |
| `value type="string"` | unqualified `type` only | One S token as decoded character text; no element children. |
| `value type="number"` | unqualified `type` only | The exact JCS scalar token of a finite binary64 number; no extra whitespace/children. |
| `value type="boolean"` | unqualified `type` only | Exactly `true` or `false`; no children. |
| `value type="null"` | unqualified `type` only | Empty content; no children or character data. |

All mapping elements have the selected expanded namespace. Object/array/member
containers permit only XML whitespace between their permitted children; other
text/mixed content refuses. Leaf tokens have no surrounding whitespace.
XML entity decoding happens **once** before S/scalar validation; apply ordinary
XML escaping on write, never a second entity/JSON pass. Namespace resolution is
scope-aware: consistent prefix renaming and the default namespace work;
unqualified mapping attributes remain unqualified even under a default
namespace. Reject unknown/qualified mapping attributes, unbound/wrong/reserved
bindings, duplicate expanded attributes, DTD/entities beyond the predefined
XML entities and legal numeric references, malformed nesting, extra roots and
trailing content. An optional initial XML1.0 UTF-8 declaration and surrounding
XML whitespace are allowed; other processing instructions/comments refuse.
No XML character reference can substitute for an S escape that the XML scalar
domain itself cannot carry. NUL/noncharacters remain ASCII lexical escapes.

**CSV tables.** Retain the current exact RFC4180 quoted-table dialect and table
headers, with precisely these additions: `extension_mode` is the final column
of `blocks.csv`; `empty_collections_json` is the final column of `document.csv`.
All rows have the declared header width; headers may not duplicate or alias.
`block_values.csv` keeps `block_ref,scope,pointer,json_type,value_json` and adds
`block-extra` to the admitted scopes. `prose.csv` is unchanged. Every embedded
JSON cell follows raw duplicate admission above. Typed rows include root and
all container/scalar nodes; declared parent/container types must agree, every
array index from0 through its last index exists, and no scalar has children.
Empty object/array roots remain explicit typed rows. JSON Pointer permits the
empty root and empty member names; only `~0`/`~1` escape sequences are legal.
Require exact canonical re-encoding of each decoded pointer segment; ordinal
segments are `0` or `[1-9][0-9]*`, never aliases such as `00`.

Reconstruct block refs exactly from descriptor collection/id/identity/ordinal;
reject duplicate decoded addresses, gaps, overlap, unknown scopes, unused rows
and conflicting types. Append/history ordinals are consecutive from0; extension
variant ordinals follow D1's exact null-first/UTF-16 order. A single entry has
no ordinal and its variant descriptor is its annotation identity. History's
variant descriptor remains null and selects no active peer. `block-extra`
must reconstruct an object disjoint from annotation/content/prose; full content
retains `_meta` exactly once through the existing meta scope. Missing versus
empty history slots use the closed sorted empty-collection descriptors, without
legalizing schema-invalid empty builtin variant maps. Unknown outer members
remain in the disjoint `extra_json` object. Semantic admission precedes comparing
the received complete digest; a valid carrier never rescues an invalid model.

Table row order is independent of semantic array order: readers reconstruct
from the explicit canonical ordinal fields, including when descriptor/value
rows arrive reversed. Unique JSON identity cells may use any admitted JSON
token spelling. The manifest additionally declares
`canonicalization_version:"2.0"`; it must agree with the selected regime.

The candidate resource profile admits JSON value nesting below128 and XML
inputs up to50 MiB; its ZIP defaults are50 MiB compressed,200 MiB expanded,
100 members and the current100:1 ratio plus1 MiB slack policy. Limits may be
configured within the transport API. Test and report boundary refusals;
resource exhaustion is not a restriction of the abstract JSON value domain.
Direct model APIs must refuse non-JSON values rather than silently drop
undefined members, array holes, functions, accessors or cyclic references.

**ZIP processing sequence.** Inspect central directory and local records and
their agreement, then bounded STORE/DEFLATE extraction with actual-output-size
and CRC checks. Validate manifest counts and hashes over original uncompressed
bytes before UTF-8/BOM handling of each inventoried payload. Then decode text,
apply the raw JSON/CSV grammar, reconstruct, admit the complete model and verify
its semantic digest. Test malformed sizes/descriptors/overlaps, local/central
names/flags/method/CRC disagreement, invalid CRC even when both headers agree,
BOM old versus correct inventory, invalid UTF-8 and all existing path/duplicate/
symlink/encryption/count/size/ratio restrictions. Resource tests pin refusal
boundaries without running a decompression bomb. No filesystem extraction.

### D5 — Whole-model commitment and authentication boundaries

Keep JCS/UTF-8/SHA-256. Hash the complete supported new Envelope minus only
`generated_at`, `generator`, `semantic_digest`. The container stamp participates,
even with no extensions. Use a newly identified `uw-envelope-semantic`
canonicalization regime; exact coordinated wire labels are assigned with the
accepted contract, independent of npm versions. No second hash fallback.

V.13 MUST freshly account for the supplied source under its existing guard:
repeated extension ids, superseded extensions, duplicate active selection,
unsafe/ambiguous source and missing physical accounting still refuse INT-15.
Ordinary lossless storage of peers/history does not expand authentication
admission. Eligible singleton sources project through D1 after that guard.
Direct models do not acquire attributable Markdown source or a new signing
capability from a valid digest. Document-signature malformed/encoding refusal
precedes unsupported-subject INT-14; guarded source refusal precedes subject
comparison/crypto; same-regime subject mismatch remains INT-11.

Receipts retain **their own** ordinary source projection and accepted issuance
rules, not V.13's additional source bans. Source/ref-input/rule-set preflights
remain, including RCP-13. Preserve Receipt 5.5: source digest disagreement with
also differing canonicalization version is RCP-10; differing version metadata
alone does not refuse equal digests. Authenticate a signed receipt before any
financial recomputation/refusal. RFC 0123 then recomputes applicable dictionary
claims without requiring a pack; unknown pack/output coverage can still make the
whole receipt unverifiable. Do not mask decisive dictionary disagreements with
pack absence. Results digests and engine-identity rules stay separate.

Unchanged V.9 block hash, six-field V.11 signature and V.12 selected payment-vector
subjects remain unchanged when their inputs do. Whole-source plans/caches,
package/batch/lake/workbook and HTTP/MCP consumers must use the supported complete
identity deliberately. A stale plan must refuse until explicitly reviewed and
rebound, not automatically receive a refreshed digest or a successful verdict.
A signature or financial result never transfers authentication to a different
subject. This RFC does not certify historical completeness or financial truth.

### D6 — Governed activation; no historical support

The executable sequence is: **(1)** freeze this contract and independent expected
values/preimages; **(2)** implement an isolated candidate on a separate branch,
not merged, and run the full preacceptance gate matrix below; **(3)** close the
independent findings and request final owner acceptance only after those gates
pass; **(4)** after acceptance, integrate production and rerun the same matrix
plus required CI before declaring support/activation. Candidate implementation
is explicitly authorized to produce the required preacceptance evidence. It is
not production integration or acceptance by another name.

After acceptance synchronize Format mixed-identity wording, Protocol portable projection, public
types, Envelope/schema, XML/CSV/ZIP mappings/descriptors and current signing/
receipt subject support in one coherent implementation after acceptance. Keep
independent surface versions and explicit unsupported-input refusal. HTTP
encoding negotiation is not permission to accept an unknown Envelope regime.
No compatibility decoder, migration/reissuance/retention work, prelaunch artifact
repair or version-bump recommendation. Packages remain 4.x; a 5.0.0 launch needs
separate explicit approval. Modules/financial definitions are unchanged.

## Decisions and evidence gates

| Decision | Recommendation | Authority / acceptance evidence |
|---|---|---|
| D1/D2 tagged exact identities | Retain accepted single/variants and null != default | Direction selected 2026-10-17; current peer loss reproduced; exact source/order/history fixtures required |
| D3 minimum/full subject | Tagged portable minimum; full authored Envelope for commitments | Selected direction; independently frozen absent/null/notes/prose controls required |
| D4 total mapping | ASCII lexical XML; CSV block-extra + empty carrier; strict raw duplicate admission | Selected direction; complete lawful-domain independent codecs and actual ZIP refusals required |
| D5 commitments | New complete subject, unchanged V.13 admission and current receipt precedence | Selected direction plus accepted RFCs 0088/0111/0123/0124; real signing/receipt state-machine controls required |
| D6 activation | Synchronized supported contracts only | Owner prelaunch rule; no version/release allocation here |
| CoS red-team | Required before final owner acceptance | Owner fifth set; independent review must resolve findings against this exact revision |

Prior experiments independently exercised bounded Python/Node codecs, portable
minimums, namespace and duplicate-name controls, raw Ed25519 byte binding and
STORE ZIP. They are research, not current production contracts or proof of the
complete domain. The production current-main probes reproduce the remaining
gap, not an implementation of the proposal. Research/evidence lives in private
maintainer records; this PR adds no experiment workflow or review paperwork.

Before final acceptance/activation, require a reviewed matrix covering every
builtin/append/extension/history collection, complete block extras/unknown outer
members, absent/null/empty values, finite binary64 serialization, valid Unicode,
source order/revision disagreement, physical accounting and exact refusal layer.
Independent implementations must agree on frozen values/preimages and actual
JSON/XML/CSV/ZIP controls across Windows and CI Linux. Real new-subject signature
and receipt checks must exercise malformed/unsupported/source/digest/backend/
rule-set/pack/disagreement precedence, including pack-less dictionary checks.
Do not infer those results from schema success, raw crypto or previous-head CI.

### Gate matrix — acceptance and activation are separate

| Gate | Required before final acceptance | Required after acceptance, before activation |
|---|---|---|
| D1/D2 complete accounting | Independently frozen exact models/preimages for all collections; both null/default source orders, source/revision disagreement, equal physical occurrences, mixed explicit/implicit history, history-only/role-in-history, one-peer mode and Markdown refusal. Every physical block accounted once. | Production parser/API/schema and portable projection pass the same cases. |
| D3 complete subject | Single-mutation notes/prose/annotation/block-extra/outer-extra and absent/null/empty controls; minimum/view/stamp substitution refused at its actual boundary. | Every producer/consumer deliberately selects the supported complete identity. |
| D4 lawful-domain codecs | Frozen D4a grammar; independent Windows/Linux JSON/XML/CSV implementations agree on exact expected values/preimages, including Unicode/finite-binary64/empty-name boundaries and all raw duplicate cells. | Synchronized specs, schemas, APIs/descriptors and independent Python implementation pass the same frozen corpus. |
| D4 actual ZIP | Actual STORE and DEFLATE positives; original-byte BOM/inventory, CRC, header agreement, malformed structure, aliases/gaps and security/resource refusals independently of semantic digest checks. | Real CLI/bindings/archive integration repeats those controls; directory-only tests do not count. |
| D5 signatures/receipts | Supported new-subject creation/signing/verification using real crypto and exact malformed/unsupported/source/digest/backend/ref-input/rule-set precedence, equal-digest/different-version and decisive pack-less dictionary checks. | Supported labels and production state machines match and pass the same single-mutation cases. |
| Subject consumers | Complete inventory; once-bound candidate plans fail after an omitted-peer/whole-source mutation, including a freshly stamped changed Envelope. No automatic rebinding; distinguish results/block/selected-vector commitments. | Coordinated adoption and explicit reviewed rebinding; no blanket expectation refresh. |
| Independent review/accepted resolution | Findings closed or explicitly ruled on, truthful exact-head/platform/authorship evidence, and final owner acceptance only after all gates pass. | Production integration/conformance/required CI and capability claims match the accepted contract; launch separately authorized. |

## Conformance impact

No current fixture or capability changes in this draft. Implementation adds
independent expected models/preimages plus positive/negative representation and
portable-source cases for D1–D5. Existing unsafe/malformed/source guards remain.
Use single-mutation controls so a shape failure does not mask an intended digest
or signature check. Include direct one-peer mode/Markdown refusal, null/default
in both source orders, last-current versus revision order, explicit and implicit
prior blocks, extension history without current, role-in-history nonactivation,
UTF-16 versus code-point ordering, missing/extra/aliased CSV rows and raw-byte
ZIP inventory controls. Inventory affected current source-digest consumers
before precise governed expectation changes; no blanket rebaseline.

## Reference implementation

Before acceptance build the isolated candidate and run the matrix above;
candidate-only tests/workflows do not activate the current standard. Preserve
failed gates and distinguish Windows-only, shared-projector and raw-crypto
observations from the independent full-domain/new-subject results required.
After acceptance update parser/types, Envelope and schema, portable subset,
source accounting, generic codecs and their mappings, document signatures,
receipts/rule-set identity and source-digest consumers in verify; core/starter
adapters and independent Python follow the same contracts. Add no vendor SDK or
financial engine dependency. Keep annotation/payload identity and metadata
admission separate from representation reconstruction.

## Alternatives considered

Variant-key maps collide null/default and payload-shaped labels. Selecting one
peer, aggregating payloads or moving active peers to history loses meaning.
Partial XML would narrow the full-fidelity promise; the maintainers selected a total
lexical carrier. Base64 is reversible but is not the selected lexical contract.
A portable parse minimum or raw signature success cannot stand in for complete
source/model admission. Historical dual-regime support is not required.

## Unresolved questions

No remaining product-choice menu: D1–D6 records the accepted design and exact
coordination. Owner acceptance followed independent candidate finding closure.
Production review, synchronized integration and the postacceptance engineering
gates remain required before declaring support. Findings that expose a new
contract choice return to the owner; they are not silent codec discretion.

## Prior art

RFCs 0014/0040/0066 establish Envelope, generic roles and selection. RFCs
0084/0090 distinguish source authentication from validation inventories. RFCs
0088/0111/0123/0124 govern current receipt/rule-set precedence. Existing nullable
payment/variant identities show why exact authored identity differs from a
default lookup key. JCS, JSON Pointer and expanded XML namespace names retain
their existing standard meanings.
