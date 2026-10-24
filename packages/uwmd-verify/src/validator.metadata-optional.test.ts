import { extensionBlocks } from './extension-entry.js';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildMeta } from './metadata.js';
import { parseUWFile, parsedPhysicalBlocks } from './parser.js';
import { validateUWFile } from './validator.js';
import type { ParsedUWFile, UWBlock } from './types.js';

const header = '---\nuw_version: "3.0"\nasset_class: multifamily\ndeal_id: optional-test\n---\n';
const meta = (section = 'property') => buildMeta(section, 1, { source: 'manual', actor: 'reviewer', timestamp: '2026-10-18T00:00:00Z' });
const fence = (section: string, content: Record<string, unknown>, suffix = '') => `\x60\x60\x60json uw:section=${section} ${suffix}\n${JSON.stringify(content)}\n\x60\x60\x60\n`;
const source = (content: Record<string, unknown>) => header + fence('property', content);
const findings = (input: string | ParsedUWFile, code?: string) => validateUWFile(input).issues.filter(i => code ? i.code === code : ['META-05', 'META-06'].includes(i.code));
const fields = (input: string | ParsedUWFile, code?: string) => findings(input, code).map(i => i.field);
const canonical = (block: UWBlock) => block.content._meta as Record<string, Record<string, unknown>>;
const inherited = () => ({ document_id: '', digest: `sha256:${'a'.repeat(64)}`, distance: 1 });
const market = () => ({ document_id: '', as_of: '2026-10-18', digest: `sha256:${'b'.repeat(64)}`, rationale: '' });
const reference = (provenance: Record<string, unknown>, rest: Record<string, unknown> = {}) => source({ _meta: { ...meta(), provenance: { ...meta().provenance, ...provenance } }, ...rest });
const datesPath = new URL('../../../docs/reviews/2026-10-17-validation-diagnostic-gap-354.0095-date-only.vectors.json', import.meta.url);
const dateBytes = readFileSync(datesPath);
const dates = JSON.parse(dateBytes.toString('utf8')) as {
  date_cases: { id: string; input: unknown; admitted: boolean }[];
  required_as_of_carriers: { id: string; input: Record<string, unknown>; admitted: boolean }[];
};

describe('RFC0095 closed optional metadata predicates', () => {
  it.each(['agent_id', 'agent_version', 'notes'])('admits absent/null/any string for %s and only rejects wrong types', key => {
    for (const value of [undefined, null, '', ' ', 'arbitrary text']) {
      expect(fields(reference(value === undefined ? {} : { [key]: value }), 'META-05')).toEqual([]);
    }
    for (const value of [false, true, 0, [], {}]) {
      expect(fields(reference({ [key]: value }), 'META-05')).toEqual([`_meta.provenance.${key}`]);
    }
  });
  it('attributes every invalid flag element and admits open string vocabularies', () => {
    expect(fields(source({ _meta: { ...meta(), quality: { ...meta().quality, flags: ['', 'anything'] } } }), 'META-05')).toEqual([]);
    expect(fields(source({ _meta: { ...meta(), quality: { ...meta().quality, flags: ['ok', null, 0, false, {}] } } }), 'META-05')).toEqual([
      '_meta.quality.flags[1]', '_meta.quality.flags[2]', '_meta.quality.flags[3]', '_meta.quality.flags[4]',
    ]);
    for (const flags of [null, false, 0, '', {}]) expect(fields(source({ _meta: { ...meta(), quality: { ...meta().quality, flags } } }), 'META-05')).toEqual(['_meta.quality.flags']);
  });
  it.each(['partial', 'provisional'])('requires literal booleans for optional %s without inferring DQ truth', key => {
    for (const value of [true, false]) expect(fields(source({ _meta: { ...meta(), quality: { ...meta().quality, [key]: value } } }), 'META-05')).toEqual([]);
    for (const value of [null, 0, 1, 'true', [], {}]) {
      const input = source({ _meta: { ...meta(), quality: { ...meta().quality, [key]: value } } });
      expect(fields(input, 'META-05')).toEqual([`_meta.quality.${key}`]);
      expect(validateUWFile(input).issues.filter(i => ['DQ-01', 'DQ-02', 'DQ-03'].includes(i.code))).toEqual([]);
    }
  });
  it.each([null, false, 0, '', [], {}])('forbids any present quality.field_overrides %j', value => {
    expect(fields(source({ _meta: { ...meta(), quality: { ...meta().quality, field_overrides: value } } }), 'META-05')).toEqual(['_meta.quality.field_overrides']);
  });
  it('has the fixed metadata/annotation field order and no unknown-member fallback', () => {
    const input = source({ _meta: { ...meta(), provenance: { ...meta().provenance, agent_id: 1, agent_version: [], notes: false }, quality: { ...meta().quality, flags: [false, null], partial: 'yes', provisional: 1, field_overrides: null } },
      _overrides: [null, { confidence: 'verified', reason: '', note: null }, { path: '', confidence: 'high', reason: 'computed', note: '', opaque: false }], _notes: false, opaque: null });
    expect(fields(input, 'META-05')).toEqual([
      '_meta.provenance.agent_id', '_meta.provenance.agent_version', '_meta.provenance.notes',
      '_meta.quality.flags[0]', '_meta.quality.flags[1]', '_meta.quality.partial', '_meta.quality.provisional', '_meta.quality.field_overrides',
      '_overrides[0]', '_overrides[1].path', '_overrides[1].confidence', '_overrides[1].reason', '_overrides[1].note',
    ]);
  });
  it('admits the complete confidence/reason domains and nullable provenance without path lookup', () => {
    const _overrides = ['high', 'medium', 'low'].flatMap(confidence => ['illegible', 'missing', 'overridden', 'estimated', 'computed'].map(reason => ({ path: 'not.a.real.field', confidence, reason, note: '' })));
    expect(findings(source({ _meta: meta(), _overrides }))).toEqual([]);
  });
  it('assesses independent sibling annotations under rejected metadata and only suppresses quality descendants', () => {
    for (const bad of [undefined, null, [], {}, { provenance: null, lifecycle: {} }, { provenance: {}, lifecycle: null }]) {
      expect(fields(source({ _meta: bad, _overrides: [null] }))).toEqual(['_overrides[0]']);
    }
    const invalid = { ...meta(), provenance: { ...meta().provenance, notes: false }, quality: null };
    expect(fields(source({ _meta: invalid, _overrides: false }))).toEqual(['_meta.provenance.notes', '_overrides']);
    expect(fields(source({ section_id: 'property', _meta: invalid, _overrides: false }))).toEqual(['_overrides']);
  });
});

describe('RFC0095 conditional agent and reference carriers', () => {
  it('requires only own agent_id presence for an exact canonical agent source', () => {
    const p: Record<string, unknown> = { ...meta().provenance, source: 'agent/X' }; delete p.agent_id;
    expect(fields(source({ _meta: { ...meta(), provenance: p } }))).toEqual(['_meta.provenance.agent_id']);
    for (const agent_id of [null, '']) expect(findings(reference({ ...p, agent_id }))).toEqual([]);
    expect(fields(reference({ ...p, agent_id: 0 }))).toEqual(['_meta.provenance.agent_id']);
    expect(findings(reference({ ...p, agent_id: 0 }))[0]!.code).toBe('META-05');
    for (const actorSource of ['manual', 'system/X', 'agent:', 'agent/', 'agent/X\n', 'AGENT/X', 'agent/X/Y']) {
      expect(fields(source({ _meta: { ...meta(), provenance: { ...p, source: actorSource } } }), 'META-06')).toEqual([]);
    }
    expect(fields(reference({}, { _overrides: [{ path: 'x', source: 'agent/X' }] }), 'META-06')).toEqual([]);
  });
  it('treats all symmetric assertions as obligations, never leaf winners', () => {
    const input = reference({ resolution: 'inherited_assumption' }, { _overrides: [
      null, { resolution: 'market_data_accepted' }, { path: false, resolution: 'market_data_accepted' },
      { path: '', resolution: 'inherited_assumption' }, { path: 'same', resolution: 'market_data_accepted' },
      { path: 'same', resolution: 'user_input' }, { path: 'same', resolution: 'inherited_assumption' },
    ] });
    expect(fields(input, 'META-05')).toEqual(['_overrides[0]', '_overrides[1].path', '_overrides[2].path']);
    expect(fields(input, 'META-06')).toEqual(['_meta.provenance.inherited_from', '_meta.provenance.market_data_ref']);
    expect(validateUWFile(input).issues.filter(i => i.code === 'DQ-06' && i.severity === 'error')).toEqual([]);
  });
  it.each(['market_data_accepted', 'inherited_assumption'])('requires an override-only %s reference even with later shadowing', resolution => {
    const input = reference({}, { _overrides: [{ path: 'x', resolution }, { path: 'x', resolution: 'user_input' }] });
    expect(fields(input, 'META-06')).toEqual([`_meta.provenance.${resolution === 'market_data_accepted' ? 'market_data_ref' : 'inherited_from'}`]);
  });
  it('does not coerce non-string resolution assertions or use inherited MODEL assertions', () => {
    const p = parseUWFile(reference({})); const b = p.sections.property as UWBlock; const m = canonical(b);
    m.provenance = Object.assign(Object.create({ resolution: 'market_data_accepted' }), { source: 'manual', actor: 'test' });
    b.content._overrides = [Object.assign(Object.create({ resolution: 'inherited_assumption' }), { path: 'x' }), { path: 'x', resolution: { toString: () => 'market_data_accepted' } }];
    expect(fields(p, 'META-06')).toEqual([]);
  });
  it.each(['inherited_from', 'market_data_ref'])('checks stated %s without a trigger and rejects invalid parents once', carrier => {
    for (const value of [null, false, 0, '', [], true]) expect(fields(reference({ [carrier]: value }), 'META-06')).toEqual([`_meta.provenance.${carrier}`]);
    const expected = carrier === 'inherited_from' ? ['document_id', 'digest', 'distance'] : ['document_id', 'as_of', 'digest'];
    expect(fields(reference({ [carrier]: {} }), 'META-06')).toEqual(expected.map(x => `_meta.provenance.${carrier}.${x}`));
  });
  it('keeps child order, exact digest end, empty strings, unknown data and unbounded integer distance', () => {
    expect(findings(reference({ inherited_from: { ...inherited(), opaque: null }, market_data_ref: { ...market(), opaque: [] } }))).toEqual([]);
    for (const distance of [1, 1.0, 9007199254740992, Number.MAX_VALUE]) expect(findings(reference({ inherited_from: { ...inherited(), distance } }))).toEqual([]);
    for (const distance of [0, -1, 1.5, true, '1', null]) expect(fields(reference({ inherited_from: { ...inherited(), distance } }), 'META-06')).toEqual(['_meta.provenance.inherited_from.distance']);
    for (const digest of [`sha256:${'a'.repeat(64)}\n`, `sha256:${'A'.repeat(64)}`, `sha256:${'a'.repeat(63)}`, '', null]) {
      expect(fields(reference({ inherited_from: { ...inherited(), digest }, market_data_ref: { ...market(), digest } }), 'META-06')).toEqual(['_meta.provenance.inherited_from.digest', '_meta.provenance.market_data_ref.digest']);
    }
    expect(fields(reference({ market_data_ref: { document_id: null, as_of: false, digest: 'bad', rationale: null } }), 'META-06')).toEqual(['document_id', 'as_of', 'digest', 'rationale'].map(x => `_meta.provenance.market_data_ref.${x}`));
  });
  it('preserves own-member authority for agent identity and every carrier child', () => {
    const parsed = parseUWFile(reference({})); const b = parsed.sections.property as UWBlock; const m = canonical(b);
    m.provenance = Object.assign(Object.create({ agent_id: 'borrowed', market_data_ref: market() }), { source: 'agent/X', actor: 'test', resolution: 'market_data_accepted', inherited_from: Object.create(inherited()) });
    expect(fields(parsed, 'META-06')).toEqual(['_meta.provenance.agent_id', '_meta.provenance.inherited_from.document_id', '_meta.provenance.inherited_from.digest', '_meta.provenance.inherited_from.distance', '_meta.provenance.market_data_ref']);
  });
  it('does not turn inherited array slots into stated assertions or valid flag items', () => {
    const p = parseUWFile(reference({})); const b = p.sections.property as UWBlock;
    const overrides = new Array(1);
    Object.setPrototypeOf(overrides, Object.assign(Object.create(Array.prototype), { 0: { resolution: 'market_data_accepted' } }));
    b.content._overrides = overrides;
    const flags = new Array(1);
    Object.setPrototypeOf(flags, Object.assign(Object.create(Array.prototype), { 0: 'inherited-string' }));
    canonical(b).quality.flags = flags;
    expect(fields(p, 'META-05')).toEqual(['_meta.quality.flags[0]', '_overrides[0]']);
    expect(fields(p, 'META-06')).toEqual([]);
  });
  it('preserves rejected-provenance precedence even under independent asserting overrides', () => {
    expect(fields(source({ _meta: { ...meta(), provenance: null }, _overrides: [{ resolution: 'market_data_accepted' }] }))).toEqual(['_overrides[0].path']);
  });
});

describe('RFC0095 exact frozen date-only domain', () => {
  it('uses the independently authored 106-case vector file unchanged', () => {
    expect(createHash('sha256').update(dateBytes).digest('hex')).toBe('f8d3ebc4aef8b0992edf2a333cc53fa2325b869c680ba990158225f18c6e7400');
    expect(dates.date_cases).toHaveLength(106);
  });
  it.each(dates.date_cases)('date $id has admitted=$admitted', ({ input, admitted }) => {
    expect(fields(reference({ market_data_ref: { ...market(), as_of: input } }), 'META-06')).toEqual(admitted ? [] : ['_meta.provenance.market_data_ref.as_of']);
  });
  it.each(dates.required_as_of_carriers)('carrier $id has admitted=$admitted', ({ input, admitted }) => {
    expect(fields(reference({ market_data_ref: { document_id: '', digest: inherited().digest, ...input } }), 'META-06')).toEqual(admitted ? [] : ['_meta.provenance.market_data_ref.as_of']);
  });
});

describe('RFC0095 physical/model/source order and result boundaries', () => {
  const bad = (section: string) => { const m = meta(section); const provenance = { ...m.provenance, source: 'agent/X', notes: false }; delete provenance.agent_id; return { ...m, provenance }; };
  it('assesses all retained peers/history/append collections, with complete family passes', () => {
    const sections = ['property', 'x_lost', 'x_lost', 'pipeline_log', 'custom_calculations', 'custom_scenarios', 'operating_statement', 'operating_statement'];
    const text = header + sections.map((section, index) => fence(section, { _meta: bad(section) }, index === 0 ? 'superseded=true' : `variant=v${index}`)).join('');
    expect(findings(text).map(i => [i.code, i.section, i.field])).toEqual([
      ...sections.map(section => ['META-05', section, '_meta.provenance.notes']),
      ...sections.map(section => ['META-06', section, '_meta.provenance.agent_id']),
    ]);
    const checked = validateUWFile(text);
    expect(checked.errors.filter(i => ['META-05', 'META-06'].includes(i.code))).toHaveLength(16);
    expect(checked.issues.every(i => !Object.hasOwn(i, 'category'))).toBe(true);
    expect(checked.overall_status).toBe('errors');
  });
  it('keeps MODEL canonical replacement authoritative and exact refs distinct from equal content', () => {
    const text = source({ _meta: meta() }); const parsed = parseUWFile(text); const b = parsed.sections.property as UWBlock;
    b.content._meta = bad('property');
    parsed.extensions.x_alias = { mode: 'single', block: b };
    parsed.extensions.x_copy = { mode: 'single', block: { ...b } };
    expect(fields(parsed, 'META-05')).toEqual(['_meta.provenance.notes', '_meta.provenance.notes']);
    expect(fields(parsed, 'META-06')).toEqual(['_meta.provenance.agent_id', '_meta.provenance.agent_id']);
    expect(findings(text)).toEqual([]);
    expect(parsed.raw).toBe(text);
    expect(b.rawJson).toContain('"notes":null');
  });
  it('does not invent source refs on copied models or consult stale raw for replacements', () => {
    const parsed = parseUWFile(header + fence('x_lost', { _meta: bad('x_lost') }) + fence('x_lost', { _meta: meta('x_lost') }));
    expect(findings(parsed)).toHaveLength(2);
    expect(findings({ ...parsed })).toHaveLength(2); // Retained history is now explicit model data.
    const withoutHistory = { ...parsed, superseded: {} };
    expect(findings(withoutHistory)).toEqual([]);
    expect(parsedPhysicalBlocks({ ...parsed })).toEqual([]);
  });
  it('completes META04 before all META05 then META06, then role/source issues without global sorting', () => {
    const m = bad('property');
    const text = source({ _meta: { ...m, quality: { ...m.quality, confidence: 'invalid' } }, _role: 'invalid' });
    const issues = validateUWFile(text).issues;
    const codes = issues.map(i => i.code);
    expect(codes.indexOf('META-05')).toBeGreaterThan(codes.indexOf('META-04'));
    expect(codes.indexOf('META-06')).toBeGreaterThan(codes.indexOf('META-05'));
    expect(codes.indexOf('ROLE-01')).toBeGreaterThan(codes.indexOf('META-06'));
  });
  it('accounts for actual consumed parts before synthesized model refs, excluding loaded unused parts', () => {
    const root = header + fence('rent_roll', { _meta: { ...meta('rent_roll'), quality: { ...meta('rent_roll').quality, flags: false } }, external: { parts: ['p1'], collection_key: 'unit_id', collection_path: 'units', part_count: 1 } }, 'external=true');
    const part = (id: string) => `---\nuw_version: "3.0"\nuwpart_version: "1.0"\npart_id: ${id}\nsection: rent_roll\ncollection_member: true\n---\n${fence('rent_roll', { _meta: bad('rent_roll'), unit_id: id })}`;
    const result = validateUWFile(root, undefined, { parts: [part('p1'), part('unused')] });
    expect(result.issues.filter(i => i.code === 'META-05').map(i => i.field)).toEqual(['_meta.quality.flags', '_meta.provenance.notes', '_meta.quality.flags']);
    expect(result.issues.filter(i => i.code === 'META-06').map(i => i.field)).toEqual(['_meta.provenance.agent_id']);
    expect(root).toContain('"flags":false');
  });
  it('keeps readiness-only DQ06 at info while reference errors move exclusively to META06', () => {
    const text = reference({ resolution: 'market_data_accepted' });
    const result = validateUWFile(text.replace('asset_class: multifamily', 'asset_class: multifamily\ndeal_stage: full_underwrite'));
    expect(result.issues.filter(i => i.code === 'DQ-06').length).toBeGreaterThan(0);
    expect(result.issues.filter(i => i.code === 'DQ-06').every(i => i.severity === 'info')).toBe(true);
    expect(result.errors.filter(i => i.code === 'META-06').map(i => i.field)).toEqual(['_meta.provenance.market_data_ref']);
  });
});
