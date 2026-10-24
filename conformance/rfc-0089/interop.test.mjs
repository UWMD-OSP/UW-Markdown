// Both directions use real production APIs; no reader is substituted for the other.
import assert from 'node:assert/strict';import {test} from 'node:test';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';import {resolve} from 'node:path';import {zipSync} from 'fflate';
import * as api from '../../packages/uwmd-verify/dist/index.js';import {canonicalize as jcs} from '../../packages/uwmd-verify/dist/integrity-canonical.js';
const root=fileURLToPath(new URL('../../',import.meta.url)),folder=resolve(root,'node_modules/.cache/rfc0089-production-evidence');mkdirSync(folder,{recursive:true});
const packet=JSON.parse(readFileSync(new URL('./cases.json',import.meta.url),'utf8'));const cases=[...packet.source_cases,...packet.direct_models];
test('Windows/Linux native Node ↔ independent Python full carrier matrix',async()=>{
  for(const item of cases){
    const directory=resolve(folder,item.name);mkdirSync(directory,{recursive:true});const model={...item.expected_model,semantic_digest:item.expected_digest};
    writeFileSync(resolve(directory,'node.json'),await api.UW_JSON_CODEC.encode(model));writeFileSync(resolve(directory,'node.xml'),await api.stringifyUWXml(model));
    const files=(await api.encodeUWCSVBundle(model)).files;writeFileSync(resolve(directory,'node-csv.json'),JSON.stringify(files));
    writeFileSync(resolve(directory,'node-store.zip'),zipSync(Object.fromEntries(Object.entries(files).map(([path,text])=>[path,[Buffer.from(text),{level:0,mtime:new Date('1980-01-02T00:00:00Z')}]]))));
    writeFileSync(resolve(directory,'node-deflate.zip'),await api.encodeUWCSVZip(model));
  }
  const python=spawnSync(process.env.UWMD_PYTHON??'python',['-B',fileURLToPath(new URL('./interop.py',import.meta.url)),folder],{cwd:root,encoding:'utf8',env:{...process.env,PYTHONIOENCODING:'utf-8'}});
  writeFileSync(resolve(folder,'interop-python.log'),python.stdout+python.stderr);assert.equal(python.status,0,python.stdout+python.stderr);
  const observations=[];
  for(const item of cases){
    const directory=resolve(folder,item.name);const expected={...item.expected_model,semantic_digest:item.expected_digest};
    const models=[await api.UW_JSON_CODEC.decode(readFileSync(resolve(directory,'python.json'),'utf8')),await api.parseUWXml(readFileSync(resolve(directory,'python.xml'),'utf8')),await api.decodeUWCSVBundle({files:JSON.parse(readFileSync(resolve(directory,'python-csv.json'),'utf8'))}),...await Promise.all(['python-store.zip','python-deflate.zip','python-streaming.zip'].map(name=>api.decodeUWCSVZip(readFileSync(resolve(directory,name)))))];
    for(const model of models)assert.equal(jcs(model),jcs(expected),item.name);
    observations.push({case:item.name,carriers:6,status:'pass'});
  }
  writeFileSync(resolve(folder,'node-interop-results.json'),JSON.stringify({node:process.version,platform:process.platform,observations},null,2)+'\n');
});
