---
rfc: 0000
title: <Short, imperative title>
status: draft
author: UWMD maintainers
created: <YYYY-MM-DD>
affects:
  - <format-spec | protocol-spec | core-library | conformance-corpus | tooling>
---

# RFC 0000: <Short, imperative title>

> Replace this template's placeholders. Every section is required —
> reviewers will bounce RFCs that omit sections rather than mark them
> "n/a." If a section truly does not apply, write one sentence
> explaining why instead of deleting the heading.

## Summary

One paragraph explaining what this RFC proposes, in plain language. A
reader should be able to decide from this paragraph alone whether the
RFC is relevant to them.

## Motivation

What is broken, missing, or unclear in the current state? Be specific
— cite spec sections, file paths, or issue numbers. Generic complaints
("the format is hard to use") are not motivation; concrete pain points
("a stated section field has no schema definition or validation rule") are.

## Proposed change

The exact change. Where possible, paste the before / after text or
schema. Where the change is to behavior rather than wording, describe
the new behavior precisely enough that two independent implementers
would produce the same result.

For spec changes:
- Cite the section(s) being modified.
- Show the new normative language using RFC 2119 terms.

For library changes:
- List the new / changed exports from `@uwmd/verify` or the starter packages.
- Describe the resulting behavior and required conformance outcomes.

## Compatibility analysis

Apply the [prelaunch policy](https://github.com/UWMD-OSP/UW-Markdown/blob/main/AGENTS.md#prelaunch-policy): before the
5.0 public launch there is no public compatibility baseline, migration path,
deprecation period or historical-artifact retention requirement.

Describe the current contract being changed, its Reader/Verifier tiers and
optional profiles, and the synchronized implementation/conformance work.
After launch, apply the published release rules to compatibility obligations.

## Conformance impact

Which existing fixtures in `conformance/` need updating? List by path.

What new fixtures need to be added to cover the new behavior? Sketch
them — the actual files land with the implementation, but reviewers
need to see that the new behavior is testable.

## Reference implementation

How will the reference verifier or starter packages support this RFC?

- **Files affected:** list the source files.
- **API surface:** new types, new functions, new exports.
- **Test plan:** what tests prove the new behavior.

A reference implementation PR can be linked here once it exists, or
declared as a follow-up. Either way, the RFC cannot ship without a
plan for the implementation.

## Alternatives considered

What other designs were on the table? Why are they worse than the
proposal? This is the section reviewers care about most — it shows
the proposal isn't the first idea you had.

For each alternative:
- Sketch what it would look like.
- State why it's worse: more complexity, weaker guarantees, narrower
  use case, etc.

## Unresolved questions

What is intentionally being deferred to follow-up RFCs or to
implementation discovery? Reviewers can sometimes resolve these in
discussion; if they can't, ship the RFC with the questions noted and
revisit them in a follow-up.

## Prior art

References to similar problems solved by other standards (CommonMark,
OpenAPI, JSON Schema, IETF RFCs, etc.) or other ecosystems. One or
two pointers is plenty.
