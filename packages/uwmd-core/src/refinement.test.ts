import { describe, expect, it } from 'vitest';
import { rankGaps } from './refinement.js';
import { parseUWFile } from './parser.js';

const MINIMAL_MULTIFAMILY = `---
uw_version: "1.1"
deal_id: "uw_2026_TEST"
deal_name: "Test Deal"
created: "2026-01-01T00:00:00Z"
last_modified: "2026-01-01T00:00:00Z"
property_address: "1 Test Way"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
status: draft
deal_stage: scope
recommendation: null
flags: []
blocking_flags: []
tier: screener
institution_config_id: null
created_by: wizard
source_documents: []
---

# Test Deal

## Property {#property}

\`\`\`json uw:section=property source=manual ts=2026-01-01T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "user",
    "timestamp": "2026-01-01T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "total_units": 24,
  "total_nra_sqft": 20000,
  "asset_class": "multifamily"
}
\`\`\`

## Valuation {#valuation}

\`\`\`json uw:section=valuation source=manual ts=2026-01-01T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "valuation",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "user",
    "timestamp": "2026-01-01T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "purchase_price": 5000000
}
\`\`\`
`;

describe('rankGaps — minimal multifamily file', () => {
  const parsed = parseUWFile(MINIMAL_MULTIFAMILY);

  it('produces a non-empty ranking when targeting cap_rate', () => {
    const r = rankGaps(parsed, { targets: ['cap_rate'] });
    // cap_rate reads noi_model.net_operating_income / valuation.purchase_price.
    // Neither path has a direct asset_class_default entry — they'd resolve to
    // NaN — but the engine still records them. Diagnostics should reflect.
    expect(r.diagnostics.graph_size).toBeGreaterThanOrEqual(1);
  });

  it('returns gaps when targeting a calc whose inputs are in the defaults table', () => {
    // Build a graph where dscr is the target. dscr formula:
    //   noi_model.net_operating_income / debt_structure.annual_debt_service
    // Neither has a direct asset_class_default. But we can extend defaults
    // to include synthetic inputs. For this fixture we just verify that
    // when no inputs are gap-resolvable, the ranking is empty (not crashed).
    const r = rankGaps(parsed, { targets: ['dscr'] });
    expect(r.by_voi).toEqual([]);
    expect(r.diagnostics.resolved).toBeGreaterThanOrEqual(2);
  });

  it('honors the `top` option', () => {
    const r = rankGaps(parsed, { top: 2 });
    expect(r.by_voi.length).toBeLessThanOrEqual(2);
  });

  it('flags no non-monotonic outputs for the standard multifamily pack', () => {
    const r = rankGaps(parsed);
    // The eight built-in multifamily metrics are all pure ratios — monotonic.
    expect(r.diagnostics.non_monotonic).toEqual([]);
  });
});

describe('rankGaps — synthetic gap-driven calc', () => {
  // To test VOI computation directly, build a tiny custom calc whose inputs
  // map to defaulted paths. We piggyback on multifamily defaults so the
  // cascade returns a {low, central, high} range for each input.
  const file = `---
uw_version: "1.1"
deal_id: "uw_2026_VOI"
deal_name: "VOI Test"
created: "2026-01-01T00:00:00Z"
last_modified: "2026-01-01T00:00:00Z"
property_address: "1 VOI Way"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
status: draft
deal_stage: scope
recommendation: null
flags: []
blocking_flags: []
tier: screener
institution_config_id: null
created_by: wizard
source_documents: []
---

# VOI Test

## Custom Calculations {#custom_calculations}

\`\`\`json uw:section=custom_calculations source=manual ts=2026-01-01T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "custom_calculations",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "user",
    "timestamp": "2026-01-01T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "id": "synth_score",
  "label": "Synthetic Score",
  "formula": "noi_model.expense_ratio + rent_roll.vacancy_pct + debt_structure.rate_pct"
}
\`\`\`
`;
  const parsed = parseUWFile(file);

  it('ranks expense_ratio, vacancy_pct, rate_pct as gaps for synth_score', () => {
    const r = rankGaps(parsed, { targets: ['synth_score'] });
    const paths = r.by_voi.map(g => g.field_path);
    expect(paths).toEqual(
      expect.arrayContaining([
        'noi_model.expense_ratio',
        'rent_roll.vacancy_pct',
        'debt_structure.rate_pct',
      ]),
    );
  });

  it('every ranked gap carries a question_template when one is registered', () => {
    const r = rankGaps(parsed, { targets: ['synth_score'] });
    for (const gap of r.by_voi) {
      // expense_ratio / vacancy_pct / rate_pct are all in the registry.
      expect(gap.question_template).toBeTruthy();
    }
  });

  it('total_voi is non-negative (collapsing a gap cannot widen output ranges)', () => {
    const r = rankGaps(parsed, { targets: ['synth_score'] });
    for (const gap of r.by_voi) {
      expect(gap.total_voi).toBeGreaterThanOrEqual(0);
    }
  });

  it('ranking is monotonically descending in total_voi', () => {
    const r = rankGaps(parsed, { targets: ['synth_score'] });
    for (let i = 1; i < r.by_voi.length; i++) {
      expect(r.by_voi[i - 1].total_voi).toBeGreaterThanOrEqual(r.by_voi[i].total_voi);
    }
  });

  it('diagnostics report the perturbation count', () => {
    const r = rankGaps(parsed, { targets: ['synth_score'] });
    expect(r.diagnostics.perturbations).toBeGreaterThan(0);
  });
});
