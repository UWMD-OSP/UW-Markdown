// Runner tests — verify the write path produces valid, round-trippable .uw.md

import { describe, it, expect } from 'vitest';
import { parseUWFile, getSection } from './parser.js';
import { writeAgentBlock, writeErrorEntry, buildMeta } from './runner.js';
import { buildAgentContext, isContextReady, BANCROFT_LAYERS } from './context.js';

// ─── Shared fixture ───────────────────────────────────────────────────────────

const MINIMAL_FILE = `---
uw_version: "1.1"
deal_id: "uw_2026_TEST"
deal_name: "Test Deal"
created: "2026-01-01T00:00:00Z"
last_modified: "2026-01-01T00:00:00Z"
property_address: "123 Main St"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
pipeline_state:
  L0_ingestion: complete
  L1_screening: pending
  L2_underwriting: pending
  L4_structuring: pending
  L5_compliance: pending
  L6_risk: pending
  L7_assembly: pending
status: draft
deal_stage: screening
recommendation: null
quick_metrics:
  purchase_price: 5000000
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
tier: screener
institution_config_id: null
created_by: wizard
source_documents: []
---

# Test Deal

## Property {#property}

Garden-style multifamily in Phoenix.

\`\`\`json uw:section=property source=wizard ts=2026-01-01T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "version": 1,
    "superseded": false,
    "source": "wizard",
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
  "_notes": null,
  "total_units": 24,
  "year_built": 1995,
  "asset_class": "multifamily"
}
\`\`\`

---

## Pipeline Log {#pipeline_log}

\`\`\`json uw:section=pipeline_log source=engine ts=2026-01-01T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "pipeline_log",
    "version": 1,
    "superseded": false,
    "source": "engine",
    "agent_id": null,
    "agent_version": null,
    "actor": "system",
    "timestamp": "2026-01-01T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "entries": [
    {
      "entry_id": "log_001",
      "timestamp": "2026-01-01T00:00:00Z",
      "event_type": "file_created",
      "agent_or_actor": "wizard",
      "section_affected": null,
      "status": "success",
      "input_sections": [],
      "output_sections": [],
      "flags_raised": [],
      "flags_cleared": [],
      "duration_ms": null,
      "input_hash": null,
      "output_hash": null,
      "error_code": null,
      "error_message": null,
      "notes": null
    }
  ]
}
\`\`\`
`;

// ─── writeAgentBlock tests ────────────────────────────────────────────────────

describe('writeAgentBlock', () => {
  it('writes a new section block and produces a parseable file', () => {
    const parsed = parseUWFile(MINIMAL_FILE);
    const newContent = {
      _meta: buildMeta('screening', 1, { source: 'agent:L1', agentId: 'L1', confidence: 'medium' }),
      _notes: null,
      status: 'proceed',
      recommendation: 'proceed_to_underwrite',
      flags: [],
    };

    const result = writeAgentBlock(MINIMAL_FILE, parsed, { sectionId: 'screening', content: newContent });

    expect(result.newBlock.sectionId).toBe('screening');
    expect(result.newBlock.version).toBe(1);
    expect(result.supersededPriorBlock).toBe(false); // no prior block

    // Round-trip: the result must be parseable
    const reparsed = parseUWFile(result.content);
    const screeningBlock = getSection(reparsed, 'screening');
    expect(screeningBlock).not.toBeNull();
    expect((screeningBlock!.content as Record<string, unknown>)['status']).toBe('proceed');
  });

  it('supersedes existing block when writing a newer version', () => {
    const parsed = parseUWFile(MINIMAL_FILE);

    // First write: v1
    const v1Content = {
      _meta: buildMeta('noi_model', 1, { source: 'engine:calculations.ts', agentId: 'engine', confidence: 'high' }),
      net_operating_income: 300000,
    };
    const r1 = writeAgentBlock(MINIMAL_FILE, parsed, { sectionId: 'noi_model', content: v1Content });

    // Second write: v2 supersedes v1
    const parsed2 = parseUWFile(r1.content);
    const v2Content = {
      _meta: buildMeta('noi_model', 2, { source: 'engine:calculations.ts', agentId: 'engine', confidence: 'high' }),
      net_operating_income: 320000,
    };
    const r2 = writeAgentBlock(r1.content, parsed2, { sectionId: 'noi_model', content: v2Content });

    expect(r2.newBlock.version).toBe(2);
    expect(r2.supersededPriorBlock).toBe(true);

    const reparsed = parseUWFile(r2.content);
    const current = getSection(reparsed, 'noi_model') as Record<string, unknown> | null;
    expect((current?.content as Record<string, unknown> | undefined)?.['net_operating_income']).toBe(320000);

    // v1 block should be in superseded
    expect(reparsed.superseded['noi_model']).toBeDefined();
    expect(reparsed.superseded['noi_model']!.length).toBe(1);
  });

  it('appends a pipeline_log entry', () => {
    const parsed = parseUWFile(MINIMAL_FILE);
    const newContent = {
      _meta: buildMeta('market_analysis', 1, { source: 'agent:L2', agentId: 'L2', confidence: 'medium' }),
      market_vacancy: 0.05,
    };

    const result = writeAgentBlock(MINIMAL_FILE, parsed, { sectionId: 'market_analysis', content: newContent }, {
      agentId: 'L2-01',
      durationMs: 1234,
      notes: 'Phoenix West submarket analysis',
    });

    const reparsed = parseUWFile(result.content);
    expect(reparsed.pipeline_log.length).toBeGreaterThan(0);

    const lastLog = reparsed.pipeline_log[reparsed.pipeline_log.length - 1];
    const entries = (lastLog.content as Record<string, unknown>)['entries'] as unknown[];
    const lastEntry = entries[entries.length - 1] as Record<string, unknown>;
    expect(lastEntry['agent_or_actor']).toBe('L2-01');
    expect(lastEntry['section_affected']).toBe('market_analysis');
    expect(lastEntry['duration_ms']).toBe(1234);
  });

  it('updates frontmatter last_modified', () => {
    const parsed = parseUWFile(MINIMAL_FILE);
    const newContent = {
      _meta: buildMeta('debt_structure', 1, { source: 'wizard', agentId: 'wizard', confidence: 'high' }),
      loan_amount: 3500000,
    };

    const result = writeAgentBlock(MINIMAL_FILE, parsed, { sectionId: 'debt_structure', content: newContent });

    // last_modified should have changed from the fixture value
    expect(result.content).not.toContain('last_modified: "2026-01-01T00:00:00Z"');
  });

  it('updates frontmatter quick_metrics when specified', () => {
    const parsed = parseUWFile(MINIMAL_FILE);
    const newContent = {
      _meta: buildMeta('noi_model', 1, { source: 'engine', confidence: 'high' }),
      net_operating_income: 385000,
    };

    const result = writeAgentBlock(MINIMAL_FILE, parsed, { sectionId: 'noi_model', content: newContent }, {
      updateQuickMetrics: { noi_underwritten: 385000 },
    });

    // noi_underwritten should be updated in frontmatter
    expect(result.content).toContain('noi_underwritten: 385000');
  });

  it('marks prior block as superseded in both fence annotation and _meta', () => {
    const parsed = parseUWFile(MINIMAL_FILE);

    // Write v1 of property (already exists in fixture)
    const existingProperty = getSection(parsed, 'property');
    expect(existingProperty?.meta.version).toBe(1);

    // Write v2 — should supersede v1
    const v2 = {
      _meta: buildMeta('property', 2, { source: 'agent:L1-01', agentId: 'L1-01', confidence: 'high' }),
      total_units: 24,
      year_built: 1995,
      asset_class: 'multifamily',
      condition: 'average_good',
    };

    const result = writeAgentBlock(MINIMAL_FILE, parsed, { sectionId: 'property', content: v2 });

    // Both the fence annotation and _meta should say superseded
    expect(result.content).toContain('superseded=true');
    expect(result.content).toContain('"superseded": true');

    // Re-parse: current version is 2, v1 is in superseded
    const reparsed = parseUWFile(result.content);
    const current = getSection(reparsed, 'property');
    expect(current?.meta.version).toBe(2);
    expect(reparsed.superseded['property']?.length).toBe(1);
  });
});

// ─── buildMeta tests ──────────────────────────────────────────────────────────

describe('buildMeta', () => {
  it('produces valid UWMeta with required fields', () => {
    const meta = buildMeta('debt_structure', 1, { source: 'wizard', confidence: 'high' });
    expect(meta.section).toBe('debt_structure');
    expect(meta.version).toBe(1);
    expect(meta.superseded).toBe(false);
    expect(meta.source).toBe('wizard');
    expect(meta.confidence).toBe('high');
    expect(meta.timestamp).toBeTruthy();
    expect(Array.isArray(meta.flags)).toBe(true);
  });
});

// ─── buildAgentContext tests ──────────────────────────────────────────────────

describe('buildAgentContext', () => {
  it('builds correct context for L1 screening layer', () => {
    const parsed = parseUWFile(MINIMAL_FILE);
    const ctx = buildAgentContext(parsed, 'L1');
    expect(ctx.layer.id).toBe('L1');
    expect(ctx.layer.writes).toContain('screening');
    expect(ctx.sections['property']).toBeDefined();
    expect(ctx.chatContext).toBeTruthy();
  });

  it('reports missing required sections for L2 when rent_roll absent', () => {
    const parsed = parseUWFile(MINIMAL_FILE);
    // L2 requires property + rent_roll; minimal file has property but not rent_roll
    const ctx = buildAgentContext(parsed, 'L2');
    expect(ctx.missingRequired).toContain('rent_roll');
    expect(ctx.missingRequired).not.toContain('property'); // property is present
  });

  it('isContextReady returns false for L2 when rent_roll missing', () => {
    const parsed = parseUWFile(MINIMAL_FILE);
    const ctx = buildAgentContext(parsed, 'L2');
    expect(isContextReady(ctx)).toBe(false);
  });

  it('isContextReady returns true for L1 with minimal file (only requires property)', () => {
    const parsed = parseUWFile(MINIMAL_FILE);
    // L1 only requires property; minimal file has it
    const ctx = buildAgentContext(parsed, 'L1');
    expect(ctx.missingRequired).not.toContain('property');
    expect(isContextReady(ctx)).toBe(true);
  });

  it('isContextReady returns false when blocking_flags are present', () => {
    const fileWithBlock = MINIMAL_FILE.replace('blocking_flags: []', 'blocking_flags:\n  - "ofac_match"');
    const parsed = parseUWFile(fileWithBlock);
    const ctx = buildAgentContext(parsed, 'L1');
    expect(isContextReady(ctx)).toBe(false);
  });
});

// ─── BANCROFT_LAYERS completeness ─────────────────────────────────────────────

describe('BANCROFT_LAYERS', () => {
  it('has entries for L0, L1, L2, L4, L5, L6, L7', () => {
    const ids = BANCROFT_LAYERS.map(l => l.id);
    for (const id of ['L0', 'L1', 'L2', 'L4', 'L5', 'L6', 'L7']) {
      expect(ids).toContain(id);
    }
  });

  it('each layer has a non-empty writes array', () => {
    for (const layer of BANCROFT_LAYERS) {
      expect(layer.writes.length).toBeGreaterThan(0);
    }
  });
});
