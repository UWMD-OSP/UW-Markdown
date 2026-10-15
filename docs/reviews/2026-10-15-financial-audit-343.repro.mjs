// Issue #343 synthetic intake observations, not new normative conformance.
// Run after npm run build, from repository root:
// node docs/reviews/2026-10-15-financial-audit-343.repro.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateCalc, parseUWFile, validateUWFile } from '../../packages/uwmd-verify/dist/index.js';

const dictionary = JSON.parse(readFileSync(new URL('../../spec/metrics/builtin.json', import.meta.url))).calculations;
const results = [];
function record(asset, sections, quick = {}, extra = '') {
  const blocks = sections.map(([id, content, variant]) => `\n\`\`\`json uw:section=${id}${variant ? ` variant=${variant}` : ''} source=manual\n${JSON.stringify(content)}\n\`\`\`\n`).join('');
  return parseUWFile(`---\nuw_version: "3.0"\nasset_class: ${asset}\n${extra}quick_metrics:\n${Object.entries(quick).map(([k,v]) => `  ${k}: ${v}\n`).join('')}---\n${blocks}`);
}
function calc(asset, id, parsed, sectionVariants) {
  const declaration = dictionary.find(d => d.id === id && d.asset_classes.includes(asset));
  assert.ok(declaration, id);
  const r = evaluateCalc(declaration, {parsed, prior_results:{}, locale:'en-US', ...(sectionVariants ? {sectionVariants} : {})});
  return r.ok ? r.value : r.error.code;
}
function check(name, actual, expected, parsed) {
  assert.deepEqual(actual, expected, name);
  results.push({name, actual, ...(parsed ? {validation:validateUWFile(parsed).issues} : {})});
}
function dc({vp=10000000, qp=12000000, pk=1000, ck=1000, valuations, extra=''} = {}) {
  return record('data_center', [
    ['property',{critical_it_load_kw:pk}],
    ['dc_capacity',{critical_it_load_kw:ck, planned_it_load_kw:2000, contracted_it_load_kw:500, design_pue:1.5, utility_feed_kw:3000, redundancy:'n_plus_1'}],
    ...(valuations ?? [['valuation',vp === null ? {} : {purchase_price:vp}]]),
  ], qp === null ? {} : {purchase_price:qp}, extra);
}
const dcValues = (p, variants) => ['price_per_kw','price_per_commissioned_kw'].map(id=>calc('data_center',id,p,variants));
for (const [name, opts, expected] of [
  ['equal prices',{qp:10000000},[10000,10000]],
  ['different prices',{},[10000,12000]],
  ['missing valuation price',{vp:null},[null,12000]],
  ['missing quick price',{qp:null},[10000,null]],
  ['different denominators',{ck:2000},[10000,6000]],
]) {
  const p=dc(opts); check(`M04 ${name}`,dcValues(p),expected,p);
  if(name==='different denominators') assert.ok(validateUWFile(p).issues.some(x=>x.code==='CC-DC-08'));
}
const priceControl=dc();
priceControl.sections.sources_uses = record('data_center', [['sources_uses',{uses:{purchase_price:12000000}}]]).sections.sources_uses;
check('M04 CC-10 positive control',validateUWFile(priceControl).issues.filter(x=>x.code==='CC-10').length,1,priceControl);
const variants = dc({valuations:[['valuation',{_role:'primary',purchase_price:10000000},'actual'],['valuation',{_role:'summary',purchase_price:14000000},'forecast']]});
check('M04 primary valuation',dcValues(variants),[10000,12000],variants);
check('M04 explicit valuation forecast',dcValues(variants,{valuation:'forecast'}),[14000,12000]);
check('M04 explicit missing valuation refuses',dcValues(variants,{valuation:'absent'}),['CALC-RESOLVE-002',12000]);
const ambiguous=dc({valuations:[['valuation',{_role:'summary',purchase_price:10000000},'a'],['valuation',{_role:'summary',purchase_price:14000000},'b']]});
check('M04 ambiguous valuation refuses',dcValues(ambiguous),['CALC-RESOLVE-002',12000],ambiguous);
for(const scenario of ['stabilized_acquisition','value_add']) check(`M04 descriptive scenario ${scenario}`,dcValues(dc({extra:`scenario: ${scenario}\n`})),[10000,12000]);

function hotel({revenue=180000, adr=200, occupancy=0.9, available=1000, occupied=900, keys=100, period, actualForecast, rolls}={}) {
  return record('hospitality',[
    ['property',{keys}],
    ...(rolls ?? [['rent_roll',{available_room_nights:available,...(occupied===null?{}:{occupied_room_nights:occupied}),...(adr===null?{}:{adr}),...(occupancy===null?{}:{occupancy}),...(period?{period}:{}),...(actualForecast?{modeling_basis:actualForecast}:{})}]]),
    ['noi_model',{income:revenue===null?{}:{rooms_revenue:revenue},...(period?{period:'2025'}:{}),...(actualForecast?{modeling_basis:'actual'}:{})}],
    ['hotel_metrics',{market_revpar:100}],
  ]);
}
const hv=(p, variants)=>['total_room_revenue','room_revenue_per_key','revpar','adr'].map(id=>calc('hospitality',id,p,variants));
for(const [name,opts,expected] of [
  ['matching',{},[180000,1800,180,200]],
  ['conflict same supplied basis',{revenue:100000},[180000,1800,100,111.11]],
  ['occupied nights disagree',{revenue:100000,occupied:800},[180000,1800,100,125]],
  ['different period labels',{revenue:100000,period:'2026'},[180000,1800,100,111.11]],
  ['actual vs forecast labels',{revenue:100000,actualForecast:'forecast'},[180000,1800,100,111.11]],
  ['missing reported revenue',{revenue:null},[180000,1800,null,null]],
  ['missing stated ADR',{adr:null},[null,null,180,200]],
  ['missing occupancy',{occupancy:null},[null,null,180,200]],
  ['null available nights',{available:null},[null,null,null,200]],
  ['zero keys',{keys:0},[180000,'CALC-DIV-ZERO',180,200]],
  ['missing occupied nights',{occupied:null},[180000,1800,180,null]],
  ['zero occupancy and reported zero',{occupancy:0,occupied:0,revenue:0},[0,0,0,'CALC-DIV-ZERO']],
  ['zero occupancy positive reported',{occupancy:0,occupied:0,revenue:100000},[0,0,100,'CALC-DIV-ZERO']],
  ['zero available nights',{available:0},[0,0,'CALC-DIV-ZERO',200]],
  ['half-cent boundary',{adr:1.005,occupancy:1,available:1,occupied:1,keys:2,revenue:1.005},[1.01,0.51,1.01,1.01]],
]) {
  const p=hotel(opts);check(`M09 ${name}`,hv(p),expected,p);
  if(name==='missing reported revenue'||name==='zero available nights') assert.ok(validateUWFile(p).issues.some(x=>x.code==='CC-HOSP-04'));
  if(name==='conflict same supplied basis') assert.ok(!validateUWFile(p).issues.some(x=>x.code==='CC-HOSP-04'));
}
const periods=hotel({rolls:[['rent_roll',{_role:'primary',available_room_nights:1000,occupied_room_nights:900,adr:200,occupancy:0.9},'actual'],['rent_roll',{_role:'summary',available_room_nights:2000,occupied_room_nights:1800,adr:300,occupancy:0.9},'forecast']]});
check('M09 primary roll',hv(periods),[180000,1800,180,200],periods);
check('M09 explicit forecast roll',hv(periods,{rent_roll:'forecast'}),[540000,5400,90,100]);
console.log(JSON.stringify({source:'Issue #343 independent synthetic intake; complete validator findings retained', cases:results.length, results},null,2));
