// Production routes, synthetic inputs only. No stored example artifacts are rewritten.
import assert from 'node:assert/strict';import {test} from 'node:test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {resolve} from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
import * as api from '../../packages/uwmd-core/dist/index.js';
import {loadUWSourceFile} from '../../packages/uwmd-core/dist/source-file.js';
import {packageMemberSemanticDigest} from '../../packages/uwmd-core/dist/cli-packages.js';
import * as excel from '../../packages/uwmd-excel/dist/index.js';import ExcelJS from 'exceljs';
import * as batch from '../../packages/uwmd-batch/dist/index.js';import * as lake from '../../packages/uwmd-lake/dist/index.js';import * as signing from '../../packages/uwmd-signing/dist/index.js';
const root=fileURLToPath(new URL('../../',import.meta.url)),folder=resolve(root,'node_modules/.cache/rfc0089-production-evidence/routes');mkdirSync(folder,{recursive:true});
const packet=JSON.parse(readFileSync(new URL('./cases.json',import.meta.url),'utf8'));
const hash=bytes=>'sha256:'+createHash('sha256').update(bytes).digest('hex');const save=(name,value)=>writeFileSync(resolve(folder,name),JSON.stringify(value,null,2)+'\n');
function cli(args){const child=spawnSync(process.execPath,[resolve(root,'packages/uwmd-cli/bin/uwmd.mjs'),...args],{cwd:root,encoding:'utf8',timeout:60000,maxBuffer:8_000_000});assert.equal(child.status,0,JSON.stringify(args)+'\n'+child.stderr+'\n'+child.stdout);return child.stdout;}
const formats=[['uw-json','.uw.json','application/vnd.uwmd.document+json'],['uw-xml','.uw.xml','application/vnd.uwmd.document+xml'],['uw-csv-bundle','.uw.csv.zip','application/vnd.uwmd.csv-bundle+zip']];
test('actual CLI source→three carrier files→loader and portable parse retains all18 physical-source models',async()=>{
 const rows=[];
 for(const item of packet.source_cases){
  const source=resolve(folder,item.name+'.uwx.md');writeFileSync(source,item.source);
  const sourceParsed=JSON.parse(cli(['parse',source,'--compact']));assert.deepEqual(sourceParsed.extensions,api.projectUWParse(api.parseUWFile(item.source)).extensions);
  for(const [id,ext] of formats){
   const path=resolve(folder,item.name+ext);cli(['convert',source,'--to',id,'--output',path]);
   const loaded=await loadUWSourceFile(path);assert.equal(await api.computeEnvelopeDigest(loaded.envelope),item.expected_digest);
   const parsed=JSON.parse(cli(['parse',path,'--compact']));assert.deepEqual(parsed.extensions,sourceParsed.extensions);assert.deepEqual(parsed.superseded,sourceParsed.superseded);
   rows.push({case:item.name,representation:id,sha256:hash(readFileSync(path)),digest:item.expected_digest,portable:'equal'});
  }
 }
 save('cli-carriers.json',{node:process.version,platform:process.platform,rows});
});
test('actual binary HTTP/MCP and package archive callback recompute complete selected identities',async()=>{
 const rows=[];
 for(const item of [...packet.source_cases,...packet.direct_models]){
  const model={...item.expected_model,semantic_digest:item.expected_digest};const dealId=model.frontmatter.deal_id;
  for(const [id,,media] of formats){
   const response=await api.createUWHTTPResponse(model,{accept:media});assert.equal(response.representation_id,id);assert.equal(response.headers.ETag,'"'+item.expected_digest+'"');
   const bytes=typeof response.body==='string'?Buffer.from(response.body):response.body;
   const decoded=await api.decodeUWHTTPRequest(media,bytes);assert.equal(await api.computeEnvelopeDigest(decoded),item.expected_digest);
   const resource=await api.createUWMCPResource(model,dealId,{representation:id});const body=resource.text??Buffer.from(resource.blob,'base64');assert.equal(await packageMemberSemanticDigest(media,typeof body==='string'?Buffer.from(body):body),item.expected_digest);
   const manifest={package_version:'1.0',package_id:'synthetic',members:[{id:'synthetic',path:'model'+formats.find(x=>x[0]===id)[1],role:'model_encoding',media_type:media,sha256:hash(bytes),semantic_digest:item.expected_digest}],links:[]};
   const archive=await api.encodeUWDealPackageZip({manifest,payloads:{[manifest.members[0].path]:bytes}});const received=api.decodeUWDealPackageZip(archive);let calls=0;
   const result=await api.verifyUWDealPackage(received,{semanticDigestOf:async(memberId,payload)=>{calls++;assert.equal(memberId,'synthetic');return packageMemberSemanticDigest(media,payload);}});
   assert.equal(result.status,'verified');assert.equal(calls,1);
   const stale=structuredClone(received);stale.manifest.members[0].semantic_digest='sha256:'+'0'.repeat(64);
   assert.deepEqual((await api.verifyUWDealPackage(stale,{semanticDigestOf:(_id,payload)=>packageMemberSemanticDigest(media,payload)})).errors.map(x=>x.code),['PKGVER-003']);
   rows.push({case:item.name,id,archive_sha256:hash(archive),callback_calls:calls,status:result.status});
  }
 }
 for(const item of JSON.parse(readFileSync(new URL('./independent/closure-xml-cases.json',import.meta.url),'utf8')).filter(x=>['start-37f','start-10000','start-effff','two-start-bom','bom-after-space','second-declaration'].includes(x.name))){
  const body=Buffer.from(item.text);const path=resolve(folder,'xml-prefix.uw.xml');writeFileSync(path,body);
  if(item.expected==='equal'){await api.decodeUWHTTPRequest(formats[1][2],body);await loadUWSourceFile(path);cli(['parse',path,'--compact']);}
  else {await assert.rejects(api.decodeUWHTTPRequest(formats[1][2],body));await assert.rejects(loadUWSourceFile(path));const refused=spawnSync(process.execPath,[resolve(root,'packages/uwmd-cli/bin/uwmd.mjs'),'parse',path],{cwd:root,encoding:'utf8'});assert.notEqual(refused.status,0);}
  rows.push({case:item.name,binary_http_cli_expected:item.expected});
 }
 save('http-mcp-package.json',rows);
});
test('actual fresh workbook, batch→facts→lake/query, signing package and core receipt wrapper',async()=>{
 const source=readFileSync(new URL('./fixtures/complete-current.uwx.md',import.meta.url),'utf8');
 const peer=packet.source_cases.find(x=>x.name==='named-default-single').source.split(/---\n/).at(-1);
 const original=source+peer,changed=original.replace('"marker":1','"marker":2');const parsed=api.parseUWFile(original),mutated=api.parseUWFile(changed);
 const digest=await api.computeEnvelopeDigest(api.toUWEnvelope(parsed));assert.notEqual(await api.computeEnvelopeDigest(api.toUWEnvelope(mutated)),digest);
 const workbook=await excel.toWorkbook(parsed);const bytes=await workbook.xlsx.writeBuffer();const received=new ExcelJS.Workbook();await received.xlsx.load(bytes);writeFileSync(resolve(folder,'synthetic.xlsx'),Buffer.from(bytes));
 assert.equal(excel.readWorkbookContract(received).document.source_semantic_digest,digest);assert.equal((await excel.verifyWorkbookContract(received,parsed,excel.MULTIFAMILY_LAYOUT)).status,'verified');assert.equal((await excel.verifyWorkbookContract(received,mutated,excel.MULTIFAMILY_LAYOUT)).status,'stale');
 const documents=resolve(folder,'batch');mkdirSync(documents,{recursive:true});writeFileSync(resolve(documents,'synthetic.uwx.md'),original);
 const facts=await batch.buildUWMDFactTable(documents);assert.equal(facts.deals_included,1);assert.deepEqual(facts.deals_skipped,[]);assert.ok(facts.rows.some(x=>x.block_ref.includes('/extensions/x_probe/block')&&x.pointer==='/marker'));assert.ok(facts.rows.every(x=>x.semantic_digest===digest));
 const jsonl=await batch.writeUWMDFactTable(facts,resolve(folder,'facts'));const input=lake.readBatchFactJSONL(readFileSync(jsonl.jsonl,'utf8'));const projected=await lake.lakeInputFromEnvelope(api.toUWEnvelope(parsed));assert.equal(projected.document.semantic_digest,digest);
 const planned=await lake.planLakeLoad({documents:[projected.document],facts:input,source_evidence:[{semantic_digest:digest,evidence_id:'synthetic-peer',reference:{marker:1}}]});const queries=[];assert.equal(await lake.executeLakeLoad(planned,{query:async(sql,params)=>queries.push({sql,params})}),planned.statements.length);assert.deepEqual(queries,planned.statements);
 const privateDoc=JSON.parse(readFileSync(resolve(root,'conformance/document-signatures/keys/signer.json'),'utf8'));const key=await signing.loadDocumentSigningKey(privateDoc);const store=await signing.loadKeyStoreDocument(JSON.parse(readFileSync(resolve(root,'conformance/document-signatures/keys/keystore.json'),'utf8')));const artifact=await signing.signDocument(original,key,{signedAt:'2026-10-23T00:00:00Z'});const verifier=signing.createDocumentSignatureVerifier(store);assert.equal((await api.verifyDocumentSignature(original,artifact,{signatureVerifier:verifier})).state,'verified');assert.equal((await api.verifyDocumentSignature(changed,artifact,{signatureVerifier:verifier})).reason,'subject_mismatch');
 const pack={id:'org.example.routes',version:'1.0.0',calculations:[{id:'synthetic',formula:'1',deterministic:true}]};const receipt=await api.issueReceipt(original,{pack,filename:'synthetic.uwx.md',issued_at:'2026-10-23T00:00:00Z'});assert.equal(receipt.subject.canonicalization_version,'2.0');assert.equal(receipt.subject.digest,digest);assert.match(receipt.issuer,/@uwmd\/core@/);assert.equal((await api.verifyReceipt(receipt,original,{packs:[pack]})).verdict,'verified');assert.equal((await api.verifyReceipt(receipt,changed,{packs:[pack]})).verdict,'failed');
 save('workbook-batch-lake-signing.json',{digest,workbook_sha256:hash(bytes),fact_count:facts.rows.length,query_count:queries.length,queries,signature:artifact,receipt,controls:'fresh verified / changed stale, failed or subject_mismatch'});
});
