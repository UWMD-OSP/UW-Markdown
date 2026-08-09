---
uw_version: "1.1"
deal_id: uw_lite_typed_values
deal_name: "Typed Value Coverage"
created: "2026-08-08T00:00:00Z"
last_modified: "2026-08-08T00:00:00Z"
created_by: conformance
---

```json uw:section=assumptions confidence=high source=manual ts=2026-08-08T00:00:00Z v=1
{
  "_meta": {
    "actor": "conformance",
    "agent_id": null,
    "agent_version": null,
    "confidence": "high",
    "flags": [],
    "human_review_required": false,
    "input_hash": null,
    "notes": null,
    "section": "assumptions",
    "source": "manual",
    "superseded": false,
    "timestamp": "2026-08-08T00:00:00Z",
    "version": 1
  },
  "assumable_debt": true,
  "dscr_floor": 1.25,
  "exit_cap_rate": null,
  "hold_period_years": 7,
  "rent_growth": -0.015,
  "vacancy": {
    "year_1": 0.05
  }
}
```

```json uw:section=dcf confidence=high source=manual ts=2026-08-08T00:00:00Z v=1
{
  "_meta": {
    "actor": "conformance",
    "agent_id": null,
    "agent_version": null,
    "confidence": "high",
    "flags": [],
    "human_review_required": false,
    "input_hash": null,
    "notes": null,
    "section": "dcf",
    "source": "manual",
    "superseded": false,
    "timestamp": "2026-08-08T00:00:00Z",
    "version": 1
  },
  "terminal_value": null
}
```

```json uw:section=market_analysis confidence=high source=manual ts=2026-08-08T00:00:00Z v=1
{
  "_meta": {
    "actor": "conformance",
    "agent_id": null,
    "agent_version": null,
    "confidence": "high",
    "flags": [],
    "human_review_required": false,
    "input_hash": null,
    "notes": null,
    "section": "market_analysis",
    "source": "manual",
    "superseded": false,
    "timestamp": "2026-08-08T00:00:00Z",
    "version": 1
  },
  "tier": "Primary"
}
```

```json uw:section=risk_assessment confidence=high source=manual ts=2026-08-08T00:00:00Z v=1
{
  "_meta": {
    "actor": "conformance",
    "agent_id": null,
    "agent_version": null,
    "confidence": "high",
    "flags": [],
    "human_review_required": false,
    "input_hash": null,
    "notes": null,
    "section": "risk_assessment",
    "source": "manual",
    "superseded": false,
    "timestamp": "2026-08-08T00:00:00Z",
    "version": 1
  },
  "sponsor_rating": "BBB-"
}
```

```json uw:section=x_uw_lite_source confidence=high source=manual ts=2026-08-08T00:00:00Z v=1
{
  "_meta": {
    "actor": "conformance",
    "agent_id": null,
    "agent_version": null,
    "confidence": "high",
    "flags": [],
    "human_review_required": false,
    "input_hash": null,
    "notes": null,
    "section": "x_uw_lite_source",
    "source": "manual",
    "superseded": false,
    "timestamp": "2026-08-08T00:00:00Z",
    "version": 1
  },
  "markdown": "---\nuw_lite_version: 1.0\ndeal_id: uw_lite_typed_values\ndeal_name: Typed Value Coverage\ncreated: 2026-08-08T00:00:00Z\ncreated_by: conformance\n---\n\n# Assumptions\n\n- Assumable debt: true <!-- uw:assumptions.assumable_debt -->\n- Exit cap rate: null <!-- uw:assumptions.exit_cap_rate -->\n- DSCR floor: 1.25x <!-- uw:assumptions.dscr_floor source=lender -->\n- Rent growth: -1.50% <!-- uw:assumptions.rent_growth -->\n- Hold period: 7 <!-- uw:assumptions.hold_period_years unit=years -->\n- Year 1 vacancy: 5.00% <!-- uw:assumptions.vacancy.year_1 -->\n\n# Discounted cash flow\n\n- Terminal value: ~ <!-- uw:dcf.terminal_value -->\n\n# Market\n\n- Market tier: \"Primary\" <!-- uw:market_analysis.tier -->\n\n# Risk\n\n- Sponsor rating: BBB- <!-- uw:risk_assessment.sponsor_rating -->\n",
  "profile": "deal-summary-v1",
  "representation": "uw-lite-markdown",
  "representation_version": "1.0"
}
```
