---
rfc: 0127
title: Make portable receipt conformance engine-relative
status: accepted
author: UWMD maintainers
created: 2026-10-25
affects:
  - protocol-spec
  - conformance-corpus
  - tooling
---

# RFC 0127 — Portable receipt conformance uses the verifier's engine identity

**Status:** accepted
**Affects:** conformance runner, protocol test configuration, independent Python implementation

## Problem

Receipt §5.3 compares the complete computation-engine identity pair. A finite
result disagreement is failed/RCP-03 for the same engine and unverifiable with
RCP-07 plus RCP-03 for another engine. The portable cases froze the reference
engine's verdict and exit. An independent conforming engine therefore could not
pass five same-engine baselines while reporting its own identity truthfully.

## Decision

Keep receipt semantics, wire values, formulas, precedence and numeric boundaries
unchanged. The portable runner accepts explicit test configuration
`--receipt-engine <name> --receipt-engine-version <version>`. Require both members
together and record them in its evidence report. No identity is inferred from a
manifest id/version: a toolkit's version need not be its computation engine's.

Nine generated finite-disagreement cases carry an explicit
`expect.receipt_engine_sensitive: true` marker. For those cases only, compare the
configured pair with the receipt's issuing pair. Different engines require
unverifiable, exit0 and RCP-07; identical engines require failed, exit1 and no
RCP-07. RCP-03 and every existing recomputed-id expectation remain mandatory.
Existing baseline files and receipt/source bytes are unchanged. Without explicit
configuration the runner retains their reference expectations.

Procedure refusals are not finite disagreements. They remain failed/RCP-03 with
recomputed:[] for every engine identity and are never marked or adapted. Subject,
input, rule-set, authentication and result-digest cases are also unchanged.

This is conformance-driver configuration, not a production CLI option, new
manifest member, receipt field, signature algorithm or financial convention.
Python declares org.uwmd.python / 0.0.0-dev; it does not impersonate @uwmd/verify.

## Implementation and controls

The shared driver computes the expected engine-relative verdict before checking
the exit and JSON projection. Its checks require RCP-07 presence to agree with
the declared pair in both directions. Unit controls pin unchanged disagreement
and recomputed evidence, input immutability, complete identity and the exclusion
of the procedure-refusal case. Independent Python commands run through the same
driver with the explicit configuration on Windows, Linux and macOS. The reference
keeps its existing default baseline checks.

No package version, dependency, release or optional-profile claim changes here.
