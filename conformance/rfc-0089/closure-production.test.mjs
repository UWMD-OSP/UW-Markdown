// Adapted independent closure probes: unchanged 48 stamping/six storage expectations.
// Changes: production imports, output folder, and failing assertions on accumulated results.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {test} from 'node:test';
import {production as candidate} from './runtime.mjs';
import {stamp} from '../../packages/uwmd-verify/dist/carrier-values.js';
import {canonicalizeUWEnvelope as preimage} from '../../packages/uwmd-verify/dist/envelope.js';
import * as lake from '../../packages/uwmd-lake/dist/index.js';
const m={stamp,preimage};
fs.mkdirSync(new URL('../../node_modules/.cache/rfc0089-production-evidence/',import.meta.url),{recursive:true});
test('independent closure stamping and lake captures on production',async()=>{
const independentCanon=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(independentCanon).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+independentCanon(v[k])).join(',')+'}';
const independentSubject=v=>Object.fromEntries(Object.entries(v).filter(([k])=>!['generated_at','generator','semantic_digest'].includes(k)));
const base=JSON.parse(fs.readFileSync(new URL('./cases.json',import.meta.url))).source_cases[0].expected_model;
const stampResults=[];
for(const [api,fn] of [['generated',candidate.envelope.stampEnvelopeDigest],['carrier',m.stamp]]) {
  for(const key of ['outer','generator','generated_at','semantic_digest']) for(const enumerable of [true,false]) for(const selfDelete of [false,true]) {
    const value=structuredClone(base);let calls=0;Object.defineProperty(value,key,{enumerable,configurable:true,get(){calls++;if(selfDelete)delete value[key];return 'synthetic';}});
    let refused=false;try{await fn(value);}catch{refused=true;}
    stampResults.push({api,key,enumerable,selfDelete,refused,calls,pass:refused&&calls===0});
  }
  for(const bad of ['undefined','function','symbol','hole','array-extra','nested-getter']) {
    const value=structuredClone(base);let calls=0;
    if(bad==='undefined'||bad==='function')Object.defineProperty(value,'hidden',{value:bad==='function'?()=>1:undefined});
    if(bad==='symbol')value[Symbol('synthetic')]=1;
    if(bad==='hole')value.outer=Array(1);
    if(bad==='array-extra'){value.outer=[];value.outer.extra=1;}
    if(bad==='nested-getter'){value.outer={};Object.defineProperty(value.outer,'x',{enumerable:true,get(){calls++;return 1;}});}
    let refused=false;try{await fn(value);}catch{refused=true;}
    stampResults.push({api,bad,refused,calls,pass:refused&&calls===0});
  }
  for(const frozen of [false,true]){const value=structuredClone(base);value.outer=[null,{json:true}];if(frozen){Object.freeze(value.outer[1]);Object.freeze(value.outer);Object.freeze(value);}const result=await fn(value);const d='sha256:'+createHash('sha256').update(independentCanon(independentSubject(result))).digest('hex');stampResults.push({api,frozen,pass:result.semantic_digest===d&&m.preimage(result)===m.preimage(value)});}
}
fs.writeFileSync(new URL('../../node_modules/.cache/rfc0089-production-evidence/closure-stamping.json',import.meta.url),JSON.stringify(stampResults,null,2));

const capture=[];
for(const digest of ['sha256:'+'4'.repeat(64),'sha256:'+'5'.repeat(64),'synthetic-opaque-unverified']) for(const id of ['synthetic-a','synthetic-b']) {
  const evidence={semantic_digest:digest,evidence_id:id,reference:{value:'synthetic'}};
  const planned=await lake.planLakeLoad({schema:'synthetic',source_evidence:[evidence]});const queries=[];
  const count=await lake.executeLakeLoad(planned,{query:async(sql,params)=>queries.push({sql,params})});
  assert.equal(count,1);assert.deepEqual(queries,planned.statements);assert.deepEqual(queries[0],lake.planSourceEvidence('synthetic',evidence));
  assert.deepEqual(queries[0].params.slice(0,2),[digest,id]);assert.ok(queries[0].sql.includes('ON CONFLICT (semantic_digest, evidence_id)'));
  assert.deepEqual(JSON.parse(queries[0].params[7]),evidence);capture.push({digest,id,queries,pass:true});
}
// Analogous supplied-identity reader routes must preserve, rather than authenticate, the supplied key.
const opaque='synthetic-opaque-unverified';
const fact=lake.readBlockValuesCSV('block_ref,scope,pointer,json_type,value_json\nsynthetic,content,/x,number,1\n',{semantic_digest:opaque})[0];
const jsonl=lake.readBatchFactJSONL(JSON.stringify(fact))[0];
assert.equal(fact.semantic_digest,opaque);assert.equal(jsonl.semantic_digest,opaque);
const factPlan=await lake.planLakeLoad({facts:[jsonl],schema:'synthetic'});assert.equal(factPlan.statements[0].params[0],opaque);
fs.writeFileSync(new URL('../../node_modules/.cache/rfc0089-production-evidence/closure-lake-capture.json',import.meta.url),JSON.stringify({captures:capture,analogous_fact_reader_pass:true,scope:'In-memory propagation/storage, no DB and no fresh verification'},null,2));

assert.equal(stampResults.length,48); assert.ok(stampResults.every(row=>row.pass)); assert.equal(capture.length,6);

});
