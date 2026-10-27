import { hasBlockRole, isBlockRole } from './block-roles.js';
import { explicitVariantBlock } from './section-resolution.js';
// RFC0129: attributed source facts, never underwriting or opinion selection.
import { assertJSONValue, assertDataDescriptors, snapshotJSONValue } from './json-admission.js';
import { readJSON } from './carrier-values.js';
import { canonicalize } from './integrity-canonical.js';
import { isValidAsOf } from './market-data.js';
import { blockPayload, getSection, parseUWFile, parsedPhysicalBlocks } from './parser.js';
import { DOCUMENT_FACTS_PROFILES, type ProtocolError } from './protocol.js';
import type { ParsedUWFile } from './types.js';

export type DocumentFactsProfile = (typeof DOCUMENT_FACTS_PROFILES)[number];
export const DOCUMENT_FACTS_SECTION = 'document_facts' as const;
export const RECORD_FACTS_PROJECTION = 'record-facts-v1' as const;
/** Reference scope: generic Reader transport does not claim a fact operation binding. */
export const DOCUMENT_FACTS_BINDINGS = Object.freeze({ library: true, lite_view: true, lite_compile: false, cli: false, mcp: false, http: false });
export interface DocumentFactTerm { value: unknown; source_ref?: { source: string; locator: string }; status?: 'not_stated' | 'ambiguous' | 'not_reviewed' }
export interface DocumentFactsDocument {
  document_id: string; artifact_kind: string; as_of: string; currency_code: string;
  governing_documents: string[]; facts: Record<string, DocumentFactTerm>;
  unmapped_facts?: Array<{ label: string; term: DocumentFactTerm }>;
  findings?: string[]; supersedes?: string;
}
/** Explicit host inventory; conflicts are declared, never inferred from prose. */
export interface DocumentFactsSourceInventory {
  source_ids: readonly string[];
  conflicting_source_ids: readonly string[];
}
export class DocumentFactsError extends Error {
  constructor(readonly code: string, message: string) { super(`[${code}] ${message}`); this.name = 'DocumentFactsError'; }
}
type FactDefinition = { section: string; field: string; kind: 'number' | 'date' | readonly string[] };
const def = (section: string, field: string, kind: FactDefinition['kind']): FactDefinition => Object.freeze({ section, field, kind });
const loan = (field: string, kind: FactDefinition['kind'] = 'number') => def('debt_structure', field, kind);
const appraisal = {
  'valuation.appraised_value': def('valuation', 'appraised_value', 'number'),
  'valuation.appraised_as_of': def('valuation', 'appraised_as_of', 'date'),
  'valuation.appraisal_report_date': def('valuation', 'appraisal_report_date', 'date'),
  'valuation.appraisal_approach': def('valuation', 'appraisal_approach', Object.freeze(['income', 'sales_comparison', 'cost', 'blended'])),
  'valuation.appraisal_cap_rate': def('valuation', 'appraisal_cap_rate', 'number'),
};
/** Exact Format4.1/4.6/4.7 fields. No expression or user-authored path evaluator. */
export const DOCUMENT_FACT_DEFINITIONS: Readonly<Record<DocumentFactsProfile, Readonly<Record<string, FactDefinition>>>> = Object.freeze({
  'loan-quote-v1': Object.freeze({
    'debt_structure.loan_amount': loan('loan_amount'),
    'debt_structure.loan_purpose': loan('loan_purpose', Object.freeze(['acquisition', 'refinance', 'cash_out_refi', 'construction', 'bridge', 'supplement'])),
    'debt_structure.loan_type': loan('loan_type', Object.freeze(['conventional', 'agency_fannie', 'agency_freddie', 'cmbs', 'sba_504', 'sba_7a', 'bridge', 'construction', 'life_co', 'hud_221d4', 'hud_223f', 'mezzanine'])),
    'debt_structure.rate_type': loan('rate_type', Object.freeze(['fixed', 'floating', 'hybrid'])),
    'debt_structure.interest_rate': loan('interest_rate'),
    'debt_structure.rate_index': loan('rate_index', Object.freeze(['sofr', 'prime', 'treasury_5yr', 'treasury_10yr', 'fixed'])),
    'debt_structure.rate_spread_bps': loan('rate_spread_bps'),
    'debt_structure.rate_floor_pct': loan('rate_floor_pct'),
    'debt_structure.amortization_years': loan('amortization_years'),
    'debt_structure.loan_term_years': loan('loan_term_years'),
    'debt_structure.io_period_months': loan('io_period_months'),
    'debt_structure.recourse': loan('recourse', Object.freeze(['full', 'partial', 'non_recourse', 'carve_outs_only'])),
    'debt_structure.prepayment_type': loan('prepayment_type', Object.freeze(['stepdown', 'yield_maintenance', 'defeasance', 'open', 'lockout', 'none'])),
    'debt_structure.origination_fee_pct': loan('origination_fee_pct'),
    'debt_structure.exit_fee_pct': loan('exit_fee_pct'),
    'debt_structure.lender_type': loan('lender_type', Object.freeze(['bank', 'credit_union', 'cmbs_conduit', 'agency', 'life_co', 'debt_fund', 'private', 'sba'])),
  }),
  'offering-memorandum-v1': Object.freeze({
    'property.year_built': def('property', 'year_built', 'number'),
    'property.total_units': def('property', 'total_units', 'number'),
    'property.total_nra_sqft': def('property', 'total_nra_sqft', 'number'),
    'valuation.appraised_value': appraisal['valuation.appraised_value'],
    'valuation.appraised_as_of': appraisal['valuation.appraised_as_of'],
    'valuation.appraisal_report_date': appraisal['valuation.appraisal_report_date'],
  }),
  'appraisal-abstract-v1': Object.freeze(appraisal),
});
const kinds: Record<DocumentFactsProfile, readonly string[]> = {
  'loan-quote-v1': ['quote', 'term_sheet', 'amendment'],
  'offering-memorandum-v1': ['offering_memorandum', 'amendment'],
  'appraisal-abstract-v1': ['appraisal_report', 'amendment'],
};
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const closed = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).every(k => keys.includes(k));
const pointer = (s: string) => s.replaceAll('~', '~0').replaceAll('/', '~1');
export function isDocumentFactsProfile(profile: unknown): profile is DocumentFactsProfile {
  return typeof profile === 'string' && (DOCUMENT_FACTS_PROFILES as readonly string[]).includes(profile);
}
function inventoryValid(value: unknown): value is DocumentFactsSourceInventory {
  return record(value) && closed(value, ['source_ids', 'conflicting_source_ids'])
    && [value.source_ids, value.conflicting_source_ids].every(a => Array.isArray(a) && a.every(text) && new Set(a).size === a.length)
    && (value.conflicting_source_ids as string[]).every(s => (value.source_ids as string[]).includes(s));
}
/** Structure and attribution only; inventory membership does not authenticate a source. */
export function validateDocumentFacts(profile: unknown, candidate: unknown, sourceInventory: DocumentFactsSourceInventory): ProtocolError[] {
  const errors: ProtocolError[] = [];
  const error = (code: string, message: string, at = '') => { errors.push({ category: 'validate', code, message, pointer: at }); };
  if (!isDocumentFactsProfile(profile)) return [{ category: 'validate', code: 'DF-001', message: 'Unsupported document-facts profile.' }];
  try { assertJSONValue(candidate); assertJSONValue(sourceInventory); } catch { return [{ category: 'validate', code: 'DF-002', message: 'Document and inventory must be finite, plain JSON values without accessors.' }]; }
  if (!record(candidate)) return [{ category: 'validate', code: 'DF-002', message: 'Document facts must be an object.' }];
  if (!inventoryValid(sourceInventory)) return [{ category: 'validate', code: 'DF-005', message: 'Supply unique source_ids and conflicting_source_ids from that inventory.' }];
  const doc = candidate;
  if (!closed(doc, ['document_id', 'artifact_kind', 'as_of', 'currency_code', 'governing_documents', 'facts', 'unmapped_facts', 'findings', 'supersedes']) || !text(doc.document_id)) error('DF-003', 'Closed document root requires a nonempty document_id.');
  if (!kinds[profile].includes(doc.artifact_kind as string)) error('DF-004', 'Artifact kind is outside this profile.', '/artifact_kind');
  if (!text(doc.as_of) || !isValidAsOf(doc.as_of)) error('DF-004', 'as_of must be a real YYYY-MM-DD.', '/as_of');
  if (typeof doc.currency_code !== 'string' || !/^[A-Z]{3}$/.test(doc.currency_code)) error('DF-004', 'currency_code must be three uppercase ASCII letters.', '/currency_code');
  const governing = Array.isArray(doc.governing_documents) ? doc.governing_documents : [];
  if (!governing.length || governing.some(v => !text(v) || !sourceInventory.source_ids.includes(v)) || new Set(governing).size !== governing.length) error('DF-005', 'Governing source identities must be nonempty, unique and present in the supplied inventory.', '/governing_documents');
  const term = (value: unknown, at: string, definition?: FactDefinition) => {
    if (!record(value) || !closed(value, ['value', 'source_ref', 'status']) || !Object.hasOwn(value, 'value')) { error('DF-007', 'A term must use only value/source_ref/status and state value.', at); return; }
    if (value.value === null) {
      if (!['not_stated', 'ambiguous', 'not_reviewed'].includes(value.status as string)) error('DF-007', 'Null requires not_stated, ambiguous or not_reviewed.', `${at}/status`);
    } else {
      if (Object.hasOwn(value, 'status') || !Object.hasOwn(value, 'source_ref')) error('DF-007', 'A stated term requires a source_ref and no status.', at);
      if (definition) {
        const k = definition.kind;
        const valid = k === 'number' ? typeof value.value === 'number' && Number.isFinite(value.value)
          : k === 'date' ? typeof value.value === 'string' && isValidAsOf(value.value)
          : typeof value.value === 'string' && k.includes(value.value);
        if (!valid) error('DF-008', 'Value does not have the exact destination field type/vocabulary; no unit conversion occurs.', `${at}/value`);
      }
    }
    if (Object.hasOwn(value, 'source_ref')) {
      const ref = value.source_ref;
      if (!record(ref) || !closed(ref, ['source', 'locator']) || !text(ref.source) || !text(ref.locator)
        || !governing.includes(ref.source) || !sourceInventory.source_ids.includes(ref.source)) error('DF-007', 'source_ref must contain a governing source identity and nonempty locator.', `${at}/source_ref`);
    }
  };
  if (!record(doc.facts) || Object.keys(doc.facts).length === 0) error('DF-006', 'facts must be a nonempty object.', '/facts');
  else for (const key of Object.keys(doc.facts).sort()) {
    const definition = DOCUMENT_FACT_DEFINITIONS[profile][key];
    if (!Object.hasOwn(DOCUMENT_FACT_DEFINITIONS[profile], key)) error('DF-006', 'Fact is outside this profile allowlist.', `/facts/${pointer(key)}`);
    else term(doc.facts[key], `/facts/${pointer(key)}`, definition);
  }
  if (doc.unmapped_facts !== undefined) {
    if (!Array.isArray(doc.unmapped_facts)) error('DF-009', 'unmapped_facts must be an array.', '/unmapped_facts');
    else {
      const seen = new Set<string>();
      doc.unmapped_facts.forEach((entry, i) => {
        if (!record(entry) || !closed(entry, ['label', 'term']) || !text(entry.label) || seen.has(entry.label)) { error('DF-009', 'Unmapped facts need unique nonempty labels and terms.', `/unmapped_facts/${i}`); return; }
        seen.add(entry.label); term(entry.term, `/unmapped_facts/${i}/term`);
      });
    }
  }
  if (doc.findings !== undefined && (!Array.isArray(doc.findings) || doc.findings.some(v => typeof v !== 'string'))) error('DF-010', 'findings must be strings.', '/findings');
  if (doc.supersedes !== undefined && (!text(doc.supersedes) || doc.supersedes === doc.document_id)) error('DF-010', 'supersedes must name a different prior document.', '/supersedes');
  return errors;
}
export function assertDocumentFacts(profile: unknown, payload: unknown, inventory: DocumentFactsSourceInventory): DocumentFactsDocument {
  const errors = validateDocumentFacts(profile, payload, inventory);
  if (errors.length) throw new DocumentFactsError(errors[0].code, errors.map(e => e.message).join('; '));
  return payload as DocumentFactsDocument;
}
/** Use raw JSON admission before an object can erase duplicate decoded keys. */
export function parseDocumentFactsJSON(profile: unknown, text: string, inventory: DocumentFactsSourceInventory): DocumentFactsDocument {
  let value: unknown;
  try { value = readJSON(text); } catch { throw new DocumentFactsError('DF-012', 'Document-facts JSON is malformed, duplicate-keyed or not finite I-JSON.'); }
  return assertDocumentFacts(profile, value, inventory);
}
export function parseDocumentFactsUWX(source: string, inventory: DocumentFactsSourceInventory): { profile: DocumentFactsProfile; document: DocumentFactsDocument } {
  const parsed = parseUWFile(source);
  const profile = parsed.frontmatter.document_profile;
  if (!isDocumentFactsProfile(profile)) throw new DocumentFactsError('DF-001', 'Declare an implemented document-facts profile.');
  const block = getSection(parsed, DOCUMENT_FACTS_SECTION);
  if (!block || block.annotation.variant !== undefined || parsedPhysicalBlocks(parsed).filter(b => b.annotation.section === DOCUMENT_FACTS_SECTION && !b.annotation.superseded && !b.meta?.lifecycle?.superseded).length !== 1) throw new DocumentFactsError('DF-011', 'A fact document requires one unvarianted current document_facts block.');
  const document = assertDocumentFacts(profile, blockPayload(block), inventory);
  for (const key of ['document_id', 'as_of', 'currency_code'] as const) {
    if (parsed.frontmatter[key] !== undefined && parsed.frontmatter[key] !== document[key]) throw new DocumentFactsError('DF-011', 'Descriptor and payload identities disagree.');
  }
  return { profile, document };
}
export interface DocumentFactDestination { fact: string; deal_id: string; section: string; variant: string | null; currency_code: string }
export interface DocumentFactsSelection { source_inventory: DocumentFactsSourceInventory; destinations: readonly DocumentFactDestination[] }
export interface DocumentFactCandidate extends DocumentFactDestination { field: string; value: unknown; source_document_id: string; source_ref: { source: string; locator: string } }
export interface DocumentFactsProjection {
  edits: DocumentFactCandidate[];
  report: { profile: typeof RECORD_FACTS_PROJECTION; omitted: Array<{ fact: string; code: string; reason: string }>; conflicts: Array<{ fact: string; code: string; reason: string }>; noops: DocumentFactDestination[]; findings: string[]; lossy: true };
}
/** Candidates only. Application and provenance remain a separate host operation. */
export function projectDocumentFacts(profile: unknown, payload: unknown, target: ParsedUWFile, selection: DocumentFactsSelection): DocumentFactsProjection {
  const result: DocumentFactsProjection = { edits: [], report: { profile: RECORD_FACTS_PROJECTION, omitted: [], conflicts: [], noops: [], findings: [], lossy: true } };
  const conflict = (fact: string, reason: string, code = 'DF-PROJECTION-REFUSED') => { result.report.conflicts.push({ fact, reason, code }); };
  try { assertJSONValue(selection); assertDataDescriptors(target); } catch { conflict('(selection)', 'Supply plain explicit selection and target data.'); return result; }
  if (!record(target) || !record(target.frontmatter) || !record(target.sections)) { conflict('(target)', 'An explicit parsed destination record is required.'); return result; }
  if (!record(selection) || !closed(selection, ['source_inventory', 'destinations']) || !Array.isArray(selection.destinations)) { conflict('(selection)', 'Explicit destinations and source inventory are required.'); return result; }
  const errors = validateDocumentFacts(profile, payload, selection.source_inventory);
  if (errors.length || !isDocumentFactsProfile(profile)) { for (const error of errors) conflict(error.pointer ?? '(document)', error.message, error.code); return result; }
  const doc = payload as DocumentFactsDocument;
  result.report.findings = [...doc.findings ?? []];
  const requested = new Map<string, DocumentFactDestination[]>();
  for (const destination of selection.destinations) {
    if (!record(destination) || !text(destination.fact)) { conflict('(selection)', 'Each destination must name a fact.'); continue; }
    requested.set(destination.fact, [...requested.get(destination.fact) ?? [], destination as unknown as DocumentFactDestination]);
  }
  for (const fact of Object.keys(doc.facts).sort()) {
    const term = doc.facts[fact]; const destinations = requested.get(fact) ?? [];
    const omit = (reason: string) => { result.report.omitted.push({ fact, code: 'DF-PROJECTION-OMITTED', reason }); };
    if (doc.artifact_kind === 'amendment' || doc.governing_documents.some(s => selection.source_inventory.conflicting_source_ids.includes(s))) { conflict(fact, 'Amendments or conflicting governing sources require a separately attributed resolution.'); continue; }
    if (term.value === null) { if (term.status === 'ambiguous') conflict(fact, 'status: ambiguous'); else omit(`status: ${term.status}`); continue; }
    if (destinations.length === 0) { omit('No destination requested; fact is outside this projection coverage.'); continue; }
    if (destinations.length !== 1) { conflict(fact, 'Duplicate destination selections cannot choose a winner.'); continue; }
    const destination = destinations[0]; const definition = DOCUMENT_FACT_DEFINITIONS[profile][fact];
    if (!closed(destination as unknown as Record<string, unknown>, ['fact', 'deal_id', 'section', 'variant', 'currency_code']) || !text(destination.deal_id) || !Object.hasOwn(target.frontmatter, 'deal_id') || destination.deal_id !== target.frontmatter.deal_id
      || destination.section !== definition.section || !(destination.variant === null || text(destination.variant))) { conflict(fact, 'Explicit deal identity and exact section/variant must match this fact.'); continue; }
    if (destination.currency_code !== doc.currency_code || !Object.hasOwn(target.frontmatter, 'currency_code') || target.frontmatter.currency_code !== doc.currency_code) { conflict(fact, 'Source, target and requested currency must agree; no FX conversion occurs.'); continue; }
    const entry = Object.hasOwn(target.sections, definition.section) ? target.sections[definition.section] : undefined;
    const single = destination.variant === null && entry ? getSection(target, definition.section) : null;
    const block = destination.variant === null ? (single?.annotation.variant === undefined ? single : null) : (entry ? explicitVariantBlock(entry, destination.variant) : null);
    if (!block || (hasBlockRole(block) && !isBlockRole(block.content['_role']))) { conflict(fact, 'The exact destination block does not resolve; no first-variant or block default is used.'); continue; }
    const content = blockPayload(block);
    if (!record(content)) { conflict(fact, 'Destination payload is not an object.'); continue; }
    if (Object.hasOwn(content, definition.field) && content[definition.field] !== null) {
      try { assertJSONValue(content[definition.field]); } catch { conflict(fact, 'Existing target is not finite JSON data.'); continue; }
      if (canonicalize(content[definition.field]) === canonicalize(term.value)) result.report.noops.push(snapshotJSONValue(destination));
      else conflict(fact, 'Existing target differs; source order cannot select a winner.');
      continue;
    }
    result.edits.push({ ...snapshotJSONValue(destination), field: definition.field, value: snapshotJSONValue(term.value), source_document_id: doc.document_id, source_ref: { ...term.source_ref! } });
  }
  for (const fact of [...requested.keys()].sort()) if (!Object.hasOwn(doc.facts, fact)) conflict(fact, 'Requested fact is absent or outside the document allowlist.');
  for (const entry of doc.unmapped_facts ?? []) result.report.omitted.push({ fact: `unmapped_facts/${entry.label}`, code: 'DF-PROJECTION-OMITTED', reason: 'Attributed statement has no projection destination in this revision.' });
  return result;
}
/** Complete view, not the deal-summary compilation profile. */
export function renderDocumentFactsLite(profile: unknown, payload: unknown, inventory: DocumentFactsSourceInventory): string {
  const doc = assertDocumentFacts(profile, payload, inventory);
  return `---\nuw_version: "3.0"\nuw_lite_version: "1.0"\ndocument_profile: ${JSON.stringify(profile)}\ndocument_id: ${JSON.stringify(doc.document_id)}\n---\n\n# Document facts — view only\n\nEvery stated fact, null status, source locator and finding is shown below.\nLite compilation and CLI/MCP/HTTP profile bindings are unsupported.\n\n\`\`\`json\n${JSON.stringify(doc, null, 2)}\n\`\`\`\n`;
}
