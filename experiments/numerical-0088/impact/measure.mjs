// Candidate-specific measurement of existing assertions; never updates baselines.
import { readFileSync,writeFileSync,readdirSync,mkdtempSync,mkdirSync } from 'node:fs';
import { resolve,join,dirname,relative } from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync,execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const here=dirname(fileURLToPath(import.meta.url));
const arg=name=>{const i=process.argv.indexOf(name);if(i<0||!process.argv[i+1])throw new Error(`Required ${name}`);return process.argv[i+1];};
const repo=resolve(arg('--repo-root'));
const output=resolve(arg('--output'));
const candidate=resolve(arg('--candidate'));
const sha=value=>createHash('sha256').update(value).digest('hex');
const git=(...args)=>execFileSync('git',args,{cwd:repo,encoding:'utf8'}).trim();
const scratch=mkdtempSync(join(tmpdir(),'uwmd-0088-impact-'));
const corpusPath=join(repo,'conformance/corpus-index.json');
const corpus=JSON.parse(readFileSync(corpusPath,'utf8')).cases;
const key=c=>JSON.stringify([String(c.suite),c.scenario]);
const indexed=new Map(corpus.map(c=>[key(c),c]));
if(indexed.size!==corpus.length || corpus.length!==1106)throw new Error('Unexpected or duplicate corpus inventory; review measurement before running');
const tracked=git('ls-files','-z').split('\0').filter(Boolean);
const protectedPaths=tracked.filter(p=>/^(spec\/|conformance\/|packages\/|implementations\/|package(?:-lock)?\.json$|VERSIONS\.md$|CHANGELOG\.md$|releases\/)/.test(p));
const hashes=paths=>Object.fromEntries(paths.map(p=>[p,sha(readFileSync(join(repo,p)))]));
const protectedBefore=hashes(protectedPaths);
const ts=createRequire(join(repo,'package.json'))('typescript');
const distPaths=[];
for(const pkg of readdirSync(join(repo,'packages'),{withFileTypes:true}).filter(e=>e.isDirectory())){
 const base=join(repo,'packages',pkg.name,'dist');
 try { for(const path of readdirSync(base,{recursive:true}).filter(p=>p.endsWith('.js')&&!p.endsWith('.test.js')))distPaths.push(relative(repo,join(base,path)).replaceAll('\\','/')); }
 catch(error){if(error.code!=='ENOENT')throw error;}
}
const distBefore=hashes(distPaths.sort());
const staticSites=[];
for(const path of distPaths){
 const source=readFileSync(join(repo,path),'utf8');
 const ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 function inspect(node){
  const at=()=>`${path}:${ast.getLineAndCharacterOfPosition(node.getStart(ast)).line+1}:${ast.getLineAndCharacterOfPosition(node.getStart(ast)).character+1}`;
  if(ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.AsteriskAsteriskToken){
   const text=node.getText(ast);
   const bigint=/\bBigInt\s*\(|\b[0-9]+n\b/.test(text);
   staticSites.push({site:at(),path,op:'pow',excluded:bigint,text});
  }
  if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.expression.getText(ast)==='Math'&&['log','exp'].includes(node.expression.name.text))staticSites.push({site:at(),path,op:node.expression.name.text,excluded:false,text:node.getText(ast)});
  ts.forEachChild(node,inspect);
 }
 inspect(ast);
}

const candidates=[];
function walk(dir){for(const ent of readdirSync(dir,{withFileTypes:true})){const path=join(dir,ent.name);if(ent.isDirectory())walk(path);else candidates.push(path);}}
walk(dirname(candidate));
const candidateBefore=Object.fromEntries(candidates.sort().map(p=>[relative(dirname(candidate),p).replaceAll('\\','/'),sha(readFileSync(p))]));
const lines=path=>readFileSync(path,'utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line));
const runs={};
for(const mode of ['baseline','candidate']){
 const events=join(scratch,`${mode}.events.ndjson`);const transforms=join(scratch,`${mode}.transforms.ndjson`);
 writeFileSync(events,'');writeFileSync(transforms,'');
 const started=new Date().toISOString();
 const child=spawnSync(process.execPath,['--experimental-loader',pathToFileURL(join(here,'hook.mjs')).href,join(repo,'scripts/run-conformance.mjs'),'--json'],{
  cwd:repo,encoding:'utf8',maxBuffer:128*1024*1024,env:{...process.env,RESEARCH_REPO_ROOT:repo,RESEARCH_MODE:mode,RESEARCH_CANDIDATE:candidate,RESEARCH_EVENTS:events,RESEARCH_TRANSFORMS:transforms}});
 writeFileSync(join(scratch,`${mode}.stdout.json`),child.stdout??'');writeFileSync(join(scratch,`${mode}.stderr.txt`),child.stderr??'');
 if(child.error)throw child.error;
 if(![0,1].includes(child.status))throw new Error(`${mode} runner aborted ${child.status}: ${child.stderr}; scratch ${scratch}`);
 let report;try{report=JSON.parse(child.stdout);}catch{throw new Error(`${mode} stdout not JSON; scratch ${scratch}`);}
 const rows=new Map(report.results.map(c=>[key(c),c]));
 if(rows.size!==corpus.length || report.results.length!==corpus.length || report.summary.updated!==0 || corpus.some(c=>!rows.has(key(c))))throw new Error(`${mode} incomplete corpus report`);
 const observed=lines(events); const caseRows=observed.filter(e=>e.kind==='case');
 const cases=new Map(caseRows.map(c=>[key(c),c]));
 if(cases.size!==corpus.length || caseRows.length!==corpus.length || corpus.some(c=>!cases.has(key(c))))throw new Error(`${mode} incomplete/duplicate case captures`);
 if(caseRows.some(c=>c.capture_errors.length))throw new Error(`${mode} capture errors; scratch ${scratch}`);
 const transformed=lines(transforms);
 if(!transformed.some(t=>t.path==='scripts/run-conformance.mjs'&&t.snapshots.length>0))throw new Error('Runner instrumentation missing');
 const loadedPaths=new Set(transformed.map(t=>t.path));
 const transformedSites=new Set(transformed.flatMap(t=>t.replacements.map(r=>r.site)));
 for(const expected of staticSites.filter(s=>!s.excluded&&loadedPaths.has(s.path)))if(!transformedSites.has(expected.site))throw new Error(`Unclassified loaded numeric site ${expected.site}`);
 for(const actual of transformedSites)if(!staticSites.some(s=>!s.excluded&&s.site===actual))throw new Error(`Unexpected numeric replacement ${actual}`);
 if(mode==='baseline' && (child.status!==0||report.summary.fail!==0))throw new Error(`Instrumented baseline is not green; inspect ${scratch}`);
 runs[mode]={started,finished:new Date().toISOString(),exit_code:child.status,report,rows,cases,primitives:observed.filter(e=>e.kind==='primitive'),transformed,
  events_sha256:sha(readFileSync(events)),transforms_sha256:sha(readFileSync(transforms))};
 console.error(`${mode}: ${report.summary.pass} pass, ${report.summary.fail} fail, ${caseRows.length} indexed captures, ${runs[mode].primitives.length} primitive observations`);
}
const distAfter=hashes(distPaths);
if(JSON.stringify(distBefore)!==JSON.stringify(distAfter))throw new Error('Built dist inputs changed during measurement');
const protectedAfter=hashes(protectedPaths);
if(JSON.stringify(protectedBefore)!==JSON.stringify(protectedAfter))throw new Error('Protected source/schema/corpus/version inputs changed during measurement');
const candidateAfter=Object.fromEntries(candidates.sort().map(p=>[relative(dirname(candidate),p).replaceAll('\\','/'),sha(readFileSync(p))]));
if(JSON.stringify(candidateBefore)!==JSON.stringify(candidateAfter))throw new Error('Candidate closure changed during measurement');
// Explicit observed outputs/control results missed by the earlier prefix-only selector.
// Null/false/zero are real observed results; TDZ and function handles are not.
const observedNames = new Set(['parsed','reparsed','projection','rendered','canonical','parseErrors','reErrors',
  'broken','digests','resolved','selected','promoted','ok','loaderOk','schemaOk','divergence','problems',
  'identical','errors','emitted','missing','abstract','parts','partsError','canonicalMatches','inlineDigest',
  'resolvedDigest','bad','extras','agrees','a','b','without','withBackend','mine','theirs','same','summaries',
  'content','partial','shape']);
const observations=snapshot=>Object.fromEntries(Object.entries(snapshot).filter(([name,value])=>
  (/^(actual|got|result|projected|receipt|again|computed|codes|issues|verification|verified|value|verdict|validation|refusal|refused|report|summary|sizing|outcomes|outputs|e$|r$)/.test(name) || observedNames.has(name))
  && !(value && typeof value==='object' && ['not-initialized','function'].includes(value.type))));
function differences(a,b,path='',found=[]){
 if(JSON.stringify(a)===JSON.stringify(b))return found;
 if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b)){
  if(a.type==='binary64'||b.type==='binary64'){found.push({path,kind:'numeric_word',baseline:a,candidate:b});return found;}
  for(const k of new Set([...Object.keys(a),...Object.keys(b)]))differences(a[k],b[k],`${path}/${k}`,found);
 }else if(Array.isArray(a)&&Array.isArray(b)){
  for(let i=0;i<Math.max(a.length,b.length);i++)differences(a[i],b[i],`${path}/${i}`,found);
 }else found.push({path,kind:/(?:error|code|reason|state|verdict|ok|computed)(?:\/|$)/.test(path)?'state_or_refusal':'other_observation',baseline:a??{type:'absent'},candidate:b??{type:'absent'}});
 return found;
}
const cases=corpus.map(c=>{
 const id=key(c);
 const b=runs.baseline.cases.get(id);
 const a=runs.candidate.cases.get(id);
 const before=observations(b.snapshot);
 const after=observations(a.snapshot);
 const changes=differences(before,after);
 const complete=Object.keys(before).length>0&&Object.keys(after).length>0;
 const subjectChanges=changes.filter(x=>/subject.*digest|canonicalization|inputs_provenance/.test(x.path));
 return {id,target:c.target,suite:c.suite,scenario:c.scenario,
  baseline_status:runs.baseline.rows.get(id).status,candidate_status:runs.candidate.rows.get(id).status,
  observation_coverage:complete?'captured_visible_observations_not_all_internal_values':'incomplete_no_visible_actual_binding',
  exact_whole_result_proof:false,observed_binding_names:Object.keys(before),baseline_observation_sha256:sha(JSON.stringify(before)),candidate_observation_sha256:sha(JSON.stringify(after)),
  baseline_capture_site:b.site,candidate_capture_site:a.site,observed_changes:changes,
  historical_subject_observation:subjectChanges.length?'changed_observation_requires_review':Object.keys(before).some(k=>/receipt|again/.test(k))?'no_observed_subject_change':'not_measured_in_this_case'};
});
const bPr=runs.baseline.primitives;
const aPr=runs.candidate.primitives;
const primitiveAlignment=bPr.length===aPr.length&&bPr.every((v,i)=>v.op===aPr[i].op&&v.site===aPr[i].site&&JSON.stringify(v.args)===JSON.stringify(aPr[i].args));
const primitiveDifferences=primitiveAlignment?bPr.flatMap((v,i)=>JSON.stringify(v.result??v.error)===JSON.stringify(aPr[i].result??aPr[i].error)?[]:[{ordinal:i,op:v.op,site:v.site,args:v.args,baseline:v.result??v.error,candidate:aPr[i].result??aPr[i].error}]):[];
const perSite=run=>Object.fromEntries([...new Set(run.primitives.map(e=>e.site))].sort().map(site=>[site,run.primitives.filter(e=>e.site===site).length]));
const manifest={schema_version:'research-impact-1',scope:'Unaccepted isolated candidate observations; no conformance rebaseline or production activation',
 repository_commit:git('rev-parse','HEAD'),repository_tree:git('rev-parse','HEAD^{tree}'),node:process.version,v8:process.versions.v8,platform:process.platform,architecture:process.arch,
 candidate_entry:relative(dirname(candidate),candidate),candidate_closure_sha256:candidateBefore,
 built_input_hashes:distBefore,built_inputs_unchanged:true,numeric_site_inventory:staticSites,numeric_sites_not_loaded:staticSites.filter(s=>!s.excluded&&!runs.candidate.transformed.some(t=>t.path===s.path)),numeric_sites_not_exercised:staticSites.filter(s=>!s.excluded&&!runs.candidate.primitives.some(p=>p.site===s.site)),
 corpus_sha256:sha(readFileSync(corpusPath)),indexed_case_count:corpus.length,protected_input_hashes:protectedBefore,protected_inputs_unchanged:true,
 preserved_semantics:['Financial operation order, solver branches/tolerances and quantization unchanged','Math.sqrt unchanged in consumers','Raw pow/log/exp only; existing public refusal guards retained'],
 limits:['All indexed assertion outcomes measured; visible result captures do not prove every internal or unasserted value unchanged','Primitive traces are global and not attributed to cases','Explicit observed control/aggregate values are not complete internal numerical trajectories','Metric assertion closures may have no visible complete actual result','Changed results/refusals outside this corpus remain unknown','Observed receipt equality does not authorize rewriting historical identities or signatures'],
 runs:Object.fromEntries(Object.entries(runs).map(([mode,r])=>[mode,{started:r.started,finished:r.finished,exit_code:r.exit_code,summary:r.report.summary,by_target:r.report.by_target,events_sha256:r.events_sha256,transforms_sha256:r.transforms_sha256,primitive_count:r.primitives.length,primitive_site_counts:perSite(r),transformations:r.transformed}])),
 primitive_trace_alignment:primitiveAlignment,primitive_changes_when_aligned:primitiveDifferences,
 cases,
 summary:{cases:cases.length,assertion_status_changes:cases.filter(c=>c.baseline_status!==c.candidate_status).length,cases_with_observed_changes:cases.filter(c=>c.observed_changes.length).length,
  cases_with_observed_numeric_changes:cases.filter(c=>c.observed_changes.some(d=>d.kind==='numeric_word')).length,
  cases_with_observed_state_or_refusal_changes:cases.filter(c=>c.observed_changes.some(d=>d.kind==='state_or_refusal')).length,
  incomplete_visible_observations:cases.filter(c=>c.observation_coverage.startsWith('incomplete')).length,
  whole_result_proof_claim:false},scratch_evidence:scratch};
mkdirSync(dirname(output),{recursive:true});writeFileSync(output,`${JSON.stringify(manifest,null,2)}\n`);
console.log(JSON.stringify({output,summary:manifest.summary,scratch},null,2));
