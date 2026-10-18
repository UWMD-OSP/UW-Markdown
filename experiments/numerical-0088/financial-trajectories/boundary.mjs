// Actual production API boundaries; optional isolated ESM hook changes only powers.
import { readFileSync, writeFileSync } from 'node:fs';
import { BUILTINS } from '../../../packages/uwmd-verify/dist/calc/builtins.js';
import { xnpvOf,xirrOf,datedFlowsOf } from '../../../packages/uwmd-verify/dist/cash-flow-series.js';
import { quantizeDecimal } from '../../../packages/uwmd-verify/dist/calc/quantize.js';
import { encoded } from './js_graph.mjs';
import { fromBits } from '../pinned-fdlibm/words.mjs';
const inputs=JSON.parse(readFileSync(new URL('inputs.json',import.meta.url),'utf8'));
const rows=inputs.cases.map(input=>{
  let result;
  let value;
  try{
    const flows=input.flows?.map(fromBits);
    if(input.op==='xnpv'||input.op==='xirr'){
      const series={series:input.dates.map((date,i)=>({date,amount:flows[i]})),day_count:input.day_count};
      const dated=datedFlowsOf(series);
      if(!dated)throw new Error('Research valid dated rows refused');
      value=input.op==='xnpv'?xnpvOf(dated,fromBits(input.rate)):xirrOf(dated);
    }else value=BUILTINS[input.op](input.op==='npv'?[fromBits(input.rate),...flows]:input.op==='irr'?flows:input.args.map(fromBits));
    result={status:'returned',raw:encoded(value)};
    try{result.quantized=encoded(quantizeDecimal(value,input.places));}
    catch(error){result.quantization_refusal=error.code??error.proto?.code;}
  }catch(error){result={status:'refused',code:error.code??error.proto?.code??error.message};}
  return {id:input.id,op:input.op,result};
});
const reporting=inputs.reporting_controls.map(input=>({id:input.id,value:encoded(quantizeDecimal(fromBits(input.bits),input.places))}));
writeFileSync(process.env.TRAJECTORY_BOUNDARY_OUTPUT,`${JSON.stringify({node:process.version,v8:process.versions.v8,mode:process.env.RESEARCH_MODE??'unmodified',rows,reporting},null,2)}\n`);
