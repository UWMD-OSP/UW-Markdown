import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const roots={baseline:resolve(process.argv[2]),proposed:resolve(process.argv[3])};
const apis={};
for(const [name,root] of Object.entries(roots))apis[name]=await import(pathToFileURL(join(root,'packages/uwmd-verify/dist/index.js')).href);
const hash=value=>createHash('sha256').update(value).digest('hex');
const copy=value=>JSON.parse(JSON.stringify(value));
const observe=async fn=>{try{return {status:'returned',value:(await fn())??null};}catch(error){return {status:'threw',name:error.name,code:error.code??null,message:error.message};}};
const source='---\nuw_version: "3.0"\ndeal_id: "jcs-final-audit"\ndeal_name: "Valid source metadata audit"\nasset_class: multifamily\n---\n\n```json uw:section=property\n'+JSON.stringify({_meta:{section:'property',provenance:{source:'manual',actor:'reviewer',timestamp:'2026-10-17T00:00:00Z'},lifecycle:{revision:1,superseded:false}},value:'valid'})+'\n```\n';
const pack={...apis.baseline.getPackForAssetClass('multifamily'),id:'research.jcs-final-audit',version:'0.0.0-research',calculations:[{id:'constant',label:'Nonfinancial source control',formula:'1',deterministic:true}]};
const receipt=await apis.baseline.issueReceipt(source,{pack,filename:'audit.uwx.md',issued_at:'2026-10-17T00:00:00Z',issuer:'research-only'});
const document={kind:'uwmd-document-signature',signature_version:'1',subject:await apis.baseline.resolveDocumentSigningSubject(source),alg:'ed25519',kid:'research-placeholder',signed_at:'2026-10-17T00:00:00Z',sig:'A'.repeat(86)};
const bad='metadata-\ud800';
const mutate=(value,path,text)=>{const out=copy(value);let node=out;for(const key of path.slice(0,-1))node=node[key];node[path.at(-1)]=text;return out;};
const receiptCases=[
 ['valid',[],null],['valid-replacement',['issuer'],'metadata-\ufffd'],['issuer',['issuer'],bad],['issued_at',['issued_at'],bad],
 ['pack',['computation','pack'],bad],['pack_version',['computation','pack_version'],bad],['engine',['computation','engine'],bad],['engine_version',['computation','engine_version'],bad],
 ['policy_set',['policy','policy_set'],bad],['signature_key_id',['signature','key_id'],bad],['signature_algorithm',['signature','algorithm'],bad],['signature_value',['signature','value'],bad]
];
const receiptRows=[];
for(const [id,path,text] of receiptCases){
 const signed={...copy(receipt),signature:{algorithm:'ed25519',key_id:'research-placeholder',value:'AAAA'}};
 const changed=path.length?mutate(signed,path,text):signed;
 for(const [mode,api] of Object.entries(apis)){
  const held={...copy(pack),id:changed.computation.pack,version:changed.computation.pack_version};
  const options={filename:'audit.uwx.md',packs:[held]};
  const shape=await observe(()=>api.assertUWReceipt(changed));
  const directPayload=await observe(()=>api.receiptSigningPayload(changed));
  const runs=[];
  for(const backend of ['unsigned','available','absent']){
   const item=copy(changed);if(backend==='unsigned')item.signature=null;
   let calls=0;
   const result=await observe(()=>api.verifyReceipt(item,source,{...options,...(backend==='available'?{signatureVerifier:{verify:async()=>{calls++;return true;}}}:{})}));
   runs.push({backend,calls,result});
  }
  receiptRows.push({id,mode,shape,direct_payload:directPayload,runs});
 }
}
const documentRows=[];
const docCases=[['valid',[],null],['valid-replacement',['kid'],'metadata-\ufffd'],['kid',['kid'],bad],['signed_at',['signed_at'],bad],['signature_version',['signature_version'],bad],['subject_representation',['subject','representation'],bad],['subject_version',['subject','canonicalization_version'],bad],['algorithm',['alg'],bad],['signature_bytes',['sig'],bad]];
for(const [id,path,text] of docCases){
 const changed=path.length?mutate(document,path,text):copy(document);
 for(const [mode,api] of Object.entries(apis)){
  const directPayload=await observe(()=>api.documentSigningPayload(changed));
  const runs=[];
  for(const backend of ['available','absent']){
   let calls=0;
   const result=await observe(()=>api.verifyDocumentSignature(source,changed,backend==='available'?{signatureVerifier:{verify:async()=>{calls++;return {ok:true};}}}:{}));
   runs.push({backend,calls,result});
  }
  documentRows.push({id,mode,direct_payload:directPayload,runs});
 }
}
const direct=[];
const chains=[];
for(const [mode,api] of Object.entries(apis)){
 const parsed=api.parseUWFile(source);const block=parsed.sections.property;
 const baseBlockHash=await api.computeBlockHash(block);
 const withBadValue=copy(block);withBadValue.content.value=bad;
 const withBadKey=copy(block);withBadKey.content[bad]='kept';
 const withBadMeta=copy(block);withBadMeta.meta.provenance.actor=bad;withBadMeta.content._meta=withBadMeta.meta;
 const envelope=api.toUWEnvelope(parsed,{generatedAt:'2026-10-17T00:00:00Z',generator:'research-only'});
 const badEnvelope=copy(envelope);badEnvelope.frontmatter.deal_name=bad;
 const volatileEnvelope=copy(envelope);volatileEnvelope.generator=bad;
 const resultRows=[{calc_id:'constant',value:bad,computed:true}];
 const signingInput={content_hash:baseBlockHash,section:'property',actor:'reviewer',timestamp:'2026-10-17T00:00:00Z',kid:bad,signed_at:'2026-10-17T00:00:00Z'};
 for(const [name,fn] of [
  ['computeBlockHash-valid',()=>api.computeBlockHash(block)],['computeBlockHash-invalid-value',()=>api.computeBlockHash(withBadValue)],['computeBlockHash-invalid-key',()=>api.computeBlockHash(withBadKey)],['computeBlockHash-excluded-invalid-meta',()=>api.computeBlockHash(withBadMeta)],
  ['computeEnvelopeDigest-valid',()=>api.computeEnvelopeDigest(envelope)],['computeEnvelopeDigest-invalid',()=>api.computeEnvelopeDigest(badEnvelope)],['computeEnvelopeDigest-excluded-generator',()=>api.computeEnvelopeDigest(volatileEnvelope)],
  ['computeResultsDigest-invalid-string',()=>api.computeResultsDigest(resultRows)],['canonicalBlockSigningInput-invalid-kid',()=>api.canonicalBlockSigningInput(signingInput)]
 ])direct.push({mode,operation:name,result:await observe(fn)});
 for(const field of ['valid','kid','actor']){
  const candidate=copy(parsed);const current=candidate.sections.property;
  current.meta.integrity={content_hash:baseBlockHash,parent_hash:null,signature:{alg:'ed25519',kid:field==='kid'?bad:'research-placeholder',signed_at:'2026-10-17T00:00:00Z',sig:'AAAA'}};
  if(field==='actor')current.meta.provenance.actor=bad;
  current.content._meta=current.meta;
  let calls=0;
  chains.push({mode,field,direct_payload:await observe(()=>api.blockSigningPayload(current)),verification:await observe(()=>api.verifyChain(candidate,{signatureVerifier:{verify:async()=>{calls++;return {ok:true};}}})),calls});
 }
 // A string-producing pack can introduce invalid receipt-result data even with valid source.
 const stringPack={...copy(pack),id:'research.jcs-string-result',calculations:[{id:'text',label:'String result control',formula:"'metadata-\ud800'",deterministic:true}]};
 direct.push({mode,operation:'issueReceipt-invalid-string-result-from-pack',result:await observe(()=>api.issueReceipt(source,{pack:stringPack,filename:'audit.uwx.md',issued_at:'2026-10-17T00:00:00Z'}))});
}
const oldStringPack={...copy(pack),id:'research.jcs-string-result',calculations:[{id:'text',label:'String result control',formula:"'metadata-\ud800'",deterministic:true}]};
const stringReceipt=await apis.baseline.issueReceipt(source,{pack:oldStringPack,filename:'audit.uwx.md',issued_at:'2026-10-17T00:00:00Z'});
for(const [mode,api] of Object.entries(apis))direct.push({mode,operation:'verifyReceipt-invalid-stated-and-recomputed-string-result',result:await observe(()=>api.verifyReceipt(stringReceipt,source,{packs:[oldStringPack],filename:'audit.uwx.md'}))});
const runtimeHashes=Object.fromEntries(Object.entries(roots).map(([mode,root])=>[mode,{canonicalizer_sha256:hash(readFileSync(join(root,'packages/uwmd-verify/dist/integrity-canonical.js'))),source_sha256:hash(readFileSync(join(root,'packages/uwmd-verify/src/integrity-canonical.ts')))}]));
const output={scope:'Read-only final compatibility audit, TEMP only. Stubs are operational controls and not cryptographic evidence. No new refusal policy selected.',node:process.version,roots:runtimeHashes,source,source_sha256:hash(source),base_receipt:receipt,document_artifact:document,receipts:receiptRows,documents:documentRows,direct,chains};
if (!process.argv[4]) throw new Error('Pass a new output path; frozen observations are never overwritten.');
writeFileSync(process.argv[4],JSON.stringify(output,null,2)+'\n',{flag:'wx'});
for(const row of receiptRows)console.log('receipt',row.mode,row.id,'payload',row.direct_payload.status,row.runs.map(r=>r.backend+':'+(r.result.status==='threw'?'THROW-'+r.result.name:r.result.value.verdict+'-'+r.result.value.issues.map(i=>i.code).join(','))+'/calls'+r.calls).join(' '));
for(const row of documentRows)console.log('document',row.mode,row.id,'payload',row.direct_payload.status,row.runs.map(r=>r.backend+':'+(r.result.status==='threw'?'THROW-'+r.result.name:r.result.value.state+'/'+r.result.value.reason+'-'+r.result.value.issues.map(i=>i.code).join(','))+'/calls'+r.calls).join(' '));
for(const row of direct)console.log('direct',row.mode,row.operation,row.result.status,row.result.name??'');
for(const row of chains)console.log('chain',row.mode,row.field,row.verification.status,row.verification.name??row.verification.value?.ok,'calls',row.calls);
console.log('EVIDENCE',process.argv[4]);
