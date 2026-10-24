// Actual browser entry and editor receipt functions, with synthetic inputs only.
import * as api from '@uwmd/core/browser';
import {issueForSource,assess,loadReceiptJson,serializeReceipt} from '../../tools/web-editor/src/receipts.ts';
const observations=[];const check=(condition,label)=>{if(!condition)throw new Error(label);};
try {
 const packet=await fetch('./cases.json').then(r=>r.json());
 for(const item of [...packet.source_cases,...packet.direct_models]){
  const model={...item.expected_model,semantic_digest:item.expected_digest};
  for(const descriptor of api.CORE_CODEC_REGISTRY.list()){
   const body=await api.CORE_CODEC_REGISTRY.encode(descriptor.id,model);const received=await api.CORE_CODEC_REGISTRY.decode(descriptor.id,body);
   check(api.canonicalizeUWEnvelope(received)===item.expected_preimage,`${item.name}/${descriptor.id} preimage`);check((await api.verifyEnvelopeDigest(received)).valid,`${item.name}/${descriptor.id} digest`);
   observations.push({case:item.name,codec:descriptor.id,state:'equal'});
  }
 }
 const base=packet.source_cases[1].expected_model;
 for(const key of ['outer','generator','generated_at','semantic_digest'])for(const enumerable of [false,true])for(const deletes of [false,true]){
  const value=structuredClone(base);let calls=0;Object.defineProperty(value,key,{configurable:true,enumerable,get(){calls++;if(deletes)delete value[key];return 'synthetic';}});
  let refused=false;try{await api.stampEnvelopeDigest(value);}catch{refused=true;}check(refused&&calls===0,`zero getter calls/${key}`);observations.push({stamp:key,enumerable,deletes,refused,calls});
 }
 for(const frozen of [false,true]){const value=structuredClone(base);if(frozen)Object.freeze(value);const stamped=await api.stampEnvelopeDigest(value);check((await api.verifyEnvelopeDigest(stamped)).valid,'returned stamp');}
 const extension=packet.source_cases.find(x=>x.name==='named-default-single').source.split(/---\n/).at(-1);
 const source=(await fetch('./fixtures/complete-current.uwx.md').then(r=>r.text()))+extension;const changed=source.replace('"marker":1','"marker":2');
 const issued=await issueForSource(source,'synthetic.uwx.md');check(issued.ok,'editor receipt issuance');check(issued.held.receipt.subject.canonicalization_version==='2.0','editor current identity');
 check((await assess(issued.held,source,'synthetic.uwx.md')).status==='verified','editor verified');check((await assess(issued.held,changed,'synthetic.uwx.md')).status==='stale','editor changed source stale');
 const loaded=loadReceiptJson(serializeReceipt(issued.held.receipt));check(loaded.ok,'editor receipt read');check((await assess(loaded.held,changed,'synthetic.uwx.md')).status==='failed','foreign changed subject fails');
 observations.push({editor_receipt:'verified',edited:'stale',loaded_changed:'failed',subject:issued.held.receipt.subject});
 const result={status:'pass',user_agent:navigator.userAgent,web_crypto:typeof crypto.subtle,observations};document.querySelector('#result').textContent=JSON.stringify(result,null,2);await fetch('/__rfc0089_result',{method:'POST',body:JSON.stringify(result)});
} catch(error){const result={status:'fail',message:String(error),stack:error.stack,observations};document.querySelector('#result').textContent=JSON.stringify(result,null,2);await fetch('/__rfc0089_result',{method:'POST',body:JSON.stringify(result)});}
