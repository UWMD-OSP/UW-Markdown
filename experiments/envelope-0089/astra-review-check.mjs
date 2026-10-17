// Read-only reproduction of external review claims against pinned main sources.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync,writeFileSync,readdirSync,existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { dirname,resolve,join,basename } from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const runtime=resolve(process.argv[2]);
const outputIndex=process.argv.indexOf('--output');
const outputPath=outputIndex>=0?resolve(process.argv[outputIndex+1]):null;
const frozen=JSON.parse(readFileSync(join(here,'astra-review-evidence.json'),'utf8'));
const reportPath=process.argv[3]&&!process.argv[3].startsWith('--')?process.argv[3]:null;
const pin='3eee0fbab3f5682dc345804782994dc22d321fae';
const hash=value=>createHash('sha256').update(value).digest('hex');
const copy=value=>JSON.parse(JSON.stringify(value));
const sources=['parser','envelope','uwjson','uwcsv','integrity-canonical','integrity','receipts','document-signatures'];
const sourcePaths=[...sources.map(name=>`packages/uwmd-verify/src/${name}.ts`),
 'spec/UW_FORMAT_SPEC.md','spec/UW_PROTOCOL.md','spec/UW_RECEIPT.md','spec/UW_CSV_BUNDLE.md',
 'spec/schemas/uw-document-envelope.schema.json','spec/schemas/uwmd-block.schema.json',
 'implementations/python/uwmd_reader.py','implementations/python/uwmd_envelope.py','implementations/python/uwmd_jcs.py'];
const sourceHashes={};
for(const path of sourcePaths){
 const pinned=execFileSync('git',['show',`${pin}:${path}`],{cwd:runtime});
 const actual=readFileSync(join(runtime,path));
 assert.equal(hash(actual),hash(pinned),`Runtime source differs from pinned main: ${path}`);
 sourceHashes[path]=hash(actual);
}
const modules=Object.fromEntries(await Promise.all(sources.map(async name=>[name,await import(pathToFileURL(join(runtime,`packages/uwmd-verify/dist/${name}.js`)).href)])));
const api=await import(pathToFileURL(join(runtime,'packages/uwmd-verify/dist/index.js')).href);
const requireRuntime=createRequire(join(runtime,'package.json'));
const Ajv=requireRuntime('ajv/dist/2020.js').default;
const addFormats=requireRuntime('ajv-formats').default;
const ajv=new Ajv({strict:false,allErrors:true,loadSchema:async()=>{throw new Error('No remote schema resolution');}});
addFormats(ajv);
for(const path of readdirSync(join(runtime,'spec/schemas')).filter(f=>f.endsWith('.schema.json')).sort()){
 const schema=JSON.parse(readFileSync(join(runtime,'spec/schemas',path),'utf8'));
 if(!ajv.getSchema(schema.$id))ajv.addSchema(schema,schema.$id);
}
const validate=ajv.getSchema('https://uwmd.org/schemas/uw-document-envelope.schema.json');
const schemaObservation=value=>({accepted:validate(value),errors:copy(validate.errors??[])});
const refusal=error=>({refused:true,name:error.name,code:error.code??null,message:error.message});
async function observe(fn){try{return {returned:await fn()};}catch(error){return refusal(error);}}
const original=readFileSync(join(here,'codec-examples/ordered-history/original.uwx.md'),'utf8');
function mutateActive(source){
 const pattern=/(```json uw:section=x_review variant=base\r?\n)([\s\S]*?)(\r?\n```)/;
 const matched=source.match(pattern);assert.ok(matched,'Exact active base fence');
 const body=JSON.parse(matched[2]);body.note='independently changed discarded active base';
 return source.replace(pattern,`${matched[1]}${JSON.stringify(body,null,2)}${matched[3]}`);
}
const inputs=[{id:'original',source:original},{id:'discarded-active-base-changed',source:mutateActive(original)},
 {id:'discarded-history-changed',source:original.replace('retained historical revision 1','independently changed retained history 1')}];
const extension=[];
const pack={...api.getPackForAssetClass('multifamily'),id:'research.rfc0089.source-accounting',version:'0.0.0-research',calculations:[{id:'constant-control',label:'Nonfinancial constant control',formula:'1',deterministic:true}]};
const receipt=await modules.receipts.issueReceipt(original,{filename:'research.uwx.md',pack,issued_at:'2026-10-17T00:00:00Z',issuer:'research-only',engine:'research-only.source-accounting',engine_version:'0.0.0-research'});
for(const item of inputs){
 const scanned=[];
 const parsed=modules.parser.parseUWFile(item.source,{onBlock:block=>scanned.push(block)});
 const subject=await modules.receipts.resolveReceiptSubject(item.source,{filename:'research.uwx.md'});
 const verdict=await modules.receipts.verifyReceipt(receipt,item.source,{filename:'research.uwx.md',packs:[pack],engine:'research-only.source-accounting',engine_version:'0.0.0-research'});
 extension.push({id:item.id,source:item.source,source_sha256:hash(item.source),physical_blocks:scanned.map(b=>({annotation:b.annotation,revision:b.meta.lifecycle.revision,superseded:b.meta.lifecycle.superseded,raw_json_sha256:hash(b.rawJson),note:b.content.note})),
  retained_extension:parsed.extensions.x_review,retained_history:parsed.superseded.x_review??[],sections_keys:Object.keys(parsed.sections),
  receipt_subject:subject.subject,receipt_canonical:subject.canonical,receipt_verification:verdict,
  document_signing_subject:await observe(()=>modules['document-signatures'].resolveDocumentSigningSubject(item.source))});
}
assert.equal(extension[0].physical_blocks.length,4);
assert.equal(extension[0].retained_extension.annotation.variant,'detail/~');
assert.deepEqual(extension.map(e=>e.retained_history.length),[0,0,0]);
assert.ok(extension.every(e=>e.receipt_subject.digest===extension[0].receipt_subject.digest));
assert.ok(extension.every(e=>e.receipt_verification.verdict==='verified'));
assert.ok(new Set(extension.map(e=>e.source_sha256)).size===3);
function miniBlock(section,label,revision,superseded=false){
 const body={_meta:{section,provenance:{source:'manual',actor:'reviewer',timestamp:'2026-10-17T00:00:00Z'},quality:{confidence:'high',human_review_required:false},lifecycle:{revision,superseded}},label};
 return `\`\`\`json uw:section=${section} v=${revision}${superseded?' superseded=true':''}\n${JSON.stringify(body,null,2)}\n\`\`\`\n`;
}
const selectionInputs=[];
for(const section of ['property','x_review']){
 const current=miniBlock(section,'current',2);
 const history=miniBlock(section,'explicit-history',1,true);
 for(const [id,blocks] of [['current-then-history',[current,history]],['history-then-current',[history,current]],
  ['higher-then-lower',[miniBlock(section,'higher-first',2),miniBlock(section,'lower-last',1)]],
  ['equal-revision',[miniBlock(section,'tie-first',1),miniBlock(section,'tie-last',1)]]]){
  selectionInputs.push({id:`${section}/${id}`,section,source:`---\nuw_version: "3.0"\ndeal_id: "selection-control"\ndeal_name: "Selection evidence"\n---\n${blocks.join('\n')}`});
 }
}
const selection=[];
for(const input of selectionInputs){
 const physical=[];const parsed=modules.parser.parseUWFile(input.source,{onBlock:b=>physical.push(b)});
 const retained=input.section==='x_review'?parsed.extensions.x_review:parsed.sections.property;
 const subject=await modules.receipts.resolveReceiptSubject(input.source,{filename:'selection.uwx.md'});
 selection.push({...input,source_sha256:hash(input.source),physical_blocks:physical.map(b=>({annotation:b.annotation,meta:b.meta,label:b.content.label})),
  retained:retained??null,history:parsed.superseded[input.section]??[],receipt_subject:subject.subject,
  classification:'Current behavior observation; not authority over accepted last-non-superseded wording or owner-approved history policy'});
}
const empty=JSON.parse(readFileSync(join(here,'candidate-preimages.json'),'utf8')).vectors.find(v=>v.name==='historical-empty').semantic_value;
const unicodeInputs=[];
for(const location of ['value','key'])for(const [label,text] of [['high-d800','\ud800'],['high-d801','\ud801'],['low-dc00','\udc00'],['replacement','\ufffd'],['valid-pair','\ud83d\ude00']]){
 unicodeInputs.push({id:`${location}-${label}`,location,label,value:location==='value'?{value:text}:{[text]:'same'}});
}
unicodeInputs.push({id:'two-distinct-invalid-keys',location:'key',label:'two-invalid',value:{['\ud800']:1,['\ud801']:2}});
const unicode=[];
for(const item of unicodeInputs){
 const model=copy(empty);model.frontmatter.x_probe=item.value;
 const before=JSON.stringify(model);
 const canonical=modules.envelope.canonicalizeUWEnvelope(model);
 const utf8=Buffer.from(new TextEncoder().encode(canonical));
 const stamped=await modules.envelope.stampEnvelopeDigest(model);
 const verified=await observe(()=>modules.uwjson.parseUWJsonVerified(JSON.stringify(stamped)));
 const lowCanonical=modules['integrity-canonical'].canonicalize(item.value);
 unicode.push({...item,schema:schemaObservation(model),canonical_text:canonical,canonical_utf16_units:Array.from({length:canonical.length},(_,i)=>canonical.charCodeAt(i)),utf8_hex:utf8.toString('hex'),semantic_digest:stamped.semantic_digest,
  low_level_canonical_text:lowCanonical,low_level_utf8_hex:Buffer.from(lowCanonical,'utf8').toString('hex'),low_level_sha256:await modules.integrity.sha256TextHex(lowCanonical),
  verified_json:verified,input_unchanged:JSON.stringify(model)===before});
 assert.equal(JSON.stringify(model),before);
}
for(const location of ['value','key']){
 const group=unicode.filter(v=>v.location===location&&['high-d800','high-d801','low-dc00','replacement'].includes(v.label));
 assert.equal(new Set(group.map(v=>v.semantic_digest)).size,1,`${location} replacement-byte collision`);
 assert.equal(new Set(group.map(v=>v.canonical_text)).size,4,`${location} distinct UTF16 preimages`);
 assert.ok(group.every(v=>v.schema.accepted&&v.verified_json.returned));
}
const singletonSource=readFileSync(join(here,'codec-examples/single/original.uwx.md'),'utf8');
const singleton=modules.envelope.toUWEnvelope(modules.parser.parseUWFile(singletonSource),{generator:'research-only',generatedAt:frozen.csv_block_extras.observations[0].input.generated_at});
singleton.extra_top={retained:'top-level-control'};
singleton.extensions.x_review.content.extra_payload={retained:'payload-control'};
const withExtra=copy(singleton);withExtra.extensions.x_review.extra={witness:'schema-admitted block member'};
const csv=[];
for(const [id,value] of [['without-block-extra',singleton],['with-block-extra',withExtra]]){
 const before=JSON.stringify(value);const schema=schemaObservation(value);
 const stamped=await modules.envelope.stampEnvelopeDigest(value);
 const verifiedJson=await observe(()=>modules.uwjson.parseUWJsonVerified(JSON.stringify(stamped)));
 const bundle=await modules.uwcsv.encodeUWCSVBundle(value);
 const decoded=await observe(()=>modules.uwcsv.decodeUWCSVBundle(bundle));
 const zip=await modules.uwcsv.encodeUWCSVZip(value);
 const zipDecoded=await observe(()=>modules.uwcsv.decodeUWCSVZip(zip));
 csv.push({id,input:value,schema,semantic_digest:stamped.semantic_digest,verified_json:verifiedJson,bundle,
  file_hashes:Object.fromEntries(Object.entries(bundle.files).map(([name,text])=>[name,hash(text)])),
  directory_decode:decoded,zip_sha256:hash(zip),zip_bytes:zip.length,zip_decode:zipDecoded,input_unchanged:JSON.stringify(value)===before});
 assert.ok(schema.accepted);assert.ok(verifiedJson.returned);assert.equal(JSON.stringify(value),before);
 if(id==='with-block-extra'){
  assert.equal(decoded.code,'CSV_DIGEST_MISMATCH');assert.equal(zipDecoded.code,'CSV_DIGEST_MISMATCH');
 }else{assert.ok(decoded.returned);assert.ok(zipDecoded.returned);}
}
const python=JSON.parse(execFileSync('python',[join(here,'astra-review-python.py'),runtime],{input:JSON.stringify({sources:inputs,selection:selectionInputs,unicode:unicodeInputs}),encoding:'utf8'}));
assert.ok(python.sources.every(r=>r.physical_block_count===4&&r.envelope_digest.refused==='EnvelopeError'));
assert.ok(python.sources.every((r,i)=>r.source_sha256===hash(inputs[i].source)),'Python must receive the exact original UTF-8 source');
for(const row of python.unicode.filter(r=>r.id.endsWith('replacement')||r.id.endsWith('valid-pair'))){
 const observed=unicode.find(r=>r.id===row.id);
 assert.equal(row.result.utf8_hex,observed.low_level_utf8_hex,'Valid Unicode must be identical across implementations');
}
assert.ok(python.sources.every(r=>Object.keys(r.projection.extensions.x_review).join(',')==='base,detail/~'&&r.projection.superseded.x_review.length===2));
assert.ok(python.unicode.filter(r=>!r.id.endsWith('replacement')&&!r.id.endsWith('valid-pair')).every(r=>r.result.refused==='CanonicalizationError'));
for(const path of sourcePaths)assert.equal(hash(readFileSync(join(runtime,path))),sourceHashes[path],`Changed protected input ${path}`);
const result={scope:'UNACCEPTED EXTERNAL REVIEW REPRODUCTION; no normative/source/schema/version changes',pinned_main:pin,
 runtime:{node:process.version,v8:process.versions.v8,platform:process.platform,architecture:process.arch,ajv:requireRuntime('ajv/package.json').version},
 external_review:reportPath?{name:basename(reportPath),sha256:hash(readFileSync(reportPath)),authority:'external unverified claims until independently reproduced'}:null,
 source_hashes:sourceHashes,built_module_hashes:Object.fromEntries(sources.map(name=>[`${name}.js`,hash(readFileSync(join(runtime,`packages/uwmd-verify/dist/${name}.js`)))])),
 normative_reference:{uri:'https://www.rfc-editor.org/rfc/rfc8785.txt',sections:['3.1','3.2.2.2','3.2.3','3.2.4'],interpretation:'JCS string admission covers values and property names, rejects lone surrogates, preserves valid Unicode without normalization, then encodes UTF8.'},
 extension_projection:{classification:'Verified',receipt,observations:extension},selection_controls:selection,unicode_admission:{classification:'Verified',observations:unicode},
 csv_block_extras:{classification:'Verified',observations:csv},independent_python:python,
 limitations:['One Node/Windows runtime and one Python runtime, not cross-platform conformance','A valid-schema JSON string is not necessarily valid JCS/I-JSON','The unchanged receipt uses a synthetic constant pack to isolate subject projection, not financial verification coverage','The controlled invalid-Unicode equal digest is caused by replacement before hashing, not a SHA256 collision','No extension/Envelope/domain or historical subject correction is activated']};
if(outputPath){
 if(existsSync(outputPath))throw new Error('Refusing to overwrite frozen evidence');
 writeFileSync(outputPath,`${JSON.stringify(result,null,2)}\n`);
}else{
 const material=value=>{
  const {runtime:_runtime,built_module_hashes:_built,external_review:_external,independent_python,...observations}=value;
  const {python:_python,...pythonObservations}=independent_python;
  return {...observations,independent_python:pythonObservations};
 };
 assert.deepEqual(copy(material(result)),copy(material(frozen)),'Material observations differ from frozen evidence');
}

console.log(JSON.stringify({extension_sources:extension.length,unicode_probes:unicode.length,csv_controls:csv.length,python_source_probes:python.sources.length,selection_controls:selection.length,output:outputPath??'read-only frozen comparison'}));
