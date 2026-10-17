// META-01 — the one block shape (Format §2.4–§2.5, RFC 0081 §3). A block is the
// bare payload with an inline nested `_meta`; the retired `{section_id, _meta,
// content}` wrapper and the retired flat `_meta` are both META-01 errors.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as publicAPI from './index.js';
import type { ParsedUWFile, UWBlock } from './types.js';
import { parseUWFile } from './parser.js';
import { validateUWFile } from './validator.js';
import { buildMeta } from './metadata.js';

const doc = (block: Record<string, unknown>) => parseUWFile(`---
uw_version: "3.0"
deal_id: "shape"
asset_class: multifamily
---

\`\`\`json uw:section=property v=1
${JSON.stringify(block, null, 2)}
\`\`\`
`);
const meta = buildMeta('property', 1, { source: 'manual', actor: 'test', timestamp: '2026-10-12T00:00:00Z' });
const meta01 = (block: Record<string, unknown>) =>
  validateUWFile(doc(block)).issues.filter((i) => i.code === 'META-01');

describe('META-01', () => {
  it('accepts the bare block with nested _meta', () => {
    expect(meta01({ _meta: meta, total_units: 10 })).toEqual([]);
  });

  it('reads a payload member named content as payload, not a wrapper', () => {
    expect(meta01({ _meta: meta, content: { total_units: 10 } })).toEqual([]);
  });

  it('refuses a section_id wrapper member as an error', () => {
    const issues = meta01({ section_id: 'property', _meta: meta, content: { total_units: 10 } });
    expect(issues).toMatchObject([{ severity: 'error', section: 'property' }]);
  });

  it('refuses a flat _meta as an error', () => {
    const flat = { section: 'property', version: 1, superseded: false, source: 'manual', actor: 'test', timestamp: '2026-10-12T00:00:00Z', confidence: 'high', human_review_required: false };
    expect(meta01({ _meta: flat, total_units: 10 })).toMatchObject([{ severity: 'error' }]);
  });

  it('refuses a _meta missing either nested provenance or lifecycle', () => {
    const { provenance: _p, ...noProvenance } = meta;
    const { lifecycle: _l, ...noLifecycle } = meta;
    expect(meta01({ _meta: noProvenance, total_units: 10 })).toHaveLength(1);
    expect(meta01({ _meta: noLifecycle, total_units: 10 })).toHaveLength(1);
  });

  it('leaves an absent _meta to META_MISSING', () => {
    const result = validateUWFile(doc({ total_units: 10 }));
    expect(result.issues.filter((i) => i.code === 'META-01')).toEqual([]);
    expect(result.issues.some((i) => i.code === 'META_MISSING')).toBe(true);
  });
});


// RFC 0090 candidate: exact actor admission and retained physical evidence.
const header = '---\nuw_version: "3.0"\nasset_class: multifamily\ndeal_id: actor\n---\n';
const fence = (id: string, payload: Record<string, unknown>, suffix = '') =>
  `\`\`\`json uw:section=${id} ${suffix}\n${JSON.stringify(payload)}\n\`\`\`\n`;
const body = (id: string, actor: unknown = 'test') => ({
  _meta: { ...structuredClone(meta), section: id, provenance: { ...meta.provenance, actor } },
});
const actorIssues = (parsed: ParsedUWFile) => validateUWFile(parsed).issues.filter(i => i.code === 'META-01' && i.field === '_meta.provenance.actor');

describe('RFC 0090 actor admission', () => {
  it.each([null, '', 0, false, [], {}])('refuses a present invalid actor: %j', actor => {
    const payload = body('property', actor);
    expect(actorIssues(doc(payload))).toMatchObject([{
      code: 'META-01', severity: 'error', section: 'property', field: '_meta.provenance.actor',
      message: 'Block _meta.provenance.actor must be a nonempty string.',
    }]);
  });

  it('refuses absent actor without adding a completeness suffix or changing schema', () => {
    const payload = body('property');
    delete (payload._meta.provenance as Partial<typeof payload._meta.provenance>).actor;
    const result = validateUWFile(doc(payload));
    expect(result.issues.filter(i => i.field === '_meta.provenance.actor')).toHaveLength(1);
    expect(result.overall_status).toBe('errors');
    expect(result.issues.some(i => i.code === 'META_FIELD_MISSING_ACTOR')).toBe(false);
    const schema = JSON.parse(readFileSync(new URL('../../../spec/schemas/uwmd-block.schema.json', import.meta.url), 'utf8'));
    expect(schema.$defs.UWMeta.properties.provenance.required).toContain('actor');
    expect(schema.$defs.UWMeta.properties.provenance.properties.actor).toMatchObject({ type: 'string', minLength: 1 });
  });

  it.each([' ', '  principal  ', 'not/a/registered/source', '作者'])('preserves arbitrary nonempty actor %j', actor => {
    const parsed = doc(body('property', actor));
    const before = JSON.stringify(parsed);
    expect(actorIssues(parsed)).toEqual([]);
    expect(JSON.stringify(parsed)).toBe(before);
  });

  it('keeps malformed wrapper/nesting and absent metadata precedence without cascades', () => {
    for (const invalid of [null, [], 'flat', {}, { provenance: null, lifecycle: {} }, { provenance: {}, lifecycle: null }]) {
      const result = validateUWFile(doc({ _meta: invalid }));
      expect(result.issues.filter(i => i.code === 'META-01')).toHaveLength(1);
      expect(result.issues.some(i => i.field === '_meta.provenance.actor')).toBe(false);
    }
    expect(meta01({ section_id: 'property', ...body('property', '') })).toHaveLength(1);
    expect(actorIssues(doc({ total_units: 1 }))).toEqual([]);
  });

  it('checks physical source order across history, overwritten peers, extensions and append blocks', () => {
    const source = header
      + fence('x_peer', body('x_peer', ''), 'variant=first v=1')
      + fence('pipeline_log', body('pipeline_log', ''), 'v=1')
      + fence('property', body('property', ''), 'superseded=true v=1')
      + fence('custom_calculations', body('custom_calculations', ''), 'v=1')
      + fence('custom_scenarios', body('custom_scenarios', ''), 'v=1')
      + fence('x_peer', body('x_peer'), 'variant=second v=2')
      + fence('property', body('property'), 'v=2');
    const parsed = parseUWFile(source);
    const before = JSON.stringify(parsed);
    expect(actorIssues(parsed).map(i => i.section)).toEqual(['x_peer', 'pipeline_log', 'property', 'custom_calculations', 'custom_scenarios']);
    expect(JSON.stringify(parsed)).toBe(before);
    expect(parsed.raw).toBe(source);
    expect(parsed.extensions.x_peer.annotation.variant).toBe('second');
  });

  it('keeps old visible shape order, then newly retained shape, then actor before ROLE/SRC', () => {
    const source = header
      + fence('x_lost', { _meta: {} }, 'v=1')
      + fence('x_lost', body('x_lost'), 'v=2')
      + fence('property', { _meta: {} })
      + fence('rent_roll', { ...body('rent_roll', ''), _role: 'invalid' });
    const parsed = parseUWFile(source);
    const rent = parsed.sections.rent_roll as UWBlock;
    rent.meta.provenance.source = 'invalid-source';
    const issues = validateUWFile(parsed).issues;
    expect(issues.filter(i => i.code === 'META-01').map(i => [i.section, i.field])).toEqual([
      ['property', undefined], ['x_lost', undefined], ['rent_roll', '_meta.provenance.actor'],
    ]);
    const actor = issues.findIndex(i => i.field === '_meta.provenance.actor');
    expect(issues.findIndex(i => i.code === 'ROLE-01')).toBeGreaterThan(actor);
    expect(issues.findIndex(i => i.code === 'SRC-01')).toBeGreaterThan(actor);
  });

  it('assesses in-place model mutations and does not silently reparse stale raw', () => {
    const parsed = doc(body('property'));
    const block = parsed.sections.property as UWBlock;
    const before = parsed.raw;
    (block.content._meta as typeof meta).provenance.actor = '';
    expect(actorIssues(parsed)).toHaveLength(1);
    expect(parsed.raw).toBe(before);
    (block.content._meta as typeof meta).provenance.actor = 'fixed model';
    parsed.raw = header + fence('property', body('property', ''));
    expect(actorIssues(parsed)).toEqual([]);
  });

  it('retains removed/replaced physical references and checks model-only additions once', () => {
    const parsed = parseUWFile(header + fence('x_old', body('x_old', '')));
    delete parsed.extensions.x_old;
    const added = doc(body('property', '')).sections.property as UWBlock;
    parsed.sections.property = added;
    parsed.extensions.x_alias = added;
    expect(actorIssues(parsed).map(i => i.section)).toEqual(['x_old', 'property']);
  });

  it('does not certify missing physical peers from a cloned or hand-built model/raw string', () => {
    const parsed = parseUWFile(header + fence('x_peer', body('x_peer', ''), 'v=1') + fence('x_peer', body('x_peer'), 'v=2'));
    expect(actorIssues(parsed)).toHaveLength(1);
    const clone = JSON.parse(JSON.stringify(parsed)) as ParsedUWFile;
    expect(actorIssues(clone)).toEqual([]); // model-only: the lost peer is absent
    clone.raw = 'stale non-document raw does not replace the supplied model';
    const payload = clone.extensions.x_peer.content._meta as typeof meta;
    payload.provenance.actor = '';
    expect(actorIssues(clone)).toHaveLength(1);
  });

  it('uses canonical inline content metadata rather than a divergent convenience alias', () => {
    const parsed = doc(body('property'));
    const block = parsed.sections.property as UWBlock;
    block.meta = structuredClone(meta);
    block.meta.provenance.actor = '';
    expect(actorIssues(parsed)).toEqual([]);
    block.meta.provenance.actor = 'alias cannot repair canonical data';
    (block.content._meta as typeof meta).provenance.actor = '';
    expect(actorIssues(parsed)).toHaveLength(1);
  });

  it('keeps retained evidence private and parsed/portable public shape unchanged', () => {
    const parsed = doc(body('property'));
    expect(Object.keys(parsed)).toEqual(['frontmatter', 'sections', 'prose', 'pipeline_log', 'custom_calculations', 'custom_scenarios', 'extensions', 'superseded', 'raw']);
    expect(publicAPI).not.toHaveProperty('parsedPhysicalBlocks');
  });
});
