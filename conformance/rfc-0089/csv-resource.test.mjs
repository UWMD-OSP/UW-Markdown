import assert from 'node:assert/strict';
import {test} from 'node:test';
import {flatten,unflatten} from '../../packages/uwmd-verify/dist/csv-mapping.js';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import * as api from '../../packages/uwmd-core/dist/index.js';
// Builder reproduction of review4366165180/84. Constants/expectations specified
// from the defects; no preserved independent inputs or received digests changed.
const folder=new URL('../../node_modules/.cache/rfc0089-production-evidence/',import.meta.url);mkdirSync(folder,{recursive:true});
test('CSV reconstructs a shuffled 4000-unit inventory using decoded parent paths',()=>{
 const value={units:Array.from({length:4000},(_,i)=>({id:String(i),rent:1000,area:500,occupied:true,label:'synthetic'}))};
 const rows=flatten(value);assert.equal(rows.length,24002);
 const start=performance.now();assert.deepEqual(unflatten(rows.slice().reverse()),value);
 writeFileSync(new URL('csv-large-inventory.json',folder),`${JSON.stringify({units:4000,rows:rows.length,milliseconds:performance.now()-start,status:'pass'},null,2)}\n`);
 // Refusal semantics remain independent of parent arrival order.
 assert.throws(()=>unflatten([['','number','1'],['/child','number','2']]),/scalar children/);
 assert.throws(()=>unflatten([['','object','{}'],['/missing/child','number','2']]),/orphan node/);
});
test('long prose and opaque extension strings survive actual CSV and ZIP round trips',async()=>{
 const packet=JSON.parse(readFileSync(new URL('./cases.json',import.meta.url),'utf8'));
 const model=structuredClone(packet.source_cases.find(item=>item.name==='named-default-single').expected_model);
 model.prose={synthetic:'x'.repeat(150000)};model.outer_long_value='y'.repeat(150000);
 const expected=api.canonicalizeUWEnvelope(model);
 for(const actual of [await api.decodeUWCSVBundle(await api.encodeUWCSVBundle(model)),await api.decodeUWCSVZip(await api.encodeUWCSVZip(model))])assert.equal(api.canonicalizeUWEnvelope(actual),expected);
 writeFileSync(new URL('csv-long-value.json',folder),`${JSON.stringify({prose_characters:150000,opaque_characters:150000,status:'pass'})}\n`);
});

test('CSV flattening carries a wide child inventory without argument-list overflow',()=>{
 const value={units:Array.from({length:22000},(_,i)=>({id:String(i),rent:1000,area:500,occupied:true,label:'synthetic'}))};
 const start=performance.now();const rows=flatten(value);assert.equal(rows.length,132002);assert.deepEqual(unflatten(rows),value);
 writeFileSync(new URL('csv-wide-inventory.json',folder),`${JSON.stringify({units:22000,rows:rows.length,milliseconds:performance.now()-start,status:'pass'})}\n`);
});
