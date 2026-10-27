import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { DOCUMENT_FACT_DEFINITIONS, DOCUMENT_FACTS_BINDINGS, assertDocumentFacts, isDocumentFactsProfile, parseDocumentFactsJSON, parseDocumentFactsUWX, projectDocumentFacts, renderDocumentFactsLite, validateDocumentFacts, type DocumentFactsDocument, type DocumentFactsProfile, type DocumentFactsSourceInventory, type DocumentFactsSelection } from './document-facts.js';
import { buildMeta } from './metadata.js';
import { blockPayload, getSection, getSectionVariant, parseUWFile } from './parser.js';
import { compileUWLite } from './lite-bridge.js';
import { parseUWLite } from './lite.js';
import { createUWMCPValidationResult } from './bindings.js';
import { toUWEnvelope } from './envelope.js';

const profiles = ['loan-quote-v1', 'offering-memorandum-v1', 'appraisal-abstract-v1'] as const;
const file = (profile: string) => profile.replace(/-v1$/, '');
const load = (profile: string): DocumentFactsDocument => JSON.parse(readFileSync(new URL(`../../../conformance/document-facts/${file(profile)}.json`, import.meta.url), 'utf8'));
const inventory = (doc: DocumentFactsDocument): DocumentFactsSourceInventory => ({ source_ids: [...doc.governing_documents], conflicting_source_ids: [] });
const clone = <T>(v: T): T => structuredClone(v);
const source = (profile: string, doc: DocumentFactsDocument) => `---\nuw_version: "3.0"\ndocument_profile: ${profile}\ndocument_id: ${doc.document_id}\n---\n\n\`\`\`json uw:section=document_facts\n${JSON.stringify({ _meta: buildMeta('document_facts', 1, { source: 'manual', actor: 'uwmd-fixture', timestamp: '2026-10-01T00:00:00Z' }), ...doc })}\n\`\`\`\n`;
const target = () => parseUWFile(`---\nuw_version: "3.0"\ndeal_id: qa-document-facts-target\ncurrency_code: USD\nasset_class: multifamily\n---\n${['property', 'valuation', 'debt_structure'].map(section => `\n\`\`\`json uw:section=${section}${section === 'debt_structure' ? ' variant=senior' : ''}\n${JSON.stringify({ ...(section === 'debt_structure' ? { _role: 'senior' } : {}), _meta: buildMeta(section, 1, { source: 'manual', actor: 'uwmd-fixture', timestamp: '2026-10-01T00:00:00Z' }) })}\n\`\`\`\n`).join('')}`);
function selection(profile: DocumentFactsProfile, doc: DocumentFactsDocument): DocumentFactsSelection {
  return { source_inventory: inventory(doc), destinations: Object.keys(doc.facts).map(fact => ({ fact, deal_id: 'qa-document-facts-target', section: DOCUMENT_FACT_DEFINITIONS[profile][fact].section, variant: fact.startsWith('debt_structure.') ? 'senior' : null, currency_code: 'USD' })) };
}
const codes = (profile: unknown, doc: unknown, inv: DocumentFactsSourceInventory) => validateDocumentFacts(profile, doc, inv).map(e => e.code);
function deepFreeze(value: unknown): void { if (value !== null && typeof value === 'object') { for (const item of Object.values(value)) deepFreeze(item); Object.freeze(value); } }

describe('RFC0129 document facts', () => {
  const ajv = new Ajv.default({ strict: false, allErrors: true });
  addFormats.default(ajv);
  for (const name of ['document-fact-term', ...profiles.map(p => `document-facts-${file(p)}`)]) ajv.addSchema(JSON.parse(readFileSync(new URL(`../../../spec/schemas/${name}.schema.json`, import.meta.url), 'utf8')));

  it.each(profiles)('%s validates the original worked JSON and strict UWX without changing source', profile => {
    const doc = load(profile);
    const inv = inventory(doc);
    const raw = source(profile, doc);
    expect(validateDocumentFacts(profile, doc, inv)).toEqual([]);
    const schema = ajv.getSchema(`https://uwmd.org/schemas/document-facts-${file(profile)}.schema.json`)!.schema as { properties: { facts: { properties: Record<string, unknown> } } };
    expect(Object.keys(schema.properties.facts.properties).sort()).toEqual(Object.keys(DOCUMENT_FACT_DEFINITIONS[profile]).sort());
    expect(ajv.validate(`https://uwmd.org/schemas/document-facts-${file(profile)}.schema.json`, doc)).toBe(true);
    expect(parseDocumentFactsJSON(profile, JSON.stringify(doc), inv)).toEqual(doc);
    expect(parseDocumentFactsUWX(raw, inv)).toEqual({ profile, document: doc });
    expect(source(profile, doc)).toBe(raw);
  });

  for (const profile of profiles) for (const [key, definition] of Object.entries(DOCUMENT_FACT_DEFINITIONS[profile])) {
    const values = Array.isArray(definition.kind) ? definition.kind : definition.kind === 'date' ? ['2024-02-29'] : [0, 0.06, -1, 1e-308];
    it(`${profile} admits every exact ${key} type/vocabulary without conversion`, () => {
      const doc = load(profile); const ref = { source: doc.governing_documents[0], locator: 'synthetic p1 exact stated value' };
      for (const value of values) {
        doc.facts = { [key]: { value, source_ref: ref } };
        expect(validateDocumentFacts(profile, doc, inventory(doc))).toEqual([]);
        expect(ajv.validate(`https://uwmd.org/schemas/document-facts-${file(profile)}.schema.json`, doc)).toBe(true);
        const projected = projectDocumentFacts(profile, doc, target(), selection(profile, doc));
        expect(projected.edits).toHaveLength(1);
        expect(Object.is(projected.edits[0].value, value)).toBe(true);
      }
      doc.facts = { [key]: { value: {}, source_ref: ref } };
      expect(codes(profile, doc, inventory(doc))).toContain('DF-008');
      expect(ajv.validate(`https://uwmd.org/schemas/document-facts-${file(profile)}.schema.json`, doc)).toBe(false);
    });
  }

  for (const profile of profiles) for (const status of ['not_stated', 'ambiguous', 'not_reviewed'] as const) it(`${profile}: null/${status} remains a visible omission/conflict`, () => {
    const doc = load(profile);
    const key = Object.keys(doc.facts)[0]; doc.facts = { [key]: { value: null, status } };
    expect(validateDocumentFacts(profile, doc, inventory(doc))).toEqual([]);
    const result = projectDocumentFacts(profile, doc, target(), selection(profile, doc));
    expect(result.edits).toEqual([]);
    expect([...result.report.omitted, ...result.report.conflicts].some(e => e.fact === key && e.reason.includes(status))).toBe(true);
    expect(renderDocumentFactsLite(profile, doc, inventory(doc))).toContain(status);
  });

  it('refuses malformed roots, identities, dates, currency and inventory deterministically', () => {
    const doc = load(profiles[0]);
    const inv = inventory(doc);
    expect(codes('unknown-v1', doc, inv)).toEqual(['DF-001']);
    expect(codes(profiles[0], null, inv)).toEqual(['DF-002']);
    expect(codes(profiles[0], doc, {} as DocumentFactsSourceInventory)).toEqual(['DF-005']);
    for (const patch of [{ document_id: '' }, { extra: 1 }, { as_of: '2026-02-30' }, { as_of: '2026-01-01T00:00:00Z' }, { currency_code: 'usd' }, { artifact_kind: 'executed_loan' }, { governing_documents: [] }, { governing_documents: ['foreign'] }, { governing_documents: [...doc.governing_documents, ...doc.governing_documents] }, { facts: {} }, { facts: [] }, { findings: [1] }, { supersedes: doc.document_id }, { supersedes: '' }]) {
      expect(validateDocumentFacts(profiles[0], { ...doc, ...patch }, inv).length).toBeGreaterThan(0);
    }
    expect(codes(profiles[0], doc, { source_ids: [...inv.source_ids, ...inv.source_ids], conflicting_source_ids: [] })).toContain('DF-005');
    expect(codes(profiles[0], doc, { source_ids: inv.source_ids, conflicting_source_ids: ['foreign'] })).toContain('DF-005');
    expect(() => assertDocumentFacts(profiles[0], {}, inv)).toThrow(/DF-/);
  });

  it('refuses unknown facts, term/status tricks, foreign or empty citations and duplicate labels', () => {
    const doc = load(profiles[0]);
    const key = 'debt_structure.loan_amount';
    const inv = inventory(doc);
    const ref = { source: inv.source_ids[0], locator: 'p1' };
    for (const term of [null, {}, { value: 1, source_ref: ref, extra: true }, { value: null }, { value: null, status: 'missing' }, { value: 1 }, { value: 1, status: 'not_stated', source_ref: ref }, { value: 1, source_ref: null }, { value: 1, source_ref: { source: 'foreign', locator: 'p1' } }, { value: 1, source_ref: { source: inv.source_ids[0], locator: ' ' } }, { value: 1, source_ref: { ...ref, extra: 1 } }]) {
      expect(codes(profiles[0], { ...doc, facts: { [key]: term } }, inv)).toContain('DF-007');
    }
    for (const key of ['debt_structure.sizing_metrics.ltv', 'debt_structure.loan_amount[0]', 'valuation.purchase_price', 'constructor']) expect(codes(profiles[0], { ...doc, facts: { [key]: { value: 1, source_ref: ref } } }, inv)).toContain('DF-006');
    for (const unmapped of [1, [null], [{ label: '', term: { value: null, status: 'not_stated' } }], [{ label: 'x', term: { value: null, status: 'not_stated' }, extra: 1 }], [{ label: 'x', term: { value: 1, source_ref: ref } }, { label: 'x', term: { value: 2, source_ref: ref } }]]) expect(codes(profiles[0], { ...doc, unmapped_facts: unmapped }, inv)).toContain('DF-009');
    expect(validateDocumentFacts(profiles[0], { ...doc, facts: { [key]: { value: null, status: 'ambiguous', source_ref: ref } } }, inv)).toEqual([]);
  });

  it('refuses duplicate raw keys and non-I-JSON before they can be erased', () => {
    const doc = load(profiles[0]);
    const inv = inventory(doc);
    expect(() => parseDocumentFactsJSON(profiles[0], readFileSync(new URL('../../../conformance/document-facts/duplicate-fact.json.txt', import.meta.url), 'utf8'), inv)).toThrow(/DF-012/);
    for (const raw of ['{', '{"x":1e999}', '{"x":"\\ud800"}', '{"a":1,"\\u0061":2}']) expect(() => parseDocumentFactsJSON(profiles[0], raw, inv)).toThrow(/DF-012/);
    const nonfinite = clone(doc); nonfinite.facts['debt_structure.loan_amount'].value = Number.POSITIVE_INFINITY;
    expect(codes(profiles[0], nonfinite, inv)).toContain('DF-002');
    let reads = 0; Object.defineProperty(nonfinite, 'document_id', { enumerable: true, get() { reads++; return 'unsafe'; } });
    expect(codes(profiles[0], nonfinite, inv)).toContain('DF-002'); expect(reads).toBe(0);
  });

  it.each(profiles)('%s projects only sorted explicit candidates and never mutates either record', profile => {
    const doc = load(profile);
    const destination = target();
    const selected = selection(profile, doc);
    const before = clone({ doc, destination, selected }); deepFreeze(doc); deepFreeze(destination); deepFreeze(selected);
    const result = projectDocumentFacts(profile, doc, destination, selected);
    expect(result.edits.map(e => e.fact)).toEqual(Object.keys(doc.facts).filter(k => doc.facts[k].value !== null).sort());
    for (const edit of result.edits) { expect(edit.value).toEqual(doc.facts[edit.fact].value); expect(edit.source_ref).toEqual(doc.facts[edit.fact].source_ref); }
    expect({ doc, destination, selected }).toEqual(before);
    expect(result.edits.some(e => ['purchase_price', 'underwritten_value', 'ltv', 'net_operating_income'].includes(e.field))).toBe(false);
    for (const entry of doc.unmapped_facts ?? []) expect(result.report.omitted.some(o => o.fact.endsWith(entry.label))).toBe(true);
    if (result.edits[0]) result.edits[0].source_ref.locator = 'candidate only';
    expect({ doc, destination, selected }).toEqual(before);
  });

  it('refuses target guesses, mismatches, duplicate selection and unresolved sources', () => {
    const doc = load(profiles[0]); doc.facts = { 'debt_structure.loan_amount': doc.facts['debt_structure.loan_amount'] };
    const original = selection(profiles[0], doc);
    const missing = projectDocumentFacts(profiles[0], doc, target(), { ...original, destinations: [] });
    expect(missing.edits).toEqual([]); expect(missing.report.omitted[0].reason).toContain('No destination');
    for (const patch of [{ deal_id: 'other' }, { section: 'valuation' }, { variant: null }, { variant: 'junior' }, { currency_code: 'EUR' }, { variant: undefined }]) {
      const selected = clone(original); Object.assign(selected.destinations[0], patch);
      const result = projectDocumentFacts(profiles[0], doc, target(), selected);
      expect(result.edits).toEqual([]); expect(result.report.conflicts.length).toBeGreaterThan(0);
    }
    const duplicate = { ...original, destinations: [...original.destinations, ...original.destinations] };
    expect(projectDocumentFacts(profiles[0], doc, target(), duplicate).report.conflicts[0].reason).toContain('Duplicate');
    const foreign = projectDocumentFacts(profiles[0], doc, target(), { ...original, source_inventory: { source_ids: [], conflicting_source_ids: [] } });
    expect(foreign.edits).toEqual([]); expect(foreign.report.conflicts[0].code).toBe('DF-005');
    const absent = { ...original, destinations: [{ ...original.destinations[0], fact: 'debt_structure.sizing_metrics.ltv' }] };
    expect(projectDocumentFacts(profiles[0], doc, target(), absent).report.conflicts.some(c => c.reason.includes('absent'))).toBe(true);
  });

  it('preserves equal targets as explicit no-ops, conflicts as refusals and null as missing', () => {
    const doc = load(profiles[0]); doc.facts = { 'debt_structure.loan_amount': doc.facts['debt_structure.loan_amount'] };
    const selected = selection(profiles[0], doc);
    const record = target();
    const content = getSectionVariant(record, 'debt_structure', 'senior')!.content;
    content.loan_amount = doc.facts['debt_structure.loan_amount'].value;
    expect(projectDocumentFacts(profiles[0], doc, record, selected).report.noops).toHaveLength(1);
    content.loan_amount = 2;
    expect(projectDocumentFacts(profiles[0], doc, record, selected).report.conflicts[0].reason).toContain('differs');
    content.loan_amount = undefined;
    expect(projectDocumentFacts(profiles[0], doc, record, selected).report.conflicts[0].reason).toContain('finite JSON');
    content.loan_amount = null;
    expect(projectDocumentFacts(profiles[0], doc, record, selected).edits).toHaveLength(1);
    expect(blockPayload(getSection(record, 'valuation')!)).toEqual({});
  });

  it('uses exact singleton annotations and refuses invalid declared roles', () => {
    const doc = load(profiles[0]);
    const selected = selection(profiles[0], doc);
    const raw = target().raw.replace('"_role":"senior",', '');
    const singleton = parseUWFile(raw);
    expect(projectDocumentFacts(profiles[0], doc, singleton, selected).edits).toHaveLength(2);
    const invalid = target(); getSectionVariant(invalid, 'debt_structure', 'senior')!.content['_role'] = 'input';
    expect(projectDocumentFacts(profiles[0], doc, invalid, selected).edits).toEqual([]);
  });

  it('refuses amendment/conflicting governing sets without precedence or defaulting', () => {
    const doc = load(profiles[0]);
    const selected = selection(profiles[0], doc);
    doc.artifact_kind = 'amendment'; doc.supersedes = 'prior-quote';
    expect(projectDocumentFacts(profiles[0], doc, target(), selected).edits).toEqual([]);
    doc.artifact_kind = 'quote'; selected.source_inventory = { source_ids: doc.governing_documents, conflicting_source_ids: doc.governing_documents };
    const result = projectDocumentFacts(profiles[0], doc, target(), selected);
    expect(result.edits).toEqual([]); expect(result.report.conflicts[0].reason).toContain('governing sources');
  });

  it.each(profiles)('%s has a complete Lite view and refuses compilation and MCP fact validation', async profile => {
    const doc = load(profile);
    const raw = source(profile, doc);
    const view = renderDocumentFactsLite(profile, doc, inventory(doc));
    expect(view).toContain(JSON.stringify(doc, null, 2));
    const compilation = compileUWLite(parseUWLite(view));
    expect(compilation.ok).toBe(false);
    expect(compilation.report.issues.map(i => i.code)).toContain('LITE_COMPILE_DOCUMENT_PROFILE_UNSUPPORTED');
    await expect(createUWMCPValidationResult(toUWEnvelope(parseUWFile(raw.replace('uw_version: \"3.0\"', 'uw_version: \"3.0\"\ndeal_id: qa-binding-target\ndeal_name: QA source binding target'))), 'unused')).rejects.toMatchObject({ code: 'BINDING_PROFILE_UNSUPPORTED' });
    expect(DOCUMENT_FACTS_BINDINGS).toEqual({ library: true, lite_view: true, lite_compile: false, cli: false, mcp: false, http: false });
  });

  it('retains superseded physical source history without admitting a named fact variant', () => {
    const doc = load(profiles[0]);
    const inv = inventory(doc);
    const raw = source(profiles[0], doc);
    expect(() => parseDocumentFactsUWX(raw.replace('uw:section=document_facts', 'uw:section=document_facts variant=other'), inv)).toThrow(/DF-011/);
    const parsed = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
    parsed._meta.lifecycle.superseded = true;
    const historic = `\n\`\`\`json uw:section=document_facts\n${JSON.stringify(parsed)}\n\`\`\`\n`;
    expect(parseDocumentFactsUWX(raw + historic, inv).document).toEqual(doc);
  });

  it('refuses wrong or ambiguous carriers while preserving unknown purposes as a Reader', () => {
    const doc = load(profiles[0]);
    const inv = inventory(doc);
    const raw = source(profiles[0], doc);
    for (const changed of [raw.replace('qa-001', 'different-id'), raw.replace('uw:section=document_facts', 'uw:section=other'), raw + raw.slice(raw.indexOf('```json')), raw.replace(profiles[0], 'unknown-v1')]) expect(() => parseDocumentFactsUWX(changed, inv)).toThrow();
    const unknown = parseUWFile(raw.replace(profiles[0], 'unknown-v1'));
    expect(unknown.frontmatter.document_profile).toBe('unknown-v1'); expect(getSection(unknown, 'document_facts')).not.toBeNull();
    expect(isDocumentFactsProfile('unknown-v1')).toBe(false);
  });
});
