// uwmd init — generates a new blank .uwx.md file from a template
// Spec: UW_FORMAT_SPEC_v1.md §6 toolchain interface

import type { AssetClass, DealStage, UWMeta } from './types.js';
import { stampMetaIntoBlockContent } from './meta-shape.js';
import { parseUWFile } from './parser.js';

export interface InitOptions {
  /**
   * Format line to scaffold. Defaults to '2.0' (nested _meta — v2 writers
   * emit the nested shape by default, format v2 spec §7); pass '1.1' for a
   * legacy flat-shape scaffold when downstream consumers are pinned to 1.x.
   */
  formatVersion?: '2.0' | '1.1';
  dealId?: string;
  dealName?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  assetClass?: AssetClass;
  assetSubtype?: string;
  dealStage?: DealStage;
  /** Frontmatter `scenario`; `uwmd init` accepts only {@link INIT_SCENARIOS}. */
  scenario?: string;
  tier?: 'screener' | 'analyst';
}

/**
 * The frontmatter `scenario` values Format §2.2 lists, in its order. `uwmd init
 * --scenario` (§6.7) writes one of these and refuses anything else. The list
 * assigns no meaning to any value; the format defines none yet (issue #255).
 * `init.test.ts` holds it to the spec line.
 */
export const INIT_SCENARIOS: readonly string[] = [
  'stabilized_acquisition',
  'ground_up_development',
  'value_add',
  'lease_up',
  'nnn_single_tenant',
  'lihtc_section8',
  'house_flip',
  'commercial_flip',
  'property_conversion',
  'build_to_rent',
  'distressed_reo',
  'land_banking',
];

function generateDealId(): string {
  const year = new Date().getFullYear();
  const hash = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `uw_${year}_${hash}`;
}

function isoNow(): string {
  return new Date().toISOString();
}

/**
 * Thrown when an `InitOptions` value cannot be written as a frontmatter scalar
 * that every reader recovers exactly.
 */
export class UWInitError extends Error {
  readonly code = 'INIT_UNREPRESENTABLE_VALUE';
  readonly field: string;
  constructor(field: string, message: string) {
    super(`[INIT_UNREPRESENTABLE_VALUE] ${field}: ${message}`);
    this.name = 'UWInitError';
    this.field = field;
  }
}

// A value written without quotes must read back as the same string in both the
// reference reader and a YAML 1.1/1.2 library: a lowercase snake_case token,
// dotted for namespaced identifiers, that no reader takes for null or a boolean.
const PLAIN_SCALAR_RE = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$/;
const PLAIN_RESERVED = new Set(['null', 'true', 'false', 'yes', 'no', 'on', 'off', 'y', 'n']);

/** YAML 1.2 printable characters, minus every line break: one value, one line. */
function isSingleLinePrintable(cp: number): boolean {
  if (cp === 0x09) return true;
  if (cp >= 0x20 && cp <= 0x7e) return true;
  if (cp === 0x2028 || cp === 0x2029) return false;
  if (cp >= 0xa0 && cp <= 0xd7ff) return true;
  if (cp >= 0xe000 && cp <= 0xfffd) return true;
  return cp >= 0x10000 && cp <= 0x10ffff;
}

/**
 * Serializes one user-supplied frontmatter value. Format Appendix D allows
 * quoted strings but does not say whether YAML escapes apply inside them, and
 * the reference reader takes quoted content verbatim while YAML libraries
 * unescape it. So no escape sequence is ever emitted. The rule, in order:
 *
 * 1. a non-string, a line break or a non-printable character is refused;
 * 2. a `plain` field that is a safe token is written bare (today's bytes);
 * 3. otherwise `"value"` if it has no `"` or `\` (today's bytes for quoted fields);
 * 4. otherwise `'value'` if it has no `'`;
 * 5. otherwise it is refused: no form reads back the same everywhere.
 */
function frontmatterScalar(field: string, value: string, style: 'plain' | 'quoted'): string {
  // A bare CLI flag (`--name` with no value) arrives as `true`.
  if (typeof value !== 'string') throw new UWInitError(field, 'must be a string.');
  for (const ch of value) {
    if (!isSingleLinePrintable(ch.codePointAt(0)!)) {
      throw new UWInitError(field, 'line breaks and non-printable characters cannot be written to frontmatter.');
    }
  }
  if (style === 'plain' && PLAIN_SCALAR_RE.test(value) && !PLAIN_RESERVED.has(value)) return value;
  if (!value.includes('"') && !value.includes('\\')) return `"${value}"`;
  if (!value.includes("'")) return `'${value}'`;
  throw new UWInitError(
    field,
    "a value containing both ' and either \" or \\ has no frontmatter form every reader recovers exactly.",
  );
}

export function generateBlankUWFile(opts: InitOptions = {}): string {
  const dealId = opts.dealId ?? generateDealId();
  const dealName = opts.dealName ?? 'Untitled Deal';
  const now = isoNow();
  const assetClass = opts.assetClass ?? 'multifamily';
  const tier = opts.tier ?? 'screener';
  const dealStage = opts.dealStage ?? 'screening';
  const formatVersion = opts.formatVersion ?? '2.0';
  const v2 = formatVersion === '2.0';

  // Every caller-supplied frontmatter value goes through frontmatterScalar;
  // the expected parse of each is checked against the result before return.
  const supplied: [key: string, value: string | null, style: 'plain' | 'quoted'][] = [
    ['uw_version', formatVersion, 'quoted'],
    ['deal_id', dealId, 'quoted'],
    ['deal_name', dealName, 'quoted'],
    ['property_address', opts.address ?? '', 'quoted'],
    ['city', opts.city ?? '', 'quoted'],
    ['state', opts.state ?? '', 'quoted'],
    ['zip', opts.zip ?? '', 'quoted'],
    ['asset_class', assetClass, 'plain'],
    ['asset_subtype', opts.assetSubtype ?? null, 'plain'],
    ['scenario', opts.scenario ?? null, 'plain'],
    ['deal_stage', dealStage, 'plain'],
    ['tier', tier, 'plain'],
  ];
  const fm: Record<string, string> = {};
  for (const [key, value, style] of supplied) {
    fm[key] = value === null ? 'null' : frontmatterScalar(key, value, style);
  }

  const frontmatter = `---
uw_version: ${fm.uw_version}
deal_id: ${fm.deal_id}
deal_name: ${fm.deal_name}
created: "${now}"
last_modified: "${now}"

property_address: ${fm.property_address}
city: ${fm.city}
state: ${fm.state}
zip: ${fm.zip}
asset_class: ${fm.asset_class}
asset_subtype: ${fm.asset_subtype}
loan_type: null
scenario: ${fm.scenario}

pipeline_state:
  L0_ingestion: pending
  L1_screening: pending
  L2_underwriting: pending
  L4_structuring: pending
  L5_compliance: pending
  L6_risk: pending
  L7_assembly: pending

status: draft
deal_stage: ${fm.deal_stage}
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

tier: ${fm.tier}
institution_config_id: null
created_by: wizard
source_documents: []
---`;

  // `manual`, not `wizard`. A scaffold a person is about to fill in is a
  // human-authored block, and `manual` is the one token that means the same
  // thing in every source vocabulary the specs define (it remains a legal
  // ACTOR at 2.0 — only the resolution reading retired). `wizard` matched no
  // BUILTIN_EDIT_POLICIES pattern, so every freshly generated file carried
  // blocks that no policy governed — which is why replacing them in place
  // appeared to work.
  //
  // Deliberately not `system/init`: that resolves to `system/*`, whose
  // authority is `system_only`, and these stubs exist precisely to be edited
  // by a person.
  const stubFlatMeta = (section: string): UWMeta => ({
    section,
    version: 1,
    superseded: false,
    source: 'manual',
    agent_id: null,
    agent_version: null,
    actor: 'user',
    timestamp: now,
    confidence: 'low',
    human_review_required: true,
    flags: [],
    input_hash: null,
    notes: null,
  });
  const metaStub = (section: string): string => {
    const content: Record<string, unknown> = { _notes: null };
    stampMetaIntoBlockContent(content, stubFlatMeta(section), v2);
    return JSON.stringify({ _meta: content['_meta'], _notes: null }, null, 2);
  };

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

\`\`\`json uw:section=${s.id} source=manual ts=${now} v=1 confidence=low
${metaStub(s.id)}
\`\`\`

---`).join('\n');

  // The initializer writing an append-only log entry. `system/init` matches
  // `system/*`; `engine:uwmd` matched nothing.
  const logFlatMeta: UWMeta = {
    section: 'pipeline_log',
    version: 1,
    superseded: false,
    source: 'system/init',
    agent_id: null,
    agent_version: '1.0.0',
    actor: 'system',
    timestamp: now,
    confidence: 'high',
    human_review_required: false,
    flags: [],
    input_hash: null,
    notes: null,
  };
  const logContent: Record<string, unknown> = {};
  stampMetaIntoBlockContent(logContent, logFlatMeta, v2);
  const pipelineLogEntry = JSON.stringify({
    _meta: logContent['_meta'],
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

  const content = `${frontmatter}

# ${dealName}

> _Deal underwriting file — created ${now.slice(0, 10)}. Fill in sections via the wizard or directly._
${sectionBlocks}

## Pipeline Log {#pipeline_log}

\`\`\`json uw:section=pipeline_log source=system/init ts=${now} v=1 confidence=high
${pipelineLogEntry}
\`\`\`
`;

  // The reference reader rejects some quoted content it should not (for
  // example `: &x` read as an anchor), so the guarantee is checked, not assumed.
  let parsed: Record<string, unknown>;
  try {
    parsed = parseUWFile(content, { strict: true }).frontmatter as Record<string, unknown>;
  } catch (err) {
    throw new UWInitError('frontmatter', `the generated frontmatter does not parse: ${String(err)}`);
  }
  for (const [key, value] of supplied) {
    if (parsed[key] !== value) {
      throw new UWInitError(key, 'the generated frontmatter does not read back as the supplied value.');
    }
  }
  return content;
}
