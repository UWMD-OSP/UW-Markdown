import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildMeta } from './metadata.js';
import { parseUWFile } from './parser.js';
import { validateUWFile } from './validator.js';
import type { ParsedUWFile, UWBlock } from './types.js';

const header = '---\nuw_version: "3.0"\nasset_class: multifamily\ndeal_id: flags\n---\n';
const payload = (id = 'property'): Record<string, unknown> => ({ _meta: buildMeta(id, 1, { source: 'manual', actor: 'test', timestamp: '2026-10-17T00:00:00Z' }) });
const fence = (id: string, value: Record<string, unknown>, suffix = '') => `\`\`\`json uw:section=${id} ${suffix}\n${JSON.stringify(value)}\n\`\`\`\n`;
const doc = (value: Record<string, unknown>) => parseUWFile(header + fence('property', value));
const flags = (parsed: ParsedUWFile) => validateUWFile(parsed).issues.filter(i => i.code === 'META-02' || i.code === 'META-03');
const bad = (id = 'property') => {
  const value = payload(id);
  const meta = value._meta as Record<string, Record<string, unknown>>;
  delete meta.quality.human_review_required;
  delete meta.lifecycle.superseded;
  return value;
};
const canonical = (block: UWBlock) => block.content._meta as Record<string, Record<string, unknown>>;

describe('RFC0091 required canonical metadata booleans', () => {
  it.each([true, false])('accepts literal booleans %j including low-confidence false', value => {
    const block = payload();
    const meta = block._meta as Record<string, Record<string, unknown>>;
    meta.quality.human_review_required = value;
    meta.quality.confidence = 'low';
    meta.lifecycle.superseded = value;
    expect(flags(doc(block))).toEqual([]);
  });

  it.each([undefined, null, '', 'false', 'true', 0, 1, [], {}])('rejects absent/null/nonboolean values %j without coercion', value => {
    const block = payload();
    const meta = block._meta as Record<string, Record<string, unknown>>;
    meta.quality.human_review_required = value;
    meta.lifecycle.superseded = value;
    const parsed = doc(block);
    const before = JSON.stringify(parsed);
    expect(flags(parsed)).toMatchObject([
      { code: 'META-02', severity: 'error', section: 'property', field: '_meta.quality.human_review_required', message: 'Block _meta.quality.human_review_required must be a boolean.' },
      { code: 'META-03', severity: 'error', section: 'property', field: '_meta.lifecycle.superseded', message: 'Block _meta.lifecycle.superseded must be a boolean.' },
    ]);
    expect(JSON.stringify(parsed)).toBe(before);
    const result = validateUWFile(parsed);
    expect(result.overall_status).toBe('errors');
    for (const issue of flags(parsed)) expect(result.errors).toContainEqual(issue);
  });

  it('preserves parent shape precedence and does not allocate quality-container errors', () => {
    for (const meta of [undefined, null, [], '', {}, { provenance: null, lifecycle: {} }, { provenance: {}, lifecycle: null }]) {
      expect(flags(doc({ _meta: meta }))).toEqual([]);
    }
    expect(flags(doc({ ...bad(), section_id: 'property' }))).toEqual([]);
    for (const quality of [undefined, null, [], '', 0]) {
      const value = bad();
      (value._meta as Record<string, unknown>).quality = quality;
      expect(flags(doc(value)).map(i => i.code)).toEqual(['META-03']);
    }
  });

  it('preserves completeness and actor findings, ordering flags before unrelated ROLE/SRC issues', () => {
    const value = bad();
    const meta = value._meta as Record<string, Record<string, unknown>>;
    meta.provenance.actor = '';
    meta.provenance.source = 'invalid-source';
    value._role = 'invalid';
    const result = validateUWFile(doc(value));
    const actor = result.issues.findIndex(i => i.field === '_meta.provenance.actor');
    const review = result.issues.findIndex(i => i.code === 'META-02');
    const history = result.issues.findIndex(i => i.code === 'META-03');
    expect(actor).toBeGreaterThanOrEqual(0);
    expect(review).toBeGreaterThan(actor);
    expect(history).toBeGreaterThan(review);
    expect(result.issues.findIndex(i => i.code === 'ROLE-01')).toBeGreaterThan(history);
    expect(result.issues.findIndex(i => i.code === 'SRC-01')).toBeGreaterThan(history);
    expect(result.issues.some(i => i.code === 'META_FIELD_MISSING_ACTOR')).toBe(false);
  });

  it('checks every physical peer/history/append block in source order without inference', () => {
    const ids = ['x_peer', 'pipeline_log', 'property', 'custom_calculations', 'custom_scenarios', 'property'];
    const source = header + ids.map((id, index) => fence(id, bad(id), index === 2 ? 'superseded=true v=1' : 'v=1')).join('')
      + fence('x_peer', payload('x_peer'), 'v=2 variant=current') + fence('property', payload(), 'v=2');
    const parsed = parseUWFile(source);
    const before = JSON.stringify(parsed);
    expect(flags(parsed).map(i => [i.section, i.code])).toEqual(ids.flatMap(id => [[id, 'META-02'], [id, 'META-03']]));
    expect(JSON.stringify(parsed)).toBe(before);
    expect(parsed.raw).toBe(source);
  });

  it('uses canonical mutable values, retained identity and model-only additions without stale raw authority', () => {
    const parsed = parseUWFile(header + fence('x_old', bad('x_old')));
    delete parsed.extensions.x_old;
    const added = doc(bad()).sections.property as UWBlock;
    parsed.sections.property = added;
    parsed.extensions.x_alias = added;
    expect(flags(parsed).map(i => i.section)).toEqual(['x_old', 'x_old', 'property', 'property']);
    canonical(added).quality.human_review_required = false;
    canonical(added).lifecycle.superseded = true;
    added.meta = (payload()._meta as UWBlock['meta']);
    added.meta.quality.human_review_required = undefined as unknown as boolean;
    expect(flags(parsed).map(i => i.section)).toEqual(['x_old', 'x_old']);
    parsed.raw = header + fence('property', bad());
    expect(flags(parsed).map(i => i.section)).toEqual(['x_old', 'x_old']);
  });

  it('checks model-only collection order and equal-valued distinct objects without duplicating identities', () => {
    const parsed = JSON.parse(JSON.stringify(doc(payload()))) as ParsedUWFile;
    parsed.sections = {};
    const make = (id: string) => parseUWFile(header + fence(id, bad(id))).extensions[id];
    parsed.sections.x_section = make('x_section');
    parsed.superseded.x_history = [make('x_history')];
    parsed.pipeline_log = [make('x_append')];
    parsed.custom_calculations = [make('x_calc')];
    parsed.custom_scenarios = [make('x_scenario')];
    parsed.extensions = { x_one: make('x_same'), x_two: make('x_same') };
    expect(flags(parsed).filter(i => i.code === 'META-02').map(i => i.section)).toEqual(['x_section', 'x_history', 'x_append', 'x_calc', 'x_scenario', 'x_one', 'x_two']);
  });

  it('does not invent lost peers for cloned models or change readiness/completeness rules', () => {
    const parsed = parseUWFile(header + fence('x_peer', bad('x_peer'), 'v=1') + fence('x_peer', payload('x_peer'), 'v=2'));
    expect(flags(parsed)).toHaveLength(2);
    expect(flags(JSON.parse(JSON.stringify(parsed)) as ParsedUWFile)).toEqual([]);
    const good = validateUWFile(doc(payload()));
    const invalid = validateUWFile(doc(bad()));
    expect(invalid.stage_readiness).toEqual(good.stage_readiness);
    expect(invalid.issues.filter(i => i.code.startsWith('META_'))).toEqual(good.issues.filter(i => i.code.startsWith('META_')));
  });

  it('matches unchanged existing required boolean schema declarations', () => {
    const schema = JSON.parse(readFileSync(new URL('../../../spec/schemas/uwmd-block.schema.json', import.meta.url), 'utf8'));
    for (const [group, field] of [['quality', 'human_review_required'], ['lifecycle', 'superseded']]) {
      expect(schema.$defs.UWMeta.properties[group].required).toContain(field);
      expect(schema.$defs.UWMeta.properties[group].properties[field]).toMatchObject({ type: 'boolean' });
    }
  });
});
