---
rfc: 0120
title: Preserve selected-source cash-flow structural findings
status: accepted
author: UWMD maintainers
created: 2026-10-22
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0120: Preserve selected-source cash-flow structural findings

## Resolution

Accepted as drafted by the UWMD maintainers on 2026-10-22 (fourth set). This PR implements
the bounded selected-source clarification of Protocol V.12.

## Contract

For replacement-funding verification, `structural_issues` MUST include existing
CF findings that apply to the exact cash-flow source selected by the binding,
alongside the existing applicable HDG, ESC and CUR findings. It MUST NOT include
findings from another cash-flow variant, component, superseded physical block,
or unrelated deal section merely because its code starts with CF.

Resolve the property-level debt selection and exact named cash-flow variant
using V.12's current no-fallback rules. Select findings by the same physical
source and structural prerequisites used for the binding. Preserve each
finding's existing code, severity, section, field and multiplicity. Issue order
remains non-normative under RFC 0104.

This changes neither the synchronous validation result nor the binding digest.
An unresolved source still takes precedence as `unresolvable_source`; a resolved
but malformed source is `invalid_structure`. Both expose the applicable findings
that can be established. `crypto_unavailable` with valid structure retains an
empty structural list. A verified binding remains a bounded binding claim.

## Decisions

| Question | Recommendation | Precedent |
|---|---|---|
| Which CF findings? | Only findings belonging to the selected physical source and its binding prerequisites | V.12.2 already says preserve applicable CF findings; V.12.3 excludes unrelated financial validation |
| Change finding identities or invent a new code? | No; project existing findings without rewriting them | RFC 0104 field ownership and multiplicity |
| Missing source plus malformed reference? | Keep unresolvable_source precedence | V.12.3 and the reference correction in issue #516 |

## Implementation and conformance

Update Protocol V.12, its executable mirror and any affected result-schema
explanation together. Share source selection with validation rather than
filtering all-document findings by a code prefix. Add paired reference/portable
controls: malformed selected series; malformed unselected series; same-named
superseded block; ambiguous source; simultaneous reference and source defects;
valid binding with an unrelated deal error. Test the async snapshot boundary.
No schema member or financial procedure is added.

## Alternatives

Keeping only HDG/ESC/CUR hides the CF defect V.12.2 promises to expose. Returning
all CF findings would incorrectly turn a bounded binding verifier into a deal
validator. Both alternatives are rejected by the recommendation.

## Status

Accepted and implemented in this PR under standing merge approval.
