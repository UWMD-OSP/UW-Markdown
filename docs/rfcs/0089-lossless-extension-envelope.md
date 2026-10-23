---
rfc: 0089
title: Preserve extension variants in a complete versioned Envelope
status: draft
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
The owner selected that design direction on 2026-10-17, **not final acceptance**.
This 2026-10-22 refresh makes the contract choices explicit against main
`9138f75b`; it replaces the earlier research diary, not the accepted specs.
**Draft only; no implementation or new wire label.**

Recommendation: retain the selected design below. Obtain the required **Chief
of Staff red-team before owner acceptance**, with particular scrutiny of D2's
source accounting, D4's full lawful domain and D5's authentication boundary.
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
RFC 0085 is still a separate draft about authority/compaction, not a prerequisite
or an accepted completeness claim.

## Proposed contract (conditional on acceptance)

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

The full Envelope preserves complete annotations, payloads, metadata, notes,
prose, outer block extras and unknown outer members, including absent/null/empty
and scalar-type distinctions. The portable minimum cannot reconstruct or
authenticate omitted values. No financial-role-selected view is model fidelity.

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

Synchronize Format mixed-identity wording, Protocol portable projection, public
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
| D1/D2 tagged exact identities | Retain owner-selected single/variants and null != default | Direction selected 2026-10-17; current peer loss reproduced; exact source/order/history fixtures required |
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

After acceptance update parser/types, Envelope and schema, portable subset,
source accounting, generic codecs and their mappings, document signatures,
receipts/rule-set identity and source-digest consumers in verify; core/starter
adapters and independent Python follow the same contracts. Add no vendor SDK or
financial engine dependency. Keep annotation/payload identity and metadata
admission separate from representation reconstruction.

## Alternatives considered

Variant-key maps collide null/default and payload-shaped labels. Selecting one
peer, aggregating payloads or moving active peers to history loses meaning.
Partial XML would narrow the full-fidelity promise; the owner selected a total
lexical carrier. Base64 is reversible but is not the selected lexical contract.
A portable parse minimum or raw signature success cannot stand in for complete
source/model admission. Historical dual-regime support is not required.

## Unresolved questions

No remaining product-choice menu: D1–D6 records the selected design and exact
current-main coordination. Final acceptance remains owner-gated after CoS
red-team and the explicit engineering evidence gates. Findings that expose a
new contract choice return to the owner; they are not silent codec discretion.

## Prior art

RFCs 0014/0040/0066 establish Envelope, generic roles and selection. RFCs
0084/0090 distinguish source authentication from validation inventories. RFCs
0088/0111/0123/0124 govern current receipt/rule-set precedence. Existing nullable
payment/variant identities show why exact authored identity differs from a
default lookup key. JCS, JSON Pointer and expanded XML namespace names retain
their existing standard meanings.
