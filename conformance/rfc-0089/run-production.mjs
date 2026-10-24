// Repeat the accepted candidate controls through current production APIs.
import {spawnSync} from 'node:child_process';import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';import {resolve} from 'node:path';import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../../',import.meta.url));const folder=resolve(root,'node_modules/.cache/rfc0089-production-evidence');mkdirSync(folder,{recursive:true});
const groups=[
 ['native',['production.test.mjs','source-boundaries.test.mjs','authentication.test.mjs','closure-production.test.mjs','integration-review.test.mjs']],
 ['retained',['retained-probes.test.mjs']],
 ['builder',['probes/carriers.test.mjs','probes/refusals.test.mjs','probes/repairs.test.mjs','probes/remaining.test.mjs']],
 ['interop',['interop.test.mjs']],
 ['routes',['routes.test.mjs']],
];
const git=(...args)=>{const child=spawnSync('git',['-c','core.fsmonitor=false',...args],{cwd:root,encoding:'utf8'});if(child.status!==0)throw new Error(child.stderr);return child.stdout.trim();};
const runtime=spawnSync(process.env.UWMD_PYTHON??'python',['-c',"import json,sys,platform,pyexpat;print(json.dumps(dict(python=sys.version,platform=platform.platform(),expat=pyexpat.EXPAT_VERSION)))"],{encoding:'utf8'});if(runtime.status!==0)throw new Error(runtime.stderr);
const identity={head:git('rev-parse','HEAD'),tree:git('rev-parse','HEAD^{tree}'),node:process.version,platform:process.platform,python:JSON.parse(runtime.stdout),scope:'Native production controls, retained reviewer expectations with documented API adapters, not an independent closure review',groups:[]};
writeFileSync(resolve(folder,'production-run.json'),`${JSON.stringify(identity,null,2)}\n`);
for(const [name,files] of groups){
 const child=spawnSync(process.execPath,['--test','--test-concurrency=1',...files.map(file=>`conformance/rfc-0089/${file}`)],{cwd:root,encoding:'utf8',env:process.env,maxBuffer:32_000_000,timeout:600000});
 const output=(child.stdout??'')+(child.stderr??'');writeFileSync(resolve(folder,`group-${name}.log`),output);identity.groups.push({name,exit:child.status,signal:child.signal,log_sha256:createHash('sha256').update(output).digest('hex')});writeFileSync(resolve(folder,'production-run.json'),`${JSON.stringify(identity,null,2)}\n`);
 console.log(`${name}: exit ${child.status}`);if(child.status!==0){console.error(output);process.exit(1);}
}
const manifest=JSON.parse(spawnSync(process.execPath,[resolve(root,'packages/uwmd-cli/bin/uwmd.mjs'),'manifest'],{cwd:root,encoding:'utf8'}).stdout);writeFileSync(resolve(folder,'native-manifest.json'),`${JSON.stringify(manifest,null,2)}\n`);
console.log('Production matrix groups passed; runtime and exact source identities retained.');
