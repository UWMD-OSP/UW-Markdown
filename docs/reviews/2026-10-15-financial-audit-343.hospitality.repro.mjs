// Issue #343 synthetic observations; run from repository root after build.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root=resolve(process.argv[2] ?? '.');
const { parseUWFile, evaluateCalc, validateUWFile } = await import(pathToFileURL(resolve(root,'packages/uwmd-verify/dist/index.js')).href);
const dict=JSON.parse(readFileSync(`${root}/spec/metrics/builtin.json`)).calculations;
function record(asset,sections) {return parseUWFile(`---\nuw_version: "3.0"\nasset_class: ${asset}\n---\n`+Object.entries(sections).map(([id,value])=>`\n\`\`\`json uw:section=${id} source=manual\n${JSON.stringify(value)}\n\`\`\`\n`).join(''));}
function calc(asset,id,sections){return evaluateCalc(dict.find(x=>x.id===id&&x.asset_classes.includes(asset)),{parsed:record(asset,sections),prior_results:{},locale:'en-US'});}
let count=0;const out=[];
function check(name,asset,id,sections,expected){const result=calc(asset,id,sections);assert.equal(result.ok,true,name);assert.equal(result.value,expected,name);count++;out.push({name,id,result:result.value});}
check('M01 labor inclusive','hospitality','fb_gross_margin',{hotel_food_beverage:{fb_revenue:100000,fb_cogs:30000,fb_labor:20000}},0.5);
check('M01 labor zero','hospitality','fb_gross_margin',{hotel_food_beverage:{fb_revenue:100000,fb_cogs:30000,fb_labor:0}},0.7);
check('M01 labor missing','hospitality','fb_gross_margin',{hotel_food_beverage:{fb_revenue:100000,fb_cogs:30000}},null);
check('M05 one-based','hospitality','revpar_index',{noi_model:{income:{rooms_revenue:60000}},rent_roll:{available_room_nights:1000},hotel_metrics:{market_revpar:50}},1.2);
check('M05 explicit intermediate round','hospitality','revpar_index',{noi_model:{income:{rooms_revenue:100.004}},rent_roll:{available_room_nights:1},hotel_metrics:{market_revpar:1}},100);
check('M06 annual snapshot','senior_housing','revpor',{noi_model:{income:{effective_gross_income:1200000}},rent_roll:{occupied_units:80}},1250);
check('M06 changed snapshot','senior_housing','revpor',{noi_model:{income:{effective_gross_income:1200000}},rent_roll:{occupied_units:100}},1000);
check('M07 800 nights','hospitality','adr',{noi_model:{income:{rooms_revenue:100000}},rent_roll:{occupied_room_nights:800}},125);
check('M07 900 nights','hospitality','adr',{noi_model:{income:{rooms_revenue:100000}},rent_roll:{occupied_room_nights:900}},111.11);
check('M07 800 occupancy','hospitality','occupancy',{rent_roll:{occupied_room_nights:800,available_room_nights:1000}},0.8);
check('M08 stated EGI','hospitality','gop_margin',{noi_model:{gross_operating_profit:45000,income:{effective_gross_income:150000}}},0.3);
check('M08 different EGI','hospitality','gop_margin',{noi_model:{gross_operating_profit:45000,income:{effective_gross_income:180000}}},0.25);
for(const [id,section] of [['fb_gross_margin',{hotel_food_beverage:{fb_revenue:0,fb_cogs:0,fb_labor:0}}],['revpor',{noi_model:{income:{effective_gross_income:1200000}},rent_roll:{occupied_units:0}}]]){const result=calc(id==='revpor'?'senior_housing':'hospitality',id,section);assert.equal(result.ok,false);assert.equal(result.error?.code,'CALC-DIV-ZERO');count++;out.push({name:'zero denominator',id,error:result.error?.code});}
const physical=record('hospitality',{rent_roll:{occupied_room_nights:900,available_room_nights:1000,adr:200,occupancy:0.9},noi_model:{income:{rooms_revenue:100000}}});
const findings=validateUWFile(physical).issues;assert.equal(findings.some(x=>x.severity==='error'),false);count++;out.push({name:'M07 no eligibility assertion available',findings});
console.log(JSON.stringify({count,out},null,2));
