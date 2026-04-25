// Editor tests — Tier-2 dispatcher behavior per UW_PROTOCOL_v1.md §V.

import { describe, it, expect } from 'vitest';
import { parseUWFile, getSection } from './parser.js';
import { applyEdit, resolvePolicy } from './editor.js';
import type { EditContext, EditResult } from './editor.js';
import type { EditOperation } from './protocol.js';
import { BUILTIN_EDIT_POLICIES } from './protocol.js';

// ─── Shared fixture ───────────────────────────────────────────────────────────
// A minimal but realistic .uw.md with one canonical block and a pipeline_log.

const FILE = `---
uw_version: "1.1"
deal_id: "uw_2026_EDITOR"
deal_name: "Editor Test Deal"
created: "2026-01-01T00:00:00Z"
last_modified: "2026-01-01T00:00:00Z"
property_address: "1 Test Way"
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

# Editor Test Deal

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
  "year_built": 1995,
  "asset_class": "multifamily"
}
\`\`\`

## Risk Assessment {#risk_assessment}

\`\`\`json uw:section=risk_assessment source=agent/L6 ts=2026-01-02T00:00:00Z v=2 confidence=medium
{
  "_meta": {
    "section": "risk_assessment",
    "version": 2,
    "superseded": false,
    "source": "agent/L6",
    "agent_id": "L6",
    "agent_version": "1.0.0",
    "actor": "system",
    "timestamp": "2026-01-02T00:00:00Z",
    "confidence": "medium",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "overall_rating": "moderate",
  "risk_score": 6,
  "key_risks": ["interest rate", "lease-up"]
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

const MANUAL_CTX: EditContext = { actor: 'jared', source: 'manual' };
const AGENT_CTX: EditContext = {
  actor: 'system',
  source: 'agent/L6',
  agentId: 'L6',
  agentVersion: '1.0.0',
};
const SYSTEM_CTX: EditContext = { actor: 'system', source: 'system/init' };

function expectOk(result: EditResult): asserts result is EditResult & { ok: true; content: string } {
  expect(result.ok).toBe(true);
  expect(result.error).toBeUndefined();
  expect(result.content).toBeTypeOf('string');
}

// ─── Policy resolution ────────────────────────────────────────────────────────

describe('resolvePolicy', () => {
  it('returns the most-specific match', () => {
    const policy = resolvePolicy('agent/L6');
    expect(policy?.source_pattern).toBe('agent/*');
    expect(policy?.authority).toBe('either');
    expect(policy?.supersede_on_edit).toBe(true);
  });

  it('matches an exact pattern over a glob', () => {
    const custom = [
      { source_pattern: 'agent/*', authority: 'either' as const, supersede_on_edit: true },
      { source_pattern: 'agent/L6', authority: 'system_only' as const, supersede_on_edit: false },
    ];
    const policy = resolvePolicy('agent/L6', custom);
    expect(policy?.source_pattern).toBe('agent/L6');
  });

  it('returns null for unmatched sources', () => {
    expect(resolvePolicy('alien/xyz')).toBeNull();
  });
});

// ─── frontmatter_set ──────────────────────────────────────────────────────────

describe('applyEdit — frontmatter_set', () => {
  it('updates a top-level scalar and bumps last_modified', () => {
    const parsed = parseUWFile(FILE);
    const op: EditOperation = { kind: 'frontmatter_set', path: 'recommendation', value: 'approve' };
    const result = applyEdit(FILE, parsed, op, MANUAL_CTX);
    expectOk(result);

    const reparsed = parseUWFile(result.content);
    expect(reparsed.frontmatter.recommendation).toBe('approve');
    expect(reparsed.frontmatter.last_modified).not.toBe('2026-01-01T00:00:00Z');
  });

  it('updates a nested frontmatter field (quick_metrics.dscr)', () => {
    const parsed = parseUWFile(FILE);
    const op: EditOperation = { kind: 'frontmatter_set', path: 'quick_metrics.dscr', value: 1.35 };
    const result = applyEdit(FILE, parsed, op, MANUAL_CTX);
    expectOk(result);

    const reparsed = parseUWFile(result.content);
    expect(reparsed.frontmatter.quick_metrics?.dscr).toBe(1.35);
  });

  it('rejects edits to immutable fields', () => {
    const parsed = parseUWFile(FILE);
    for (const path of ['uw_version', 'deal_id', 'created']) {
      const op: EditOperation = { kind: 'frontmatter_set', path, value: 'mutated' };
      const result = applyEdit(FILE, parsed, op, MANUAL_CTX);
      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('PROTO-EDIT-002');
      expect(result.error?.category).toBe('edit');
    }
  });

  it('rejects dot-paths deeper than 2 levels', () => {
    const parsed = parseUWFile(FILE);
    const op: EditOperation = { kind: 'frontmatter_set', path: 'a.b.c', value: 'x' };
    const result = applyEdit(FILE, parsed, op, MANUAL_CTX);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('PROTO-EDIT-003');
  });

  it('rejects unknown frontmatter keys', () => {
    const parsed = parseUWFile(FILE);
    const op: EditOperation = { kind: 'frontmatter_set', path: 'no_such_key', value: 'x' };
    const result = applyEdit(FILE, parsed, op, MANUAL_CTX);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('PROTO-EDIT-009');
  });
});

// ─── section_replace ──────────────────────────────────────────────────────────

describe('applyEdit — section_replace', () => {
  it('overwrites an existing manual block in place and increments version', () => {
    const parsed = parseUWFile(FILE);
    const op: EditOperation = {
      kind: 'section_replace',
      section_id: 'property',
      content: { total_units: 30, year_built: 1995, asset_class: 'multifamily' },
      meta: { confidence: 'high' },
    };
    const result = applyEdit(FILE, parsed, op, MANUAL_CTX);
    expectOk(result);
    expect(result.newVersion).toBe(2);
    expect(result.supersededPriorBlock).toBe(false);

    const reparsed = parseUWFile(result.content);
    const block = getSection(reparsed, 'property');
    expect(block?.content['total_units']).toBe(30);
    expect(block?.meta.version).toBe(2);
    expect(block?.meta.source).toBe('manual');
    expect(block?.meta.actor).toBe('jared');
    expect(reparsed.superseded['property']).toBeUndefined();
  });

  it('rejects replace when target source requires supersede_on_edit', () => {
    // risk_assessment has source=agent/L6 which has supersede_on_edit: true
    const parsed = parseUWFile(FILE);
    const op: EditOperation = {
      kind: 'section_replace',
      section_id: 'risk_assessment',
      content: { overall_rating: 'low', risk_score: 3, key_risks: [] },
      meta: {},
    };
    const result = applyEdit(FILE, parsed, op, AGENT_CTX);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('PROTO-EDIT-004');
  });

  it('rejects replace on system block from non-system actor', () => {
    // Inject a system-sourced section via supersede first, then attempt a manual replace.
    const parsed0 = parseUWFile(FILE);
    const seedOp: EditOperation = {
      kind: 'section_supersede',
      section_id: 'compliance',
      content: { ofac_clear: true },
      meta: {},
    };
    const seeded = applyEdit(FILE, parsed0, seedOp, SYSTEM_CTX);
    expectOk(seeded);

    const parsed1 = parseUWFile(seeded.content);
    const replaceOp: EditOperation = {
      kind: 'section_replace',
      section_id: 'compliance',
      content: { ofac_clear: false },
      meta: {},
    };
    const result = applyEdit(seeded.content, parsed1, replaceOp, MANUAL_CTX);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('PROTO-EDIT-001');
  });

  it('rejects replace when section does not exist', () => {
    const parsed = parseUWFile(FILE);
    const op: EditOperation = {
      kind: 'section_replace',
      section_id: 'valuation',
      content: { purchase_price: 5_000_000 },
      meta: {},
    };
    const result = applyEdit(FILE, parsed, op, MANUAL_CTX);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('PROTO-EDIT-005');
  });

  it('strips caller-supplied _meta and _notes from content', () => {
    const parsed = parseUWFile(FILE);
    const op: EditOperation = {
      kind: 'section_replace',
      section_id: 'property',
      content: {
        total_units: 28,
        _meta: { section: 'property', version: 99, source: 'forged' },
        _notes: 'should be dropped',
      },
      meta: {},
    };
    const result = applyEdit(FILE, parsed, op, MANUAL_CTX);
    expectOk(result);

    const reparsed = parseUWFile(result.content);
    const block = getSection(reparsed, 'property');
    expect(block?.meta.version).toBe(2);
    expect(block?.meta.source).toBe('manual');
    expect(block?.content['_notes']).toBeUndefined();
  });
});

// ─── section_supersede ────────────────────────────────────────────────────────

describe('applyEdit — section_supersede', () => {
  it('marks the prior block superseded and appends a new versioned block', () => {
    const parsed = parseUWFile(FILE);
    const op: EditOperation = {
      kind: 'section_supersede',
      section_id: 'risk_assessment',
      content: { overall_rating: 'low', risk_score: 3, key_risks: ['interest rate'] },
      meta: {},
    };
    const result = applyEdit(FILE, parsed, op, AGENT_CTX);
    expectOk(result);
    expect(result.newVersion).toBe(3);
    expect(result.supersededPriorBlock).toBe(true);

    const reparsed = parseUWFile(result.content);
    const block = getSection(reparsed, 'risk_assessment');
    expect(block?.content['risk_score']).toBe(3);
    expect(block?.meta.version).toBe(3);
    expect(block?.meta.source).toBe('agent/L6');
    expect(reparsed.superseded['risk_assessment']?.length).toBe(1);
    expect(reparsed.superseded['risk_assessment']?.[0].meta.version).toBe(2);
  });

  it('chains supersedes — version increments each time, prior is archived', () => {
    let content = FILE;
    for (let i = 0; i < 3; i++) {
      const parsed = parseUWFile(content);
      const op: EditOperation = {
        kind: 'section_supersede',
        section_id: 'risk_assessment',
        content: { overall_rating: 'moderate', risk_score: 5 + i, key_risks: [] },
        meta: {},
      };
      const result = applyEdit(content, parsed, op, AGENT_CTX);
      expectOk(result);
      content = result.content;
    }
    const final = parseUWFile(content);
    const block = getSection(final, 'risk_assessment');
    expect(block?.meta.version).toBe(5); // started at 2 → +3 = 5
    expect(final.superseded['risk_assessment']?.length).toBe(3);
  });

  it('creates a new section when none exists (version starts at 1)', () => {
    const parsed = parseUWFile(FILE);
    const op: EditOperation = {
      kind: 'section_supersede',
      section_id: 'valuation',
      content: { purchase_price: 5_000_000, going_in_cap_rate: 0.055 },
      meta: {},
    };
    const result = applyEdit(FILE, parsed, op, MANUAL_CTX);
    expectOk(result);
    expect(result.newVersion).toBe(1);
    expect(result.supersededPriorBlock).toBe(false);

    const reparsed = parseUWFile(result.content);
    const block = getSection(reparsed, 'valuation');
    expect(block?.content['purchase_price']).toBe(5_000_000);
  });
});

// ─── pipeline_log_append ──────────────────────────────────────────────────────

describe('applyEdit — pipeline_log_append', () => {
  it('appends an entry to the existing pipeline_log block', () => {
    const parsed = parseUWFile(FILE);
    const entry = {
      entry_id: 'log_test_1',
      timestamp: '2026-01-05T00:00:00Z',
      event_type: 'manual_edit',
      agent_or_actor: 'jared',
      section_affected: 'property',
      status: 'success',
    };
    const op: EditOperation = { kind: 'pipeline_log_append', entry };
    const result = applyEdit(FILE, parsed, op, MANUAL_CTX);
    expectOk(result);

    const reparsed = parseUWFile(result.content);
    const lastLog = reparsed.pipeline_log[reparsed.pipeline_log.length - 1];
    const entries = lastLog.content['entries'] as Array<Record<string, unknown>>;
    expect(entries.length).toBe(2);
    expect(entries[entries.length - 1]['entry_id']).toBe('log_test_1');
  });
});

// ─── Round-trip preservation ──────────────────────────────────────────────────

describe('applyEdit — round-trip preservation', () => {
  it('keeps unrelated bytes byte-identical (modulo last_modified) on frontmatter_set', () => {
    const parsed = parseUWFile(FILE);
    const op: EditOperation = { kind: 'frontmatter_set', path: 'recommendation', value: 'approve' };
    const result = applyEdit(FILE, parsed, op, MANUAL_CTX);
    expectOk(result);

    const before = FILE.split('\n');
    const after = result.content.split('\n');
    let differing = 0;
    for (let i = 0; i < Math.max(before.length, after.length); i++) {
      if (before[i] !== after[i]) differing++;
    }
    // recommendation + last_modified — exactly two lines should differ.
    expect(differing).toBe(2);
  });

  it('preserves the property block when only risk_assessment is superseded', () => {
    const parsed = parseUWFile(FILE);
    const op: EditOperation = {
      kind: 'section_supersede',
      section_id: 'risk_assessment',
      content: { overall_rating: 'high', risk_score: 8, key_risks: ['exit'] },
      meta: {},
    };
    const result = applyEdit(FILE, parsed, op, AGENT_CTX);
    expectOk(result);

    const before = parseUWFile(FILE);
    const after = parseUWFile(result.content);
    const propBefore = getSection(before, 'property');
    const propAfter = getSection(after, 'property');
    expect(propAfter?.rawJson).toBe(propBefore?.rawJson);
  });
});
