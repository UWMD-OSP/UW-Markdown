import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DOCUMENT_FACT_DEFINITIONS, parseUWFile, buildMeta, getSectionVariant, projectDocumentFacts, validateDocumentFacts, parseDocumentFactsUWX, encodeUWDealPackageZip, decodeUWDealPackageZip, readDocumentFactsPackage, sha256BytesHex, computeEnvelopeDigest, toUWEnvelope } from '../../packages/uwmd-verify/dist/index.js';
const load = name => JSON.parse(readFileSync(new URL(`./${name}.json`, import.meta.url), 'utf8'));
const meta = section => buildMeta(section, 1, { source: 'manual', actor: 'uwmd-fixture', timestamp: '2026-10-01T00:00:00Z' });
const documentSource = (doc, profile = 'loan-quote-v1') => `---\nuw_version: "3.0"\ndocument_profile: ${profile}\ndocument_id: ${doc.document_id}\n---\n\n\`\`\`json uw:section=document_facts\n${JSON.stringify({ _meta: meta('document_facts'), ...doc })}\n\`\`\`\n`;
const target = () => parseUWFile(`---\nuw_version: "3.0"\ndeal_id: qa-target\ncurrency_code: USD\n---\n\`\`\`json uw:section=debt_structure variant=senior\n${JSON.stringify({ _meta: meta('debt_structure'), _role: 'senior' })}\n\`\`\`\n`);
const inventory = doc => ({ source_ids: doc.governing_documents, conflicting_source_ids: [] });
const selection = doc => ({ source_inventory: inventory(doc), destinations: [{ fact: 'debt_structure.loan_amount', deal_id: 'qa-target', section: 'debt_structure', variant: 'senior', currency_code: 'USD' }] });
async function packet(history = false) {
  const doc = load('loan-quote');
  const manifest = { package_version: '1.0', package_id: 'qa:document-facts', members: [], links: [] };
  const payloads = {};
  const evidence = new TextEncoder().encode('Synthetic quote source amount1000000USD fixed0.06 ceiling0.65.');
  payloads['source.txt'] = evidence;
  manifest.members.push({ id: doc.governing_documents[0], role: 'source_evidence', path: 'source.txt', media_type: 'text/plain', sha256: `sha256:${await sha256BytesHex(evidence)}` });
  for (const prior of history ? [true, false] : [false]) {
    const copy = structuredClone(doc);
    const id = prior ? 'prior' : 'current';
    if (prior) copy.document_id = 'quote:qa-prior';
    else if (history) { copy.supersedes = 'quote:qa-prior'; copy.artifact_kind = 'amendment'; }
    const raw = documentSource(copy);
    const bytes = new TextEncoder().encode(raw);
    payloads[`${id}.uwx.md`] = bytes;
    manifest.members.push({ id, role: 'source_note', path: `${id}.uwx.md`, media_type: 'text/markdown', document_profile: 'loan-quote-v1', sha256: `sha256:${await sha256BytesHex(bytes)}`, semantic_digest: await computeEnvelopeDigest(toUWEnvelope(parseUWFile(raw))) });
    manifest.links.push({ from: id, to: doc.governing_documents[0], type: 'abstracts' });
  }
  if (history) manifest.links.push({ from: 'current', to: 'prior', type: 'supersedes' });
  return { manifest, payloads };
}
export async function runNamedControl(name) {
  if (name === 'projection-noop-conflict-exact-variant') {
    const doc = load('loan-quote'); doc.facts = { 'debt_structure.loan_amount': doc.facts['debt_structure.loan_amount'] };
    const dest = target();
    const selected = selection(doc);
    const before = JSON.stringify({ doc, dest, selected });
    assert.equal(projectDocumentFacts('loan-quote-v1', doc, dest, selected).edits.length, 1);
    const wrong = structuredClone(selected); wrong.destinations[0].variant = 'junior';
    assert.deepEqual(projectDocumentFacts('loan-quote-v1', doc, dest, wrong).edits, []);
    assert.equal(JSON.stringify({ doc, dest, selected }), before);
    getSectionVariant(dest, 'debt_structure', 'senior').content.loan_amount = 1000000;
    assert.equal(projectDocumentFacts('loan-quote-v1', doc, dest, selected).report.noops.length, 1);
    getSectionVariant(dest, 'debt_structure', 'senior').content.loan_amount = 2;
    assert.equal(projectDocumentFacts('loan-quote-v1', doc, dest, selected).report.conflicts.length, 1);
  } else if (name === 'amendments-and-governing-conflicts') {
    const doc = load('loan-quote');
    const selected = selection(doc);
    doc.artifact_kind = 'amendment'; doc.supersedes = 'qa-prior';
    assert.deepEqual(projectDocumentFacts('loan-quote-v1', doc, target(), selected).edits, []);
    doc.artifact_kind = 'quote'; selected.source_inventory.conflicting_source_ids = doc.governing_documents;
    assert.deepEqual(projectDocumentFacts('loan-quote-v1', doc, target(), selected).edits, []);
  } else if (name === 'closed-allowlists-and-native-types') {
    const expected = {
      'loan-quote-v1': 'loan_amount loan_purpose loan_type rate_type interest_rate rate_index rate_spread_bps rate_floor_pct amortization_years loan_term_years io_period_months recourse prepayment_type origination_fee_pct exit_fee_pct lender_type'.split(' ').map(k => `debt_structure.${k}`),
      'offering-memorandum-v1': ['property.year_built', 'property.total_units', 'property.total_nra_sqft', 'valuation.appraised_value', 'valuation.appraised_as_of', 'valuation.appraisal_report_date'],
      'appraisal-abstract-v1': ['valuation.appraised_value', 'valuation.appraised_as_of', 'valuation.appraisal_report_date', 'valuation.appraisal_approach', 'valuation.appraisal_cap_rate'],
    };
    for (const [profile, keys] of Object.entries(expected)) {
      assert.deepEqual(Object.keys(DOCUMENT_FACT_DEFINITIONS[profile]).sort(), keys.sort());
      const doc = load(profile.replace(/-v1$/, ''));
      for (const [key, d] of Object.entries(DOCUMENT_FACT_DEFINITIONS[profile])) {
        doc.facts = { [key]: { value: d.kind === 'number' ? 0 : d.kind === 'date' ? '2024-02-29' : d.kind[0], source_ref: { source: doc.governing_documents[0], locator: 'p1 synthetic fact' } } };
        assert.deepEqual(validateDocumentFacts(profile, doc, inventory(doc)), []);
      }
    }
  } else if (name === 'reader-purpose-and-carrier-refusal') {
    const doc = load('loan-quote');
    const raw = documentSource(doc);
    const inv = inventory(doc);
    assert.deepEqual(parseDocumentFactsUWX(raw, inv).document, doc);
    const unknown = raw.replace('loan-quote-v1', 'vendor-purpose-v1');
    assert.equal(parseUWFile(unknown).frontmatter.document_profile, 'vendor-purpose-v1');
    assert.throws(() => parseDocumentFactsUWX(unknown, inv), error => error.code === 'DF-001');
    assert.throws(() => parseDocumentFactsUWX(raw + raw.slice(raw.indexOf('```json')), inv), error => error.code === 'DF-011');
  } else if (name === 'package-byte-semantic-roundtrip-and-tamper') {
    const input = await packet();
    const original = structuredClone(input);
    const decoded = decodeUWDealPackageZip(await encodeUWDealPackageZip(input));
    assert.deepEqual((await readDocumentFactsPackage(decoded, 'current', [])).document, load('loan-quote'));
    assert.deepEqual(input, original);
    decoded.payloads['source.txt'][0] = 0;
    await assert.rejects(readDocumentFactsPackage(decoded, 'current', []), error => error.code === 'PKGVER-002');
    input.manifest.members[1].semantic_digest = `sha256:${'0'.repeat(64)}`;
    await assert.rejects(readDocumentFactsPackage(input, 'current', []), error => error.code === 'PKGVER-003');
  } else if (name === 'package-predecessor-and-async-snapshot') {
    const input = await packet(true);
    assert.equal((await readDocumentFactsPackage(input, 'current', [])).document.supersedes, 'quote:qa-prior');
    input.manifest.links = input.manifest.links.filter(l => l.type !== 'supersedes');
    await assert.rejects(readDocumentFactsPackage(input, 'current', []), error => error.code === 'DF-014');
    const fresh = await packet();
    const pending = readDocumentFactsPackage(fresh, 'current', []);
    fresh.payloads['current.uwx.md'].fill(0);
    assert.deepEqual((await pending).document, load('loan-quote'));
  } else throw new Error('Unknown named document-facts control');
}
