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
candidate, mixed-identity rule and commitment regime require owner approval
before implementation. Envelope 1.0, normative schemas,
source digests, receipts, signatures, frozen expectations and public versions
remain unchanged by this PR. UWMD 5.0 remains reserved for public launch.

The owner's 2026-10-17 rule governs this draft: all `@uwmd` npm packages
launch together at 5.0.0, and prelaunch releases use 4.x.x from main. No
prelaunch compatibility, migration, deprecation, version-recommendation or
artifact-preservation work is an acceptance gate. Earlier migration/reissuance
plans in the experiment are retired; do not execute or maintain them. This
removes no current lossless-representation, source-integrity, canonicalization,
receipt or signing requirement. Format, Protocol and wire contracts remain
independently identified; no version is allocated or launch authorized here.

The separately reviewed JCS Unicode correction is complete: #373 merged as
`765e2c4b6e2caf532f13d06c94234615932b47c7` after exact-head CI38995962876.
Its strict rejection is accepted current behavior. This completed correction
is not an open RFC0089 acceptance gate.
Parser peer/history storage and the CSV block-extra carrier remain unresolved
representation work. Earlier production probes are pinned to their stated
pre-correction baseline; do not repeat them as claims about current JCS behavior.

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

### D2b — Exact recommended portable minimum (unaccepted)

Keep Protocol II.6a.6's subset contract: a baseline names required fields and
an implementation may emit more. Do not make an implementation's internal
`ParsedUWFile` shape normative. Replace only the affected extension collection
minimum with these identity-bearing forms:

```ts
type PortableBlockMinimum = {
  meta?: JsonValue; // present iff the authored payload carried _meta
  content: Record<string, JsonValue>;
};
type PortableExtensionMinimum =
  | { mode: 'single'; block: PortableBlockMinimum }
  | { mode: 'variants'; blocks: Array<{
      variant: string | null;
      block: PortableBlockMinimum;
    }> };
// extensions: Record<string, PortableExtensionMinimum>
// superseded[id]: PortableBlockMinimum[], in explicit history source order
```

`meta` copies the authored `_meta` value without filling defaults; absent and
explicit null remain different. `content` contains the authored payload members
except `_meta` and `_notes`, following the accepted minimum. In particular,
`_role`, `_overrides`, unknown values and an ordinary member named `content`
remain inside content when authored. Optional role/override echoes add no
required baseline keys. Existing builtin/append-only projection conventions are
unchanged, including the pipeline log's existing complete entry objects.

A variants record carries the exact nullable identity even when the original
annotation would otherwise be outside the minimum: null and literal `default`
are distinct, null sorts first, duplicate exact identities refuse and decoding
never sorts a received stamped collection into validity. The single-mode
minimum does not require an annotation echo; its complete authored annotation,
including any non-routing label, remains in the full Envelope. History blocks
retain their ordered authored metadata/content; they do not become current
variant records. Envelope block extras and retained prose remain mandatory for
model-fidelity exchange and commitment, not new parse-minimum requirements.

Current selection means the **last physically occurring non-superseded block
within the applicable exact identity**, as Format2.7 states; revision numbers
do not replace source order. Explicitly superseded blocks retain physical order
in history. An overwritten but unmarked current block is still a physical source
record, not authority to change its lifecycle or relabel it as explicit history.
V.13 independently refuses ambiguous/duplicate selection before routing and
retains its stricter repeated/superseded-extension refusals. This clarification
neither accepts draft RFC0085 history completeness nor makes ordinary current
selection proof that every physical source block was authenticated.

The [decision proof](https://github.com/UWMD-OSP/UW-Markdown/blob/c1c60b879e5e41530fcc35a5b949147328f7b9ed/experiments/envelope-0089/decision-proof/README.md)
freezes exact extension/history minimum examples from seven preserved complete
models. It demonstrates that changing `_notes` or retained prose can leave the
portable minimum unchanged while changing the complete semantic subject and
invalidating its signatures. The minimum is therefore **not** an authentication
preimage or a reconstruction source for omitted history/prose/annotations.

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

**Recommended completion of the CSV candidate's empty-container carrier:**
add `empty_collections_json` to the proposed new mapping's `document.csv`, with
a canonical JSON array of closed `{path, kind}` records. Permit only empty
builtin variant-map slots at `/sections/<escaped-id>` (`kind: "object"`) and
empty explicit-history slots at `/superseded/<escaped-id>` (`kind: "array"`).
All required outer collections already have their fixed map/array shape. Empty
containers inside block scopes, extras and frontmatter use existing typed root
rows, not this field. Sort these records by exact RFC6901 path in UTF16 order;
reject duplicate/aliased paths, noncanonical order, wrong kind/location and any
overlap with a nonempty block descriptor. Reconstruct the declared empty slot
before final complete-model/digest validation. For example,
`[{"path":"/superseded/x_review","kind":"array"}]` preserves an authored empty
history slot. This is a concrete mapping proposal, not a ban on the legal empty
model domain or a field admitted under CSV1. The original frozen codec-study
still refuses these slots; its21 artifacts remain unchanged. The separate
[empty-carrier checkpoint](https://github.com/UWMD-OSP/UW-Markdown/blob/f0f710fe668e7d7e9db4b3cf60e4664effed1e6c/experiments/envelope-0089/empty-collections/README.md)
now reconstructs three complete candidate values through CSV and actual ZIP,
including absent-versus-empty slots and a mixed ten-block value retaining all
block extras. Its28 new artifacts preserve exact JSON/JCS/CSV/ZIP bytes. Derived
Python and independently maintained Node readers reject twelve carrier
mutations per decoder after refreshed transport inventory; five Python methods
and four Node tests pass on one Windows host. This closes a concrete carrier
proof gap, not full schema/source admission, cross-platform proof or owner
acceptance. The copied mixed model retains the earlier lab's partial metadata;
round-trip equality does not certify its Format validation or authenticated
source. No legal empty is discarded, no original proof is rewritten, and no new
Envelope/CSV label is allocated by executing the candidate.

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

#### Independent block-extra, lexical XML and actual ZIP checkpoint

The later [codec study](https://github.com/UWMD-OSP/UW-Markdown/blob/d892e94b/experiments/envelope-0089/codec-study/README.md)
adds two complete synthetic models and21 frozen artifacts without changing the
original prototype or expectations. Each model includes ten blocks across all
six block collections, complete outer block extras, unknown members, empty
containers, absent/null distinctions, exact null versus literal `default`,
metadata and prose. Python and separately authored Node readers reconstruct the
same frozen values from CSV directories, actual ZIP bytes and escaped-lexical
XML, then independently check their JCS preimages/digests. Five Python methods
and five Node tests pass on the recorded Windows runtime. Node also checks the
original59 case-artifact hashes and independently reproduces physical source
ordinals/current/history/body hashes for the two preserved source controls.
This is bounded research, not complete schema or conformance evidence.

The CSV study concretely implements the proposed fourth `block-extra` scope
for every block location, including an explicit empty object root and reserved
member-overlap refusal. It does not add that scope to CSV1. Its deterministic
ZIP STORE profile checks local/central headers, CRC, inventory and reconstructed
subject, with explicit path/flag/method/symlink/size/version refusals. Deflate,
ZIP64 and broader transport-policy requirements are not settled by this profile.

The XML study makes the total lexical alternative executable: a generic typed
`uw:value` root contains the complete model; object children are `uw:member`
with exact ASCII JSON-string `name-json`; array children are `uw:value`.
Strings use the same ASCII JSON lexical encoding, with lowercase escapes and
paired supplementary units, before XML entity escaping. Exact type/attribute,
lexical re-encoding and duplicate-decoded-name checks precede model/digest
comparison. NUL, U+FFFE/U+FFFF, CR/LF/TAB and valid supplementary values/names
round-trip without normalization. The namespace and all E_NEXT/C_NEXT/B_NEXT
labels remain unallocated research tokens. This alternative is not accepted.

Independent review exposed a transport-byte defect in the initial experimental
ZIP decoder: its UTF-8 decoder stripped BOM before inventory hashing. A valid
CRC/size archive with three BOM bytes added to `document.csv` could retain the
old inventory and decoded subject. The original observation is preserved, not
presented as proof of that refusal. The corrected reader hashes actual ZIP
payload bytes before strict UTF-8 decoding and preserves BOM for syntax refusal;
a sixth Node test creates the valid-CRC BOM mutation independently with Python.
The separately frozen [correction evidence](../../experiments/envelope-0089/codec-study/evidence/bom-correction/observations.json)
pins complete historical/current helper identities and six passing Node tests;
all21 candidate fixtures/artifacts remain unchanged. This fixes the experiment,
not a production codec or normative contract.

That checkpoint closed the earlier absence of an independent CSV/XML reader
and actual ZIP execution for its two models only. Its historical empty-slot
limit remains unchanged; the separate empty-carrier checkpoint above supplies
bounded absent/empty history/map evidence. Neither establishes the full
schema/builtin domain, a complete independent source projector, new-regime
verification/issuance or cross-platform interoperability. The exact mapping,
admitted domain and version commitments still require the owner's design
approval; no V.13 or RFC0085 admission is expanded.

#### Independent namespace checkpoint for the lexical XML option

The [namespace decision proof](https://github.com/UWMD-OSP/UW-Markdown/blob/66d037289d22040aaffe83cb192de314b441037a/experiments/envelope-0089/namespace-proof/README.md)
reads those two frozen XML files directly. The preserved Python ElementTree
reader and a separately authored Node namespace reconstructor agree on38
actual-byte controls: ten accepted and28 refused per implementation. Accepted
prefix replacement, default element namespaces, child-local prefix shadowing
and normalized namespace URI character references preserve the complete decoded
value, independent JCS preimage and candidate semantic digest. Unbound or wrong
bindings, reserved XML/XMLNS bindings, qualified candidate mapping attributes,
duplicate decoded names, invalid lexical strings and DTD controls refuse.
An escaped ampersand control ensures namespace references are not decoded twice.

These scoped expanded-name rules follow
[Namespaces in XML1.0](https://www.w3.org/TR/xml-names/); choosing a new carrier
does not make prefix spelling a new semantic identity. The proof remains bounded
to these two models, ASCII carrier/QName spellings, size/depth limits and the
recorded parsers/runtime. It is not a general XML parser, malformed-input,
complete namespace/name-domain, schema or source-authentication proof. Candidate
bare `type`/`name-json` attributes are distinct from current XML1's mapping.
The earlier artifacts, BOM correction and initial transport record remain
preserved; no production codec or namespace is activated.

#### Raw JSON carrier admission before object validation (unaccepted)

For the proposed new regime, reject duplicate **decoded** JSON member names
before object construction, including nested and unknown members and the CSV
manifest. Do not silently select first/last or deduplicate a received ambiguous
carrier. An escaped unique name remains legal; case and Unicode normalization
are not aliasing rules. Typed schema/model validation remains a separate step.
This recommends explicit raw transport admission text under the complete-mapping
choice, not a new metadata shape, financial rule or receipt diagnostic.

The [raw JSON boundary study](https://github.com/UWMD-OSP/UW-Markdown/blob/bd28d42c0cc63296278e1a62bc81535b2d7e8d8b/experiments/envelope-0089/json-boundary/README.md)
uses actual preserved model/CSV-manifest bytes.36 controls retain21 historical
acceptance differences: the existing Python duplicate-aware path refuses names
that Node's ordinary `JSON.parse` path erases before model/manifest validation.
A separate bounded Node adapter and Python strict profile agree on12 accepted
and24 refused. Under Node's original path, all28 actual carrier cases retain the
same complete model/preimage and the same valid raw research Ed25519 subject
signature. Under strict preflight,20 duplicate carriers refuse before crypto;
the eight valid carrier spellings still verify. This is transport-admission
asymmetry, **not a signature break** or current public artifact verification.
The remaining eight cases are syntax-only controls, not new UWMD key admission.

[RFC8259 section4](https://www.rfc-editor.org/rfc/rfc8259.html#section-4)
describes the interoperability risk, and
[RFC8785 section3.1](https://www.rfc-editor.org/rfc/rfc8785.html#section-3.1)
requires unique names in adapted JCS data. A JSON Schema object or later JCS call
cannot recover raw occurrences already erased by parsing. The new carrier and
manifest boundary therefore needs explicit governed text/fixtures; this study
does not retroactively allocate errors for every existing JSON API, extend V.13
source admission or apply a new blanket receipt-input rule. Existing helpers
and frozen observations remain unchanged. Full grammar/resource/security/domain
and cross-platform proof remain open; no new-regime issuance is implemented.

### D5 — Canonicalization, commitments and authentication

Keep RFC8785, UTF-8 and SHA256 unchanged. Remove only the existing top-level
volatile members `generated_at`, `generator` and `semantic_digest` for complete
Envelope hashing. Because `envelope_version` is included, assigning E_NEXT
changes **every structured source digest**, even a document with no extensions.
Container/codec versioning and the semantic canonicalization regime are distinct.
The candidate assigns a new governed `uw-envelope-semantic` regime C_NEXT rather
than silently replacing 1.0 bytes. Exact version labels are unassigned.

| Current consumer/commitment | Required launch contract |
|---|---|
| JSON/XML/CSV semantic digests | Construct the complete approved subject and verify its received stamp. Do not treat a portable projection or raw signature success as model/source admission. |
| Receipts | Coordinate `canonicalization_version` and source-subject generation; preserve existing RCP-10 canonicalization-mismatch versus RCP-07 engine-mismatch precedence. RCP-10 needs both a differing version and a disagreeing digest; a version difference alone is not an issue. No same-regime subject mismatch is excused by trying another hash. Financial `results_digest` remains a separate commitment and need not change for container-only changes. |
| Document signatures V.13 | New source subject/version constants and schema accounting would be required. Preserve existing duplicate singleton, unsafe-source, repeated-extension-id and superseded-extension admission guards. Ordinary lossless conversion does not make those sources authenticatable. Expanding the authenticated source domain is outside this RFC. Unsupported subject versions stay unverifiable/INT-14; same-regime subject mismatch stays failed/INT-11. |
| V.9 block hashes / V.11 block signatures | Unchanged inputs when payloads and six signing fields are unchanged. They do not authenticate peer assembly and cannot replace document authentication. |
| V.12 replacement payment | Unchanged fixed selected ordered vector/currency/variant/index commitment; no Envelope version enters it. |
| VIII.9–12 projection, assembly, reserves and draw plans | Audit each complete source-digest consumer. Existing digest-only plans may become stale; require an explicit reviewed new plan/rebind, never an automatic digest refresh or a new successful result-state interpretation. Retain finite evidence/refusal precedence. |
| Package, batch, lake, workbook and HTTP consumers | Update semantic primary/cache identities, paths and stale checks deliberately. Raw-file hashes and complete semantic subjects are distinct commitments; stale current bindings must not become verified through an automatic digest refresh. |

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

### D5a — Recommended authentication boundary and real binding evidence

Recommend the new complete E_NEXT semantic value, minus only the existing three
volatile members, as the C_NEXT whole-model preimage. Keep the existing
`uw-envelope-semantic` domain name while separately allocating its new supported
version after approval. The Envelope and canonicalization labels participate in
their own declared commitments; a similar financial result or a valid old
signature cannot substitute a different subject/version.

**Document authentication remains source-gated.** A future V.13 counterpart for
the new subject must freshly parse and account for the supplied Markdown under
the existing admission guards, then construct D1 exactly. Repeated extension ids,
superseded extensions, duplicate selection and unsafe/ambiguous source still
refuse. The singleton/one-peer eligible fixtures can map to D1 after that guard;
ordinary legal mixed peers and extension history may be losslessly converted
without becoming V.13-authenticatable. Directly authored candidate models lack
that source proof. No generic model-signature capability or additional signing
admission is introduced by this RFC.

**Receipts keep their own accepted issuance obligations.** Their subject uses
the approved ordinary whole-Envelope projection, not the portable minimum; pack
recomputation and complete-result/parse refusals still apply. Do not turn V.13's
extra authentication bans into a new receipt rule. A signed receipt attests its
stated computation/subject and does not by itself prove every physical source
record or retained-history authority. Candidate financial receipt issuance and
verification remain unimplemented until the new subject/routing contract is
accepted; byte-binding experiments must not be described as that implementation.

The focused [real Ed25519 evidence](https://github.com/UWMD-OSP/UW-Markdown/blob/c1c60b879e5e41530fcc35a5b949147328f7b9ed/experiments/envelope-0089/decision-proof/README.md)
uses an openly known research key with Node crypto, not accepting stubs. Seven
preserved models supply42 mutation pairs and14 label-change pairs for document
and receipt-shaped signing inputs. Full payload, metadata, notes or prose changes
break signatures; semantic-preserving key order and excluded Envelope volatility
do not. Label changes cannot reuse a signature. These are cryptographic byte
controls, not identity trust, financial correctness or source completeness.

Actual current production APIs separately admit two exact source/model controls
and refuse two repeated/history sources before gated candidate signing. Three
model-only inputs have no attributable source for gated issuance. Current-label
control artifacts verify using real Ed25519; source `_notes` mutations return
INT11/RCP01 before backend execution. Current document signatures reject candidate
subject labels with INT14/backend0. The candidate receipt controls return
RCP10/backend0 because both the digest and canonicalization version differ;
valid signature bytes do not change that precedence. Relabeling a candidate digest as current produces current
subject/source refusal, never transferred authentication. The source/compiled
hashes and every complete artifact/payload/result are frozen independently from
runtime metadata; no production label, schema, financial result or receipt rule
changes.

The separate four-control receipt metadata probe preserves accepted Receipt
§5.5 precisely: a differing canonicalization version with matching digests is
not an issue and normal verification proceeds. Changing only that signed field
while retaining the original test signature fails RCP01/backend1; re-signing the
disposable control with the public research key verifies/backend1. This does
not implement the named canonicalizer, migrate a historical artifact or justify
blanket unsupported-label refusal for receipts. The RCP10 mixed-peer observation
does not establish Envelope1 source completeness; Issue365 remains the separate
representation defect. No candidate financial receipt was issued.

Accepted RFC0090 changes the current production/Format/Protocol source closure,
so the original b2-only replay remains historical and refuses an afcc build.
The separate [fresh afcc checkpoint](https://github.com/UWMD-OSP/UW-Markdown/blob/6c79b10d8051028a4b6535f8bea23190933ebc3a/experiments/envelope-0089/decision-proof/CURRENT-AFCC.md)
actually executes the same seven-model matrix and four Receipt5.5 controls
against accepted main, separately pins all179 source and86 compiled identities,
and compares every behavioral field to the preserved originals. All signatures,
subjects, result digests, source evidence, refusal states and backend counts
agree for these examples; only separately enforced production identity maps are
excluded from that cross-head behavior comparison. Original artifacts/helpers
remain byte-identical. This one-host fresh result is not a cross-platform or CI
claim, broader V.13 admission, new receipt rule or acceptance of this RFC.

### D5b — Representation identity is not validation-policy attestation

The [operation/commitment matrix](https://github.com/UWMD-OSP/UW-Markdown/blob/dcb842ed112782336ea3a0f14168b135dc1af586/experiments/envelope-0089/decision-proof/README.md#subject-identity-assessment-and-issuance-are-separate-commitments)
separates four changes using existing frozen evidence: equivalent carrier
spelling, validation of the same exact source, actual metadata authoring, and
the proposed new Envelope stamp. These are different current operations with different commitments.

Assessing unchanged source under a validation rule does not itself change its
payload or Envelope subject. Newly issued receipt policy counts and signing
bytes may differ even when source and results digests do not. The accepted
RFC0090 investigation records exactly that difference on one identical
actor-absent disposable input; its same/cross receipt checks were unsigned,
not a cryptographic financial-receipt proof. The raw-JSON and Ed25519 studies
supply their own separate, precisely bounded evidence.

Actually inserting a metadata boolean changes raw source and the complete
Envelope subject. It does not by itself change V.9's metadata-excluding hash
or V.11's six signing fields; a new actor/timestamp would have separate effects.
Neither a valid block signature nor a producer's default for NEW metadata can
supply an omitted historical declaration. Receipt recomputation/issuance and
V.13 source admission retain their own accepted obligations; no new receipt
refusal, source repair or grandfathered authentication follows from this table.
The owner decision remains the exact represented value/projection and new
commitment regime, not permission to fabricate validation inputs. Accepted RFC0091 supplies the current META-02/03 validation contract; it
does not choose representation identity. Retained-history RFC0085 remains
draft and is not expanded here.

## Current-contract coordination and acceptance scope

The owner has excluded prelaunch backward compatibility and artifact-preservation
work. There is no migration service, legacy decoder, dual-hash fallback,
retention inventory, reissuance plan or version-bump recommendation in the
acceptance checklist. Experimental files that only implement those tasks are
retired and are not required test gates. Do not spend another cycle replaying
old regimes or comparing historical verdicts.

The implementation still needs one coherent current launch contract:

| Surface | Required governed change, without allocating a version |
|---|---|
| Envelope | Define the new tagged container type/schema and supported stamp together. |
| Format | Resolve exact mixed null/literal-default identity grouping and last-physical-current selection; named-peer legality is already accepted. |
| Protocol/public Reader surfaces | Specify D2b's exact portable minimum and distinguish physical inventory, ordinary selection, validation and source-authentication admission. |
| JSON/XML/CSV/ZIP | Carry the same complete lawful model, including unknown block members and empty collections; refuse malformed or unsupported input at a stated boundary. |
| Signatures/receipts/current bindings | Define the complete supported subject, signing payloads and refusal precedence. Keep Receipt5.5 matching-digest behavior and V.13 admission unless separately approved. Test current stale binding refusal rather than historical repair. |
| Packages/launch | Prelaunch packages use4.x.x; all @uwmd npm packages become5.0.0 together only at separately authorized public launch. Format, Protocol and wire labels are not inferred from npm numbering. |

Modules retain their accepted declarations, metric definitions and validation
semantics. Generic extension completeness is not a third-party module feature,
new financial profile, generator or StackUW workflow. A complete current subject
must come from its admitted input; an omitted value cannot be invented from a
digest, signature or selected view. This is current verification correctness,
not a prelaunch-document recovery requirement.

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
| Negative `unsupported-subject` | The current decoder/verifier refuses unsupported container/codec/document-subject labels at the specified boundary, with no fallback. Receipt5.5 matching-digest metadata behavior remains separate. |
| Positive `complete-subject-stamp` | The approved current subject includes its exact declared container stamp even for extension-free inputs; independent expected bytes pin this rule. |
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

Unsupported-label fixtures exercise only the supported current runtime and its
specified refusal order. Receipt fixtures separate equal source digests with
differing canonicalization metadata from actual subject disagreement, and include
unknown-pack/result controls so earlier precedence remains observable. Signature
fixtures combine unsupported subject with bad source and malformed artifact with
unsupported subject. Current whole-source plans require stale refusal when their
bound complete subject changes. No old-regime replay or artifact retention is an
acceptance obligation.

Inventory affected existing suites before implementation: representation JSON,
XML and CSV round trips; document-signature projection/version guards; receipt
issue/verify; lease-up projection and assembly; reserve accounts/draw bindings;
package/batch/lake/workbook stale identities. Synchronize any approved current expectations with their precise normative
change; do not use a codec experiment as authority to rebaseline them.

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
| Explicit history | Preserve complete blocks explicitly marked superseded, in physical source order, separately from active peers. Neither a role in history nor its position activates current variant mode. The original prototype's empty-slot/block-extra limits remain historical; the later codec and empty-carrier checkpoints demonstrate bounded examples, not complete model-domain admission. |
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
   attributes and supported namespace must be approved; unsupported mappings
   refuse at their stated current boundary.
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

The initial review's TypeScript lone-surrogate behavior was a separate JCS
admission defect. RFC8785 §3.2.2.2 requires an error for those strings, including
member names; valid pairs and U+FFFD remain unchanged. The strict correction
and public error boundaries were reviewed and integrated separately in PR373.
That correction cannot recover omitted peers or establish a new XML regime.
Its historical subject consequences remain recorded separately; this draft
changes neither canonicalizer nor receipt verdicts.

### Commitments, provenance and the evidence still missing

D5 applies even to extension-free subjects: the container stamp participates
in semantic identity. Keeping JCS/SHA256 does not equate different subjects. A signature covers exactly its declared supported subject;
a receipt requires its own accepted verification/recomputation. A label,
unchanged financial result or retained block signature cannot transfer old
snapshot authentication. Unsupported-version and malformed/source/digest refusal
precedence must be tested with real new-regime implementations before acceptance
of the corresponding commitment rules; the plans do not execute those protocols.

RFC0085 remains draft. Its proposed retained-history authority is compatible
with lossless storage, but it is not an accepted requirement of this RFC.
A current parse projection or stored hash does not prove source completeness;
compaction cannot turn a refused source into an authenticated one. Storing
explicit history and proving its completeness are different claims. No
prelaunch archive preservation or reconstruction gate follows from either.

**Established bounded evidence:** the original five frozen candidate models,
subjects and60 artifacts remain unchanged. The later two-model/21-artifact codec
study adds complete block extras across all six collections, a Python codec plus a separately
authored Node reader for CSV/ZIP/lexical XML, preserved physical-source
controls and exact complete-value/preimage comparisons. The separate empty-carrier
and namespace checkpoints add bounded empty-slot and namespace evidence without replacing those artifacts. **Not established:**
complete schema/builtin admission, complete numeric and source/portable projection
domains, general XML/parser/ZIP/transport coverage, cross-platform independent
runs or real new-regime verification/issuance. The decision proof's real Ed25519
binding controls establish exact subject mutation effects, not accepted
new-regime source admission or a complete receipt implementation. No
production migration or legacy-regime support is required by the pre-5.0 policy.
A shared encoder/decoder round-trip cannot substitute for independent expected
models and implementations.

Pre-acceptance must settle the precise domain/projections, block-extra and XML
mapping text, commitment/version consequences and disposition of verified existing
defects. Author independent positive, negative and supported-subject expected models/preimages
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
   No historical recovery or preservation gate is required.

## Owner decision package (recommended, not accepted)

The smallest coherent design decision is approval or revision of the three
linked choices below. The recommended package is one new tagged lossless
representation with an exact portable subset, total lexical XML and complete
CSV carriers, and a governed complete-model subject. This remains a proposal.

Several constraints are already settled rather than additional owner choices:
Format2.8 named-peer legality and role opt-in; Format2.7 last-current selection
within an applicable identity; separate explicit history versus physical source
accounting; preservation of every legal block/unknown member; and unchanged
V.13 source admission. A parse minimum cannot substitute for a complete subject.
RFC0090's accepted actor/source-inventory correction does not decide nullable
extension routing, authenticate a lossy projection or accept RFC0085 authority.
Receipt5.5's equal-source-digest metadata path remains unchanged. Pre-5.0
backward support is already excluded; no legacy reader or automatic rehashing
is an option needed for this design.

| Owner choice | Recommended coherent answer | Scope/evidence still required before acceptance |
|---|---|---|
| Tagged identity and portable projection | Approve D1 single/variants wrappers and D2's exact opted-in null identity distinct from literal `default`; use the D2b extension/history minimum. Keep ordinary current selection, explicit history and physical source accounting separate. | Coordinate Format mixed-admission wording, portable subset text, reference public API shapes and exact duplicate/current-order fixtures. No unrelated builtin collection redesign. |
| Complete exchange mapping | Choose total ASCII JSON-lexical XML with exact name/value decoding; choose the fourth CSV `block-extra` scope for every block plus the explicit empty-collection carrier above. Preserve all legal data rather than narrowing JSON admission. | Approve exact mapping/domain and raw duplicate-name admission text, then synchronize schemas and complete domain fixtures. Bounded empty-map/history, independent namespace and actual ZIP evidence now exists; general parser/domain/transport and cross-platform proof remains open. The BOM defect/correction stays preserved. |
| New commitment regime | Approve a new E_NEXT/C_NEXT subject contract with strict unsupported Envelope/codec and V.13 subject refusal; keep V.13 source admission unchanged and receipts under their own accepted compute/issuance and §5.5 matching-digest rules. Portable projections and raw cryptographic success cannot bypass source/whole-model accounting. | Coordinate the independently identified Envelope, Protocol, Format if its meaning changes, mappings and signature schema/constants. Exact current wire labels require coordinated contract edits; npm packages follow the explicit4.x/launch5.0.0 owner rule. No5.0 tag/publication without separate launch approval. |

Approving a direction does not complete the acceptance gates above. RFC0085
retained-history authority and RFC0088 numerical procedures are not accepted by
this package; legal archival storage is not proof of completeness. No automatic
migration, old-regime decoder/hash fallback, historical artifact rewrite or
implicit model generation is proposed.

No expansion of V.13 authentication admission is proposed. RFC0085 compaction
and RFC0088 numerical determinism remain separate drafts; this RFC accepts neither
and requires neither a financial kernel nor a new receipt arithmetic rule.

### Exact decision text for owner review

The proposed narrow approval is: **adopt D1's tagged single/variants entry and
D2's role-opted exact nullable identity distinct from literal `default`; adopt
D2b's portable minimum; choose total ASCII JSON-lexical XML and the complete
CSV block-extra/empty-collection carriers; bind the complete supported Envelope
subject under unchanged V.13 source admission and Receipt5.5 precedence.**
This is proposal text, not an owner decision. No choice of old-regime support,
artifact retention, migration or npm version recommendation remains open.

The complete lawful domain remains the acceptance test: source routing must
cover last-current order/revision disagreement and history without loss;
model admission must cover every builtin/append/extension/history collection,
unknown outer and block members, absent/null/empty distinctions, finite binary64
numbers and valid Unicode. Raw JSON duplicate decoded names and XML lexical/
namespace/ZIP inventory/transport refusals need exact boundary text and independent
controls. An approved wrapper alone does not prove those obligations.

The new [independent portable proof](../../experiments/envelope-0089/portable-proof/README.md)
closes one missing control: five actual Python/Node subprocess tests agree on
seven existing complete examples and seven explicit minimum-value controls.
Literal expectations pin absent/null/authored metadata, exact payload members,
null/default/UTF16 identity and ordered/empty history. This is bounded projection
evidence, not complete source admission, authenticated-model validation or a
capability claim. No old authentication/codec matrix is rerun for compatibility.

The remaining implementation evidence is full current-domain schema/projection
and transport coverage, independent platform execution, and actual supported-
subject signing/receipt state-machine tests. The existing crypto proof establishes
byte binding only; candidate financial receipt issuance is still unimplemented.
These are engineering gates following the specific design choice, not a request
to preserve a prelaunch contract. RFC0085/0088 retain their separate ownership.

## Prior art

RFC0014 supplies the shared Envelope/fidelity/versioning contract; RFC0040 and
RFC0066 supply generic role routing. RFC8785 supplies canonical JSON, and RFC6901
supplies pointer escaping. Existing V.12 nullable monetary identity and VIII.12
exact variant references illustrate why authored identity cannot be replaced by
a display/default key. See the pinned intake for authoritative source links.
