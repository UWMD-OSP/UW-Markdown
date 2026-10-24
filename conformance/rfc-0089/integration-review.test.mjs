// Builder regressions for normal production review; original independent cases remain fixed.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import * as api from '../../packages/uwmd-core/dist/index.js';
import {buildUWMDFactTable} from '../../packages/uwmd-batch/dist/index.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
const folder=resolve(root,'node_modules/.cache/rfc0089-production-evidence');mkdirSync(folder,{recursive:true});
const load=name=>JSON.parse(readFileSync(new URL(`./integration-controls/${name}.json`,import.meta.url),'utf8')).cases;
test('normal review: source facts preserve invalid/missing metadata; carriers remain strict',async()=>{
 const records=[];const directory=mkdtempSync(join(tmpdir(),'uwmd-review-facts-'));
 try {
  for(const item of load('source-fact-cases')){
   const parsed=api.parseUWFile(item.source);const model=api.toUWEnvelope(parsed);
   assert.match(await api.computeEnvelopeDigest(model),/^sha256:[a-f0-9]{64}$/);
   assert.throws(()=>api.flattenEnvelopeBlockValues(model));
   const rows=api.flattenUWSourceBlockValues(parsed);
   assert.ok(rows.some(row=>row.scope==='content'&&row.pointer==='/total_units'&&row.value_json==='1'));
   assert.equal(rows.some(row=>row.scope==='meta'),item.meta_present);
   if(item.name==='null')assert.ok(rows.some(row=>row.scope==='meta'&&row.pointer===''&&row.json_type==='null'&&row.value_json==='null'));
   if(item.name==='mismatch')assert.ok(rows.some(row=>row.scope==='meta'&&row.pointer==='/section'&&row.value_json==='"debt_structure"'));
   writeFileSync(join(directory,`${item.name}.uwx.md`),item.source);records.push({case:item.name,carrier:'refused',facts:rows});
  }
  const table=await buildUWMDFactTable(directory);assert.equal(table.deals_included,3);assert.deepEqual(table.deals_skipped,[]);
  for(const item of load('source-fact-cases')){
   const rows=table.rows.filter(row=>row.path===`${item.name}.uwx.md`);assert.ok(rows.length);
   // Existing validator reports missing metadata as warnings; null/mismatch are errors.
   assert.ok(rows.every(row=>row.valid===(item.name==='absent')));
   assert.equal(rows.some(row=>row.scope==='meta'),item.meta_present);
  }
  writeFileSync(resolve(folder,'normal-review-source-facts.json'),JSON.stringify({records,table},null,2)+'\n');
 }finally{rmSync(directory,{recursive:true,force:true});}
});
test('normal review: singleton descriptor agreement precedes current/stale semantic stamps',async()=>{
 const records=[];
 for(const item of load('csv-descriptor-cases')){
  await assert.rejects(api.decodeUWCSVBundle({files:item.files}),error=>{assert.match(error.message,/CSV descriptor agreement/);assert.doesNotMatch(error.message,/semantic digest/);records.push({case:item.name,actual:error.message});return true;});
 }
 writeFileSync(resolve(folder,'normal-review-csv-precedence.json'),JSON.stringify(records,null,2)+'\n');
});
test('composition producer writes a fence value preserved by UWX reprojection',()=>{
 const inline=api.parseUWFile(readFileSync(new URL('../../examples/standalone/authored-2026-10-17/inline-deal.uwx.md',import.meta.url),'utf8'));
 const {document}=api.externalizeSection(inline,{section:'rent_roll',collectionKey:'unit_id',collectionPath:'units',partIdPrefix:'synthetic'});
 const model=api.toUWEnvelope(document);const source=api.stringifyUWX(model);
 assert.match(source,/external=true/);assert.equal(api.canonicalizeUWEnvelope(api.toUWEnvelope(api.parseUWFile(source))),api.canonicalizeUWEnvelope(model));
});
