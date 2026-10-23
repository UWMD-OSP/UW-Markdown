import {mkdirSync} from 'node:fs';
mkdirSync(new URL('../../../node_modules/.cache/rfc0089-evidence/',import.meta.url),{recursive:true});
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign,verify} from 'node:crypto';
import * as m from '../model.mjs';
import * as x from '../xml.mjs';
import * as c from '../csv.mjs';
import {candidate} from '../build-runtime.mjs';
import * as nativeSigning from '../../../packages/uwmd-verify/dist/document-signatures.js';
import * as nativeReceipts from '../../../packages/uwmd-verify/dist/receipts.js';
import {zipSync} from 'fflate';

// Expectations below are authored before candidate execution, from D1--D5.
const out=[];
function probe(name,expected,fn){try{const actual=fn();out.push({name,expected,actual,pass:actual===expected});}catch(e){out.push({name,expected,actual:'refused',error:e.message,pass:expected==='refused'});}}
async function ap(name,expected,fn){try{const actual=await fn();out.push({name,expected,actual,pass:actual===expected});}catch(e){out.push({name,expected,actual:'refused',error:e.message,pass:expected==='refused'});}}
const meta=id=>({section:id,provenance:{source:'manual',actor:'synthetic',timestamp:'2026-10-23T00:00:00Z'},quality:{confidence:'high',human_review_required:false},lifecycle:{revision:1,superseded:false}});
const block=(id='x_probe',variant)=>({annotation:{section:id,...(variant!==undefined?{variant}:{})},content:{_meta:meta(id),marker:1}});
const fresh=()=>({envelope_version:'2.0',format_version:'3.0',frontmatter:{uw_version:'3.0',deal_id:'synthetic-independent-review',deal_name:'Synthetic independent review'},sections:{},pipeline_log:[],custom_calculations:[],custom_scenarios:[],extensions:{},superseded:{}});
const base=fresh();base.extensions.x_probe={mode:'single',block:block()};
const refresh=files=>{const manifest=JSON.parse(files['manifest.json']);for(const f of manifest.files){const b=Buffer.from(files[f.path]);f.bytes=b.length;f.sha256='sha256:'+createHash('sha256').update(b).digest('hex');}files['manifest.json']=JSON.stringify(manifest);return files;};
const stable=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(stable).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';
const hash=v=>'sha256:'+createHash('sha256').update(stable(v)).digest('hex');

// Pure independently constructed model, all source payloads authored here.
const fm='---\nuw_version: "3.0"\ndeal_id: "synthetic-independent-review"\ndeal_name: "Synthetic independent review"\n---\n\n';
const fence=(id,value,variant,history=false,role,revision=1)=>{const b=block(id,variant);b.content.marker=value;b.content._meta.lifecycle={revision,superseded:history};if(role)b.content._role=role;return {source:'```json uw:section='+id+(variant===undefined?'':' variant='+variant)+(history?' superseded=true':'')+(revision!==1?' v='+revision:'')+'\n'+JSON.stringify(b.content)+'\n```\n\n',block:{...b,annotation:{...b.annotation,...(history?{superseded:true}:{}),...(revision!==1?{v:revision}:{})}}};};
for(const id of ['x_probe','property','pipeline_log','custom_calculations','custom_scenarios']){
  for(const pattern of ['AHA','AAH','equal','revision','only-history']){
    const rows=pattern==='AHA'?[fence(id,1),fence(id,2,undefined,true),fence(id,3)]:pattern==='AAH'?[fence(id,1),fence(id,3),fence(id,2,undefined,true)]:pattern==='equal'?[fence(id,1),fence(id,1)]:pattern==='revision'?[fence(id,1,undefined,false,undefined,9),fence(id,2)]:[fence(id,1,undefined,true)];
    const expected=fresh();
    if(['pipeline_log','custom_calculations','custom_scenarios'].includes(id))expected[id]=rows.map(r=>r.block);
    else if(pattern==='only-history')expected.superseded[id]=rows.map(r=>r.block);
    else{const selected=rows.filter(r=>!r.block.annotation.superseded).at(-1).block;if(id.startsWith('x_'))expected.extensions[id]={mode:'single',block:selected};else expected.sections[id]=selected;expected.superseded[id]=(pattern==='AHA'?[rows[1],rows[0]]:pattern==='AAH'?[rows[0],rows[2]]:[rows[0]]).map(r=>r.block);}
    probe('independent-source-'+id+'-'+pattern,'equal',()=>{const actual=m.projectSource(fm+rows.map(r=>r.source).join(''));const {generated_at,generator,semantic_digest,...semantic}=actual.model;assert.equal(actual.physical_count,rows.length);assert.equal(actual.accounted_count,rows.length);return stable(semantic)===stable(expected)&&m.digest(actual.model)===hash(expected)?'equal':'different';});
  }
}
for(const reverse of [false,true]){
 const rows=[fence('x_probe',1,undefined,false,'primary'),fence('x_probe',2,'default')];if(reverse)rows.reverse();const expected=fresh();expected.extensions.x_probe={mode:'variants',blocks:[{variant:null,block:rows.find(r=>r.block.annotation.variant===undefined).block},{variant:'default',block:rows.find(r=>r.block.annotation.variant==='default').block}]};
 probe('independent-null-default-'+reverse,'equal',()=>m.preimage(m.projectSource(fm+rows.map(r=>r.source).join('')).model)===stable(expected)?'equal':'different');
}

// Full domain values and XML lexical expectations, including independent words.
const chars=['','\0','\ufffe','\uffff','\u{10000}','\u{1f600}','\r\n\t','"\\&<>', '\x7f'];
for(const str of chars){const v=fresh();v.outer={[str]:str};for(const [name,fn]of [['xml',v=>x.decodeXML(x.encodeXML(v))],['csv',v=>c.decodeCSV(c.encodeCSV(v))],['store',v=>c.decodeZIP(c.encodeZIP(v,0))],['deflate',v=>c.decodeZIP(c.encodeZIP(v,6))]])probe('lawful-string-'+JSON.stringify(str)+'-'+name,'equal',()=>stable(fn(v))===stable(m.stamp(v))?'equal':'different');}
for(const n of [-0,Number.MIN_VALUE,Number.MAX_VALUE,1e-7,1e21,9007199254740992]){const v=fresh();v.outer=n;probe('binary64-'+String(n),'equal',()=>Object.is(x.decodeXML(x.encodeXML(v)).outer,n)||n===0&&x.decodeXML(x.encodeXML(v)).outer===0?'equal':'different');}
const xml=x.encodeXML(base);
for(const [name,change]of [
 ['numeric-reference',s=>s.replace('type="object"','type="&#111;bject"')],
 ['legal-xmlns-reference',s=>s.replace('https://uwmd.org','https:&#47;&#47;uwmd.org')],
])probe('XML-positive-'+name,'equal',()=>stable(x.decodeXML(change(xml)))===stable(m.stamp(base))?'equal':'different');
probe('XML-positive-entity-once','equal',()=>{const v=fresh();v.outer='literal &quot;';return x.decodeXML(x.encodeXML(v)).outer===v.outer?'equal':'different';});
for(const [name,change]of [
 ['duplicate-attribute',s=>s.replace('type="object"','type="object" type="object"')],
 ['illegal-control-numeric-reference',s=>s.replace('"synthetic-independent-review"','"synthetic-independent-review&#0;"')],
 ['version-case',s=>'<?XML version="1.0"?>'+s],
 ['declaration-name',s=>'<?xml VERSION="1.0"?>'+s],
 ['reserved-binding',s=>s.replace('xmlns:uw=', 'xmlns:xml="urn:wrong" xmlns:uw=')],
 ['null-character-attribute',s=>s.replace('type="object"','type="object\x00"')],
])probe('XML-negative-'+name,'refused',()=>{x.decodeXML(change(xml));return 'accepted';});

// A nonempty builtin variant slot cannot also declare that it was empty.
const built=fresh();built.sections.property={base:block('property','base')};
probe('CSV-empty-nonempty-builtin-overlap','refused',()=>{const files=c.encodeCSV(built);const rows=c.readCSV(files['document.csv'],c.DOC);rows[0][8]='[{"path":"/sections/property","kind":"object"}]';files['document.csv']=c.writeCSV([c.DOC,...rows]);fs.writeFileSync(new URL('../../../node_modules/.cache/rfc0089-evidence/overlap-files.json', import.meta.url),JSON.stringify(refresh(files)));c.decodeCSV(files);return 'accepted';});
for(const [name,setup]of [
 ['nonenumerable-undefined',v=>Object.defineProperty(v,'outer',{value:undefined})],
 ['nonenumerable-accessor',v=>Object.defineProperty(v,'outer',{get(){throw Error('must never invoke');}})],
 ['nonenumerable-function',v=>Object.defineProperty(v,'outer',{value:()=>1})],
 ['array-nonenumerable-extra',v=>{v.outer=[];Object.defineProperty(v.outer,'extra',{value:()=>1});}],
])probe('direct-model-'+name,'refused',()=>{const v=fresh();setup(v);m.validateModel(v);return 'accepted';});

const pack={id:'org.example.independent',version:'1.0.0',calculations:[{id:'synthetic_scalar',label:'Synthetic',formula:'1+1',deterministic:true,round_to:12}]};
const options={pack,issued_at:'2026-10-23T00:00:00Z',issuer:'synthetic-key'};
const normal=fence('x_probe',1).source;
// Signing admits structural identity/lifecycle; validation findings are not an issuance gate.
const sparse=fm+normal.replace(JSON.stringify(meta('x_probe')),JSON.stringify({section:'x_probe',lifecycle:{revision:1,superseded:false}}));
for(const [name,source]of [['sparse-metadata',sparse],['invalid-role',fm+normal.replace('"marker":1','"marker":1,"_role":"not-a-role"')],['missing-deal-name',fm.replace('deal_name: "Synthetic independent review"\n','')+normal]]){
 await ap('native-signing-'+name,'accepted',async()=>{await nativeSigning.resolveDocumentSigningSubject(source);return 'accepted';});
 await ap('candidate-signing-'+name,'accepted',async()=>{await candidate.signing.resolveDocumentSigningSubject(source);return 'accepted';});
 await ap('native-receipt-'+name,'accepted',async()=>{await nativeReceipts.issueReceipt(source,options);return 'accepted';});
 await ap('candidate-receipt-'+name,'accepted',async()=>{await candidate.receipts.issueReceipt(source,options);return 'accepted';});
}
fs.writeFileSync(new URL('../../../node_modules/.cache/rfc0089-evidence/independent-results.json', import.meta.url),JSON.stringify({platform:process.platform,node:process.version,probes:out},null,2));
console.log(JSON.stringify({total:out.length,passed:out.filter(x=>x.pass).length,failures:out.filter(x=>!x.pass)},null,2));
