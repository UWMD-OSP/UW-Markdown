// Shared RFC 0008 structural checks. Keep validator and projection diagnostics identical.
import type { ValidationMessage } from './types.js';
import { leaseUpPeriodOrdinal, type LeaseUpGranularity } from './lease-up.js';

export function checkLeaseUpContent(
  content: Record<string, unknown>,
  variant: string,
  issues: ValidationMessage[]
): void {
  const section = 'lease_up_schedule';
  const label = variant === 'default' ? '' : ` (variant "${variant}")`;
  const granRaw = content['period_granularity'];
  const granularity: LeaseUpGranularity =
    granRaw === 'monthly' || granRaw === 'quarterly' ? granRaw : 'quarterly';
  if (granRaw !== 'monthly' && granRaw !== 'quarterly') {
    issues.push({
      code: 'LU-01',
      severity: 'error',
      section,
      field: 'period_granularity',
      message: `LU-01: period_granularity${label} must be "monthly" or "quarterly", not ${JSON.stringify(granRaw)}`,
    });
  }

  const schedule = content['schedule'];
  const rows = Array.isArray(schedule) ? schedule : [];
  if (!Array.isArray(schedule) || rows.length === 0) {
    issues.push({
      code: 'LU-03',
      severity: 'error',
      section,
      field: 'schedule',
      message: `LU-03: schedule${label} must be a non-empty array of periods`,
    });
    return;
  }

  // LU-01 (grammar) / LU-02 (strictly increasing, gap-free). One diagnostic
  // per defect: a row outside the grammar is not also reported as a gap.
  let prev: number | null = null;
  let grammarBroken = false;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const period =
      row && typeof row === 'object' ? (row as Record<string, unknown>)['period'] : undefined;
    const ordinal = typeof period === 'string' ? leaseUpPeriodOrdinal(period, granularity) : null;
    if (ordinal === null) {
      grammarBroken = true;
      issues.push({
        code: 'LU-01',
        severity: 'error',
        section,
        field: `schedule[${i}].period`,
        message: `LU-01: period ${JSON.stringify(period)}${label} is outside the ${granularity} grammar (${granularity === 'quarterly' ? 'YYYY-Qn' : 'YYYY-MM'})`,
      });
      prev = null;
      continue;
    }
    if (prev !== null && ordinal !== prev + 1) {
      issues.push({
        code: 'LU-02',
        severity: 'error',
        section,
        field: `schedule[${i}].period`,
        message: `LU-02: periods${label} must be strictly increasing and gap-free; ${String(period)} does not immediately follow the prior period`,
      });
    }
    prev = ordinal;
  }

  // LU-03 (second arm): a stabilization_target earlier than the first period.
  const target = content['stabilization_target'];
  if (!grammarBroken && typeof target === 'string') {
    const first = (rows[0] as Record<string, unknown>)['period'];
    const targetOrd = leaseUpPeriodOrdinal(target, granularity);
    const firstOrd = typeof first === 'string' ? leaseUpPeriodOrdinal(first, granularity) : null;
    if (targetOrd !== null && firstOrd !== null && targetOrd < firstOrd) {
      issues.push({
        code: 'LU-03',
        severity: 'error',
        section,
        field: 'stabilization_target',
        message: `LU-03: stabilization_target ${target}${label} is earlier than the first schedule period ${String(first)}`,
      });
    }
  }
}
