import { pinnedPow, pinnedExp, pinnedLog } from '@uwmd/verify/browser';
const fromBits = bits => {const v=new DataView(new ArrayBuffer(8));v.setBigUint64(0,BigInt(`0x${bits}`),false);return v.getFloat64(0,false);};
const bitsOf = x => {const v=new DataView(new ArrayBuffer(8));v.setFloat64(0,x,false);return v.getBigUint64(0,false).toString(16).padStart(16,'0');};
const original=Object.fromEntries(['pow','exp','log','sqrt'].map(name=>[name,Math[name]]));
try {
  for(const name of Object.keys(original)) Math[name]=()=>{throw new Error(`Host transcendental reached: ${name}`);};
  const records=globalThis.researchInputs.map(row=>{
    const x=fromBits(row.x);
    const y=fromBits(row.y);
    const value=row.op==='pow'?pinnedPow(x,y):row.op==='exp'?pinnedExp(x):pinnedLog(x);
    return {id:row.id,op:row.op,bits:bitsOf(value),kind:Number.isNaN(value)?'nan':Number.isFinite(value)?'finite':'infinity'};
  });
  document.getElementById('result').textContent=JSON.stringify({status:'complete',user_agent:navigator.userAgent,host_transcendentals_disabled:true,records});
} catch(error) {document.getElementById('result').textContent=JSON.stringify({status:'failed',error:String(error)});}
finally {Object.assign(Math,original);}
