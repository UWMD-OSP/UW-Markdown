// Issue #343 synthetic observations; run after build. Not normative conformance.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseUWFile,evaluateCalc} from '../../packages/uwmd-verify/dist/index.js';
const dict=JSON.parse(readFileSync(new URL('../../spec/metrics/builtin.json', import.meta.url),'utf8'));
const block=(section,content)=>({annotation:{section},meta:{},content});
const deal=(s)=>({...parseUWFile('---\nuw_version: "3.0"\n---\n'),sections:Object.fromEntries(Object.entries(s).map(([k,v])=>[k,block(k,v)]))});
let count=0;
function check(name,id,cls,sections,want) {const m=dict.calculations.find(m=>m.id===id&&m.asset_classes.includes(cls)); const got=evaluateCalc(m,{parsed:deal(sections),prior_results:{},locale:'en-US'}); const observed=got.ok?got.value:got.error.code;assert.equal(observed,want,name);count++;console.log(JSON.stringify({name,id,observed}));}
check('rent numerator subject, above market','rent_index','data_center',{dc_revenue:{rent_per_kw_month:110,market_rent_per_kw_month:100}},1.1);
check('rent below market','rent_index','data_center',{dc_revenue:{rent_per_kw_month:80,market_rent_per_kw_month:100}},0.8);
check('rent missing market','rent_index','data_center',{dc_revenue:{rent_per_kw_month:110,market_rent_per_kw_month:null}},null);
check('rent zero market','rent_index','data_center',{dc_revenue:{rent_per_kw_month:110,market_rent_per_kw_month:0}},'CALC-DIV-ZERO');
const power={dc_capacity:{contracted_it_load_kw:1000,design_pue:1.5,measured_pue:1.2},dc_power:{stated_annual_power_cost:null,utility_rate_per_kwh:0.1}};
check('contracted design annual energy','annual_facility_kwh_at_contract','data_center',power,13140000);
check('contracted design fallback annual cost','annual_power_cost','data_center',power,1314000);
check('measured PUE does not substitute','annual_power_cost','data_center',{...power,dc_capacity:{...power.dc_capacity,measured_pue:2}},1314000);
check('stated bill wins lazily without capacity/rate','annual_power_cost','data_center',{dc_power:{stated_annual_power_cost:700000}},700000);
check('stated zero bill wins','annual_power_cost','data_center',{dc_power:{stated_annual_power_cost:0}},0);
check('missing rate stays null','annual_power_cost','data_center',{dc_capacity:power.dc_capacity,dc_power:{stated_annual_power_cost:null}},null);
check('economic occupancy exact corpus numerator','economic_occupancy','self_storage',{noi_model:{income:{effective_gross_income:1053000,gross_potential_rent:{value:1080000}}}},0.975);
check('economic occupancy can exceed one with other income','economic_occupancy','self_storage',{noi_model:{income:{effective_gross_income:1100000,gross_potential_rent:{value:1000000}}}},1.1);
const coc={sources_uses:{equity_metrics:{equity_total:3000000}},dcf:{annual_cash_flows:[{year:2,net_cash_flow_levered:900000},{year:1,net_cash_flow_levered:600000}]},noi_model:{net_operating_income:1000000},debt_structure:{annual_debt_service:700000}};
for(const cls of [...new Set(dict.calculations.filter(m=>m.id==='cash_on_cash').flatMap(m=>m.asset_classes))]) {
check(`${cls} stated Y1, unordered rows`,'cash_on_cash',cls,coc,0.2);
check(`${cls} zero Y1 wins`,'cash_on_cash',cls,{...coc,dcf:{annual_cash_flows:[{year:1,net_cash_flow_levered:0}]}},0);
check(`${cls} negative Y1 wins`,'cash_on_cash',cls,{...coc,dcf:{annual_cash_flows:[{year:1,net_cash_flow_levered:-600000}]}},-0.2);
check(`${cls} absent Y1 fallback`,'cash_on_cash',cls,{...coc,dcf:{annual_cash_flows:[]}},0.1);
check(`${cls} no total equity`,'cash_on_cash',cls,{...coc,sources_uses:{sources:{sponsor_equity:3000000}}},null);
check(`${cls} zero equity refuses`,'cash_on_cash',cls,{...coc,sources_uses:{equity_metrics:{equity_total:0}}},'CALC-DIV-ZERO');
}
check('office stated RSF only','price_per_sqft','office',{valuation:{purchase_price:10000000},property:{rentable_square_feet:50000,total_nra_sqft:40000}},200);
check('office no denominator substitution','price_per_sqft','office',{valuation:{purchase_price:10000000},property:{total_nra_sqft:40000}},null);
check('retail GLA','price_per_sqft','retail',{valuation:{purchase_price:10000000},property:{gross_leasable_area:40000,rentable_square_feet:50000}},250);
check('storage NRSF','price_per_nrsf','self_storage',{valuation:{purchase_price:10000000},property:{net_rentable_square_feet:25000,rentable_square_feet:50000}},400);
console.log(`PASS ${count} deterministic cases`);
