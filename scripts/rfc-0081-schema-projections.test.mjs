import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { projectModuleContract, projectCaseContract, projectCorpusContract } from './rfc-0081-schema-projections.mjs';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = path => JSON.parse(read(path));
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats.default(ajv);
for (const name of ['module-signature', 'expense-targeted-capex', 'uwmd-block']) ajv.addSchema(json(`spec/schemas/${name}.schema.json`));
const check = name => ajv.getSchema(`https://uwmd.org/schemas/${name}.schema.json`) ?? ajv.compile(json(`spec/schemas/${name}.schema.json`));
const meta = {
  section: 'property', provenance: { source: 'manual', actor: 'analyst', timestamp: '2026-10-11T00:00:00Z' },
  quality: { confidence: 'high', human_review_required: false }, lifecycle: { revision: 1, superseded: false },
};
test('Format 3.0 bare block permits ordinary content and rejects either retired shape', () => {
  const validate = check('uwmd-block');
  for (const content of ['payload text', 42, null, { section_id: 'a payload member inside content' }]) {
    assert.ok(validate({ _meta: meta, content }), JSON.stringify(validate.errors));
  }
  assert.equal(validate({ section_id: 'property', _meta: meta, content: {} }), false);
  assert.equal(validate({ _meta: { section: 'property', source: 'manual', version: 1, superseded: false } }), false);
  assert.equal(validate({ _meta: { ...meta, section_id: 'property' } }), false);
  const missingSection = structuredClone(meta); delete missingSection.section;
  assert.equal(validate({ _meta: missingSection }), false);
  assert.equal(validate({ _meta: { ...meta, provenance: { ...meta.provenance, resolution: 'manual' } } }), false);
  assert.equal(validate({ _meta: { ...meta, provenance: { ...meta.provenance, source: 'user_input' } } }), false);
  assert.equal(validate({ _meta: { ...meta, provenance: { ...meta.provenance, resolution: 'invented' } } }), false);
  const sample = json('spec/schemas/uwmd-block.schema.json').examples[0];
  assert.equal(Object.keys(sample)[0], '_meta');
  assert.ok(validate(sample));
});
test('G1 lone-fact groups admit facts alone and reject every partial group', () => {
  const terms = { notional: 100, index: 'sofr', effective_date: '2026-01-01', expiration_date: '2027-01-01', post_expiration_assumption: 'unhedged' };
  const strike = { instrument: 'rate_cap', strike_rate: 0.035 };
  const cap = check('debt-rate-hedge');
  assert.ok(cap(strike)); assert.ok(cap({ ...strike, premium: 410000 })); assert.ok(cap({ ...strike, ...terms }));
  for (const key of Object.keys(terms)) {
    assert.equal(cap({ ...strike, [key]: terms[key] }), false, key);
    const partial = { ...strike, ...terms }; delete partial[key]; assert.equal(cap(partial), false, key);
  }
  assert.equal(cap({ ...strike, replacement_funding: { mode: 'escrow' } }), false);
  // null states nothing in every G1 group (ESC-04 absent/null precedent).
  assert.ok(cap({ ...strike, replacement_funding: null })); assert.ok(cap({ ...strike, ...terms, replacement_funding: null }));
  assert.equal(cap({ ...strike, premium: -1 }), false);
  const draw = { contingency_used: 1, drawn_to_date: 2, as_of_date: '2026-10-11' };
  const renovation = check('renovation-draw');
  assert.ok(renovation({ budget: 4000000 })); assert.ok(renovation({ contingency: 500000 }));
  assert.ok(renovation({ budget: 4, contingency: 3, ...draw, contingency_remaining: 2 }));
  for (const key of Object.keys(draw)) {
    assert.equal(renovation({ budget: 4, contingency: 3, [key]: draw[key] }), false, key);
    const partial = { budget: 4, contingency: 3, ...draw }; delete partial[key]; assert.equal(renovation(partial), false, key);
  }
  for (const key of ['budget', 'contingency']) { const partial = { budget: 4, contingency: 3, ...draw }; delete partial[key]; assert.equal(renovation(partial), false); }
  assert.equal(renovation({}), false); assert.equal(renovation({ budget: 4, contingency_remaining: 2 }), false);
  assert.ok(renovation({ budget: 4, contingency_remaining: null })); assert.equal(renovation({ contingency_remaining: null }), false);
  const recovery = check('lease-recovery-terms');
  // REC-02 (owner decision): a lone cap needs no accumulation; once method is stated it does.
  assert.ok(recovery({ cap: { pct: 0.05 } }));
  assert.ok(recovery({ method: 'net', cap: { pct: 0.05, accumulation: 'cumulative' } }));
  assert.equal(recovery({ method: 'net', cap: { pct: 0.05 } }), false);
  assert.equal(recovery({ method: 'net', cap: { pct: 0.05, accumulation: null } }), false);
  assert.ok(recovery({ method: 'net', cap: { pct: null } }));
  const stated = { pro_rata_share: 0.1, share_basis: 'nra', base_year: 2024, expense_stop_per_sqft: 5, fixed_recovery_annual: 100, admin_fee_pct: 0.1, gross_up_pct: 0.95, recoverable_pool: ['taxes'] };
  assert.deepEqual(Object.keys(stated).sort(), Object.keys(json('spec/schemas/lease-recovery-terms.schema.json').properties).filter(k => !['method', 'cap'].includes(k)).sort());
  for (const [key, value] of Object.entries(stated)) {
    assert.equal(recovery({ cap: { pct: 0.05 }, [key]: value }), false, key); // a stated member needs method
    assert.ok(recovery({ cap: { pct: 0.05 }, [key]: null }), key); // null states nothing (ESC-04 absent/null precedent)
    assert.ok(recovery({ method: 'net', [key]: value }), key);
  }
  assert.equal(recovery({ cam_cap_pct: 0.05 }), false);
  const assessment = { assessed_value: 100, millage_rate: 0.01, indicated_tax: 1 };
  const tax = check('tax-reassessment');
  assert.ok(tax({ trigger: 'sale' })); assert.ok(tax({ trigger: 'sale', ...assessment }));
  for (const key of Object.keys(assessment)) {
    assert.equal(tax({ trigger: 'sale', [key]: assessment[key] }), false, key);
    const partial = { trigger: 'sale', ...assessment }; delete partial[key]; assert.equal(tax(partial), false, key);
  }
  for (const [key, value] of Object.entries({ jurisdiction: 'Maricopa', value_basis: 100, assessment_ratio: 1, round_to_decimals: 2 })) {
    assert.equal(tax({ trigger: 'sale', [key]: value }), false, key);
    assert.ok(tax({ trigger: 'sale', [key]: null }), key); // null states nothing
    assert.ok(tax({ trigger: 'sale', ...assessment, [key]: value }), key);
  }
  assert.equal(tax({ trigger: 'sale', sale_triggers_reassessment: true }), false);
});
test('G3 hotel section has exactly one optional fact, and receipt 1.1 is the only admitted version', () => {
  const hotel = check('section-hotel-metrics');
  assert.ok(hotel({})); assert.ok(hotel({ market_revpar: null })); assert.ok(hotel({ market_revpar: 100 }));
  for (const key of ['adr', 'occupancy', 'available_room_nights', 'key_count']) assert.equal(hotel({ [key]: 1 }), false, key);
  // The hotel facts' single home: the hospitality rent_roll (Format §4.3 Hospitality Variant).
  const rooms = check('rent-roll-hospitality');
  const nights = { available_room_nights: 29200 };
  assert.ok(rooms(nights));
  assert.ok(rooms({ ...nights, occupied_room_nights: 21024, adr: 180, occupancy: 0.72, rent_roll_type: 'hospitality', segmentation: [] }));
  assert.equal(rooms({ adr: 180, occupancy: 0.72 }), false); // available_room_nights is required (CLS-04)
  assert.equal(rooms({ ...nights, keys: 80 }), false); // key count lives only in property.keys
  for (const [key, value] of [['available_room_nights', 1.5], ['available_room_nights', -1], ['occupied_room_nights', 0.5], ['adr', -1], ['occupancy', 1.2], ['occupancy', -0.1]]) {
    assert.equal(rooms({ ...nights, [key]: value }), false, `${key}=${value}`);
  }
  const schema = json('spec/schemas/uw-receipt.schema.json');
  assert.deepEqual(schema.properties.receipt_version, { const: '1.1', description: schema.properties.receipt_version.description });
});
test('final module schema rejects old vocabulary; phase projection never hides invalid values', () => {
  const validate = check('module-manifest');
  const base = { manifest_version: '1', id: 'com.example.specialty', name: 'Specialty', version: '1.0.0', description: 'Private class', authors: ['Example'], license: 'MIT', requires_protocol: '^4.0.0', requires_format: '^3.0' };
  for (const tier of ['reader', 'verifier']) assert.ok(validate({ ...base, requires_conformance: tier, requires_profiles: ['module'] }));
  assert.equal(validate({ ...base, requires_tier: 'tier-3-calc-host' }), false);
  assert.equal(validate({ ...base, requires_conformance: 'oracle' }), false);
  assert.equal(validate({ ...base, requires_conformance: 'verifier', requires_profiles: ['unknown'] }), false);
  assert.equal(validate({ ...base, requires_conformance: 'verifier', requires_profiles: ['module', 'module'] }), false);
  assert.ok(validate(projectModuleContract({ ...base, requires_tier: 'tier-3-calc-host' })));
  for (const value of ['unknown', null, 3, {}, []]) assert.equal(validate(projectModuleContract({ ...base, requires_tier: value })), false);
  assert.equal(validate(projectModuleContract({ ...base, requires_tier: 'tier-3-calc-host', unknown: true })), false);
  assert.equal(validate(projectModuleContract({ ...base, requires_tier: 'tier-3-calc-host', requires_profiles: ['unknown'], calculations: [{ id: 'x', formula: '1' }] })), false);
});
test('case projections remove only the obsolete reconciliation bookkeeping', () => {
  const corpus = json('conformance/corpus-index.json');
  const projected = projectCorpusContract(corpus);
  assert.equal(projected.cases.length, corpus.cases.length);
  assert.deepEqual(projected.cases.map(c => [c.suite, c.scenario, c.target]), corpus.cases.map(c => [c.suite, c.scenario, c.target]));
  const caseValue = { legacy_id: 'old', id: 'new', target: 'verifier', assertion: 'kept' };
  assert.deepEqual(projectCaseContract(caseValue), { id: 'new', target: 'verifier', assertion: 'kept' });
});
test('single specification files, all 34 starter stubs gone, and every historical spec link maps at build time', () => {
  const format = read('spec/UW_FORMAT_SPEC.md'); const protocol = read('spec/UW_PROTOCOL.md');
  assert.match(format, /Format 3\.0/); assert.match(protocol, /protocol \*\*4\.0\.0\*\*/);
  assert.doesNotMatch(protocol, /\*Moved to the non-normative/);
  assert.ok(format.indexOf('### 4.29') < format.indexOf('## Part V'));
  assert.ok(format.indexOf('### 4.35') < format.indexOf('## Part V'));
  const build = read('tools/docs-site/scripts/prebuild.mjs');
  for (const old of ['UW_FORMAT_SPEC_v1.md', 'UW_FORMAT_SPEC_v2.md', ...['PROTOCOL', 'LITE_SPEC', 'RECEIPT', 'XML_MAPPING', 'CSV_BUNDLE', 'COMPOSITION'].map(n => `UW_${n}_v1.md`)]) {
    assert.ok(build.includes(`['${old}', '/spec/`), old); assert.ok(build.includes(`['spec/${old}', '/spec/`), old);
    assert.ok(!build.includes(`from: 'spec/${old}'`), old);
  }
  assert.doesNotMatch(build, /\/spec\/format-v2/);
  assert.ok(build.includes("await rm(join(SITE_ROOT, 'spec', 'format-v2.md'), { force: true })"));
  for (const file of ['docs/ABOUT.md', 'docs/downloads/llms.txt', 'docs/downloads/llms-full.txt', 'tools/docs-site/ai/index.md', 'tools/docs-site/tutorials/quickstart.md', 'tools/docs-site/tutorials/your-first-uwmd-file.md', 'tools/docs-site/.vitepress/theme/HomePage.vue']) {
    assert.doesNotMatch(read(file), /\/spec\/format-v2/, file);
  }
});

test('every Format example carries nested metadata naming its own section, valid against the block schema', () => {
  const format = read('spec/UW_FORMAT_SPEC.md');
  const validateMeta = ajv.getSchema('https://uwmd.org/schemas/uwmd-block.schema.json#/$defs/UWMeta');
  const validateBlock = check('uwmd-block');
  const lines = format.split('\n');
  const offsets = [];
  for (let i = 0, at = 0; i < lines.length; at += lines[i].length + 1, i++) offsets.push(at);
  const lineAt = index => { let lo = 0; let hi = offsets.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (offsets[mid] <= index) lo = mid; else hi = mid - 1; } return lo; };
  // The section an example belongs to: its fence annotation, else the **ID:** of the
  // enclosing registry entry. Template ids such as x_{user_defined_id} are skipped.
  const expectedSection = line => {
    let fence = line; while (fence >= 0 && !lines[fence].startsWith('```')) fence--;
    const annotated = lines[fence]?.match(/uw:section=(\S+)/)?.[1];
    if (annotated) return { fence, section: annotated };
    let id = line; while (id >= 0 && !/^\*\*ID:\*\*/.test(lines[id]) && !/^#{2,3} /.test(lines[id])) id--;
    return { fence, section: lines[id]?.match(/^\*\*ID:\*\*\s*`([^`]+)`/)?.[1] };
  };
  const registryStart = lines.indexOf('## Part IV — Section Registry');
  assert.ok(registryStart > 0);
  let count = 0; let wholeBlocks = 0;
  for (const match of format.matchAll(/"_meta":\s*\{/g)) {
    const start = match.index + match[0].lastIndexOf('{');
    let depth = 0;
    let quoted = false;
    let escaped = false;
    let end = start;
    for (; end < format.length; end++) {
      const c = format[end];
      if (quoted) {
        if (escaped) escaped = false;
        else if (c === '\\') escaped = true;
        else if (c === '"') quoted = false;
      } else if (c === '"') quoted = true;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) break;
    }
    const line = lineAt(start);
    const value = JSON.parse(format.slice(start, end + 1));
    assert.ok(validateMeta(value), `example _meta at line ${line + 1}: ${JSON.stringify(validateMeta.errors)}`);
    const { fence, section } = expectedSection(line);
    // Part II illustrations (§2.5) name no registry entry; every Part IV example does.
    if (line > registryStart) assert.ok(section, `example at line ${line + 1} has no section identity`);
    if (section && !section.includes('{')) assert.equal(value.section, section, `example at line ${line + 1}`);
    // When the whole fenced object is literal JSON, it must also be a valid Format 3.0 block.
    let close = fence + 1; while (close < lines.length && !lines[close].startsWith('```')) close++;
    let block;
    try { block = JSON.parse(lines.slice(fence + 1, close).join('\n')); } catch { block = undefined; }
    if (block && typeof block === 'object' && '_meta' in block) {
      assert.equal(Object.keys(block)[0], '_meta', `example at line ${line + 1}`);
      assert.ok(validateBlock(block), `example block at line ${line + 1}: ${JSON.stringify(validateBlock.errors)}`);
      wholeBlocks++;
    }
    count++;
  }
  assert.equal(count, 30);
  assert.ok(wholeBlocks > 0);
});
