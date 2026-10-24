import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const evidence = resolve(root, 'node_modules/.cache/rfc0089-evidence');
import fs from 'node:fs';import {createHash}from 'node:crypto';
import * as m from '../model.mjs';import * as x from '../xml.mjs';import * as c from '../csv.mjs';import{candidate}from '../build-runtime.mjs';
import{planSourceEvidence}from '../../../packages/uwmd-lake/dist/plan.js';
const fresh=()=>({envelope_version:'2.0',format_version:'3.0',frontmatter:{uw_version:'3.0',deal_id:'synthetic-rereview',deal_name:'Synthetic rereview'},sections:{},pipeline_log:[],custom_calculations:[],custom_scenarios:[],extensions:{},superseded:{}});
const out=[];async function test(name,expected,fn){let actual;
let error;try{actual=await fn();}catch(e){actual='refused';error=e.message;}out.push({name,expected,actual,error,pass:expected===actual});}
const model=fresh();model.outer={text:'literal &quot; and &#0; and ]]> and <&',name:'\0\ufffe\uffff\u{10000}'};const xml=x.encodeXML(model);
const expect=m.preimage(model);const xmlCases=[];
const positive=(name,text)=>xmlCases.push({name,text,expected:'equal',preimage:expect});const negative=(name,text)=>xmlCases.push({name,text,expected:'refused'});
positive('baseline',xml);
for(const prefix of ['p','\u037f','\u{10000}','\u{effff}'])positive(`prefix-${JSON.stringify(prefix)}`,xml.replaceAll('xmlns:uw=',`xmlns:${prefix}=`).replace(/(<\/?)(?:uw:)/g,`$1${prefix}:`));
positive('default-namespace',xml.replaceAll('xmlns:uw=','xmlns=').replaceAll('uw:',''));
positive('name-reference-quote',xml.replaceAll('&quot;','&#x22;'));
positive('root-stamp-reference',xml.replace('envelope-version="2.0"','envelope-version="&#50;.0"'));
positive('reference-backslash',xml.replace('\\u0000','&#92;u0000'));
positive('namespace-reference',xml.replace('https://uwmd.org','https:&#x2f;&#47;uwmd.org'));
positive('CR-LF-normalization',xml.replaceAll('><','>\r\n<'));
positive('bare-CR-normalization',xml.replaceAll('><','>\r<'));
positive('attribute-whitespace-normalization',xml.replace(' type="object"','\r\ntype\t=\r"object"'));
positive('xmlns-scope-shadow-restore',xml.replace('<uw:value type="object">','<uw:value xmlns:other="urn:synthetic" xmlns:uw="https://uwmd.org/ns/document/2" type="object">'));
for(const decl of ['<?xml version="1.0"?>','<?xml version="1.0" encoding="uTf-8"?>',"<?xml version = '1.0' standalone = 'no' ?>"])positive(`declaration-${decl}`,decl+xml);
for(const [name,change]of [
 ['undeclared',s=>s.replace('xmlns:uw=', 'xmlns:other=')],
 ['wrong-scope',s=>s.replace('<uw:value type="object">','<uw:value xmlns:uw="urn:wrong" type="object">')],
 ['qualified-attribute',s=>s.replace(' type="object"',' uw:type="object"')],
 ['duplicate-attribute',s=>s.replace(' type="object"',' type="object" type="object"')],
 ['missing-separator',s=>s.replace(' type="object"','type="object"')],
 ['extra-close',s=>`${s}</uw:document>`],['extra-root',s=>s+s],['trailing-nonspace',s=>`${s}x`],
 ['literal-less-attr',s=>s.replace('type="object"','type="ob<ject"')],
 ['literal-CDATA-close',s=>s.replace('"synthetic-rereview"','"synthetic-rereview]]>"')],
 ['unknown-entity',s=>s.replace('"synthetic-rereview"','"synthetic-rereview&unknown;"')],
 ['unterminated-entity',s=>s.replace('"synthetic-rereview"','"synthetic-rereview&amp"')],
 ['double-decoded-type',s=>s.replace('type="object"','type="&amp;#111;bject"')],
 ['illegal-name-start',s=>s.replaceAll('xmlns:uw=','xmlns:0x=').replace(/(<\/?)(?:uw:)/g,'$10x:')],
 ['above-name-range',s=>s.replaceAll('xmlns:uw=','xmlns:\u{f0000}=').replace(/(<\/?)(?:uw:)/g,'$1\u{f0000}:')],
 ['two-colon-name',s=>s.replace('<uw:document','<uw:p:document')],
 ['uppercase-declaration',s=>`<?xml VERSION="1.0"?>${s}`],['declaration-after-space',s=>` <?xml version="1.0"?>${s}`],
 ['standalone-before-version',s=>`<?xml standalone="yes" version="1.0"?>${s}`],
 ['duplicate-declaration-version',s=>`<?xml version="1.0" version="1.0"?>${s}`],
 ['unknown-PI',s=>`<?probe x?>${s}`],['DTD',s=>`<!DOCTYPE uw:document>${s}`],['comment',s=>`<!--synthetic-->${s}`],
])negative(name,change(xml));
for(const cp of [0,1,8,11,12,0xd800,0xdfff,0xfffe,0xffff,0x110000])negative(`illegal-reference-${cp}`,xml.replace('"synthetic-rereview"',`"synthetic-rereview&#${cp};"`));
for(const item of xmlCases)await test(`xml-${item.name}`,item.expected,()=>m.preimage(x.decodeXML(item.text))===expect?'equal':'different');
fs.writeFileSync(resolve(evidence, 'rereview-xml-cases.json'),JSON.stringify(xmlCases));
const APIs={validate:m.validateModel,preimage:m.preimage,digest:m.digest,stamp:m.stamp,xml:x.encodeXML,csv:c.encodeCSV,zip:c.encodeZIP,markdown:m.toMarkdown,generatedStamp:candidate.envelope.stampEnvelopeDigest};
for(const [name,setup]of [
 ['hidden-undefined',(v,_s)=>Object.defineProperty(v,'outer',{value:undefined})],
 ['hidden-function',(v,_s)=>Object.defineProperty(v,'outer',{value:()=>1})],
 ['hidden-data',(v,_s)=>Object.defineProperty(v,'outer',{value:null})],
 ['hidden-accessor',(v,s)=>Object.defineProperty(v,'outer',{get(){s.calls++;return null;}})],
 ['visible-accessor',(v,s)=>Object.defineProperty(v,'outer',{enumerable:true,get(){s.calls++;return null;}})],
 ['volatile-accessor',(v,s)=>Object.defineProperty(v,'generator',{enumerable:true,get(){s.calls++;return 'synthetic';}})],
 ['symbol',(v,_s)=>{v[Symbol('synthetic')]=null;}],
 ['array-symbol',(v,_s)=>{v.outer=[];v.outer[Symbol('synthetic')]=null;}],
 ['array-hole',(v,_s)=>{v.outer=Array(1);}],
 ['array-extra',(v,_s)=>{v.outer=[];v.outer.extra=1;}],
 ['array-hidden-index',(v,_s)=>{v.outer=[1];Object.defineProperty(v.outer,'0',{value:1,enumerable:false});}],
 ['array-accessor',(v,s)=>{v.outer=[1];Object.defineProperty(v.outer,'0',{enumerable:true,get(){s.calls++;return 1;}});}],
])for(const [api,fn]of Object.entries(APIs)){const v=fresh();
const state={calls:0};setup(v,state);await test(`descriptor-${name}-${api}`,'refused-without-getter',async()=>{try{await fn(v);return `accepted-getters-${state.calls}`;}catch{return state.calls?'refused-after-getter':'refused-without-getter';}});}
for(const [api,fn]of Object.entries(APIs)){const v=fresh();v.outer=Object.freeze([null,Object.freeze({a:true}),Object.freeze([])]);Object.freeze(v);await test(`frozen-positive-${api}`,api==='markdown'?'refused':'accepted',async()=>{await fn(v);return 'accepted';});}
const v=fresh();let getterCalls=0;Object.defineProperty(v,'outer',{configurable:true,enumerable:true,get(){getterCalls++;delete v.outer;return 'synthetic-getter-value';}});
await test('generated-stamp-self-deleting-getter','refused-without-getter',async()=>{try{const result=await candidate.envelope.stampEnvelopeDigest(v);return `accepted-getters-${getterCalls}-stamp-valid-${m.digest(result)===result.semantic_digest}`;}catch{return getterCalls?'refused-after-getter':'refused-without-getter';}});
const flows=JSON.parse(fs.readFileSync(new URL('../consumer-flows.json', import.meta.url)));const identity=`sha256:${'1'.repeat(64)}`;const statement=planSourceEvidence('synthetic',{semantic_digest:identity,evidence_id:'synthetic-evidence'});
out.push({name:'consumer-planSourceEvidence',actual:{listed:flows.nodes.some(n=>n.id==='packages/uwmd-lake/src/plan.ts#planSourceEvidence'),firstParameter:statement.params[0],identityPreserved:statement.params[0]===identity,sqlConflict:statement.sql.includes('ON CONFLICT (semantic_digest, evidence_id)')},expected:'classify source-evidence identity sink',pass:flows.nodes.some(n=>n.id==='packages/uwmd-lake/src/plan.ts#planSourceEvidence')});
fs.writeFileSync(resolve(evidence, 'rereview-boundary-results.json'),JSON.stringify({platform:process.platform,node:process.version,probes:out},null,2));console.log(JSON.stringify({count:out.length,passing:out.filter(x=>x.pass).length,failures:out.filter(x=>!x.pass)},null,2));
