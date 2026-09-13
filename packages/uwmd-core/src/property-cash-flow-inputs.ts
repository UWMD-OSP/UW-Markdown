// RFC 0047: read-only inventory for the RFC 0045 property cash-flow handoff.
// This module reports source shape and required plan dimensions. It never
// assigns economics, dates, categories, zeros, or assertions.

import { periodPayload } from './period-path.js';
import type { CashFlowKind } from './cash-flow-series.js';
import type { ParsedUWFile, UWBlock } from './types.js';

export interface PropertyCashFlowInputRow {
  index: number;
  date: string | null;
  amount: number | null;
  kind?: CashFlowKind | null;
  label?: string | null;
}

export interface PropertyCashFlowInputVariant {
  /** The authored variant; null means the source block is unlabelled. */
  variant: string | null;
  role: string | null;
  shape: 'usable' | 'malformed';
  periods: string[];
  rows: PropertyCashFlowInputRow[];
  stated_metrics: string[];
  /** Coverage cells required once this schedule is selected. */
  required_coverage_cells: string[];
}

export interface PropertyCashFlowInputInventory {
  currency_code: string | null;
  lease_up_schedule: PropertyCashFlowInputVariant[];
  cash_flow_series: PropertyCashFlowInputVariant[];
  required_plan_fields: string[];
  notes: string[];
}

const own = (value: object, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);
const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function isBlock(value: unknown): value is UWBlock {
  return isObject(value) && own(value, 'annotation') && own(value, 'content');
}

function blocks(parsed: ParsedUWFile, section: string): UWBlock[] {
  const entry = parsed.sections[section];
  if (!entry) return [];
  if (isBlock(entry)) return [entry];
  if (!isObject(entry)) return [];
  return Object.values(entry).filter(isBlock);
}

function row(value: unknown, index: number): PropertyCashFlowInputRow {
  if (!isObject(value)) return { index, date: null, amount: null };
  return {
    index,
    date: typeof value.date === 'string' ? value.date : null,
    amount: typeof value.amount === 'number' && Number.isFinite(value.amount) ? value.amount : null,
    ...(value.kind === null || typeof value.kind === 'string' ? { kind: value.kind as CashFlowKind | null } : {}),
    ...(value.label === null || typeof value.label === 'string' ? { label: value.label } : {}),
  };
}

function coverageCells(periods: string[]): string[] {
  return [
    'acquisition/purchase_price',
    'acquisition/transaction_costs',
    'acquisition/reserve_net',
    ...periods.flatMap(period => [
      `${period}/other_income`,
      `${period}/operating_expenses`,
      `${period}/other_capex`,
      `${period}/reserve_net`,
    ]),
    'disposition/gross_sale',
    'disposition/transaction_costs',
    'disposition/reserve_net',
  ];
}

function inspect(section: 'lease_up_schedule' | 'cash_flow_series', block: UWBlock): PropertyCashFlowInputVariant {
  const payload = periodPayload(block);
  const variant = block.annotation.variant ?? null;
  const role = typeof block.content._role === 'string' ? block.content._role : null;
  if (!isObject(payload)) {
    return { variant, role, shape: 'malformed', periods: [], rows: [], stated_metrics: [], required_coverage_cells: [] };
  }

  if (section === 'lease_up_schedule') {
    const schedule = Array.isArray(payload.schedule) ? payload.schedule : [];
    const periods = schedule.flatMap(entry => isObject(entry) && typeof entry.period === 'string' ? [entry.period] : []);
    const usable = schedule.length > 0 && periods.length === schedule.length;
    return {
      variant, role, shape: usable ? 'usable' : 'malformed', periods, rows: [], stated_metrics: [],
      required_coverage_cells: usable ? coverageCells(periods) : [],
    };
  }

  const series = Array.isArray(payload.series) ? payload.series : [];
  const rows = series.map((entry, index) => row(entry, index));
  const statedMetrics = isObject(payload.stated_metrics) ? payload.stated_metrics : null;
  const metrics = statedMetrics
    ? ['total_net', 'moic', 'xnpv', 'xirr'].filter(key => statedMetrics[key] !== null && statedMetrics[key] !== undefined)
    : [];
  const usable = series.length > 0 && rows.every(entry => entry.date !== null && entry.amount !== null);
  return { variant, role, shape: usable ? 'usable' : 'malformed', periods: [], rows, stated_metrics: metrics, required_coverage_cells: [] };
}

/**
 * Inventory the exact source material needed to author an RFC 0045 plan.
 * The result is advisory: it does not verify metrics, infer payment timing,
 * classify rows, or assert that a source is economically complete.
 */
export function inspectPropertyCashFlowInputs(parsed: ParsedUWFile): PropertyCashFlowInputInventory {
  return {
    currency_code: typeof parsed.frontmatter.currency_code === 'string' ? parsed.frontmatter.currency_code : null,
    lease_up_schedule: blocks(parsed, 'lease_up_schedule').map(block => inspect('lease_up_schedule', block)),
    cash_flow_series: blocks(parsed, 'cash_flow_series').map(block => inspect('cash_flow_series', block)),
    required_plan_fields: [
      'basis', 'tax_basis', 'currency_code', 'day_count', 'acquisition_date',
      'disposition_date', 'lease_up.source_variant', 'lease_up.cash_dates',
      'supplemental.source_variant', 'supplemental.currency_code', 'assertions', 'coverage',
    ],
    notes: [
      'Select one exact lease_up_schedule variant and one exact cash_flow_series variant.',
      'Provide every lease-up period cash date explicitly; no month-end or period-number date is inferred.',
      'Assign every supplemental row to one coverage cell, or author an explicit zero explanation for an empty cell.',
      'The inventory does not establish metric verification, economic completeness, reserve treatment, or payment timing.',
    ],
  };
}
