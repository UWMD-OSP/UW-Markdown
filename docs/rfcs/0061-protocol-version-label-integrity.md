---
rfc: 0061
title: Keep protocol version labels synchronized
status: implemented
accepted: 2026-09-21
author: codex
created: 2026-09-21
affects:
  - protocol-spec
  - tooling
  - documentation
---

# RFC 0061: Keep protocol version labels synchronized

## Summary

Correct the two stale release labels in `spec/UW_PROTOCOL_v1.md` from `2.15.0`
and `2.8.0` to the authoritative Protocol version `2.17.0`, and extend
`verify-versions` so the compatibility matrix, executable protocol constant,
and both labels fail together if they drift again. This is an editorial
integrity repair: it changes no protocol behavior, schema, type, calculation,
or conformance requirement.

## Motivation

`VERSIONS.md` is the authoritative release matrix and
`packages/uwmd-core/src/protocol.ts` exports `PROTOCOL_VERSION = '2.17.0'`.
The protocol document nevertheless advertised `2.15.0` in its status line and
called itself `2.8.0` in §0.3. A consumer scraping either label could therefore
pin the wrong release even though the executable implementation and matrix
agreed. The existing version gate compared only the matrix and executable
constant, so both stale labels remained invisible to CI.

## Proposed change

In `spec/UW_PROTOCOL_v1.md`:

- the document status line says protocol **2.17.0**;
- §0.3 says the current Protocol version is `2.17.0`.

`scripts/verify-versions.mjs` MUST read those two locations and require both to
equal the `UW Protocol` row in the current `VERSIONS.md` matrix and
`PROTOCOL_VERSION`. The gate reports a distinct failure for a missing or
mismatched status-line or §0.3 label.

## Compatibility analysis

Existing `.uw.md` files remain valid. Reader, Editor, Calc Host, and Agent Host
behavior is unchanged. Module manifests and requirements are unchanged. This
repair only makes the protocol document accurately identify the release whose
rules it already contains.

## Conformance impact

No conformance fixture changes. The version-integrity gate is repository
tooling, not a new document-conformance requirement.

## Reference implementation

- **Files affected:** `spec/UW_PROTOCOL_v1.md`,
  `scripts/verify-versions.mjs`, and release/status documentation.
- **API surface:** none.
- **Test plan:** run `npm run verify-versions`, then the full build, test,
  conformance, schema, lint, lockfile, and package gates.

## Alternatives considered

Leaving the prose advisory was rejected because both locations present
themselves as the current Protocol version. Removing the duplicated labels was
rejected because the status line and versioning section are useful to readers;
making them mechanically checked retains that value without accepting drift.

## Unresolved questions

None. `VERSIONS.md` remains authoritative for release state; the protocol
document and runtime constant are checked mirrors.

## Prior art

The repository already applies the same single-source-and-checked-mirrors
pattern to package manifests and Format/Protocol constants in
`verify-versions`.
