# Governance

This document describes how decisions get made on UW Markdown — the
format spec, the protocol spec, the reference library, the conformance
corpus, and the tools maintained in this repository.

## TL;DR

For v1, UW Markdown uses a **BDFL + contributors** model. A single
maintainer (the BDFL) has final say on normative changes; everyone
else contributes via PRs. As the project grows, this is expected to
evolve into a maintainer council via the promotion path described
below.

## Roles

### BDFL (Benevolent Dictator For Life)

- Single named individual; currently [jaredmaxey](https://github.com/jaredmaxey).
- Final authority on all normative changes to the format spec
  (`UW_FORMAT_SPEC_v1.md`), the protocol spec (`UW_PROTOCOL_v1.md`),
  and the JSON Schemas in `spec/schemas/`.
- Final say on disputed PRs and contested module designs.
- Resolves ties when maintainers disagree.

### Maintainers

- Have commit access and can approve PRs to all areas of the repo.
- Listed in [`MAINTAINERS.md`](./MAINTAINERS.md) with their areas of
  ownership (spec, `@uwmd/core`, conformance corpus, web viewer,
  etc.). Reflected in `.github/CODEOWNERS`.
- Currently the BDFL is the only maintainer (solo project).

### Contributors

- Anyone who has had a PR merged. Listed implicitly in `git log`.
- May be invited to become maintainers per the promotion path below.

## Decision-making

### Editorial changes (no normative impact)

Typo fixes, clarifying prose, doc reorganization, code refactors that
preserve behavior, test additions, conformance fixture additions
(when the expected output is uncontested):

- Open a PR.
- One maintainer approval required.
- Merge.

### Normative changes (change implementer behavior)

Any change to MUST/SHOULD language in either spec, any new field in a
standard section, any change to the calc engine grammar, any new
`BUILTIN_*` table entry, any breaking change to `@uwmd/core`'s public
API:

- Open an RFC (see [`docs/rfcs/0000-template.md`](./docs/rfcs/0000-template.md)).
- BDFL approval required.
- A 14-day comment period before merging — gives third-party
  implementers time to weigh in.
- Reference implementation must land in the same PR or a clearly
  linked follow-up.
- Merge with the version bump documented in `CHANGELOG.md`.

### Disputed PRs

If two maintainers disagree on a normative change:

- Discussion happens in the PR thread.
- If consensus is not reached within 7 days, the BDFL decides.
- The decision is recorded in the PR thread with a one-line
  rationale.

## Promotion path

A contributor becomes a maintainer when they have:

1. Had ≥ 5 substantive PRs merged.
2. Reviewed ≥ 3 other contributors' PRs constructively.
3. Demonstrated familiarity with the spec by either implementing
   against it (a tool, a third-party port) or substantially
   contributing to it.

Promotion is proposed by an existing maintainer in a private message
to the BDFL and announced in `MAINTAINERS.md` once accepted.

When the maintainer count reaches 3, this document is revised to
shift from BDFL-final to majority-of-maintainers-with-BDFL-veto for
normative changes — at which point the BDFL role becomes a
tiebreaker, not a unilateral authority.

## Conformance and the corpus

The conformance corpus (`conformance/`) is normative — adding,
modifying, or removing a fixture changes what implementers must
support to claim a tier. Fixture changes therefore follow the
**normative changes** track above.

A new fixture that exercises an edge case the existing corpus
doesn't cover is editorial if `@uwmd/core` produces the same
expected output without code changes. If it requires changing the
reference library to make the fixture pass, it is normative.

## Module ecosystem

Modules (asset-class extensions like the planned `hospitality`
module) live in their own packages and have their own maintainers.
This governance document covers only the standard modules shipped
from this repository. Third-party module governance is up to the
module's authors.

## License changes

The MIT license is a permanent commitment for v1. A license change
would require:

- BDFL approval.
- Sign-off from every contributor whose code is in the affected
  files (or removal of their contributions).

This is intentionally hard. Don't expect a license change.

## Amendments

Changes to this document follow the **normative changes** track
(RFC + 14-day comment period + BDFL approval).
