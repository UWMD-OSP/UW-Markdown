import { describe, expect, it } from 'vitest';
import { buildMeta } from './metadata.js';
import { parseUWFile } from './parser.js';
import { SOURCE_TAGS } from './types.js';
import { validateUWFile } from './validator.js';
import type { UWBlock } from './types.js';

const header = '---\nuw_version: "3.0"\nasset_class: multifamily\ndeal_id: override-sources\n---\n';
const meta = (id = 'property') => buildMeta(id, 1, { source: 'manual', actor: 'test', timestamp: '2026-10-18T00:00:00Z' });
const fence = (id: string, content: Record<string, unknown>, suffix = '') => `\x60\x60\x60json uw:section=${id} ${suffix}\n${JSON.stringify(content)}\n\x60\x60\x60\n`;
const source = (_overrides: unknown) => header + fence('property', { _meta: meta(), _overrides });
const vocabulary = (input: Parameters<typeof validateUWFile>[0]) => validateUWFile(input).issues.filter(i => i.code.startsWith('SRC-'));

describe('accepted override vocabulary ownership independent of META05/06', () => {
  it('admits exactly registered actors and resolutions without path lookup', () => {
    const _overrides = ['manual', 'agent/rent-roll-extractor', 'document/om.pdf', 'system/calc.ts', 'institution/policy'].flatMap(actor => SOURCE_TAGS.map(resolution => ({ path: 'unmatched', source: actor, resolution })));
    expect(vocabulary(source(_overrides))).toEqual([]);
  });
  it.each(['unknown', '', 'agent:', 'agent/', 'agent/X/Y', 'agent/X\n', 'manual ', null, false, 1, [], {}])('refuses own invalid override source %j under SRC01 only', value => {
    const issues = vocabulary(source([{ path: '', source: value }]));
    expect(issues.map(i => [i.code, i.field])).toEqual([['SRC-01', '_overrides[0].source']]);
    expect(validateUWFile(source([{ path: '', source: value }])).issues.filter(i => i.code === 'META-05')).toEqual([]);
  });
  it.each(SOURCE_TAGS)('distinguishes resolution tag %s in source as SRC02', sourceTag => {
    expect(vocabulary(source([{ path: '', source: sourceTag }])).map(i => [i.code, i.field])).toEqual([['SRC-02', '_overrides[0].source']]);
  });
  it.each(['manual', '', 'MARKET_DATA', 'market_data ', null, false, 0, [], {}])('refuses own invalid override resolution %j as SRC03', resolution => {
    expect(vocabulary(source([{ path: '', resolution }])).map(i => [i.code, i.field])).toEqual([['SRC-03', '_overrides[0].resolution']]);
  });
  it('keeps precise field order, independent bad paths and metadata-parent refusal', () => {
    const input = header + fence('property', { _meta: null, _overrides: [null, { source: 'ai_extracted', resolution: false }, { path: false, source: 'bad', resolution: 'manual' }] });
    expect(vocabulary(input).map(i => [i.code, i.field])).toEqual([
      ['SRC-02', '_overrides[1].source'], ['SRC-03', '_overrides[1].resolution'],
      ['SRC-01', '_overrides[2].source'], ['SRC-03', '_overrides[2].resolution'],
    ]);
  });
  it('handles rejected array/entry containers without claiming generic vocabulary errors', () => {
    for (const value of [null, 1, {}, [null, false, [], 3]]) expect(vocabulary(source(value))).toEqual([]);
  });
  it('keeps history/extensions/append outside SRC while assessing current singles and every variant', () => {
    const ids = ['property', 'x_test', 'x_test', 'pipeline_log', 'custom_calculations', 'custom_scenarios'];
    const input = header + ids.map((id, index) => fence(id, { _meta: meta(id), _overrides: [{ path: 'x', resolution: 'manual' }] }, index === 0 ? 'superseded=true' : `variant=v${index}`)).join('');
    expect(vocabulary(input)).toEqual([]);
    const current = input + fence('property', { _meta: meta(), _overrides: [{ path: 'x', resolution: 'manual' }] })
      + fence('operating_statement', { _meta: meta('operating_statement'), _overrides: [{ path: 'x', resolution: 'manual' }] }, 'variant=t12')
      + fence('operating_statement', { _meta: meta('operating_statement'), _overrides: [{ path: 'x', resolution: 'manual' }] }, 'variant=year1');
    expect(vocabulary(current).map(i => [i.section, i.field])).toEqual(['property', 'operating_statement', 'operating_statement'].map(id => [id, '_overrides[0].resolution']));
  });
  it('uses current own visible MODEL members without recovering hidden physical or extension refs', () => {
    const parsed = parseUWFile(source([])); const block = parsed.sections.property as UWBlock;
    block.content._overrides = [Object.assign(Object.create({ source: 'bad', resolution: 'bad' }), { path: 'x' })];
    expect(vocabulary(parsed)).toEqual([]);
    (block.content._overrides as Record<string, unknown>[])[0]!.source = 'bad';
    parsed.extensions.x_alias = block;
    parsed.extensions.x_copy = { ...block };
    expect(vocabulary(parsed).map(i => i.field)).toEqual(['_overrides[0].source']);
    expect(vocabulary(source([]))).toEqual([]);
  });
  it('does not read inherited root annotations or duplicate canonical issue ownership', () => {
    const parsed = parseUWFile(source([])); const block = parsed.sections.property as UWBlock;
    delete block.content._overrides;
    Object.setPrototypeOf(block.content, { _overrides: [{ path: 'x', source: 'bad' }] });
    expect(vocabulary(parsed)).toEqual([]);
    const checked = validateUWFile(header + fence('property', { _meta: { ...meta(), provenance: { ...meta().provenance, source: 'ai_extracted' } } }));
    expect(checked.issues.filter(i => i.code === 'SRC-02')).toHaveLength(1);
  });
});
