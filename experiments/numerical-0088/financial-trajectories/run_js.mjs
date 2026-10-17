// Independent JS graph runner; mode is explicit and never a production selector.
import {readFileSync,writeFileSync} from 'node:fs';
import {evaluate,reporting} from './js_graph.mjs';
import {pow} from '../pinned-fdlibm/kernel.mjs';
import {fromBits} from '../pinned-fdlibm/words.mjs';
const mode=process.argv[2];
if(!['candidate','host'].includes(mode))throw new Error('explicit research mode required');
const input=JSON.parse(readFileSync(new URL('inputs.json',import.meta.url),'utf8'));
const result={mode,node:process.version,v8:process.versions.v8,cases:input.cases.map(c=>evaluate(c,mode==='candidate'?pow:(a,b)=>a**b)),reporting:input.reporting_controls.map(c=>({id:c.id,...reporting(fromBits(c.bits),c.places)}))};
writeFileSync(process.argv[3],`${JSON.stringify(result)}\n`);
