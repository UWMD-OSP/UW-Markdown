import ts from 'typescript';
import {execFileSync} from 'node:child_process';import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,dirname,basename,resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';import {gunzipSync} from 'node:zlib';import assert from 'node:assert/strict';
const base='fa9a9ea37d31b918f5993eae4276b159f31719f3';const git=(...args)=>execFileSync('git',args,{maxBuffer:256*1024*1024});const names=git('ls-tree','-r','--name-only',base).toString().trim().split('\n').filter(x=>/\.(?:uwx|uwpart|uw)\.md$/.test(x));
const temp=mkdtempSync(join(tmpdir(),'uwmd-0095-independent-population-'));const sha=b=>createHash('sha256').update(b).digest('hex');
try{writeFileSync(join(temp,'package.json'),'{"type":"module"}');for(const name of ['types','yaml-scalar','parser']){const bytes=git('show',`${base}:packages/uwmd-verify/src/${name}.ts`);writeFileSync(join(temp,`${name}.js`),ts.transpileModule(bytes.toString(),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText);}
 const {parseUWFile,parsedPhysicalBlocks}=await import(pathToFileURL(join(temp,'parser.js')));const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);const own=(x,k)=>object(x)&&Object.hasOwn(x,k);let parsed=0;
let lite=0;
let physical=0;
let current=0;
let parents=0;const refused=[];
const newly=[];
const triggers=[];
const sources=[];
 for(const path of names){const bytes=git('show',`${base}:${path}`);sources.push({path,sha256:sha(bytes)});if(path.endsWith('.uw.md')){lite++;continue;}let doc;try{doc=parseUWFile(bytes.toString());}catch(error){refused.push({path,code:error.code??error.name});continue;}parsed++;const old=new Set(Object.values(doc.sections).flatMap(x=>own(x,'annotation')?[x]:Object.values(x)));const visible=[...old,...Object.values(doc.superseded).flat(),...doc.pipeline_log,...doc.custom_calculations,...doc.custom_scenarios,...Object.values(doc.extensions)];const kept=parsedPhysicalBlocks(doc);physical+=kept.length;current+=old.size;const union=[...new Set([...kept,...visible])];for(const block of union){const c=block.content;
const m=c?._meta;const admitted=object(c)&&!Object.hasOwn(c,'section_id')&&own(c,'_meta')&&object(m)&&object(m.provenance)&&object(m.lifecycle);if(!old.has(block)){parents+=admitted?1:0;newly.push({path,line:block.lineStart,section:block.annotation.section,variant:block.annotation.variant??null,parent_admitted:admitted});}if(!admitted)continue;const p=m.provenance;const tags=new Set(own(p,'resolution')?[p.resolution]:[]);if(Array.isArray(c._overrides))for(const x of c._overrides)if(own(x,'resolution'))tags.add(x.resolution);for(const [tag,ref]of[['market_data_accepted','market_data_ref'],['inherited_assumption','inherited_from']])if(tags.has(tag))triggers.push({path,line:block.lineStart,tag,ref,present:own(p,ref),value:p[ref]});}}
 const result={observer:'Independent root observer; separate code, fresh exact-base parser, no candidate activation',base,inputs:names.length,parsed,lite,refused,physical,current,new_references:newly.length,new_source_count:new Set(newly.map(x=>x.path)).size,new_parent_admitted:parents,newly,triggers,sources};const primary=JSON.parse(readFileSync(new URL('./2026-10-17-validation-diagnostic-gap-354.attribution-population-0095.json',import.meta.url)));
const full=JSON.parse(gunzipSync(readFileSync(new URL('./2026-10-17-validation-diagnostic-gap-354.attribution-population-0095.all-records.json.gz',import.meta.url))));
assert.deepEqual(sources,full.files.map(x=>({path:x.path,sha256:x.sha256})));
const rowKey=x=>JSON.stringify([x.path,x.line,x.section,x.variant,x.parent_admitted??x.metadata_gate==='admitted']);
assert.deepEqual(newly.map(rowKey).sort(),primary.newly_assessed_records.map(rowKey).sort());
assert.equal(physical,primary.summary.standalone.physical);assert.equal(current,primary.summary.standalone.old_sections);
assert.equal(parsed,primary.summary.standalone.operations);assert.equal(lite,55);assert.equal(parents,87);
const profile=JSON.parse(readFileSync(new URL('./2026-10-17-validation-diagnostic-gap-354.0095-date-only.schema.proposed.json',import.meta.url)));
assert.equal(triggers.length,1);assert.equal(triggers[0].present,true);assert.equal(typeof triggers[0].value.as_of,'string');assert.ok(new RegExp(profile.pattern).test(triggers[0].value.as_of));
const report={...result,newly:undefined,sources:undefined,node:process.version,platform:process.platform,source_hashes_equal:880,newly_assessed_rows_equal:89,source_manifest_sha256:sha(JSON.stringify(sources)),newly_rows_sha256:sha(JSON.stringify(newly.map(rowKey).sort())),observed_market_ref_U3_valid:true};
if(process.argv[2])writeFileSync(process.argv[2],`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify(report,null,2));

}finally{assert.equal(resolve(dirname(temp)),resolve(tmpdir()));assert.ok(basename(temp).startsWith('uwmd-0095-independent-population-'));rmSync(temp,{recursive:true,force:true});}