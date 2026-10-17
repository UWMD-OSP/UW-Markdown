// Proposal-only regressions and public-boundary observations. No source writes.
import assert from 'node:assert/strict';
import { readFileSync,writeFileSync,existsSync } from 'node:fs';
import { resolve,join,dirname } from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(process.argv[2]);
const mode=process.argv[3];
const outputIndex=process.argv.indexOf('--output');
const outputPath=outputIndex>=0?resolve(process.argv[outputIndex+1]):null;
const baselineIndex=process.argv.indexOf('--baseline');
const baselinePath=baselineIndex>=0?resolve(process.argv[baselineIndex+1]):join(here,'astra-jcs-baseline.json');
assert.ok(['baseline','proposed'].includes(mode));
const api=await import(pathToFileURL(join(root,'packages/uwmd-verify/dist/index.js')).href);
const {canonicalize}=await import(pathToFileURL(join(root,'packages/uwmd-verify/dist/integrity-canonical.js')).href);
const signatures=await import(pathToFileURL(join(root,'packages/uwmd-verify/dist/document-signatures.js')).href);
const sha=value=>createHash('sha256').update(value).digest('hex');
const errorValue=error=>({name:error.name,code:error.code??null,message:error.message});
async function observe(fn){try{return {returned:await fn()};}catch(error){return {refused:errorValue(error)};}}
const low=[];
for(const text of ['\ud800','\ud801','\udbff','\udc00','\udfff','x\ud800y'])for(const [kind,value] of [['scalar',text],['value',{value:text}],['key',{[text]:1}],['nested',[{nested:text}]]]){
 const outcome=await observe(()=>canonicalize(value));
 if(mode==='proposed')assert.ok(outcome.refused&&outcome.refused.name==='TypeError'&&/unpaired/.test(outcome.refused.message));
 else assert.ok(outcome.returned!==undefined);
 low.push({text,kind,outcome});
}
const valid={pair:'\ud83d\ude00',replacement:'\ufffd',nul:'\u0000'};
assert.equal(canonicalize(valid),'{'+'"nul":"\\u0000","pair":"\ud83d\ude00","replacement":"\ufffd"}');
assert.equal(canonicalize({'\ue000':2,'\ud83d\ude00':1}),'{"\ud83d\ude00":1,"\ue000":2}');
assert.notEqual(canonicalize('\u00e9'),canonicalize('e\u0301'));
const validControls={canonical:canonicalize(valid),utf8_sha256:sha(canonicalize(valid)),utf16_order:canonicalize({'\ue000':2,'\ud83d\ude00':1}),composed:canonicalize('\u00e9'),decomposed:canonicalize('e\u0301')};
const source=readFileSync(join(here,'codec-examples/single/original.uwx.md'),'utf8');
const changed=source.replace('"note": "synthetic"','"note": "\\ud800"');
assert.notEqual(changed,source);
const keyChanged=source.replace('"note": "synthetic"','"\\ud801": "key-control", "note": "synthetic"');
assert.notEqual(keyChanged,source);
const inputs=[{id:'invalid-value',source:changed},{id:'invalid-key',source:keyChanged}];
const baseline=mode==='proposed'?JSON.parse(readFileSync(baselinePath,'utf8')):null;
const pack={...api.getPackForAssetClass('multifamily'),id:'research.rfc0089.unicode-control',version:'0.0.0-research',calculations:[{id:'constant',label:'Nonfinancial source control',formula:'1',deterministic:true}]};
const options={filename:'unicode.uwx.md',pack,issuer:'research-only',issued_at:'2026-10-17T00:00:00Z',engine:'research-only.unicode-control',engine_version:'0.0.0-research'};
const publicControls=[];
for(const input of inputs){
 let oldReceipt;
 let artifact;
 if(mode==='baseline'){
  oldReceipt=await api.issueReceipt(input.source,options);
  const subject=await signatures.resolveDocumentSigningSubject(input.source);
  artifact={kind:'uwmd-document-signature',signature_version:'1',subject,alg:'ed25519',kid:'research-placeholder',signed_at:'2026-10-17T00:00:00Z',sig:'A'.repeat(86)};
 }else{
  const old=baseline.public_controls.find(c=>c.id===input.id);oldReceipt=old.old_receipt;artifact=old.document_artifact;
  assert.equal(input.source,old.source);
 }
 const receiptBefore=JSON.stringify(oldReceipt);
 const receiptResult=await api.verifyReceipt(oldReceipt,input.source,{filename:options.filename,packs:[pack],engine:options.engine,engine_version:options.engine_version});
 let backendCalls=0;
 const verifier={verify:async()=>{backendCalls++;return {ok:true};}};
 const signed=await signatures.verifyDocumentSignature(input.source,artifact,{signatureVerifier:verifier});
 const unsupported=await signatures.verifyDocumentSignature(input.source,{...artifact,subject:{...artifact.subject,canonicalization_version:'UNACCEPTED'}},{signatureVerifier:verifier});
 const jsonEnvelope=await observe(async()=>{
  const e=api.toUWEnvelope(api.parseUWFile(input.source));
  const stamped=await api.stampEnvelopeDigest(e);
  return api.parseUWJsonVerified(JSON.stringify(stamped));
 });
 assert.equal(JSON.stringify(oldReceipt),receiptBefore);
 if(mode==='proposed'){
  assert.equal(receiptResult.verdict,'unverifiable');assert.equal(receiptResult.issues[0].code,'RCP-09');
  assert.equal(signed.issues[0].code,'INT-15');assert.equal(backendCalls,0);
 }else{assert.equal(receiptResult.verdict,'verified');assert.equal(signed.state,'verified');assert.equal(backendCalls,1);}
 assert.equal(unsupported.issues[0].code,'INT-14');
 publicControls.push({...input,source_sha256:sha(input.source),old_receipt:oldReceipt,old_receipt_json_sha256:sha(receiptBefore),receipt_verification:receiptResult,
  document_artifact:artifact,document_verification:signed,unsupported_subject_verification:unsupported,signature_backend_calls:backendCalls,
  verified_json_boundary:jsonEnvelope,receipt_unchanged:true});
}
const before=readFileSync(join(root,'packages/uwmd-verify/src/integrity-canonical.ts'));
const output={scope:'UNAPPLIED JCS guard proposal, isolated module loader only; no normative/version/production edits or cryptographic authentication',mode,
 runtime:{node:process.version,v8:process.versions.v8,platform:process.platform,architecture:process.arch},
 production_source_sha256:sha(before),proposal_source_sha256:sha(readFileSync(join(here,'proposed-jcs-unicode.ts.txt'))),
 low_level_controls:low,valid_controls:validControls,public_controls:publicControls,
 unit_patch:'proposed-jcs-unicode.patch',signature_stub_is_cryptography:false};
if(mode==='proposed')assert.deepEqual(validControls,baseline.valid_controls);
if(outputPath){
 if(existsSync(outputPath))throw new Error('Refusing to overwrite frozen evidence');
 writeFileSync(outputPath,`${JSON.stringify(output,null,2)}\n`);
}else{
 const frozen=JSON.parse(readFileSync(join(here,`astra-jcs-${mode}.json`),'utf8'));
 const material=({runtime:_runtime,...value})=>value;
 assert.deepEqual(material(output),material(frozen),'Proposal observations differ from frozen evidence');
}
console.log(JSON.stringify({mode,invalid_regressions:low.length,valid_controls:3,public_controls:publicControls.length,production_source_unchanged:sha(before)==='93f3a8b8f57e7135030bf551780fc3d9862a83d8b19d981fe3086e035c1994d3'}));
