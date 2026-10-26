// RFC0092 admitted identities only. Reuse native procedures and comparison
// contracts; this module never generates a flow, schedule, assumption or payoff.
import { recomputeSizing, verifyCapitalStack, CAPITAL_STACK_SIZING_DECIMALS, type CapitalStack, type SizingFigure } from '../capital-stack.js';
import { datedFlowsOf, xnpvOf, xirrOf, verifyCashFlowSeries, type CashFlowSeries } from '../cash-flow-series.js';
import { leaseUpContext, leaseUpPeriodOrdinal, verifyLeaseUpSchedule, type LeaseUpSchedule } from '../lease-up.js';
import { quantizeDecimal } from './quantize.js';
import { compareStatedMetric } from './stated-precision.js';
import { getSizeIntensive } from '../protocol.js';
import { CalcError } from './errors.js';
import { record, finite, type ResolvedProFormaAddress } from '../pro-forma-address.js';
import type { ProFormaRelationship, ProFormaState } from '../pro-forma-types.js';
import type { ParsedUWFile } from '../types.js';

export interface ProFormaIdentityOutcome {
  state: ProFormaState;
  reason?: string;
  computed: number | null;
  findings: unknown[];
}
export const unavailableIdentity = (reason: string, findings: unknown[] = []): ProFormaIdentityOutcome =>
  ({ state: 'unverifiable', reason, computed: null, findings });
const fixed = (stated: number, computed: number, decimals: number, findings: unknown[] = []): ProFormaIdentityOutcome =>
  ({ state: finite(computed) && quantizeDecimal(stated, decimals) === quantizeDecimal(computed, decimals) ? 'verified' : 'failed',
    computed: finite(computed) ? computed : null, findings });
export function evaluateProFormaIdentity(
  rel: ProFormaRelationship,
  target: ResolvedProFormaAddress,
  inputs: Map<string, ResolvedProFormaAddress>,
  conventions: Record<string, unknown>,
  parsed: ParsedUWFile,
  decimals: number | undefined,
): ProFormaIdentityOutcome {
  const input = (role: string) => inputs.get(role);
  const home = (role: string, section: string, pointer: string) => {
    const value = input(role);
    return value?.address.section === section && value.address.pointer === pointer ? value : undefined;
  };
  const expectUnit = (unit: string): boolean => rel.unit === unit;
  const monetary = () => typeof rel.currency === 'string' && rel.currency === parsed.frontmatter.currency_code;
  const missing = () => unavailableIdentity('missing_or_null_input');
  if (!finite(target.value)) return unavailableIdentity('no_numeric_statement');
  const stated = target.value;
  const identity = rel.identity;
  const roles: Record<string, string[]> = {
    total_net: ['stream', 'anchor'], moic: ['stream', 'anchor'], xnpv: ['stream', 'anchor', 'rate'], xirr: ['stream', 'anchor'],
    coverage: ['stack', 'figure', 'noi'], blended_coverage: ['stack', 'figure', 'noi'], debt_yield_through: ['stack', 'figure', 'noi'],
    ltc_through: ['stack', 'figure', 'cost'], ltv_through: ['stack', 'figure', 'value'], weighted_cost: ['stack', 'figure'],
    net_cash_flow: ['schedule'], final_occupied_sf: ['schedule'], final_occupancy_rate: ['schedule', 'total_sf', 'native_occupied_summary'],
    ltv: ['loan', 'denominator'],
  };
  if (roles[identity] && [...inputs.keys()].some(role => !roles[identity]!.includes(role))) return unavailableIdentity('unsupported_input_role');
  const selectors = identity === 'coverage' ? ['over', 'period'] : identity === 'weighted_cost' ? ['over', 'period']
    : ['blended_coverage', 'debt_yield_through', 'ltc_through', 'ltv_through'].includes(identity) ? ['through', 'period'] : ['period'];
  if (Object.keys(rel.selectors ?? {}).some(key => !selectors.includes(key))) return unavailableIdentity('unsupported_selector');
  if (['total_net', 'moic', 'xnpv', 'xirr'].includes(identity)) {
    const stream = home('stream', 'cash_flow_series', '');
    if (!stream || !record(stream.value)) return missing();
    const series = stream.value as unknown as CashFlowSeries;
    if (series.day_count !== 'actual/365f' || conventions.cash_flow_timing !== 'dated' ||
      (identity === 'xirr' && conventions.irr_frequency !== 'xirr')) return unavailableIdentity('unsupported_or_missing_convention');
    if (!expectUnit(identity === 'moic' ? 'x' : identity === 'xirr' ? '%' : '$')) return unavailableIdentity('unit_mismatch');
    if ((identity === 'total_net' || identity === 'xnpv') && !monetary()) return unavailableIdentity('missing_or_mismatched_currency');
    if (rel.currency !== undefined && rel.currency !== parsed.frontmatter.currency_code) return unavailableIdentity('currency_mismatch');
    if (target.block === stream.block && target.address.pointer.startsWith('/series/')) return unavailableIdentity('self_reference');
    const flows = datedFlowsOf(series);
    if (!flows) return unavailableIdentity('CF-UNEVALUABLE');
    const anchor = input('anchor');
    if (anchor && (anchor.block !== stream.block || anchor.address.pointer !== '/series/0/date')) return unavailableIdentity('anchor_mismatch');
    const rate = input('rate')?.value;
    if (identity === 'xnpv' && !finite(rate)) return missing();
    const metrics = identity === 'xnpv' ? { xnpv: { rate: rate as number, value: stated } } : { [identity]: stated };
    const native = verifyCashFlowSeries({ ...series, stated_metrics: metrics });
    if (native.verdict !== 'verified') return { state: native.verdict, computed: null,
      reason: native.issues[0]?.code, findings: native.issues };
    let computed = 0;
    if (identity === 'total_net') for (const flow of flows) computed += flow.amount;
    if (identity === 'moic') {
      let inflow = 0; let outflow = 0;
      for (const flow of flows) { if (flow.amount >= 0) inflow += flow.amount; else outflow += -flow.amount; }
      if (outflow === 0) return unavailableIdentity('CF-UNEVALUABLE', native.issues);
      computed = inflow / outflow;
    }
    if (identity === 'xnpv') computed = xnpvOf(flows, rate as number);
    if (identity === 'xirr') computed = xirrOf(flows);
    return fixed(stated, computed, identity === 'moic' ? 4 : identity === 'xirr' ? 6 : 2, native.issues);
  }
  if (['coverage', 'blended_coverage', 'debt_yield_through', 'ltc_through', 'ltv_through', 'weighted_cost'].includes(identity)) {
    const selected = home('stack', 'capital_stack', '');
    if (!selected || !record(selected.value) || !Array.isArray(selected.value.tranches)) return missing();
    if (target.block === selected.block && target.address.pointer.startsWith('/tranches/')) return unavailableIdentity('self_reference');
    const tranches = selected.value.tranches;
    // Admit the native structural domains before a typed helper reads them.
    if (!tranches.length || tranches.some(t => !record(t) || typeof t.id !== 'string' || !t.id.length ||
      !['senior_debt', 'mezzanine_debt', 'preferred_equity', 'common_equity', 'bridge', 'seller_financing', 'other_debt'].includes(String(t.class)) ||
      !Number.isInteger(t.position) || Number(t.position) < 1 || !finite(t.amount) || t.amount < 0 ||
      (t.rate != null && !finite(t.rate)) || (t.amortization_months != null && (!Number.isInteger(t.amortization_months) || Number(t.amortization_months) < 0)))) return unavailableIdentity('invalid_native_stack');
    if (new Set(tranches.map(t => t.id)).size !== tranches.length || new Set(tranches.map(t => t.position)).size !== tranches.length) return unavailableIdentity('ambiguous_native_stack');
    const stack = selected.value as unknown as CapitalStack;
    const selector = rel.selectors ?? {};
    const over = selector.over; const through = selector.through;
    if (identity === 'weighted_cost' && (over !== '*' || through !== undefined)) return unavailableIdentity('unsupported_selector');
    if (identity === 'coverage' && (typeof over !== 'string' || stack.tranches.filter(t => t.id === over).length !== 1)) return unavailableIdentity('unsupported_selector');
    if (!['coverage', 'weighted_cost'].includes(identity) && (!Number.isInteger(through) || (through as number) < 1)) return unavailableIdentity('unsupported_selector');
    const figure = input('figure') ?? (target.block === selected.block && /^\/sizing\/\d+\/value$/.test(target.address.pointer) ? target : undefined);
    if (figure) {
      if (figure.block !== selected.block || !/^\/sizing\/\d+(?:\/value)?$/.test(figure.address.pointer)) return unavailableIdentity('figure_binding_mismatch');
      const actual = figure.address.pointer.endsWith('/value')
        ? (stack.sizing ?? [])[Number(figure.parts[1])] : figure.value;
      if (!record(actual) || actual.fn !== identity || actual.over !== over || actual.through !== through) return unavailableIdentity('selector_context_mismatch');
    }
    const noi = home('noi', 'noi_model', '/net_operating_income');
    const cost = input('cost'); const value = home('value', 'valuation', '/underwritten_value');
    if (['coverage', 'blended_coverage', 'debt_yield_through'].includes(identity) && !finite(noi?.value)) return missing();
    if (identity === 'ltc_through' && (!cost || cost.address.section !== 'sources_uses' ||
      !['/uses/total', '/total_uses'].includes(cost.address.pointer) || !finite(cost.value))) return missing();
    if (identity === 'ltv_through' && !finite(value?.value)) return unavailableIdentity('missing_selected_underwritten_value');
    const unit = ['coverage', 'blended_coverage'].includes(identity) ? 'x' : '%';
    if (!expectUnit(unit)) return unavailableIdentity('unit_mismatch');
    const fig = { id: 'bound-target', fn: identity, value: stated, ...(over !== undefined ? { over } : {}), ...(through !== undefined ? { through } : {}) } as SizingFigure;
    const ctx = { noi: finite(noi?.value) ? noi.value : null,
      total_cost: finite(cost?.value) ? cost.value : null, total_value: finite(value?.value) ? value.value : null };
    const computed = recomputeSizing(fig, stack.tranches, ctx);
    const native = verifyCapitalStack({ tranches: stack.tranches, sizing: [fig] }, ctx);
    if (computed === null) return unavailableIdentity('CS-SIZING-UNEVALUABLE', native.issues);
    return { ...fixed(stated, computed, CAPITAL_STACK_SIZING_DECIMALS[fig.fn], native.issues), reason: native.issues[0]?.code };
  }
  if (['net_cash_flow', 'final_occupied_sf', 'final_occupancy_rate'].includes(identity)) {
    const selected = home('schedule', 'lease_up_schedule', '');
    if (!selected || !record(selected.value) || !Array.isArray(selected.value.schedule)) return missing();
    const schedule = selected.value as unknown as LeaseUpSchedule;
    const rows = schedule.schedule;
    if (rows.some(row => !record(row) || typeof row.period !== 'string')) return unavailableIdentity('invalid_period_selection');
    if (!['monthly', 'quarterly'].includes(schedule.period_granularity) || rows.length === 0) return unavailableIdentity('invalid_period_selection');
    const ordinals = rows.map(row => leaseUpPeriodOrdinal(row.period, schedule.period_granularity));
    if (ordinals.some((n, i) => n === null || (i > 0 && n !== ordinals[i - 1]! + 1))) return unavailableIdentity('invalid_period_selection');
    const context = { total_sf: null as number | null };
    let computed: number;
    let nativeSchedule: LeaseUpSchedule;
    if (identity === 'net_cash_flow') {
      const matches = rows.filter(row => row.period === rel.selectors?.period);
      if (matches.length !== 1) return unavailableIdentity('invalid_period_selection');
      const row = matches[0]!;
      if (target.target.period_key !== null && target.target.period_key !== row.period) return unavailableIdentity('period_context_mismatch');
      if (!finite(row.rent_revenue) || !finite(row.concessions) || !finite(row.ti_lc_capex)) return missing();
      if (!expectUnit('$') || !monetary()) return unavailableIdentity('unit_or_currency_mismatch');
      computed = row.rent_revenue + row.concessions + row.ti_lc_capex;
      nativeSchedule = { ...schedule, schedule: [{ ...row, net_cash_flow: stated }], stabilized_summary: null };
    } else if (identity === 'final_occupied_sf') {
      if (!expectUnit('sqft')) return unavailableIdentity('unit_mismatch');
      const last = rows[rows.length - 1]!;
      if (!finite(last.occupied_sf)) return missing();
      if (target.block === selected.block && target.address.pointer === `/schedule/${rows.length - 1}/occupied_sf`) return unavailableIdentity('self_reference');
      computed = last.occupied_sf;
      nativeSchedule = { ...schedule, schedule: rows.map(row => ({ period: row.period, occupied_sf: row.occupied_sf })), stabilized_summary: { occupied_sf: stated } };
    } else {
      if (!expectUnit('%')) return unavailableIdentity('unit_mismatch');
      const size = input('total_sf');
      if (!size || size.address.section !== 'property' || !size.block) return missing();
      const view = { ...parsed, sections: { ...parsed.sections, property: size.block } };
      context.total_sf = leaseUpContext(view).total_sf;
      if (!finite(size.value) || context.total_sf !== size.value) return unavailableIdentity('invalid_size_binding');
      const intensive = getSizeIntensive(parsed.frontmatter.asset_class);
      const expectedSize = intensive?.unit === 'sqft' ? intensive.path : intensive?.secondary.find(path => path.endsWith('sqft') || path.endsWith('square_feet'));
      if (!expectedSize || size.address.pointer !== `/${expectedSize}` || context.total_sf === null || context.total_sf === 0) return unavailableIdentity('invalid_size_binding');
      const lastSf = rows[rows.length - 1]!.occupied_sf;
      const sf = finite(lastSf) ? lastSf : schedule.stabilized_summary?.occupied_sf;
      if (!finite(sf)) return missing();
      computed = sf / context.total_sf;
      nativeSchedule = { ...schedule, stabilized_summary: { ...schedule.stabilized_summary, occupancy_rate: stated } };
    }
    const native = verifyLeaseUpSchedule(nativeSchedule, context);
    return fixed(stated, computed, identity === 'final_occupancy_rate' ? 4 : 2, native.issues);
  }
  if (identity === 'ltv') {
    if (!expectUnit('%')) return unavailableIdentity('unit_mismatch');
    const loan = home('loan', 'debt_structure', '');
    if (!loan || !record(loan.value) || !finite(loan.value.loan_amount)) return missing();
    const basis = loan.value.ltv_basis;
    const denominator = input('denominator');
    const expected = basis === 'purchase-price' ? ['valuation', '/purchase_price']
      : basis === 'underwritten-value' ? ['valuation', '/underwritten_value']
      : basis === 'total-project-cost' ? ['sources_uses', '/total_project_cost'] : null;
    if (!expected) return unavailableIdentity('missing_or_unknown_ltv_basis');
    // RFC0128: a supplied effective convention constrains, never replaces, the loan's own basis.
    if (conventions.ltv_basis !== undefined && conventions.ltv_basis !== basis) return unavailableIdentity('convention_contradiction');
    if (target.address.section === 'debt_structure' && target.block !== loan.block) return unavailableIdentity('loan_context_mismatch');
    if (!denominator || denominator.address.section !== expected[0] || denominator.address.pointer !== expected[1]) return unavailableIdentity('denominator_binding_mismatch');
    if (!finite(denominator.value)) return missing();
    if (denominator.value === 0) throw new CalcError('CALC-DIV-ZERO', 'Selected LTV denominator is zero.');
    if (decimals === undefined) return unavailableIdentity('missing_stated_precision');
    const raw = loan.value.loan_amount / denominator.value;
    return { ...compareStatedMetric(raw, stated, decimals, { minimum_stated_decimals: 2, round_to: 6 }), findings: [] };
  }
  return unavailableIdentity('identity_not_defined');
}

