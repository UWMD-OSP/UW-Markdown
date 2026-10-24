// Original independent expectations, adapted to actual production API shapes/async calls.
// Counts are controls, not independent closure or whole-program proof.
import assert from 'node:assert/strict';import {test} from 'node:test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';import {resolve} from 'node:path';
import {canonicalize as jcs} from '../../packages/uwmd-verify/dist/integrity-canonical.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
const folder=resolve(root,'node_modules/.cache/rfc0089-production-evidence');mkdirSync(folder,{recursive:true});
const read=name=>JSON.parse(readFileSync(resolve(folder,name),'utf8'));
test('retained independent source/95 probes/25 subjects/46 ZIP/four auth/169 boundary/22 admission controls',()=>{
  for(const name of ['reviewer/review-oracle','reviewer/review-probes','reviewer/review-subjects','reviewer/review-zip','reviewer/review-auth-boundaries','rereviewer/rereview-boundaries','rereviewer/rereview-admission-csv']){
    const child=spawnSync(process.execPath,[fileURLToPath(new URL(`./probes/${name}.mjs`,import.meta.url))],{cwd:root,encoding:'utf8',timeout:120000,maxBuffer:2_000_000});
    writeFileSync(resolve(folder,`${name.replaceAll('/','-')}.log`),child.stdout+child.stderr);assert.equal(child.status,0,`${name}\n${child.stdout}\n${child.stderr}`);
  }
  const frozen=JSON.parse(readFileSync(new URL('./probes/reviewer/source-oracles.json',import.meta.url),'utf8'));
  const current=read('independent-source-oracles.json');assert.equal(current.records.length,18);
  for(const [index,record] of current.records.entries()){
    assert.equal(record.candidate_equal,true);assert.equal(record.builder_expected_equal,true);
    for(const key of ['name','physical_count','expected_model','expected_preimage','expected_digest'])assert.equal(jcs(record[key]),jcs(frozen.records[index][key]));
  }
  for(const [file,count] of [['independent-results.json',95],['independent-zip-results.json',46],['rereview-boundary-results.json',169],['rereview-admission-csv-results.json',22]]){
    const probes=read(file).probes;assert.equal(probes.length,count,file);assert.ok(probes.every(row=>row.pass),JSON.stringify(probes.filter(row=>!row.pass)));
  }
  assert.equal(read('independent-subject-results.json').results.length,25);
  const auth=read('independent-auth-results.json').observations;assert.equal(auth.length,4);for(const row of auth){assert.equal(row.state??row.verdict,'verified');assert.equal(row.backend_calls,1);assert.deepEqual(row.codes,[]);}
  writeFileSync(resolve(folder,'retained-probes-summary.json'),`${JSON.stringify({node:process.version,platform:process.platform,source:18,probes:95,subjects:25,zip:46,auth:4,boundaries:169,admission:22,status:'pass',scope:'Builder replay on production. Sync model comparison facade/native async carrier APIs; private current call/data-flow inventory is separate.'},null,2)}\n`);
});
