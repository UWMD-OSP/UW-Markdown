---
rfc: 0088
title: Reproduce stated L1 acquisition projections under declared conventions
status: draft
author: codex (owner-directed scope proposal)
created: 2026-10-15
depends_on:
  - 0016
  - 0041
  - 0078
  - 0081
  - 0083
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0088: Reproducible L1 acquisition projections

## Summary

Propose an optional normative `projection` verification profile for bounded L1
acquisition pro formas, following [Issue355](https://github.com/UWMD-OSP/UW-Markdown/issues/355)
and its refined convention table. The owner wants a working profile and genuinely
independent reproduction considered foundational before public launch; this is
planning direction, not acceptance of a formula, schema, package or convention.
This draft defines the scope and decisions needed to finish the normative design.
It is **not implementation-ready** until the procedures, field mappings and
compatibility decisions below are pinned. Nothing changes the current contract.

## Motivation

Current Protocol VIII.2a and VIII.9–12 reproduce defined metrics, period-addressed
stated series, dated cash flows, lease-up mappings, assembly, waterfalls and
reserves. They do not define a full revenue/expense/debt/exit forecast. A correct
ratio over stated NOI and debt service does not prove those two inputs follow
from stated growth or loan terms. Phase2 regressions test starter calculations;
they cannot establish a missing normative acquisition procedure.

The proposed profile follows RFC0078 D9's distinction between choosing inputs and
reproducing a claimed result. Assumption selection remains producer/starter work;
a producer claiming this profile must state inputs/conventions sufficient for an
independent verifier to reproduce every claimed output. This would selectively
supersede RFC0078 D1/D7 **only after acceptance**. The implemented RFC0078 and
current Format/Protocol files are not edited by this proposal.

## Proposed change

### Bounded first scope

Recommend a stabilized multifamily acquisition, all equity or one stated
fixed-rate loan, with explicit growth/revenue/expense inputs, vacancy and credit
loss, reserves/capex, IO/amortization, exit and investor cash flows. Reuse existing
fields only where their meanings agree. This is a proposal requiring owner
confirmation; no new official asset class is proposed and existing builtin class
contracts remain mandatory where already supported.

Cover a full path from acquisition sources/uses and closing equity through
period revenue → EGI → expenses → NOI/NCF → debt interest/principal/balance →
coverage → exit value/deductions/payoff → equity distributions → returns. All
equity must be a supported deliberate case, not a divide-by-zero fallback. State
which amounts are inputs and which are recomputed, with exact source variants,
periods, currencies/units and provenance. Incomplete sources/uses cannot become
verified equity or returns. Loan sizing optimization and preferred/multi-tranche
projection are not implied; current capital-stack validation remains unchanged.

A complete design must pin this procedure inventory:

| Procedure | Required normative decisions before implementation |
|---|---|
| Timeline | Analysis/acquisition dates, hold endpoints, monthly/annual periods, stubs, leap years, cash-event dates and mapping of annual outputs; no positional year inference |
| Revenue/EGI | Eligible revenue lines, growth cadence/start, vacancy and credit-loss bases, occupancy path, other income and reimbursements; no defaults for undeclared conventions |
| Expenses/NOI/NCF | Per-line units and expense class, management fee basis, reserves placement, TI/LC/capex treatment and named NOI/NCF outputs |
| Debt | Stated principal/closing proceeds, fixed rate, payment/accrual basis, IO transition, amortization term, exact balance update order, balloon/payoff and zero-debt applicability |
| Coverage | Exact NOI/NCF numerator, actual versus amortizing-constant debt service, loan-at-close versus period balance, quantization and zero/negative denominators |
| Exit | Forward/trailing period and NOI/NCF measure, sale-price or cap-rate basis, selling costs, final cash event, loan payoff and no double counting |
| Investor returns | Closing contributions/costs, gross contributions/distributions, levered/unlevered series, periodic versus dated timing, annualization, CoC basis, NPV discount timing and fixed IRR/XIRR failure procedures |

The refined table in [comment6205783023](https://github.com/UWMD-OSP/UW-Markdown/issues/355#issuecomment-6205783023)
is the input proposal, not an adopted registry. Finalize a closed, versioned
registry with explicit admissible combinations and refusal of unknown or
unsupported combinations. Reuse the day-count and final quantization contracts;
do not round each intermediate balance merely because a spreadsheet displays
cents. Decide the exact operation order and any transcendental procedure needed
for compounding: binary64 alone does not guarantee cross-language `pow` behavior
at a final quantization boundary. Pinned procedures, stopping rules and comparison
scope must make those boundaries reproducible.

**Existing metric meanings are an explicit gate.** A proposed NCF-based coverage
ratio cannot silently replace canonical dictionary `dscr`; an above-NOI reserve
convention cannot silently redefine an existing NOI field. State exact mappings,
new profile output names where needed, applicability and any deliberately proposed
normative changes before implementation. Keep RFC0086 purchase-price and RFC0087
hospitality reconciliation decisions separate. They are not prerequisites for
writing a multifamily timeline/debt engine; they remain proposed launch work.

### Verification contract to finish

The accepted profile would require complete declared inputs/conventions for its
claimed outputs, deterministic recomputation, and explicit failed versus
unverifiable versus not-invoked results. Missing inputs, non-convergence, invalid
structure and unsupported conventions must not be labeled verified. Optional
profile absence does not retroactively invalidate base-verifier records; a claimed
profile cannot silently fall back to the base ratio check. Define output schema,
source binding, calc-context selection, result vocabulary/severity and profile
claim/unsupported behavior together before acceptance. No schema is supplied or
new obligation activated in this scope draft.

Return procedures must reuse existing pinned IRR/XIRR where applicable, not a
spreadsheet's unspecified solver. Specify any additional timing/annualization
operation exactly. One issue comment says simple monthly IRR ×12 overstates the
compounded annual result. That is not a general numerical fact: a Python binary64
counterexample with monthly rate0.01 gives0.12 versus
`(1.01 ** 12) - 1 = 0.12682503013196977`. The declared compounded procedure can be
proposed without adopting that incorrect rationale or introducing a new convention.

## Compatibility analysis

Base Reader/Verifier obligations and existing metric definitions remain unchanged
until an accepted contract explicitly changes them. New claimed-profile outputs,
required conventions, schema and result applicability need migration/unsupported
handling. No record should acquire unstated modeling assumptions on upgrade.
Receipt/profile identity and canonical subject coverage must be designed under
existing receipt rules; do not assume an existing base-pack receipt proves L1
reproduction or invent a new receipt version in an implementation PR.

The suggested separate `@uwmd/projection` package is an option, not approved
packaging. Preserve RFC0083's small verifier and dependency layering; define
optional profile loading and explicit implementation-manifest capabilities before
adding dependencies. No package/version/manifests are changed here. Format,
Protocol and packages keep independent versioning;5.0 publication is not authorized.

## Conformance impact

No existing fixture or baseline changes in this draft. Acceptance requires a
portable per-procedure and whole-deal fixture plan, with deterministic expected
outputs traceable to the accepted procedures. Include:

- All-equity and fixed-rate acquisitions; IO versus amortization; final balance
  and payoff; closing equity/source-and-use identities.
- Zero/null/missing inputs, negative income, absent/ambiguous variants, incomplete
  sources/uses and unsupported financial assumptions with distinct refusals.
- Stubs, leap days, irregular dates, sparse/reordered periods, timing and final
  quantization ties/overflow. Test disputed conventions under at least two
  admitted alternatives; do not require an impossible cross-product or silently
  default an unsupported combination.
- Forward/trailing exits, reserves/NCF choices, actual/sizing debt service,
  declared IRR frequency, CoC and NPV without changing canonical base metrics by
  accident. Test invalid/undeclared conventions and missing-profile capability.
- Cross-implementation TypeScript/Python results and independent spreadsheet
  evidence using the same declared assumptions and output quantization. Rendering
  and solver differences must not be confused with numerical disagreements.

The current portable baseline is350 cases: Reader17, Verifier281, Integrity14,
module1 and starter37. Those cases do not already test this absent profile.
New cases must enter the normative corpus through an accepted RFC, not be
regenerated from one implementation as their sole justification.

## Reference implementation

After acceptance, implement the procedures in an explicitly selected optional
profile surface; integrate read-only validation, exact source lineage and CLI/API
capability claims without replacing ordinary metrics. Core/Excel consumers must
use the accepted definitions rather than a second metric registry. Tests must
cover full cash-flow/equity identities and negative-verdict controls, not only
one formula at a time. Update receipts/profile bindings only under the chosen
contract and preserve unchanged-source provenance.

[Issue354](https://github.com/UWMD-OSP/UW-Markdown/issues/354) is the genuinely
independent Python implementation lane: base Reader/Verifier first, this profile
next. It must implement from normative procedures, not invoke/translate the TS
engine or return corpus expected values. Record issues where the spec is silent;
TS behavior alone cannot resolve them. Python and the TS implementation may
share the normative data/corpus, never one arithmetic implementation.

Separately author an acquisition workbook and actually recalculate it in the
identified spreadsheet engine. XML/formula inspection, emitted cached values and
shared TS calculation code are useful tests but are not independent Excel
recalculation. Microsoft Excel evidence is needed for a Microsoft Excel parity
claim; a different engine must be named honestly. Store synthetic inputs,
convention selections, engine version, commands/procedure, exact outputs and
quantization differences in the existing review artifacts.

## Alternatives considered

- Keep forecasts vendor-only: preserves today's boundary but does not satisfy
  the owner's proposed foundational launch guarantee.
- Adopt one vendor model: conceals assumptions and gives no neutral convention
  contract; not selected.
- Require monthly-only calculations: smaller surface, but would exclude stated
  annual-basis models; decide the bounded first matrix explicitly.
- Arbitrary custom period-vector expressions in L1: larger grammar, dependency
  ordering and circularity contract. Recommend fixed procedures first; custom
  lines need a follow-on RFC rather than invented collection semantics.

## Unresolved questions

Before acceptance, the owner must confirm the L1 asset/financing boundary; finalize
registry options and admissible combinations; approve full procedure/field/output
mappings and solver/precision details; define profile result/receipt compatibility;
and select packaging/capability integration. Every procedure above needs an
implementable algorithm, not just its financial name. These are design gates,
not permission to leave missing assumptions to the reference engine.

L2 lease rollover/recoveries/floating paths and sizing; L3 construction/tax and
N-party waterfalls; lender-program extensions; broad new asset classes; arbitrary
period-vector custom lines; and general goal-seek are not default launch gates.
Promote one only with a concrete foundational claim that cannot be satisfied by
bounded L1. Existing optional profiles remain valid contracts where claimed.

## Prior art

RFC0078 D9 demonstrates optional reproducibility profiles without assumption
selection. RFC0041 fixes period identity; Protocol VIII.9.1 fixes day-count names;
VIII.3/VIII.9 pin IRR/XIRR; RFC0044/0045 separate stated amount projection and
assembly. Their existing limits remain current until this RFC is accepted.
The [Phase2 review](https://github.com/UWMD-OSP/UW-Markdown/blob/main/docs/reviews/2026-10-15-financial-verification-phase-2.md)
records current arithmetic coverage and unsupported end-to-end modeling.
