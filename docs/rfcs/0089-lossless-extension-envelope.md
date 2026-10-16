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

## Motivation

[Issue #365](https://github.com/UWMD-OSP/UW-Markdown/issues/365) records a joint
contract gap. Format §2.8/RFC0040 collect all active named variants of a
role-opted section, including `x_` extensions. RFC0066 confirms that generic
routing. Format §4.21 places extensions in `parsed.extensions`. But RFC0014's
Envelope 1.0 type and schema permit only a single block at `extensions[id]`,
while `sections[id]` already permits variant maps. Selecting an arbitrary peer,
aggregating payloads or filtering the document loses admitted content and
changes its complete semantic commitment.

The requested [read-only intake in the existing Reader review](https://github.com/UWMD-OSP/UW-Markdown/blob/c8a7457510eea154a4aa86230b07f914550b80b0/docs/reviews/2026-10-15-python-reader-354.md#2026-10-16--issue-365-joint-representation-rfc-intake)
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

### D3 — Payload and model fidelity

Preserve complete annotations, complete fenced payloads (with `_meta` exactly
once), `_role`, ordinary members named `content`, `_notes`, `_overrides`, exact
per-block prose, scalar types, absent/null distinctions and unknown top-level
Envelope members. No metadata defaults or financial facts are added. The role
annotation belongs to content and keeps its existing integrity meaning.

Do not put extension peers into `sections`, turn them into a financial aggregate,
move active peers into history, or advertise an analytical view as lossless.
The new shared type/schema and all model-fidelity codecs must agree. There is
no live implementation or schema allowance in this draft.

### D4 — JSON, XML and CSV

| Representation | Proposed consequence |
|---|---|
| JSON | Serialize the new Envelope directly; validate the tagged union, identity agreement, uniqueness and canonical ordering before trusting a stamped digest. Unknown top-level/content members remain preserved. |
| XML | Carry the same typed object/array tree and null identity. Update the mapping's Envelope admission/version relationship and semantic checks. The generic typed XML mechanism can carry it, but existing Envelope1 validation cannot be bypassed. A namespace or XML codec version change is assessed independently. |
| CSV bundle | Update extension enumeration/reconstruction, not only the shared schema. Block pointers become `/extensions/<escaped-id>/block` for single mode and `/extensions/<escaped-id>/blocks/<ordinal>/block` for variants. `variant` is an exact JSON string or null and `ordinal` is the canonical variants-array index; a singleton has no ordinal. RFC6901 escaping applies to the section-id pointer segment. |

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
make ordinary model fidelity complete. Supporting multiple regimes or negotiating
Envelope versions would require a separately specified capability/binding
contract; this draft introduces neither. MCP conversion still decodes once
through the shared model rather than selecting a peer per consumer.

#### Candidate wire examples (not admitted representations)

The full synthetic JSON semantic values are frozen in
[`candidate-preimages.json`](https://github.com/UWMD-OSP/UW-Markdown/blob/52c699ffe6bbb166310005be7bdc32960d6f80d1/experiments/envelope-0089/candidate-preimages.json).
`candidate-mixed` contains this entry spine; `A` and `B` below denote the complete
unchanged block values in that file, not literal JSON members or wire aliases:

```text
extensions.x_review = {
  mode: "variants",
  blocks: [ { variant: null, block: A },
            { variant: "default", block: B } ]
}
A.annotation = { section: "x_review" }
B.annotation = { section: "x_review", variant: "default" }
```

The proposed XML subtree carries the same tag, ordered records and exact null.
The comment stands for the complete typed block subtree, not an omitted value
permitted in an exchange artifact:

```xml
<uw:extensions uw:type="object">
  <uw:x_review uw:type="object">
    <uw:blocks uw:type="array">
      <uw:item uw:type="object">
        <uw:block uw:type="object"><!-- complete block A --></uw:block>
        <uw:variant uw:type="null"/>
      </uw:item>
      <uw:item uw:type="object">
        <uw:block uw:type="object"><!-- complete block B --></uw:block>
        <uw:variant uw:type="string">default</uw:variant>
      </uw:item>
    </uw:blocks>
    <uw:mode uw:type="string">variants</uw:mode>
  </uw:x_review>
</uw:extensions>
```

This is a subtree sketch using the accepted typed-tree mechanism, not a claim
that existing XML1 accepts E_NEXT. The full document requires the independently
approved root version/namespace relationship and every required model member.
A nested annotation member named `variant` is separate from the record identity;
null identity leaves that annotation member absent.

Candidate `blocks.csv` rows for the same two blocks are below. Append the proposed
mode column to the existing six columns; preserve JSON-cell lexical rules. Every
record ends CRLF, all cells are quoted, and no extra space is part of a cell:

```csv
"block_ref","collection","section_json","variant_json","ordinal","state","extension_mode"
"/extensions/x_review/blocks/0/block","extensions","""x_review""","null","0","current","variants"
"/extensions/x_review/blocks/1/block","extensions","""x_review""","""default""","1","current","variants"
```

For `single`, use `/extensions/x_review/block`, empty ordinal and `single` mode.
Proposed `variant_json` on a current extension row is its exact annotation variant
or null, including single mode; this explicitly changes Envelope1's extension
row rule, which always uses null. Rows for `superseded` retain their existing
state, historical ordinal, pointer and null variant descriptor; their exact
annotation lives in `block_values.csv`. `extension_mode` is empty on those rows
and all non-extension rows. Do not conflate history order with variants order.
The remaining required typed rows, prose, document members and manifest inventory
must still be complete. These three descriptor rows are not a standalone bundle.

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

### Independent versioning and migration

| Surface | Required assessment before acceptance/release |
|---|---|
| Envelope | A new container version is required for D1; do not widen Envelope1 in place. |
| Format | Named-peer legality is already accepted. Assess D2's explicit mixed-identity clarification separately; if it changes admitted document meaning/routing, revise/version Format with Protocol accounting. A container stamp alone does not automatically bump Format. |
| Protocol | Projection/verification and commitment regime references must change coherently, with the appropriate Protocol version; package semver alone is insufficient. |
| Receipt/signature | Select the canonical subject regime and supported-version schema/constants explicitly; independent wire-artifact version changes depend on the chosen fields, not copied Envelope numbering. |
| Codec/bundle/package | Independently version breaking mapping/type changes and exact dependent package pins. Assess XML namespace separately from its model admission. |
| Release placement | Preserve the existing public5.0 launch reservation. A breaking interim change cannot be mislabeled as a compatible4.x minor. Owner must choose approved release placement or defer implementation. No version is selected in this draft. |

The pre-release proposal is a clean break: no old-version reader, compatibility
shell, dual-hash fallback, grandfathering period or migration shim. Existing
archived subjects and expected results remain immutable evidence. An owner who
chooses to regenerate a representation issues a new artifact after reviewing
its complete retained content and new identity, and separately issues any new
receipt, signature or binding plan. Conversion/reissuance is not verification
of the old signature and does not rewrite its historical subject. Never turn
an already lossy old Envelope into supposedly recovered peers; return to the
original source or a complete attributable archive. No automatic historical
receipt or fixture regeneration is authorized.

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
| Cross-version `envelope1-rejects-new` | The pinned Envelope1 contract rejects the candidate new stamp/shape; no 1.0 decoder extension or fallback is added. New readers refuse unsupported legacy regimes under the clean break. |
| Cross-version `subject-stamp-only` | A formerly representable singleton/no-extension document has new canonical bytes/digest from E_NEXT; retain both independently frozen historical and candidate subjects. |
| Cross-version `receipt-signature-states` | Unsupported signature subject→INT-14; same-regime subject mismatch→INT-11; differing receipt canonicalization with disagreeing source digests→RCP-10, separately from engine RCP-07. Never compare/relabel across regimes as an old verified artifact. |
| Cross-version `other-commitments` | Unchanged block, block-signing and V.12 subjects; stale whole-source draw plan refused. Financial result commitments have independent controls and no regenerated expected arithmetic. |

### Frozen candidate subjects and fixture procedures

The [experimental evidence README](https://github.com/UWMD-OSP/UW-Markdown/blob/52c699ffe6bbb166310005be7bdc32960d6f80d1/experiments/envelope-0089/README.md)
provides five bounded candidate preimages and independent Python/Node rechecks.
The only selected version string is the design token `E_NEXT`; every candidate
stamp is deliberately unsupported today. These are design evidence, not approved
conformance or production canonicalization. ASCII-only evidence does not prove
non-ASCII ordering, floating-point serialization, source routing or codec
conformance. It does independently show that a stamp-only change moves an
extension-free subject and that one-peer `single` and `variants` have different
subjects even with the same underlying block.

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

Cross-version fixtures preserve original artifacts byte-for-byte and name the
old/new supported-regime assumptions. Pair an old and candidate no-extension
subject to isolate the stamp effect. For receipts, test version-only difference
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

## Reference implementation

Implementation is blocked on owner design/version approval. The later bounded
implementation must update `packages/uwmd-verify/src/{types,parser,envelope,
uwjson,uwxml,uwcsv,codec,integrity,receipts,protocol}.ts` as applicable, the shared
schema and mapping specs, consumer adapters and the independent Python projection.
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
5. **Dual old/new readers or automatic receipt/plan rehashing:** conflicts with
   the clean-break proposal and confuses a new artifact with historical proof.

## Unresolved questions

| Owner decision | Proposed answer; not accepted |
|---|---|
| Exact minimal extension shape | D1 tagged single/variants entries with identity-bearing records; no unrelated collection rewrite. |
| Mixed unlabelled/named admission | D2 preserves the opted-in unlabelled peer as exact null, distinct from literal `default`; assess Format implications explicitly. |
| Version/regime labels and release placement | Select independent Envelope/Protocol/Format-if-needed/codec/canonicalization/package accounting after design approval; retain5.0 launch reservation. |

No expansion of V.13 authentication admission is proposed. RFC0085 compaction
and RFC0088 numerical determinism remain separate drafts; this RFC accepts neither
and requires neither a financial kernel nor a new receipt arithmetic rule.

## Prior art

RFC0014 supplies the shared Envelope/fidelity/versioning contract; RFC0040 and
RFC0066 supply generic role routing. RFC8785 supplies canonical JSON, and RFC6901
supplies pointer escaping. Existing V.12 nullable monetary identity and VIII.12
exact variant references illustrate why authored identity cannot be replaced by
a display/default key. See the pinned intake for authoritative source links.
