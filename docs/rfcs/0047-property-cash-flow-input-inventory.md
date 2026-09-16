---
rfc: 0047
title: Property cash-flow input inventory
status: implemented
author: jaredmaxey
created: 2026-09-13
accepted: 2026-09-13
affects:
  - core-library
  - tooling
---

# RFC 0047: Property cash-flow input inventory

## Summary

RFC 0045 deliberately refuses to infer expenses, reserve treatment, payment
timing, or economic completeness. That boundary is correct, but a real-deal
author currently has to discover the source shape while hand-authoring a plan.

This RFC adds a read-only inventory API and CLI command that expose the exact
lease-up variants, lease-up periods, supplemental rows, and stated metric names
available to an RFC 0045 plan author.

## Contract

`inspectPropertyCashFlowInputs(parsed)` MUST:

- report the authored document currency when present, otherwise `null`;
- report every current `lease_up_schedule` and `cash_flow_series` variant,
  including unlabelled blocks;
- report lease-up period labels and the required coverage-cell names that would
  apply if that schedule were selected;
- report supplemental row indexes, dates, finite numeric amounts, optional kind
  and label, and non-null stated metric names;
- mark a source variant `malformed` when the expected schedule or series shape
  cannot be inventoried; and
- return the fixed RFC 0045 plan-field list and explicit non-inference notes.

It MUST NOT verify metrics, classify supplemental rows, infer cash dates,
insert zero declarations, assert reserve or tax treatment, or modify the parsed
document. The CLI `inspect-property-cash-flows <file> [--json]` exposes the
same inventory and is read-only.

## Compatibility and verification

The addition is additive to the public API and CLI. It does not change the
RFC 0045 plan schema, assembler output, calculations, source bytes, or
conformance behavior. Unit and CLI tests cover usable and malformed shapes,
variant/period/row reporting, and refusal of write-like flags.

## Explicitly deferred

This inventory does not import Excel, create a valid assembly plan, propose
economic categories, infer closing or payment dates, verify factual accuracy,
or establish a real deal's completeness. Those remain adopter-supplied inputs
and review decisions.
