import assert from 'node:assert/strict';
import {after,before,test} from 'node:test';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash,createPrivateKey,createPublicKey,sign,verify} from 'node:crypto';
import * as api from '../../../packages/uwmd-verify/dist/index.js';
import {verifyReceipt as proposal} from './proposal.mjs';
import {clear,phases} from './runtime.mjs';
const sha=data=>createHash('sha256').update(data).digest('hex');
const source=readFileSync(new URL('../../../conformance/receipts/issue/01-uwx-multifamily/deal.uwx.md',import.meta.url),'utf8');
const seed=Buffer.from('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f','hex');
const privateKey=createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),seed]),format:'der',type:'pkcs8'});
const publicKey=createPublicKey(privateKey);
const pack={...api.getPackForAssetClass('multifamily'),id:'research.rfc0088.authentication',version:'0.0.0-unaccepted',calculations:[{id:'research_scalar',label:'Synthetic stage-control scalar',formula:'1+1',deterministic:true,round_to:12}]};
// Deliberately different supplied declaration is a controlled recomputation-failure
// context, not an assertion that one published pack legitimately changes in place.
const refusingPack={...pack,calculations:[{...pack.calculations[0],formula:'irr(1,1)'}]};
const identity={engine:api.VERIFY_PACKAGE_NAME,engine_version:'research-authenticate-first'};
const rows=[];
let issued;
function signed(receipt){
  const result=structuredClone(receipt);
  result.signature={algorithm:'ed25519',key_id:'public-research-key-no-trust',value:sign(null,Buffer.from(api.receiptSigningPayload(result)),privateKey).toString('base64')};
  assert.equal(verify(null,Buffer.from(api.receiptSigningPayload(result)),publicKey,Buffer.from(result.signature.value,'base64')),true);
  return result;
}
function invalid(receipt){const result=signed(receipt);const bytes=Buffer.from(result.signature.value,'base64');bytes[0]^=1;result.signature.value=bytes.toString('base64');return result;}
function projected(result){return {verdict:result.verdict,codes:result.issues.map(i=>i.code),has_recomputed:Object.hasOwn(result,'recomputed')};}
async function run(id,{receipt=signed(issued),content=source,packs=[pack],inputs={},backend='valid',expected,expectedPhases,expectedBackend=0,baseline=false}={}){
  const beforeReceipt=JSON.stringify(receipt);const beforeSource=sha(content);const calls=[];
  const options={...identity,packs,inputs};
  if(backend!=='missing')options.signatureVerifier={verify:async(actual,payload)=>{
    calls.push({payload_sha256:sha(payload),receipt_sha256:sha(JSON.stringify(actual))});
    if(backend==='throws')throw new Error('research-backend-transport');
    return verify(null,Buffer.from(payload),publicKey,Buffer.from(actual.signature.value,'base64'));
  }};
  clear();let result;let thrown;
  try{result=await (baseline?api.verifyReceipt:proposal)(receipt,content,options);}catch(error){thrown={name:error.name,message:error.message};}
  const row={id,mode:baseline?'current':'proposal',result:result?projected(result):null,thrown:thrown??null,phases:[...phases],backend_calls:calls.length,receipt_unchanged:JSON.stringify(receipt)===beforeReceipt,source_unchanged:sha(content)===beforeSource};
  rows.push(row);assert.equal(row.receipt_unchanged,true,id);assert.equal(row.source_unchanged,true,id);
  assert.deepEqual(row.result,expected??null,id);assert.deepEqual(row.phases,expectedPhases??[],id);assert.equal(calls.length,expectedBackend,id);return row;
}
before(async()=>{issued=await api.issueReceipt(source,{pack,...identity,issued_at:'2026-10-17T00:00:00.000Z',issuer:'public-research-key-no-trust',filename:'research.uwx.md'});assert.equal(issued.computation.results[0].value,2);});
after(()=>{if(process.env.AUTH_FIRST_OBSERVATIONS)writeFileSync(process.env.AUTH_FIRST_OBSERVATIONS,`${JSON.stringify({scope:'UNACCEPTED owner-directed authenticate-first procedure; no runtime activation',node:process.version,v8:process.versions.v8,openssl:process.versions.openssl,source_sha256:sha(source),source_fixture:'conformance/receipts/issue/01-uwx-multifamily/deal.uwx.md',public_key_spki_hex:publicKey.export({format:'der',type:'spki'}).toString('hex'),rows},null,2)}\n`);});
const expected=(verdict,codes,has_recomputed)=>({verdict,codes,has_recomputed});
test('supplied invalid signature precedes actual typed recomputation refusal',async()=>{
  const receipt=invalid(issued);
  const baseline=await run('counterexample/current-invalid-refusal',{receipt,packs:[refusingPack],baseline:true,expected:expected('failed',['RCP-03'],true)});
  const fixed=await run('counterexample/proposal-invalid-refusal',{receipt,packs:[refusingPack],expected:expected('failed',['RCP-01'],false),expectedPhases:['authentication'],expectedBackend:1});
  assert.notDeepEqual(baseline.result,fixed.result);
  await run('proposal-valid-refusal',{packs:[refusingPack],expected:expected('failed',['RCP-03'],true),expectedPhases:['authentication','recompute'],expectedBackend:1});
  await run('proposal-unsigned-refusal',{receipt:issued,packs:[refusingPack],expected:expected('failed',['RCP-03'],true),expectedPhases:['authentication','recompute']});
  const other=signed({...issued,computation:{...issued.computation,engine_version:'research-other-engine'}});
  await run('proposal-other-engine-valid-refusal',{receipt:other,packs:[refusingPack],expected:expected('failed',['RCP-03'],true),expectedPhases:['authentication','recompute'],expectedBackend:1});
});
test('finite agreement, signature failure and transport have explicit computation boundaries',async()=>{
  await run('signed-agreement',{expected:expected('verified',[],true),expectedPhases:['authentication','recompute'],expectedBackend:1});
  await run('unsigned-agreement',{receipt:issued,expected:expected('verified',[],true),expectedPhases:['authentication','recompute']});
  await run('invalid-signature-finite',{receipt:invalid(issued),expected:expected('failed',['RCP-01'],false),expectedPhases:['authentication'],expectedBackend:1});
  await run('missing-backend-finite',{backend:'missing',expected:expected('unverifiable',['RCP-08'],false)});
  await run('missing-backend-refusal',{backend:'missing',packs:[refusingPack],expected:expected('unverifiable',['RCP-08'],false)});
  const transport=await run('throwing-backend-before-refusal',{backend:'throws',packs:[refusingPack],expectedPhases:['authentication'],expectedBackend:1});
  assert.equal(transport.thrown?.message,'research-backend-transport');
});
test('wire, source, subject and held-input checks keep their current precedence',async()=>{
  await run('source-not-canonicalizable',{content:'not an admitted record',receipt:invalid(issued),expected:expected('unverifiable',['RCP-09'],false)});
  const changed=structuredClone(issued);changed.subject.digest=`sha256:${'0'.repeat(64)}`;
  await run('subject-mismatch-before-signature',{receipt:invalid(changed),expected:expected('failed',['RCP-01'],false)});
  changed.subject.canonicalization_version='research-other-canonicalization';
  await run('noncomparable-subject',{receipt:invalid(changed),expected:expected('unverifiable',['RCP-10'],false)});
  const malformed=structuredClone(issued);delete malformed.computation.results;
  const wire=await run('malformed-wire',{receipt:malformed});assert(wire.thrown,'wire refusal must throw through current typed boundary');
  const referenced=structuredClone(issued);referenced.inputs_provenance=[{source:'market_data',document_id:'research-input',digest:`sha256:${'1'.repeat(64)}`}];
  await run('held-input-mismatch-before-unknown-pack',{receipt:invalid(referenced),inputs:{'research-input':`sha256:${'2'.repeat(64)}`},packs:[],expected:expected('failed',['RCP-12'],false)});
  await run('missing-input-before-signature',{receipt:invalid(referenced),expected:expected('unverifiable',['RCP-11'],false)});
  await run('indeterminate-order',{receipt:invalid(referenced),packs:[],backend:'missing',expected:expected('unverifiable',['RCP-11','RCP-05','RCP-08'],false)});
});
test('unavailable pack and pack version stay distinct from structural or signature failure',async()=>{
  await run('unknown-pack',{receipt:invalid(issued),packs:[],expected:expected('unverifiable',['RCP-05'],false)});
  await run('pack-version-unavailable',{receipt:invalid(issued),packs:[{...pack,version:'research-other-version'}],expected:expected('unverifiable',['RCP-06'],false)});
});
test('authenticated finite result coverage/value/engine precedes results digest',async()=>{
  let changed=structuredClone(issued);changed.computation.results[0].value=3;changed.computation.results_digest=`sha256:${'0'.repeat(64)}`;
  await run('same-engine-value-before-digest',{receipt:signed(changed),expected:expected('failed',['RCP-03'],true),expectedPhases:['authentication','recompute'],expectedBackend:1});
  changed.computation.engine_version='research-other-engine';
  await run('other-engine-value-before-digest',{receipt:signed(changed),expected:expected('unverifiable',['RCP-07','RCP-03'],true),expectedPhases:['authentication','recompute'],expectedBackend:1});
  changed=structuredClone(issued);changed.computation.results=[];
  await run('coverage-before-digest',{receipt:signed(changed),expected:expected('failed',['RCP-02'],true),expectedPhases:['authentication','recompute'],expectedBackend:1});
  changed=structuredClone(issued);changed.computation.results_digest=`sha256:${'0'.repeat(64)}`;
  await run('digest-corruption-after-authentication',{receipt:signed(changed),expected:expected('failed',['RCP-04'],true),expectedPhases:['authentication','recompute'],expectedBackend:1});
  await run('bad-signature-before-bad-digest',{receipt:invalid(changed),expected:expected('failed',['RCP-01'],false),expectedPhases:['authentication'],expectedBackend:1});
});
test('invalid Unicode signature subject is rejected before backend and computation',async()=>{
  const receipt=signed(issued);receipt.issuer='\ud800';
  await run('invalid-unicode-payload-before-refusal',{receipt,packs:[refusingPack],expected:expected('failed',['RCP-01'],false),expectedPhases:['authentication']});
});
