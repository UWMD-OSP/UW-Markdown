# UW Markdown RFCs

This directory contains the request-for-comments documents that precede
any normative change to UW Markdown — the format spec, the protocol
spec, the JSON Schemas, the conformance corpus, or the public API of
`@uwmd/core`.

See [`GOVERNANCE.md`](../../GOVERNANCE.md) for when an RFC is required
and how it gets accepted.

## Process

1. Copy [`0000-template.md`](./0000-template.md) to a new file named
   `NNNN-<short-slug>.md`. Pick the next free 4-digit number.
2. Fill in every section. RFCs without compatibility analysis,
   conformance impact, or a reference implementation plan get bounced.
3. Open a PR titled `RFC NNNN: <short title>`.
4. The PR sits open for **at least 14 days** — this gives third-party
   implementers a chance to weigh in.
5. The BDFL accepts, requests changes, or rejects per
   [`GOVERNANCE.md`](../../GOVERNANCE.md#normative-changes-change-implementer-behavior).
6. On accept: the RFC merges to `main`, status flips to `accepted`, and
   the spec / library changes land in a follow-up PR (or the same one).
7. On reject: the RFC merges with status `rejected` and a one-paragraph
   summary of why. Rejected RFCs stay in the directory as institutional
   memory — they document paths the project considered and chose not to
   take.

## Index

| # | Title | Status | Affects |
|---|---|---|---|
| _none yet_ | _the RFC process is being introduced in Phase 4 of the path-to-public-release plan_ | | |

## Status values

- **draft** — author is still iterating; reviewers may comment but
  the proposal is not stable.
- **active** — open for comment; in the 14-day window.
- **accepted** — merged with intent to implement.
- **implemented** — the change has shipped in a release; CHANGELOG
  entry exists.
- **rejected** — closed without merging the change. RFC stays in
  the directory.
- **superseded** — replaced by a later RFC; cross-link both.
- **withdrawn** — author pulled the proposal.

When status changes, edit the RFC's frontmatter and update this index.
