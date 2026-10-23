---
rfc: 0085
title: Keep full records as verification subjects and remove destructive compaction
status: accepted
author: UWMD maintainers
created: 2026-10-14
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0085: Keep full records as verification subjects and remove destructive compaction

## Owner ruling — 2026-10-22 (sixth set)

Accepted as drafted by the owner, including option C+D for RFC 0085.
This PR records the ruling and implements the synchronized current contract.

## Summary and recommendation

Choose **C+D**: a full supplied record remains the verification subject; a
history-stripped display is a projection, never a substitute record. Remove the
record-producing `compact` API/command and history-omitting model export options.
Use existing analytical/render products for views. Define missing declared
predecessors as failed links and permitted manual replacement as a new root.
**Accepted by the owner, D1–D7 together; implemented in this PR.** This
2026-10-22 revision replaces the earlier menu of unresolved alternatives with
one bounded proposal against main `9138f75b`.

The owner previously preferred complete records as authority and stripped
outputs as projections. The fifth-set instruction requests decision-ready
recommendations; the sixth-set ruling accepts the bounded contract below.

## Motivation against current main

Format 2.7 still permits compaction of superseded blocks, while append-only
provenance and POL-02 require prior revisions for supersede-on-edit sources.
Current `compact` removes block ranges from the source without a log entry.
`export --no-superseded` and `toUWEnvelope({includeSuperseded:false})` also emit
history-stripped models under the ordinary record representation.

Current `verifyChain` checks parent equality only from the second visible block.
A read-only replay on current main reproduces `04-broken-chain.uwx.md` failing
INT-01, then returning `ok:true`, `chains_verified:1` after its predecessor is
stripped. A permitted manual `section_replace` produces a similar dangling
parent by the current editor rule; treating all such existing output as a bug
would change the contract. The new root rule below is therefore explicit.

These are scope/chain claims, not evidence that every unsigned history can be
authenticated. Raw-byte identity, semantic snapshot identity, block signatures,
chain links and editing-policy compliance remain different checks.

## Accepted change

### D1 — Full-record authority; views have no record verdict

Format 2.7 MUST say that verification of a supplied UWMD record uses its current
and retained prior blocks, with authored payloads, metadata and admitted prose.
A history-stripped view MUST NOT be advertised as that same record or as proof
of its historical validity. No stubs, log entries, bare hashes or exporter
signature substitute for an absent signed payload. POL-02 and INT-07 retain their
present meaning. This selects C+D without adding an archive-verification profile.

The producer/holder MAY keep the full source as an ordinary file or existing
package member. The verifier checks the exact full source it is given under
current contracts. A locator/digest is not availability or authentication. No
automatic fetching, archive splicing or new detached authority manifest is added.
No historical prelaunch retention/repair obligation is imposed.

### D2 — Remove record-producing compaction and stripping exports

Remove `uwmd compact` and the public `compact()` export from core's normal and
browser entry points. Keep `diff()` and `SectionDiff`; they do not erase history.
Remove `--no-superseded` from record export and `includeSuperseded:false` from
Envelope/representation projection APIs. Ordinary model-fidelity JSON/XML/CSV
exports MUST retain their complete supplied history. Explicit attempts to use
removed CLI options MUST refuse before output/write; do not silently ignore the
option and report success. There is no deprecated alias or transition path.

Existing `render`/report/context products MAY omit history for a declared
analytical view. They do not become lossless record encodings or historical
verification subjects. A `--compact` JSON whitespace flag or context profile
named `compact` does not strip record history and is not removed by name alone.
No new projection wire type, file suffix, artifact signature or Reader tier.
If a later exchangeable projection contract is needed, define its own RFC.

### D3 — Permitted replacement starts a new declared root

For `section_replace` permitted by the current source policy, an editor MUST
stamp the replacement's `parent_hash:null` when integrity is enabled: its prior
block is intentionally not in the new visible chain. Keep monotonic lifecycle
revision/provenance and existing INT-02 stale-parent precondition against the
prior head. A root's identity is its null link, not revision number 1.

`section_supersede` retains the prior payload and stamps its hash as parent,
unchanged. This does not permit replacement where `supersede_on_edit:true`;
POL-02 still applies. A replacement does not preserve the old snapshot signature,
and its block signature does not prove any discarded history.

### D4 — A declared but absent predecessor fails INT-01

Protocol V.10 MUST require the first visible block of a hashed chain to have a
null or absent `parent_hash` (both represent no declared predecessor). A non-null
parent at that boundary declares evidence the supplied chain does not contain:
emit **INT-01 error**, set that chain unverified, and do not increment
`chains_verified`. Existing interior mismatch, hash drift, partial hash,
signature and deprecated-algorithm findings remain independently evaluated.
No new code, exception for compaction, or warning-only success.

This is a visible declared-link check, **not proof of history back to real-world
origin**. A malicious party can delete evidence and manufacture a new unsigned
root; current snapshot signatures/trusted anchors are required to authenticate
collection membership. Do not relabel `chains_verified` as complete provenance.
No new `history_complete` boolean, trust-root inference or coverage counter.

### D5 — Source failure never becomes a projection verdict

A view of a failed source has no new verification result. Verify the supplied
full source and report its actual findings when a verification report is wanted.
Do not verify the filtered in-memory view as if it were the original. Without
the source, a historical assertion is not checked; that absence is not a clean
record verdict. No new archive status or RCP code is assigned. Existing APIs
still return their existing result structures for actual record inputs.

### D6 — Logging and authentication scope

Delete Format's compaction/log-entry promise and remove `compact` as an authored
pipeline-log event type in the same contract update. Display/export is read-only:
it MUST NOT append to the authority or reset its signatures. Keep existing
`export`/`render` event vocabulary and generic user-authored notes; no automatic
log is invented to cure missing history. Existing receipt, V.11 block-signature
and V.13 snapshot-subject rules remain unchanged. A receipt authenticates/checks
its actual subject/computation, not every event before the supplied snapshot.

### D7 — Current contracts only

Implement the synchronized Format/Protocol/schema/executable/conformance changes
under the sixth-set acceptance; allocate no version here. Prelaunch remains 4.x, all
packages launch at 5.0.0 only under separate owner approval. No old-reader
support, reissuance, migration, deprecation or artifact preservation work.
RFC 0089 remains an independent complete-model representation proposal; no need
to wait for it to remove destructive compaction or define root/link behavior.

## Decisions for owner acceptance

| # | Decision requested | Recommendation / reason |
|---|---|---|
| D1 | Authority and archive requirement | C+D; verify supplied full records, no separate archive protocol or mandatory external service |
| D2 | Command/output | Remove record compaction and history-stripping model options; keep clearly scoped analytical views |
| D3 | Manual replace | New null parent root; retain source policy, stale-parent precondition and revision provenance |
| D4 | Missing predecessor | INT-01 error; chain not counted verified; no claim of origin completeness |
| D5 | Failed source/view | No fresh view verdict; full source failure stays visible when that source is checked |
| D6 | Log destination | No compaction event/promise or automatic authority mutation; export/render remain read-only |
| D7 | Contract/version | Synchronized current change, no compatibility or release action |

## Conformance impact

Add controls for a valid null/absent root, non-null missing parent, interior
mismatch, partial-hash chain, signed payload removal, invalid snapshot signature,
manual replacement's new root and supersede's retained link. Assert exact
INT-01 severity, chain counters and independent signature counts; un-hashed
chains remain outside chain verification rather than verified history.

Actual CLI controls prove removed command/options refuse before write, existing
full model exports retain history and unchanged source bytes, and analytical
views make no record-verification claim. Cover both original and model source
exports and the browser API. Existing broken-chain expectations change only at
the explicitly governed missing-parent boundary; no broad baseline regeneration.
No new archive-schema, network or projection-verifier fixtures are required.

## Reference implementation

This implementation updates Format 2.7/command and pipeline-log vocabulary, Protocol
V.10/editor rules and mirrors, applicable schema enums/descriptions, `integrity.ts`
and independent Python chain checks. Update core `editor.ts` integrity stamping,
CLI command/flag admission, `compactor.ts` exports (retain diff), Envelope option
callers, package/browser exports, tests, docs/wiki and CHANGELOG in one PR.
Keep stale-plan/signature behavior and no-op chain counters explicit. No new API
or external dependency. Generic edit and source-integrity requirements remain.

## Alternatives considered

Metadata stubs preserve a commitment without the payload; treating them as
verified historical blocks weakens INT-07. Detached manifests move trust to the
compactor without proving missing payloads. A new archive/projection wire format
can be designed later but is unnecessary for removing today's overclaim. A
compaction log is unauthenticated and cannot waive POL-02. A missing-parent
warning would leave `ok:true` at the known gap. Declaring every revision>1 root
invalid would wrongly reject the permitted manual-replacement model.

## Unresolved questions

D1–D7 are accepted. The contract
intentionally adds no exchangeable projection/archive capability; that is a
future design task, not a permanent scope ban. Implementation must inventory
all history-omitting record serializers and prove the stated boundaries.

## Prior art

RFCs 0010/0031 define editing policy and block integrity; RFC 0084 defines guarded
snapshot authentication. RFC 0078 separates standard verification from starter
views. Current source: `compactor.ts`, `editor.integrity.test.ts`, `envelope.ts`,
`document-signatures.ts` and `integrity.ts`. The old research and earlier menu
remain PR history, not a prelaunch compatibility or preservation obligation.
