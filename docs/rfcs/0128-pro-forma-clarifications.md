---
rfc: 0128
title: Clarify RFC0092 admission, ledger roles and reports
status: accepted
author: UWMD maintainers
created: 2026-10-25
affects:
  - format-spec
  - protocol-spec
  - conformance-corpus
  - tooling
---

# RFC 0128 — RFC0092 admission, ledger roles and report details

**Status:** accepted, 2026-10-25.

## Problem and scope

The independent #551 comparison found different readings of RFC0092's declared
context, ledger membership and report presentation. The owner accepted the six
T1/T4/T5/T6/T9/T11 dispositions and report-only clarifications as a 4.x change.
This RFC states those decisions, synchronizes the current contract and changes
reference admission where required. It introduces no financial convention,
formula, operand, operation order, numeric quantum or registry member.

RFC0092 section4b/6a and the Format/Protocol bounded pro-forma contracts are amended by
this RFC. Registry `uwmd.pro-forma.l1.1` retains its fifteen entries. No optional
profile support is claimed; independent #551 and actual-runtime #552 remain
separate gates.

## Decisions

| Item | Accepted rule | Basis and implementation |
|---|---|---|
| T1 | Every relationship whose unit is `$` MUST state `currency`, exactly equal to frontmatter `currency_code`; neither declaration supplies the other. | Current monetary identity admission; the claim schema requires relationship presence and runtime checks document equality. |
| T4 | A supplied effective `ltv_basis` convention MUST equal the selected loan's own explicit `ltv_basis`; contradiction makes that relationship locally unverifiable with `computed: null`, never silently ignored or recomputed on another basis. | The existing global-then-relationship convention merge applies; the loan's direct field remains authoritative and no convention fills an absent basis. |
| T5 | An unsupported string `convention_registry` is an error-severity `unsupported_registry` profile-claim finding and causes completed exit1, including with no rows or relationships. | Current reference behavior; no fabricated assertion and no request refusal solely for an unknown registry string. |
| T6 | For an admitted binding, only its canonical event identity decides whether it is in the declared universe; a known event bound under an undeclared role produces a `role_conflict` gap using the declared member's `required` flag, not an out-of-universe error. | An event absent from the universe remains an error-severity profile-claim finding; an optional role conflict alone does not change exit, while a required conflict is unmet and causes exit1. |
| T9 | When stabilized-summary occupied SF is actually used as the rate numerator fallback, it is a computed prerequisite that MUST be inventoried, claimed and verified before the rate can verify. | Existing fallback dependency behavior; a stated final-row numerator does not acquire an unused summary prerequisite. |
| T11 | Drop authored `selectors.loan`; `loan` input binding is the sole public loan selection, and supplied `selectors.loan` is unsupported relationship semantics. | Exact input addresses already cover unvarianted, named-variant and role-selected loans, native targets and custom headlines. |

### T11: one selection, no internal-key authoring

The public selectors are only `over` (string), `through` (integer at least1)
and `period` (string), subject to each identity's existing admission. Per-loan
LTV already requires an input with role `loan` and the exact current
`debt_structure` root address. That address selects the variant. Native loan
targets must agree with the bound loan; custom targets derive their loan context
from the same binding. Existing ambiguity and context checks remain.

There is no additional valid case requiring a second loan selector. The prior
reference check expected an operation-specific serialized report key, which is
not a producer-facing selection spelling. `loan_ref` remains a derived report
identity; it is not an authored selector or a cryptographic identity. A supplied
`selectors.loan`, whether a variant name or an internal-looking key, is retained
in local refusal evidence and makes the relationship unverifiable. It is not
ignored and does not pick another peer.

### Event identity and role admission

Structural admission precedes the T6 event-membership test; malformed or
unresolvable bindings retain their existing profile-claim error handling.
For admitted bindings, canonical event identity is resolved before roles,
aliases and duplicates. A role mismatch on a known event does not add a universe
member or invent a required obligation. The corresponding declared member's
required flag controls the gap's exit effect. Existing duplicate allocation,
conflicting declared membership, target conflicts and required-exclusion checks
remain; equal-valued distinct events remain distinct. No monetary assertion is
created by this membership assessment.

## Report-only details

These sentences pin existing reference presentation and do not change numeric
procedures or aggregate failure precedence.

| Item | Report rule |
|---|---|
| T3 | An otherwise admissible claim with unknown claim members or unsupported global convention values completes with error-severity profile-claim findings and exit1 rather than a whole-operation request refusal. |
| T7 | An excluded optional member without an admitted binding remains visible both in exclusions and as a non-required gap, with no exit effect on its own. |
| T8 | A valid exclusion of a required universe member remains in exclusions and as an unmet required gap, causing exit1. |
| T10 | For the existing MOIC/XIRR dated-return admission, a supplied currency unequal to document currency produces local unverifiable `currency_mismatch`, with ordinary assertion failure precedence unchanged. |
| T12 | Within each assertion/input collection, unresolved targets follow resolved targets in stable inventory-declaration order. |
| T13 | Using `declared_ledger_membership` as a numeric relationship produces local unverifiable `identity_not_defined`; the ledger object is the membership assessment. |
| P1 | Per-loan LTV reports the existing dictionary comparator's already quantized `computed` comparison result, with its fractional-token m2/r6 rules unchanged. |

T10 describes the existing non-money dated-return report path; it introduces no
additional admission rule for other native identities. Existing typed request
refusals, base validation ordering, local findings and source/model boundaries
are unchanged.

## Synchronized implementation and controls

The Format, Protocol, claim/report schemas, executable selector types and reference
assessment change together. T4 checks the supplied effective basis against the
bound loan. T6 uses event-level membership and required-sensitive role conflicts.
T11 removes the redundant selector from types, schema and admission while
preserving derived report context. T1/T5/T9 and report-only rules are documented
and pinned without changing their procedures.

Synthetic conformance documents from the independent comparison are copied
byte-for-byte for each exit-changing item, with positive, required/optional and
outside-universe controls. Source/model, exact public loan binding, rejected
internal selector, schema and real CLI regressions pin the declared behavior.
The independent evidence is read only and no independent implementation is run
or changed by this work. Reference regressions do not close #551/#552.

No version, dependency, release, publication or deployment change is made.
