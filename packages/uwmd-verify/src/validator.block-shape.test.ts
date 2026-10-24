import { extensionBlocks } from './extension-entry.js';
// META-01 — the one block shape (Format §2.4–§2.5, RFC 0081 §3). A block is the
// bare payload with an inline nested `_meta`; the retired `{section_id, _meta,
// content}` wrapper and the retired flat `_meta` are both META-01 errors.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as publicAPI from './index.js';
import type { ParsedUWFile, UWBlock } from './types.js';
import { parseUWFile, parsedPhysicalBlocks, retainParsedPhysicalBlocks } from './parser.js';
import { CompositionError, parseUWPart, resolveComposition } from './composition.js';
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
    expect(issues).toMatchObject([{
      severity: 'error', section: 'property',
      remediation: expect.stringContaining('bare payload with inline nested _meta'),
    }]);
    expect(issues[0].remediation).toContain('_meta.section matching the fence');
    expect(issues[0].remediation).toContain('_meta.provenance.actor as a nonempty string');
    expect(issues[0].remediation).toContain('do not infer an actor');
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

  it('reads a non-object _meta as no _meta object, never as five missing fields (#429)', () => {
    for (const value of ['present but a string', ['a'], 0, true]) {
      const codes = validateUWFile(doc({ _meta: value, total_units: 10 })).issues.map((i) => i.code);
      expect(codes, JSON.stringify(value)).toContain('META_MISSING');
      expect(codes.filter((c) => c.startsWith('META_FIELD_MISSING_')), JSON.stringify(value)).toEqual([]);
    }
  });
});


// RFC 0090: exact actor admission and retained physical evidence.
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
    expect(extensionBlocks(parsed.extensions.x_peer!)[0]!.annotation.variant).toBe('second');
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
    parsed.extensions.x_alias = { mode: 'single', block: added };
    expect(actorIssues(parsed).map(i => i.section)).toEqual(['x_old', 'property']);
  });

  it('does not certify missing physical peers from a cloned or hand-built model/raw string', () => {
    const parsed = parseUWFile(header + fence('x_peer', body('x_peer', ''), 'v=1') + fence('x_peer', body('x_peer'), 'v=2'));
    expect(actorIssues(parsed)).toHaveLength(1);
    const clone = JSON.parse(JSON.stringify(parsed)) as ParsedUWFile;
    expect(clone.superseded.x_peer).toHaveLength(1); // RFC0089 retains the overwritten prior.
    delete clone.superseded.x_peer; // Explicitly exercise a model that omits it.
    expect(actorIssues(clone)).toEqual([]);
    clone.raw = 'stale non-document raw does not replace the supplied model';
    const payload = extensionBlocks(clone.extensions.x_peer!)[0]!.content._meta as typeof meta;
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

// RFC0093: the three accepted predicates have their own checkpoint and authority.
const admittedIssues = (input: ParsedUWFile | string) => validateUWFile(input).issues.filter(i =>
  i.code === 'META-01' && ['_meta', '_meta.section', '_meta.quality'].includes(i.field ?? ''));
const shapeSource = (json: string, id = 'property') => `${header}\`\`\`json uw:section=${id}\n${json}\n\`\`\`\n`;
const canonicalMeta = () => structuredClone(meta) as unknown as Record<string, unknown>;

describe('RFC0093 bounded metadata admission', () => {
  it('accepts ordinary payload, nested _meta, unknown members and matching unknown sections', () => {
    for (const id of ['property', 'x_unknown']) {
      const value = { _meta: { ...canonicalMeta(), section: id }, content: { _meta: 'payload' }, lawful_unknown: [] };
      expect(admittedIssues(header + fence(id, value))).toEqual([]);
    }
    expect(admittedIssues(doc({ payload: { _meta: meta } }))).toEqual([]);
  });

  it.each([null, '', true, false, 0, 1, [], {}])('rejects exact invalid section %j without normalization', value => {
    expect(admittedIssues(doc({ _meta: { ...canonicalMeta(), section: value } })).map(i => i.field)).toEqual(['_meta.section']);
  });

  it.each(['Property', ' property', 'property ', 'other'])('rejects mismatched section %j', section => {
    expect(admittedIssues(doc({ _meta: { ...canonicalMeta(), section } })).map(i => i.field)).toEqual(['_meta.section']);
  });

  it('preserves absent section completeness and canonical annotation authority', () => {
    const value = canonicalMeta();
    delete value.section;
    const parsed = doc({ _meta: value });
    expect(admittedIssues(parsed)).toEqual([]);
    expect(validateUWFile(parsed).warnings.some(i => i.code === 'META_FIELD_MISSING_SECTION')).toBe(true);
    const block = parsed.sections.property as UWBlock;
    block.content._meta = canonicalMeta();
    block.meta = { ...meta, section: 'wrong convenience alias' };
    parsed.sections = { wrong_map_key: block };
    expect(admittedIssues(parsed)).toEqual([]);
    block.annotation.section = 'changed_annotation';
    expect(admittedIssues(parsed).map(i => i.field)).toEqual(['_meta.section']);
  });

  it.each([undefined, null, [], '', 'object', 0, true])('rejects required nonobject quality %j independently', quality => {
    const value = { ...canonicalMeta(), quality };
    const parsed = doc({ _meta: value });
    const result = validateUWFile(parsed);
    expect(admittedIssues(parsed).map(i => i.field)).toEqual(['_meta.quality']);
    expect(result.issues.some(i => i.code === 'META_FIELD_MISSING_CONFIDENCE')).toBe(true);
    expect(result.issues.some(i => i.code === 'META-02')).toBe(false);
    expect(result.issues.some(i => i.field === '_meta.provenance.actor')).toBe(false);
  });

  it('accepts empty quality with existing missing-review and confidence findings', () => {
    const parsed = doc({ _meta: { ...canonicalMeta(), quality: {} } });
    expect(admittedIssues(parsed)).toEqual([]);
    const issues = validateUWFile(parsed).issues;
    expect(issues.some(i => i.code === 'META-02')).toBe(true);
    expect(issues.some(i => i.code === 'META_FIELD_MISSING_CONFIDENCE')).toBe(true);
  });

  it('keeps exact source lexical order distinct from model integer-index order', () => {
    const encoded = JSON.stringify(canonicalMeta());
    for (const key of ['0', '1', '4294967294']) {
      const source = shapeSource(`{"${key}":1,"_meta":${encoded}}`);
      expect(admittedIssues(source).map(i => i.field)).toEqual(['_meta']);
      expect(admittedIssues(parseUWFile(source))).toEqual([]);
      expect(admittedIssues(shapeSource(`{"_meta":${encoded},"${key}":1}`))).toEqual([]);
    }
    for (const key of ['00', '-0', '4294967295', '1e0', 'payload']) {
      const source = shapeSource(`{"${key}":1,"_meta":${encoded}}`);
      expect(admittedIssues(source).map(i => i.field)).toEqual(['_meta']);
      expect(admittedIssues(parseUWFile(source)).map(i => i.field)).toEqual(['_meta']);
    }
    expect(admittedIssues(shapeSource(`{  "\\u005fmeta":${encoded},"0":1}`))).toEqual([]);
    expect(admittedIssues(shapeSource(`{"payload":{"_meta":1},"\\u005fmeta":${encoded}}`)).map(i => i.field)).toEqual(['_meta']);
  });

  it('uses current model key order and canonical content without stale raw authority', () => {
    const source = shapeSource(JSON.stringify({ _meta: canonicalMeta(), payload: 1 }));
    const parsed = parseUWFile(source);
    const block = parsed.sections.property as UWBlock;
    const current = block.content._meta;
    delete block.content._meta;
    block.content._meta = current;
    expect(admittedIssues(parsed).map(i => i.field)).toEqual(['_meta']);
    expect(admittedIssues(source)).toEqual([]);
    block.rawJson = '{"_meta":{}}';
    parsed.raw = header + fence('property', { section_id: 'wrong' });
    block.content = { _meta: current, payload: 1 };
    block.meta = { ...meta, section: 'stale' };
    expect(admittedIssues(parsed)).toEqual([]);
    const clone = JSON.parse(JSON.stringify(parsed)) as ParsedUWFile;
    expect(admittedIssues(clone)).toEqual([]);
  });

  it('attributes all eight predicate combinations without absorbing actor or lifecycle errors', () => {
    for (let mask = 0; mask < 8; mask++) {
      const m = canonicalMeta();
      if (mask & 2) m.section = false;
      if (mask & 4) m.quality = null;
      const value = mask & 1 ? { payload: 1, _meta: m } : { _meta: m, payload: 1 };
      const fields = admittedIssues(header + fence('property', value)).map(i => i.field);
      expect(fields).toEqual(['_meta', '_meta.section', '_meta.quality'].filter((_, index) => mask & (1 << index)));
    }
  });

  it('keeps wrapper/nested-shape precedence and never cascades three predicates', () => {
    for (const value of [null, [], '', {}, { provenance: null, lifecycle: {} }, { provenance: {}, lifecycle: null }]) {
      const parsed = doc({ payload: 1, _meta: value });
      expect(admittedIssues(parsed)).toEqual([]);
      expect(validateUWFile(parsed).issues.filter(i => i.code === 'META-01')).toHaveLength(1);
    }
    expect(admittedIssues(doc({ section_id: 'property', payload: 1, _meta: { ...canonicalMeta(), section: false, quality: null } }))).toEqual([]);
    expect(admittedIssues(doc({ payload: 1 }))).toEqual([]);
  });

  it('finishes all old shapes, then all P1/P2/P3, then actors and booleans', () => {
    const broken = () => ({ payload: 1, _meta: {
      ...canonicalMeta(), section: 'mismatch', quality: null,
      provenance: { ...meta.provenance, actor: '' }, lifecycle: { ...meta.lifecycle, superseded: null },
    } });
    const source = header + fence('x_first', broken())
      + fence('x_second', broken()) + fence('property', { _meta: {} });
    const issues = validateUWFile(source).issues.filter(i => ['META-01', 'META-02', 'META-03'].includes(i.code));
    expect(issues.map(i => [i.section, i.field])).toEqual([
      ['property', undefined],
      ...['x_first', 'x_second'].flatMap(id => [[id, '_meta'], [id, '_meta.section'], [id, '_meta.quality']]),
      ['x_first', '_meta.provenance.actor'], ['x_second', '_meta.provenance.actor'],
      ['x_first', '_meta.lifecycle.superseded'], ['x_second', '_meta.lifecycle.superseded'],
    ]);
    expect(issues.every(i => i.severity === 'error' && !('category' in i))).toBe(true);
  });

  it('retains history and overwritten peers, then model-only additions once by identity', () => {
    const bad = (id: string) => ({ _meta: { ...canonicalMeta(), section: id, quality: null } });
    const ids = ['x_peer', 'pipeline_log', 'property', 'custom_calculations', 'custom_scenarios'];
    const source = header + ids.map(id => fence(id, bad(id), id === 'property' ? 'superseded=true' : '')).join('')
      + fence('x_peer', { _meta: { ...canonicalMeta(), section: 'x_peer' } })
      + fence('property', { _meta: canonicalMeta() });
    const parsed = parseUWFile(source);
    const before = JSON.stringify(parsed);
    expect(admittedIssues(parsed).map(i => i.section)).toEqual(ids);
    expect(JSON.stringify(parsed)).toBe(before);
    expect(parsed.raw).toBe(source);
    const added = doc(bad('property')).sections.property as UWBlock;
    parsed.sections.new_block = added;
    parsed.extensions.alias = { mode: 'single', block: added };
    parsed.extensions.distinct = { mode: 'single', block: structuredClone(added) };
    expect(admittedIssues(parsed).map(i => i.section)).toEqual([...ids, 'new_block', 'distinct']);
    const copy = JSON.parse(before) as ParsedUWFile;
    expect(admittedIssues(copy).map(i => i.section)).toEqual(['property', 'x_peer', 'pipeline_log', 'custom_calculations', 'custom_scenarios']);
  });

  it('keeps source bytes, public model shape, partitions and readiness intact', () => {
    const source = shapeSource(JSON.stringify({ _meta: { ...canonicalMeta(), quality: null } }));
    const result = validateUWFile(source);
    const parsed = parseUWFile(source);
    const before = JSON.stringify(parsed);
    const good = validateUWFile(shapeSource(JSON.stringify({ _meta: canonicalMeta() })));
    expect(result.stage_readiness).toEqual(good.stage_readiness);
    expect(result.coverage).toEqual(good.coverage);
    expect(result.errors.filter(i => i.field === '_meta.quality')).toHaveLength(1);
    expect(result.issues.filter(i => i.severity === 'error')).toEqual(result.errors);
    expect(result.issues.filter(i => i.severity === 'warning')).toEqual(result.warnings);
    expect(result.issues.filter(i => i.severity === 'info')).toEqual(result.info);
    validateUWFile(parsed);
    expect(JSON.stringify(parsed)).toBe(before);
    expect(parsed.raw).toBe(source);
    expect(publicAPI).not.toHaveProperty('parsedFirstSourceMember');
  });
});


const partSource = (id: string, section: string, json: string, history = '') => `---
uw_version: "3.0"
uwpart_version: "1.0"
part_id: ${id}
section: ${section}
---
${history}\`\`\`json uw:section=${section}
${json}
\`\`\`
`;
const externalSource = (section: string, parts: string[], collection = false) => header + fence(section, {
  _meta: { ...canonicalMeta(), section },
  external: { parts, part_count: parts.length, ...(collection ? { collection_key: 'unit_id', collection_path: 'units' } : {}) },
});

describe('RFC0093 composed SOURCE and derived MODEL accounting', () => {
  it('keeps whole-section financial content while assessing actual part lexical order', () => {
    const root = externalSource('property', ['whole']);
    const part = partSource('whole', 'property', `{"0":1,"_meta":${JSON.stringify(canonicalMeta())},"total_units":17}`);
    const result = validateUWFile(root, undefined, { parts: [part] });
    expect(result.errors.filter(i => i.code === 'META-01').map(i => i.field)).toEqual(['_meta']);
    const parsed = parseUWFile(root);
    const actualPart = parseUWPart(parseUWFile(part));
    const resolved = resolveComposition(parsed, { parts: new Map([['whole', actualPart]]) });
    expect(resolved.status).toBe('resolved');
    expect((resolved.document.sections.property as UWBlock).content.total_units).toBe(17);
    expect(validateUWFile(resolved.document).errors.filter(i => i.code === 'META-01')).toEqual([]);
    expect(parsedPhysicalBlocks(resolved.document)).toEqual([...parsedPhysicalBlocks(parsed), ...actualPart.blocks]);
    expect(root).toContain('"external"');
    expect(part).toContain('"0":1,"_meta"');
  });

  it('retains every physical historical part block and excludes unused loaded parts', () => {
    const oldMeta = { ...canonicalMeta(), quality: null };
    const old = fence('property', { _meta: oldMeta }, 'superseded=true v=1');
    const part = partSource('whole', 'property', JSON.stringify({ _meta: canonicalMeta(), total_units: 17 }), old);
    const unused = partSource('unused', 'property', JSON.stringify({ _meta: oldMeta }));
    const root = externalSource('property', ['whole']);
    const result = validateUWFile(root, undefined, { parts: [unused, part] });
    expect(result.errors.filter(i => i.code === 'META-01').map(i => i.field)).toEqual(['_meta.quality']);
    expect(result.errors.some(i => i.code === 'META-02')).toBe(false);
  });

  it('assesses collection fragments before metadata is stripped from assembled rows', () => {
    const root = externalSource('rent_roll', ['second', 'first'], true);
    const make = (id: string, unit: string) => partSource(id, 'rent_roll', JSON.stringify({
      _meta: { ...canonicalMeta(), section: 'rent_roll', quality: null }, unit_id: unit, monthly_rent: 1000,
    })).replace('section: rent_roll\n', 'section: rent_roll\ncollection_member: true\n');
    const first = make('first', 'A');
    const second = make('second', 'B');
    const result = validateUWFile(root, undefined, { parts: [first, second] });
    expect(result.errors.filter(i => i.code === 'META-01').map(i => i.field)).toEqual(['_meta.quality', '_meta.quality']);
    const parsed = parseUWFile(root);
    const parts = new Map([first, second].map(source => { const part = parseUWPart(parseUWFile(source)); return [part.part_id, part] as const; }));
    const resolved = resolveComposition(parsed, { parts });
    const refs = parsedPhysicalBlocks(resolved.document);
    expect(refs).toEqual([...parsedPhysicalBlocks(parsed), ...parts.get('second')!.blocks, ...parts.get('first')!.blocks]);
    expect((resolved.document.sections.rent_roll as UWBlock).content.units).toEqual([
      { unit_id: 'A', monthly_rent: 1000 }, { unit_id: 'B', monthly_rent: 1000 },
    ]);
  });

  it('keeps complete shape, actor and boolean checkpoints on root then part population', () => {
    const actorMissing = { ...canonicalMeta(), provenance: { ...meta.provenance, actor: '' } };
    const root = externalSource('property', ['whole']);
    const part = partSource('whole', 'property', JSON.stringify({ _meta: actorMissing, total_units: 17 }),
      fence('property', { _meta: { ...canonicalMeta(), quality: null, lifecycle: { ...meta.lifecycle, superseded: null } } }, 'superseded=true'));
    const issues = validateUWFile(root, undefined, { parts: [part] }).issues.filter(i => ['META-01', 'META-02', 'META-03'].includes(i.code));
    expect(issues.map(i => i.field)).toEqual([
      '_meta.quality', '_meta.provenance.actor', '_meta.provenance.actor', '_meta.lifecycle.superseded',
    ]); // selected source and synthesized whole-section references are distinct
  });

  it('deduplicates exact references, never equal content, without public evidence fields', () => {
    const parsed = doc({ _meta: canonicalMeta() });
    const block = parsed.sections.property as UWBlock;
    const equal = structuredClone(block);
    retainParsedPhysicalBlocks(parsed, [block, block, equal]);
    expect(parsedPhysicalBlocks(parsed)).toEqual([block, equal]);
    expect(parsedPhysicalBlocks(parsed)[1]).not.toBe(block);
    expect(publicAPI).not.toHaveProperty('retainParsedPhysicalBlocks');
    expect(Object.keys(parsed)).not.toContain('physical');
  });

  it('retains supplied part model references without inventing source history or lexical order', () => {
    const root = parseUWFile(externalSource('property', ['whole']));
    const source = partSource('whole', 'property', JSON.stringify({ _meta: { ...canonicalMeta(), quality: null } }));
    const copied = JSON.parse(JSON.stringify(parseUWFile(source))) as ParsedUWFile;
    copied.raw = 'stale copied part source must not be parsed';
    const part = parseUWPart(copied);
    const resolved = resolveComposition(root, { parts: new Map([['whole', part]]) });
    expect(parsedPhysicalBlocks(resolved.document)).toContain(part.blocks[0]);
    expect(validateUWFile(resolved.document).errors.filter(i => i.field === '_meta.quality')).toHaveLength(2);
  });

  it('keeps newly added unselected part model blocks in the metadata population', () => {
    const root = parseUWFile(externalSource('property', ['whole']));
    const part = parseUWPart(parseUWFile(partSource('whole', 'property', JSON.stringify({ _meta: canonicalMeta(), total_units: 17 }))));
    const added = doc({ _meta: { ...canonicalMeta(), quality: null } }).sections.property as UWBlock;
    part.blocks.push(added);
    const resolved = resolveComposition(root, { parts: new Map([['whole', part]]) });
    expect((resolved.document.sections.property as UWBlock).content.total_units).toBe(17);
    expect(parsedPhysicalBlocks(resolved.document)).toContain(added);
    expect(validateUWFile(resolved.document).errors.filter(i => i.field === '_meta.quality')).toHaveLength(1);
  });

  it('refuses unavailable composition and duplicate ids with existing typed boundaries', () => {
    const root = externalSource('property', ['missing']);
    expect(() => validateUWFile(root, undefined, { parts: [] })).toThrowError(CompositionError);
    try { validateUWFile(root, undefined, { parts: [] }); } catch (error) {
      expect((error as CompositionError).code).toBe('COMP-UNRESOLVED');
    }
    const part = partSource('missing', 'property', JSON.stringify({ _meta: canonicalMeta() }));
    try { validateUWFile(root, undefined, { parts: [part, part] }); } catch (error) {
      expect((error as CompositionError).code).toBe('COMP-DUP-KEY');
    }
    expect(() => validateUWFile(parseUWFile(root), undefined, { parts: [part] })).toThrowError(CompositionError);
  });
});
