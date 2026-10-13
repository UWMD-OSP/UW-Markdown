// RFC 0044: a candidate projection of verified stated amounts, with explicit timing.
import type { ParsedUWFile, UWBlock, ValidationMessage } from './types.js';
import type {
  LeaseUpCashFlowPlan,
  LeaseUpCashFlowProjection,
  LeaseUpCashFlowProjectionIssue,
} from './protocol.js';
import { CalcError } from './calc/errors.js';
import { isDayCountConvention, parseISODate } from './calc/day-count.js';
import { periodSection, periodPayload } from './period-path.js';
import { checkLeaseUpContent } from './lease-up-structure.js';
import { verifyLeaseUpSchedule, leaseUpContext, type LeaseUpSchedule } from './lease-up.js';
import { toUWEnvelope, computeEnvelopeDigest } from './envelope.js';

export class LeaseUpCashFlowProjectionError extends CalcError {
  override readonly proto: LeaseUpCashFlowProjectionIssue;
  constructor(
    message: string,
    pointer: string,
    evidence?: LeaseUpCashFlowProjectionIssue['evidence']
  ) {
    super('CALC-LU-PROJECTION', message, pointer);
    this.name = 'LeaseUpCashFlowProjectionError';
    this.proto = {
      category: 'calc',
      code: 'CALC-LU-PROJECTION',
      message,
      pointer,
      ...(evidence ? { evidence } : {}),
    };
  }
}

function refuse(
  message: string,
  pointer: string,
  evidence?: LeaseUpCashFlowProjectionIssue['evidence']
): never {
  throw new LeaseUpCashFlowProjectionError(message, pointer, evidence);
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function onlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

/** Copies exact binary64 amounts; creates no edits or provenance. Rejects with typed evidence. */
export async function projectLeaseUpCashFlows(
  parsed: ParsedUWFile,
  plan: LeaseUpCashFlowPlan
): Promise<LeaseUpCashFlowProjection> {
  if (!record(plan) || !onlyKeys(plan, ['source_variant', 'day_count', 'cash_dates'])) {
    refuse(
      'Expected a projection plan with source_variant, day_count and cash_dates only.',
      'plan'
    );
  }
  if (typeof plan.source_variant !== 'string' || plan.source_variant.length === 0) {
    refuse('An exact source_variant is required.', 'plan.source_variant');
  }
  if (!isDayCountConvention(plan.day_count))
    refuse('An explicit registered day_count is required.', 'plan.day_count');
  if (!Array.isArray(plan.cash_dates) || plan.cash_dates.length === 0)
    refuse('cash_dates must be a non-empty array.', 'plan.cash_dates');
  const sourceVariant = plan.source_variant;
  const dayCount = plan.day_count;
  const source = `sections.lease_up_schedule[${JSON.stringify(sourceVariant)}]`;
  let block: UWBlock | null;
  try {
    block = periodSection(parsed, 'lease_up_schedule', {
      sectionVariants: { lease_up_schedule: sourceVariant },
    });
  } catch (error) {
    if (error instanceof CalcError)
      refuse('Cannot select the exact lease-up source variant.', source, {
        selection: error.proto,
      });
    throw error;
  }
  if (!block) refuse('The lease-up source section is missing.', source);
  const payload = periodPayload(block);
  if (!record(payload)) refuse('The selected lease-up payload must be an object.', source);
  const issues: ValidationMessage[] = [];
  checkLeaseUpContent(payload, sourceVariant, issues);
  if (issues.length)
    refuse('The selected lease-up schedule is structurally invalid.', source, {
      structure: issues,
    });
  if (
    payload['model_type'] !== 'natural_turnover' &&
    payload['model_type'] !== 'absorption_curve'
  ) {
    refuse('The selected schedule requires a registered model_type.', `${source}.model_type`);
  }
  // Malformed summaries must not disappear behind the verifier's optional checks.
  const summary = payload['stabilized_summary'];
  if (summary !== undefined && summary !== null) {
    if (!record(summary))
      refuse('stabilized_summary must be an object or null.', `${source}.stabilized_summary`);
    for (const key of ['occupied_sf', 'occupancy_rate', 'annualized_egi', 'annualized_noi']) {
      const value = summary[key];
      if (
        value !== undefined &&
        value !== null &&
        (typeof value !== 'number' || !Number.isFinite(value))
      ) {
        refuse(
          'Stated summary values must be finite numbers or null.',
          `${source}.stabilized_summary.${key}`
        );
      }
    }
  }
  const schedule = payload as unknown as LeaseUpSchedule;
  for (const [i, row] of schedule.schedule.entries()) {
    if (typeof row.net_cash_flow !== 'number' || !Number.isFinite(row.net_cash_flow)) {
      refuse(
        'Every source period must state a finite net_cash_flow; missing amounts are not zero.',
        `${source}.schedule[${i}].net_cash_flow`
      );
    }
  }
  const verification = verifyLeaseUpSchedule(schedule, leaseUpContext(parsed));
  if (verification.verdict !== 'verified') {
    refuse(`The selected lease-up schedule is ${verification.verdict}.`, source, { verification });
  }
  const periods = new Set(schedule.schedule.map((row) => row.period));
  const dates = new Map<string, { date: string; index: number }>();
  for (const [i, mapping] of plan.cash_dates.entries()) {
    const pointer = `plan.cash_dates[${i}]`;
    if (
      !record(mapping) ||
      !onlyKeys(mapping, ['period', 'date']) ||
      typeof mapping.period !== 'string'
    ) {
      refuse('Each cash date requires exactly period and date.', pointer);
    }
    if (!periods.has(mapping.period))
      refuse('Cash date maps an unknown source period.', `${pointer}.period`);
    if (dates.has(mapping.period))
      refuse('A source period may be mapped only once.', `${pointer}.period`);
    if (typeof mapping.date !== 'string' || !parseISODate(mapping.date))
      refuse('Cash date must be a real YYYY-MM-DD date.', `${pointer}.date`);
    dates.set(mapping.period, { date: mapping.date, index: i });
  }
  let previous: string | undefined;
  const bindings = schedule.schedule.map((row) => {
    const mapping = dates.get(row.period);
    if (!mapping) refuse(`Missing cash date for source period ${row.period}.`, 'plan.cash_dates');
    if (previous !== undefined && mapping.date < previous)
      refuse(
        'Cash dates must be non-decreasing in source period order.',
        `plan.cash_dates[${mapping.index}].date`
      );
    previous = mapping.date;
    return {
      source_path: `lease_up_schedule.schedule@${row.period}.net_cash_flow`,
      date: mapping.date,
      amount: row.net_cash_flow as number,
    };
  });
  const series = {
    label: 'Lease-up receipts and TI/LC only',
    day_count: dayCount,
    series: bindings.map((binding) => ({
      date: binding.date,
      amount: binding.amount,
      kind: 'other' as const,
      label: binding.source_path,
    })),
  };
  // Canonicalization starts synchronously before the first await. The digest and
  // copied bindings therefore describe the same input snapshot.
  const source_envelope_digest = await computeEnvelopeDigest(toUWEnvelope(parsed));
  return { source_envelope_digest, source_variant: sourceVariant, series, bindings };
}
