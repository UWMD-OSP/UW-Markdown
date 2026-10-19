import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildMeta } from './metadata.js';
import { parseUWFile } from './parser.js';
import { validateUWFile } from './validator.js';
import * as api from './index.js';
import type { ParsedUWFile, UWBlock } from './types.js';

const header = `---
uw_version: "3.0"
asset_class: multifamily
deal_id: leaf-test
---
`;
const meta = (section = 'property') => buildMeta(section, 1, { source: 'manual', actor: 'test', timestamp: '2026-10-18T00:00:00Z' });
const fence = (section: string, content: Record<string, unknown>, suffix = '') => `\`\`\`json uw:section=${section} ${suffix}
${JSON.stringify(content)}
\`\`\`
`;
const source = (content: Record<string, unknown>) => header + fence('property', content);
const result = (content: Record<string, unknown>) => validateUWFile(source(content));
const leaves = (input: ParsedUWFile | string) => validateUWFile(input).issues.filter(i => i.code === 'META-04');
const canonical = (block: UWBlock) => block.content._meta as Record<string, Record<string, unknown>>;
const bad = (section = 'property') => {
  const value = meta(section);
  return { ...value, quality: { ...value.quality, confidence: 'verified' },
    lifecycle: { ...value.lifecycle, revision: 0 }, provenance: { ...value.provenance, timestamp: 'not a timestamp' } };
};
const fields = ['_meta.quality.confidence', '_meta.lifecycle.revision', '_meta.provenance.timestamp'];
const rfc = readFileSync(new URL('../../../docs/rfcs/0094-present-invalid-metadata-leaves.md', import.meta.url), 'utf8');
const vectors = rfc.split('\n').flatMap(line => {
  const m = /^\| ([^|]+) \| `(.*)` \| (admit|META-04) \|$/.exec(line);
  return m ? [{ name: m[1]!, value: JSON.parse(m[2]!) as unknown, expected: m[3]! }] : [];
});

describe('RFC0094 exact canonical metadata leaves', () => {
  it('retains exactly the 60 accepted timestamp vectors', () => expect(vectors).toHaveLength(60));
  it.each(vectors)('timestamp $name has accepted leaf result $expected', ({ value, expected }) => {
    const current = meta();
    const issues = leaves(source({ _meta: { ...current, provenance: { ...current.provenance, timestamp: value } } }));
    expect(issues.map(i => i.field)).toEqual(expected === 'admit' ? [] : ['_meta.provenance.timestamp']);
  });

  it.each(['high', 'medium', 'low'])('admits exact confidence %j', confidence => {
    expect(leaves(source({ _meta: { ...meta(), quality: { ...meta().quality, confidence } } }))).toEqual([]);
  });
  it.each([null, '', 'High', ' high', 'low ', 'verified', false, true, 0, [], {}])('refuses present-invalid confidence %j', confidence => {
    expect(leaves(source({ _meta: { ...meta(), quality: { ...meta().quality, confidence } } })).map(i => i.field)).toEqual([fields[0]]);
  });
  it.each([1, 1.0, 1e0, 2, 9007199254740992, Number.MAX_VALUE])('admits integer revision without new bound %j', revision => {
    expect(leaves(source({ _meta: { ...meta(), lifecycle: { ...meta().lifecycle, revision } } }))).toEqual([]);
  });
  it.each([null, 0, -1, 0.5, '', '1', true, false, [], {}])('refuses present-invalid revision %j', revision => {
    expect(leaves(source({ _meta: { ...meta(), lifecycle: { ...meta().lifecycle, revision } } })).map(i => i.field)).toEqual([fields[1]]);
  });
  it.each([NaN, Infinity, -Infinity])('refuses nonfinite MODEL revision %j', revision => {
    const parsed = parseUWFile(source({ _meta: meta() }));
    canonical(parsed.sections.property as UWBlock).lifecycle.revision = revision;
    expect(leaves(parsed).map(i => i.field)).toEqual([fields[1]]);
  });

  it('leaves all absent values and existing warning predicates unchanged', () => {
    const current = meta();
    const value = JSON.parse(JSON.stringify(current)) as Record<string, Record<string, unknown>>;
    delete value.quality.confidence; delete value.lifecycle.revision; delete value.provenance.timestamp;
    const checked = result({ _meta: value });
    expect(checked.issues.filter(i => i.code === 'META-04')).toEqual([]);
    expect(checked.warnings.map(i => i.code)).toEqual(expect.arrayContaining([
      'META_FIELD_MISSING_CONFIDENCE', 'META_FIELD_MISSING_VERSION', 'META_FIELD_MISSING_TIMESTAMP',
    ]));
    for (const group of ['quality', 'lifecycle', 'provenance']) {
      const nulls = JSON.parse(JSON.stringify(current)) as Record<string, Record<string, unknown>>;
      const leaf = group === 'quality' ? 'confidence' : group === 'lifecycle' ? 'revision' : 'timestamp';
      nulls[group]![leaf] = null;
      const checkedNull = result({ _meta: nulls });
      expect(checkedNull.issues.filter(i => i.code === 'META-04')).toHaveLength(1);
      expect(checkedNull.warnings.some(i => i.code === `META_FIELD_MISSING_${leaf === 'revision' ? 'VERSION' : leaf.toUpperCase()}`)).toBe(true);
    }
  });

  it('suppresses rejected-container descendants but only confidence for missing/nonobject quality', () => {
    for (const invalid of [undefined, null, [], '', {}, { provenance: null, lifecycle: {} }, { provenance: {}, lifecycle: null }]) {
      expect(leaves(source({ _meta: invalid }))).toEqual([]);
    }
    expect(leaves(source({ section_id: 'property', _meta: bad() }))).toEqual([]);
    for (const quality of [undefined, null, [], '', 0]) {
      expect(leaves(source({ _meta: { ...bad(), quality } })).map(i => i.field)).toEqual(fields.slice(1));
    }
  });

  it('does not consume inherited leaves or a divergent convenience alias', () => {
    const parsed = parseUWFile(source({ _meta: meta() }));
    const block = parsed.sections.property as UWBlock;
    const current = canonical(block);
    current.quality = Object.assign(Object.create({ confidence: 'bad' }), { human_review_required: false });
    current.lifecycle = Object.assign(Object.create({ revision: 0 }), { superseded: false });
    current.provenance = Object.assign(Object.create({ timestamp: 'bad' }), { source: 'manual', actor: 'test' });
    block.meta = bad() as unknown as UWBlock['meta'];
    expect(leaves(parsed)).toEqual([]);
    current.provenance.timestamp = 'bad';
    expect(leaves(parsed).map(i => i.field)).toEqual([fields[2]]);
  });

  it('finishes all preceding shape/actor/boolean passes before all META-04 and later ROLE/SRC', () => {
    const block = (section: string) => ({ payload: 1, _meta: {
      ...bad(section), section: 'wrong', provenance: { ...bad(section).provenance, actor: '', source: 'bad' },
      quality: { confidence: 'verified', human_review_required: null }, lifecycle: { revision: 0, superseded: null },
    }, _role: 'bad' });
    const issues = validateUWFile(header + fence('property', block('property')) + fence('rent_roll', block('rent_roll'))).issues;
    const firstLeaf = issues.findIndex(i => i.code === 'META-04');
    const lastBoolean = issues.map(i => i.code === 'META-02' || i.code === 'META-03').lastIndexOf(true);
    expect(firstLeaf).toBeGreaterThan(lastBoolean);
    expect(issues.filter(i => i.code === 'META-04').map(i => [i.section, i.field])).toEqual(
      ['property', 'rent_roll'].flatMap(id => fields.map(field => [id, field])));
    expect(issues.findIndex(i => i.code === 'ROLE-01')).toBeGreaterThan(firstLeaf + 5);
    expect(issues.findIndex(i => i.code === 'SRC-01')).toBeGreaterThan(firstLeaf + 5);
  });

  it('retains physical history/overwritten/extension/append order, then model-only exact identities', () => {
    const ids = ['x_peer', 'pipeline_log', 'property', 'custom_calculations', 'custom_scenarios'];
    const raw = header + ids.map(id => fence(id, { _meta: bad(id) }, id === 'property' ? 'superseded=true' : '')).join('')
      + fence('x_peer', { _meta: meta('x_peer') }) + fence('property', { _meta: meta() });
    const parsed = parseUWFile(raw);
    expect(leaves(parsed).map(i => i.section)).toEqual(ids.flatMap(id => [id, id, id]));
    const added = parseUWFile(source({ _meta: bad() })).sections.property as UWBlock;
    parsed.sections.extra = added; parsed.extensions.alias = added; parsed.extensions.equal = structuredClone(added);
    expect(leaves(parsed).map(i => i.section)).toEqual([...ids, 'extra', 'equal'].flatMap(id => [id, id, id]));
    expect(parsed.raw).toBe(raw);
  });

  it('honors current MODEL mutations and never reparses stale raw or invents lost peers', () => {
    const parsed = parseUWFile(source({ _meta: meta() }));
    const block = parsed.sections.property as UWBlock;
    const before = parsed.raw;
    canonical(block).quality.confidence = 'bad';
    expect(leaves(parsed).map(i => i.field)).toEqual([fields[0]]);
    canonical(block).quality.confidence = 'high';
    parsed.raw = source({ _meta: bad() }); block.rawJson = JSON.stringify({ _meta: bad() });
    expect(leaves(parsed)).toEqual([]);
    expect(leaves(before)).toEqual([]);
    const physical = parseUWFile(header + fence('x_peer', { _meta: bad('x_peer') }) + fence('x_peer', { _meta: meta('x_peer') }));
    expect(leaves(physical)).toHaveLength(3);
    expect(leaves(JSON.parse(JSON.stringify(physical)) as ParsedUWFile)).toEqual([]);
  });

  it('checks composed root/consumed part physical refs and synthesized model refs without unused parts', () => {
    const part = (id: string, value: unknown, history = '') => `---
uw_version: "3.0"
uwpart_version: "1.0"
part_id: ${id}
section: property
---
${history}${fence('property', { _meta: value, total_units: 17 })}`;
    const root = source({ _meta: meta(), external: { parts: ['whole'], part_count: 1 } });
    const actual = part('whole', meta(), fence('property', { _meta: bad() }, 'superseded=true'));
    const checked = validateUWFile(root, undefined, { parts: [part('unused', bad()), actual] });
    expect(checked.issues.filter(i => i.code === 'META-04').map(i => i.field)).toEqual(fields);
    const selectedBad = validateUWFile(root, undefined, { parts: [part('whole', bad())] });
    expect(selectedBad.issues.filter(i => i.code === 'META-04').map(i => i.field)).toEqual([...fields, ...fields]);
  });

  it('keeps read-only result partitions/readiness/coverage and existing public API shape', () => {
    const parsed = parseUWFile(source({ _meta: bad(), total_units: 10 }));
    const before = JSON.stringify(parsed);
    const checked = validateUWFile(parsed);
    const valid = result({ _meta: meta(), total_units: 10 });
    expect(checked.stage_readiness).toEqual(valid.stage_readiness);
    expect(checked.coverage).toEqual(valid.coverage);
    expect(checked.errors.filter(i => i.code === 'META-04')).toHaveLength(3);
    expect(checked.issues.filter(i => i.severity === 'error')).toEqual(checked.errors);
    expect(checked.issues.filter(i => i.severity === 'warning')).toEqual(checked.warnings);
    expect(checked.issues.filter(i => i.severity === 'info')).toEqual(checked.info);
    expect(checked.issues.some(i => 'category' in i)).toBe(false);
    expect(JSON.stringify(parsed)).toBe(before);
    expect(api).not.toHaveProperty('checkMetadataLeaves');
    expect(api).not.toHaveProperty('isMetadataTimestamp');
  });
});
