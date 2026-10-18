// Actual current consumer APIs. Loader activation is explicit and memory-only.
import {readFileSync,writeFileSync} from 'node:fs';
import * as api from '../../../packages/uwmd-verify/dist/index.js';
import {Pcg64,inverseNormalCdf,sampleNormal} from '../../../packages/uwmd-verify/dist/calc/prng.js';
import {evaluateStochastic} from '../../../packages/uwmd-verify/dist/calc/stochastic.js';
import {fromBits,toBits} from '../pinned-fdlibm/words.mjs';
const HERE=new URL('./',import.meta.url);
const input=JSON.parse(readFileSync(new URL('inputs.json',HERE),'utf8'));
const source=path=>readFileSync(new URL(`../../../${path}`,HERE),'utf8');
function encoded(value){
  if(typeof value==='number')return {kind:Number.isNaN(value)?'nan':Number.isFinite(value)?'finite':'infinity',bits:toBits(value)};
  if(Array.isArray(value))return value.map(encoded);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,encoded(v)]));
  return value;
}
const issue=i=>({code:i.code,severity:i.severity,...(i.field!==undefined?{field:i.field}:{})});
const capital=input.capital.map(c=>{
  const v=api.verifyCapitalStack(c.stack,c.context);
  return {id:c.id,service:c.stack.tranches.map(t=>api.trancheAnnualDebtService(t)),verification:{verdict:v.verdict,issues:v.issues.map(issue),sizing:v.sizing}};
});
const waterfall=input.waterfall.map(c=>{
  const allocation=c.series===null?null:api.computeWaterfall(c.waterfall,c.series);
  const verification=api.verifyWaterfall(c.waterfall,c.series);
  return {id:c.id,allocation,verification:{verdict:verification.verdict,issues:verification.issues.map(issue)}};
});
const normal=input.normal.map(c=>{
  try{return {id:c.id,result:{status:'returned',z:inverseNormalCdf(fromBits(c.p)),draw:sampleNormal(fromBits(c.p),c.mean,c.stddev)}};}
  catch(error){return {id:c.id,result:{status:'refused',error:error.name}};}
});
const sc=input.stochastic;
const rng=new Pcg64(sc.seed);
const uniforms=Array.from({length:sc.samples},()=>rng.nextDouble());
const decl={id:sc.id,label:'Existing normal consumer composition',base_formula:'research_normal_input',inputs:[{variable:'research_normal_input',distribution:{kind:'normal',mean:sc.mean,stddev:sc.stddev}}],samples:sc.samples,seed:sc.seed,summarize:['mean','median','p10','p25','p75','p90','min','max','stddev'],return_samples:true,round_to:sc.places};
const stochasticResult=evaluateStochastic(decl,{parsed:api.parseUWFile(source('conformance/stochastic/04-normal-is-not-bit-exact/deal.uwx.md'))});
if(!stochasticResult.ok)throw new Error(JSON.stringify(stochasticResult));
const stochastic={id:sc.id,uniforms,samples:stochasticResult.samples,summary:stochasticResult.summary,failed_samples:stochasticResult.failed_samples};
const recovery=input.recovery.map(c=>{
  const bytes=source('conformance/recoveries/accept-recovery-true-up/deal.uwx.md');
  const parsed=api.parseUWFile(bytes);const tenant=api.getSection(parsed,'rent_roll').content.tenants[0];
  tenant.recovery_terms.pro_rata_share=c.share;tenant.recovery_true_up=[structuredClone(c.row)];
  const validation=api.validateUWFile(parsed,{now:new Date('2026-10-17T00:00:00Z')});
  return {id:c.id,issues:validation.issues.filter(i=>['REC-06','REC-07','REC-08'].includes(i.code)).map(issue),all_validation_issues:validation.issues};
});
const result={capital,waterfall,normal,stochastic,recovery};
const projected={...result,recovery:recovery.map(({all_validation_issues,...rest})=>rest)};
writeFileSync(process.argv[2],`${JSON.stringify({mode:process.env.RESEARCH_MODE??'unmodified',node:process.version,v8:process.versions.v8,comparison:encoded(projected),complete_actual:encoded(result)})}\n`);
