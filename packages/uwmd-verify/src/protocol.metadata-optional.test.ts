import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { BUILTIN_REMEDIATIONS } from './protocol.js';

const schema = JSON.parse(readFileSync(new URL('../../../spec/schemas/uwmd-block.schema.json', import.meta.url), 'utf8'));
const vectors = JSON.parse(readFileSync(new URL('../../../conformance/metadata-dates/2026-10-17-validation-diagnostic-gap-354.0095-date-only.vectors.json', import.meta.url), 'utf8'));
const ajv = new Ajv2020({ strict: false, validateFormats: false, allErrors: true });
const validate = ajv.compile(schema);
const validateDate = ajv.compile(schema.$defs.MarketReferenceDate);
const digest = `sha256:${'a'.repeat(64)}`;
const fresh = (): Record<string, any> => ({ _meta: { section: 'property', provenance: { source: 'manual', actor: 'synthetic', timestamp: '2026-10-18T00:00:00Z' }, quality: { confidence: 'high', human_review_required: false }, lifecycle: { revision: 1, superseded: false } }, value: 1 });
const requiredCarriers = (block: Record<string, any>): string[] => {
  validate(block);
  return (validate.errors ?? []).filter(e => e.keyword === 'required' && e.instancePath === '/_meta/provenance').map(e => e.params.missingProperty).sort();
};

describe('RFC0095 synchronized schema', () => {
  it('asserts all106 frozen U3 date vectors without optional format plugins', () => {
    expect(vectors.date_cases).toHaveLength(106);
    for (const v of vectors.date_cases) expect(validateDate(v.input), v.id).toBe(v.admitted);
    for (const v of vectors.required_as_of_carriers) {
      const b = fresh();
      b._meta.provenance.market_data_ref = { document_id: '', digest, ...v.input };
      expect(validate(b), v.id).toBe(v.admitted);
    }
  });
  it('matches the independently frozen calendar truth sequence through one full400-year cycle', () => {
    const hash = createHash('sha256');
    let admitted = 0;
    for (let year = 1; year <= 400; year++) for (let month = 1; month <= 12; month++) for (let day = 0; day <= 32; day++) {
      const valid = Boolean(validateDate(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`));
      hash.update(valid ? '1' : '0');
      if (valid) admitted++;
    }
    expect(admitted).toBe(146097);
    expect(hash.digest('hex')).toBe('140e5faf25833eca88eae2bd7a3d35d787f90ab2a06952f87a79dbac894d1b7f');
  });
  it.each(['inherited_assumption', 'market_data_accepted'])('requires %s symmetrically from canonical and any stated override assertions', tag => {
    const carrier = tag === 'inherited_assumption' ? 'inherited_from' : 'market_data_ref';
    for (const overrides of [[{ resolution: tag }], [{ path: '', resolution: tag }, { path: '', resolution: 'user_input' }], [null, { path: 4, resolution: tag }]]) {
      const b = fresh(); b._overrides = overrides;
      expect(requiredCarriers(b)).toEqual([carrier]);
    }
    const canonical = fresh(); canonical._meta.provenance.resolution = tag;
    expect(requiredCarriers(canonical)).toEqual([carrier]);
    const dual = fresh(); dual._overrides = [{ path: 'same', resolution: 'inherited_assumption' }, { path: 'same', resolution: 'market_data_accepted' }, { path: 'same', resolution: 'user_input' }];
    expect(requiredCarriers(dual)).toEqual(['inherited_from', 'market_data_ref']);
  });
  it('suppresses conditional canonical descendants under rejected parents, while admitting valid agent presence', () => {
    const good = fresh(); good._meta.provenance.source = 'agent/synthetic';
    expect(requiredCarriers(good)).toEqual(['agent_id']);
    for (const kind of ['lifecycle-null', 'wrapper', 'provenance-null', 'meta-null', 'meta-missing']) {
      const b = fresh(); b._meta.provenance.source = 'agent/synthetic'; b._overrides = [{ resolution: 'market_data_accepted' }];
      if (kind === 'lifecycle-null') b._meta.lifecycle = null;
      if (kind === 'wrapper') b.section_id = 'property';
      if (kind === 'provenance-null') b._meta.provenance = null;
      if (kind === 'meta-null') b._meta = null;
      if (kind === 'meta-missing') delete b._meta;
      expect(requiredCarriers(b), kind).toEqual([]);
    }
  });
  it('admits lawful unknown data/null annotations and rejects exact malformed reference suffixes', () => {
    const b = fresh(); b._meta.provenance.source = 'agent/synthetic'; b._meta.provenance.agent_id = null;
    b._meta.provenance.inherited_from = { document_id: '', digest, distance: 1e30, opaque: { retained: true } };
    b._meta.provenance.market_data_ref = { document_id: '', digest, as_of: '0001-01-01', rationale: '', opaque: [] };
    expect(validate(b)).toBe(true);
    for (const carrier of ['inherited_from', 'market_data_ref']) {
      const changed = structuredClone(b); changed._meta.provenance[carrier].digest += '\n';
      expect(validate(changed), carrier).toBe(false);
    }
    const noTrigger = fresh(); noTrigger._overrides = [{ path: 'value', resolution: ['market_data_accepted'] }];
    expect(requiredCarriers(noTrigger)).toEqual([]);
  });
  it('registers exactly the accepted closed codes, leaving readiness severity unchanged', () => {
    for (const code of ['META-05', 'META-06']) {
      const entries = BUILTIN_REMEDIATIONS.filter(r => r.code === code);
      expect(entries).toHaveLength(1); expect(entries[0]!.severity).toBe('error');
    }
    expect(BUILTIN_REMEDIATIONS.filter(r => r.code === 'DQ-06').map(r => r.severity)).toEqual(['info']);
  });
});
