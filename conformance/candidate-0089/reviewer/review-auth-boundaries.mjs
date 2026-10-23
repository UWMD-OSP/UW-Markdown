import {mkdirSync} from 'node:fs';
mkdirSync(new URL('../../../node_modules/.cache/rfc0089-evidence/',import.meta.url),{recursive:true});
import fs from 'node:fs';
import {generateKeyPairSync,sign,verify} from 'node:crypto';
import {candidate} from '../build-runtime.mjs';
import * as native from '../../../packages/uwmd-verify/dist/receipts.js';
import {oracle,canon,sha} from './review-oracle.mjs';
const packet=JSON.parse(fs.readFileSync(new URL('../cases.json', import.meta.url),'utf8'));
const normal=packet.source_cases.find(x=>x.name==='named-default-single').source;
const sparse=normal.replace(/"provenance":\{[^}]+\},"quality":\{[^}]+\},/,'');
const pack={id:'org.example.independent',version:'1.0.0',calculations:[{id:'synthetic_scalar',label:'Synthetic',formula:'1+1',deterministic:true,round_to:12}]};
const opts={pack,issued_at:'2026-10-23T00:00:00Z',issuer:'synthetic-key'};
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const signReceipt=r=>{r.signature={algorithm:'ed25519',key_id:'synthetic-key',value:sign(null,Buffer.from(candidate.receipts.receiptSigningPayload(r)),privateKey).toString('base64')};return r;};
const observations=[];
for(const [name,source]of [['valid',normal],['sparse',sparse]]){
 const current=await native.issueReceipt(source,opts);
 const doc={kind:'uwmd-document-signature',signature_version:'1',subject:{representation:'uwx-markdown',representation_version:'1.0',canonicalization:'uw-envelope-semantic',canonicalization_version:'2.0',digest:sha(canon(oracle(source).model))},alg:'ed25519',kid:'synthetic-key',signed_at:opts.issued_at,sig:''};
 doc.sig=sign(null,Buffer.from(candidate.signing.documentSigningPayload(doc)),privateKey).toString('base64url');
 let calls=0;const d=await candidate.signing.verifyDocumentSignature(source,doc,{signatureVerifier:{verify:async(payload,a)=>{calls++;return verify(null,Buffer.from(payload),publicKey,Buffer.from(a.sig,'base64url'))?{ok:true}:{ok:false,reason:'bad_signature'};}}});
 observations.push({name:'document-'+name,state:d.state,codes:d.issues.map(x=>x.code),backend_calls:calls});
 current.subject.canonicalization_version='2.0';current.subject.digest=sha(canon(oracle(source).model));signReceipt(current);
 calls=0;const r=await candidate.receipts.verifyReceipt(current,source,{packs:[pack],signatureVerifier:{verify:async(a,payload)=>{calls++;return verify(null,Buffer.from(payload),publicKey,Buffer.from(a.signature.value,'base64'));}}});
 observations.push({name:'receipt-'+name,verdict:r.verdict,codes:r.issues.map(x=>x.code),backend_calls:calls,native_policy:current.policy.validation});
}
fs.writeFileSync(new URL('../../../node_modules/.cache/rfc0089-evidence/independent-auth-results.json', import.meta.url),JSON.stringify({platform:process.platform,observations,private_keys:'ephemeral; never saved'},null,2));
console.log(JSON.stringify(observations,null,2));
