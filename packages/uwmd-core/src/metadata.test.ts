import { describe, expect, it } from 'vitest';
import { blockOverrides, buildMeta, bumpRawMetaVersion, stampMetaIntoBlockContent } from './metadata.js';
import { buildMeta as runnerBuildMeta } from './runner.js';
import type { UWBlock } from './types.js';

const META = () => buildMeta('property', 1, { source: 'manual', actor: 'test', timestamp: '2026-10-12T00:00:00Z' });

describe('stampMetaIntoBlockContent', () => {
  it('writes _meta as the first member and keeps the payload order (Format §2.4)', () => {
    const content: Record<string, unknown> = { total_units: 10, _role: 'primary', _meta: { stale: true }, year_built: 1990 };
    const meta = META();
    stampMetaIntoBlockContent(content, meta);
    expect(Object.keys(content)).toEqual(['_meta', 'total_units', '_role', 'year_built']);
    expect(content['_meta']).toBe(meta);
  });
});

describe('bumpRawMetaVersion', () => {
  it('advances lifecycle.revision and the provenance timestamp in place', () => {
    const meta = META();
    expect(bumpRawMetaVersion(meta, '2026-10-13T00:00:00Z')).toBe(2);
    expect(meta.lifecycle).toEqual({ revision: 2, superseded: false });
    expect(meta.provenance.timestamp).toBe('2026-10-13T00:00:00Z');
  });
});

describe('blockOverrides', () => {
  it('reads the block-level _overrides member, never a member of _meta', () => {
    const overrides = [{ path: 'units[0].rent', reason: 'missing' as const }];
    expect(blockOverrides({ content: { _overrides: overrides } } as Pick<UWBlock, 'content'>)).toBe(overrides);
    expect(blockOverrides({ content: { _meta: { quality: { field_overrides: overrides } } } } as Pick<UWBlock, 'content'>)).toEqual([]);
    expect(blockOverrides({ content: { _overrides: 'not an array' } } as Pick<UWBlock, 'content'>)).toEqual([]);
  });
});

describe('buildMeta', () => {
  it('builds the nested Format 3.0 shape, with integrity only when there is something to state', () => {
    const meta = META();
    expect(Object.keys(meta)).toEqual(['section', 'provenance', 'quality', 'lifecycle']);
    expect(buildMeta('property', 1, { source: 'manual', inputHash: 'a'.repeat(64) }).integrity)
      .toEqual({ input_hash: `sha256:${'a'.repeat(64)}` });
  });
});

// ─── buildMeta tests ──────────────────────────────────────────────────────────

describe('buildMeta', () => {
  it('is the same function the runner exports (public path unchanged)', () => {
    expect(runnerBuildMeta).toBe(buildMeta);
  });

  it('produces valid UWMeta with required fields', () => {
    const meta = buildMeta('debt_structure', 1, { source: 'wizard', confidence: 'high' });
    expect(meta.section).toBe('debt_structure');
    expect(meta.lifecycle?.revision).toBe(1);
    expect(meta.lifecycle?.superseded).toBe(false);
    expect(meta.provenance?.source).toBe('wizard');
    expect(meta.quality?.confidence).toBe('high');
    expect(meta.provenance?.timestamp).toBeTruthy();
    expect(Array.isArray(meta.quality?.flags)).toBe(true);
  });
});
