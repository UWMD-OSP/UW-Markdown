import { describe, expect, it } from 'vitest';
import { compact, diff } from './compactor.js';
import { generateBlankUWFile } from './init.js';
import { parseUWFile } from '@uwmd/verify';

function blankDeal(): string {
  return generateBlankUWFile({
    dealId: 'uw_2026_COMPACTOR',
    dealName: 'Compactor Test',
  });
}

describe('compact', () => {
  it('removes each superseded fence without disturbing the current block', () => {
    const original = blankDeal();
    const superseded = original.replace(
      'v=1 confidence=low\n{',
      'v=1 superseded=true confidence=low\n{',
    ).replace('"superseded": false', '"superseded": true');
    const current = original.replace('"_notes": null', '"_notes": "current"');
    const parsed = parseUWFile(`${superseded}\n${current.slice(current.indexOf('```json uw:section=deal_context'))}`);

    const result = compact(parsed);

    expect(result).not.toContain('"superseded": true');
    expect(result).toContain('"_notes": "current"');
  });
});

describe('diff', () => {
  it('reports changed fields but ignores provenance-only _meta changes', () => {
    const before = parseUWFile(blankDeal());
    const changedContent = blankDeal()
      .replace('"_notes": null', '"_notes": "updated"')
      .replace('"version": 1,', '"version": 2,');
    const after = parseUWFile(changedContent);

    const sections = diff(before, after);
    const dealContext = sections.find(section => section.sectionId === 'deal_context');

    expect(dealContext).toMatchObject({
      status: 'changed',
      changedFields: ['_notes'],
    });
    expect(sections.every(section => section.status === 'changed' || section.status === 'unchanged')).toBe(true);
  });
});

// ─── compact (moved from parser.test.ts, RFC 0083) ─────────────────────────────────────────────────────────────────

describe('compact', () => {
  it('removes superseded blocks and returns shorter content', () => {
    const content = `---
uw_version: "3.0"
deal_id: "x"
deal_name: "x"
created: "2026-01-01T00:00:00Z"
last_modified: "2026-01-01T00:00:00Z"
property_address: ""
city: ""
state: "AZ"
zip: ""
asset_class: multifamily
---

\`\`\`json uw:section=property source=manual ts=2026-01-01T00:00:00Z v=1 superseded=true confidence=high
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "manual",
      "resolution": "user_input",
      "actor": "user",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-01-01T00:00:00Z",
      "notes": null
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": true
    }
  },
  "total_units": 10
}
\`\`\`

\`\`\`json uw:section=property source=manual ts=2026-01-02T00:00:00Z v=2 confidence=high
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "manual",
      "resolution": "user_input",
      "actor": "user",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-01-02T00:00:00Z",
      "notes": null
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 2,
      "superseded": false
    }
  },
  "total_units": 48
}
\`\`\`
`;
    const parsed = parseUWFile(content);
    const compacted = compact(parsed);
    expect(compacted.length).toBeLessThan(content.length);
    // v=1 block should be gone
    expect(compacted).not.toContain('"total_units": 10');
    // v=2 block should remain
    expect(compacted).toContain('"total_units": 48');
  });

  it('returns original content unchanged when no superseded blocks exist', () => {
    const content = `---
uw_version: "3.0"
deal_id: "x"
deal_name: "x"
created: "2026-01-01T00:00:00Z"
last_modified: "2026-01-01T00:00:00Z"
property_address: ""
city: ""
state: "AZ"
zip: ""
asset_class: multifamily
---
\`\`\`json uw:section=property source=manual ts=2026-01-01T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "manual",
      "resolution": "user_input",
      "actor": "user",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-01-01T00:00:00Z",
      "notes": null
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "total_units": 48
}
\`\`\`
`;
    const parsed = parseUWFile(content);
    const compacted = compact(parsed);
    expect(compacted).toBe(content);
  });
});
