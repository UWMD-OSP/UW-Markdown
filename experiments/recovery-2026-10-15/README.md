# Experimental recovery: unpublished design analysis

**DRAFT / UNREVIEWED / NOT FOR MERGE.** These are archival design inputs, not
accepted RFCs, normative files, launch criteria or implementation instructions.
No active RFC index, ROADMAP, source implementation or conformance file changes.
All original retained files are byte-for-byte copies, except the explicitly
generated text patch of the superseded planning edits.

## Provenance work

`provenance-85/draft-analysis.md` preserves the unpublished expanded C+D proposal
from `/tmp/uwmd-rfc85-authority`, based on current PR #335 head
`ce8ae0100a28b9fe82612a651afce1f8c041d425`. Its proposed result axes, old-reader
barrier, archive-assisted continuity, signatures/receipts, migration and five
owner decisions remain proposals. PR #335 is untouched and remains canonical.
References in the old text to checks on #335 must not be mistaken for evidence
that this unpublished expansion had its own successful remote CI.

The synthetic `compaction-design.repro.mjs` and original evidence JSON describe
existing reference-reader behavior, not an independent implementation or a new
projection verifier. Inputs are public repository examples/fixtures. The JSON
records exact historical built-source commit `eac353046f082f67f9660a38991f6122a6a99f9b`;
do not relabel it as output from another commit. To repeat after building a
separate selected checkout, pass its path and exact built commit:

```sh
node experiments/recovery-2026-10-15/provenance-85/compaction-design.repro.mjs /path/to/built-checkout EXACT_COMMIT
```

No production compaction, signature, receipt or validation behavior is changed.

## Superseded projection planning

`superseded-projection/historical-proposal.md` is the old acquisition-engine
proposal. Its historical frontmatter says RFC 0088; **that assignment is
superseded and invalid for this proposal**. Numerical PR #357 owns RFC 0088.
Do not register, renumber or revive this text without a separate owner decision.
The later owner direction preserves RFC 0078/0083's verifier/product boundary:
StackUW and unrelated adopters own model generation. Issue #355 concerns bounded
financial assurance, not mandatory verification of a comprehensive model engine.

`historical-planning.patch` preserves the associated unfinished documentation
deltas against `a18ed8ee7f502e2bd538c3c96be1584f94c458b9`, including the proposed
ROADMAP dependency analysis. It is archival text, **not a patch to apply**. Its
old launch prerequisites, RFC registration and status statements are obsolete;
use only useful research selectively against current owner direction. Base files
are already in GitHub history, so obsolete full-file snapshots are unnecessary.

This branch does not alter accepted scope, change normative semantics, accept
RFCs, assign package versions, publish packages or prepare the 5.0 launch.
