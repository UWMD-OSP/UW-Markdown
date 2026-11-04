---
rfc: 0133
title: Align malformed input-hash diagnostics
status: accepted
author: UWMD maintainers
created: 2026-11-04
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0133: Align malformed input-hash diagnostics

**Accepted - 2026-11-04.** The owner accepted error-severity `INT-16` in validation and the same refusal code in JSON, XML and CSV conversion. `META-05` is unchanged.

## Summary

A malformed present non-null `_meta.integrity.input_hash` receives an error-severity validation diagnostic. Full-carrier conversion refuses the same malformed value with the same code, before its generic schema refusal. This addresses issue #629 without repairing source artifacts.

## Motivation

Issue [#629](https://github.com/UWMD-OSP/UW-Markdown/issues/629) demonstrates ordinary validation reporting clean while full-carrier serialization refuses malformed input hashes as `ENVELOPE_INVALID_SCHEMA`. The current block/carrier schemas admit null, the empty string, or `sha256:` followed by 64 lowercase hexadecimal characters. Null is an admitted unknown value and is not malformed.

## Accepted change

### Rules

- A present non-null input hash MUST be a string equal to `""` or matching `^sha256:[0-9a-f]{64}$`. A wrong type, wrong length, uppercase hex, whitespace or other prefix MUST be reported as an error.
- Accepted allocation: **`INT-16`**, error, "Malformed integrity input hash". The finding MUST identify `_meta.integrity.input_hash` and its section/variant; repeated physical blocks MUST retain deterministic source-order evidence.
- SOURCE and MODEL validation MUST apply this shape rule to each retained physical block that the full carrier admits, including superseded blocks. This is current structural admission, not a retention or repair obligation.
- JSON, XML and CSV full-carrier conversion MUST run the shared bounded shape preflight and refuse with `INT-16` for the same malformed input, before a generic carrier-schema error obscures it. Other schema findings retain their existing owners.
- An absent integrity container, absent input-hash member, or explicitly null hash MUST retain its separately defined admitted behavior. No hash is inferred, shortened, normalized, synthesized or rewritten.
- This rule validates syntax only. A well-shaped hash proves neither that an upstream input was checked nor that the source facts are true.

## Synchronized contract and implementation order

Format metadata rules, Protocol registry, executable `protocol.ts`, exact block-schema grammar and its generated carrier mirror declare `INT-16`. The acceptance PR tests the admitted domain and code ownership as normal passing tests. The separately ordered implementation PR #646 carries normal passing SOURCE/MODEL validation and JSON/XML/CSV refusal regressions; no expected-failure gate remains after implementation. This split permits contract acceptance before the implementation PR merges last, as directed.

Absent containers and members, explicit null, the empty string and well-formed lowercase SHA-256 values remain admitted. Wrong type, length, uppercase, prefix and trailing whitespace are malformed. This is syntax validation, not digest or signature verification. No package version or release changes.

## Reference implementation

Use one bounded shared syntax predicate in the verification package for
validation and full-carrier preflight. Keep it separate from digest matching,
chain assessment and signature authentication. Audit current affected expected
results; do not repair source artifacts to retain earlier outcomes.

The affected boundaries are verification metadata helpers, validator,
protocol.ts, Envelope admission, typed XML/CSV wrappers, and the independent
Python validation/envelope implementation. Source commitments remain separate
from full-carrier schema admission.

## Alternatives considered

Keeping only the generic carrier error leaves ordinary validation inconsistent.
Using META-05 would silently expand its existing closed predicate allocation.
Normalizing or synthesizing a hash would invent input evidence. One bounded
syntax owner with a preserved conversion code makes the two operations agree.

## Decisions

`INT-16` owns malformed input-hash syntax at error severity; `META-05` retains its closed predicates. Canonical block metadata is checked, with section/variant and deterministic physical ordinal evidence. Existing parent-shape errors keep their owner. The bounded preflight precedes generic carrier-schema admission, and XML/CSV preserve its typed code. No input is normalized or repaired.

## Prior art

The current input_hash domain in uwmd-block.schema.json supplies the admitted
values. Protocol III.6a supplies closed diagnostic ownership and physical/MODEL
traversal precedent; Protocol V.9-V.11 separates integrity syntax, digest checks
and authentication. Existing Envelope admission and typed representation
errors supply the conversion boundary. This proposal changes no financial math.
