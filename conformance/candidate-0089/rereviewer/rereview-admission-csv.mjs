import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const evidence = resolve(root, 'node_modules/.cache/rfc0089-evidence');
import fs from 'node:fs';import assert from 'node:assert/strict';import{generateKeyPairSync,sign,verify}from 'node:crypto';
import * as m from '../model.mjs';import * as c from '../csv.mjs';import * as x from '../xml.mjs';import{candidate}from '../build-runtime.mjs';
import * as ns from '../../../packages/uwmd-verify/dist/document-signatures.js';import * as nr from '../../../packages/uwmd-verify/dist/receipts.js';
const empty=()=>({envelope_version:'2.0',format_version:'3.0',frontmatter:{uw_version:'3.0',deal_id:'synthetic-rereview',deal_name:'Synthetic rereview'},sections:{},pipeline_log:[],custom_calculations:[],custom_scenarios:[],extensions:{},superseded:{}});
const meta=id=>({section:id,provenance:{source:'manual',actor:'synthetic',timestamp:'2026-10-23T00:00:00Z'},quality:{confidence:'high',human_review_required:false},lifecycle:{revision:1,superseded:false}});
const b=(id,variant)=>({annotation:{section:id,...(variant!==undefined?{variant}:{})},content:{_meta:meta(id),marker:'synthetic'}});
const out=[];
const csvCases=[];const fix=files=>{const mf=JSON.parse(files['manifest.json']);for(const row of mf.files){row.bytes=Buffer.byteLength(files[row.path]);row.sha256=m.sha(Buffer.from(files[row.path]));}files['manifest.json']=JSON.stringify(mf);return files;};
for(const location of ['sections','superseded'])for(const id of ['property','proper/ty~'])for(const badStamp of [false,true]){
 const v=empty();if(location==='sections')v.sections[id]={'':b(id,'')};else v.superseded[id]=[b(id)];const files=c.encodeCSV(v);
const rows=c.readCSV(files['document.csv'],c.DOC);rows[0][8]=JSON.stringify([{path:`/${location}/${m.esc(id)}`,kind:location==='sections'?'object':'array'}]);if(badStamp)rows[0][4]=`sha256:${'0'.repeat(64)}`;files['document.csv']=c.writeCSV([c.DOC,...rows]);fix(files);
 let actual;try{c.decodeCSV(files);actual='accepted';}catch(e){actual=/empty\/nonempty overlap/.test(e.message)?'overlap-before-digest':e.message;}
 out.push({name:`CSV-${location}-${id}-${badStamp}`,expected:'overlap-before-digest',actual,pass:actual==='overlap-before-digest'});csvCases.push({name:`${location}-${id}-${badStamp}`,files,expected:'overlap'});
}
for(const invalid of ['/superseded/proper~2ty','/superseded/property/0']){const v=empty();
const f=c.encodeCSV(v);
const rows=c.readCSV(f['document.csv'],c.DOC);rows[0][8]=JSON.stringify([{path:invalid,kind:'array'}]);rows[0][4]=`sha256:${'0'.repeat(64)}`;f['document.csv']=c.writeCSV([c.DOC,...rows]);fix(f);let actual;try{c.decodeCSV(f);actual='accepted';}catch(e){actual=/pointer|descriptor location/.test(e.message)?'grammar-before-digest':e.message;}out.push({name:`CSV-invalid-descriptor-${invalid}`,expected:'grammar-before-digest',actual,pass:actual==='grammar-before-digest'});csvCases.push({name:invalid,files:f,expected:'grammar'});}
{const v=empty();v.superseded.property=[];v.superseded.property2=[b('property2')];const f=c.encodeCSV(v);assert.equal(m.preimage(c.decodeCSV(f)),m.preimage(v));out.push({name:'CSV-segment-not-string-prefix',pass:true});csvCases.push({name:'segment-prefix-positive',files:f,expected:'accepted',preimage:m.preimage(v)});}
{const v=empty();
const f=c.encodeCSV(v);
const rows=c.readCSV(f['document.csv'],c.DOC);rows[0][8]='[{"path":"/superseded/property","kind":"array"},{"path":"/superseded/\\u0070roperty","kind":"array"}]';rows[0][4]=`sha256:${'0'.repeat(64)}`;f['document.csv']=c.writeCSV([c.DOC,...rows]);fix(f);let actual;try{c.decodeCSV(f);actual='accepted';}catch(e){actual=/descriptor order/.test(e.message)?'grammar-before-digest':e.message;}out.push({name:'CSV-decoded-name-alias',expected:'grammar-before-digest',actual,pass:actual==='grammar-before-digest'});csvCases.push({name:'decoded-name-alias',files:f,expected:'grammar'});}
fs.writeFileSync(resolve(evidence, 'rereview-csv-cases.json'),JSON.stringify(csvCases));
const {privateKey,publicKey}=generateKeyPairSync('ed25519');const pack={id:'org.example.rereview',version:'1.0.0',calculations:[{id:'synthetic_scalar',label:'Synthetic',formula:'1+1',deterministic:true,round_to:12}]};const opts={pack,issued_at:'2026-10-23T00:00:00Z',issuer:'synthetic-key'};
const source=(kind)=>{const v=empty();
const block=b('x_probe','default');if(kind==='sparse')block.content._meta={section:'x_probe',lifecycle:{revision:1,superseded:false}};if(kind==='invalid-role')block.content._role='invalid-synthetic-role';if(kind==='missing-name')delete v.frontmatter.deal_name;const s=`---\n${Object.entries(v.frontmatter).map(([k,v])=>`${k}: ${JSON.stringify(v)}`).join('\n')}\n---\n\n\`\`\`json uw:section=x_probe variant=default\n${JSON.stringify(block.content)}\n\`\`\`\n`;return s;};
for(const kind of ['complete','sparse','invalid-role','missing-name']){
 const s=source(kind);
 const old=await nr.issueReceipt(s,opts);
 const receipt=await candidate.receipts.issueReceipt(s,opts);assert.deepEqual(receipt.policy.validation,old.policy.validation);await ns.resolveDocumentSigningSubject(s);const subject=await candidate.signing.resolveDocumentSigningSubject(s);assert.equal(subject.canonicalization_version,'2.0');
 const artifact={kind:'uwmd-document-signature',signature_version:'1',subject,alg:'ed25519',kid:'synthetic-key',signed_at:opts.issued_at,sig:''};artifact.sig=sign(null,Buffer.from(candidate.signing.documentSigningPayload(artifact)),privateKey).toString('base64url');receipt.signature={algorithm:'ed25519',key_id:'synthetic-key',value:sign(null,Buffer.from(candidate.receipts.receiptSigningPayload(receipt)),privateKey).toString('base64')};let dc=0;
let rc=0;
 const dr=await candidate.signing.verifyDocumentSignature(s,artifact,{signatureVerifier:{verify:async(p,a)=>{dc++;return verify(null,Buffer.from(p),publicKey,Buffer.from(a.sig,'base64url'))?{ok:true}:{ok:false,reason:'bad_signature'};}}});const rr=await candidate.receipts.verifyReceipt(receipt,s,{packs:[pack],signatureVerifier:{verify:async(a,p)=>{rc++;return verify(null,Buffer.from(p),publicKey,Buffer.from(a.signature.value,'base64'));}}});assert.equal(dr.state,'verified');assert.equal(rr.verdict,'verified');assert.equal(dc,1);assert.equal(rc,1);
 let carrier;try{m.validateModel(m.projectSource(s).model);carrier='accepted';}catch{carrier='refused';}assert.equal(carrier,kind==='complete'?'accepted':'refused');out.push({name:`F1-${kind}`,validation:receipt.policy.validation,nativeCountsEqual:true,document:dr.state,receipt:rr.verdict,dc,rc,carrier,pass:true});
}
const normal=source('complete');
const base=await candidate.signing.resolveDocumentSigningSubject(normal);const doc={kind:'uwmd-document-signature',signature_version:'1',subject:base,alg:'ed25519',kid:'synthetic-key',signed_at:opts.issued_at,sig:''};doc.sig=sign(null,Buffer.from(candidate.signing.documentSigningPayload(doc)),privateKey).toString('base64url');
const fence=normal.slice(normal.indexOf('```json'));
for(const [name,s]of [['repeated-extension',normal+fence],['lifecycle-missing',normal.replace(',"superseded":false','')],['lifecycle-conflict',normal.replace('variant=default','variant=default superseded=true')],['duplicate-fence',normal.replace('variant=default','variant=default variant=other')],['duplicate-JSON',normal.replace('"marker":"synthetic"','"marker":"synthetic","\\u006darker":1')],['unsafe-variant',normal.replace('variant=default','variant=__proto__')]]){let calls=0;const r=await candidate.signing.verifyDocumentSignature(s,doc,{signatureVerifier:{verify:async()=>{calls++;return {ok:true};}}});assert.equal(calls,0);assert.deepEqual(r.issues.map(x=>x.code),['INT-15']);out.push({name:`V13-${name}`,codes:['INT-15'],calls,pass:true});}
fs.writeFileSync(resolve(evidence, 'rereview-admission-csv-results.json'),JSON.stringify({platform:process.platform,probes:out},null,2));console.log(JSON.stringify({cases:out.length,passing:out.filter(x=>x.pass).length,failures:out.filter(x=>!x.pass)},null,2));
