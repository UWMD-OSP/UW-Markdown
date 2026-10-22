---
rfc: 0124
title: Require an explicit rule-set declaration in every source representation
status: draft
author: UWMD maintainers
created: 2026-10-22
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0124: Require an explicit rule-set declaration in every source representation

## Recommendation

Require UW Lite to declare uw_version. Retain the owner-confirmed RFC 0111
implementation decisions: RCP-13 for receipt/record rule-set disagreement and
refusal of a model naming no kept rule set. This draft closes Lite's implicit
3.0 selection; it does not authorize a release or add a second rule set.

## Proposed contract

UW Lite frontmatter MUST contain a non-null uw_version naming a rule set the
reader/verifier keeps. The existing Format scalar version semantics apply.
The Lite bridge MUST carry that declared version into the envelope and MUST NOT
choose the current version or 3.0 when the field is absent. uw_lite_version names
the representation grammar and cannot select the financial rule set.

A missing, null, malformed or unsupported declaration uses the existing typed
UNSUPPORTED_FORMAT_VERSION refusal consistently across Lite parsing/compilation,
validation, canonicalization, receipts, registered-source readers and standalone
adapters. Do not author a declaration merely by reading or converting a source.
Creation tools may write an explicit version when producing a new record.

Retain refusal of an API model naming no kept rule set, rather than validating
it under a default. A verifier selects from the record, never the receipt.
A receipt rule_set mismatch remains failed/RCP-13 before pack/backend/math
indeterminacy, with no engine-identity escape. A subject that cannot canonicalize
because its declaration is unsupported remains RCP-09 at the receipt boundary.

This supersedes only RFC 0081 D12's undeclared-Lite fallback. It adds no old-
version reader, retention obligation for prelaunch documents or repair path.
RFC 0111's already accepted post-launch rule-set retention remains separate.

## Decisions proposed

| Question | Recommendation | Precedent |
|---|---|---|
| Undeclared Lite pins old rules or drifts to current? | Neither; require uw_version | Owner ruling; RFC 0111 selects rules from the record |
| Keep RCP-13? | Yes, including existing precedence | Owner confirmed the subject-identity comparison |
| Model without a kept rule set? | Typed refusal | Owner confirmation; no implicit financial behavior |
| Representation version selects rules? | No | Format/representation versions are distinct contracts |

## Implementation and conformance after acceptance

Update UW Lite 3/7, Format representation notes, Protocol rule-set selection,
Receipt 5.2.2, frontmatter schema descriptions and executable mirrors together.
Remove the bridge fallback and update current Lite creation examples/fixtures to
state uw_version explicitly. Add portable controls for missing/null/malformed/
unsupported declarations, explicit supported declarations through each reader,
model API refusals and receipt RCP-13/RCP-09 precedence. Update the independent
Python Lite adapter and shared cases. No runtime change is included in this PR.
