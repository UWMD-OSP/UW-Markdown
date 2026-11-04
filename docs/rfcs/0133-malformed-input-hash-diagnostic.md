---
rfc: 0133
title: Align malformed input-hash diagnostics
status: draft
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

**Proposed — unaccepted.** Project-owner acceptance or revision is required.
The current standard is unchanged by this proposal-only PR.

## Summary

A malformed present non-null `_meta.integrity.input_hash` receives an error-severity validation diagnostic. Full-carrier conversion refuses the same malformed value with the same code, before its generic schema refusal. This addresses issue #629 without repairing source artifacts.

## Motivation

Issue [#629](https://github.com/UWMD-OSP/UW-Markdown/issues/629) demonstrates ordinary validation reporting clean while full-carrier serialization refuses malformed input hashes as `ENVELOPE_INVALID_SCHEMA`. The current block/carrier schemas admit null, the empty string, or `sha256:` followed by 64 lowercase hexadecimal characters. Null is an admitted unknown value and is not malformed.

## Proposed change

### Proposed rules

- A present non-null input hash MUST be a string equal to `""` or matching `^sha256:[0-9a-f]{64}$`. A wrong type, wrong length, uppercase hex, whitespace or other prefix MUST be reported as an error.
- Proposed new allocation: **`INT-16`**, error, "Malformed integrity input hash". The finding MUST identify `_meta.integrity.input_hash` and its section/variant; repeated physical blocks MUST retain deterministic source-order evidence.
- SOURCE and MODEL validation MUST apply this shape rule to each retained physical block that the full carrier admits, including superseded blocks. This is current structural admission, not a retention or repair obligation.
- JSON, XML and CSV full-carrier conversion MUST run the shared bounded shape preflight and refuse with `INT-16` for the same malformed input, before a generic carrier-schema error obscures it. Other schema findings retain their existing owners.
- An absent integrity container, absent input-hash member, or explicitly null hash MUST retain its separately defined admitted behavior. No hash is inferred, shortened, normalized, synthesized or rewritten.
- This rule validates syntax only. A well-shaped hash proves neither that an upstream input was checked nor that the source facts are true.

### Proposed wire work

After acceptance, synchronize Format metadata rules, Protocol code registry and executable `protocol.ts`, typed representation errors/schemas as necessary, both reference implementations, and paired portable validation/conversion cases. `INT-16` is a proposed allocation in this document, not a currently registered code.

## Current contract and synchronized changes

This proposal concerns current source/verification and starter tooling, not a
release authorization. Format/Protocol text, schemas, executable contracts and
applicable conformance cases must land together in the eventual implementation.
No package version or published compatibility baseline changes in this draft.

## Conformance impact

Pin error severity and exact field/code ownership for short hashes, uppercase
hex, whitespace and non-string values (including explicit zero). Preserve
absent, null, empty and correctly shaped hashes as admitted controls. Cover
SOURCE and mutable MODEL input, variants, superseded blocks, every retained
collection, source immutability and the same code through JSON/XML/CSV.

The proposal-only expected-failure gates execute the requested behavior without
claiming implementation support. A separate implementation draft turns them
into ordinary regressions; neither draft accepts this RFC.

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

## Unresolved questions

Confirm `INT-16` and the exact physical-block location carrier/first-error precedence. Determine whether any current conversion wrapper needs a typed error-wire adjustment to preserve that code. These decisions stay inside this proposal; do not allocate an unrelated diagnostic.

## Prior art

The current input_hash domain in uwmd-block.schema.json supplies the admitted
values. Protocol III.6a supplies closed diagnostic ownership and physical/MODEL
traversal precedent; Protocol V.9-V.11 separates integrity syntax, digest checks
and authentication. Existing Envelope admission and typed representation
errors supply the conversion boundary. This proposal changes no financial math.
