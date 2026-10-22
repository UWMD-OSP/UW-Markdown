// RFC0096: bounded admission of current stated payloads, never financial recomputation.
import { readExternalDirective, CompositionError } from './composition.js';
import type { ParsedUWFile, UWBlock, ValidationMessage } from './types.js';

type Obj = Record<string, unknown>;
type Predicate = (value: unknown) => boolean;
type Emit = (field: string) => void;
const own = Object.hasOwn;
const object = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const integer = (v: unknown): v is number => finite(v) && Number.isInteger(v);
const text = (v: unknown) => typeof v === 'string' && v.length > 0;
const nonnegative = (v: unknown) => finite(v) && v >= 0;
const unit = (v: unknown) => finite(v) && v >= 0 && v <= 1;
const enumeration = (...values: string[]): Predicate => v => typeof v === 'string' && values.includes(v);
const universals = ['_meta', '_notes', '_role', '_overrides'];
const accumulated = enumeration('cumulative', 'non_cumulative', 'compounding');

/** Unicode code-point order, including astral keys rather than UTF-16 order. */
function compare(a: string, b: string): number {
  const x = Array.from(a, c => c.codePointAt(0)!); const y = Array.from(b, c => c.codePointAt(0)!);
  for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i] - y[i];
  return x.length - y.length;
}
function value(o: Obj, k: string): unknown { return own(o, k) ? o[k] : undefined; }
function leaf(o: Obj, k: string, predicate: Predicate, emit: Emit, at = '', required = false): void {
  if (required ? !own(o, k) || !predicate(o[k]) : own(o, k) && o[k] !== null && !predicate(o[k])) emit(at + k);
}
function extras(o: Obj, keys: readonly string[], emit: Emit, at = ''): void {
  for (const k of Object.keys(o).filter(k => !keys.includes(k)).sort(compare)) emit(at + k);
}
function numeric(o: Obj, fields: readonly (readonly [string, Predicate])[], emit: Emit, at: string): void {
  for (const [k, predicate] of fields) leaf(o, k, predicate, emit, at);
}
function optionalObject(o: Obj, k: string, emit: Emit, visit: (child: Obj, at: string) => void, at = ''): void {
  if (!own(o, k) || o[k] === null) return;
  if (!object(o[k])) emit(at + k); else visit(o[k], `${at + k}.`);
}
export function currentPayloadBlocks(parsed: ParsedUWFile, section: string): Array<[string | null, UWBlock]> {
  if (!own(parsed.sections, section)) return [];
  const entry = parsed.sections[section];
  if (!object(entry)) return [];
  const single = own(entry, 'annotation') && object(entry.annotation)
    && typeof value(entry.annotation, 'section') === 'string' && own(entry, 'content');
  const rows: Array<[string | null, UWBlock]> = single
    ? [[null, entry as unknown as UWBlock]]
    : Object.keys(entry).sort(compare).map(key => [key, entry[key] as UWBlock]);
  return rows.filter(([, block]) => {
    if (!object(block) || !object(block.content) || !object(block.annotation)) return false;
    const meta = value(block.content, '_meta');
    const lifecycle = object(meta) ? value(meta, 'lifecycle') : undefined;
    const historical = object(lifecycle) && value(lifecycle, 'superseded') === true;
    if (historical || value(block.annotation, 'superseded') === true) return false;
    const externalMarker = value(block.annotation, 'external');
    if ((externalMarker !== true && externalMarker !== 'true') || !own(block.content, 'external')) return true;
    try { return readExternalDirective(block) === null; }
    catch (error) {
      if (!(error instanceof CompositionError)) throw error;
      // A malformed or null external member is not an admitted directive and
      // cannot hide independent payload errors. Its composition owner is separate.
      return true;
    }
  });
}
function emitter(issues: ValidationMessage[], code: string, section: string, variant: string | null): Emit {
  return field => issues.push({ code, severity: 'error', section, field,
    message: `${code}: ${field} violates the stated payload contract${variant === null ? '' : ` (variant "${variant}")`}` });
}
const luAssumptions: readonly (readonly [string, Predicate])[] = [
  ['monthly_turnover_rate', unit], ['market_rent_psf_at_stabilization', nonnegative],
  ['vacancy_during_lease_up', unit], ['concession_months_per_lease', nonnegative],
  ['tenant_improvement_psf', nonnegative], ['leasing_commission_rate', unit],
];
const luRows: readonly (readonly [string, Predicate])[] = [
  ['occupied_sf', nonnegative], ['leased_sf', nonnegative], ['in_place_rent_psf', nonnegative],
  ['market_rent_psf', nonnegative], ['vacancy_rate', unit], ['rent_revenue', finite],
  ['concessions', finite], ['ti_lc_capex', finite], ['net_cash_flow', finite],
];
const luSummary: readonly (readonly [string, Predicate])[] = [
  ['occupied_sf', nonnegative], ['occupancy_rate', unit], ['annualized_egi', finite], ['annualized_noi', finite],
];
function leaseUp(o: Obj, emit: Emit): void {
  leaf(o, 'model_type', enumeration('natural_turnover', 'absorption_curve'), emit, '', true);
  if (own(o, 'stabilization_target') && o.stabilization_target !== null) {
    const target = o.stabilization_target; const cadence = value(o, 'period_granularity');
    if (typeof target !== 'string'
      || cadence === 'monthly' && !/^[0-9]{4}-(0[1-9]|1[0-2])(?![\s\S])/.test(target)
      || cadence === 'quarterly' && !/^[0-9]{4}-Q[1-4](?![\s\S])/.test(target)) emit('stabilization_target');
  }
  optionalObject(o, 'assumptions', emit, (a, at) => { numeric(a, luAssumptions, emit, at); extras(a, luAssumptions.map(([k]) => k), emit, at); });
  if (own(o, 'schedule') && Array.isArray(o.schedule)) for (const [i, row] of o.schedule.entries()) {
    if (!object(row)) continue; // existing LU01 owns the unavailable required period
    const at = `schedule[${i}].`; numeric(row, luRows, emit, at);
    extras(row, ['period', ...luRows.map(([k]) => k)], emit, at);
  }
  optionalObject(o, 'stabilized_summary', emit, (s, at) => { numeric(s, luSummary, emit, at); extras(s, luSummary.map(([k]) => k), emit, at); });
  extras(o, [...universals, 'model_type', 'period_granularity', 'stabilization_target', 'assumptions', 'schedule', 'stabilized_summary'], emit);
}
const termKeys = ['method', 'pro_rata_share', 'share_basis', 'base_year', 'expense_stop_per_sqft', 'fixed_recovery_annual', 'admin_fee_pct', 'gross_up_pct', 'recoverable_pool', 'cap'];
const trueUpKeys = ['period_start', 'period_end', 'pool_actual', 'tenant_share_uncapped', 'tenant_share_capped', 'estimated_billed', 'true_up_amount', 'settlement', 'cash_flow_ref'];
function recovery(o: Obj, emit: Emit): void {
  const tenants = value(o, 'tenants'); if (!Array.isArray(tenants)) return;
  for (const [i, tenant] of tenants.entries()) {
    if (!object(tenant)) continue;
    optionalObject(tenant, 'recovery_terms', () => {}, t => {
      const at = `tenants[${i}].recovery_terms.`;
      leaf(t, 'share_basis', enumeration('nra', 'gla', 'stated'), emit, at);
      leaf(t, 'base_year', integer, emit, at);
      leaf(t, 'expense_stop_per_sqft', nonnegative, emit, at);
      leaf(t, 'fixed_recovery_annual', nonnegative, emit, at);
      leaf(t, 'admin_fee_pct', v => finite(v) && v >= 0 && v < 1, emit, at);
      leaf(t, 'gross_up_pct', v => finite(v) && v > 0 && v <= 1, emit, at);
      optionalObject(t, 'cap', () => {}, c => {
        leaf(c, 'over', enumeration('base_year', 'prior_year'), emit, `${at}cap.`);
        if (!(own(t, 'method') && t.method !== null && own(c, 'pct') && c.pct !== null)) {
          leaf(c, 'accumulation', accumulated, emit, `${at}cap.`);
        }
        extras(c, ['pct', 'over', 'accumulation'], emit, `${at}cap.`);
      });
      extras(t, termKeys, emit, at);
    });
    const rows = value(tenant, 'recovery_true_up'); if (!Array.isArray(rows)) continue;
    for (const [j, row] of rows.entries()) {
      if (!object(row)) continue;
      const at = `tenants[${i}].recovery_true_up[${j}].`;
      numeric(row, [['pool_actual', nonnegative], ['tenant_share_uncapped', nonnegative], ['tenant_share_capped', nonnegative], ['estimated_billed', nonnegative], ['true_up_amount', finite]], emit, at);
      extras(row, trueUpKeys, emit, at);
    }
  }
}
function sizing(o: Obj, emit: Emit, prefix = ''): void {
  if (!own(o, 'sizing')) return;
  const rows = o.sizing; if (!Array.isArray(rows)) { emit(`${prefix}sizing`); return; }
  for (const [i, row] of rows.entries()) {
    const at = `${prefix}sizing[${i}]`;
    if (!object(row)) { emit(at); continue; }
    leaf(row, 'id', text, emit, `${at}.`, true);
    leaf(row, 'fn', enumeration('coverage', 'blended_coverage', 'debt_yield_through', 'ltc_through', 'ltv_through', 'weighted_cost'), emit, `${at}.`, true);
    const over = own(row, 'over'); const through = own(row, 'through');
    if (over === through) emit(at);
    else if (over) leaf(row, 'over', text, emit, `${at}.`, true);
    else leaf(row, 'through', v => integer(v) && v >= 1, emit, `${at}.`, true);
    leaf(row, 'value', finite, emit, `${at}.`, true);
    extras(row, ['id', 'fn', 'over', 'through', 'value'], emit, `${at}.`);
  }
}
function waterfall(o: Obj, emit: Emit): void {
  optionalObject(o, 'clawback', () => {}, c => {
    if (value(c, 'basis') !== 'lp_irr_floor') leaf(c, 'floor_rate', v => finite(v) && v > 0 && v < 1, emit, 'clawback.');
    if (value(c, 'basis') !== 'lp_em_floor') leaf(c, 'floor_multiple', v => finite(v) && v > 1, emit, 'clawback.');
    extras(c, ['basis', 'floor_rate', 'floor_multiple', 'net_of_tax_rate', 'cap'], emit, 'clawback.');
  });
  optionalObject(o, 'stated_outcomes', emit, (out, at) => {
    for (const party of ['lp', 'gp']) optionalObject(out, party, emit, (p, pat) => {
      numeric(p, [['contributions', finite], ['distributions', finite], ['moic', nonnegative], ['xirr', finite]], emit, pat);
      extras(p, ['contributions', 'distributions', 'moic', 'xirr'], emit, pat);
    }, at);
    numeric(out, [['promote_total', finite], ['profit_total', finite], ['clawback_amount', finite]], emit, at);
    extras(out, ['lp', 'gp', 'promote_total', 'profit_total', 'clawback_amount'], emit, at);
  });
  if (!own(o, 'stated_schedule') || o.stated_schedule === null) return;
  if (!Array.isArray(o.stated_schedule)) { emit('stated_schedule'); return; }
  for (const [i, row] of o.stated_schedule.entries()) {
    const at = `stated_schedule[${i}]`;
    if (!object(row)) { emit(at); continue; }
    leaf(row, 'date', v => typeof v === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}(?![\s\S])/.test(v), emit, `${at}.`, true);
    if (!own(row, 'by_tier') || !Array.isArray(row.by_tier)) emit(`${at}.by_tier`);
    else for (const [j, tier] of row.by_tier.entries()) {
      const tat = `${at}.by_tier[${j}]`;
      if (!object(tier)) { emit(tat); continue; }
      leaf(tier, 'tier', v => integer(v) && v >= 0, emit, `${tat}.`, true);
      numeric(tier, [['lp', finite], ['gp', finite]], emit, `${tat}.`);
      extras(tier, ['tier', 'lp', 'gp'], emit, `${tat}.`);
    }
    extras(row, ['date', 'by_tier'], emit, `${at}.`);
  }
}

export function checkPayloadAdmission(parsed: ParsedUWFile, issues: ValidationMessage[], componentClasses: ReadonlySet<string>): void {
  for (const [section, code, visit] of [
    ['lease_up_schedule', 'LU-05', leaseUp], ['rent_roll', 'REC-11', recovery],
    ['capital_stack', 'CS-03', sizing], ['distribution_waterfall', 'WF-16', waterfall],
  ] as const) {
    for (const [variant, block] of currentPayloadBlocks(parsed, section)) visit(block.content, emitter(issues, code, section, variant));
    if (code === 'CS-03' && parsed.frontmatter.asset_class === 'mixed_use') for (const [variant, block] of currentPayloadBlocks(parsed, 'components')) {
      for (const key of Object.keys(block.content).filter(k => componentClasses.has(k)).sort(compare)) {
        const component = block.content[key];
        if (!object(component) || value(component, 'component_class') !== key || !own(component, 'capital_stack') || !object(component.capital_stack)) continue;
        sizing(component.capital_stack, emitter(issues, code, 'components', variant), `${key}.capital_stack.`);
      }
    }
  }
}
