---
rfc: 0102
title: A structured block opens only on a three-backtick json line
status: accepted
author: UWMD maintainers
created: 2026-10-20
affects:
  - format-spec
  - conformance-corpus
  - tooling
---

# RFC 0102: A structured block opens only on a three-backtick json line

> **Accepted by the owner, 2026-10-19** (Jared on #405: "backtick fences only;
> Python aligns"). The RFC, its decisions and the alignment land together.

## Summary

Format §2.4 said only "Every data block is a fenced JSON code block", and every
example used three backticks. The reference reads a block only from a line that
begins exactly with three backticks and `json`. The independent Python
implementation (#354) read any CommonMark fence, so tilde fences were data blocks
there and not in the reference. This RFC states the reference's line rule as the
standard, and Python adopts it.

## Proposed change

Format §2.4 gains:

> A structured block opens on a line that begins, at the first column, with
> exactly three backticks immediately followed by `json`, whitespace and the
> `uw:section=` annotation. It closes on the next line that is exactly three
> backticks, optionally followed by spaces or tabs. Nothing else opens a block: a
> tilde fence (`~~~json`), an indented fence, or a longer backtick run is ordinary
> Markdown, and so is any other code fence. The rule is line-based. A line that
> meets it opens a block even inside another Markdown code fence, so an author who
> shows an example block in prose indents it or uses a tilde fence.

## Compatibility analysis

The reference's behavior is unchanged; this states it. A document that relied on
tilde fences was already unreadable by the reference (`SOURCE_CONTENT_MISMATCH`
when every block is tilde-fenced). The Python reader now matches. No version is
allocated (RFC 0091 D6).

## Conformance impact

New `conformance/documents/malformed/50-tilde-fenced-block`: a tilde-fenced
`property` block beside a backtick `valuation` block. The tilde block is not a
section, so the record owes `CC-14`.

## Reference implementation

No TypeScript change (`FENCE_OPEN_RE` / `FENCE_CLOSE_RE` in `parser.ts` already
implement the rule). Python `uwmd_source.scan_source` replaces its CommonMark
fence scanner with the same line rule. Its tests now pin the rule (a block inside
a four-backtick example opens; tilde and indented fences do not), and two
metadata test helpers switch from tilde to backtick fences.

## Alternatives considered

- **Any CommonMark fence** (tilde equivalent to backticks). Rejected by the
  owner, and it would also have changed the reference.
- **CommonMark nesting awareness** (a UW line inside another fence is not a
  block). This reads naturally for documentation, but it makes block detection
  depend on full Markdown parsing, and the reference has never done it. Recorded
  as D3 so the owner can revisit it.

## Unresolved questions

None.

## Decisions

| # | Question | Decision | Why |
|---|---|---|---|
| D1 | Fence characters | Exactly three backticks + `json` at column 0 | Owner ruling; reference behavior |
| D2 | Closing line | Exactly three backticks, optional trailing spaces/tabs | Reference `FENCE_CLOSE_RE` |
| D3 | Nesting | Line-based; no Markdown fence nesting | Reference behavior; one deterministic rule |

## Prior art

CommonMark §4.5 (fenced code blocks), which this format deliberately narrows for
data blocks.
