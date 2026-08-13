// uwmd init — generates a new blank .uwx.md file from a template
// Spec: UW_FORMAT_SPEC_v1.md §6 toolchain interface

import type { AssetClass, DealStage } from './types.js';

export interface InitOptions {
  dealId?: string;
  dealName?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  assetClass?: AssetClass;
  assetSubtype?: string;
  dealStage?: DealStage;
  tier?: 'screener' | 'analyst';
}

function generateDealId(): string {
  const year = new Date().getFullYear();
  const hash = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `uw_${year}_${hash}`;
}

function isoNow(): string {
  return new Date().toISOString();
}

export function generateBlankUWFile(opts: InitOptions = {}): string {
  const dealId = opts.dealId ?? generateDealId();
  const dealName = opts.dealName ?? 'Untitled Deal';
  const now = isoNow();
  const assetClass = opts.assetClass ?? 'multifamily';
  const tier = opts.tier ?? 'screener';
  const dealStage = opts.dealStage ?? 'screening';

  const frontmatter = `---
uw_version: "1.1"
deal_id: "${dealId}"
deal_name: "${dealName}"
created: "${now}"
last_modified: "${now}"

property_address: "${opts.address ?? ''}"
city: "${opts.city ?? ''}"
state: "${opts.state ?? ''}"
zip: "${opts.zip ?? ''}"
asset_class: ${assetClass}
asset_subtype: ${opts.assetSubtype ?? 'null'}
loan_type: null
scenario: null

pipeline_state:
  L0_ingestion: pending
  L1_screening: pending
  L2_underwriting: pending
  L4_structuring: pending
  L5_compliance: pending
  L6_risk: pending
  L7_assembly: pending

status: draft
deal_stage: ${dealStage}
recommendation: null

quick_metrics:
  purchase_price: null
  loan_amount: null
  noi_underwritten: null
  dscr: null
  ltv: null
  debt_yield: null
  cap_rate: null
  irr_projected: null
  equity_required: null

flags: []
blocking_flags: []

tier: ${tier}
institution_config_id: null
created_by: wizard
source_documents: []
---`;

  const metaStub = (section: string): string => JSON.stringify({
    _meta: {
      section,
      version: 1,
      superseded: false,
      source: 'wizard',
      agent_id: null,
      agent_version: null,
      actor: 'user',
      timestamp: now,
      confidence: 'low',
      human_review_required: true,
      flags: [],
      input_hash: null,
      notes: null,
    },
    _notes: null,
  }, null, 2);

  const sections = [
    { id: 'deal_context', header: 'Deal Context', label: '§4.0' },
    { id: 'property', header: 'Property', label: '§4.1' },
    { id: 'ownership', header: 'Ownership & Acquisition', label: '§4.2' },
    { id: 'rent_roll', header: 'Rent Roll', label: '§4.3' },
    { id: 'operating_statement', header: 'Operating Statement', label: '§4.4' },
    { id: 'noi_model', header: 'NOI Model', label: '§4.5' },
    { id: 'debt_structure', header: 'Debt Structure', label: '§4.6' },
    { id: 'sources_uses', header: 'Sources & Uses', label: '§4.7' },
    { id: 'valuation', header: 'Valuation', label: '§4.8' },
    { id: 'dcf', header: 'DCF & Hold Period Analysis', label: '§4.9' },
    { id: 'stress_tests', header: 'Stress Tests', label: '§4.10' },
    { id: 'market_analysis', header: 'Market Analysis', label: '§4.11' },
    { id: 'borrower_sponsor', header: 'Borrower / Sponsor', label: '§4.12' },
    { id: 'lease_schedule', header: 'Lease Schedule', label: '§4.13' },
    { id: 'due_diligence', header: 'Due Diligence', label: '§4.14' },
    { id: 'compliance', header: 'Compliance', label: '§4.15' },
    { id: 'assumptions', header: 'Assumptions', label: '§4.16' },
    { id: 'preliminary_sizing', header: 'Preliminary Sizing', label: '§4.17' },
    { id: 'risk_assessment', header: 'Risk Assessment', label: '§4.18' },
    { id: 'validation', header: 'Flags & Validation', label: '§4.19' },
    { id: 'custom_calculations', header: 'Custom Calculations', label: '§4.20' },
    { id: 'custom_scenarios', header: 'Custom Scenarios', label: '§4.21' },
  ];

  const sectionBlocks = sections.map(s => `
## ${s.header} {#${s.id}}

_${s.label} — Add narrative here._

\`\`\`json uw:section=${s.id} source=wizard ts=${now} v=1 confidence=low
${metaStub(s.id)}
\`\`\`

---`).join('\n');

  const pipelineLogEntry = JSON.stringify({
    _meta: {
      section: 'pipeline_log',
      version: 1,
      superseded: false,
      source: 'engine:uwmd',
      agent_id: null,
      agent_version: '1.0.0',
      actor: 'system',
      timestamp: now,
      confidence: 'high',
      human_review_required: false,
      flags: [],
      input_hash: null,
      notes: null,
    },
    entries: [
      {
        entry_id: `log_${Date.now()}`,
        timestamp: now,
        event_type: 'file_created',
        agent_or_actor: 'uwmd:init',
        section_affected: null,
        status: 'success',
        input_sections: [],
        output_sections: [],
        flags_raised: [],
        flags_cleared: [],
        duration_ms: null,
        input_hash: null,
        output_hash: null,
        error_code: null,
        error_message: null,
        notes: `File initialized via uwmd init for deal: ${dealName}`,
      },
    ],
  }, null, 2);

  return `${frontmatter}

# ${dealName}

> _Deal underwriting file — created ${now.slice(0, 10)}. Fill in sections via the wizard or directly._
${sectionBlocks}

## Pipeline Log {#pipeline_log}

\`\`\`json uw:section=pipeline_log source=engine:uwmd ts=${now} v=1 confidence=high
${pipelineLogEntry}
\`\`\`
`;
}
