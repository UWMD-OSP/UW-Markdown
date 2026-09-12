---
rfc: 0040
title: Variant roles — resolve cross-checks by a declared role, not a key name
status: implemented
author: jaredmaxey
created: 2026-09-09
accepted: 2026-09-11
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0040: Variant roles

**Released in [core/CLI 2.7.0](https://github.com/UWMD-OSP/UW-Markdown/releases/tag/v2.7.0), 2026-09-12.**
The implementation and conformance cases are shipped; remaining extensions are
explicitly deferred below.


The owner approved block-level `_role` on 2026-09-11. Protocol 2.7.0 adds
role-aware cross-check selection; Format stays 2.0. The initial protocol change
was followed by package publication in 2.7.0.
The [readiness review](../reviews/2026-09-11-rfc-0040-0041-readiness.md)
records why the earlier `_meta.role` proposal was replaced: v2 metadata
normalization discards that field before hashing.

## Contract

A block MAY carry one scalar `_role` beside `_meta`: `primary`, `senior`,
`junior`, `summary`, `detail`, or `component`. Roles are permitted on any
section and on a section stated once. `primary` identifies a generic section
statement; senior/junior identify debt position; detail/summary distinguish
line-level and aggregate statements; component identifies a part of a property.
One block cannot declare both primary and detail. `_meta.role` is not an alias.

For a property-level cross-check, filter out every component block and every
block with an invalid `_role` before considering any selection step. This
applies to preferred keys, default, base, sole and standalone blocks alike.
Resolve eligible variants in this order:

1. The check's explicit variant-key preference (`t12` for CC-01's operating
   statement, `appraisal` for CC-08's due diligence).
2. The unique block with the check's registered role preference.
3. The unique block with role `primary`.
4. The `default` variant.
5. The `base` variant.
6. The sole eligible variant.

| Check | Section | Role preference |
|---|---|---|
| CC-01 | rent_roll | detail |
| CC-02, CC-03, CC-05, CC-09 | debt_structure | senior |

If a consulted role has multiple claimants, refuse resolution immediately;
do not fall through to default. Earlier successful explicit-key selection
does not consult a later role. Repeated component roles are permitted but
excluded. Never sum multiple seniors or guess from amounts or producer names.
An eligible standalone block resolves as `single`.

CC-15 retains its existing lease-up base/default schedule exception; it does
not switch to a different scenario by role. Its chosen schedule must still
be eligible, and its property NOI read observes roles. Existing direct reads
(including CC-03's capital stack, CC-11/12's components, and CC-13's property)
use roles when present; their role-free behavior remains unchanged. CC-14 is
a section-presence check, not selection of a financial statement.

## Diagnostics and evidence

`ROLE-01` is an error for an invalid scalar annotation (including null, arrays
and unknown strings), checked in all active blocks, including unselected
variants and extensions. An absent role remains valid. Historical superseded
blocks are not reclassified. Register the `ROLE` validator family and remediation.

`CC-16` remains one info issue per unresolvable section, naming the affected
checks in sorted order. For role-bearing sections, it reports a collision or
the lack of an eligible property statement. A multi-leg check such as CC-03
may still be evaluated on another leg; its message must not claim otherwise.
The role-free diagnostic and remediation remain unchanged.

`CrossCheckCoverage.resolutions` is optional, keyed by section id. Each
selection record contains optional `variant` and `via` equal to `preference`,
`role`, `primary`, `default`, `base`, `sole`, or `single`. Record it only for
sections carrying roles, including selection followed by a missing-field
skip. Multi-section checks report each selection independently. No optional
fields are emitted for role-free documents.

## Writers and integrity

`_role` is block content, already covered by both existing hash contracts.
Changing it changes the block digest and invalidates signed-chain verification.
Do not change canonicalization or add an excluded field. Parse, envelope,
JSON, XML, CSV, serialization and edit paths preserve it.

The host owns role assignment. Section replacement and supersession strip
`content._role`; absent `EditOperation.role` preserves the existing annotation,
a valid scalar assigns it, and null removes it. This trusted operation field
MUST NOT be populated from model output. Agent writes strip an invented role
and preserve the prior block's role. Roles must come from the responsible
producer or an explicit human decision, never inferred by an agent.

## Compatibility and verification

Documents without `_role` retain identical resolution, coverage, diagnostics,
hashes and existing fixture results. No formula or tolerance changes. Older
validators ignore this new content annotation and cannot enforce role-aware
selection; consumers requiring it must use Protocol 2.7.0 or later.

The normative format and protocol text, block/edit schemas, protocol constants
and public types change together. Export `BlockRole`, `BLOCK_ROLES`,
`CROSS_CHECK_ROLE_PREFERENCE`, `CrossCheckResolutionEvidence` and updated
coverage from both public entries. Verify explicit preference, role collision,
component exclusion on every fallback, malformed unselected roles, direct-read
checks, trusted edits, codec round trips, signed tampering, and the unchanged
role-free conformance corpus. No new dependency or package publication.

## Deferred

Calc period selectors belong to RFC 0041. Component aggregation and speculative
leasing remain their own contracts. Roles do not aggregate pari-passu debt or
make relative years equivalent to calendar quarters.

**Markdown opt-in.** When an active section declares `_role` and has explicit
`variant=` fences, readers collect all its active named variants, even outside
the legacy multi-variant section registry. Collect before choosing a version,
so fence order cannot discard an unannotated peer. Superseded roles do not
activate selection. Role-free Markdown retains its existing routing behavior;
removing a section's last role ends this opt-in. UW JSON envelopes already
represent variant maps on every section.
