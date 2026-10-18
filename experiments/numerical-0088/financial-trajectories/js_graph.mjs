// UNACCEPTED independently authored JS composition of the current financial graphs.
// The caller explicitly supplies host exponentiation or the isolated pinned pow.
import { fromBits, toBits } from '../pinned-fdlibm/words.mjs';
export const encoded = value => ({kind:Number.isNaN(value)?'nan':Number.isFinite(value)?'finite':'infinity',bits:toBits(value)});
export function reporting(value, places) {
  if (!Number.isFinite(value)) return {status:'refused_nonfinite'};
  const [mantissa, scientific] = Math.abs(value).toExponential().split('e');
  const coefficient = mantissa.replace('.','');
  const exponent = Number(scientific) - coefficient.length + 1;
  const shifted = Number(`${coefficient}e${exponent+places}`);
  let integer = null;
  let result = value;
  if (Number.isFinite(shifted) && shifted <= Number.MAX_SAFE_INTEGER) {
    integer = Number.isInteger(shifted)?shifted:Math.floor(shifted+0.5);
    result = (value<0?-1:1)*Number(`${integer}e${-places}`);
  }
  if (result===0) result=0;
  return {status:'reported',bits:toBits(result),token:JSON.stringify(result),coefficient,exponent,shifted:toBits(shifted),rounded_integer:integer===null?null:String(integer)};
}
export function evaluate(input,power) {
  const trace=[];
  const emit=(kind,fields)=>trace.push({sequence:trace.length,kind,...fields});
  const arithmetic={add:(a,b)=>a+b,subtract:(a,b)=>a-b,multiply:(a,b)=>a*b,divide:(a,b)=>a/b,negate:a=>-a,abs:a=>Math.abs(a),pow:power};
  const step=(context,op,...args)=>{const value=arithmetic[op](...args);emit('operation',{context,op,args:args.map(encoded),result:encoded(value)});return value;};
  let times=null;
  if(input.dates){
    if(input.day_count!=='actual/365f')throw new RangeError('research date scope');
    const anchor=Date.parse(`${input.dates[0]}T00:00:00Z`);
    times=input.dates.map((date,row)=>{
      const days=(Date.parse(`${date}T00:00:00Z`)-anchor)/86400000;
      emit('calendar',{row,anchor:input.dates[0],date,actual_days:days,convention:'actual/365f'});
      return step(`calendar/${row}`,'divide',days,365);
    });
  }
  const cash=(rate,flows,evaluation)=>{
    emit('evaluation',{evaluation,rate:encoded(rate),association:times===null?'periodic_divide':'dated_multiply_negative_power'});
    let accumulated=0;
    flows.forEach((amount,index)=>{
      const context=`${evaluation}/row/${index}`;
      const base=step(context,'add',1,rate);
      const exponent=times===null?index:step(context,'negate',times[index]);
      const factor=step(context,'pow',base,exponent);
      const term=step(context,times===null?'divide':'multiply',amount,factor);
      accumulated=step(context,'add',accumulated,term);
    });
    emit('evaluation_result',{evaluation,value:encoded(accumulated)});return accumulated;
  };
  const solve=flows=>{
    let bracket=[fromBits('bfeff7ced916872b'),10];
    let residualLow=cash(bracket[0],flows,'lo');
    const residualHigh=cash(bracket[1],flows,'hi');
    const product=Number.isFinite(residualLow)&&Number.isFinite(residualHigh)?step('bracket','multiply',residualLow,residualHigh):null;
    const refused=!Number.isFinite(residualLow)||!Number.isFinite(residualHigh)||product>0;
    emit('bracket',{lo:encoded(bracket[0]),hi:encoded(bracket[1]),flo:encoded(residualLow),fhi:encoded(residualHigh),product:product===null?null:encoded(product),refused});
    const refusal=()=>({status:'refused',code:times===null?'CALC-IRR-DIVERGE':'CALC-XIRR-DIVERGE'});
    if(refused){emit('exit',{reason:'no_bracket'});return refusal();}
    if(residualLow===0||residualHigh===0){
      const index=residualLow===0?0:1;
      emit('exit',{reason:index===0?'lower_endpoint':'upper_endpoint',value:encoded(bracket[index])});
      return {status:'returned',raw:encoded(bracket[index])};
    }
    for(let index=0;index<200;index++){
      const context=`iteration/${index}`;
      const midpoint=step(context,'divide',step(context,'add',...bracket),2);
      const residual=cash(midpoint,flows,context);
      const absolute=step(context,'abs',residual);
      const valueStop=absolute<1e-9;
      const half=valueStop?null:step(context,'divide',step(context,'subtract',bracket[1],bracket[0]),2);
      const intervalStop=half!==null&&half<1e-12;
      emit('iteration',{iteration:index,lo:encoded(bracket[0]),hi:encoded(bracket[1]),flo:encoded(residualLow),mid:encoded(midpoint),fmid:encoded(residual),value_tolerance:encoded(1e-9),interval_tolerance:encoded(1e-12),value_stop:valueStop,half_interval:half===null?null:encoded(half),interval_stop:intervalStop});
      if(valueStop||intervalStop){emit('exit',{reason:valueStop?'value_tolerance':'interval_tolerance',value:encoded(midpoint)});return {status:'returned',raw:encoded(midpoint)};}
      const signProduct=step(context,'multiply',residualLow,residual);
      const left=signProduct<0;
      bracket=left?[bracket[0],midpoint]:[midpoint,bracket[1]];
      if(!left)residualLow=residual;
      emit('update',{iteration:index,product:encoded(signProduct),retain_left:left,lo:encoded(bracket[0]),hi:encoded(bracket[1]),flo:encoded(residualLow)});
    }
    emit('exit',{reason:'iteration_cap'});return refusal();
  };
  let result;
  const flows=input.flows?.map(fromBits);
  if(['irr','xirr'].includes(input.op))result=solve(flows);
  else if(['npv','xnpv'].includes(input.op)){
    const rate=fromBits(input.rate);
    if(input.op==='xnpv'&&(!Number.isFinite(rate)||rate<=-1))result={status:'refused',code:'CALC-TYPE-001'};
    else result={status:'returned',raw:encoded(cash(rate,flows,'direct'))};
  }else if(input.op==='pmt'){
    const [rate,n,pv]=input.args.map(fromBits);
    if(n===0)result={status:'refused',code:'CALC-TYPE-001'};
    else{
      let value;
      if(rate===0){emit('branch',{name:'pmt_zero_rate'});value=step('pmt','divide',pv,n);}
      else{
        const numerator=step('pmt','multiply',pv,rate);
        const base=step('pmt','add',1,rate);
        const neg=step('pmt','negate',n);
        const factor=step('pmt','pow',base,neg);
        const denominator=step('pmt','subtract',1,factor);
        value=step('pmt','divide',numerator,denominator);
      }
      result={status:'returned',raw:encoded(value)};
    }
  }else throw new RangeError('unknown graph');
  if(result.status==='returned')result.reporting=reporting(fromBits(result.raw.bits),input.places);
  return {id:input.id,op:input.op,result,trace};
}
