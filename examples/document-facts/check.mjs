import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertDocumentFacts, parseDocumentFactsUWX, projectDocumentFacts, parseUWFile, DOCUMENT_FACT_DEFINITIONS, DOCUMENT_FACTS_BINDINGS, renderDocumentFactsLite } from '@uwmd/verify';
const target = parseUWFile(readFileSync(new URL('./target.uwx.md', import.meta.url), 'utf8'));
const sourceFiles = {
  'source:qa-quote': 'sources/quote.txt',
  'source:qa-om': 'sources/offering-memorandum.txt',
  'source:qa-appraisal': 'sources/appraisal.txt',
};
for (const path of Object.values(sourceFiles)) assert.ok(readFileSync(new URL(path, import.meta.url)).length > 0);
const results = [];
for (const name of ['loan-quote', 'offering-memorandum', 'appraisal-abstract']) {
  const profile = `${name}-v1`;
  const doc = JSON.parse(readFileSync(new URL(`./${name}.json`, import.meta.url), 'utf8'));
  const inventory = { source_ids: Object.keys(sourceFiles), conflicting_source_ids: [] };
  assertDocumentFacts(profile, doc, inventory);
  assert.deepEqual(parseDocumentFactsUWX(readFileSync(new URL(`./${name}.uwx.md`, import.meta.url), 'utf8'), inventory).document, doc);
  assert.equal(readFileSync(new URL(`./${name}.view.uw.md`, import.meta.url), 'utf8'), renderDocumentFactsLite(profile, doc, inventory));
  const before = JSON.stringify({ doc, target });
  const result = projectDocumentFacts(profile, doc, target, { source_inventory: inventory, destinations: Object.keys(doc.facts).map(fact => ({ fact, deal_id: 'qa-document-facts-target', section: DOCUMENT_FACT_DEFINITIONS[profile][fact].section, variant: fact.startsWith('debt_structure.') ? 'senior' : null, currency_code: 'USD' })) });
  assert.equal(JSON.stringify({ doc, target }), before);
  results.push({ profile, candidates: result.edits, report: result.report });
}
console.log(JSON.stringify({ synthetic_only: true, applied_edits: 0, bindings: DOCUMENT_FACTS_BINDINGS, results }, null, 2));
