import { describe, expect, it } from 'vitest';
import { parseUWFile } from '../parser.js';
import { proFormaAddressResolver } from '../pro-forma-address.js';
import { evaluateProFormaIdentity } from './pro-forma-identities.js';
import type { ProFormaRelationship } from '../pro-forma-types.js';
const addr = (section: string, pointer = '') => ({ section, variant: null, pointer });
function run(identity: string, stated: number, extras: Record<string, unknown>, bindings: Array<[string,string,string]>, options: Partial<ProFormaRelationship> = {}) {
  const source = '---\nuw_version: "3.0"\nasset_class: office\ncurrency_code: USD\n---\n' + Object.entries({ dcf: { result: stated }, ...extras }).map(([section, value]) => `\n\`\`\`json uw:section=${section} source=manual\n${JSON.stringify(value)}\n\`\`\`\n`).join('');
  const parsed = parseUWFile(source), resolver = proFormaAddressResolver(parsed, true);
  const target = resolver.resolve(addr('dcf', '/result'));
  const rel: ProFormaRelationship = { identity, procedure_version: '1', target: addr('dcf', '/result'), inputs: bindings.map(([role, section, pointer]) => ({ role, address: addr(section, pointer) })), unit: '%', currency: 'USD', ...options };
  return evaluateProFormaIdentity(rel, target, new Map(rel.inputs.map(b => [b.role, resolver.resolve(b.address)])), { cash_flow_timing: 'dated', irr_frequency: 'xirr', ...rel.conventions }, parsed, 6);
}
const stream = { day_count: 'actual/365f', series: [{ date: '2025-01-01', amount: -100 }, { date: '2026-01-01', amount: 120 }] };
describe('native admitted procedures', () => {
  it.each([['total_net',20,'$'], ['moic',1.2,'x'], ['xnpv',0,'$'], ['xirr',0.2,'%']])('reuses dated %s and its native quantum', (id, stated, unit) => {
    const inputs: Array<[string,string,string]> = [['stream','cash_flow_series','']];
    if (id === 'xnpv') inputs.push(['rate','assumptions','/rate']);
    expect(run(String(id), Number(stated), { cash_flow_series: stream, assumptions: { rate: 0.2 } }, inputs, { unit: String(unit) }).state).toBe('verified');
  });
  const stack = { tranches: [{ id: 's', class: 'senior_debt', position: 1, amount: 100, rate: 0.1, amortization_months: 0, accrual: 'cash' }] };
  it.each([['coverage',2,'x'], ['blended_coverage',2,'x'], ['debt_yield_through',0.2,'%'], ['ltc_through',0.5,'%'], ['ltv_through',0.4,'%'], ['weighted_cost',0.1,'%']])('reuses native stack %s', (id, stated, unit) => {
    const bindings: Array<[string,string,string]> = [['stack','capital_stack','']];
    if (['coverage','blended_coverage','debt_yield_through'].includes(String(id))) bindings.push(['noi','noi_model','/net_operating_income']);
    if (id === 'ltc_through') bindings.push(['cost','sources_uses','/uses/total']);
    if (id === 'ltv_through') bindings.push(['value','valuation','/underwritten_value']);
    expect(run(String(id),Number(stated),{capital_stack:stack,noi_model:{net_operating_income:20},sources_uses:{uses:{total:200}},valuation:{underwritten_value:250}},bindings,{unit:String(unit),selectors:id==='weighted_cost'?{over:'*'}:id==='coverage'?{over:'s'}:{through:1}}).state).toBe('verified');
  });
  const schedule = { model_type: 'absorption_curve', period_granularity: 'monthly', schedule: [{ period: '2025-01', rent_revenue: 100, concessions: -10, ti_lc_capex: -20, occupied_sf: 80 }] };
  it.each([['net_cash_flow',70,'$'], ['final_occupied_sf',80,'sqft'], ['final_occupancy_rate',0.8,'%']])('reuses lease-up %s', (id, stated, unit) => {
    const bindings: Array<[string,string,string]> = [['schedule','lease_up_schedule','']];
    if (id==='final_occupancy_rate') bindings.push(['total_sf','property','/rentable_square_feet']);
    expect(run(String(id),Number(stated),{lease_up_schedule:schedule,property:{rentable_square_feet:100}},bindings,{unit:String(unit),...(id==='net_cash_flow'?{selectors:{period:'2025-01'}}:{})}).state).toBe('verified');
  });
  it.each([['purchase-price','valuation','/purchase_price',0.75], ['underwritten-value','valuation','/underwritten_value',0.625], ['total-project-cost','sources_uses','/total_project_cost',0.5]])('uses explicit same-loan ltv: %s', (basis,section,pointer,stated) => {
    expect(run('ltv',Number(stated),{debt_structure:{loan_amount:75,ltv_basis:basis},valuation:{purchase_price:100,underwritten_value:120},sources_uses:{total_project_cost:150}},[['loan','debt_structure',''],['denominator',String(section),String(pointer)]]).state).toBe('verified');
  });
  it('refuses price as native stack value and absent weighted selectors', () => {
    expect(run('ltv_through',0.5,{capital_stack:stack,valuation:{purchase_price:200}},[['stack','capital_stack',''],['value','valuation','/purchase_price']],{selectors:{through:1}}).state).toBe('unverifiable');
    expect(run('weighted_cost',0.1,{capital_stack:stack},[['stack','capital_stack','']]).state).toBe('unverifiable');
  });
  it('retains a native mismatch and refuses a sixteenth procedure', () => {
    expect(run('moic',9,{cash_flow_series:stream},[['stream','cash_flow_series','']],{unit:'x'}).state).toBe('failed');
    expect(run('land_residual',1,{},[]).reason).toBe('identity_not_defined');
  });
});
