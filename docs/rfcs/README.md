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
| [0001](./0001-locale-negotiation.md)    | Locale negotiation                          | draft | format, protocol, core, conformance |
| [0002](./0002-module-signing.md)        | Module signing                              | draft | protocol, core, conformance |
| [0003](./0003-module-asset-classes.md)  | Custom asset-class declarations from modules | draft | format, protocol, core, conformance |
| [0004](./0004-conformance-runner-v2.md) | Conformance test runner v2 (language-agnostic) | draft | conformance, tooling |
| [0005](./0005-stochastic-calculations.md) | Stochastic calculations                    | draft | protocol, core, conformance |
| [0006](./0006-hospitality-module.md)    | Hospitality reference module                | draft | core, conformance |
| [0007](./0007-sensitivity-tables.md)    | Sensitivity tables as a calc primitive      | draft | protocol, core, conformance |
| [0008](./0008-lease-up-modeling.md)     | Lease-up modeling                           | draft | protocol, core, conformance |
| [0009](./0009-meta-v2-reorg.md)         | `_meta` v2 sub-object reorganization        | draft | format, protocol, core, conformance |
| [0010](./0010-signed-blocks.md)         | Signed blocks                               | draft | format, protocol, core, conformance |
| [0011](./0011-capability-tokens.md)     | Capability tokens for write authorization   | draft | protocol, core, conformance |
| [0013](./0013-corpus-retrieval.md)      | Embedding-based corpus retrieval            | draft | protocol, core, conformance |

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
