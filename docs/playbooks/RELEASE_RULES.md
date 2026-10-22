# Release rules after launch

These rules take effect when the public launch (5.0.0) ships. Until then the
prelaunch rule in [VERSIONS.md](../../VERSIONS.md) applies: 4.x releases, with no
backward compatibility. The owner ratified them on 2026-10-21. The one rule that
binds verifiers, how a record's rule set is chosen, is proposed in draft RFC 0111
([below](#verification-rule-sets)) and takes effect only when that RFC is
accepted.

## One public number

- **People see "UWMD 5.x".** The packages and the standard are released and
  announced under one number: UWMD 5.0 is the launch, UWMD 5.1 the next minor
  release, and so on.
- **Each record keeps declaring its Format version.** A `.uw.md` states
  `uw_version` (Format §2.2), and the Format and Protocol keep their own version
  streams inside the standard (VERSIONS.md "Why three streams?"). Adopters who
  write their own readers pin those. VERSIONS.md maps every UWMD release to the
  Format and Protocol versions it carries.

## Versions

- **Packages move in lockstep.** Every `@uwmd/*` npm package launches at 5.0.0
  and shares the UWMD number from then on (owner decision, VERSIONS.md). A
  release bumps them all, even a package with no change.
- **Semver applies to that shared number.**
  - *Major*: a breaking change to a public API, a CLI contract, or a normative
    requirement a conforming document or implementation relied on.
  - *Minor*: additive changes (a new metric id, section, optional field,
    validation code or API) and **any fix that changes a computed result**. The
    CHANGELOG entry for such a fix names every affected metric.
  - *Patch*: fixes that change no contract and no computed result.
- A version number is never reused, and npm publication is permanent in
  practice. Releases follow the three release states (candidate,
  release-prepared, published) in wiki
  [11](../wiki/11-build-release-governance.md#the-three-release-states).

## Cadence and approval

- **Minors ship on a monthly train.** Patches ship as needed. Majors are rare.
- **Patch releases have standing owner approval** once every release gate is
  green. The owner approves each minor and major release.
- The 5.0.0 launch itself needs the owner's separate, explicit approval.

## Verification rule sets

**Proposed in draft RFC 0111; not in force until accepted.** A record is always
verified under the rule set of the version it declares. Every 5.x verifier
keeps every earlier 5.x rule set. A fix applies to new records only: a record
that declared an earlier version is verified under that version's rules.

## Breaking changes and deprecation

- Before a breaking change, the affected surface is deprecated for at least
  **one minor release and 90 days**, whichever is longer. The deprecation is
  stated in the CHANGELOG and, for APIs, in the code.
- A metric id keeps its meaning forever. A new meaning gets a new id, and the old
  id is deprecated, never redefined ([Adding a metric](ADD_METRIC.md)).
- Validation codes are never renumbered or reused. A retired code stays
  reserved.
- Emergency security fixes may be merged immediately and documented afterward
  (GOVERNANCE.md), even when the earlier behavior was the vulnerability.

## Normative changes

- An RFC in `docs/rfcs/` for anything that changes what a conforming
  implementation must do (wiki 11, "When does my change need an RFC?").
- **The project launches in owner-led mode**: the owner may accept an RFC
  immediately. **Collaborative mode begins when the first RFC or pull request
  from an outside contributor arrives**, and the owner announces it in
  [GOVERNANCE.md](../../GOVERNANCE.md). From then on a normative change needs a
  public comment period of at least 14 days, owner approval, and a reference
  implementation in the same PR or a linked follow-up.
- Spec, schemas, protocol and conformance change together (invariant 7).

## Signing keys

- The protocol rule (Protocol §V.11.4): rotate by issuing new blocks under a new
  `kid` and keeping the old key loaded. A `kid` is never reused for a different
  key, and blocks signed under a retired `kid` stay verifiable while a key store
  holds it.
- Keys the project holds (release provenance and any project-signed modules):
  - rotate at once on suspected compromise, and say so in the release notes;
  - otherwise rotate every year;
  - publish the retired `kid` alongside the new one.

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
