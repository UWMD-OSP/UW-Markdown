// RFC 0031 codemod — the mapping is total over the measured corpus values and
// mechanical; anything it does not know is left in place and reported.

import { describe, expect, it } from 'vitest';
import { mapLegacySource, migrateSourceTags } from './migrate-source-tags.js';
import { parseUWFile } from './parser.js';
import { validateUWFile } from './validator.js';

describe('mapLegacySource', () => {
  it('leaves well-formed actors alone', () => {
    for (const s of ['manual', 'agent/L6-01', 'document/rent_roll', 'system/init']) {
      expect(mapLegacySource(s), s).toBeNull();
    }
  });

  it('moves user-entered tags to manual + resolution', () => {
    expect(mapLegacySource('user_input')).toEqual({ source: 'manual', resolution: 'user_input' });
    expect(mapLegacySource('user_override')).toEqual({ source: 'manual', resolution: 'user_override' });
  });

  it('recovers the agent actor from agent_id for agent-method tags', () => {
    expect(mapLegacySource('ai_extracted', 'L0-01')).toEqual({
      source: 'agent/L0-01', resolution: 'ai_extracted',
    });
    expect(mapLegacySource('agent_computed', null)).toEqual({
      source: 'agent/unattributed', resolution: 'agent_computed',
    });
  });

  it('assigns engine-resolved methods to system/uwmd', () => {
    for (const tag of ['market_data', 'market_data_accepted', 'asset_class_default',
      'scenario_default', 'global_default', 'system_default',
      'inherited_assumption', 'investor_profile']) {
      expect(mapLegacySource(tag), tag).toEqual({ source: 'system/uwmd', resolution: tag });
    }
  });

  it('swaps the retired colon forms into their namespaces', () => {
    expect(mapLegacySource('agent:L0-01')).toEqual({ source: 'agent/L0-01' });
    expect(mapLegacySource('engine:calculations.ts')).toEqual({ source: 'system/calculations.ts' });
    expect(mapLegacySource('engine:uwmd')).toEqual({ source: 'system/uwmd' });
    expect(mapLegacySource('import:om.pdf')).toEqual({ source: 'document/om.pdf' });
    expect(mapLegacySource('market:costar')).toEqual({ source: 'system/costar', resolution: 'market_data' });
    expect(mapLegacySource('user:override')).toEqual({ source: 'manual', resolution: 'user_override' });
    expect(mapLegacySource('wizard:step_2')).toEqual({ source: 'manual', resolution: 'user_input' });
  });

  it('maps the bare words the corpus measurement surfaced', () => {
    expect(mapLegacySource('user')).toEqual({ source: 'manual' });
    expect(mapLegacySource('wizard')).toEqual({ source: 'manual', resolution: 'user_input' });
    expect(mapLegacySource('extractor')).toEqual({ source: 'system/extractor', resolution: 'ai_extracted' });
    expect(mapLegacySource('L6')).toEqual({ source: 'agent/L6' });
    expect(mapLegacySource('L6-01')).toEqual({ source: 'agent/L6-01' });
  });

  it('refuses to guess at an unknown source', () => {
    expect(mapLegacySource('completely-novel-thing')).toBeNull();
  });
});

describe('migrateSourceTags', () => {
  const FILE = `---
uw_version: "1.1"
deal_id: "migrate-test"
asset_class: multifamily
---

# Migrate

Some prose that must survive byte-for-byte.

\`\`\`json uw:section=property source=market_data ts=2026-08-31T00:00:00Z v=1
{
  "_meta": {
    "section": "property",
    "version": 1,
    "superseded": false,
    "source": "market_data",
    "agent_id": null,
    "agent_version": null,
    "actor": "test",
    "timestamp": "2026-08-31T00:00:00Z",
    "confidence": "high",
    "human_review_required": false
  },
  "total_units": 10
}
\`\`\`

\`\`\`json uw:section=valuation source=manual ts=2026-08-31T00:00:00Z v=1
{
  "_meta": {
    "section": "valuation",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test",
    "timestamp": "2026-08-31T00:00:00Z",
    "confidence": "high",
    "human_review_required": false
  },
  "purchase_price": 5000000
}
\`\`\`
`;

  it('splits the legacy tag, mirrors the fence, and leaves clean blocks untouched', () => {
    const result = migrateSourceTags(FILE);
    expect(result.changed).toBe(1);
    expect(result.unmapped).toEqual([]);
    expect(result.content).toContain('uw:section=property source=system/uwmd');
    expect(result.content).toContain('"source": "system/uwmd"');
    expect(result.content).toContain('"resolution": "market_data"');
    // The untouched block and the prose keep their bytes.
    expect(result.content).toContain('Some prose that must survive byte-for-byte.');
    expect(result.content).toContain('uw:section=valuation source=manual');
  });

  it('keeps resolution adjacent to source in the rewritten _meta', () => {
    const result = migrateSourceTags(FILE);
    expect(result.content).toMatch(/"source": "system\/uwmd",\n\s+"resolution": "market_data",/);
  });

  it('produces a file with zero SRC warnings', () => {
    const migrated = migrateSourceTags(FILE).content;
    const issues = validateUWFile(parseUWFile(migrated)).issues.filter((i) => i.code.startsWith('SRC-'));
    expect(issues).toEqual([]);
  });

  it('is idempotent', () => {
    const once = migrateSourceTags(FILE).content;
    const twice = migrateSourceTags(once);
    expect(twice.changed).toBe(0);
    expect(twice.content).toBe(once);
  });

  it('refuses a hashed block rather than silently invalidating a chain', () => {
    const hashed = FILE.replace(
      '"source": "market_data",',
      '"source": "market_data",\n    "content_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",',
    );
    const result = migrateSourceTags(hashed);
    expect(result.changed).toBe(0);
    expect(result.unmapped).toEqual(['market_data [content_hash]']);
    expect(result.content).toBe(hashed);
  });

  it('reports an unknown source instead of guessing', () => {
    const novel = FILE.replace('"source": "market_data"', '"source": "novel-thing"')
      .replace('source=market_data', 'source=novel-thing');
    const result = migrateSourceTags(novel);
    expect(result.changed).toBe(0);
    expect(result.unmapped).toEqual(['novel-thing']);
  });

  it('moves canonical tags in field_overrides to resolution', () => {
    const withOverride = FILE.replace(
      '"human_review_required": false\n  },\n  "purchase_price": 5000000',
      '"human_review_required": false,\n    "field_overrides": [{ "path": "purchase_price", "source": "market_data_accepted" }]\n  },\n  "purchase_price": 5000000',
    );
    const result = migrateSourceTags(withOverride);
    expect(result.changed).toBe(2);
    expect(result.content).toContain('"resolution": "market_data_accepted"');
    expect(result.content).not.toContain('"source": "market_data_accepted"');
  });
});

describe('migrateSourceTags — CRLF working copies', () => {
  it('migrates a CRLF file and hands back CRLF endings', () => {
    const lf = [
      '```json uw:section=property source=user_input ts=x v=1',
      '{',
      '  "_meta": { "section": "property", "source": "user_input" },',
      '  "x": 1',
      '}',
      '```',
      '',
    ].join('\n');
    const crlf = lf.replace(/\n/g, '\r\n');
    const result = migrateSourceTags(crlf);
    expect(result.changed).toBe(1);
    expect(result.content).toContain('\r\n');
    expect(result.content).not.toMatch(/[^\r]\n/);
    expect(result.content).toContain('"resolution": "user_input"');
  });
});
