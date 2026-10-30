---
rfc: 0130
title: Give indeterminate receipt verification a distinct nonzero exit
status: accepted
author: UWMD maintainers
created: 2026-10-30
affects:
  - protocol-spec
  - conformance-corpus
  - tooling
---

# RFC 0130 — Receipt verification exits 3 when unverifiable

## Problem

`verify-receipt <receipt.json> <file> --json` currently exits 0 for an
`unverifiable` result, including RCP-05 when named-pack coverage cannot be
established. A script checking only the process status can mistake this for
verification. The starter `receipt verify` command already distinguishes
verified, failed and unverifiable with exits 0, 1 and 3.

## Decisions

| Question | Decision | Precedent |
|---|---|---|
| How should completed receipt verification exit? | 0 for verified, 1 for failed, 3 for unverifiable, in text and JSON modes | Existing `receipt verify` and the three-state receipt contract |
| What about unreadable receipts and internal errors? | Keep refused `{ error }` at 1 and internal errors at 2 | Protocol §II.6a.2 |
| Does engine-relative indeterminacy differ? | It also exits 3; retain all verdict, code and recomputation comparisons | Receipt §5.3 and RFC 0127 |

This changes only the receipt command's process status. It supersedes RFC 0115
and RFC 0127's exit-0 rule for unverifiable receipts. Other `verify-*` commands
keep their contracts. No receipt member, metric, financial convention,
authentication rule, dependency or version changes. JSON stdout remains one
verification result even when exit 3 indicates that verification is incomplete.

## Implementation and conformance

Synchronize Protocol §II.6a.2, its executable mirror and the receipt-result
schema annotation with the reference and independent Python CLI wrappers.
Regenerate portable receipt case exits. Engine-relative runner adaptation uses
3 for different-engine finite disagreement and 1 for the same engine, with
unchanged RCP-03/RCP-07 and recomputed-id evidence requirements.

Actual CLI controls cover packless RCP-05 in text and JSON, other-engine
indeterminacy, a demonstrated failure and malformed-receipt refusal. Shared
driver controls reject exit 0 for an unverifiable engine-relative result.
Existing receipt tamper and authentication-precedence controls remain intact.
