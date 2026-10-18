// RFC0089 selected direction only. No production schema, decoder or validator changes.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { subject, validate as semanticAdmission } from '../empty-collections/independent.mjs';
const require = createRequire(import.meta.url);
const Ajv = require('ajv/dist/2020.js').default;
const addFormats = require('ajv-formats').default;
const schemas = new URL('../../../spec/schemas/', import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(name, schemas), 'utf8'));
const clone = value => structuredClone(value);
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
for (const name of readdirSync(schemas).filter(name => name.endsWith('.schema.json'))) {
  const value = read(name);
  if (!ajv.getSchema(value.$id)) ajv.addSchema(value);
}
// In-memory two-field structural delta ONLY; no edits to spec/schemas.
const original = read('uw-document-envelope.schema.json');
const candidate = clone(original);
candidate.$id = 'urn:uwmd:unaccepted:rfc0089:model-admission';
candidate.properties.envelope_version = { const: 'E_NEXT' };
candidate.properties.extensions.additionalProperties = {
  oneOf: [
    { type: 'object', required: ['mode', 'block'], additionalProperties: false,
      properties: { mode: { const: 'single' }, block: { $ref: '#/$defs/block' } } },
    { type: 'object', required: ['mode', 'blocks'], additionalProperties: false,
      properties: { mode: { const: 'variants' }, blocks: { type: 'array', minItems: 1,
        items: { type: 'object', required: ['variant', 'block'], additionalProperties: false,
          properties: { variant: { type: ['string', 'null'] }, block: { $ref: '#/$defs/block' } } } } } },
  ],
};
const schemaAdmission = ajv.compile(candidate);
const stamp = model => ({ ...model, semantic_digest: subject(model) });
function block(section, variant, history = false) {
  return { annotation: { section, ...(variant === undefined ? {} : { variant }), ...(history ? { superseded: true } : {}) },
    content: { _meta: { section,
      provenance: { source: 'manual', actor: 'rfc0089.synthetic-admission-test', timestamp: '2026-10-17T00:00:00Z' },
      quality: { confidence: 'high', human_review_required: false },
      lifecycle: { revision: 1, superseded: history } },
    _notes: null, _overrides: [], ordinary: { null: null, empty: {}, array: [], number: 1.5 } },
    prose: 'complete authored synthetic model', x_block_extra: { retained: true } };
}
function complete() {
  const unlabelled = block('x_review'); unlabelled.content._role = 'primary';
  return stamp({ envelope_version: 'E_NEXT', format_version: '3.0',
    frontmatter: { uw_version: '3.0', deal_id: 'rfc0089-new-admission-control', deal_name: 'Synthetic complete admission control' },
    sections: { property: block('property'), operating_statement: { t12: block('operating_statement', 't12') } },
    pipeline_log: [block('pipeline_log')], custom_calculations: [block('custom_calculations')], custom_scenarios: [block('custom_scenarios')],
    extensions: { x_review: { mode: 'variants', blocks: [
      { variant: null, block: unlabelled }, { variant: 'default', block: block('x_review', 'default') }] },
    x_single: { mode: 'single', block: block('x_single') } },
    superseded: { x_review: [block('x_review', undefined, true), block('x_review', 'default', true)], x_empty: [] },
    x_outer: { unknown: 'retained', absent_is_not_null: null } });
}
const allBlocks = model => [model.sections.property, model.sections.operating_statement.t12,
  ...model.pipeline_log, ...model.custom_calculations, ...model.custom_scenarios,
  ...model.extensions.x_review.blocks.map(record => record.block), model.extensions.x_single.block,
  ...model.superseded.x_review];
function admit(model) {
  assert.equal(schemaAdmission(model), true, JSON.stringify(schemaAdmission.errors));
  return semanticAdmission(model);
}

test('in-memory schema delta leaves every unrelated original requirement unchanged', () => {
  const expected = clone(original);
  expected.$id = candidate.$id;
  expected.properties.envelope_version = candidate.properties.envelope_version;
  expected.properties.extensions = candidate.properties.extensions;
  assert.deepEqual(candidate, expected);
  assert.deepEqual(read('uw-document-envelope.schema.json'), original);
  assert.equal(candidate.$defs.variantMap.minProperties, 1);
});

test('complete authored ten-block value passes both schema and selected semantic guards without mutation', () => {
  const model = complete(); const before = clone(model);
  assert.equal(allBlocks(model).length, 10);
  assert.equal(admit(model), model);
  assert.deepEqual(admit(JSON.parse(JSON.stringify(model))), model);
  assert.deepEqual(model, before);
  assert.equal(model.extensions.x_single.block.x_block_extra.retained, true);
  assert.equal(model.superseded.x_review.length, 2);
});

test('accepted actor/review/lifecycle shapes are enforced on all ten retained model blocks', () => {
  for (let index = 0; index < 10; index++) for (const alter of [
    meta => { delete meta.provenance.actor; }, meta => { meta.provenance.actor = ''; },
    meta => { meta.provenance.actor = null; }, meta => { delete meta.quality.human_review_required; },
    meta => { meta.quality.human_review_required = 'false'; }, meta => { delete meta.lifecycle.superseded; },
    meta => { meta.lifecycle.superseded = 0; }, meta => { meta.quality = []; },
  ]) {
    const model = complete(); alter(allBlocks(model)[index].content._meta);
    assert.equal(schemaAdmission(model), false, `block ${index} schema predicate`);
  }
});

test('closed wrappers and exact selected identity/state guards refuse after valid restamping', () => {
  const cases = [
    [model => { model.extensions.x_single.extra = true; }, 'schema'],
    [model => { model.extensions.x_review.blocks[0].extra = true; }, 'schema'],
    [model => { model.extensions.x_review.blocks = []; }, 'schema'],
    [model => { model.extensions.x_review.blocks[1].variant = null; }, 'semantic'],
    [model => { model.extensions.x_review.blocks.reverse(); }, 'semantic'],
    [model => { model.extensions.x_review.blocks[0].block.annotation.variant = null; }, 'schema'],
    [model => { model.extensions.x_single.block.annotation.section = 'x_other'; }, 'semantic'],
    [model => { model.extensions.x_single.block.content._meta.section = 'x_other'; }, 'semantic'],
    [model => { model.extensions.x_single.block.content._meta.lifecycle.superseded = true; }, 'semantic'],
    [model => { model.superseded.x_review[1].content._meta.lifecycle.superseded = false; }, 'semantic'],
  ];
  for (const [alter, layer] of cases) {
    const model = complete(); alter(model); const changed = stamp(model);
    assert.equal(schemaAdmission(changed), layer !== 'schema', `named ${layer} refusal layer`);
    if (layer === 'semantic') assert.throws(() => semanticAdmission(changed));
    assert.throws(() => admit(changed));
  }
});

test('complete JSON domain preserves valid unknown Unicode/numbers and refuses nonfinite/lone surrogates', () => {
  const model = complete(); model.x_outer['nul\u0000name'] = ['\u0000', '\ufffe', '\uffff', 'e\u0301', '\u{1f600}', Number.MIN_VALUE, Number.MAX_VALUE, -0];
  const changed = stamp(model); assert.equal(admit(changed), changed);
  for (const bad of [Number.POSITIVE_INFINITY, Number.NaN, '\ud800', '\udfff']) {
    const invalid = complete(); invalid.x_outer.bad = bad;
    assert.throws(() => stamp(invalid));
  }
});

test('schema versus full admission limits are explicit: empty variants and conditional provenance', () => {
  const model = complete(); model.sections.valuation = {};
  assert.equal(schemaAdmission(model), false);
  assert(schemaAdmission.errors.some(error => error.keyword === 'minProperties'));
  // Existing codec can carry this wider value; that is not schema authority.
  assert.equal(semanticAdmission(stamp(model)).sections.valuation !== undefined, true);
  for (const change of [
    meta => { meta.provenance.source = 'agent/research'; },
    meta => { meta.provenance.resolution = 'market_data_accepted'; },
    meta => { meta.provenance.resolution = 'inherited_assumption'; },
  ]) {
    const conditional = complete(); change(conditional.extensions.x_single.block.content._meta);
    // Current schema describes these conditional requirements but does not encode them.
    assert.equal(schemaAdmission(conditional), true);
  }
});
