# Draft: Independent Python Reader, period identities and partial structural checks

Stack base: PR #357 head `b87909878d0f9fd55e212366a8dced7cf05c08ad`, which
contains live-main `a18ed8ee`. This patch must not include #356's RFC/probe changes
again or the other writer's source/token files. Suggested separate remote head:
`codex/python-354-reader-periods`; do not reuse an occupied worker branch.

Adds a standard-library Python Format 3.0 reader from the normative text and
portable corpus: restricted YAML, fenced JSON, unknown content, supersession,
role opt-in, numeric spelling, exact period selection and partial META/ROLE/PS
validation. Source values and row order are preserved. The period resolver
refuses collisions rather than choosing by row position or summing same-day rows.

Only `parse` is advertised. There is no tier, complete validation, Verifier,
receipt, optional profile or calc capability claim. Partial validation exits
nonzero with explicit incomplete/unverifiable status. Year 0000 follows VIII.3
using a new character-only predicate; #357's seed remains untouched.

The patch contains six files, including sixteen targeted test methods. The
first-stage CLI exposes manifest/parse/partial validate only. The follow-up patch
adds the settled evaluator and the complete current development-run evidence.
Before publication, execute the first-stage tests and portable Reader run on
this exact patch; the final working state has sixteen Reader/period tests and
17/17 portable Reader matches. The complete final state adds eight expression
tests. Do not attribute final-state calc evidence to this first patch alone.

Open questions: pipeline collection projection, duplicate-source parse-code
registration, and the relation between generic Reader routing and stricter
receipt/signing guards. No new normative behavior is proposed here.

Draft only. Required repository gates were attempted in the final worktree and
failed for absent tsc/vitest/ajv. Changelog/wiki integration and clean CI are
required before review or merge. Other workers' untracked files are excluded.
