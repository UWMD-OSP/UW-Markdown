# Renamed identifiers: what issue #263 needs from the contract

- **Date:** 2026-10-04
- **Issue:** [#263](https://github.com/UWMD-OSP/UW-Markdown/issues/263) (StackUW `UPSTREAM-023`)
- **Base:** `main` at `83248a61af770221781a6504f9acddca579076d4`
- **Reproduction:** [`2026-10-04-renamed-identifiers.repro.mjs`](./2026-10-04-renamed-identifiers.repro.mjs)
  (run after `npm run build`; exits 1 if any finding stops reproducing)
- **Outcome:** draft [RFC 0073](../rfcs/0073-previous-asset-class-identifiers.md).
  Nothing normative changes in this review.

## The request

StackUW is retiring a product domain and wants to move its reverse-DNS ids to
a new namespace without making documents written under the old ids
unresolvable. The issue names three identifiers: the implementation manifest
`id`, module `id`s and module-declared asset-class ids. It proposes one
`previous_ids: string[]` field on both manifests, with resolution through a
previous id reported at info level.

The issue states that "a host that holds only the renamed module reports
`MOD-MISSING-001`" for an old document. For the issue's own example, that is
not what the contract or the reference library does (F1 below). The three
identifiers do different jobs, and only one of them is a document-resolution
key.

## What each identifier is today

### Asset-class id: the document's resolution key

- **Where it lives.** Frontmatter `asset_class` in every document
  (Format §2.2a), and each module's `declares_asset_classes[].id`.
- **What reads it.** Protocol §X.2.2 resolves a document's `asset_class`
  against the classes loaded modules declare: `resolveAssetClass` matches the
  declaration id exactly (`asset-class.ts:158-189, 282-290`). The module
  runtime chooses which modules run for a document by the same exact match
  (`module-runtime.ts:221-228`). The lake stores it as free text
  (`packages/uwmd-lake/src/schema.ts:67, 80, 103`).
- **Stability.** Format §2.2a: reverse-DNS "fixes ownership at the
  identifier, so two implementations can never disagree about whose
  `com.example.data_center` this is." §X.2.3 refuses two loaded modules
  declaring one identifier (`MOD-ASSET-CLASS-CONFLICT-001`) so resolution never
  depends on load order.
- **Not covered by.** Block signatures sign six fields, none of them
  frontmatter (Protocol §V.11.2). A receipt's `subject.digest` covers the
  whole document, so any rewrite of `asset_class` changes it.

This is the identity whose rename makes an old document read differently.

### Module id: a registry key and a locator, never a resolution key

- **Registry key.** `createModuleRegistry` keys `byId` on it and refuses a
  duplicate (`PROTO-MOD-066`, `modules.ts:219-239`).
- **Dependency key.** `depends_on` matches by exact id (`PROTO-MOD-027`
  missing, `PROTO-MOD-028` version mismatch; `modules.ts:687-701`).
- **Signed.** A module signature covers every manifest field except
  `signature` (Protocol §X.1.1), so a new id is a new signed artifact.
- **In documents, a hint.** Format §2.2a's `modules` list names "what
  declares" the class so a host "can say *what to load*." Its only consumer is
  a length check for `MOD-DEPENDENCY-UNDECLARED` (`validator.ts:3033`).
  Neither `modules[].id` nor `modules[].version` is compared with anything a
  host has loaded. RFC 0003's design text had a step 1 that "looks up the
  declaring module from the file's `modules` list", but the shipped §X.2.2
  resolves by class id alone, and RFC 0003's implementation note 5 keeps
  resolution apart from the file's own claims.
- **Not persisted elsewhere.** Receipts record no third-party module ids, and
  neither `_meta` nor `pipeline_log` names a module. The module id appears
  only in message text (`module-runtime.ts:65, 159-160, 183-184, 199`).
  Builtin calc packs are recorded by `pack` id in receipts, the lake and the
  Excel contract, but those are UWMD's own packs, not third-party modules.

### Implementation id: a self-description nothing resolves

- **Where it lives.** `ImplementationManifest.id` (Protocol §I.4), printed by
  `uwmd manifest` (`cli.ts:1945`). The reference library's id is
  `org.uwmd.core` (`protocol.ts:220`). The schema example says
  `io.uwmd.core`.
- **What reads it.** Only the conformance runner, which writes
  `"implementation": "id@version"` into its `--manifest-out` report
  (`conformance/runner/runner.py:419-423`). That report describes one run.
- **What does not.** Receipts name the engine by a free string that defaults
  to the npm package name (`receipts.ts:509-512`), not the manifest id.
  Verification compares the `(engine, engine_version)` pair exactly and
  attributes a disagreement only when both match (`receipts.ts:784-787`).
  Every release changes `engine_version` anyway. The envelope `generator`,
  block and module signatures, capability tokens and `_meta` do not carry an
  implementation id.

No document, signature or verification outcome depends on an implementation
id, so renaming one breaks nothing UWMD defines.

## Findings

Every finding reproduces with the script above on the base commit. The script
also prints R1, the related defect described under
[Related defects](#related-defects-found-on-the-way).

| # | Finding | Observed |
|---|---|---|
| F1 | Renaming only the module id leaves an old document resolved and its module calculations running. | `resolved`; one calc from the renamed module; no `MOD-*` validation code |
| F2 | Renaming the asset-class id is what breaks an old document. | `unresolved`, `MOD-MISSING-001`; no module calculations run |
| F3 | One module that keeps declaring the old class id beside the new one resolves both and runs the same calculations for both, on every current host. | both `resolved`; `MOD-DISPLAY-CONFLICT-001` (info) when the two share a display name, even inside one module |
| F4 | Under F3, nothing states that the two ids are one class. Each resolves to its own declaration and reports its own id. | old → old declaration, new → new declaration |
| F5 | A dependent module whose `depends_on` names the old module id refuses to load against the renamed module. | `PROTO-MOD-027` |
| F6 | Loading the old and new module together reports the double claim on the class. | `MOD-ASSET-CLASS-CONFLICT-001` |
| F7 | A manifest that carries any field today's schema lacks is refused whole. A renamed module that adds an identity field cannot load on any host older than the release that defines it. | `PROTO-MOD-064` |
| F8 | A host without the module holds no manifest, so a manifest-side mapping cannot reach it. The unresolved remediation can only repeat what the document states. | `MOD-MISSING-001`, remediation names the old class id |

Three regression tests in `packages/uwmd-core/src/asset-class.test.ts`
(*renamed identifiers under the current contract*) pin F1–F3, so an RFC
changes them on purpose.

## Answers to the issue's questions

**Does an old document stay resolvable after a namespace move?** Yes, today,
under two conditions. If only module ids move, nothing changes (F1). If
class ids move too, the new module must keep declaring each retired class id
(F3). Both work on every conforming host now, deterministically, with no
document byte changed.

**What does the current contract not do?** It cannot say that a retired class
id and its replacement are one identity (F4). A host resolving an old document
cannot report "resolved through a retired id", a consumer grouping documents
by class sees two classes, and the dual declarations can drift apart
(`required_sections`, `fallback`, `display_name`). That is a change to what
conforming hosts must do, so it needs an RFC: draft RFC 0073.

**Should one mechanism cover all three ids?** No.

- The asset-class id is the only one the protocol resolves a document by, so
  it is the only one where a compatibility rule can change a read. RFC 0073
  puts `previous_ids` on the `declares_asset_classes[]` entry, not on the
  manifest.
- A module-level field would serve two paths. The first is `depends_on`
  (F5), but a dependent is itself a versioned, signed manifest that names
  its dependency and is re-released to change it. The second is a
  document's `modules` hint, but a host without the module cannot read the
  mapping (F8), and a host with it does not need the hint to resolve. No
  demonstrated consumer needs either path. The one case that would change
  this is a host that chooses which installed modules to load from a
  document's `modules` list. The protocol defines no such selection, so
  whether StackUW's host does that is a question for the reporter.
- The implementation id is never resolved, persisted in a document, or
  compared in verification. An alias would have nothing to act on.

**Should re-export rewrite ids?** No host should rewrite an authored
`asset_class` or `modules` entry as a side effect. A producer that wants a
document to carry the new id writes it as an explicit frontmatter edit with
its own provenance. RFC 0073 makes this normative for its mechanism.

## Risks

- **Retired namespaces can be re-registered.** Reverse-DNS ownership follows
  domain ownership, and the protocol has no registry. After StackUW retires a
  domain, whoever registers it next could declare classes in that namespace.
  Two hosts holding different modules would then read an old document
  differently. That is true today for any retired namespace, with or without
  aliases. A host prevents it only by what it loads: signature policy and the
  identity allow-list (§X.1.4, §X.1.5). A previous-id claim adds no new
  capability, since an unsigned module can already declare someone else's id
  as its own current id.
- **Compatibility cost of a new field (F7).** Any manifest using RFC 0073 is
  refused by every host older than the release that defines it. Dual
  declaration (F3) loads everywhere today. A producer has to choose per
  release, and RFC 0073 requires a `requires_protocol` floor for the same
  reason RFC 0071 does.
- **Schema `$id`.** Normative schemas use flat
  `https://uwmd.org/schemas/<name>.schema.json` ids (`spec/schemas/README.md`).
  No module section fragment carries a `$id`, and no module publishes a
  schema keyed on its own id. A namespace move therefore has no `$id`
  consequence inside UWMD. A producer that publishes its own schemas under its
  old domain should keep those URLs or treat the new ones as new schemas.
  That is outside the protocol.
- **Package versus contract versions.** Document `modules[].version` and
  `depends_on` name the manifest contract version, not npm semver (wiki 11,
  *Independent versions and explicit loading*). A rename is a new contract
  identity, and its version line may restart or continue. Neither affects
  resolution, because `modules[].version` is never checked (above).

## Related defects found on the way

These are outside #263 and are recorded, not fixed, here.

1. **§VII.3 is not enforced (bug).** Protocol §VII.3 says that when two
   unrelated loaded modules declare the same section id, calculation id or
   view-model `section_id`, the host "MUST refuse to load the second one".
   `createModuleRegistry` refuses only duplicate module ids
   (`modules.ts:208-260`), and no conformance fixture covers the case. The
   repro's R1 loads two unrelated modules that both declare `dc_probe` without
   error. The module runtime then threads both results into one
   `prior_results` map by calc id (`module-runtime.ts:61-77`), so the later
   module's value wins by registry order. §VII.3 forbids exactly that.
   **Resolved on 2026-10-05** on branch `claude/vii3-module-conflicts`. The
   registry refuses with `PROTO-MOD-080`–`082` and applies dependent
   overrides, and `conformance/modules/registry/` pins all three namespaces.
   R1 in the repro now asserts the refusal.
2. **`MOD-ASSET-CLASS-CONFLICT-001` has no conformance fixture
   (conformance gap).** It is covered only by `asset-class.test.ts`.
3. **Editorial: fixed in this change.** The implementation-manifest schema
   description read `Â§I.4`, a double-encoded `§`. It now reads
   `§I.4`. The description is an annotation and changes no validation
   result.

## Questions for the reporter

These decide how much of RFC 0073 StackUW needs. They do not block the draft.

1. Do any StackUW modules declare custom asset classes, or do they only
   enhance builtins? `cc.underwriter.debt-senior.agency` contains a hyphen,
   which Format §2.2a's class grammar does not allow, so it cannot also be a
   class id. If no class id moves, F1 already covers the move.
2. Does StackUW's reader choose which modules to load from a document's
   `modules` list? If so, that selection is host behavior the protocol does
   not define, and it is where the reported `MOD-MISSING-001` would come from.
3. Is resolving old documents enough (F3), or does a consumer need the old
   and new class ids reported as one identity?
