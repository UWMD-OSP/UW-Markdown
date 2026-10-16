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
> The owner subsequently authorized a concrete C+D proposal (§12). This is
> design direction, not RFC acceptance; the RFC stays draft.

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

The current acceptance proposal is C+D in §12, including a closed projection
artifact, scoped results, archive procedure and explicit compatibility decision.
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

## 9. Earlier investigation questions (historical)

The owner has now directed the concrete C+D proposal in §12. These earlier
questions are retained as the investigation history; §12.9 is the current
acceptance decision list. None is accepted by that direction alone.

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


## 12. C+D acceptance proposal

**Draft proposal only.** The owner has directed development of C+D, not accepted
this RFC. This section is the proposed design for acceptance; §§1–11 retain the
investigation and alternatives. Candidate requirements in this section would
become obligations only through explicit acceptance and the governed contract
update. No current file, verifier result, fixture or compactor behavior changes.

### 12.1 Authority and assurance boundaries

The **retained source** is the exact supplied structured Markdown snapshot,
including every historical payload, original signature, provenance member,
variant, collection and retained prose. Projection creation MUST leave it and
its detached artifacts byte-for-byte unchanged. It MUST NOT reset parent hashes,
rewrite metadata, synthesize prior payloads or re-sign historical blocks. The
source must be retained outside the projection; the projection cannot recover
omitted payloads. No universal claim about unknown events before the supplied
snapshot is possible.

Use four separate claims, never one unqualified “verified record” badge:

1. **Raw identity:** SHA-256 of the exact source bytes, including encoding/BOM,
   line endings and final newline. A matching digest proves equality to that
   commitment, not who made it or when the bytes existed.
2. **Semantic identity:** existing `uw-envelope-semantic` version `1.0`, computed
   from the complete source envelope. It includes superseded history and
   metadata; it is not the raw-byte digest. Equivalent serialization can share
   this identity while failing a raw commitment.
3. **Authentication:** existing V.13 authenticates the semantic snapshot under
   a deployment-trusted key. V.11 independently authenticates individual block
   signing inputs. Neither an untrusted digest nor a self-supplied public key
   confers trust. V.13 does not authenticate exact serialization bytes; V.11 does
   not bind `parent_hash`, collection membership or lifecycle metadata.
4. **Continuity:** checked links and required evidence in the stated retained
   scope, separately from authentication and from provenance-policy compliance.
   No hashes means no continuity evidence. A snapshot signature alone neither
   repairs a broken link nor proves that all historical events were recorded.

The authority can fail verification. A successfully generated view MUST NOT
remove or downgrade failures found in the source. Financial computation and
receipt verification remain independent of these four claims.

### 12.2 Projection representation, version 1

Propose a new **artifact**, not a new structured-document representation:

- Conventional suffix `.uwproj.json`.
- Proposed media type `application/vnd.uwmd.history-projection+json` (not a claim
  of registration); MUST NOT use `application/vnd.uwmd.document+json`.
- UTF-8 JSON with duplicate object members refused. Every object below is closed;
  unknown members, kinds, versions, transforms and encodings refuse. No YAML
  frontmatter, top-level `uw_version`, `format_version`, `envelope_version` or
  valid Document Envelope is permitted. Nested Markdown is base64, not raw
  fences or a nested envelope that a generic reader can automatically ingest.

Illustrative values below are placeholders, not a fixture:

```json
{
  "kind": "uwmd-history-projection",
  "projection_version": "1",
  "authority": "projection",
  "source": {
    "raw_sha256": "sha256:<64 lowercase hexadecimal digits>",
    "semantic_subject": {
      "representation": "uwx-markdown",
      "representation_version": "1.0",
      "canonicalization": "uw-envelope-semantic",
      "canonicalization_version": "1.0",
      "digest": "sha256:<64 lowercase hexadecimal digits>"
    }
  },
  "view": {
    "transform": "omit-superseded/1",
    "encoding": "base64",
    "bytes": "<canonical padded RFC4648 base64, no whitespace>",
    "raw_sha256": "sha256:<64 lowercase hexadecimal digits>"
  }
}
```

All displayed members are required. Hashes are SHA-256 of bytes and use the shown
lowercase-hex spelling. Base64 is canonical RFC4648 with required padding where
applicable; decoding/re-encoding MUST reproduce the input string exactly. The
view decodes to well-formed UTF-8. There are no URIs, mutable “latest” selectors,
embedded source archives, signatures or asserted successful verification results.
The projection's own byte digest is external, not a self-referential member.
Source paths and signature/archive attachments are explicit verifier inputs.
Compute the semantic subject by the fresh guarded source projection in V.13.2
(the existing `resolveDocumentSigningSubject` path), not a filtered/caller-made
envelope. Retain its exact canonicalization scope, including its exclusion of
trailing Markdown after the final section; the raw commitment covers those bytes.
An existing semantic signature does not authenticate the projection's raw digest.
A deployment requiring authenticated exact serialization must supply a trusted
expected raw commitment out of band; self-declared manifest hashes do not satisfy
that requirement. Version1 does not invent a raw-byte signature mechanism.

**Existing-reader barrier:** the artifact has no Format3 frontmatter and lacks
the required Document Envelope versions/collections. Existing conforming Format3
Markdown and UW JSON readers MUST refuse this *whole artifact*, even if renamed
`.uwx.md` or `.uw.json`. The current reference readers do so; the design probe
below demonstrates their existing refusals. This is a structural barrier, not a
filename convention or ignored `_meta` flag. An application MUST NOT unwrap the
view and silently feed it into its ordinary record-verification path.

An adversary can always decode a view and fabricate another Format3 file. No
new container can make old readers detect that reconstruction. The guarantee
covers the unmodified projection artifact and compliant ingestion; externally
trusted source commitments/authentication and scoped continuity results address
claims about selected records. Do not promise retroactive detection by old readers.

**Deterministic transform:** `omit-superseded/1` accepts one immutable, well-formed
UTF-8 structured source passing the existing V.13.2 guarded projection, with unambiguous block boundaries and agreeing fence/meta
section, variant and supersession identities. Remove every full physical line
span from an ordinary superseded block routed to the envelope's `superseded`
collection, from its opening fence through its closing fence, including
the closing line terminator if present. Keep append-only pipeline/custom collections even when an item has a lifecycle
superseded flag; do not infer ordinary section supersession for them. Keep all
other bytes in their original order, including adjacent blank lines, CRLF/LF, current payloads, signatures,
provenance, pipeline log, prose and final newline. Do not trim, normalize, sort,
merge or reserialize. An ambiguous/malformed source is not transformable; report
`unverifiable / source_not_transformable`, not an inferred repair. A parseable
source's integrity/policy failure is not hidden: diagnostic projection creation
may succeed, but verification reports those failures separately. With no removed
blocks, view bytes equal source bytes; the wrapper remains mandatory.

This is deliberately a new transform, not a promise to reproduce the legacy
`compact` helper's adjacent-blank-line deletion. It implements no financial
calculation and adds no `compact` pipeline entry to either artifact. An export
must not mutate a signed authority merely to log that it was viewed; a host can
keep an external activity record without upgrading that record into proof.

### 12.3 Proposed capability and result contract

Add optional Integrity-profile capability `history-evidence-verification`.
Reader/Verifier tier conformance alone MUST NOT imply it. Implementations not
advertising it keep their existing behavior and cannot claim this scoped check.
Propose a separate result/API, not a changed meaning for `IntegrityResult.ok`,
`chains_verified`, INT-01/04/07 or POL-02. A future schema would be closed and
versioned as `history_result_version: "1"`. Root members would be
`kind: "uwmd-history-evidence-result"`, `history_result_version`, `subject`
(`kind: "record" | "projection"` and exact input `raw_sha256`), `source_subject`
(the source binding from §12.2, or null when unavailable), and the axes below.
Each check carries its state, applicable reason, exact subject/scope and ordered
findings; unavailable computed identities are null, not guessed. Per-chain
items carry the chain key, block locators, state and reasons. No financial
results or receipt status are folded into this object.

It includes these required axes:

| Axis | Allowed states and exact claim |
|---|---|
| `projection_derivation` | `matched`, `failed`, `unverifiable`, `not_checked`, `not_applicable`. `matched` means the decoded view and digest exactly equal the specified transform of the supplied source, never “equivalent verified record”. `not_applicable` only for a direct record subject |
| `source_identity` | `matched`, `failed`, `unverifiable`, `not_checked`, `not_applicable` (direct record without an external expected commitment). `matched` requires both raw and full semantic commitments to match the supplied source; a self-declared commitment is labeled as such, not authenticated origin |
| `source_authentication` | Existing V.13 result unchanged (`verified`, `unsigned / missing_signature`, `failed`, `unverifiable`), or an outer `not_checked / not_invoked` marker if this check was not invoked. For a direct record this still names that record; for a projection it names the supplied source, never the view |
| `retained_continuity` | `verified`, `failed`, `unverifiable`, `not_checked`. Scope is exactly `retained-history`; includes ordered per-chain results and their source raw/semantic identities |
| `archive_assisted_continuity` | Same four states plus `not_applicable` when no missing predecessor needs archive evidence. Scope is `archive-assisted-history`; never replaces the retained-local result |
| `source_checks` | Existing structural, integrity/signature and provenance-policy results, with their original codes, severities, counters and subjects. Missing requested checks are explicitly `not_checked` |
| `archive_evidence` | Ordered results for each supplied archive: its raw/semantic identities, authentication result, own source checks and exact block locators used or refused |

A direct record always has computed subject identifiers; without supplied
expected commitments its identity comparison is not applicable, not a comparison
against itself. A projection always requires comparison to its embedded source
commitments and never uses that exception.

There is **no new aggregate `ok`** and no bare “projection verified” status.
Results MUST identify whether the subject is a record or a projection. `failed`
means an observed contradiction in the claimed scope; `unverifiable` means
required evidence/capability is unavailable or ambiguous; `not_checked` means
not invoked. A new signing backend, archive or source cannot be inferred from a
clean structural result. Neither absence nor an unsupported capability is success.

Proposed reason vocabulary is separate from existing validation codes:
`raw_digest_mismatch`, `semantic_digest_mismatch`, `view_digest_mismatch`,
`derivation_mismatch`, `link_mismatch`, `payload_hash_mismatch`, `invalid_artifact`, `unsupported_version`,
`source_missing`, `source_not_transformable`, `missing_predecessor`,
`unanchored_root`, `unhashed_history`, `archive_missing`,
`archive_not_authenticated`, `ambiguous_archive_link`, `archive_cycle`,
`resource_limit`, `dependency_failed`, `not_invoked`.
These names would be registered only with the accepted capability/schema, not
added to the current INT/POL registry by this draft. Exact comparisons come
before unavailable-evidence states on the same axis; an unavailable key cannot
mask a known raw, semantic, derivation or link mismatch. Independent axes retain
all observed states. Do not invent derived comparisons when prerequisites fail.

### 12.4 Continuity procedure and missing predecessors

Eligible source chains are every ordinary section/variant and every signed or
hashed block, without hiding append-only collections. Use the existing V.13.2
collection classification. Independent append-only items without a declared
supersession relationship are individual evidence items, not one inferred chain:
without an explicit checkable history root they remain `unverifiable`, not links
inferred from their array positions. Unhashed payloads in any retained collection
prevent a blanket all-retained-history success. This is a deliberately stronger
optional claim, not a new requirement on ordinary record validity.

For ordinary section histories the chain key is section plus exact variant
(or explicit absence), regardless of whether an individual snapshot routes a
block under `sections` or `superseded`. Those collection names are part of the
block's locator, not different logical chains. An earlier snapshot's then-current
head can be a predecessor of a later snapshot's head. Append-only items are not
silently assigned one chain merely because they share a collection.

Use these chain identities; never first-match selection or descriptive scenario routing. Preserve physical
order. Report exact block locators (source digest, collection, section, variant
or explicit absence, occurrence index and revision) so repeated payload hashes
cannot be mistaken for unique historical identities.

For the new capability, a chain's `verified` retained continuity means every
required payload/hash is present and recomputes, successive visible links agree,
revisions follow the stated chain without gaps, and the first row is revision1
with null parent. It proves consistency from that declared retained root only,
not an unknown earlier timeline or authenticity of unsigned metadata. Existing
block/root semantics and editor stamping are not changed by that statement.

| Case | Proposed retained-continuity result | Existing behavior preserved |
|---|---|---|
| Visible predecessor and unequal parent link | `failed`; retain INT-01 | No relaxation or repair |
| Stamped payload hash disagrees | `failed` for this scoped claim; retain existing INT-04 warning / signed INT-07 error exactly | No severity promotion in legacy validation |
| Valid contiguous hashed chain from declared revision1/null root | `verified`, scope `retained-history` | Does not authenticate origin, timestamps or unseen events |
| First visible non-null parent has no visible predecessor | `unverifiable / missing_predecessor` | No new automatic INT-01 or tampering finding |
| Hashed permitted manual `section_replace` produced that absent-parent shape | Same `unverifiable`, with `replacement_permitted_by_policy` qualifier | Keep V.2/V.10 stamping and the legitimate editor regression; a policy-permitted shape is not proof of the operation's actual history |
| Revision gap or first visible revision greater than1 even with null parent | `unverifiable / unanchored_root` | Do not silently re-root, fabricate a boundary or treat it as tampering |
| One or more required blocks lack hashes, including wholly unhashed input | `unverifiable / unhashed_history` | Existing integrity opt-in/no-op remains unchanged |
| Requested check was not run or resource limit prevented completion | `not_checked / not_invoked`, or `unverifiable / resource_limit` respectively | Never verified by default |

A broken chain dominates missing evidence *within that chain*; preserve all
reasons. Across chains, any observed failure yields failed scoped continuity;
otherwise any unknown chain yields unverifiable; only all checked chains yield
verified. Zero eligible chains is `unverifiable / unhashed_history`, not vacuous
verification. New scoped refusal does not convert current `verifyChain.ok` into
a different result. Structural/provenance failures remain visible on their own
axes; a numerically correct calculation is not proof that policy was followed.

### 12.5 Authenticated archives: separate evidence, never source mutation

The caller supplies archives explicitly; no automatic network lookup, file search
or mutable location fallback. Version1 admits existing V.13 document signatures
verified under trusted external keys as the archive authentication mechanism.
A matching digest alone is insufficient. Missing/unknown key or backend gives
`unverifiable / archive_not_authenticated`; invalid authentication is failed
evidence, with the original V.13 reason. A signer time is self-asserted, not proof
that the archive existed before the source or before another snapshot.

For each gap, require one unambiguous same-chain predecessor in an authenticated
archive, with matching content hash and the immediately preceding revision.
Verify its full payload, exact variant and snapshot-local collection locator, and the contributing archive chain's
continuity, as well as the archive's structural/integrity and policy results. Report unrelated archive chains separately rather than claiming their histories verified. Resolve any earlier archive gaps only from the
finite caller-supplied set using the same rules. Multiple eligible candidates with the same chain/revision/hash but differing
metadata or archive attribution are ambiguous, not first-match successes; missing evidence, cycles or exhausted
host-declared limits remain unverifiable. Report dependencies and chosen locators
in deterministic source-digest/physical-order order. Do not merge payloads from
multiple candidates or infer that a matching payload authenticates its metadata.

The local source still has an absent predecessor: `retained_continuity` stays
unverifiable. A separate `archive_assisted_continuity` may be verified if all gaps
are bridged and no contradiction exists, with the archive identities, trusted
signers and linkage evidence disclosed. A source's broken visible link, invalid
payload or policy failure is never repaired by choosing a different archive.
Without source snapshot authentication, the linkage metadata remains an assertion
of the supplied source; authenticated archive content does not authenticate that
source's parent claim. No merged/reconstructed file replaces the original subject.

### 12.6 Signatures and receipts

Keep every original source payload, block signature and detached document
signature. Unknown keys and unchecked signatures remain distinct from invalid
signatures. Preserve V.11's separate per-block attribution and V.13's snapshot
authentication; neither alone proves continuity. Do not copy a source document
signature onto the view as if its semantic subject were unchanged.

Version1 introduces **no projection-signature scheme**. Source signatures and
keys are supplied separately. A transport/exporter signature, if later designed,
would authenticate the exporter's chosen bytes, not restore deleted history or
transfer another actor's attribution. It requires its own governed contract.

UW Receipt1.1 is unchanged. Verify any accompanying receipt against the retained
source and report the actual subject/engine and existing RCP states. The
projection is not an eligible receipt subject in version1; passing it to a record
receipt verifier must not trigger implicit unwrapping. Copying source results or
re-signing a view cannot turn it into the source receipt. No new combined receipt,
canonicalization, financial output, pack version or engine identity is introduced.
Cosmetically different source bytes may retain an existing semantic signature or
receipt while failing the projection's exact raw-source binding; report both.

### 12.7 CLI and API proposal; compatibility boundary

Proposed new commands (not implemented):

```text
uwmd projection create source.uwx.md --archive-output retained.uwx.md --output view.uwproj.json [--signature source.signature.json] [--dry-run]
uwmd projection verify view.uwproj.json --source source.uwx.md [--archive archive.uwx.md ...] [--signature source.signature.json] [--keystore keys.json] [--require-authentication] [--expected-source-raw-digest sha256:HEX] [--signing] [--json]
uwmd history verify source.uwx.md [--archive archive.uwx.md ...] [--signature source.signature.json] [--keystore keys.json] [--require-authentication] [--expected-source-raw-digest sha256:HEX] [--signing] [--json]
```

Archive inputs each carry an explicit detached signature association supplied by
the host/API; the CLI spelling is repeatable `--archive-signature file` paired in
argument order with `--archive`. No implicit sidecar discovery. Duplicate or
unpaired associations refuse usage. Existing command flags stay closed.

Creation requires both a distinct retained-source output and a distinct projection
output. First retain an exact byte copy of the immutable input snapshot in the
archive output and verify its raw hash; never publish the view before that copy
is durably committed. Refuse overwrites, all input/output path collisions and
symlinks/hardlinks aliasing any input. A supplied detached source signature is
copied byte-for-byte to `<archive-output>.signature.json`, also exclusively; do
not discover or fetch unknown sidecars. The API accepts explicit additional
opaque detached artifacts to retain byte-for-byte with the source. Original
input/sidecar files are never modified. Producers must identify and retain every
external artifact relied on for their claims; the CLI does not infer that an
unprovided signature is absent or preserved. Retention claims cover the supplied
snapshot and explicitly inventoried artifacts, not undisclosed external material. No raw hash or path alone constitutes
physical WORM storage; later archive loss/mutation is unavailable/failed evidence.

Two files cannot be promised one atomic cross-filesystem rename: commit archive
and supplied sidecars first, then the view. Failure may leave the retained
archive, but never a published view lacking its required retained copy; report
partial output paths and never delete the only retained evidence as cleanup.
The host's retention/access policy remains explicit. Source bytes and supplied
detached artifacts are preserved, not merely replaced by commitments.

Creation requires separate, non-existing outputs (refuse same path, aliases,
symlinks/hardlinks to source and overwrite); dry-run writes nothing, including no archive. It hashes
and transforms one immutable byte snapshot, with source identity rechecked before
commit of output; a changed input aborts. Exit0 means **projection created**, not
verified history. Integrity/policy verification is a separate operation; no
verification-success data is embedded. Invalid/ambiguous transform prerequisites
refuse creation, while a structurally transformable but integrity-failed record
can be exported for diagnostics without claiming verification.

Verification emits every axis above and never a bare OK badge. Exit0 requires:
matching projection/source commitments and derivation when applicable; passing
source structural/policy checks; and verified retained or explicitly labeled
archive-assisted continuity. Any applicable failed/unverifiable/not_checked
required axis is nonzero. `--require-authentication` additionally requires V.13
verified source authentication; without it, absent source authentication can
coexist with successful **scoped continuity**, but must be prominently labeled
unauthenticated. A supplied authentication artifact must be checked and pass;
unknown/invalid supplied authentication is not silently ignored. Any explicitly
supplied archive authentication failure remains visible and prevents a successful
requested verification, even if another archive could bridge the same gap. Block-signing
capability uses the existing explicit signing/key-store controls and reports
unchecked counts when not invoked; continuity must not imply signature verification.
`--expected-source-raw-digest` adds an independent caller-supplied exact-byte
expectation. A mismatch fails source identity even if the projection's own raw
claim matches; never silently fill this option from the projection. Without a
trusted external expectation, matching manifest raw hashes remain self-declared
commitments. `--require-authentication` requires semantic V.13 authentication,
not raw-byte origin authentication. Report the origin of each expected commitment
(projection or caller) alongside the comparison result.
Usage/creation errors exit1; failed or indeterminate requested verification exits1;
only the fully satisfied requested scope exits0. No new success exit code for
unverifiable results. Financial calculation or receipt success cannot override
this result. Existing `verify --integrity` remains a visible-chain check with its
existing codes/counters; it cannot advertise the new historical-continuity claim.

**At full activation**, legacy `compact`, `compact()` and structured-document
export with `--no-superseded` / deprecated `--compact` or
`includeSuperseded:false` must refuse history-stripped *record* emission with
migration guidance; no silent string-to-container return-type switch. Full-history
record export stays available. Plain chat/CSV/HTML reports and the core renderer's
extracted JSON are already non-record views; retain their financial values and
label their view scope rather than silently turning them into the new artifact.
They must not be ingested as authoritative records. Assess XML/envelope codecs,
composition/export and package-context routes by actual output type; no empty
`superseded:{}` laundering through a valid Document Envelope is allowed for a
producer claiming the new workflow. Do not alter unrelated compatibility aliases.

These refusals break existing starter APIs/CLI behavior, including the approved
4.3 interim export alias. They cannot be hidden in a compatible4.x patch/minor.
Recommendation: accept the target design separately from activation timing;
allow additive new commands/capability in a compatible implementation only with
explicitly bounded claims, then retire legacy stripped-record emission in an
owner-authorized breaking window. Until retirement, document legacy paths as
outside the protected projection workflow and **do not claim every historical
stripping path has become safe**. Alternatively the owner may require atomic
activation/retirement and defer all implementation. This is decision D5 below,
not permission to alter current behavior, prepare5.0 or assign release versions.

### 12.8 Exact proposed specification and conformance work

Only after acceptance, a governed implementation would propose these edits:

- **Format2.7:** replace its final compact sentence with: “A retained record is
  the authoritative verification subject. Removing superseded history produces
  a projection, not an equivalent retained record. A producer of a history
  projection MUST preserve the original source unchanged and use the distinct
  projection artifact defined by RFC0085.” Keep manual edit policies and the
  last-active-block rule unchanged; scope recoverability to retained evidence,
  not all unknown events.
- **Format6.5:** distinguish deprecated legacy stripping from the new projection
  create/verify workflow and specify the agreed retirement phase. Remove the
  assertion that a destructive strip is an authoritative record operation.
  Replace the source-mutating compact-log promise for the new workflow with
  external activity logging; no POL-02 exemption follows from an export event.
- **ProtocolV.10/V.11/V.13:** retain existing rules/severities/signing inputs and
  define the limits of their claims. Add a separate history-evidence subsection
  with §§12.3–12.5's result procedure; register the optional capability in the
  Integrity profile/implementation manifest and portable driver vocabulary.
- **Schemas:** add closed projection/result schemas for the new artifacts only.
  Existing Format3 record and signature/receipt schemas retain their identifiers
  and required fields. Any related binding must carry the distinct artifact
  media type; unsupported artifact/version is explicit refusal, not a fallback.
- **Receipts:** editorial cross-reference of the subject boundary only; no
  receipt-version or canonicalization change. **Starter docs/APIs:** apply the
  chosen command migration and qualified display claims, preserving all financial
  formulas/values. Version Format/Protocol/packages independently when required;
  exact versions follow the governed release process, not this draft.

Proposed fixture manifest (documentation only; no files or baselines changed):

| ID / target | Input and positive/negative assertion |
|---|---|
| P01 Reader | Projection JSON, also renamed `.uwx.md`/`.uw.json`: Markdown reader refuses unsupported/absent Format version; UW JSON reader refuses missing envelope version. No valid record fallback |
| P02 new capability | Matching complete hashed source and exact derived wrapper: identity/derivation matched, retained continuity verified; authentication absent is labeled, not implied |
| P03 new capability | One changed source byte with equal semantic digest: raw binding failed while independent semantic authentication may still verify |
| P04 new capability | Changed source semantic member; stale projection/source digest: identity failed; no claimed derivation success |
| P05 new capability | Changed view bytes, hash or transform; unknown/duplicate member, encoding or version: fail/refuse exact claimed check; unsupported version unverifiable; no automatic decoder fallback |
| H01 Integrity | Existing two-visible-block mismatch: original INT-01 and scoped continuity failed, including after creating a diagnostic projection |
| H02 new capability | First head with absent parent: retained continuity unverifiable; no new INT-01 or verified continuity |
| H03 starter + new capability | Existing hashed manual replacement: editor result/legacy chain verdict unchanged; new history check unverifiable with permitted-replacement qualifier, not tampering |
| H04 new capability | Null parent at revision greater than1 or a revision gap: unanchored/unverifiable, not inferred history |
| H05 new capability | Entirely unhashed or partly hashed source: continuity unverifiable even if V.13 authenticates the snapshot |
| A01 new capability | Unambiguous predecessor in explicitly supplied authenticated, internally valid archive: local unknown retained; separately verified archive-assisted result with exact subjects/locators |
| A02 new capability | Archive absent, wrong identity/variant/revision, multiple eligible ambiguous hash/locator candidates, no trusted key or invalid signature: missing/ambiguous/unverifiable or observed failed authentication as specified; never first-match success |
| A04 new capability | Repeated identical payload hashes at different revisions with one exact eligible predecessor: unique locator resolves correctly; bare hash equality is not used as identity |
| A03 new capability | Archive dependency cycle/resource limit: unverifiable; no network fetch or recursion success by default |
| S01 Integrity | Full signed history: all original signatures/payloads preserved; original V.13 signature verifies on source, not on stripped view |
| S02 Integrity | Metadata-only signed stub: preserve original INT-07 failure; projection creation cannot rehabilitate it |
| S03 new capability | No backend/unknown key: explicit unchecked/unverifiable authentication; required-auth CLI nonzero; no conflation with invalid signature |
| R01 receipts | Original receipt verifies only against its original source subject; projection input not unwrapped; missing subject remains existing receipt-unverifiable result |
| C01 starter | Create/no-history/dry-run/overwrite/alias cases: source and detached artifacts unchanged, exact retained bytes/order, no appended source log; wrapper used even for no-history input |
| C02 starter | Verification failure/unknown scope exits nonzero; creation success never displayed as verified history; stripped legacy emission follows the approved migration phase |
| C03 representations | Full-history UW JSON/XML round trip remains unchanged; history omission cannot masquerade as a complete structured record under the activated workflow |

Positive continuity cases need full explicit roots; negative cases must preserve
existing integrity/policy findings as well as new scoped states. Use synthetic
records, including repeated-content revisions and multiple variants. Test legacy
readers with the whole wrapper and with a renamed file. Reference-driver success
is not independent implementation evidence. No baseline regeneration may substitute
for approval of these new optional-profile/starter expectations.

### 12.9 Exact remaining owner decisions for acceptance

C+D is the directed proposal, **not a question to reopen** and not yet accepted.
The remaining decisions are these five bounded approvals or amendments:

1. **D1 — Artifact contract.** Approve the closed `.uwproj.json` JSON/base64
   container, retained byte-identical source/sidecar archive, mandatory exact raw/full-semantic source binding and byte-preserving
   `omit-superseded/1` transform in §12.2. Recommendation: approve; no disguised
   Format3 record, mutable URI, embedded archive or in-band verification badge.
2. **D2 — Continuity and result scope.** Approve the optional separate capability,
   result states/reasons and root/gap rules in §§12.3–12.4. Recommendation: missing
   predecessor/manual replacement/unhashed history is unverifiable, never auto
   tampering; retain all legacy codes, severities, editor stamping and counters.
3. **D3 — Archive evidence.** Approve v1's explicit host-supplied archives,
   existing V.13 trusted-key authentication, unique same-chain locators and
   separate archive-assisted result. Recommendation: no source splicing, implicit
   retrieval, inferred signer time or upgrade of local continuity.
4. **D4 — Authentication/receipt and CLI assurance.** Approve no new projection
   signature/receipt scheme and the explicit-authentication policy of §§12.6–12.7:
   scoped unsigned continuity may succeed with prominent unauthenticated status;
   supplied document-authentication artifacts must be checked; `--require-authentication` requires
   verified V.13 source authentication. Recommendation: approve this opt-in
   assurance boundary, not an unqualified “verified record” result.
5. **D5 — Compatibility/activation.** Choose staged additive introduction then
   separately authorized retirement of unsafe legacy stripping, or atomic
   activation in an authorized breaking window. Recommendation: staged compatible4.x development, with
   protected-workflow claims explicitly limited until retirement, and retirement
   completed before making the coordinated launch's complete-authority guarantee. Confirm the
   documented legacy compact/export/API refusals at full activation. This is
   the unavoidable compatibility decision; no4.x-compatible label can conceal
   it and no5.0 release preparation is authorized. Exact version numbers and
   publication dates remain later release decisions, not required to accept
   the architectural text.

The owner's expanded launch direction proposes completed provenance semantics
before the public launch, rather than automatic deferral. That priority does not
accept D1–D5, change current compact behavior, or authorize5.0 preparation.

Acceptance must record answers to D1–D5 and any amendments, with the final clause
text updated accordingly. It does not by itself authorize publishing, deploying,
changing external settings or preparing5.0. RFC0086/0087's financial authority,
period/scenario/population and precision choices remain separate; nothing in
this provenance RFC changes a financial formula or adds an equality requirement.

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

The concrete-design probe is
[retained with the Phase2 reproductions](https://github.com/UWMD-OSP/UW-Markdown/blob/claude/rfc-0085-compaction-provenance/docs/reviews/2026-10-15-financial-verification-phase-2.compaction-design.repro.mjs).
Its [observations](https://github.com/UWMD-OSP/UW-Markdown/blob/claude/rfc-0085-compaction-provenance/docs/reviews/2026-10-15-financial-verification-phase-2.compaction-design.evidence.json)
use built source `eac353046f082f67f9660a38991f6122a6a99f9b`, whose tree equals
main `a18ed8ee`: existing Markdown and UW JSON readers refuse the whole wrapper;
a marker alone does not prevent ordinary Format3 reading; CRLF changes raw
identity without changing the guarded semantic subject; legacy history-omitting
envelope export is still readable. The source bytes remain unchanged. This is
reference-reader design evidence, not an independent implementation, cryptographic
verification or an implementation of the proposed history/derivation procedures.
