// Focused research observations through unchanged public production boundaries.
import { readFileSync,writeFileSync } from 'node:fs';
import { resolve,join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { typed } from './runtime.mjs';
const root=resolve(process.env.RESEARCH_REPO_ROOT);
const api=await import(pathToFileURL(join(root,'packages/uwmd-verify/dist/index.js')).href);
const {deriveDebt}=await import(pathToFileURL(join(root,'packages/uwmd-core/dist/debt.js')).href);
const mode=process.env.RESEARCH_MODE;
const sha=value=>createHash('sha256').update(value).digest('hex');
const attempt=fn=>{try{return {returned:typed(fn())};}catch(error){return {threw:typed(error)};}};
const fixture='conformance/receipts/issue/01-uwx-multifamily/deal.uwx.md';
const fixtureSource=readFileSync(join(root,fixture),'utf8');
const source=fixtureSource.replace(/\r?\n---\r?\n/,'\nlast_flow: 6.727499949325601e20\n---\n');
if(source===fixtureSource)throw new Error('Could not add explicit research input before frontmatter close');
const parsed=api.parseUWFile(source);
const sourceBefore=JSON.stringify(parsed);
const cases=[];
const add=(id,op,args,formula)=>cases.push({id,op,args,formula});
for(const [id,rate,n,present] of [['ordinary',0.05/12,360,1000000],['zero',0,360,1000000],['tiny',1e-20,360,1000000],['negative',-0.001,24,1000],['fractional-period',0.005,12.5,1000]])add(`pmt-${id}`,'pmt',[rate,n,present]);
for(const [id,args] of [['ordinary',[0.1,-100,60,60]],['zero',[0,-100,60,60]],['tiny',[1e-20,-1,2]],['negative',[-0.1,-100,60,60]],['internal-nonfinite-denominator',[1e155,0,0,1]]])add(`npv-${id}`,'npv',args);
for(const [id,args] of [['counterexample',[1.2,31]],['zero',[0,0]],['tiny',[1e-200,2]],['negative-fractional',[-2,0.5]],['negative-integer',[-2,3]],['fractional',[1.05,0.5]],['overflow',[1e155,2]]])add(`pow-${id}`,'pow',args);
add('pow-internal-infinity-to-zero','pow',[Number.POSITIVE_INFINITY,0],'pow(huge * huge, 0)');
for(const [id,args] of [['ordinary',[1.2]],['zero',[0]],['tiny',[1e-200]],['negative',[-1]]])add(`log-${id}`,'log',args);
add('log-internal-infinity','log',[Number.POSITIVE_INFINITY],'log(huge * huge)');
for(const [id,args] of [['ordinary',[1.2]],['zero',[0]],['tiny',[1e-200]],['negative',[-1]],['overflow',[1000]]])add(`exp-${id}`,'exp',args);
add('exp-negative-internal-infinity','exp',[Number.NEGATIVE_INFINITY],'exp(-(huge * huge))');
for(const op of ['fv','pv'])for(const [id,args] of [['ordinary',[0.05,10,100,1000]],['zero',[0,10,100,1000]],['tiny',[1e-20,10,100,1000]],['negative',[-0.05,10,100,1000]],['fractional-period',[0.05,10.5,100,1000]]])add(`${op}-${id}`,op,args);
for(const [id,args] of [['ordinary',[0.05/12,536.82,100000]],['zero',[0,100,1000]],['tiny',[1e-20,100,1000]],['negative',[-0.005,100,1000]],['fractional-solution',[0.005,123.45,1000]]])add(`nper-${id}`,'nper',args);
const ordinaryFlows=[-1000,0,2000];
const endpointFlows=[-1,...Array(19).fill(0),parsed.frontmatter.last_flow];
add('irr-ordinary','irr',ordinaryFlows);
add('irr-all-zero','irr',[0,0]);
add('irr-tiny-positive','irr',[1e-200,1e-200]);
add('irr-original-endpoint','irr',endpointFlows,`irr(-1,${Array(19).fill('0').join(',')},last_flow)`);
const observations=cases.map(test=>{
 const frontmatter={...parsed.frontmatter,huge:1e155};
 for(let i=0;i<test.args.length;i++)if(Number.isFinite(test.args[i]))frontmatter[`a${i}`]=test.args[i];
 const formula=test.formula??`${test.op}(${test.args.map((_,i)=>`a${i}`).join(',')})`;
 const ctx={parsed:{...parsed,frontmatter},prior_results:{},locale:'en-US'};
 const declaration={id:test.id,label:test.id,formula,deterministic:true};
 return {id:test.id,op:test.op,args:typed(test.args),formula,
  builtin:attempt(()=>api.BUILTINS[test.op](test.args)),
  public_default:typed(api.evaluateCalc(declaration,ctx)),
  public_round12:typed(api.evaluateCalc({...declaration,round_to:12},ctx))};
});
const debts=[['ordinary',{loan_amount:1000000,interest_rate:0.05,amortization_years:30}],['zero',{loan_amount:1000000,interest_rate:0,amortization_years:30}],['tiny',{loan_amount:1000000,interest_rate:1e-20,amortization_years:30}],['negative',{loan_amount:1000,interest_rate:-0.012,amortization_years:2}],['fractional-period',{loan_amount:1000,interest_rate:0.06,amortization_years:12.5/12}]].map(([id,input])=>{
 const before=JSON.stringify(input);const result=attempt(()=>deriveDebt(input));
 if(before!==JSON.stringify(input))throw new Error('Starter derivation mutated input');
 return {id,input:typed(input),result};
});
const engine='research-only.rfc0088-observation';
const oldVersion='0.0.0-research-host';const newVersion='0.0.0-research-fdlibm';
const receiptCases=[
 {id:'pow-round12',formula:'pow(1.2,31)',round_to:12},
 {id:'pow-default6',formula:'pow(1.2,31)'},
 {id:'irr-original-endpoint',formula:`irr(-1,${Array(19).fill('0').join(',')},last_flow)`,unit:'%'},
];
const packs=receiptCases.map(test=>({...api.getPackForAssetClass('multifamily'),id:`research.rfc0088.${test.id}`,version:'0.0.0-research',calculations:[{id:test.id,label:test.id,formula:test.formula,deterministic:true,...(test.round_to===undefined?{}:{round_to:test.round_to}),...(test.unit?{unit:test.unit}:{})}]}));
const prior=process.env.RESEARCH_PRIOR_RECEIPTS?JSON.parse(readFileSync(process.env.RESEARCH_PRIOR_RECEIPTS,'utf8')):null;
const receipts=[];
for(let i=0;i<receiptCases.length;i++){
 const test=receiptCases[i];const pack=packs[i];
 let receipt;
 let issuanceError=null;
 try{receipt=await api.issueReceipt(source,{pack,filename:'research.uwx.md',issued_at:'2026-10-17T00:00:00Z',issuer:'research-only',engine,engine_version:mode==='baseline'?oldVersion:newVersion});}
 catch(error){issuanceError=typed(error);}
 if(mode==='baseline'&&!receipt)throw new Error(`Baseline research receipt ${test.id} did not issue: ${JSON.stringify(issuanceError)}`);
 const old=mode==='baseline'?receipt:prior.receipts.find(row=>row.id===test.id).issued_receipt;
 const historical=[];
 if(old){
  for(const identity of ['same','different'])for(const signature of ['unsigned','stub-valid','stub-invalid','no-backend']){
   const original=signature==='unsigned'?old:{...old,signature:{algorithm:'ed25519',key_id:'research-placeholder',value:'AAAA'}};
   const before=JSON.stringify(original);const signingPayload=api.receiptSigningPayload(original);
   const calls=[];
   const backend=signature==='unsigned'||signature==='no-backend'?undefined:{verify:async(received,payload)=>{
    calls.push({receipt_unchanged:JSON.stringify(received)===before,payload_sha256:sha(payload),payload_equal:payload===signingPayload});return signature==='stub-valid';}};
   const result=await api.verifyReceipt(original,source,{packs:[pack],filename:'research.uwx.md',engine,engine_version:identity==='same'?oldVersion:newVersion,...(backend?{signatureVerifier:backend}:{})});
   if(JSON.stringify(original)!==before)throw new Error('Verification mutated historical receipt');
   historical.push({identity,signature,receipt:original,receipt_words:typed(original),receipt_json_sha256:sha(before),source_sha256:sha(source),
    signing_payload:signingPayload,signing_payload_sha256:sha(signingPayload),backend_calls:calls,result:typed(result),receipt_unchanged:true,source_unchanged:true});
  }
 }
 receipts.push({id:test.id,pack,issued_receipt:receipt??null,issued_receipt_words:receipt?typed(receipt):null,issuance_error:issuanceError,
  issued_signing_payload:receipt?api.receiptSigningPayload(receipt):null,issued_signing_payload_sha256:receipt?sha(api.receiptSigningPayload(receipt)):null,historical});
}
if(sourceBefore!==JSON.stringify(parsed))throw new Error('Original parsed evidence mutated');
const result={scope:'Unaccepted focused candidate observations, not normative answers or cryptographic authentication',mode,
 runtime:{node:process.version,v8:process.versions.v8,platform:process.platform,architecture:process.arch},
 source,source_sha256:sha(source),source_fixture:fixture,source_fixture_sha256:sha(fixtureSource),last_flow:typed(parsed.frontmatter.last_flow),
 observations,debts,receipts,engine_identity_markers:{engine,oldVersion,newVersion,changes_package_versions:false},
 signature_note:'Synthetic placeholder signatures with a supplied recording stub. Backend results are control inputs, not cryptographic validation.'};
writeFileSync(process.env.RESEARCH_FINANCIAL_OUTPUT,`${JSON.stringify(result,null,2)}\n`);
console.log(JSON.stringify({mode,observations:observations.length,debt_cases:debts.length,receipt_cases:receipts.length,output:process.env.RESEARCH_FINANCIAL_OUTPUT}));
