---
rfc: 0058
title: 'Expense recoveries and the CAM true-up'
status: implemented
accepted: 2026-09-16
implemented: 2026-09-16
author: claude
created: 2026-09-16
depends_on:
  - 0034
  - 0054
  - 0055
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0058: Expense recoveries and the CAM true-up

## Summary

A commercial tenant record can say its lease is `nnn` and that its CAM is
capped at some percent. It cannot say what share of what pool that tenant pays,
what the cap is measured against, or what happened at last year's
reconciliation. Recovery income is the second-largest line in most commercial
deals and the document currently carries a lease type and one orphan number.

This contract types the recovery terms on the tenant record and adds an annual,
dated, stated-and-verified **true-up** record. Everything is optional, verified
where a figure is stated, and never projected. No future recovery is forecast,
no pool is allocated across tenants, and no monthly ledger is introduced —
RFC 0054 placed per-lease periodic economics out of scope until a consumer and
a calc-grammar answer exist, and this RFC respects that boundary by staying
annual and by using §4.26 as the dated sink.

It registers one validator family: `REC-NN` on format §4.9.

## Motivation

Today's tenant record (format §4.9) carries:

```json
"lease_type": "nnn | gross | modified_gross | absolute_nnn | null",
"cam_cap_pct": null
```

That is the whole recovery surface. What it cannot express:

- **The share.** `nnn` says the tenant reimburses operating costs. It does not
  say whether this tenant pays 4.1% of the pool or 38%. Pro-rata share is the
  single number every recovery calculation multiplies by, and there is no field
  for it.
- **What the cap is measured against.** `cam_cap_pct: 0.05` is meaningless
  without knowing whether it caps growth over the base year or over the prior
  year, and whether unused headroom carries forward. Cumulative and
  non-cumulative caps on the same lease diverge by material amounts inside three
  years. Two readers of the same document reach different numbers.
- **The stop.** A modified-gross lease recovers only expenses above a base year
  or a fixed per-square-foot stop. Neither has a home, so a modified-gross
  tenant is indistinguishable from a gross one.
- **Which expenses are recoverable.** The operating statement (§4.4) itemizes
  `real_estate_taxes`, `insurance`, `utilities`, `repairs_maintenance`,
  `contract_services`, `administrative` and the rest. Nothing connects a
  tenant's recovery to those keys, so the pool is an assumption the reader
  supplies.
- **What actually happened.** Recoveries are billed on an estimate and
  reconciled after year end. The document has no place to record that a tenant
  was billed $84,000, owed $91,300, and therefore carries a $7,300 receivable —
  which is a real, already-settled, auditable fact, exactly the kind of thing
  this format exists to carry.

The roadmap has listed "CAM true-up" as blocked behind the ledger decision.
RFC 0054 made that decision, and it unblocks this: a true-up is an **annual
reconciliation of a past period**, not a forward monthly projection. It needs
no collection iteration and no second period dimension.

## Proposed change

### Format §4.9 — `recovery_terms` on the tenant record

Add an optional `recovery_terms` object beside the existing `lease_type`:

```json
"recovery_terms": {
  "method": "net | base_year_stop | fixed_stop | fixed_amount | none",
  "pro_rata_share": 0.0412,
  "share_basis": "nra | gla | stated",
  "base_year": null,
  "expense_stop_per_sqft": null,
  "fixed_recovery_annual": null,
  "admin_fee_pct": null,
  "gross_up_pct": null,
  "recoverable_pool": ["real_estate_taxes", "insurance", "contract_services"],
  "cap": {
    "pct": 0.05,
    "over": "base_year | prior_year",
    "accumulation": "cumulative | non_cumulative | compounding"
  }
}
```

Normative rules:

- `method` is a **closed vocabulary**. A producer that means something else
  states `none` and carries the amount as other income rather than inventing a
  member.
- `pro_rata_share` MUST be a fraction in `(0, 1]` — not a percent
  (repo-wide convention; `0.0412` is 4.12%).
- Each entry in `recoverable_pool` MUST name a key that exists under
  `operating_statement.expenses` (§4.4), including `utilities` as a whole.
  A name that matches nothing is `REC-03`, because a pool that points at a
  non-existent expense silently recovers zero.
- `cap.accumulation` MUST be stated whenever `cap.pct` is stated. There is no
  default, because the three treatments disagree and picking one silently is
  how a reader gets a different number than the producer.
- `base_year` is REQUIRED when `method` is `base_year_stop`;
  `expense_stop_per_sqft` when `fixed_stop`; `fixed_recovery_annual` when
  `fixed_amount`. A method without its input is `REC-02`.
- `gross_up_pct`, when stated, is the **occupancy the pool was grossed up to**,
  as a fraction. It is recorded, not applied: this RFC does not gross up a pool.

### Format §4.9 — `recovery_true_up`, an annual reconciliation

Add an optional array of dated reconciliation records:

```json
"recovery_true_up": [
  {
    "period_start": "2025-01-01",
    "period_end": "2025-12-31",
    "pool_actual": 2216000.0,
    "tenant_share_uncapped": 91299.2,
    "tenant_share_capped": 91299.2,
    "estimated_billed": 84000.0,
    "true_up_amount": 7299.2,
    "settlement": "billed | credited | disputed | unsettled",
    "cash_flow_ref": null
  }
]
```

Normative rules, all **stated-and-verified**, none derived:

- `period_end` MUST be on or after `period_start` (`REC-04`).
- The period MUST be closed — `period_end` strictly before the document's
  `as_of` date (`REC-05`). A true-up over a period that has not ended is a
  forecast, and this RFC does not carry forecasts.
- Where `pool_actual` and `pro_rata_share` are both present,
  `tenant_share_uncapped` MUST equal their product at the currency quantum
  (`REC-06`).
- `tenant_share_capped` MUST NOT exceed `tenant_share_uncapped` (`REC-07`).
  The cap arithmetic itself is **stated, not recomputed** — a cumulative cap
  depends on a base-year history the document does not carry, and inventing it
  is exactly the kind of silent assumption this project refuses. `REC-07` is
  the honest, checkable half.
- `true_up_amount` MUST equal `tenant_share_capped − estimated_billed` at the
  currency quantum (`REC-08`). A positive amount is owed by the tenant.
- `cash_flow_ref`, when stated, MUST resolve to a §4.26 `cash_flow_series`
  (`REC-09`), which is where the settled amount becomes a dated cash line the
  assembler and receipt coverage can already verify. This is the cross-cutting
  requirement that §4.26 is the addressable sink for new dated cash.

### Validator family `REC-NN` (protocol §XI code table)

| Code | Severity | Refuses |
|---|---|---|
| `REC-01` | error | `pro_rata_share` outside `(0, 1]`, or stated as a percent (> 1) |
| `REC-02` | error | A `method` whose required input is absent |
| `REC-03` | error | A `recoverable_pool` entry naming no §4.4 expense key |
| `REC-04` | error | `period_end` before `period_start` |
| `REC-05` | error | A true-up period that has not closed as of the document date |
| `REC-06` | error | `tenant_share_uncapped` disagreeing with `pool_actual × pro_rata_share` |
| `REC-07` | error | `tenant_share_capped` exceeding `tenant_share_uncapped` |
| `REC-08` | error | `true_up_amount` disagreeing with capped share less billed |
| `REC-09` | error | `cash_flow_ref` that does not resolve |
| `REC-10` | warning | `cam_cap_pct` stated alongside `recovery_terms.cap` — the legacy field is superseded and the two can disagree |

### Library surface

Additive exports from `@uwmd/core`:

- `verifyRecoveryTrueUp(terms, rows, context)` → `RecoveryVerification`,
  following the `verifyWaterfall` / `verifyCashFlowSeries` posture: no claims
  means `verified`, an unresolvable reference means `unverifiable`.
- Types `RecoveryTerms`, `RecoveryTrueUpRow`, `RecoveryVerification`.

## Compatibility analysis

- **Existing `.uw.md` files** — unaffected. Both fields are optional; a document
  stating neither behaves byte-identically and validates exactly as before. One
  conformance fixture proves that.
- **`cam_cap_pct`** — retained, not removed. It becomes a legacy alias that
  `REC-10` warns about when contradicted. Removing it would break files in the
  wild for no gain.
- **Tier-1 Reader / Tier-2 Editor** — unaffected; new optional object.
- **Tier-3 Calc Host** — unaffected. No pack formula reads these structures.
  Consistent with the RFC 0054 finding, calc paths are flat identifiers and
  these are collections; they are read by verifiers and host code.
- **Tier-4 Agent Host** — an agent may extract and state these figures. It MUST
  NOT compute them, per invariant 1.
- **Modules** — no manifest change.
- **Protocol** — additive: one new code family. Minor bump.

## Conformance

Per the cross-cutting requirement, at minimum:

- one engine-produced fixture with a full net-lease recovery and a settled
  true-up that verifies;
- one absent-case fixture proving a document with no `recovery_terms` is
  byte-identical and verifies as before;
- one fixture per refusal code `REC-01`–`REC-09`;
- one `REC-10` warning fixture with both `cam_cap_pct` and a `cap` object;
- one base-year-stop and one fixed-stop fixture, since the two methods are the
  ones most often conflated.

## Alternatives considered

1. **Recompute the cap.** Rejected. Cumulative and compounding caps need a
   base-year history across prior reconciliations that the document does not
   carry. Recomputing from one year would produce a confident wrong number.
   `REC-07` checks the direction, which is the part that is actually knowable.
2. **Allocate the pool across tenants.** Rejected. That requires every tenant's
   share to sum correctly and a policy for vacant space; it is a modeling
   decision, not a recorded fact. Each tenant states its own share.
3. **Put recoveries in the deferred per-lease periodic series.** Rejected by
   RFC 0054's own reasoning: an annual reconciliation of a closed period is not
   a periodic ledger and does not need one.
4. **Leave it to `other_income.utility_reimbursements`.** That is where
   recovery income lands today, and it is why a reader cannot tell a capped
   modified-gross recovery from a flat reimbursement.

## Errata (implementation)

Two things the draft got wrong, corrected in the implementation rather than
carried forward:

1. **The section is §4.3, not §4.9.** The commercial tenant record lives in the
   Rent Roll (§4.3) — which is where RFC 0055 put the lease clauses these sit
   beside. §4.9 is the DCF section. Every rule is registered against §4.3.
2. **No `verifyRecoveryTrueUp` export.** The draft proposed a verifier surface
   like `verifyWaterfall`. That was the wrong shape: a verifier surface exists
   where an engine recomputes a whole allocation (§4.24–§4.27), and a CAM
   true-up is three subtractions. It is implemented in the validator, matching
   its actual siblings — `TAX-NN` (RFC 0053), `HDG-NN`/`ESC-NN` (RFC 0056) and
   `CAPX-NN` (RFC 0057) all do arithmetic there. Adding a verifier export would
   have introduced a second place to look for one contract's rules.

A third refinement: `REC-05` anchors on the rent roll's own `as_of_date` and is
**skipped when that is absent**, rather than falling back to file metadata as
"the document's `as_of` date" loosely implied. File metadata is an edit
timestamp; using it would refuse a legitimately re-saved document.

## Unresolved questions

- **Whether `REC-05` should be a warning for a fragment.** A `.uwpart.md`
  lease abstract may legitimately carry a true-up for a period that has not
  closed relative to *its own* thin metadata. The LU-04 precedent suggests a
  downgrade; proposed here as staying an error, matching the `WF-02` posture.
- **Whether the recoverable pool should support a label-bearing `other`,**
  as RFC 0052's `sale_deductions` and RFC 0056's escrows do. Proposed: no, on
  the grounds that the pool names §4.4 keys and §4.4 already has
  `other_expenses`. Worth a reviewer's second look.
- **Admin fee base.** `admin_fee_pct` is stated but this RFC does not say
  whether it applies to the pool before or after the cap. Both conventions
  exist. Proposed: state the resulting figures and do not take a position,
  consistent with RFC 0055's decision to state resulting rent rather than the
  increment.
