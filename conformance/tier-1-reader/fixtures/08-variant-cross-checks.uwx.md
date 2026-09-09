---
uw_version: "1.1"
deal_id: TEST-VARIANT-CC
deal_name: "Variant Cross-Check Fixture"
created: "2026-09-09T00:00:00Z"
last_modified: "2026-09-09T00:00:00Z"
property_address: "16 Variant Way"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
deal_stage: screening
status: under_review
recommendation: pending
flags: []
blocking_flags: []
tier: analyst
created_by: "test-fixture"
---
# Variant cross-check fixture (RFC 0037)

Three sections a cross-check reads are present as variant maps. One resolves
under the §5.3 preference order and its check fires; two do not resolve, so
their checks are skipped and `CC-16` names each of them once.

- `due_diligence` is `appraisal` + `environmental`. `CC-08` prefers
  `appraisal`, resolves, and finds `appraised_value` $1M off `valuation`.
- `operating_statement` is `t3` + `budget` — no `t12`, `default` or `base`,
  so `CC-01` is skipped (`variant_unresolvable`).
- `stress_tests` is `downside` + `upside` — no `default` or `base`, so
  `CC-07` and `CC-09` are skipped.

```json uw:section=property source=manual ts=2026-09-09T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-09-09T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "address": "16 Variant Way, Phoenix AZ",
  "total_units": 120
}
```
```json uw:section=valuation source=manual ts=2026-09-09T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "valuation",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-09-09T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "purchase_price": 10000000,
  "underwritten_value": 10000000,
  "appraised_value": 10000000
}
```
```json uw:section=due_diligence variant=appraisal source=manual ts=2026-09-09T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "due_diligence",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-09-09T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "appraised_value": 9000000,
  "appraisal_date": "2026-08-15"
}
```
```json uw:section=due_diligence variant=environmental source=manual ts=2026-09-09T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "due_diligence",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-09-09T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "phase_one": "no_recognized_environmental_conditions"
}
```
```json uw:section=rent_roll source=manual ts=2026-09-09T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "rent_roll",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-09-09T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "gross_potential_rent": 1800000
}
```
```json uw:section=operating_statement variant=t3 source=manual ts=2026-09-09T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "operating_statement",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-09-09T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "gross_potential_rent": 1750000
}
```
```json uw:section=operating_statement variant=budget source=manual ts=2026-09-09T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "operating_statement",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-09-09T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "gross_potential_rent": 1900000
}
```
```json uw:section=debt_structure source=manual ts=2026-09-09T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "debt_structure",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-09-09T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "loan_amount": 6500000,
  "ltv": 0.65,
  "annual_debt_service": 480000
}
```
```json uw:section=dcf source=manual ts=2026-09-09T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "dcf",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-09-09T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "assumptions": { "exit_cap_rate": 0.055 }
}
```
```json uw:section=stress_tests variant=downside source=manual ts=2026-09-09T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "stress_tests",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-09-09T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "base_case": { "exit_cap_rate": 0.065, "annual_debt_service": 480000 }
}
```
```json uw:section=stress_tests variant=upside source=manual ts=2026-09-09T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "stress_tests",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-09-09T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "base_case": { "exit_cap_rate": 0.05, "annual_debt_service": 480000 }
}
```
