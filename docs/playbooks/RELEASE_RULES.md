# Release rules after launch

These rules take effect when the public launch (5.0.0) ships. Until then the
prelaunch rule in [VERSIONS.md](../../VERSIONS.md) applies: 4.x releases, with no
backward compatibility. Items marked **proposed** await the owner's
ratification; the rest are recorded decisions.

Every release and every publication needs the owner's explicit approval.

## Versions

- **Packages move in lockstep.** Every `@uwmd/*` npm package launches at 5.0.0
  and shares one version number from then on (owner decision, VERSIONS.md).
  A release bumps them all, even a package with no change.
- **Semver applies to that shared number.**
  - *Major*: a breaking change to a public API, a CLI contract, or a normative
    requirement a conforming document or implementation relied on.
  - *Minor*: additive changes: a new metric id, section, optional field,
    validation code or API.
  - *Patch*: fixes that change no contract.
- **Format and Protocol keep their own version streams** (VERSIONS.md "Why three
  streams?"). Adopters who write their own readers pin those, not the packages.
- A version number is never reused, and npm publication is permanent in
  practice. Releases follow the three release states (candidate,
  release-prepared, published) in wiki
  [11](../wiki/11-build-release-governance.md#the-three-release-states).

## Breaking changes and deprecation

- **Proposed:** before a breaking change, the affected surface is deprecated for
  at least **one minor release and 90 days**, whichever is longer. The
  deprecation is stated in the CHANGELOG and, for APIs, in the code.
- A metric id keeps its meaning forever. A new meaning gets a new id, and the old
  id is deprecated, never redefined ([Adding a metric](ADD_METRIC.md)).
- **Proposed:** validation codes are never renumbered or reused; a retired code
  stays reserved.
- Emergency security fixes may be merged immediately and documented afterward
  (GOVERNANCE.md), even when the earlier behavior was the vulnerability.

## Normative changes

- An RFC in `docs/rfcs/` for anything that changes what a conforming
  implementation must do (wiki 11, "When does my change need an RFC?").
- In collaborative mode, a **public comment period of at least 14 days**,
  owner approval, and a reference implementation in the same PR or a linked
  follow-up ([GOVERNANCE.md](../../GOVERNANCE.md)). In owner-led mode the owner
  may accept immediately.
- Spec, schemas, protocol and conformance change together (invariant 7).

## Signing keys

- The protocol rule (Protocol §V.11.4): rotate by issuing new blocks under a new
  `kid` and keeping the old key loaded. A `kid` is never reused for a different
  key, and blocks signed under a retired `kid` stay verifiable while a key store
  holds it.
- **Proposed** project policy for keys the project holds (release provenance and
  any project-signed modules):
  - rotate at once on suspected compromise, and say so in the release notes;
  - otherwise rotate on a fixed schedule, publishing the retired `kid` alongside
    the new one.

## Security disclosure

[SECURITY.md](../../SECURITY.md) governs: report to security@uwmd.org with the
subject prefix `[uwmd-security]`. Acknowledgement is within 5 business days, a
fix targets 90 days from confirmation, and the release date is coordinated with
the reporter, who is credited unless they ask otherwise.

## Public records

A release is described only in public records:

- `CHANGELOG.md`;
- `VERSIONS.md`;
- the GitHub Release for its tag.

There are no internal release records.
