---
rfc: 0089
title: Preserve extension variants in a versioned Envelope
status: draft
author: Codex
created: 2026-10-16
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0089: Preserve extension variants in a versioned Envelope

## Summary

Propose a minimal, versioned extension-entry representation that can preserve
legal Format §2.8 peers without changing unrelated Envelope collections. This
RFC is **draft, documentation only, and not accepted**. Its concrete tagged
candidate, mixed-identity rule, commitment regime and release placement all
require owner approval before implementation. Envelope 1.0, normative schemas,
source digests, receipts, signatures, frozen expectations and public versions
remain unchanged by this PR. UWMD 5.0 remains reserved for public launch.

The owner's [public-launch compatibility policy](../../VERSIONS.md#public-launch-compatibility-policy-owner-decision-2026-10-16)
makes UWMD 5.0 the first public compatibility baseline. Earlier versions, including
published 4.x, are historical; this proposal does not require legacy readers,
codecs, receipt regimes or shims solely to support them. That policy approves
neither this representation design nor its implementation, RFC acceptance,
version allocation or a 5.0 tag/publication. Independent versioning and coordinated
normative/spec/schema/conformance review still apply.

## Motivation

[Issue #365](https://github.com/UWMD-OSP/UW-Markdown/issues/365) records a joint
contract gap. Format §2.8/RFC0040 collect all active named variants of a
role-opted section, including `x_` extensions. RFC0066 confirms that generic
routing. Format §4.21 places extensions in `parsed.extensions`. But RFC0014's
Envelope 1.0 type and schema permit only a single block at `extensions[id]`,
while `sections[id]` already permits variant maps. Selecting an arbitrary peer,
aggregating payloads or filtering the document loses admitted content and
changes its complete semantic commitment.

The requested [read-only intake in the existing Reader review](https://github.com/UWMD-OSP/UW-Markdown/blob/f93fd3216cea0f67f6c76d573d9fea0db801d309/docs/reviews/2026-10-15-python-reader-354.md#2026-10-16--issue-365-joint-representation-rfc-intake)
contains the pinned source/type/schema/mapping/consumer evidence and alternatives.
It is evidence of a joint representation problem, not a Python-specific bug or
authority to invent an implementation-only shape. Its baseline `64b9b109` and
current integration base `fbbd1a77` have identical normative contracts. Existing
Python verification conservatively reports an unavailable whole-Envelope digest
rather than discarding lawful peers. Its separate V.12 cash-vector commitment
can already operate without an Envelope projection.

## Proposed change

All MUST/SHOULD language below describes the **candidate after acceptance**;
none is an obligation adopted by this draft. `E_NEXT`, `C_NEXT` and codec labels
are design placeholders, not literal wire values or approved version numbers.

### D1 — Minimal tagged extension entries

Retain the Envelope namespaces, builtin section collection shapes, append-only
arrays and `superseded` arrays. In a new Envelope version, replace only the
extension entry type:

```ts
// Existing Envelope 1.0, unchanged today:
// extensions: Record<string, UWEnvelopeBlock>;

// Proposed E_NEXT only:
type UWExtensionEntry =
  | { mode: 'single'; block: UWEnvelopeBlock }
  | { mode: 'variants'; blocks: UWExtensionVariant[] };
interface UWExtensionVariant {
  variant: string | null;
  block: UWEnvelopeBlock;
}
// extensions: Record<string, UWExtensionEntry>;
```

Both wrapper alternatives and each variant record are closed objects. An entry's
map key, `block.annotation.section` and `block.content._meta.section` must agree.
Each annotation variant, when present, is a string; null is represented only by
an absent annotation member, never a null-valued annotation. A `single`
entry contains exactly one existing complete Envelope block. A `variants` entry
contains a nonempty array with exactly one current block per exact nullable
identity. The record's `variant` MUST equal the block's authored annotation
variant; it is null if and only if that annotation member is absent. An authored
null annotation is not a string variant. Do not inject the record identity into
content or normalize it into an annotation.

This uses a tag rather than guessing from `annotation`/`content` keys. No legal
variant string is a wrapper discriminator, reserved sentinel or object key in
the new variant container. `default`, `annotation`, `content`, `/`, `~`, empty
labels where admitted, and supplementary Unicode retain their exact meaning.
Existing source-admission unsafe-key restrictions remain; this RFC adds no
variant-name ban and does not weaken a security guard.

### D2 — Source routing and exact identity

Apply Format2.7 current-revision routing before building the entry, separately
for each applicable exact identity; it is not a fallback across distinct peers.
Preserve existing role-free singleton routing and superseded-role nonactivation.
When active roles and explicit variant fences opt an extension into Format2.8,
collect peers before selection, including peers without a role. The entry stores
the collection, never a financial-role selection result. The projector MUST use
`mode: variants` if and only if the agreed active-role plus explicit-variant
opt-in holds, including a collection containing only one current peer; otherwise
it MUST use `mode: single`. This fixes the source-to-model canonical subject.

Directly authored model inputs have explicit semantic mode intent, as generic
model variant collections need not derive from Markdown role opt-in. A decoder
MUST preserve that declared mode, including one-peer variants mode without a
role; it validates the wrapper/identity rules rather than silently collapsing
it to a singleton. JSON/XML/CSV conversion preserves that model intent.
Model-to-Markdown conversion MUST refuse when reprojecting the proposed source
cannot preserve the exact mode, identities and complete block values. It MUST
NOT invent a role, change an annotation or discard a peer to make conversion
succeed. Thus a direct model and a Markdown-projected model may intentionally
have distinct semantic subjects, but the same source has one canonical mode.

**Proposed clarification requiring owner approval:** in that opted-in extension,
an unlabelled current peer is a distinct null identity, including alongside a
peer explicitly named `default`. Preserve both; do not collapse them through an
absent-to-`default` lookup key. The accepted wording explicitly promises named
peers and does not settle every mixed unlabelled/named case. This paragraph
chooses a candidate for review, not a retrospective claim that every such source
was already parallel. It requires corresponding Format wording and version
assessment if accepted. It does not change ordinary builtin section containers
or retrospectively reinterpret their stored maps.

A source that does not meet role opt-in retains the existing singleton behavior;
this proposal does not turn every repeated extension fence into a parallel peer.
Every current canonical block admitted by that routing appears once in its
entry. Explicit superseded extension blocks remain in `superseded[id]` in source
order, with complete block values, without promoting them to active peers.

The `variants.blocks` array MUST be in canonical identity order: null first,
then strings compared lexicographically by UTF-16 code units, without Unicode
normalization. A decoder rejects duplicate identities or noncanonical order;
it MUST NOT silently sort or deduplicate a received stamped model. A source
projector orders the newly constructed array this way before stamping it.
Active peer source order is not a new semantic property. History arrays and
other ordered arrays retain their existing semantic order.

These examples pin the candidate boundary; they do not amend current routing:

| Source/model condition | Candidate result |
|---|---|
| One unlabelled current block, with or without a role | `single`; no explicit variant fence activates the opt-in. |
| One current block explicitly named `default`, role absent | `single`; the authored annotation remains `default`. |
| That one named current block with a role | `variants`, one record with identity `"default"`; no singleton collapse. |
| Named peers `base` (primary) and `detail` (no role), in either source order | `variants`, both exact records; collect before any property-level selection. |
| An unlabelled primary peer and named `default` peer | Under the proposed clarification only, `variants` with null first then `"default"`; current-contract admission remains an owner question. |
| Role on superseded history only; current peer has no role | No opt-in from history; current singleton routing and ordered history remain distinct. |
| Directly authored one-peer `variants` model with no role | Preserve its mode through model codecs; refuse Markdown conversion if source reprojection would be `single`. |

Repeated current revisions of the same declared identity follow the accepted
ordinary current-revision rule, not the new array order. The owner must approve
the exact nullable identity grouping for mixed opt-in sources; this draft does
not infer it from the existing `default` map key. V.13's stricter collision
refusal remains a separate admission step. Equal payload values in distinct
identities are legal peers, never a reason to deduplicate them.

### D2a — Physical source, public parsed APIs and portable projection

The candidate Envelope does not by itself repair every Reader surface. The
current independent Python scanner retains physical blocks while its ordinary
parse projection uses absent-to-`default` variant keys; the reference TypeScript
`ParsedUWFile.extensions` public type is also a singleton map. The new concrete
mixed-source example observes that physical retention can coexist with a
colliding projected key. Because mixed admission remains unaccepted, this is
not a retrospective declaration of an independently settled Reader defect.

If D2 admits an unlabelled peer beside literal `default`, carry that exact
identity through each affected surface:

| Surface | Required accounting before implementation |
|---|---|
| Format §2.8/source routing | Decide mixed nullable admission/current-revision grouping explicitly; no label inference or reserved `default` sentinel. |
| Reference public parsed APIs | Reconcile extension collection types and adapters without coercing null into a string key. Breaking public type changes need independent package accounting. |
| Protocol §II.6a.6 portable parse projection | Specify how both identities are surfaced and freeze approved projections. This is a normative **subset/minimum** projection, not a requirement that every implementation adopt `ParsedUWFile` internally. An Envelope version alone does not specify its nullable identity encoding. |
| Envelope/codecs/whole-source consumers | Apply the approved container and commitment regime after lossless routing, with exactly the admitted blocks retained. Do not derive it from an already overwritten projection. |

A future implementation may use any internal representation that satisfies the
contracts. The RFC must coordinate the portable/public projection decisions,
Format/Protocol version assessment and new fixture expectations; it must not
silently revise the existing baseline or claim full Reader conformance from an
experimental Envelope round-trip. The isolated source example below reads
retained physical source rather than changing any current parsed API or wire.

### D3 — Payload and model fidelity

Preserve complete annotations, complete fenced payloads (with `_meta` exactly
once), `_role`, ordinary members named `content`, `_notes`, `_overrides`, exact
per-block prose, scalar types, absent/null distinctions and unknown top-level
Envelope members. Preserve schema-admitted unknown members of each Envelope
**block**, not only its annotation, payload or outer document. The closed tagged
wrapper does not close the block it contains. No metadata defaults or financial facts are added. The role
annotation belongs to content and keeps its existing integrity meaning.

Do not put extension peers into `sections`, turn them into a financial aggregate,
move active peers into history, or advertise an analytical view as lossless.
The new shared type/schema and all model-fidelity codecs must agree. There is
no live implementation or schema allowance in this draft.

### D4 — JSON, XML and CSV

| Representation | Proposed consequence |
|---|---|
| JSON | Serialize the new Envelope directly; validate the tagged union, identity agreement, uniqueness and canonical ordering before trusting a stamped digest. Unknown top-level, block, annotation and content members remain preserved. |
| XML | Carry the same typed object/array tree and null identity. Update the mapping's Envelope admission/version relationship and semantic checks. The generic typed XML mechanism can carry it, but existing Envelope1 validation cannot be bypassed. A namespace or XML codec version change is assessed independently. |
| CSV bundle | Update extension enumeration/reconstruction, not only the shared schema. Block pointers become `/extensions/<escaped-id>/block` for single mode and `/extensions/<escaped-id>/blocks/<ordinal>/block` for variants. `variant` on a current extension row is its exact JSON string or null and `ordinal` is the canonical variants-array index; a singleton has no ordinal. Historical rows retain their existing null non-selection descriptor and ordered history ordinal; the exact authored label remains in annotation rows. RFC6901 escaping applies to the section-id pointer segment. |

CSV must carry mode explicitly, including when variants mode has only one
current peer. Candidate mapping: a new `extension_mode` column in `blocks.csv`
is `single` or `variants` on extension rows and empty otherwise. It is encoding
metadata, not a payload member. Reconstruction requires agreement among mode,
variant, ordinal, pointer and annotation; duplicate/gapped ordinals or conflicting
mode rows refuse. All current/history blocks appear exactly once, including
prose and split `content._meta` rows. New descriptor/bundle versions, inventory
hashes and reconstructed semantic-digest checks are coordinated. This is a
breaking CSV mapping proposal, not an extension to CSV Bundle1.0 today.

HTTP Accept currently chooses encoding/fidelity, not an Envelope version; media
parameter stripping is not version negotiation. The candidate uses one supported
new regime with accurate independently versioned descriptors and explicit
unsupported-version refusal. No new capability or profile is needed merely to
make ordinary model fidelity complete. Pre-5.0 backward negotiation, dual Envelope
admission and legacy codec support are not implementation requirements. Accurate
current-regime descriptors and clear unsupported-regime refusal suffice; this
RFC adds no compatibility capability/binding layer. MCP conversion still decodes once
through the shared model rather than selecting a peer per consumer.

#### Complete candidate codec examples (unaccepted)

The [isolated candidate lab](https://github.com/UWMD-OSP/UW-Markdown/blob/f93fd3216cea0f67f6c76d573d9fea0db801d309/experiments/envelope-0089/README.md#complete-candidate-codec-artifacts-and-explicit-reissuance-examples)
provides executable JSON/XML/normalized-CSV encode/decode and a
[frozen artifact matrix](https://github.com/UWMD-OSP/UW-Markdown/blob/f93fd3216cea0f67f6c76d573d9fea0db801d309/experiments/envelope-0089/codec-examples/matrix.json): five complete examples,60 files. These
are candidate codecs and precise illustrative payloads, not approved production
bindings or merely a low-level hash demonstration. Each directory contains full
frontmatter, complete blocks/annotations/prose, exact canonical subject bytes,
received digest and all six normalized CSV directory files. Numeric values retain
the existing finite binary64/JCS semantic domain, not arbitrary host integers
or raw number spelling. The existing
Envelope1/codecs/schema and all conformance expectations remain unchanged.

| Case | Complete JSON | Complete XML | CSV manifest/directory | Original source / proposed new-issuance plan |
|---|---|---|---|---|
| Single | [JSON](https://github.com/UWMD-OSP/UW-Markdown/blob/f93fd3216cea0f67f6c76d573d9fea0db801d309/experiments/envelope-0089/codec-examples/single/document.uw.json) | [XML](https://github.com/UWMD-OSP/UW-Markdown/blob/f93fd3216cea0f67f6c76d573d9fea0db801d309/experiments/envelope-0089/codec-examples/single/document.uw.xml) | [manifest](https://github.com/UWMD-OSP/UW-Markdown/blob/f93fd3216cea0f67f6c76d573d9fea0db801d309/experiments/envelope-0089/codec-examples/single/csv/manifest.json) | [source](https://github.com/UWMD-OSP/UW-Markdown/blob/f93fd3216cea0f67f6c76d573d9fea0db801d309/experiments/envelope-0089/codec-examples/single/original.uwx.md), [plan](https://github.com/UWMD-OSP/UW-Markdown/blob/f93fd3216cea0f67f6c76d573d9fea0db801d309/experiments/envelope-0089/codec-examples/single/reissuance-plan.json) |
| One-peer variants | [JSON](https://github.com/UWMD-OSP/UW-Markdown/blob/f93fd3216cea0f67f6c76d573d9fea0db801d309/experiments/envelope-0089/codec-examples/one-peer/document.uw.json) | [XML](https://github.com/UWMD-OSP/UW-Markdown/blob/f93fd3216cea0f67f6c76d573d9fea0db801d309/experiments/envelope-0089/codec-examples/one-peer/document.uw.xml) | [manifest](https://github.com/UWMD-OSP/UW-Markdown/blob/f93fd3216cea0f67f6c76d573d9fea0db801d309/experiments/envelope-0089/codec-examples/one-peer/csv/manifest.json) | [source](https://github.com/UWMD-OSP/UW-Markdown/blob/f93fd3216cea0f67f6c76d573d9fea0db801d309/experiments/envelope-0089/codec-examples/one-peer/original.uwx.md), [plan](https://github.com/UWMD-OSP/UW-Markdown/blob/f93fd3216cea0f67f6c76d573d9fea0db801d309/experiments/envelope-0089/codec-examples/one-peer/reissuance-plan.json) |
| Mixed null/default | [JSON](https://github.com/UWMD-OSP/UW-Markdown/blob/f93fd3216cea0f67f6c76d573d9fea0db801d309/experiments/envelope-0089/codec-examples/mixed-null-default/document.uw.json) | [XML](https://github.com/UWMD-OSP/UW-Markdown/blob/f93fd3216cea0f67f6c76d573d9fea0db801d309/experiments/envelope-0089/codec-examples/mixed-null-default/document.uw.xml) | [manifest](https://github.com/UWMD-OSP/UW-Markdown/blob/f93fd3216cea0f67f6c76d573d9fea0db801d309/experiments/envelope-0089/codec-examples/mixed-null-default/csv/manifest.json) | [source](https://github.com/UWMD-OSP/UW-Markdown/blob/f93fd3216cea0f67f6c76d573d9fea0db801d309/experiments/envelope-0089/codec-examples/mixed-null-default/original.uwx.md), [plan](https://github.com/UWMD-OSP/UW-Markdown/blob/f93fd3216cea0f67f6c76d573d9fea0db801d309/experiments/envelope-0089/codec-examples/mixed-null-default/reissuance-plan.json) |
| Ordered history | [JSON](https://github.com/UWMD-OSP/UW-Markdown/blob/f93fd3216cea0f67f6c76d573d9fea0db801d309/experiments/envelope-0089/codec-examples/ordered-history/document.uw.json) | [XML](https://github.com/UWMD-OSP/UW-Markdown/blob/f93fd3216cea0f67f6c76d573d9fea0db801d309/experiments/envelope-0089/codec-examples/ordered-history/document.uw.xml) | [manifest](https://github.com/UWMD-OSP/UW-Markdown/blob/f93fd3216cea0f67f6c76d573d9fea0db801d309/experiments/envelope-0089/codec-examples/ordered-history/csv/manifest.json) | [source](https://github.com/UWMD-OSP/UW-Markdown/blob/f93fd3216cea0f67f6c76d573d9fea0db801d309/experiments/envelope-0089/codec-examples/ordered-history/original.uwx.md), [plan](https://github.com/UWMD-OSP/UW-Markdown/blob/f93fd3216cea0f67f6c76d573d9fea0db801d309/experiments/envelope-0089/codec-examples/ordered-history/reissuance-plan.json) |
| Direct model / unknown members | [JSON](https://github.com/UWMD-OSP/UW-Markdown/blob/f93fd3216cea0f67f6c76d573d9fea0db801d309/experiments/envelope-0089/codec-examples/direct-model-unknown/document.uw.json) | [XML](https://github.com/UWMD-OSP/UW-Markdown/blob/f93fd3216cea0f67f6c76d573d9fea0db801d309/experiments/envelope-0089/codec-examples/direct-model-unknown/document.uw.xml) | [manifest](https://github.com/UWMD-OSP/UW-Markdown/blob/f93fd3216cea0f67f6c76d573d9fea0db801d309/experiments/envelope-0089/codec-examples/direct-model-unknown/csv/manifest.json) | [model origin/refusal](https://github.com/UWMD-OSP/UW-Markdown/blob/f93fd3216cea0f67f6c76d573d9fea0db801d309/experiments/envelope-0089/codec-examples/direct-model-unknown/origin.json) |

Null and literal `default` are distinct identities; one-peer variants keeps its
mode, ordered history keeps its complete blocks, and all three codecs decode
to the same complete frozen model. Cases retain nested unknown metadata and
payload, an ordinary `content` member, null/absence, empty containers, CR/LF/tab,
quotes, `<&>`, supplementary/BMP Unicode and escaped JSON Pointer keys. The direct
model also retains unknown top-level/annotation members; Markdown emission
refuses where this prototype lacks a carrier rather than fabricating one.

The executable rules are precise for this lab: validate the candidate tag and
identity/order/accounting first; verify the received semantic digest after
reconstruction; never sort/deduplicate a received array to make it verify. XML
uses the typed tree with escaped member names and CR references. CSV uses the
new mode column, exact nullable variant, canonical ordinals/pointers, explicit
container rows, split annotation/meta/content, exact prose, inventory hashes and
reconstructed digest. The lab namespace and E_NEXT/C_NEXT/B_NEXT tokens are
unassigned experimental values, not a namespace/version allocation.
The lab manifest explicitly names a proposed canonicalization-version field
beside the bundle/container labels; that is candidate encoding metadata requiring
bundle/version approval, not a field silently added to CSV Bundle1 today.
Historical CSV descriptors retain a null non-selection placeholder and ordered
history ordinal; exact authored historical variant remains in annotation rows.
Current-extension descriptor/annotation equality does not reinterpret that
history placeholder as source identity.

Twenty focused Python methods exercise actual round-trip, source accounting,
duplicate/type/order/version/pointer/manifest/digest refusal and explicit new-issuance
boundaries. Their frozen migration-labelled examples are historical design evidence,
not a runtime migration requirement. Two independent Node tests reconstruct all
five JCS subjects from frozen JSON and check all59 case artifact hashes. This is independent subject
verification, not a second independently implemented XML/CSV codec.

The test-only validator covers extension-only models and empty builtin collections;
unimplemented collection/block-extra/source domains refuse explicitly. These
are **prototype limits, not proposed normative bans**. A complete accepted
implementation must retain every legal member within its advertised mapping or
refuse explicitly; it must never discard a value and label the result lossless.
No ZIP transport, general candidate schema, discovery, financial verification,
receipt or signature engine is activated by these examples.

**XML representability needs an explicit design boundary.** Legal JSON strings
and member names can contain NUL, which XML1 cannot directly encode. The lab
retains those values through JSON/CSV and demonstrates an XML refusal, without
contracting the legal JSON domain. An owner option is a separately versioned
escaped JSON-string lexical form for both string values and member names, with
an explicit encoding marker (and a member-name lexical field). Decoding must
restore exact strings before JCS/digest comparison. Current XML1 secure decoders
would reject new marker attributes; codec/namespace/version rules and positive/
negative escaping fixtures must be governed. No option is accepted here, and
sanitizing/dropping characters or silently changing the subject is excluded.

### D5 — Canonicalization, commitments and authentication

Keep RFC8785, UTF-8 and SHA256 unchanged. Remove only the existing top-level
volatile members `generated_at`, `generator` and `semantic_digest` for complete
Envelope hashing. Because `envelope_version` is included, assigning E_NEXT
changes **every structured source digest**, even a document with no extensions.
Container/codec versioning and the semantic canonicalization regime are distinct.
The candidate assigns a new governed `uw-envelope-semantic` regime C_NEXT rather
than silently replacing 1.0 bytes. Exact version labels are unassigned.

| Consumer/commitment | Compatibility consequence |
|---|---|
| JSON/XML/CSV semantic digests | Recompute only for a newly issued artifact under the accepted new regime; verify the received stamp under its declared supported regime. Never overwrite a historical stamp in place. |
| Receipts | Coordinate `canonicalization_version` and source-subject generation; preserve existing RCP-10 canonicalization-mismatch versus RCP-07 engine-mismatch precedence. RCP-10 needs both a differing version and a disagreeing digest; a version difference alone is not an issue. No same-regime subject mismatch is excused by trying another hash. Financial `results_digest` remains a separate commitment and need not change for container-only changes. |
| Document signatures V.13 | New source subject/version constants and schema accounting would be required. Preserve existing duplicate singleton, unsafe-source, repeated-extension-id and superseded-extension admission guards. Ordinary lossless conversion does not make those sources authenticatable. Expanding the authenticated source domain is outside this RFC. Unsupported subject versions stay unverifiable/INT-14; same-regime subject mismatch stays failed/INT-11. |
| V.9 block hashes / V.11 block signatures | Unchanged inputs when payloads and six signing fields are unchanged. They do not authenticate peer assembly and cannot replace document authentication. |
| V.12 replacement payment | Unchanged fixed selected ordered vector/currency/variant/index commitment; no Envelope version enters it. |
| VIII.9–12 projection, assembly, reserves and draw plans | Audit each complete source-digest consumer. Existing digest-only plans may become stale; require an explicit reviewed new plan/rebind, never an automatic digest refresh or a new successful result-state interpretation. Retain finite evidence/refusal precedence. |
| Package, batch, lake, workbook and HTTP consumers | Update semantic primary/cache identities, paths and stale checks deliberately. Raw-file hashes are distinct. Do not rewrite stored historical keys or authentication subjects as if their new identity had always existed. |

V.13 currently also spells the exact Envelope1 projection. A new signature regime
must specify its guarded singleton-extension projection under D1 and retain the
current source-domain refusal rules; the legacy singleton block shape cannot be
silently hashed alongside E_NEXT. Schema support for a new subject version is a
future accepted change, not authority for current verifiers to accept it.

Version/state controls must retain their accepted ordering, not merely their
code names. For receipts: an uncanonicalizable source is RCP-09 before comparison;
a differing source digest is RCP-01 unless the canonicalization version also
differs (RCP-10), before unknown pack/key and later engine/result checks. RCP-07
only applies to recomputation disagreement plus differing engine identity. For
document signatures: malformed artifact/encoding precedes version support;
unsupported version precedes source projection and digest comparison; same-regime
source/accounting guard failure is INT-15 before subject equality and crypto.
No caller may use a new stamp to turn a malformed artifact into merely unknown
version, or use a crypto-valid old subject to bypass the guarded source.
These current-regime refusal controls do not require implementing an archived
canonicalization or receipt regime. Compare under the approved current contract;
never retry a historical hash procedure to obtain an acceptable verdict.

## Compatibility analysis

The source Markdown of ordinary admitted named extension peers need not change.
D2's mixed-identity clarification is an explicit proposed semantic decision,
not an unnoticed erratum. Existing Envelope1 values, public extension-entry
Typescript types, JSON readers, CSV columns/pointers and consumers of semantic
identity break under the proposed new regime. Model-fidelity Reader/Verifier
implementations must update the relevant projection/codecs; unsupported versions
refuse. There are no former Editor/CalcHost/AgentHost tier obligations here:
current conformance is Reader and Verifier plus optional profiles.

Modules retain their existing declarations, metric definitions and validation
semantics. Generic extension completeness is not a third-party module feature
or a new financial profile. No default/model generator or StackUW workflow is
required to construct or verify the representation.

### Independent versioning and pre-5.0 clean break

| Surface | Required assessment before acceptance/release |
|---|---|
| Envelope | A new container version is required for D1; do not widen Envelope1 in place. |
| Format | Named-peer legality is already accepted. Assess D2's explicit mixed-identity clarification separately; if it changes admitted document meaning/routing, revise/version Format with Protocol accounting. A container stamp alone does not automatically bump Format. |
| Protocol | Projection/verification, the portable nullable identity projection if D2 is accepted, and commitment regime references must change coherently, with the appropriate Protocol version; package semver alone is insufficient. |
| Receipt/signature | Select the canonical subject regime and supported-version schema/constants explicitly; independent wire-artifact version changes depend on the chosen fields, not copied Envelope numbering. |
| Codec/bundle/package | Independently version breaking mapping/type changes and exact dependent package pins. Assess XML namespace separately from its model admission. |
| Release placement | Apply the owner's public-launch compatibility policy: 5.0 is the first public compatibility baseline; all earlier versions, including published4.x, are historical. An approved pre-5.0 contract change does not require backward support. Assess independent normative/package versions without treating 5.0 as permission to launch; its tag/publication requires separate owner approval. No version is selected in this draft. |

The owner has selected a pre-5.0 clean break; this is no longer a proposal to
maintain compatibility with earlier published packages. Implement only the
approved current regime, with clear refusal of unsupported containers/subjects.
Do not add an old-version reader, codec, receipt regime, dual-hash fallback,
grandfathering period or migration shim solely for pre-5.0 compatibility. An archived
old decoder may remain immutable research evidence without becoming a supported
runtime path. Existing archived bytes, subjects and expected results remain
historical evidence.

Only after this RFC's specific design and contract changes are approved may
complete attributable source support a newly issued artifact under the approved
regime. Review its complete retained content and new identity; separately issue
any new receipt, signature or binding plan under the applicable accepted rules.
This is fresh issuance, not a migration service, verification of the old
signature or a rewrite of its historical subject. Never turn an already lossy
old Envelope into supposedly recovered peers; use the original source or a
complete attributable archive. No automatic historical receipt, artifact or
fixture regeneration is authorized.

### New issuance prerequisites and historical evidence

The linked source/plan examples retain original raw SHA256 and exact physical
block accounting before proposing a new subject. They create **no** receipt,
signature or binding artifact, and no old-version reader/migration shim.

| Evidence available | Proposed action / genuine blocker |
|---|---|
| Complete attributable original structured source | After design/version approval, freshly parse using approved routing, account for all admitted current/history blocks and retained values, and issue a new representation under the selected container/subject regime. Archive original bytes/identity separately. |
| Original mixed null/default source | Requires the mixed-admission and portable/public projection decision first. Never issue from a projection that already overwrote a peer. |
| Demonstrably complete attributable archive | A reviewed reconstruction can support **new issuance** only if it accounts for every relevant identity, mode, annotation, payload, metadata, prose and history. The prototype does not implement/archive-certify this route. |
| Only a lossy Envelope1 snapshot, missing peer/history, incomplete archive, or old digest/receipt/signature without complete content | Complete **new issuance** is blocked until original source or a complete attributable archive is available. No supported legacy reader or migration path is required; no hash/version rewrite can recover absent facts. Never infer or select a peer to fill the gap. |
| Complete source outside retained V.13 repeated/superseded-extension guards | Ordinary candidate representation may be possible, but document authentication remains refused. Retaining old block signatures does not make a new assembly authenticatable. |
| Old receipt/signature/whole-source binding plan | Retain exact old artifacts as evidence. Separately authorize any new signature, recompute required receipt assertions before issuing a new receipt, and independently review/rebind a new plan under its new subject. Stale plans are not refreshed into verified status automatically. |

The prototype's missing-original call explicitly refuses with a local diagnostic;
it does not implement a historical reader or pretend an old digest proves source
completeness. The container/subject change does not automatically change V.9
block subjects, V.11 signing inputs, V.12 row commitments or financial result
digests. Their independent rules remain intact. Reissuance does not verify,
relabel or replace old evidence, and no dual-hash fallback is proposed. Release
placement and independent version allocation remain unapproved. The owner's
pre-5.0 clean-break policy supplies no authority to tag or publish the reserved
public 5.0 launch.

## Conformance impact

**This draft adds no live fixtures, baseline updates or capability claims.**
After design/versions are approved, add fixture/expected pairs under the existing
representation suites and their portable runner catalogue. Freeze independent
expected semantic values and canonical UTF-8 preimages, not just TypeScript
outputs. The names below are a proposed fixture matrix, not new accepted cases.

| Proposed case | Expected property in the approved new regime |
|---|---|
| Positive `extension-named-peers` | Both source orders, one role-bearing and one unannotated named peer; both retained exactly once. JSON/XML/CSV round-trip the same complete model/digest. |
| Positive `extension-mixed-identities` | Subject to D2 approval: null and explicit `default` remain distinct in either source order, including one-peer variants mode. A lone role-bearing explicitly named peer uses variants mode; the same routed source cannot also have a single-mode canonical subject. |
| Positive `extension-history-prose` | Full `_meta`, payload, annotations, per-block prose, unknown members, absent/null, Unicode and ordered history survive all model codecs. |
| Positive `extension-labels` | Legal collision-prone and escaped names, empty strings where admitted, UTF16 ordering, `/` and `~`; no wrapper guessing or invented name bans. |
| Positive/negative `direct-model-mode` | Role-free and one-peer directly authored variants models preserve mode across JSON/XML/CSV; model-to-Markdown refuses if deterministic source reprojection cannot preserve it without changing roles/content. |
| Positive `role-routing-controls` | Role-free repeated singleton and superseded-role nonactivation retain existing routing; removing the last active role follows the approved D2 boundary. |
| Negative `extension-entry-invalid` | Wrong tag, unknown wrapper member, empty variants list, duplicate identity, identity/annotation disagreement, noncanonical order, superseded block in active slot, or duplicate source-identity placement refuses. Equal content under distinct lawful identities is retained. |
| Negative `csv-extension-invalid` | Conflicting mode, duplicate/gapped ordinal, wrong variant or pointer, missing declared prose/value rows, inventory/hash mismatch or reconstructed digest mismatch refuses. |
| Negative `authenticated-extension-domain` | Repeated/superseded extension source still refuses V.13 authentication even if ordinary conversion preserves it. Existing unsafe/duplicate source guards remain. |
| Historical/unsupported-regime `envelope1-rejects-new` | The pinned archived Envelope1 evidence demonstrates rejection of the candidate stamp/shape; it does not require an old decoder in the new runtime. The approved current decoder refuses unsupported historical regimes with no fallback. |
| Cross-version `subject-stamp-only` | A formerly representable singleton/no-extension document has new canonical bytes/digest from E_NEXT; retain both independently frozen historical and candidate subjects. |
| Cross-version `receipt-signature-states` | Unsupported signature subject→INT-14; same-regime subject mismatch→INT-11; differing receipt canonicalization with disagreeing source digests→RCP-10, separately from engine RCP-07. Never compare/relabel across regimes as an old verified artifact. |
| Cross-version `other-commitments` | Unchanged block, block-signing and V.12 subjects; stale whole-source draw plan refused. Financial result commitments have independent controls and no regenerated expected arithmetic. |

### Frozen candidate subjects and fixture procedures

The [experimental evidence README](https://github.com/UWMD-OSP/UW-Markdown/blob/f93fd3216cea0f67f6c76d573d9fea0db801d309/experiments/envelope-0089/README.md)
provides five bounded candidate preimages and independent Python/Node rechecks.
The only selected version string is the design token `E_NEXT`; every candidate
stamp is deliberately unsupported today. These are design evidence, not approved
conformance or production canonicalization. ASCII-only evidence does not prove
non-ASCII ordering, floating-point serialization, source routing or codec
conformance. It does independently show that a stamp-only change moves an
extension-free subject and that one-peer `single` and `variants` have different
subjects even with the same underlying block.

The [read-only current-contract proof](https://github.com/UWMD-OSP/UW-Markdown/blob/f93fd3216cea0f67f6c76d573d9fea0db801d309/experiments/envelope-0089/README.md#current-envelope1-admission-proof-separate-from-candidate-design)
separately exercises unchanged Envelope1 schemas and the existing verified-JSON
decoder. Ten controls isolate current version, block-shape and received-digest
refusals; tagged entries cannot become legal1.0 blocks by relabelling their stamp.
Unknown members remain allowed: their missing required block fields cause this
shape refusal. Five low-level canonical/hash comparisons also pass, but those
helpers do not perform version/shape admission. Hash agreement is not codec
support. This proof adds no candidate validator or live fixture and exercises
no signature/receipt state machine or XML/CSV decoder.

Once the owner approves a design, each proposed positive fixture must specify
(1) original synthetic source(s), (2) the independently authored complete model,
(3) exact canonical UTF-8 and digest, (4) expected JSON/XML/CSV decoding, and
(5) required source accounting and round-trip outcome. Test two source orders
against the same expected peer subject, then change one peer, its exact label,
role, prose or lifecycle and require the stated identity change. Cosmetic key
order and line-ending controls must retain the subject. Freeze explicit
supplementary/BMP labels whose UTF16 and code-point orders differ; empty labels
are tested only after confirming their source admission. Invalid Unicode,
non-finite numbers, duplicate decoded members and unsafe keys retain existing
canonicalization/source refusal rules.

Each negative fixture starts from a valid independently frozen artifact, mutates
exactly the named field and declares which layer refuses before digest checking.
For example, swapping the null/default records is a noncanonical-array error,
not permission for a decoder to sort and successfully verify a received stamp;
changing only one record identity is an identity/annotation error. A metadata
or payload mutation with a structurally valid model is instead a received-digest
mismatch. Do not let an unrelated missing block hide the intended control.

Historical comparison and unsupported-regime fixtures preserve original
artifacts byte-for-byte. They do not require concurrent old/new decoders or
receipt regimes: use frozen historical preimages/results to compare the proposed
current subject, and test unsupported input refusal in the current runtime.
Pair a frozen old and candidate no-extension subject to isolate the stamp effect.
For receipts, test version-only difference
with equal digests separately from version-plus-digest mismatch, and include an
unknown-pack/result disagreement so earlier subject precedence is observable.
For signatures, combine unknown version with bad source and malformed artifact
with unknown version to pin the ordering above. For whole-source plans, retain
the original plan digest, present the candidate source and require stale refusal;
only a separately issued reviewed plan can bind the new identity. No fixture is
permission for an old-version runtime path or rewriting historical expectations.

Inventory affected existing suites before implementation: representation JSON,
XML and CSV round trips; document-signature projection/version guards; receipt
issue/verify; lease-up projection and assembly; reserve accounts/draw bindings;
package/batch/lake/workbook stale identities. Existing expectations remain their
historical regime; any approved new-regime fixture is separately identified.

## Independent Astra review intake — 2026-10-16 (unaccepted)

The attached independent review, **Recommendation keep RFC 0089 in dra.txt**,
examined main `3eee0fbab3f5682dc345804782994dc22d321fae` and proposal
`2ebe454a923072018e1af067285dd3140a10d40f`. Its recommendations are external
research evidence, not owner approval, accepted contract text or automatically
verified defects. The existing Reader review and isolated experiment carry the
independent reproductions and dispositions; no parallel planning system or
production correction is introduced by this draft.

### Acceptance gates: three distinct kinds of accounting

| Accounting | Required candidate meaning and evidence |
|---|---|
| Canonical current | Retain every admitted current named peer under the exact role opt-in and one approved nullable identity rule. Ordinary revision selection happens within that identity, never between different peers. A decoded tagged array cannot contain two current records with the same identity; reject rather than deduplicate. |
| Explicit history | Preserve complete blocks explicitly marked superseded, in physical source order, separately from active peers. Neither a role in history nor its position activates current variant mode. An empty history slot and unknown block members need explicit model-domain fixtures; the current prototype refuses them. |
| Physical source | Retain original bytes and account for every scanned block independently of current selection. Identify a block by source position and exact source-body evidence, not payload equality. An unmarked overwritten revision is not automatically equivalent to explicitly superseded history or authenticated retained history. |

Format §2.7 says last non-superseded block; the current ordinary TypeScript
router compares revision numbers and keeps the first on ties, while its early
extension branch overwrites before either history or variant routing. Do not
turn any of these observed implementation paths into a new specification.
Acceptance requires exact same-identity duplicate/current-revision fixtures,
including order/revision disagreement, equal revisions, explicit history and
history-only roles, with a reasoned disposition against the accepted contracts.
The prototype currently refuses unmarked overwritten revisions; that is a lab
limit, not a newly adopted source rejection. V.13's stricter every-physical-block
and duplicate-selection guards remain unchanged regardless of ordinary parsing.

**Concrete portable projection candidate, not accepted:** preserve existing
`{meta, content}` minimum block projections, but replace only each affected
`extensions[id]` projection by a tagged `single` block or ordered `variants`
records as in D1, where each record has exact nullable `variant` and a projected
`block`. Annotation echoes, source positions and prose remain outside the
Protocol §II.6a.6 minimum. A singleton example is
`{"mode":"single","block":{"meta":{},"content":{}}}`; a mixed example has
`{"mode":"variants","blocks":[{"variant":null,"block":{"meta":{},"content":{}}},
{"variant":"default","block":{"meta":{},"content":{}}}]}`.
The empty objects illustrate shape only, not valid required metadata. Freeze
independently authored complete expected projections before acceptance; reconcile
Protocol wording, public API types, builtin map behavior and independent version
accounting. No implementation-specific `ParsedUWFile` type is imposed on other
readers, and no old projection is silently rebaselined.

### Complete block members and a concrete new CSV carrier

Envelope1 `$defs.block` has `additionalProperties: true`. Its legal extra
members are part of the semantic subject. D1 carries that entire block unchanged;
a closed wrapper or a complete payload is insufficient if the outer block loses
members. JSON must retain all of them. The prototype explicitly refuses extras;
it has not demonstrated this full-domain obligation.

**Candidate for the new bundle mapping only:** add a fourth typed-value scope,
`block-extra`, whose root is an object containing exactly the block's own members
other than `annotation`, `content` and `prose`. Use existing typed JSON Pointer
rows, including an explicit empty root object, preserving nested values, unknown
keys, empty containers and absent/null distinctions. Reconstruct the extra object
first, refuse any reserved-member overlap, then attach exactly the separately
reconstructed annotation/content/optional prose. Reject duplicate decoded paths,
conflicting node types and aliases; verify the complete reconstructed semantic
subject after inventory validation. This applies to **every** block collection,
including builtin and superseded blocks, not only extensions. It is a concrete
proposal requiring mapping/version approval, not a fourth scope silently added
to CSV1's closed `annotation|meta|content` vocabulary. Never remove extras from
schema admission or the digest to make a round-trip pass.

CSV conformance must exercise the actual ZIP artifact, not only its directory
form: deterministic bytes/timestamps/path ordering, fresh independent decode,
manifest inventory, exact UTF-8 and received subject, plus the existing path,
duplicate, symlink/encryption, size/ratio and unsupported ZIP refusals. The frozen
candidate directories establish none of those ZIP execution claims.

### XML representability: exact alternatives for owner review

Current XML1 uses XML character data for strings and attributes for escaped
member names. Legal JCS strings such as NUL, U+FFFE and U+FFFF cannot be put there,
even as XML character references. The current universal fidelity wording and
that admitted JSON domain need a governed disposition. Two bounded alternatives:

1. **Total escaped lexical mapping (candidate preference for evaluation).** In a
   separately versioned codec/namespace, carry every JSON string as one ASCII
   JSON-string lexical token: surrounding quotes; `\"` and `\\` escapes; all
   controls and all non-ASCII UTF-16 units as lowercase `\uhhhh`; other printable
   ASCII unchanged. Valid supplementary characters use paired escapes; lone
   surrogates remain rejected by JCS admission. XML escaping is then applied to
   the lexical token as transport text. Carry every object member name using the
   same lexical rule in an explicit `name-json` attribute on a generic member
   element, rather than guessing whether a raw name needs escaping. For example,
   a NUL-bearing name/value is represented by ASCII `"a\u0000b"`, not an XML
   numeric character reference. This rule covers annotations, prose, frontmatter,
   block extras and unknown outer members too. Decode one JSON string, require
   canonical lexical re-encoding equality, reject duplicate **decoded** names,
   and retain exact valid Unicode without normalization. Attribute entity
   escaping is separate from this lexical encoding. The markers, allowed
   attributes and namespace must be approved; old decoders must refuse them.
2. **Explicit partial XML domain.** Keep XML1's scalar/name mechanism, specify
   the exact XML-representable subset and a deterministic representation refusal
   for every unsupported string/name. JSON/CSV retain the wider JCS domain.
   This requires revising the common full-fidelity promise and capability/media
   description coherently; it is not a codec author's implementation choice.

A base64-of-strict-UTF8 lexical carrier is another reversible implementation
alternative, but would need equally exact alphabet/padding, strict UTF-8,
canonical lexical form, duplicate-after-decoding and namespace rules. It is not
implicitly authorized by either option above. No normalization, replacement
character, invented label restriction or raw XML numeric-reference workaround
solves the full-domain problem.

The current TypeScript canonicalizer's treatment of lone UTF-16 surrogates is a
separate existing JCS issue. RFC8785 §3.2.2.2 requires an error for those strings,
including member names; valid pairs and U+FFFD must remain unchanged. Fixing that
admission defect cannot recover omitted peers or establish a new XML regime.
Its historical digest/receipt consequences require a separate bounded review;
this RFC changes neither canonicalizer nor receipt verdicts.

### Commitments, provenance and the evidence still missing

D5 and the new-issuance prerequisites apply even to extension-free subjects: the
container stamp participates in semantic identity. Preserving JCS/SHA256 does not preserve
the old subject. Preserve every old source/artifact byte, subject and verdict
scope as historical evidence. A new signature covers a newly issued subject;
a new receipt requires its own accepted verification/recomputation. A new label,
unchanged financial result or retained block signature cannot transfer old
snapshot authentication. Unsupported-version and malformed/source/digest refusal
precedence must be tested with real new-regime implementations before acceptance
of the corresponding commitment rules; the plans do not execute those protocols.

RFC0085 remains draft. Its proposed retained-history authority is compatible
with lossless storage, but it is not an accepted requirement of this RFC. Never
replace the original archive with a clean projection, infer completeness from
retained hashes, turn a failed source into an authenticated one by compaction,
or describe reissuance as recovery of historical attribution. History preservation
and proof of history completeness are different claims.

**Established bounded evidence:** five frozen candidate models, their exact
subjects, JSON/XML/CSV-directory examples, source accounting and local negative
controls; independent Node subject/artifact checks. **Not established:** a second
independent XML/CSV decoder, complete schema-admitted blocks/builtin composition,
the total XML alternative, actual ZIP interoperability, complete source/portable
projection semantics or real new-regime receipt/signature execution. No
production migration or legacy-regime support is required by the pre-5.0 policy.
A shared encoder/decoder round-trip cannot substitute for independent expected
models and implementations.

Pre-acceptance must settle the precise domain/projections, block-extra and XML
mapping text, commitment/version consequences and disposition of verified existing
defects. Freeze positive, negative and cross-version expected models/preimages
for those decisions before approval; production implementation and separately
authorized activation follow. Public versions, RFC acceptance, conformance
expectations and the reserved UWMD5.0 launch remain unchanged.

## Reference implementation

Implementation is blocked on owner design/version approval. The later bounded
implementation must update `packages/uwmd-verify/src/{types,parser,envelope,
uwjson,uwxml,uwcsv,codec,integrity,receipts,protocol}.ts` as applicable, the shared
schema and mapping specs, consumer adapters, the portable parse projection and the
independent Python projection. An Envelope-only change cannot fix a colliding
public/default-key projection.
Verify actual file names at implementation time. Public exports flow through
verify's index/browser entries and core's re-exports; extension-entry type changes
are breaking public API changes. No engine, AI workflow or new dependency is
required. Keep normative spec/schema/protocol changes together under invariant7.

Tests must cover the matrix above, independent cross-codec preimages, all source
blocks accounted once, exact existing state/code precedence, package/receipt
identity guards, build/test/typecheck/conformance/docs and all affected guards.
Do not merge an experimental recovery snapshot or implement a private shape first.

## Alternatives considered

1. **Same-stamp block-or-map widening:** small type edit, but old strict readers
   reject maps, raw maps conflate nullable/default identities and can collide
   with block discriminator keys. It silently reuses a commitment label unless
   separately justified; this candidate uses an explicit new regime instead.
2. **Only named maps with a reserved null sentinel:** preserves a familiar lookup
   but bans/escapes a previously legal label and adds a second identity language.
3. **Uniform records for every active collection:** can solve general identity
   representation, but broadens this extension correction and changes ordinary
   section paths with no demonstrated need. Keep it a separate owner option.
4. **Select/aggregate/drop one peer or put it in history:** loses legal active
   content and changes the complete document commitment; not model fidelity.
5. **Dual pre-5.0 readers/codecs/receipt regimes or automatic receipt/plan
   rehashing:** excluded by the owner's public-launch compatibility policy.
   Historical archives remain evidence; new issuance is not historical proof.

## Unresolved questions

| Owner decision | Proposed answer; not accepted |
|---|---|
| Exact minimal extension shape | D1 tagged single/variants entries with identity-bearing records; no unrelated collection rewrite. |
| Mixed unlabelled/named admission and affected projections | D2 preserves the opted-in unlabelled peer as exact null, distinct from literal `default`; coordinate Format, Protocol portable subset projection and reference public API implications explicitly. |
| XML1-inexpressible legal strings/member names | Do not ban legal JSON values. Choose an explicitly versioned escaped lexical mapping or a clearly governed representability refusal; the lab implements the latter as an experimental limit only. |
| Version/regime labels and release placement | The owner has settled the pre-5.0 compatibility policy. Specific representation/subject labels and independent Envelope/Protocol/Format-if-needed/codec/canonicalization/package versions still require design approval; no 5.0 tag/publication without separate launch approval. |

No expansion of V.13 authentication admission is proposed. RFC0085 compaction
and RFC0088 numerical determinism remain separate drafts; this RFC accepts neither
and requires neither a financial kernel nor a new receipt arithmetic rule.

## Prior art

RFC0014 supplies the shared Envelope/fidelity/versioning contract; RFC0040 and
RFC0066 supply generic role routing. RFC8785 supplies canonical JSON, and RFC6901
supplies pointer escaping. Existing V.12 nullable monetary identity and VIII.12
exact variant references illustrate why authored identity cannot be replaced by
a display/default key. See the pinned intake for authoritative source links.
