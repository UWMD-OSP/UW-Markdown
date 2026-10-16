---
rfc: 0085
title: Keep verifiable provenance evidence when a record is compacted
status: draft
author: claude-code (agent proposal)
created: 2026-10-14
depends_on:
  - 0010
  - 0018
  - 0031
  - 0081
  - 0084
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0085: Keep verifiable provenance evidence when a record is compacted

> **Draft for owner review. No implementation.** This RFC records a normative
> inconsistency found by the
> [launch onboarding audit](https://github.com/UWMD-OSP/UW-Markdown/blob/main/docs/reviews/2026-10-14-launch-onboarding-audit.md)
> (D-09, §9 and §11). It compares four ways a compacted record could keep, or
> give up, trustworthy provenance evidence. Until it is decided, `POL-02`,
> `INT-01`, `INT-07`, `verifyProvenance`, `verifyChain` and `uwmd compact`
> keep their current behavior. Nothing here permits a dangling `parent_hash`
> or relaxes `POL-02`.
>
> The owner's provisional direction (§10) is that complete historical records
> stay the verifiable authority and history-stripped outputs are projections.
> It is recorded as a preference, not a decision; the RFC stays a draft.

## Summary

Format §2.7 and §6.5 say `uwmd compact` strips superseded blocks. Protocol §V
reports the result as a provenance violation (`POL-02`). Compaction also
removes integrity evidence: on a hashed chain that fails `INT-01`, the
compacted copy verifies clean. And the same dangling `parent_hash` that
compaction leaves is also produced by a permitted `section_replace`, which the
reference editor stamps with the discarded block's hash.

The RFC separates six properties a compaction design must answer for (§3).
It then compares four candidates against them (§4):

- **A.** In-document superseded stubs.
- **B.** A detached authenticated compaction manifest.
- **C.** Externally archived full-history records.
- **D.** Withdrawing `compact` as an operation that yields a verifiable
  document.

No candidate can be adopted without a normative decision. The narrow
fail-closed check investigated in §5 is likewise not available as an
implementation fix: existing requirements do not prohibit the current result,
and a spec-conforming editor produces the same shape legitimately.

## 1. Motivation

### 1.1 The two normative texts disagree

- Format §2.7: "The `uwmd compact` command strips superseded blocks and
  leaves only current versions." §6.5: "Removes all blocks where
  `_meta.lifecycle.superseded === true`. Preserves the pipeline log. …
  Appends a `compact` entry to the pipeline log."
- Protocol §V (`verifyProvenance`): "`POL-02 error`: `section_replace` used
  where the policy mandates `section_supersede` (heuristic:
  `_meta.lifecycle.revision > 1` with no superseded prior revisions
  visible)". This applies to every source whose policy has
  `supersede_on_edit: true` (`agent/*`, `document/*` and the catch-all,
  §V.3).

`examples/parkview-after-L6.uwx.md` verifies (exit 0). Its compacted copy
fails with `POL-02 [risk_assessment] … version 2 has no superseded prior
versions` (exit 1). Each implementation follows its own text. The one
implementation gap is that `compact` writes no `compact` pipeline-log entry,
which §6.5 says it does.

### 1.2 Compaction erases integrity evidence

`conformance/documents/malformed/04-broken-chain.uwx.md` fails `verify
--integrity --policy` with `INT-01 [property]: Block v2 of 'property'
parent_hash does not match prior block` (exit 1). After `uwmd compact`, the
same command prints `✓ OK — chains_with_hashes=1, chains_verified=1` (exit 0).
The surviving head is revision 2, and its `parent_hash` names a block that no
longer exists. Deleting superseded blocks by hand has the same effect.

### 1.3 What the current protection actually is

Each layer protects something different:

- **`POL-02` is structural.** It checks that superseded prior revisions are
  *visible*. A Format 3.0 reader also accepts a superseded block that carries
  only `_meta`. In a test on `parkview-after-L6`, a `risk_assessment`
  revision 1 elided to `_meta` parses, validates with warnings only, and
  verifies `✓ OK` with `POL-02` satisfied. That holds with or without an
  extra `_meta.lifecycle.compacted` member, which the reader ignores. So
  `POL-02` alone already accepts a payload-less prior revision on an unhashed
  chain.
- **Hash chains (`INT-01`, `INT-04`).** These detect reordering and drift
  where hashes exist. A fabricated block whose hashes were computed
  correctly passes them.
- **Block signatures (§V.11) bind a key to a `content_hash`, and the
  verifier requires the payload to be present.** "A drifted hash on a signed
  block escalates … on a signed one it means the content in front of you is
  not the content anybody signed" (`INT-07`). In a test on
  `document-signatures/01-valid` (three signed, hashed blocks), the
  superseded `operating_statement` revision was elided to `_meta`. The chain
  stays continuous (no `INT-01`), but the result is `INT-04 warning` plus
  `INT-07 error`, with `signatures_verified` falling from 3 to 2 and
  `ok: false`. **Today, stripping a signed historical payload is an error.**
  Any design that makes it pass weakens that guarantee unless the stripped
  revision is reported as something other than verified history.

## 2. Scope and invariants

- `POL-02` keeps its text and heuristic. No candidate may satisfy it with
  unauthenticated evidence that is cheaper to forge than what satisfies it
  today.
- A dangling `parent_hash` is never silently treated as a verified chain by a
  new rule. §5 explains why it cannot simply be turned into a failure either.
- Invariant 5 ("append-only provenance: supersede, don't destroy") and
  Format §2.7 ("history is always recoverable") bound every candidate.
- No new protocol field, finding code or conformance expectation is adopted
  by this draft.

## 3. Six properties

| # | Property | Question it answers |
|---|---|---|
| P1 | **Payload recoverability** | Can the original historical payload be read again? |
| P2 | **Commitment authenticity** | Is the retained `content_hash` of a removed revision attested by someone other than whoever compacted the record (for example, by the original block signature)? |
| P3 | **Payload verification against the commitment** | Can a verifier recompute the removed revision's `content_hash` from its payload? (`INT-04`, and `INT-07` for a signed block) |
| P4 | **Parent-hash chain continuity** | Does every `parent_hash` in the record resolve to a visible predecessor's `content_hash` (`INT-01`)? |
| P5 | **Document-level signatures after compaction** | Does an RFC 0084 snapshot signature taken before compaction still verify, and what is needed to authenticate the compacted record? |
| P6 | **Older Format 3.0 readers and verifiers** | What do today's readers and verifiers report for the compacted output? |

P2 and P3 are different properties. A signature authenticates a commitment
(P2). Only the payload proves that the commitment describes the content that
was there (P3). Today a full superseded block gives both. Every compaction
design gives up P3 inside the compacted record. The question is whether it
keeps P2, and where P1 and P3 move to.

## 4. Candidates compared

### 4.1 The candidates

**A. In-document superseded stubs.** Each removed revision is replaced by a
block carrying only its `_meta`: lifecycle with `compacted: true`,
provenance, `content_hash`, `parent_hash` and `signature`. To avoid weakening
`INT-07`, a stub must never count as verified history. It would be reported
with a distinct, non-passing status ("commitment only"). It would be excluded
from `chains_verified`, and its signature result would be reported as
commitment-authenticated only, never as `signatures_verified`. That requires
new finding vocabulary and an `INT-04`/`INT-07` exception for `compacted`
blocks, both normative.

**B. Detached authenticated compaction manifest.** The compacted record is
unchanged in shape (no stubs). The compactor emits a separate, signed
manifest, in the style of an RFC 0084 artifact. For each removed revision it
records section, revision, `content_hash`, `parent_hash`, the original
`_meta.integrity.signature` if any, and the semantic digest of the
pre-compaction snapshot. A verifier holding the manifest and a trusted key
for the compactor can account for the gap. A verifier without it sees exactly
what it sees today.

**C. Externally archived full history.** The full pre-compaction record is
kept, for example as an RFC 0018 package member linked to the compacted
record, or referenced by digest. Verification of history uses the archive.
The compacted record is a convenience copy.

**D. Withdraw `compact` as a verifiable-document operation.** `compact`
either stops writing `.uwx.md` records or writes output explicitly marked as
a non-record projection, like `export --no-superseded`. The full record stays
the record of truth. Format §2.7/§6.5 change to say so; `POL-02` and the
integrity rules are untouched.

### 4.2 Property comparison

| | Today (`compact` strips) | A. Stubs | B. Compaction manifest | C. External archive | D. Withdraw |
|---|---|---|---|---|---|
| **P1 recoverability** | Lost | Lost | Lost (manifest holds commitments, not payloads) | **Kept**, in the archive | **Kept**: the record is not compacted |
| **P2 commitment authenticity** | None (revision gone) | Original block signature retained; it attests the commitment only if verification is redefined for stubs. Unsigned stubs are self-asserted. | Compactor's key attests the manifest. Original block signatures can be carried, but their check needs the same redefinition as A. | **Full**: original signatures verify against archived payloads | **Full**: unchanged record |
| **P3 payload vs commitment** | None | None in the compacted record | None, unless the archive is also kept | **Yes**, against the archive | **Yes** |
| **P4 chain continuity** | **Broken**: dangling `parent_hash` passes silently (§1.2) | Restored in-document (stub supplies the predecessor hash) | Restored only for a verifier holding the manifest | Restored only for a verifier holding the archive | Unaffected |
| **P5 document signature** | A pre-compaction RFC 0084 signature fails (`INT-11`); the compacted record needs a new one | Same: stubs change the semantic snapshot (§V.13 covers history), so the compactor must re-sign | Pre-compaction signature verifies against the archived snapshot if kept; the manifest can carry it and bind the snapshot digest | Pre-compaction signature verifies against the archive | Unchanged |
| **P6 older readers/verifiers** | Read it. `POL-02` error for `supersede_on_edit` sources; dangling parent passes | Read it silently and ignore `compacted`. Unhashed: `✓ OK` (stub treated as full history, **an overclaim**). Hashed unsigned: `INT-04` warning. Hashed signed: `INT-07` error (fails closed) | Unchanged from today; the manifest is invisible to them (`POL-02` still fires; dangling parent still passes) | Unchanged from today for the compacted copy | Unchanged |
| **Weakens a current guarantee?** | — | **Yes**, unless stubs are reported as a distinct non-verified state (`INT-07` would otherwise stop catching removed signed payloads) | No for old verifiers; for aware verifiers it moves trust to the compactor's key | No | No |
| **Normative surface** | — | Format (stub shape), Protocol §V.10/§V.11 (stub semantics, new vocabulary), schema | Protocol (manifest artifact, verification rules), schema; possibly an RFC 0018 link type | RFC 0018 link type or digest reference; Format §2.7/§6.5 wording | Format §2.7/§6.5 wording only |

### 4.3 Observations

- **No candidate preserves P3 inside a compacted record.** Only C and D keep
  the payload anywhere, and only D keeps it in the record itself.
- **A is the only in-document option, and its P6 behavior is the riskiest.**
  Older verifiers would report an unhashed stubbed record as `✓ OK` with full
  history. That is an overclaim the new vocabulary cannot reach, because old
  verifiers do not know it.
- **B shifts trust rather than preserving it.** An aware verifier accepts
  the gap on the compactor's signature. That is a policy choice about who may
  destroy history, not evidence the history existed.
- **C and D preserve every current guarantee.** They differ only in whether
  a compacted convenience copy exists beside the record.
- **The dangling-`parent_hash` gap (P4, "Today") is independent of
  compaction.** It needs its own decision whichever candidate is chosen
  (§5).

### 4.4 Rejected outright

- **Letting `POL-02` accept a `compact` pipeline-log entry.** The log is
  unauthenticated, so anyone could append the entry. This weakens `POL-02`
  for every record.
- **An RFC 0084 snapshot signature alone.** It authenticates who assembled a
  snapshot, not that the edit policy was followed or that history existed.

## 5. Fail-closed investigation: a declared predecessor that cannot be found

The question was: without a normative change, do existing verification and
compaction requirements already prohibit an unqualified successful integrity
result for a chain whose declared predecessor is absent? Answered by reading
the texts and by a local experiment that was reverted and never committed.

**Spec text.**

- §V.10 defines `parent_hash` as "the `content_hash` of the block this one
  supersedes; `null` on a chain root". Format §3.4 and `uwmd-block.schema.json`
  say "null on a chain root".
- Rule 2 says "Each non-root block's `parent_hash` MUST equal the **prior
  block's** `content_hash`". It is silent when no prior block is visible.
- §V.10's editor rule says "The new block is then stamped with
  `parent_hash = prior.content_hash`". It does not exempt `section_replace`.
  §V.2 says `section_replace` discards the previous block and is permitted
  for `supersede_on_edit: false` sources such as `manual`.

The text therefore both implies that a non-null `parent_hash` declares a
predecessor, and requires a conforming editor to write a non-null
`parent_hash` whose predecessor it has just discarded.

**Implementation and tests.**

- `verifyChain` treats the first *visible* block as the chain root and
  never examines that block's `parent_hash`.
- `packages/uwmd-core/src/editor.integrity.test.ts` ("stamps content_hash +
  parent_hash when prior head is hashed") applies a `manual`
  `section_replace` to a hashed head. It asserts the new head's
  `parent_hash` equals the discarded block's hash, and that `verifyChain` is
  `ok: true` ("single-block chain — head only").

**Experiment.** I locally changed `verifyChain` to apply the existing `INT-01`
comparison to a root with a non-null `parent_hash`, which reads "null on a
chain root" as a requirement. Results:

| Suite | Result |
|---|---|
| reference conformance | 1,089 pass, 0 fail (unchanged) |
| portable driver (`--no-skip`) | 350/350 (unchanged) |
| `document-signatures/03-flip`, `05-delete-history` | would gain `INT-01`. Their expectations are `json-subset` with `ok: false` and exit 1, already failing on the document signature, so the expectations still hold |
| unit tests | **1 failure**: the editor test above, a legitimate `section_replace` |

**Conclusion.** Existing requirements do not prohibit the current
unqualified success. A spec-conforming editor produces the same shape
legitimately, and a reference test pins that it verifies. Making the check
fail closed would therefore change normative behavior:

- **Reusing `INT-01`.** No new code, but it changes `INT-01`'s meaning from
  "does not equal the prior block's hash" to also cover "names a block that
  is absent". It fails a legitimate replace on a hashed chain unless §V.10's
  editor rule changes (for example, `section_replace` writes
  `parent_hash: null` and starts a new chain).
- **A new code.** Adds to the finding vocabulary (`protocol.ts` registry,
  Protocol §III.6a/§V.10, `verify-codes`, lockstep invariant 7) and needs
  the same replace decision.
- **A qualified rather than failing result.** For example, not counting such
  a chain in `chains_verified`, or a distinct "predecessor not present"
  status. Either changes the `IntegrityResult` contract.
- **Schema.** No change is needed for any of these: the schema cannot express
  predecessor existence.
- **Conformance.** No current corpus expectation breaks under the `INT-01`
  reading. One reference unit test, and its §V.10 editor basis, must change.

None of these is done here.

## 6. Compatibility analysis

- **Format.** A stubs: a payload-elided superseded block is accepted, not
  refused, by today's reader (§1.3). The new member would be ignored by old
  readers, which is the P6 overclaim risk. B and C: no Format change to the
  compacted record. D: §2.7/§6.5 wording only.
- **Protocol.** A, B and §5 each add normative verification behavior and,
  except for the `INT-01` reading of §5, finding vocabulary. C needs at most
  an RFC 0018 link type. D needs none.
- **Versions.** Format 3.0, Protocol 4.1.0 and the published packages stay
  unchanged until a decision and a separately authorized release.

## 7. Conformance impact (for whichever candidate is chosen)

Fixtures with CLI verdicts and exit codes:

- a compacted `supersede_on_edit` record (today: `POL-02`);
- `04-broken-chain` compacted (today: `✓ OK`, the gap in §1.2);
- a signed history with a removed payload (today: `INT-07`; must remain a
  failure, or under A be reported as commitment-only, never verified);
- a `manual` `section_replace` on a hashed chain (today: `ok: true`, pinned
  only by a unit test; should move into the corpus once decided);
- per candidate: a stubbed record; a manifest-backed record with and without
  the manifest; an archive-backed package.

## 8. Reference implementation

Not started, by design. The touch points are `compactor.ts`, the UWX
validator, `integrity.ts` (`verifyChain`; `verifyProvenance` unchanged),
`editor.ts` (if the replace stamping changes), `protocol.ts`,
`spec/schemas/`, and the Format and Protocol texts, in one PR (invariant 7).

## 9. Unresolved questions (owner)

1. Which candidate: A, B, C, D, or C with D?
2. Is a compacted record ever a verifiable record (A or B), or always a
   convenience copy beside the record of truth (C or D)?
3. Should a `section_replace` on a hashed chain keep stamping the discarded
   block's hash (§V.10 editor rule), or start a new chain with
   `parent_hash: null`?
4. How should a non-null `parent_hash` with no visible predecessor be
   reported: an `INT-01` reading, a new code, or a qualified result (§5)?
   And with what severity?
5. Should `compact` refuse a section whose chain already fails `INT-01`?
6. Should `compact` write the `compact` pipeline-log entry §6.5 promises, if
   it survives?

## 10. Owner direction (provisional, not a decision)

On 2026-10-14 the owner stated a preferred direction. It is recorded here as
provisional. It does not accept this RFC or choose a candidate. It changes
no normative text, finding code, conformance expectation or implementation.

> Preserve complete historical records as the verifiable authority, and
> treat history-stripped outputs as projections rather than complete
> records.

If it is later confirmed, it bears on the analysis as follows:

- **Question 2** would be answered in the direction of C or D. A
  history-stripped output is never itself the verifiable record; the
  complete record is.
- **A and B** would no longer be ways to make a stripped record verifiable on
  its own. They stay in §4 as analysed alternatives and are not withdrawn.
- **Question 1** stays open between C, D, and C with D. The open part is
  whether a projection may travel beside the record, and how it is marked
  so that a reader cannot mistake it for a complete record. A marking that
  only a new member carries would be invisible to Format 3.0 readers (the
  same P6 risk as A). Not writing projections as `.uwx.md` records avoids
  that risk.
- **Questions 3–6 stay open.** The dangling-`parent_hash` reporting (§5)
  and the `section_replace` stamping are independent of compaction (§4.3).
  The verify result for a projection still has to be defined.

Until a decision, nothing changes. `POL-02` keeps reporting compacted
output, `uwmd compact` keeps its current behavior, and Format §2.7/§6.5 are
unedited. If the direction is confirmed, the next step is a revision of this
RFC that specifies the chosen C/D variant concretely (projection marking,
Format §2.7/§6.5 wording, the §7 fixtures) for acceptance. Implementation
would follow in one PR (§8).

## 11. Concrete C+D assessment for owner review — 2026-10-15

**Recommendation, not acceptance or implementation.** Prefer C+D: retain the
complete record as the verification subject and produce a separately identified
history-stripped projection. This section specifies the consequences that an
accepted design would need to address. All proposed obligations below remain
conditional; current Format3.0, Protocol4.1.0, receipts and conformance are unchanged.

### 11.1 Authority and the scope of “complete”

The proposed authority is the retained snapshot with its actual payloads,
superseded blocks, variants, metadata, relevant section prose and pipeline log.
Preserve the source bytes as an archive artifact; additionally identify the
existing canonical envelope digest where semantic authentication is intended.
A raw-byte hash and the envelope semantic digest are different commitments and
must be named separately. No new digest algorithm or canonicalization is proposed.

“Complete” cannot mean proof of every event before the record was obtained.
An unsigned archive can be internally consistent without proving an originator
created it; a signed snapshot authenticates its signer's chosen collection,
not unknown pre-snapshot history or compliance with every editing policy.
Protocol V.11's block signatures do not authenticate collection membership,
frontmatter or lifecycle; V.13 snapshot authentication covers that separate scope.
Authority therefore identifies the retained subject, not a blanket verified
verdict. Required historical evidence, known chain roots and authorized manual
replacement still need an explicit contract. Preservation alone does not make
an invalid source pass.

### 11.2 Candidate obligations and their exact layers

If the owner selects C+D, the acceptance-ready revision should express the
following obligations in the indicated contracts, with compatibility reviewed:

| Candidate requirement | Contract consequence and layer |
|---|---|
| A stripped projection must not stand in for the complete verification subject | Format2.7 must distinguish retained-record recoverability from projection; Format6.5 must withdraw the implication that stripped output is an equivalent authoritative record. Starter command/output migration is a separate package concern |
| A projection must identify its source snapshot and omitted scope before any archive-backed claim | Decide a separately typed artifact/manifest and an authenticated source binding; a new optional lifecycle flag alone is insufficient because Format3 readers ignore it. A filename or banner alone cannot authenticate a claim |
| Historical verification must use the supplied full record and state its scope | ProtocolV.10/V.11/V.13 must distinguish visible chain checks, block signatures and snapshot authentication from a new claim of historical completeness. Decide result vocabulary, counters, applicability and severities explicitly |
| Missing archive material must not be represented as verified historical evidence | Define the new capability's unavailable/unsupported result, not success or a silently fetched substitute. Existing receipt RCP codes do not automatically become archive/integrity codes |
| A failed authoritative source must remain failed when a convenience view is emitted | No clean projection verdict may erase the source failure. Any proposed export precondition/refusal or accompanying evidence is a governed decision, not a new current validator rule |
| Original payloads and signatures must remain available in the authority | No metadata-only stub or retained hash substitutes for payload recovery or signature verification. No exemption from current POL-02/INT-07 follows from an export log |

These are proposed requirements for an accepted revision, not normative text
adopted by merging this draft. Field names, schemas, codes, severities and profile
requiredness are deliberately not assigned here. A projection container/extension
must be selected before spelling a Format migration. Prefer an artifact that old
UWMD readers cannot mistake for a normal authoritative record; merely adding an
unknown member to a parseable `.uwx.md` leaves the current overclaim possible.

### 11.3 Missing predecessors: separate the cases before choosing a verdict

| Case | Current evidence | Decision needed for a proposed stronger claim |
|---|---|---|
| Two visible hashed revisions with mismatched link | V.10 / INT-01 already rejects the link | Preserve existing failure; stripping the earlier row cannot prove repair |
| First visible block names an absent predecessor after stripping | Current verifyChain does not compare that first parent | Decide unavailable-history versus invalid-chain semantics and result/counter scope; current `chains_verified` must not be silently reinterpreted |
| Permitted manual `section_replace` discards a hashed predecessor | V.2/V.10 and editor.integrity.test.ts permit/stamp this shape | Retain the existing behavior or govern a new chain-root/boundary representation and migration. Do not classify every absent parent as corruption |
| Authenticated archive supplies the exact missing source | Proposed C capability only | Verify the archive under its own digest, chains, policy and signatures, then report which subject was checked; do not splice blocks into the projection and call it the original source |
| No parent hash or no hashes anywhere | Current integrity opt-in/no-op behavior | Absence of an integrity error cannot establish complete history or authenticated origin; stronger history claims need their own applicability rules |

A source binding should be immutable to a specific snapshot, not a mutable URL
or “latest” revision. An archive that cannot be supplied remains unavailable;
a digest proves neither availability nor recoverability. Recommend host-supplied
archive material with no automatic network retrieval. Authentication/trust of
that binding and verification-key distribution remain separate inputs. This
avoids inventing a new network dependency for ordinary verification.

### 11.4 Signed history, snapshots and receipts

Retain every historical signed payload, its signature and the key identifier in
the authority. With no signing backend/key store, preserve present-but-unchecked
reporting; an archive does not confer signing capability. Current INT-06 unknown
key, INT-07 invalid signature/drift and INT-08 deprecation distinctions stay intact.
Removing payload from a signed block cannot be labeled verified attribution.
Current six-field block signatures omit `parent_hash`; they cannot independently
prove chain membership or absence of omitted predecessors.

A pre-projection V.13 document signature belongs to its original envelope. When
superseded history is removed, that semantic subject changes; do not transfer the
signature as authentication of the new view. A new exporter signature, if later
defined, authenticates that exporter and projection subject; it does not recreate
original signatures, prove missing history or cure a source policy failure.

UW Receipt §3.1's `uw-envelope-semantic` subject also includes superseded history.
A receipt over the authority remains attached to that subject. It cannot become
a receipt over the stripped view merely because displayed calculations agree.
A newly computed receipt over any eligible new subject must follow the existing
receipt contract and identify its actual subject/engine; it still does not certify
historical completeness. No receipt version, engine identity, digest, result
status or signature interpretation changes are authorized by this draft.

### 11.5 Compaction and migration choices still requiring approval

Recommend a separate projection output that does not overwrite the retained
record. Decide whether `uwmd compact` is deprecated/refused, renamed, or retained
as an explicit projection exporter. Altering its existing output/exit behavior
needs starter compatibility treatment, not a hidden patch. Keep source bytes,
row ordering, current values, variants and original diagnostics intact in the
retained authority. Do not synthesize prior payloads or reset links/signatures.

Format6.5's promised `compact` log entry is a pre-existing implementation gap,
separate from the unresolved history design. If the command survives, specify
which artifact receives an entry, whether that changes the authoritative snapshot,
and when any snapshot signature is created. Appending a log changes that semantic
subject; it must not mutate an already signed archive invisibly. A log entry is
not proof of recovered history and must not waive POL-02. Any bounded logging fix
should preserve these distinctions and be reviewed separately from a new contract.

Before acceptance, propose exact Format2.7/6.5 wording, Protocol result scope and
any schema/capability additions together. Add explicit new conformance cases for
supplied/missing/wrong archives, signed/unchecked/invalid history, retained source
failure, legitimate manual replacement, projection/record distinction and older
reader refusal. Preserve existing baselines until those decisions are approved.
No changed expectation is included in this investigation PR.

Owner decisions remain: C/D selection and projection artifact; authenticated
source binding and availability; manual-replace/root treatment; missing-history
result/severity/counters; command compatibility and log destination. These are
separable from RFC0086's purchase-price comparison and RFC0087's revenue basis.
Keep all three RFCs draft. Resolve this contract before advertising stripped
outputs as fully verified historical records for public launch; it is not a
reason to relabel the already verified4.3.0 publication as failed.

## Prior art

- Git shallow clones and grafts keep commit identity while dropping history
  (P2 without P1 or P3).
- Certificate Transparency proves inclusion without the full log, because a
  log operator's signed tree head stands in for the entries (B's trust
  shift).
- Append-only archives keep the full record (C and D).


## Investigation evidence and limits

The merged [post4.3 review](https://github.com/UWMD-OSP/UW-Markdown/pull/353)
reproduces both existing observations on exact released commit `80c68c3d`:
`04-broken-chain` fails INT-01 before stripping and passes the current visible
chain check afterward; Parkview's retained source passes policy and its stripped
view fails POL-02. Neither result establishes a new accepted completeness rule.
The read-only probe preserves original bytes/current payloads and observes that
the current compactor adds no pipeline entry. Existing V.11/V.13 and receipt
subject requirements, the manual-replace regression and older-reader treatment
of unknown lifecycle members are the authority for the distinctions above.

This update changes draft analysis, indexes and documentation only. It adds no verifier,
compactor, schema, receipt, metric or baseline change. No new cryptographic
interoperability or independent-consumer pass is claimed. Documentation/index
checks for this exact update are recorded on PR #335; all proposed new
conformance controls remain future acceptance work, not regenerated fixtures.
