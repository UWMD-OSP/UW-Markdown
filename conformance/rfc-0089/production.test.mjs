// Actual production imports; fixed expectations are retained without regeneration.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { zipSync } from 'fflate';
import * as api from '../../packages/uwmd-verify/dist/index.js';
import { canonicalize as jcs } from '../../packages/uwmd-verify/dist/integrity-canonical.js';
import { readJSON } from '../../packages/uwmd-verify/dist/carrier-values.js';
const json = path => JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const packet = json('./cases.json');
const cases = [...packet.source_cases,...packet.direct_models];
test('native complete JSON/XML/CSV/actual STORE and DEFLATE preserve fixed models and digests',async()=>{
  for(const item of cases){
    const expected={...item.expected_model,semantic_digest:item.expected_digest};
    const bundle=await api.encodeUWCSVBundle(expected);
    const store=zipSync(Object.fromEntries(Object.entries(bundle.files).map(([k,v])=>[k,[Buffer.from(v),{level:0,mtime:new Date('1980-01-02T00:00:00Z')}]])));
    const values=[await api.UW_JSON_CODEC.decode(await api.UW_JSON_CODEC.encode(expected)),await api.parseUWXml(await api.stringifyUWXml(expected)),await api.decodeUWCSVBundle(bundle),await api.decodeUWCSVZip(store),await api.decodeUWCSVZip(await api.encodeUWCSVZip(expected))];
    for(const model of values){ // JCS identifies signed zero with zero, as in the frozen original control.
    assert.equal(jcs(model),jcs(expected),item.name);assert.equal(api.canonicalizeUWEnvelope(model),item.expected_preimage,item.name); }
  }
});
for(const name of ['closure-xml-cases.json','rereview-xml-cases.json']) test('native XML fixed independent '+name,async()=>{
  for(const item of json('./independent/'+name)){
    if(item.expected==='refused') await assert.rejects(()=>api.parseUWXml(item.text),item.name);
    else assert.equal(api.canonicalizeUWEnvelope(await api.parseUWXml(item.text)),item.preimage,item.name);
  }
});
test('JSON decoded duplicate names never enter the model',()=>{
  for(const text of ['{"a":1,"a":2}','{"a":1,"\\u0061":2}','{"x":{"a":1,"a":2}}']) assert.throws(()=>readJSON(text),/duplicate/);
  assert.throws(()=>readJSON('{"x":1e999}'),/nonfinite/);
});

test('native F3 fixed independent CSV descriptors refuse grammar before semantic digest',async()=>{
  for(const item of json('./independent/rereview-csv-cases.json')){
    if(item.expected === 'accepted') assert.equal(api.canonicalizeUWEnvelope(await api.decodeUWCSVBundle({files:item.files})),item.preimage,item.name);
    else await assert.rejects(()=>api.decodeUWCSVBundle({files:item.files}),error=>item.expected === 'overlap' ? /empty\/nonempty overlap/.test(error.message) : !/semantic digest/.test(error.message),item.name);
  }
});
