// Per-layer output tool schemas for Claude tool_use
// Each Bancroft layer uses the write_uw_section tool to return structured output.
// Claude fills in section_data; we wrap it with _meta in bancroft.ts.

import type { AgentToolSchema } from './provider.js';

// ─── Universal write tool ─────────────────────────────────────────────────────
// All layers use the same tool; section_data content varies by layer.
// Using a single flexible schema rather than per-layer schemas keeps prompts
// shorter and avoids schema drift — the system prompt describes the expected fields.

export const WRITE_UW_SECTION_TOOL: AgentToolSchema = {
  name: 'write_uw_section',
  description: 'Write the analyzed section data back to the .uw.md deal file. Call this exactly once with your complete output. Do not call it multiple times.',
  input_schema: {
    type: 'object' as const,
    properties: {
      section_id: {
        type: 'string',
        description: 'The section ID being written (e.g. "screening", "noi_model", "risk_assessment"). Must match one of the sections you are responsible for writing.',
      },
      confidence: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description: 'Confidence in your output. high = deterministic/directly sourced, medium = inferred/estimated, low = insufficient data.',
      },
      human_review_required: {
        type: 'boolean',
        description: 'Set true if any output field is uncertain, estimated, or depends on missing inputs. This gates the pipeline.',
      },
      flags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Machine-readable flag strings for anomalies, policy concerns, or data quality issues. Use snake_case. Examples: dscr_below_threshold, management_fee_above_market, ofac_match_required.',
      },
      section_data: {
        type: 'object',
        description: 'All field values for this section. Include every required field. Use null for unknown values — do not omit fields.',
      },
      notes: {
        type: 'string',
        description: 'Optional human-readable explanation of uncertainties, assumptions made, or instructions for the next reviewer.',
      },
    },
    required: ['section_id', 'confidence', 'human_review_required', 'flags', 'section_data'],
  },
};

// ─── Multi-section write tool ─────────────────────────────────────────────────
// L0 and L4 write multiple sections in one pass. They use this tool instead.

export const WRITE_MULTIPLE_SECTIONS_TOOL: AgentToolSchema = {
  name: 'write_multiple_uw_sections',
  description: 'Write multiple sections to the .uw.md deal file in a single call. Use when your layer is responsible for more than one section.',
  input_schema: {
    type: 'object' as const,
    properties: {
      sections: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            section_id: { type: 'string' },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
            human_review_required: { type: 'boolean' },
            flags: { type: 'array', items: { type: 'string' } },
            section_data: { type: 'object' },
            notes: { type: 'string' },
          },
          required: ['section_id', 'confidence', 'human_review_required', 'flags', 'section_data'],
        },
        description: 'One entry per section you are writing.',
      },
    },
    required: ['sections'],
  },
};

// Layers that write multiple sections and use the multi-section tool
export const MULTI_SECTION_LAYERS = new Set(['L0', 'L4']);

export interface ToolOutput {
  section_id: string;
  confidence: 'high' | 'medium' | 'low';
  human_review_required: boolean;
  flags: string[];
  section_data: Record<string, unknown>;
  notes?: string;
}
