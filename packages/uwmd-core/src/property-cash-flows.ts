// RFC 0045 / Protocol VIII.9.6: assemble stated cash rows, never infer economics.
import type { ParsedUWFile, UWBlock } from './types.js';
import type {
  PropertyCashFlowPlan, PropertyCashFlowAssembly, PropertyCashFlowAssemblyIssue,
  PropertyCashFlowCell, PropertyCashFlowCategory, PropertyCashFlowCoverage,
  PropertyCashFlowBinding, PropertyCashFlowCellEvidence,
} from './protocol.js';
import { CalcError } from './calc/errors.js';
import { isDayCountConvention, parseISODate } from './calc/day-count.js';
import { periodSection, periodPayload } from './period-path.js';
import { projectLeaseUpCashFlows, LeaseUpCashFlowProjectionError } from './lease-up-cash-flows.js';
import { CASH_FLOW_KINDS, verifyCashFlowSeries, type CashFlowSeries } from './cash-flow-series.js';

type Reason = PropertyCashFlowAssemblyIssue['reason'];
type Evidence = PropertyCashFlowAssemblyIssue['evidence'];
type Obj = Record<string, unknown>;
const own = (v: object, key: string) => Object.prototype.hasOwnProperty.call(v, key);
const isObj = (v: unknown): v is Obj => v !== null && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

export class PropertyCashFlowAssemblyError extends CalcError {
  override readonly proto: PropertyCashFlowAssemblyIssue;
  constructor(reason: Reason, message: string, pointer: string, evidence?: Evidence) {
    super('CALC-CF-ASSEMBLY', message, pointer);
    this.name = 'PropertyCashFlowAssemblyError';
    this.proto = { category: 'calc', code: 'CALC-CF-ASSEMBLY', reason, message, pointer,
      ...(evidence ? { evidence } : {}) };
  }
}
function refuse(reason: Reason, message: string, pointer: string, evidence?: Evidence): never {
  throw new PropertyCashFlowAssemblyError(reason, message, pointer, evidence);
}
function shape(v: unknown, keys: string[], pointer: string): asserts v is Obj {
  if (!isObj(v) || Object.keys(v).length !== keys.length || keys.some(k => !own(v, k)))
    refuse('plan', `Expected exactly: ${keys.join(', ')}.`, pointer);
}
function string(v: unknown, pointer: string): asserts v is string {
  if (!text(v)) refuse('plan', 'Expected a nonempty string.', pointer);
}
const assertionKeys = [
  'cash_amounts_only', 'no_financing_or_investor_tax', 'no_overlapping_economic_amounts',
  'reserve_spending_excluded', 'gross_sale_excludes_reserve_release',
  'no_terminal_restricted_reserve', 'hold_only_and_exit_settled',
];
function validatePlan(value: unknown): asserts value is PropertyCashFlowPlan {
  shape(value, ['basis', 'tax_basis', 'currency_code', 'day_count', 'acquisition_date',
    'disposition_date', 'lease_up', 'supplemental', 'assertions', 'coverage'], 'plan');
  for (const k of ['basis', 'tax_basis', 'currency_code', 'day_count', 'acquisition_date', 'disposition_date'])
    string(value[k], `plan.${k}`);
  shape(value.lease_up, ['source_variant', 'currency_code', 'cash_dates'], 'plan.lease_up');
  shape(value.supplemental, ['source_variant', 'currency_code'], 'plan.supplemental');
  for (const k of ['lease_up', 'supplemental'] as const) {
    string((value[k] as Obj).source_variant, `plan.${k}.source_variant`);
    string((value[k] as Obj).currency_code, `plan.${k}.currency_code`);
  }
  if (!Array.isArray(value.lease_up.cash_dates) || value.lease_up.cash_dates.length === 0)
    refuse('plan', 'Expected a nonempty cash date map.', 'plan.lease_up.cash_dates');
  Array.from(value.lease_up.cash_dates).forEach((row, i) => {
    const p = `plan.lease_up.cash_dates[${i}]`;
    shape(row, ['period', 'date'], p);
    string(row.period, `${p}.period`); string(row.date, `${p}.date`);
  });
  shape(value.assertions, assertionKeys, 'plan.assertions');
  if (!Array.isArray(value.coverage) || value.coverage.length === 0)
    refuse('plan', 'Expected nonempty coverage declarations.', 'plan.coverage');
  Array.from(value.coverage).forEach((row, i) => {
    const p = `plan.coverage[${i}]`;
    shape(row, ['slot', 'category', isObj(row) && own(row, 'rows') ? 'rows' : 'zero'], p);
    string(row.slot, `${p}.slot`); string(row.category, `${p}.category`);
    if (own(row, 'rows')) {
      if (!Array.isArray(row.rows) || row.rows.length === 0 ||
        Array.from(row.rows).some(v => !Number.isSafeInteger(v) || (v as number) < 0))
        refuse('plan', 'rows requires nonnegative safe integer indexes.', `${p}.rows`);
    } else if (typeof row.zero !== 'string' || row.zero.trim().length === 0) {
      refuse('plan', 'A zero declaration requires a nonblank explanation.', `${p}.zero`);
    }
  });
  if (value.basis !== 'unlevered' || value.tax_basis !== 'pre_tax')
    refuse('basis_currency', 'Only unlevered pre-tax assembly is supported.', 'plan');
  if (!isDayCountConvention(value.day_count))
    refuse('basis_currency', 'An explicit registered day count is required.', 'plan.day_count');
  if (!/^[A-Z]{3}$/.test(value.currency_code as string))
    refuse('basis_currency', 'Declare one uppercase three-letter currency identity.', 'plan.currency_code');
  for (const k of ['lease_up', 'supplemental'] as const) {
    if ((value[k] as Obj).currency_code !== value.currency_code)
      refuse('basis_currency', 'Source currency must equal the plan currency.', `plan.${k}.currency_code`);
  }
  for (const k of assertionKeys) {
    if (value.assertions[k] !== true)
      refuse('coverage', 'An explicit true economic assertion is required.', `plan.assertions.${k}`);
  }
}
const pointer = (section: string, variant: string) => `sections.${section}[${JSON.stringify(variant)}]`;
function select(parsed: ParsedUWFile, section: string, variant: string): UWBlock {
  const p = pointer(section, variant);
  try {
    const block = periodSection(parsed, section, { sectionVariants: { [section]: variant } });
    if (!block) refuse('selection', 'Exact source variant is missing.', p);
    return block;
  } catch (e) {
    if (e instanceof PropertyCashFlowAssemblyError) throw e;
    if (e instanceof CalcError) refuse('selection', 'Cannot select the exact source variant.', p, { selection: e.proto });
    throw e;
  }
}
function structure(message: string, p: string, field: string, code = 'CF-01'): never {
  refuse('structure', message, `${p}.${field}`, { structure: [
    { code, severity: 'error', section: 'cash_flow_series', field, message },
  ] });
}
// This boundary checks the selected payload, without validating unrelated deal sections.
function validateSupplemental(value: unknown, p: string, dayCount: string): asserts value is CashFlowSeries {
  if (!isObj(value)) refuse('structure', 'Expected cash_flow_series content.', p);
  if (!isDayCountConvention(value.day_count)) structure('An explicit registered day count is required.', p, 'day_count');
  if (value.day_count !== dayCount) refuse('basis_currency', 'Source and plan day counts must agree.', `${p}.day_count`);
  if (!Array.isArray(value.series) || value.series.length === 0)
    structure('A nonempty dated series is required.', p, 'series', 'CF-02');
  let prev: string | undefined;
  let negative = false;
  let positive = false;
  for (const [i, row] of value.series.entries()) {
    const field = `series[${i}]`;
    if (!isObj(row)) structure('A cash row must be an object.', p, field);
    if (typeof row.date !== 'string' || !parseISODate(row.date))
      structure('Expected a real YYYY-MM-DD cash date.', p, `${field}.date`);
    if (prev !== undefined && row.date < prev)
      structure('Cash dates must be nondecreasing.', p, `${field}.date`, 'CF-02');
    prev = row.date;
    if (!finite(row.amount)) structure('Cash amounts must be finite numbers.', p, `${field}.amount`);
    negative ||= row.amount < 0; positive ||= row.amount > 0;
    if (row.kind != null && !(CASH_FLOW_KINDS as readonly unknown[]).includes(row.kind))
      structure('Unknown cash-flow kind.', p, `${field}.kind`);
    if (row.label != null && typeof row.label !== 'string') structure('Label must be text or null.', p, `${field}.label`);
  }
  const metrics = value.stated_metrics;
  if (metrics != null) {
    if (!isObj(metrics)) structure('stated_metrics must be an object or null.', p, 'stated_metrics');
    for (const k of ['total_net', 'moic', 'xirr']) {
      if (metrics[k] != null && !finite(metrics[k])) structure('A stated metric must be finite or null.', p, `stated_metrics.${k}`);
    }
    if (metrics.xnpv != null && (!isObj(metrics.xnpv) || !finite(metrics.xnpv.rate) || !finite(metrics.xnpv.value)))
      structure('xnpv requires finite rate and value.', p, 'stated_metrics.xnpv');
    if (metrics.xirr != null && !(negative && positive))
      structure('A stated xirr requires positive and negative amounts.', p, 'stated_metrics.xirr', 'CF-03');
  }
}
const leaseCategories: PropertyCashFlowCategory[] = ['rent', 'concessions', 'ti_lc'];
const periodCategories: PropertyCashFlowCategory[] = ['other_income', 'operating_expenses', 'other_capex', 'reserve_net'];
const key = (cell: PropertyCashFlowCell) => `${cell.slot}/${cell.category}`;
const cell = (slot: string, category: PropertyCashFlowCategory): PropertyCashFlowCell => ({ slot, category });
function dateInPeriod(date: string, period: string): boolean {
  if (/^\d{4}-\d{2}$/.test(period)) return date.slice(0, 7) === period;
  return date.slice(0, 4) === period.slice(0, 4) &&
    Math.floor((Number(date.slice(5, 7)) - 1) / 3) + 1 === Number(period.slice(-1));
}

/** Assemble a complete declared ledger. No monetary arithmetic or document writes. */
export async function assemblePropertyCashFlows(
  parsed: ParsedUWFile, input: PropertyCashFlowPlan,
): Promise<PropertyCashFlowAssembly> {
  validatePlan(input);
  const plan = structuredClone(input);
  const snapshot = structuredClone(parsed);
  const leaseBlock = select(snapshot, 'lease_up_schedule', plan.lease_up.source_variant);
  const sourceBlock = select(snapshot, 'cash_flow_series', plan.supplemental.source_variant);
  const source = periodPayload(sourceBlock);
  const sourcePointer = pointer('cash_flow_series', plan.supplemental.source_variant);
  validateSupplemental(source, sourcePointer, plan.day_count);
  let projection: Awaited<ReturnType<typeof projectLeaseUpCashFlows>>;
  try {
    projection = await projectLeaseUpCashFlows(snapshot, {
      source_variant: plan.lease_up.source_variant, day_count: plan.day_count,
      cash_dates: plan.lease_up.cash_dates,
    });
  } catch (e) {
    if (e instanceof LeaseUpCashFlowProjectionError)
      refuse('verification', 'Lease-up projection refused.', pointer('lease_up_schedule', plan.lease_up.source_variant), { lease_up: e.proto });
    if (e instanceof Error && e.message.startsWith('canonicalize:'))
      refuse('structure', 'The source envelope contains a value that cannot be canonicalized.', 'sections');
    throw e;
  }
  const verification = verifyCashFlowSeries(source);
  if (verification.verdict !== 'verified')
    refuse('verification', `Supplemental metrics are ${verification.verdict}.`, sourcePointer, { verification });
  const hasMetrics = ['total_net', 'moic', 'xirr', 'xnpv'].some(k =>
    source.stated_metrics != null && (source.stated_metrics as unknown as Obj)[k] != null);
  const periods = (periodPayload(leaseBlock) as { schedule: Array<{ period: string }> }).schedule.map(row => row.period);
  if (!parseISODate(plan.acquisition_date) || !parseISODate(plan.disposition_date) ||
      plan.acquisition_date >= plan.disposition_date ||
      !dateInPeriod(plan.acquisition_date, periods[0]!) ||
      !dateInPeriod(plan.disposition_date, periods[periods.length - 1]!))
    refuse('date_horizon', 'Acquisition and disposition must bound the full source hold.', 'plan');
  for (const [i, row] of projection.bindings.entries()) {
    if (row.date < plan.acquisition_date || row.date > plan.disposition_date)
      refuse('date_horizon', 'Lease-up cash date lies outside the hold.', `${pointer('lease_up_schedule', plan.lease_up.source_variant)}.schedule[${i}]`);
  }
  for (const [i, row] of source.series.entries()) {
    if (row.date < plan.acquisition_date || row.date > plan.disposition_date)
      refuse('date_horizon', 'Supplemental cash date lies outside the hold.', `${sourcePointer}.series[${i}].date`);
  }
  const required = [
    ...(['purchase_price', 'transaction_costs', 'reserve_net'] as const).map(c => cell('acquisition', c)),
    ...periods.flatMap(p => periodCategories.map(c => cell(p, c))),
    ...(['gross_sale', 'transaction_costs', 'reserve_net'] as const).map(c => cell('disposition', c)),
  ];
  const requiredKeys = new Set(required.map(key));
  const declarations = new Map<string, { item: PropertyCashFlowCoverage; index: number }>();
  const rowCells = new Map<number, PropertyCashFlowCell>();
  for (const [i, entry] of plan.coverage.entries()) {
    const p = `plan.coverage[${i}]`;
    if (!requiredKeys.has(key(entry))) refuse('coverage', 'Unknown or lease-up-owned coverage cell.', p);
    if (declarations.has(key(entry))) refuse('coverage', 'Duplicate coverage cell.', p);
    declarations.set(key(entry), { item: entry, index: i });
    if (entry.rows) for (const index of entry.rows) {
      if (index >= source.series.length || rowCells.has(index))
        refuse('coverage', 'Cash row is missing or already assigned.', `${p}.rows`);
      rowCells.set(index, cell(entry.slot, entry.category));
    }
  }
  for (const c of required) if (!declarations.has(key(c)))
    refuse('coverage', `Missing coverage for ${key(c)}.`, 'plan.coverage');
  for (let i = 0; i < source.series.length; i++) if (!rowCells.has(i))
    refuse('coverage', 'Every supplemental row must be covered.', `${sourcePointer}.series[${i}]`);
  for (const c of required) {
    const { item, index } = declarations.get(key(c))!;
    if (c.category === 'purchase_price' && !item.rows)
      refuse('coverage', 'Acquisition requires a real negative purchase payment.', `plan.coverage[${index}]`);
    for (const rowIndex of item.rows ?? []) {
      const row = source.series[rowIndex]!;
      if ((c.slot === 'acquisition' && row.date !== plan.acquisition_date) ||
          (c.slot === 'disposition' && row.date !== plan.disposition_date))
        refuse('date_horizon', 'Closing cash date must equal the declared closing date.', `${sourcePointer}.series[${rowIndex}].date`);
    }
  }
  for (const c of required) {
    const item = declarations.get(key(c))!.item;
    for (const rowIndex of item.rows ?? []) {
      const amount = source.series[rowIndex]!.amount;
      const bad = c.category === 'purchase_price' ? amount >= 0 :
        ['gross_sale', 'other_income'].includes(c.category) ? amount < 0 :
        ['transaction_costs', 'operating_expenses', 'other_capex'].includes(c.category) ? amount > 0 : false;
      if (bad) refuse('amount_sign', 'Cash amount has the wrong sign for its declared category.', `${sourcePointer}.series[${rowIndex}].amount`);
    }
  }
  const bindings: PropertyCashFlowBinding[] = projection.bindings.map((b, i) => ({
    ...b, output_row_index: 0, source_section: 'lease_up_schedule',
    source_variant: plan.lease_up.source_variant, cells: leaseCategories.map(c => cell(periods[i]!, c)),
  }));
  for (const [i, row] of source.series.entries()) bindings.push({
    output_row_index: 0, source_section: 'cash_flow_series', source_variant: plan.supplemental.source_variant,
    source_path: `cash_flow_series.series[${i}].amount`, date: row.date, amount: row.amount,
    cells: [rowCells.get(i)!],
  });
  // Stable sort retains lease-up order, then supplemental source index on a tie.
  bindings.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  bindings.forEach((b, i) => { b.output_row_index = i; });
  const allCells = [
    ...required.filter(c => c.slot === 'acquisition'),
    ...periods.flatMap(p => [...leaseCategories, ...periodCategories].map(c => cell(p, c))),
    ...required.filter(c => c.slot === 'disposition'),
  ];
  const cells: PropertyCashFlowCellEvidence[] = allCells.map(c => {
    const declaration = declarations.get(key(c))?.item;
    if (declaration && own(declaration, 'zero')) return { ...c, zero: declaration.zero! };
    return { ...c, output_rows: bindings.filter(b => b.cells.some(v => key(v) === key(c))).map(b => b.output_row_index) };
  });
  return {
    source_envelope_digest: projection.source_envelope_digest, plan,
    coverage: 'declared_complete',
    series: { label: 'Unlevered pre-tax property cash flow', day_count: plan.day_count,
      series: bindings.map(b => ({ date: b.date, amount: b.amount, kind: 'other', label: b.source_path })) },
    bindings, cells,
    source_verification: { lease_up: 'verified', supplemental_metrics: hasMetrics ? 'verified' : 'not_stated' },
  };
}
