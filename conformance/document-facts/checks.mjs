import { runNamedControl } from './controls.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateDocumentFacts, parseDocumentFactsJSON, renderDocumentFactsLite, parseUWLite, compileUWLite, DOCUMENT_FACT_DEFINITIONS, projectDocumentFacts, parseUWFile, buildMeta } from '../../packages/uwmd-verify/dist/index.js';
export const cases = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url), 'utf8'));
export async function checkDocumentFactsCase(c) {
  const before = JSON.stringify(c);
  if (c.operation === 'validate') {
    assert.deepEqual(validateDocumentFacts(c.profile, c.document, c.source_inventory).map(e => e.code), c.expected_codes);
    if (c.expected_codes.length === 0) {
      const source = `---\nuw_version: "3.0"\ndeal_id: qa-conformance-fact-target\ncurrency_code: USD\n---\n${['property', 'valuation', 'debt_structure'].map(section => `\n\`\`\`json uw:section=${section}${section === 'debt_structure' ? ' variant=senior' : ''}\n${JSON.stringify({ _meta: buildMeta(section, 1, { source: 'manual', actor: 'uwmd-fixture', timestamp: '2026-10-01T00:00:00Z' }) })}\n\`\`\`\n`).join('')}`;
      const target = parseUWFile(source);
      const original = JSON.stringify(target);
      const selection = { source_inventory: c.source_inventory, destinations: Object.keys(c.document.facts).map(fact => ({ fact, deal_id: 'qa-conformance-fact-target', section: DOCUMENT_FACT_DEFINITIONS[c.profile][fact].section, variant: fact.startsWith('debt_structure.') ? 'senior' : null, currency_code: 'USD' })) };
      const result = projectDocumentFacts(c.profile, c.document, target, selection);
      assert.deepEqual(result.edits.map(e => e.fact), Object.keys(c.document.facts).filter(k => c.document.facts[k].value !== null).sort());
      for (const e of result.edits) { assert.deepEqual(e.value, c.document.facts[e.fact].value); assert.deepEqual(e.source_ref, c.document.facts[e.fact].source_ref); }
      assert.equal(JSON.stringify(target), original);
      const refused = projectDocumentFacts(c.profile, c.document, target, { ...selection, destinations: selection.destinations.map(d => ({ ...d, currency_code: 'EUR' })) });
      assert.deepEqual(refused.edits, []);
      assert.ok(result.edits.every(e => !['purchase_price', 'underwritten_value', 'ltv', 'net_operating_income'].includes(e.field)));
    }
  } else if (c.operation === 'raw') {
    assert.throws(() => parseDocumentFactsJSON(c.profile, readFileSync(new URL(c.file, import.meta.url), 'utf8'), c.source_inventory), error => error.code === c.expected_code);
  } else if (c.operation === 'view') {
    const view = renderDocumentFactsLite(c.profile, c.document, c.source_inventory);
    assert.ok(view.includes(JSON.stringify(c.document, null, 2)));
    const result = compileUWLite(parseUWLite(view));
    assert.equal(result.ok, false);
    assert.ok(result.report.issues.some(i => i.code === 'LITE_COMPILE_DOCUMENT_PROFILE_UNSUPPORTED'));
  } else if (c.operation === 'control') await runNamedControl(c.id);
  else throw new Error('Unknown document-facts conformance operation');
  assert.equal(JSON.stringify(c), before);
}
