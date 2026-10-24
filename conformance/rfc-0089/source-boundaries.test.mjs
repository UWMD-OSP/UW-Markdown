// Postacceptance native regression of the independently closed F1 boundaries.
import assert from 'node:assert/strict';import {test} from 'node:test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {generateKeyPairSync,sign,verify} from 'node:crypto';
import {production as p} from './runtime.mjs';import {preimage,digest} from './test-oracle.mjs';
const packet=JSON.parse(readFileSync(new URL('./cases.json',import.meta.url),'utf8'));
const normal=packet.source_cases.find(x=>x.name==='named-default-single');
const pack={id:'org.example.admission',version:'1.0.0',calculations:[{id:'synthetic_scalar',label:'Synthetic stage control',formula:'1+1',deterministic:true,round_to:12}]};
const options={pack,issued_at:'2026-10-23T00:00:00Z',issuer:'synthetic-key'};
test('F1 native source/carrier separation with actual signatures/receipts and explicit synthetic pack',async()=>{
  const {privateKey,publicKey}=generateKeyPairSync('ed25519');const records=[];
  const controls=[
    {name:'complete',source:normal.source,carrier:true,counts:[0,1],mutate:m=>m},
    {name:'sparse-metadata',source:normal.source.replace(/"provenance":\{[^}]+\},"quality":\{[^}]+\},/,''),carrier:false,counts:[1,1],mutate:m=>{delete m.extensions.x_probe.block.content._meta.provenance;delete m.extensions.x_probe.block.content._meta.quality;}},
    {name:'invalid-role',source:normal.source.replace('"marker":1','"marker":1,"_role":"not-a-role"'),carrier:false,counts:[1,1],mutate:m=>{const block=m.extensions.x_probe.block;block.content._role='not-a-role';m.extensions.x_probe={mode:'variants',blocks:[{variant:'default',block}]};}},
    {name:'missing-deal-name',source:normal.source.replace(/^deal_name:.*\n/m,''),carrier:false,counts:[0,1],mutate:m=>{delete m.frontmatter.deal_name;}},
  ];
  for(const c of controls){
    const expected=structuredClone(normal.expected_model);c.mutate(expected);
    const model=p.envelope.toUWEnvelope(p.parser.parseUWFile(c.source));assert.equal(preimage(model),preimage(expected));
    const admission=()=>p.envelope.assertUWEnvelope(model);if(c.carrier)admission();else assert.throws(admission);
    // Projection is a source operation; it must not silently discard a record
    // merely because its metadata/role is outside the full carrier schema.
    const {flattenUWSourceBlockValues,flattenEnvelopeBlockValues}=await import('../../packages/uwmd-verify/dist/index.js');
    assert.ok(flattenUWSourceBlockValues(p.parser.parseUWFile(c.source)).some(row=>row.pointer==='/marker'));
    if(!c.carrier)assert.throws(()=>flattenEnvelopeBlockValues(model));
    const subject=await p.signing.resolveDocumentSigningSubject(c.source);assert.equal(subject.digest,digest(expected));assert.equal(subject.canonicalization_version,'2.0');
    const receipt=await p.receipts.issueReceipt(c.source,options);assert.deepEqual([receipt.policy.validation.errors,receipt.policy.validation.warnings],c.counts);
    receipt.signature={algorithm:'ed25519',key_id:'synthetic-key',value:sign(null,Buffer.from(p.receipts.receiptSigningPayload(receipt)),privateKey).toString('base64')};
    const artifact={kind:'uwmd-document-signature',signature_version:'1',subject,alg:'ed25519',kid:'synthetic-key',signed_at:options.issued_at,sig:''};
    artifact.sig=sign(null,Buffer.from(p.signing.documentSigningPayload(artifact)),privateKey).toString('base64url');
    let docCalls=0;
    let receiptCalls=0;
    const document=await p.signing.verifyDocumentSignature(c.source,artifact,{signatureVerifier:{verify:async(payload,value)=>{docCalls++;return verify(null,Buffer.from(payload),publicKey,Buffer.from(value.sig,'base64url'))?{ok:true}:{ok:false,reason:'bad_signature'};}}});
    const result=await p.receipts.verifyReceipt(receipt,c.source,{packs:[pack],signatureVerifier:{verify:async(value,payload)=>{receiptCalls++;return verify(null,Buffer.from(payload),publicKey,Buffer.from(value.signature.value,'base64'));}}});
    assert.equal(document.state,'verified');assert.equal(result.verdict,'verified');assert.equal(docCalls,1);assert.equal(receiptCalls,1);
    records.push({name:c.name,carrier:c.carrier,source:c.source,expected_preimage:preimage(expected),source_admission:'admitted',counts:c.counts,document:document.state,docCalls,receipt:result.verdict,receiptCalls});
  }
  const folder=new URL('../../node_modules/.cache/rfc0089-production-evidence/',import.meta.url);mkdirSync(folder,{recursive:true});writeFileSync(new URL('native-source-boundaries.json',folder),`${JSON.stringify({node:process.version,records},null,2)}\n`);
});
