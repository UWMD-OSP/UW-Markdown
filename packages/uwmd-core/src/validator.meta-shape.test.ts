// META-V2-IN-V1 / META-V1-IN-V2 — the RFC 0009 one-shape-per-file rule, plus
// the parser's flat view over nested blocks and the editor's v2 refusal.

import { describe, expect, it } from 'vitest';
import { parseUWFile, getSection } from './parser.js';
import { validateUWFile } from './validator.js';
import { applyEdit } from './editor.js';
import { migrateToV2 } from './migrate-to-v2.js';

const FLAT_BLOCK = [
  '```json uw:section=rent_roll source=manual ts=2026-08-31T00:00:00Z v=1 confidence=high',
  '{',
  '  "_meta": {',
  '    "section_id": "rent_roll",',
  '    "version": 1,',
  '    "superseded": false,',
  '    "source": "manual",',
  '    "agent_id": null,',
  '    "agent_version": null,',
  '    "actor": "jared",',
  '    "timestamp": "2026-08-31T00:00:00Z",',
  '    "confidence": "high",',
  '    "human_review_required": false,',
  '    "flags": [],',
  '    "input_hash": null,',
  '    "notes": null',
  '  },',
  '  "unit_count": 10',
  '}',
  '```',
].join('\n');

const NESTED_BLOCK = [
  '```json uw:section=noi_model source=manual ts=2026-08-31T00:00:00Z v=1 confidence=high',
  '{',
  '  "_meta": {',
  '    "section": "noi_model",',
  '    "provenance": { "source": "manual", "actor": "jared", "timestamp": "2026-08-31T00:00:00Z" },',
  '    "quality": { "confidence": "high", "human_review_required": false },',
  '    "lifecycle": { "revision": 1, "superseded": false }',
  '  },',
  '  "net_operating_income": 100000',
  '}',
  '```',
].join('\n');

function file(uwVersion: string, ...blocks: string[]): string {
  return [
    '---',
    `uw_version: "${uwVersion}"`,
    'deal_id: shape-001',
    'deal_name: Shape Test',
    'asset_class: multifamily',
    'status: draft',
    '---',
    '',
    ...blocks.flatMap((b) => [b, '']),
  ].join('\n');
}

function metaIssues(content: string) {
  return validateUWFile(parseUWFile(content)).issues.filter((i) => i.code.startsWith('META-V'));
}

describe('META-V2-IN-V1', () => {
  it('errors on a nested block in a 1.x file', () => {
    const issues = metaIssues(file('1.1', NESTED_BLOCK));
    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe('META-V2-IN-V1');
    expect(issues[0]!.severity).toBe('error');
    expect(issues[0]!.section).toBe('noi_model');
  });

  it('stays silent for flat blocks in a 1.x file', () => {
    expect(metaIssues(file('1.1', FLAT_BLOCK))).toEqual([]);
  });
});

describe('META-V1-IN-V2', () => {
  it('errors on a flat block in a 2.0 file', () => {
    const issues = metaIssues(file('2.0', FLAT_BLOCK));
    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe('META-V1-IN-V2');
    expect(issues[0]!.severity).toBe('error');
  });

  it('stays silent for nested blocks in a 2.0 file', () => {
    expect(metaIssues(file('2.0', NESTED_BLOCK))).toEqual([]);
  });

  it('flags exactly the offending block in a mixed file', () => {
    const issues = metaIssues(file('2.0', NESTED_BLOCK, FLAT_BLOCK));
    expect(issues).toHaveLength(1);
    expect(issues[0]!.section).toBe('rent_roll');
  });
});

describe('parser flat view over nested blocks', () => {
  it('exposes v1 fields from a nested _meta', () => {
    const parsed = parseUWFile(file('2.0', NESTED_BLOCK));
    const block = getSection(parsed, 'noi_model');
    expect(block?.meta_shape).toBe('v2');
    expect(block?.meta.version).toBe(1);
    expect(block?.meta.superseded).toBe(false);
    expect(block?.meta.source).toBe('manual');
    expect(block?.meta.actor).toBe('jared');
    // content._meta stays bytes-derived and nested.
    expect((block?.content['_meta'] as Record<string, unknown>)['lifecycle']).toBeDefined();
  });
});

describe('editor writes v2 files natively (the 2.0 cut retired PROTO-EDIT-010)', () => {
  it('frontmatter edits work against a uw_version 2.0 file', async () => {
    const migrated = await migrateToV2(file('1.1', FLAT_BLOCK));
    const content = migrated.content as string;
    const parsed = parseUWFile(content);
    const result = applyEdit(
      content,
      parsed,
      { kind: 'frontmatter_set', path: 'status', value: 'active' },
      { actor: 'jared', source: 'manual' },
    );
    expect(result.ok).toBe(true);
    expect(result.content).toContain('status: "active"');
  });

  it('a section_supersede into a 2.0 file emits the NESTED shape and validates clean', async () => {
    const migrated = await migrateToV2(file('1.1', FLAT_BLOCK));
    const content = migrated.content as string;
    const parsed = parseUWFile(content);
    const result = applyEdit(
      content,
      parsed,
      {
        kind: 'section_supersede',
        section_id: 'rent_roll',
        content: { unit_count: 12 },
        meta: {},
      },
      { actor: 'jared', source: 'manual' },
    );
    expect(result.ok).toBe(true);
    const after = parseUWFile(result.content as string);
    const head = getSection(after, 'rent_roll');
    expect(head?.meta_shape).toBe('v2');
    expect(head?.meta.version).toBe(2);
    expect((head?.content['_meta'] as Record<string, unknown>)['lifecycle']).toBeDefined();
    expect(metaIssues(result.content as string)).toEqual([]);
    // The superseded prior stays nested and marked.
    expect(after.superseded['rent_roll']?.[0]?.meta.superseded).toBe(true);
    expect(after.superseded['rent_roll']?.[0]?.meta_shape).toBe('v2');
  });

  it('field_overrides in an edit lift to the block-level _overrides annotation', async () => {
    const migrated = await migrateToV2(file('1.1', FLAT_BLOCK));
    const content = migrated.content as string;
    const parsed = parseUWFile(content);
    const result = applyEdit(
      content,
      parsed,
      {
        kind: 'section_supersede',
        section_id: 'rent_roll',
        content: { unit_count: 12 },
        meta: { field_overrides: [{ path: 'unit_count', confidence: 'low' }] },
      },
      { actor: 'jared', source: 'manual' },
    );
    expect(result.ok).toBe(true);
    const head = getSection(parseUWFile(result.content as string), 'rent_roll');
    expect((head?.content as Record<string, unknown>)['_overrides']).toEqual([
      { path: 'unit_count', confidence: 'low' },
    ]);
    const quality = (head?.content['_meta'] as { quality: Record<string, unknown> }).quality;
    expect(quality['field_overrides']).toBeUndefined();
  });
});
