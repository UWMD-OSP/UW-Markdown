// .uw.md context builder — curates what each Bancroft agent layer receives
//
// Each Bancroft layer has a defined set of sections it reads and writes.
// This module builds the minimal, focused context an agent needs — not the
// full file. Prevents agents from having to parse the raw .uw.md themselves,
// and ensures each layer only sees the sections it depends on.
//
// Spec: UW_FORMAT_SPEC_v1.md §1.3 (Bancroft layer ↔ section mapping)

import type { ParsedUWFile, UWBlock, UWFrontmatter, PipelineStatus } from './types.js';
import { getSection, getSectionVariant, deepGet } from './parser.js';
import { render } from './renderer.js';
import { buildContext, type ContextProfile, type ContextResult } from './context-profiles.js';

// ─── Agent layer definitions ──────────────────────────────────────────────────

export interface LayerDefinition {
  id: string;
  layer: number;
  name: string;
  reads: string[];    // section IDs this layer reads
  writes: string[];   // section IDs this layer writes
  pipelineStateKey: string;
  /**
   * Normative context profile this layer consumes (Protocol §XI).
   * Conformance Tier-4 verifies a host requests exactly this profile when
   * preparing the layer's input. Phase 4 default; Phase 5 layers (L0a/L0b)
   * declare their own.
   */
  consumed_profile: ContextProfile;
}

export const BANCROFT_LAYERS: LayerDefinition[] = [
  {
    id: 'L0',
    layer: 0,
    name: 'Document Ingestion',
    reads: [],  // L0 reads raw documents, not sections
    writes: ['rent_roll', 'operating_statement', 'lease_schedule'],
    pipelineStateKey: 'L0_ingestion',
    consumed_profile: 'summary',
  },
  {
    id: 'L0a',
    layer: 0,
    name: 'Scope',
    reads: ['property'],
    writes: ['market_analysis', 'noi_model', 'debt_structure', 'valuation', 'quick_metrics', 'gaps'],
    pipelineStateKey: 'L0a_scope',
    consumed_profile: 'summary',
  },
  {
    id: 'L0b',
    layer: 0,
    name: 'Scope Refinement',
    reads: ['*'],
    writes: ['property', 'noi_model', 'debt_structure', 'gaps'],
    pipelineStateKey: 'L0b_refinement',
    consumed_profile: 'compact',
  },
  {
    id: 'L1',
    layer: 1,
    name: 'Screening',
    reads: ['deal_context', 'property', 'ownership'],
    writes: ['screening', 'preliminary_sizing'],
    pipelineStateKey: 'L1_screening',
    consumed_profile: 'summary',
  },
  {
    id: 'L2',
    layer: 2,
    name: 'Underwriting',
    reads: ['deal_context', 'property', 'rent_roll', 'operating_statement', 'borrower_sponsor'],
    writes: ['noi_model', 'valuation', 'market_analysis'],
    pipelineStateKey: 'L2_underwriting',
    consumed_profile: 'relevant',
  },
  {
    id: 'L4',
    layer: 4,
    name: 'Structuring',
    reads: ['deal_context', 'property', 'noi_model', 'valuation', 'market_analysis', 'borrower_sponsor', 'sources_uses'],
    writes: ['debt_structure', 'sources_uses', 'covenants'],
    pipelineStateKey: 'L4_structuring',
    consumed_profile: 'relevant',
  },
  {
    id: 'L5',
    layer: 5,
    name: 'Compliance',
    reads: ['deal_context', 'property', 'ownership', 'borrower_sponsor', 'debt_structure', 'valuation'],
    writes: ['compliance'],
    pipelineStateKey: 'L5_compliance',
    consumed_profile: 'relevant',
  },
  {
    id: 'L6',
    layer: 6,
    name: 'Risk Rating',
    reads: ['deal_context', 'property', 'noi_model', 'valuation', 'debt_structure', 'market_analysis', 'borrower_sponsor', 'stress_tests', 'dcf', 'compliance'],
    writes: ['risk_assessment'],
    pipelineStateKey: 'L6_risk',
    consumed_profile: 'relevant',
  },
  {
    id: 'L7',
    layer: 7,
    name: 'Assembly',
    reads: ['*'],  // reads everything
    writes: ['pipeline_log', 'deal_context'],  // writes ai_synthesis to deal_context
    pipelineStateKey: 'L7_assembly',
    consumed_profile: 'live',
  },
];

// ─── Agent context object ─────────────────────────────────────────────────────

export interface AgentContext {
  agentId: string;
  layer: LayerDefinition;
  frontmatter: UWFrontmatter;
  sections: Record<string, unknown>;       // content of required + available sections
  prose: Record<string, string>;           // prose for those sections
  missingRequired: string[];               // required sections not yet present
  missingOptional: string[];               // optional sections not yet present
  customCalculations: unknown[];
  customScenarios: unknown[];
  extensions: Record<string, unknown>;
  flags: string[];
  blockingFlags: string[];
  validationIssues?: unknown[];
  pipelineState: Record<string, PipelineStatus>;
  // Chat-format context string for direct injection into Claude API messages
  chatContext: string;
  chatTokenEstimate: number;
  /**
   * Normative context payload built from the layer's `consumed_profile`
   * (Protocol §XI). Hosts SHOULD send this — not `chatContext` — to the
   * agent when running under the conformance contract.
   */
  profileContext: ContextResult;
}

// ─── Main context builder ─────────────────────────────────────────────────────

export function buildAgentContext(
  parsed: ParsedUWFile,
  agentId: string,
  opts: { includeValidation?: boolean; maxChatTokens?: number } = {},
): AgentContext {
  const layer = resolveLayer(agentId);
  const sectionsToRead = layer.layer === 7 ? getAllSectionIds(parsed) : layer.reads;

  // Collect section content
  const sections: Record<string, unknown> = {};
  const prose: Record<string, string> = {};
  const missingRequired: string[] = [];
  const missingOptional: string[] = [];

  for (const sectionId of sectionsToRead) {
    const block = getSection(parsed, sectionId);
    if (block) {
      sections[sectionId] = block.content;
      if (parsed.prose[sectionId]) prose[sectionId] = parsed.prose[sectionId];
    } else {
      // Check multi-variant
      const variantEntry = parsed.sections[sectionId];
      if (variantEntry && !('annotation' in variantEntry)) {
        sections[sectionId] = Object.fromEntries(
          Object.entries(variantEntry as Record<string, UWBlock>).map(([v, b]) => [v, b.content])
        );
      } else if (isRequired(layer, sectionId)) {
        missingRequired.push(sectionId);
      } else {
        missingOptional.push(sectionId);
      }
    }
  }

  // Always include deal_context for all layers (orientation)
  if (!sections['deal_context']) {
    const dc = getSection(parsed, 'deal_context');
    if (dc) {
      sections['deal_context'] = dc.content;
      if (parsed.prose['deal_context']) prose['deal_context'] = parsed.prose['deal_context'];
    }
  }

  const pipelineState = (parsed.frontmatter.pipeline_state ?? {}) as Record<string, PipelineStatus>;

  // Build chat context string for Claude API injection
  const chatResult = render(parsed, {
    format: 'chat',
    maxTokens: opts.maxChatTokens ?? 8000,
  });

  // Build the normative profile context per the layer's declared consumption.
  // For 'relevant', pass layer.reads as the section filter so the host receives
  // exactly the documented contract.
  const profileContext = buildContext(parsed, layer.consumed_profile, {
    sections: layer.consumed_profile === 'relevant' ? sectionsToRead : undefined,
    maxTokens: opts.maxChatTokens,
  });

  return {
    agentId,
    layer,
    frontmatter: parsed.frontmatter,
    sections,
    prose,
    missingRequired,
    missingOptional,
    customCalculations: parsed.custom_calculations.map(b => b.content),
    customScenarios: parsed.custom_scenarios.map(b => b.content),
    extensions: Object.fromEntries(
      Object.entries(parsed.extensions).map(([k, v]) => [k, v.content])
    ),
    flags: (parsed.frontmatter.flags as string[] | undefined) ?? [],
    blockingFlags: (parsed.frontmatter.blocking_flags as string[] | undefined) ?? [],
    pipelineState,
    chatContext: chatResult.content,
    chatTokenEstimate: chatResult.estimatedTokens ?? 0,
    profileContext,
  };
}

// ─── System prompt builder for Bancroft agents ───────────────────────────────
// Returns the system prompt + user message for a Claude API call.
// The agent receives: its role, required output schema, and the deal context.

export interface BancroftPrompt {
  systemPrompt: string;
  userMessage: string;
  outputSchemaDescription: string;
}

export function buildAgentPrompt(
  context: AgentContext,
  userInstructions?: string,
): BancroftPrompt {
  const layer = context.layer;
  const missingWarn = context.missingRequired.length > 0
    ? `\n\n⚠ MISSING REQUIRED INPUT SECTIONS: ${context.missingRequired.join(', ')}. Proceed with available data only — mark confidence as "low" and set human_review_required: true for fields that depend on missing inputs.`
    : '';

  const systemPrompt = `You are ${layer.id} — ${layer.name} — a specialized agent in the Bancroft CRE underwriting pipeline.

Your role: ${getLayerDescription(layer.id)}

## Your Output Contract

You must return a single JSON object that will be written as a .uw.md section block. The object must:
- Begin with a "_meta" object (see spec §2.5)
- Include all required fields for the section(s) you write: ${layer.writes.join(', ')}
- Set confidence to "high" / "medium" / "low" based on available data quality
- Set human_review_required: true if any field is uncertain, estimated, or depends on missing inputs
- Never calculate financial figures — report what the data shows; the deterministic engine owns the math
- Set flags[] for any anomalies, policy concerns, or data quality issues you observe

## Available Input Sections
${Object.keys(context.sections).map(s => `- ${s}`).join('\n')}
${missingWarn}

## Blocking Flags
${context.blockingFlags.length > 0 ? context.blockingFlags.map(f => `- ${f}`).join('\n') : 'None — pipeline is clear to proceed'}`;

  const userMessage = `${context.chatContext}

---

${userInstructions ? `Additional instructions:\n${userInstructions}\n\n---\n\n` : ''}Return your output as a single JSON block for section(s): ${layer.writes.join(', ')}`;

  return {
    systemPrompt,
    userMessage,
    outputSchemaDescription: getOutputSchemaDescription(layer.id),
  };
}

// ─── Layer resolution ─────────────────────────────────────────────────────────

function resolveLayer(agentId: string): LayerDefinition {
  // Match by prefix: "L0", "L0-01", "L2-CRE-11", etc.
  const prefix = agentId.match(/^(L\d+)/)?.[1];
  if (prefix) {
    const layer = BANCROFT_LAYERS.find(l => l.id === prefix);
    if (layer) return layer;
  }
  // Default: treat as L7 (reads everything)
  return BANCROFT_LAYERS[BANCROFT_LAYERS.length - 1];
}

// Sections that must be present for each layer to produce meaningful output.
// Absent required sections set context.missingRequired and block isContextReady().
const REQUIRED_BY_LAYER: Record<string, string[]> = {
  L0: [],
  L0a: ['property'],
  L0b: [],   // operates on whatever L0a produced
  L1: ['property'],
  L2: ['property', 'rent_roll'],
  L4: ['noi_model', 'valuation'],
  L5: ['property', 'borrower_sponsor'],
  L6: ['noi_model', 'debt_structure', 'valuation'],
  L7: [],  // L7 reads everything but can always proceed
};

function isRequired(layer: LayerDefinition, sectionId: string): boolean {
  const required = REQUIRED_BY_LAYER[layer.id] ?? [];
  return required.includes(sectionId);
}

function getAllSectionIds(parsed: ParsedUWFile): string[] {
  return Object.keys(parsed.sections);
}

// ─── Layer descriptions ───────────────────────────────────────────────────────

function getLayerDescription(layerId: string): string {
  const descriptions: Record<string, string> = {
    L0: 'You extract structured data from raw uploaded documents (rent rolls, T-12 operating statements, lease schedules). Output must represent exactly what the documents say — no inference, no interpolation.',
    L0a: 'You produce an initial scoped .uw.md from minimal user input by walking the fallback cascade. Every defaulted value MUST be stamped provisional. Your output is a triage view, not a commitment.',
    L0b: 'You iteratively ask the user the smallest set of questions that meaningfully tighten the deal\u2019s output ranges. Wraps refinement.ts in a conversational loop. See L0b-prompt.md for the full system prompt.',
    L1: 'You perform initial deal screening — flag red flags, assess deal feasibility against standard thresholds, and produce a preliminary sizing. You are the gatekeeper before full underwriting begins.',
    L2: 'You perform full underwriting analysis — NOI reconstruction, market positioning, valuation, and borrower assessment. You are the primary analytical layer.',
    L4: 'You structure the debt — size the loan, build the sources and uses table, design term sheet terms, and identify covenants. You work from the underwritten NOI and value.',
    L5: 'You run compliance checks — OFAC screening, CRA assessment, regulatory requirements, and policy flag review. You are a hard gate: blocking flags must be cleared before proceeding.',
    L6: 'You produce the risk rating — aggregate all section inputs into a scored assessment, stress test the structure, and make a recommendation.',
    L7: 'You assemble the final package — synthesize all sections into a coherent narrative, generate the AI synthesis for deal_context, and prepare output artifacts.',
  };
  return descriptions[layerId] ?? 'You are a specialized underwriting agent.';
}

function getOutputSchemaDescription(layerId: string): string {
  const schemas: Record<string, string> = {
    L0: 'rent_roll: { units[], gross_potential_rent, total_units } | operating_statement: { income{}, expenses{}, noi } | lease_schedule: { leases[] }',
    L1: 'screening: { status, flags[], notes, recommendation } | preliminary_sizing: { max_loan_amount, dscr_estimate, ltv_estimate }',
    L2: 'noi_model: { line_items{}, noi, vacancy_rate, opex_ratio } | valuation: { purchase_price, cap_rate, value_per_unit } | market_analysis: { market_vacancy, asking_rents, supply_pipeline }',
    L4: 'debt_structure: { loan_amount, rate, term, ltv, dscr } | sources_uses: { sources{}, uses{}, equity_required }',
    L5: 'compliance: { ofac_status, cra_eligible, flags[], blocking_flags[], notes }',
    L6: 'risk_assessment: { overall_rating, risk_score, key_risks[], recommendation, stress_test_summary }',
    L7: 'deal_context (ai_synthesis field): { summary, key_risks[], key_strengths[], overall_impression }',
  };
  return schemas[layerId] ?? '{ _meta: {}, ...section fields }';
}

// ─── Context readiness check ──────────────────────────────────────────────────
// Returns true if the context has enough data to run the agent.

export function isContextReady(context: AgentContext): boolean {
  // Blocking flags always halt
  if (context.blockingFlags.length > 0) return false;
  // Missing required sections halt
  if (context.missingRequired.length > 0) return false;
  return true;
}

// ─── Pipeline dependency graph ────────────────────────────────────────────────
// Returns the layers that must complete before a given layer can run.

export function getLayerDependencies(layerId: string): string[] {
  const deps: Record<string, string[]> = {
    L0: [],
    L0a: [],
    L0b: ['L0a'],
    L1: ['L0'],
    L2: ['L0', 'L1'],
    L4: ['L2'],
    L5: ['L2', 'L4'],
    L6: ['L2', 'L4', 'L5'],
    L7: ['L0', 'L1', 'L2', 'L4', 'L5', 'L6'],
  };
  return deps[layerId] ?? [];
}
