---
rfc: 0033
title: Scope `capital_stack` to one point in time
status: implemented
author: jaredmaxey
created: 2026-09-01
affects:
  - format-spec
---

# RFC 0033: Scope `capital_stack` to one point in time

## Summary

Format § 4.24 models the capital stack as concurrent typed tranches: `amount`
is "the committed dollar amount", `position` orders seniority. Nothing says
*when*. A ground-up development deal carries two senior facilities in time
sequence — the construction loan funds the build and is retired by the
permanent takeout at stabilization — and § 4.24 as written forces that
producer to choose between double-counting the senior capital (stating both
as concurrent tranches) and misstating the deal (omitting one). This RFC
states the scope that § 4.24's own verification semantics already imply: the
stack describes **one point in time — the capitalization contemporaneous with
the NOI the sizing verbs read**. For a deal underwritten to stabilization
that is the stabilized (permanent) stack; facilities retired before that
point MUST NOT appear as concurrent tranches. Phased stacks are deferred to
the Phase 2 multi-period spine alongside the staged-funding work RFC 0026 § D
already parked there.

## Motivation

Raised by the underwriter.cc app team (their tracking id UPSTREAM-003, raised
2026-09-01 while implementing § 4.24): their engine currently **suppresses
the entire `capital_stack` section** for any deal whose sources carry
construction debt, because the spec gave them no honest way to state it. On
their canonical ground-up deal, stating the construction loan (~$17.5M) and
the permanent takeout (~$18.2M) as concurrent layers overstates senior
capital by roughly the whole construction balance — which misstates the
attachment point of every layer above, the exact harm the section exists to
prevent. Omitting either facility instead misstates the deal. Their ask named
three acceptable resolutions: (1) a temporal dimension on tranches, (2) an
explicit stabilized-only scope statement, or (3) one stack per phase.

The scope statement is not arbitrary — it is the only reading under which
§ 4.24's sizing table is coherent today. Every coverage verb recomputes
against `noi_model.net_operating_income`, the stated operating year. A
construction loan never coexists with stabilized NOI; `coverage` over it is
not a conservative approximation but a category error. The section already
knows this about *funding* — RFC 0026 § D explicitly defers staged funding,
future-funding holdbacks, and as-is/as-stabilized dual sizing to the Phase 2
multi-period spine. What it never said is what that deferral means for the
producer holding a construction loan **today**.

## Proposed change

Adopt the asker's option (2), as spec text in § 4.24's normative rules —
option (1) (a `phase` field with per-phase reconciliation and sizing rules)
and option (3) (discriminated per-phase stacks) are real designs, but both
need the multi-period spine to verify anything, and RFC 0026 already
sequenced that work. One rule added to the § 4.24 normative list, after the
OPTIONAL rule:

> - **The stack is one point in time.** The section states the capitalization
>   contemporaneous with the operating year the sizing verbs read
>   (`noi_model.net_operating_income`) — for a deal underwritten to
>   stabilization, the stabilized (permanent) stack. Facilities that do not
>   coexist at that point MUST NOT be stated as concurrent tranches: a
>   construction loan and the permanent takeout that retires it are one
>   senior position in time sequence, and stating both double-counts the
>   senior capital and misstates every attachment point above it. A producer
>   underwriting a ground-up development SHOULD emit the stabilized stack —
>   the takeout senior plus the layers that survive into stabilization — and
>   MUST NOT add the retired construction facility to it. Phased stacks
>   (construction → takeout, draw schedules, as-is/as-stabilized dual sizing)
>   are deferred with the multi-period spine (RFC 0026 § D; RFC 0033).

A `bridge` tranche is unaffected and remains stateable: a deal underwritten
*during* its bridge period states the bridge-period capitalization, which is
the point in time its NOI describes. The rule forbids mixing points in time,
not any particular facility class.

## Compatibility analysis

No shape change: no schema field is added or removed, and every existing
conforming document remains conforming — the rule forbids a combination
(temporally disjoint facilities as concurrent tranches) that no shipped
example, fixture, or known document states. The format version does not move
("every format change is additive at 1.x", and this adds a constraint on a
combination that was previously unstatable honestly rather than a new
construct). Producers that suppressed the section for construction-carrying
deals can now emit the stabilized stack and be conforming; that is a strict
widening of what they can say.

## Conformance impact

Not mechanically checkable at this version: tranches carry no temporal
marker, so a validator cannot distinguish a construction loan stated
alongside its takeout from two genuinely concurrent senior facilities (an
A/B structure states two notes at distinct `position`s and is legal). The
rule binds producers the way § 4.24's "an agent MUST NOT invent a tranche
`rate`" already does — normatively, without a code. When the Phase 2 work
adds a temporal marker, the marker's validator inherits this rule as its
first check. No corpus change.

## Reference implementation

No code. `verifyCapitalStack` already recomputes every sizing figure against
the single stated operating year; this RFC makes the spec say which stack
that year implies. The spec bullet lands in the same commit as this document.

## Alternatives considered

- **A temporal dimension on tranches** (`phase: construction | permanent`, or
  `active_from`/`retired_by`) — the eventual right answer for development
  underwriting, but per-phase reconciliation (which phase does `CC-03` check
  against `debt_structure`?) and per-phase sizing need the multi-period
  cash-flow spine RFC 0026 § E already scopes to Phase 2. Landing the field
  without the spine would ship syntax whose semantics nothing can verify.
- **One stack per phase** (discriminated) — same dependency, plus a shape
  change to the section and its schema for a case one scope sentence covers.
- **Say nothing** — leaves the standard's first serious adopter suppressing a
  whole section on development deals, and every future producer re-deriving
  the same choice between double-counting and omission.

## Unresolved questions

- **Where the temporal marker eventually lives** — on the tranche
  (`active_from`/`retired_by`) or on the stack (one stack per phase) — is
  left to the Phase 2 RFC, which will have the multi-period spine in hand
  and with it the reconciliation and sizing semantics either design needs.
- **Whether `sources_uses` needs a matching statement.** A ground-up deal's
  sources legitimately name the construction facility (it funds the build);
  the stack states the stabilized capitalization. The generalized `CC-03`
  reconciles the stack's senior tranche with `debt_structure` and the
  `sources_uses` senior bucket, which for a ground-up deal underwritten to
  stabilization should all describe the takeout. This RFC believes that is
  already the natural reading, but flags it for the Phase 2 author.

## Prior art

- Lender underwriting practice: a permanent-loan sizing memo underwrites the
  stabilized capitalization; the construction facility appears in sources and
  uses and in the takeout analysis, not as a concurrent layer of the
  stabilized stack.
- RFC 0026 § D of this project: staged funding and as-is/as-stabilized dual
  sizing were already deferred to the multi-period spine — this RFC completes
  that deferral by stating what v1 *does* describe.
