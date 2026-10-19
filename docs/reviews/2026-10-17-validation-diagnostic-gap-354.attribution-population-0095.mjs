/** Read-only draft RFC0095 U1/U2 census. Never a validator or baseline updater.
 * node <this-file> --typescript <installed-typescript/lib/typescript.js> --output <report.json>
 * All corpus/runtime input is read from BASE Git blobs, never working-tree dist.
 * Writes --output and its .all-records.json.gz companion; the runtime is temporary.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir, platform, release } from 'node:os';
import { basename, dirname, join, resolve, posix } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const args = process.argv.slice(2);
const arg = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const ROOT = resolve(arg('--repo', fileURLToPath(new URL('../../', import.meta.url))));
const BASE = arg('--base', 'fa9a9ea37d31b918f5993eae4276b159f31719f3');
const DRAFT = 'cf3112951537fe0b69f1f06239fcc3330e6303c6';
const DRAFT_PATH = 'docs/rfcs/0095-optional-metadata-and-provenance-references.md';
const output = resolve(arg('--output', join(ROOT, 'docs/reviews/2026-10-17-validation-diagnostic-gap-354.attribution-population-0095.json')));
const git = (...parts) => execFileSync('git', parts, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
const sha = value => createHash('sha256').update(value).digest('hex');
const testEvidencePaths = ['packages/uwmd-verify/src/validator.section-readiness.test.ts', 'packages/uwmd-verify/src/market-data.test.ts', 'packages/uwmd-core/src/cascade.market-data.test.ts'];
const sourcePaths = git('ls-tree', '-r', '--name-only', BASE).toString().trim().split(/\r?\n/).filter(p => /\.(?:uwx|uwpart|uw)\.md$/.test(p));
const requested = [...new Set([...sourcePaths, ...['parser', 'types', 'yaml-scalar', 'composition', 'protocol', 'gaps-content', 'metadata', 'validator'].map(p => `packages/uwmd-verify/src/${p}.ts`), ...testEvidencePaths, ...['0090-provenance-actor-admission', '0091-required-metadata-booleans', '0093-metadata-shape-diagnostics'].map(p => `docs/rfcs/${p}.md`)])].sort();
// Read original blob bytes in one process. No filesystem encoding/newline conversion.
const packed = execFileSync('git', ['cat-file', '--batch'], { cwd: ROOT, input: requested.map(p => `${BASE}:${p}\n`).join(''), maxBuffer: 64 * 1024 * 1024 });
let offset = 0;
const blobs = new Map();
for (const path of requested) {
  const eol = packed.indexOf(10, offset);
  const header = packed.subarray(offset, eol).toString();
  assert.match(header, /^[a-f0-9]+ blob \d+$/);
  const size = Number(header.split(' ')[2]);
  const bytes = packed.subarray(eol + 1, eol + 1 + size);
  blobs.set(path, bytes); offset = eol + size + 2;
}
const utf8 = bytes => new TextDecoder('utf-8', { fatal: true }).decode(bytes);
const code = name => utf8(blobs.get(`packages/uwmd-verify/src/${name}.ts`));
const require = createRequire(import.meta.url);
const compilerPath = arg('--typescript', undefined);
const ts = require(compilerPath ?? 'typescript');
const temp = mkdtempSync(join(tmpdir(), 'uwmd-0095-census-'));
const emitted = [];
const cleanup=()=>{ assert.equal(dirname(temp),resolve(tmpdir())); assert.ok(basename(temp).startsWith('uwmd-0095-census-')); rmSync(temp,{recursive:true,force:true}); };
let parser, composition, protocol, metadata, checkDataQuality;
try {
  writeFileSync(join(temp, 'package.json'), '{"type":"module"}\n');
  for (const name of ['parser', 'types', 'yaml-scalar', 'composition', 'protocol', 'gaps-content', 'metadata']) {
    const result = ts.transpileModule(code(name), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
    writeFileSync(join(temp, `${name}.js`), result); emitted.push({ module: name, source_sha256: sha(code(name)), emitted_sha256: sha(result) });
  }
  parser = await import(pathToFileURL(join(temp, 'parser.js')).href);
  composition = await import(pathToFileURL(join(temp, 'composition.js')).href);
  protocol = await import(pathToFileURL(join(temp, 'protocol.js')).href);
  metadata = await import(pathToFileURL(join(temp, 'metadata.js')).href);
  const gaps = await import(pathToFileURL(join(temp, 'gaps-content.js')).href);
  // Execute the actual unchanged function, not a hand-copied attribution oracle.
  // Its two local dependencies are also read from the exact validator AST.
  const ast = ts.createSourceFile('validator.ts', code('validator'), ts.ScriptTarget.Latest, true);
  const functionText = name => {
    const node = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
    assert.ok(node, name); return node.getText(ast).replace(/^export\s+/, '');
  };
  const dqSource = `${functionText('isVariantMap')}\n${functionText('checkDataQuality')}`;
  const js = ts.transpileModule(dqSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  const constant = code('validator').match(/const DEFAULT_GAP_STALENESS_DAYS = (\d+);/);
  assert.ok(constant);
  checkDataQuality = new Function('readGapsContent', 'BUILTIN_INCOMPLETE_DATA_POLICIES', 'lookupIncompleteDataPolicy', 'blockOverrides', 'DEFAULT_GAP_STALENESS_DAYS', `${js}\nreturn checkDataQuality;`)(gaps.readGapsContent, protocol.BUILTIN_INCOMPLETE_DATA_POLICIES, protocol.lookupIncompleteDataPolicy, metadata.blockOverrides, Number(constant[1]));
} catch (error) { cleanup(); throw error; }
const own = (o, key) => o !== null && typeof o === 'object' && Object.hasOwn(o, key);
const object = o => o !== null && typeof o === 'object' && !Array.isArray(o);
const kind = o => o === null ? 'null' : Array.isArray(o) ? 'array' : typeof o;
const errorView = e => ({ name: e.name, code: e.code ?? null, message: String(e.message) });
function modelEntries(p) {
  const a = [];
  for (const [id, entry] of Object.entries(p.sections)) for (const [key,b] of own(entry, 'annotation') ? [['single', entry]] : Object.entries(entry)) a.push([`sections.${id}.${key}`, b]);
  for (const [id, blocks] of Object.entries(p.superseded)) blocks.forEach((b,i) => a.push([`superseded.${id}[${i}]`,b]));
  for (const id of ['pipeline_log','custom_calculations','custom_scenarios']) p[id].forEach((b,i) => a.push([`${id}[${i}]`,b]));
  for (const [id,b] of Object.entries(p.extensions)) a.push([`extensions.${id}`,b]);
  return a;
}
function metaGate(b) {
  const m=b.content?._meta;
  if (own(b.content,'section_id')) return 'retired-wrapper';
  if (!own(b.content,'_meta')) return 'whole-meta-absent';
  if (!object(m)) return 'rejected-meta';
  if (!object(m.provenance)) return 'rejected-provenance';
  if (!object(m.lifecycle)) return 'rejected-lifecycle';
  return 'admitted';
}
function carrier(p,name,required) {
  const present=own(p,name), value=present ? p[name] : undefined, failures=[];
  if (!present) { if (required) failures.push(`${name}.required_absent`); return { presence:'absent',failures }; }
  if (!object(value)) return { presence:kind(value),failures:[`${name}.object`] };
  const fields=name==='inherited_from' ? ['document_id','digest','distance'] : ['document_id','as_of','digest','rationale'];
  for (const key of fields) {
    if (key==='rationale' && !own(value,key)) continue;
    let valid=own(value,key) && typeof value[key]==='string';
    if (key==='digest') valid=valid && value[key].length===71 && /^sha256:[a-f0-9]{64}$/.test(value[key]);
    if (key==='distance') valid=own(value,key) && typeof value[key]==='number' && Number.isFinite(value[key]) && Number.isInteger(value[key]) && value[key]>=1;
    if (!valid) failures.push(`${name}.${key}.${own(value,key)?'invalid':'absent'}`);
  }
  return { presence:'object',value,failures };
}
function classify(path) {
  const location=path.startsWith('conformance/') ? 'conformance' : path.startsWith('examples/') ? 'examples' : 'documentation';
  let intent='fixture intent not inferred';
  if (path.includes('/malformed/') || path.includes('/reject/')) intent='intentionally invalid by explicit malformed/reject directory';
  else if (/\/(?:bad|wrong|reject|refuse|invalid)[^/]*\//.test(path) || /\.(?:bad|wrong)[^/]*\.uwx\.md$/.test(path)) intent='negative intent inferred from path';
  else if (location==='examples') intent='published example location; metadata validity not inferred';
  else if (/template|AFTER/.test(path)) intent='authored output template by path; not observed producer output';
  return { location,intent,intent_basis:'path only; no new fixture assertions or positive-validity promise inferred' };
}
const fileRows=[],operations=[],sourceModels=new Map(),parts=new Map(),recordOrigin=new WeakMap();
function snapshot(p, operationId) {
  const model=modelEntries(p), old=new Set(model.filter(([s])=>s.startsWith('sections.')).map(([,b])=>b));
  const physical=parser.parsedPhysicalBlocks(p), refs=[...new Set([...physical,...model.map(([,b])=>b)])];
  const rows=refs.map((b,i)=>{
    const paths=model.filter(([,v])=>v===b).map(([s])=>s), m=b.content?._meta, provenance=object(m)&&object(m.provenance)?m.provenance:{};
    const overrideValue=b.content?._overrides, overrides=Array.isArray(overrideValue)?overrideValue:[];
    const triggers={ inherited_assumption:[],market_data_accepted:[] };
    if (own(provenance,'resolution') && Object.hasOwn(triggers,provenance.resolution)) triggers[provenance.resolution].push('_meta.provenance.resolution');
    overrides.forEach((o,j)=>{if(object(o)&&own(o,'resolution')&&Object.hasOwn(triggers,o.resolution)) triggers[o.resolution].push(`_overrides[${j}].resolution`);});
    const gate=metaGate(b), admitted=gate==='admitted';
    const inherited=carrier(provenance,'inherited_from',triggers.inherited_assumption.length>0), market=carrier(provenance,'market_data_ref',triggers.market_data_accepted.length>0);
    const findings=admitted?[...inherited.failures,...market.failures]:[];
    const legacyProvenance=b.meta?.provenance;
    let oldMarket;
    try { oldMarket={ triggers:legacyProvenance?.resolution==='market_data_accepted'||metadata.blockOverrides(b).some(o=>o.resolution==='market_data_accepted') }; oldMarket.missing_falsy=oldMarket.triggers&&!legacyProvenance?.market_data_ref; }
    catch(error){oldMarket={refusal:errorView(error)};}
    const origin=recordOrigin.get(b) ?? { path:operationId, line:b.lineStart, model_only:true };
    const row={ ref:i, origin, section:b.annotation.section, variant:own(b.annotation,'variant')?b.annotation.variant:null, physical:physical.includes(b), model_paths:paths, old_sections_population:old.has(b), newly_assessed:!old.has(b), metadata_gate:gate,
      canonical_resolution_presence:own(provenance,'resolution')?kind(provenance.resolution):'absent',canonical_resolution:own(provenance,'resolution')?provenance.resolution:null,
      overrides:{presence:own(b.content,'_overrides')?kind(overrideValue):'absent',entries:overrides.map((o,j)=>({ index:j,type:kind(o),path:object(o)&&own(o,'path')?o.path:null,resolution:object(o)&&own(o,'resolution')?o.resolution:null }))},
      triggers,inherited_from:inherited,market_data_ref:market,
      candidate_failures:findings,suppressed_by_parent:admitted?[]:[...inherited.failures,...market.failures],legacy_market:oldMarket };
    return row;
  });
  const actual=[];let actualRefusal=null;
  try{checkDataQuality(p,actual,{now:'2026-10-18T00:00:00.000Z'});}catch(error){actualRefusal=errorView(error);}
  const predicted=rows.filter(r=>r.old_sections_population&&r.legacy_market.missing_falsy).length;
  const actualAttribution=actual.filter(x=>x.code==='DQ-06'&&x.severity==='error');
  if(!actualRefusal) assert.equal(actualAttribution.length,predicted,operationId);
  return { id:operationId, physical_count:physical.length, model_refs:new Set(model.map(([,b])=>b)).size, union_count:refs.length, old_sections_count:old.size,newly_assessed:rows.filter(r=>r.newly_assessed).length,actual_dq06_error:actualAttribution,actual_dq_refusal:actualRefusal,blocks:rows };
}
try {
 for(const path of sourcePaths){
  const bytes=blobs.get(path), file={path,sha256:sha(bytes),...classify(path)};fileRows.push(file);
  if(path.endsWith('.uw.md')){file.status='outside-fenced-source-census';file.reason='UW Lite has no authored fenced-JSON physical population; compilation/current MODEL boundary is separate.';continue;}
  let p;
  try{p=parser.parseUWFile(utf8(bytes));file.status='parsed';}
  catch(error){file.status='parser-refused';file.refusal=errorView(error);continue;}
  const physical=parser.parsedPhysicalBlocks(p);
  physical.forEach(b=>recordOrigin.set(b,{path,line:b.lineStart,source_model_paths:modelEntries(p).filter(([,v])=>v===b).map(([name])=>name)}));
  file.non_strict_json_placeholders=physical.filter(b=>own(b.content,'_parse_error')).map(b=>b.lineStart);
  const operation=snapshot(p,path);operations.push(operation);sourceModels.set(path,p);
  if(path.endsWith('.uwpart.md')){try{const part=composition.parseUWPart(p,{filename:path});parts.set(path,part);file.part_status='admitted';file.part_id=part.part_id;}catch(error){file.part_status='refused';file.part_refusal=errorView(error);}}
 }
 // Local package directory associations only. Never invent a corpus-wide part map.
 const composed=[];
 for(const [path,p] of sourceModels){
  if(path.endsWith('.uwpart.md'))continue;
  if(!modelEntries(p).some(([name,b])=>name.startsWith('sections.')&&(own(b.content,'external')||b.annotation.external===true)))continue;
  const folder=posix.dirname(path), partFolder=folder.endsWith('/records')?posix.join(folder,'../parts'):posix.join(folder,'parts');
  const candidates=fileRows.filter(f=>f.path.endsWith('.uwpart.md')&&posix.dirname(f.path)===partFolder);
  const entry={root:path,association_basis:'Explicit local parts directory; sibling ../parts for records/. Path-derived association, not a universal resolver.',loaded:candidates.map(f=>f.path),status:null};
  const map=new Map(),invalid=[];
  for(const candidate of candidates){const part=parts.get(candidate.path);if(!part){invalid.push(candidate.path);continue;}if(map.has(part.part_id)){invalid.push(candidate.path);continue;}map.set(part.part_id,part);}
  if(invalid.length){entry.status='part-load-refused';entry.invalid_or_duplicate_parts=invalid;composed.push(entry);continue;}
  const resolved=composition.resolveComposition(p,{parts:map});entry.status=resolved.status;entry.issues=resolved.issues;entry.externalized=resolved.externalized;
  if(resolved.status==='resolved'){
    const view=snapshot(resolved.document,`${path}::resolved`);entry.operation=view;
    const retained=new Set(parser.parsedPhysicalBlocks(resolved.document));
    entry.consumed=candidates.filter(f=>parser.parsedPhysicalBlocks(sourceModels.get(f.path)).some(b=>retained.has(b))).map(f=>f.path);
    entry.unused_loaded=candidates.map(f=>f.path).filter(x=>!entry.consumed.includes(x));
  }
  composed.push(entry);
 }
 function summary(ops){const blocks=ops.flatMap(o=>o.blocks),newly=blocks.filter(b=>b.newly_assessed),count=a=>Object.fromEntries([...a.reduce((m,x)=>m.set(x,(m.get(x)??0)+1),new Map())].sort());
  return {operations:ops.length,physical:ops.reduce((n,o)=>n+o.physical_count,0),union:blocks.length,old_sections:blocks.filter(b=>b.old_sections_population).length,newly_assessed:newly.length,newly_by_collection:count(newly.map(b=>b.model_paths.length?b.model_paths[0].split('.')[0].replace(/\[.*/, ''):b.origin.source_model_paths?.length?'physical-original-replaced-in-projection':'physical-only-overwritten')),newly_source_locations:count(newly.map(b=>classify(b.origin.path).location)),newly_source_intents:count(newly.map(b=>classify(b.origin.path).intent)),newly_source_count:new Set(newly.map(b=>b.origin.path)).size,triggered_blocks:count(blocks.flatMap(b=>Object.entries(b.triggers).filter(([,paths])=>paths.length).map(([name])=>name))),trigger_assertions:count(blocks.flatMap(b=>Object.entries(b.triggers).flatMap(([name,paths])=>paths.map(()=>name)))),newly_triggered_blocks:count(newly.flatMap(b=>Object.entries(b.triggers).filter(([,paths])=>paths.length).map(([name])=>name))),carriers:{inherited_from:count(blocks.map(b=>b.inherited_from.presence)),market_data_ref:count(blocks.map(b=>b.market_data_ref.presence))},metadata_gates:count(blocks.map(b=>b.metadata_gate)),newly_metadata_gates:count(newly.map(b=>b.metadata_gate)),candidate_failures:count(blocks.flatMap(b=>b.candidate_failures)),newly_candidate_failures:count(newly.flatMap(b=>b.candidate_failures)),newly_affected_blocks:newly.filter(b=>b.candidate_failures.length).length,newly_affected_sources:[...new Set(newly.filter(b=>b.candidate_failures.length).map(b=>b.origin.path))],actual_dq06_errors:ops.reduce((n,o)=>n+o.actual_dq06_error.length,0),actual_dq_refusals:ops.filter(o=>o.actual_dq_refusal).map(o=>({id:o.id,...o.actual_dq_refusal}))};}
 // Bounded independently authored controls pin the census mechanics, not the live contract.
 const controls=[];
 const meta=(section,changes={})=>({section,provenance:{actor:'census-control',source:'manual',resolution:'user_input'},quality:{confidence:'high',human_review_required:false},lifecycle:{revision:1,superseded:false},...changes});
 const fence=(section,value,annotation='')=>'```json uw:section='+section+(annotation?' '+annotation:'')+'\n'+JSON.stringify(value)+'\n```\n';
 const front='---\nuw_version: "3.0"\ndeal_id: census_control\nasset_class: multifamily\n---\n';
 const block=(section,resolution,rest={})=>({_meta:meta(section,{provenance:{actor:'census-control',source:'manual',resolution}}),...rest});
 const addControl=(name,source,expectation,mutate)=>{
   const p=parser.parseUWFile(front+source);if(mutate)mutate(p);
   const view=snapshot(p,`authored-control:${name}`), failures=view.blocks.flatMap(b=>b.candidate_failures);
   assert.equal(failures.length,expectation.failures,name);
   if(expectation.newly!==undefined)assert.equal(view.newly_assessed,expectation.newly,name);
   if(expectation.old!==undefined)assert.equal(view.actual_dq06_error.length,expectation.old,name);
   controls.push({name,source_sha256:sha(front+source),expectation,observation:view});
 };
 const historical=block('property','market_data_accepted');historical._meta.lifecycle.superseded=true;
 addControl('historical-market-reference',fence('property',historical)+fence('property',block('property','user_input')),{failures:1,newly:1,old:0});
 addControl('overwritten-extension-market',fence('x_census',block('x_census','market_data_accepted'),'variant=a')+fence('x_census',block('x_census','user_input'),'variant=b'),{failures:1,newly:2,old:0});
 for(const section of ['pipeline_log','custom_calculations','custom_scenarios'])addControl(`append-${section}`,fence(section,block(section,'inherited_assumption')),{failures:1,newly:1,old:0});
 addControl('current-variants-already-assessed',fence('operating_statement',block('operating_statement','market_data_accepted'),'variant=t12')+fence('operating_statement',block('operating_statement','user_input'),'variant=year1'),{failures:1,newly:0,old:1});
 addControl('shadowed-inherited-override',fence('property',block('property','user_input',{_overrides:[{path:'a',resolution:'inherited_assumption'},{path:'a',resolution:'user_input'}]})),{failures:1,old:0});
 addControl('unmatched-market-override',fence('property',block('property','user_input',{_overrides:[{path:'no_such_payload',resolution:'market_data_accepted'}]})),{failures:1,old:1});
 addControl('both-triggers-duplicate-suppression',fence('property',block('property','market_data_accepted',{_overrides:[{path:'a',resolution:'market_data_accepted'},{path:'a',resolution:'inherited_assumption'},{path:'a',resolution:'inherited_assumption'}]})),{failures:2,old:1});
 const falsy=block('property','market_data_accepted');falsy._meta.provenance.market_data_ref=false;
 addControl('present-false-carrier-not-absence',fence('property',falsy),{failures:1,old:1});
 const optional=block('property','user_input');optional._meta.provenance.inherited_from={document_id:'d',digest:'bad',distance:0};
 addControl('stated-untriggered-carrier-typed-domain',fence('property',optional),{failures:2,old:0});
 const rejected=block('property','market_data_accepted');rejected._meta.lifecycle=null;
 addControl('old-parent-refusal-suppresses-new-carrier',fence('property',rejected),{failures:0,old:1});
 addControl('invalid-null-override-keeps-observed-runtime-refusal',fence('property',block('property','user_input',{_overrides:[null]})),{failures:0,old:0});
 assert.equal(controls.at(-1).observation.actual_dq_refusal?.name,'TypeError');
 const initial=block('property','market_data_accepted');initial._meta.provenance.market_data_ref={document_id:'d',as_of:'',digest:'sha256:'+'a'.repeat(64)};
 addControl('mutable-canonical-meta-replaces-convenience-cache',fence('property',initial),{failures:1,old:0},p=>{p.sections.property.content._meta=block('property','market_data_accepted')._meta;});
 addControl('exact-reference-dedup-vs-distinct-model-added',fence('property',block('property','user_input')),{failures:1,newly:1,old:0},p=>{const original=p.sections.property;p.extensions.x_alias=original;p.extensions.x_new={...original,annotation:{section:'x_new'},content:block('x_new','inherited_assumption')};});
 const copySource=parser.parseUWFile(front+fence('x_census',block('x_census','market_data_accepted'),'variant=a')+fence('x_census',block('x_census','user_input'),'variant=b'));
 const copyView=snapshot({...copySource},'authored-control:actual-copied-model');
 assert.equal(copyView.physical_count,0);assert.equal(copyView.union_count,1);assert.equal(copyView.blocks.flatMap(b=>b.candidate_failures).length,0);
 controls.push({name:'actual-copied-model',expectation:{physical:0,union:1,failures:0},observation:copyView});
 const manifest={schema:'read-only-rfc0095-attribution-population-v1',base:BASE,draft:DRAFT,draft_rfc_sha256:sha(git('show',`${DRAFT}:${DRAFT_PATH}`)),runtime:{node:process.version,typescript:ts.version,platform:platform(),os_release:release()},authority:requested.filter(x=>!sourcePaths.includes(x)).map(path=>({path,sha256:sha(blobs.get(path))})),transpiled_runtime:emitted,
  boundaries:{no_activation:true,scope:'Reference-attribution population only; not the full META-05/06 optional-field or conditional-agent-id inventory, full validation certification, or a prediction of all RFC0095 effects.',trigger_assumption:'Counterfactual canonical plus ANY own stated object-override resolution for BOTH inherited_assumption and market_data_accepted, including duplicate/shadowed/unmatched paths. This is not a new validator.',as_of:'String-only shape for inventory; calendar choice U3 remains unresolved. No date parser oracle.',old_population:'Only parsed.sections current single/variant blocks; convenience block.meta and current truthiness preserved in observed checkDataQuality.',new_population:'Exact-identity retained physical followed by current MODEL sections/superseded/pipeline_log/custom_calculations/custom_scenarios/extensions. No projected collection is silently dropped.',intent:'Location/path-derived classifications do not establish positive metadata validity or invent negative expectations.',excluded:'Embedded source literals in TS/Python/JSON test descriptions, ZIP members and generated Lite model blocks are not independent tracked fenced-source files. Standalone sources include test fixtures and templates where tracked with recognized suffixes.',parse:'Default accepted non-strict parser behavior is preserved. Parser refusals and non-strict malformed-JSON placeholders are listed separately. Parts are additionally passed through actual parseUWPart; invalid parts are never claimed as resolved.'},
  summary:{tracked_sources:sourcePaths.length,file_statuses:Object.fromEntries([...new Set(fileRows.map(f=>f.status))].sort().map(s=>[s,fileRows.filter(f=>f.status===s).length])),files_by_location:Object.fromEntries([...new Set(fileRows.map(f=>f.location))].sort().map(s=>[s,fileRows.filter(f=>f.location===s).length])),standalone:summary(operations),composition:{attempts:composed.length,statuses:Object.fromEntries([...new Set(composed.map(c=>c.status))].sort().map(s=>[s,composed.filter(c=>c.status===s).length])),resolved_population:summary(composed.filter(c=>c.operation).map(c=>c.operation))}},test_evidence:testEvidencePaths.map(path=>({path,sha256:sha(blobs.get(path)),scope:'Existing embedded test controls; not separately enumerated as source documents or assumed future expectations.'})),authored_controls:controls,files:fileRows,operations,composition:composed};
 const allBytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');
 const gzipPath=output.replace(/\.json$/,'.all-records.json.gz');assert.notEqual(gzipPath,output);
 const gz=gzipSync(allBytes,{level:9});mkdirSync(dirname(output),{recursive:true});writeFileSync(gzipPath,gz);
 const report={schema:manifest.schema,base:BASE,draft:DRAFT,draft_rfc_sha256:sha(git('show',`${DRAFT}:${DRAFT_PATH}`)),runtime:manifest.runtime,authority:manifest.authority,transpiled_runtime:emitted,boundaries:manifest.boundaries,summary:manifest.summary,
 full_record_evidence:{file:basename(gzipPath),gzip_sha256:sha(gz),decoded_json_sha256:sha(allBytes),decoded_bytes:allBytes.length},
 newly_assessed_records:operations.flatMap(o=>o.blocks.filter(b=>b.newly_assessed).map(b=>({operation:o.id,ref:b.ref,...b.origin,section:b.section,variant:b.variant,model_paths:b.model_paths,metadata_gate:b.metadata_gate,triggers:b.triggers,candidate_failures:b.candidate_failures,intent:classify(b.origin.path)}))),
 newly_assessed_composed_records:composed.flatMap(c=>(c.operation?.blocks??[]).filter(b=>b.newly_assessed).map(b=>({operation:c.root+'::resolved',ref:b.ref,...b.origin,section:b.section,variant:b.variant,model_paths:b.model_paths,metadata_gate:b.metadata_gate,triggers:b.triggers,candidate_failures:b.candidate_failures}))),
 relevant_reference_records:operations.flatMap(o=>o.blocks.filter(b=>Object.values(b.triggers).some(v=>v.length)||b.inherited_from.presence!=='absent'||b.market_data_ref.presence!=='absent').map(b=>({operation:o.id,...b}))),
 rejected_sources:fileRows.filter(f=>f.status==='parser-refused'||f.part_status==='refused'),composition:composed.map(({operation,...c})=>({...c,...(operation?{physical:operation.physical_count,union:operation.union_count,current_sections:operation.old_sections_count,newly_assessed:operation.newly_assessed,root_physical:operation.blocks.filter(b=>b.physical&&b.origin.path===c.root).length,part_physical:operation.blocks.filter(b=>b.physical&&b.origin.path!==c.root).length,synthesized:operation.blocks.filter(b=>!b.physical).length}:{} )})),
 authored_controls:controls.map(({name,expectation,source_sha256,observation:o})=>({name,source_sha256,expectation,observed:{physical:o.physical_count,union:o.union_count,newly_assessed:o.newly_assessed,candidate_failures:o.blocks.flatMap(b=>b.candidate_failures),actual_dq06_errors:o.actual_dq06_error.length,actual_dq_refusal:o.actual_dq_refusal}})),test_evidence:manifest.test_evidence};
 const json=JSON.stringify(report,null,2)+'\n';writeFileSync(output,json);
 console.log(JSON.stringify({output,sha256:sha(json),gzip_sha256:sha(gz),summary:manifest.summary},null,2));
}finally{cleanup();}
