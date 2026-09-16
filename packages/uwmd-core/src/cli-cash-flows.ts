// CLI-only boundary over the existing dated-return verifier; no new math.
import { parseUWFile } from './parser.js';
import { periodSection, periodPayload } from './period-path.js';
import { CalcError } from './calc/errors.js';
import { CASH_FLOW_KINDS, datedFlowsOf, verifyCashFlowSeries, type CashFlowSeries } from './cash-flow-series.js';

const section = 'cash_flow_series';
const metrics = ['total_net', 'moic', 'xnpv', 'xirr'] as const;
const obj = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
function refuse(message: string, pointer = section): never {
  throw new CalcError('CALC-CF-SERIES', message, pointer);
}

export function parseCashFlowVerificationArgs(args: string[]) {
  let file: string | undefined;
  let variant: string | undefined;
  let json = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--json') {
      if (json) refuse('Duplicate --json option.', 'arguments');
      json = true;
    } else if (arg === '--variant' || arg.startsWith('--variant=')) {
      if (variant !== undefined) refuse('Duplicate --variant option.', 'arguments');
      variant = arg === '--variant' ? args[++i] : arg.slice('--variant='.length);
      if (!variant || variant.startsWith('--') || !variant.trim())
        refuse('--variant requires a nonblank name.', 'arguments');
    } else if (arg.startsWith('-')) {
      refuse(`Unsupported option: ${arg}.`, 'arguments');
    } else {
      if (file !== undefined) refuse('Expected exactly one source file.', 'arguments');
      file = arg;
    }
  }
  if (!file) refuse('A source file is required.', 'arguments');
  return { file, variant, json };
}

export function verifyCashFlowDocument(source: string, variant?: string) {
  let parsed: ReturnType<typeof parseUWFile>;
  try { parsed = parseUWFile(source, { strict: true }); }
  catch (error) { refuse(`Cannot parse source: ${error instanceof Error ? error.message : String(error)}`, 'source'); }
  const block = periodSection(parsed, section,
    variant === undefined ? {} : { sectionVariants: { [section]: variant } });
  if (!block) refuse('No active cash_flow_series block was found.');
  const content = periodPayload(block);
  if (!obj(content)) refuse('Expected an object payload.');
  const series = content as unknown as CashFlowSeries;
  if (datedFlowsOf(series) === null)
    refuse('Expected nonempty, ordered, finite dated cash rows and a registered day count.', `${section}.series`);
  // Calendar order must also hold when a day-count convention collapses dates.
  for (const [i, row] of series.series.entries()) {
    if (i > 0 && row.date < series.series[i - 1]!.date)
      refuse('Cash dates must be nondecreasing.', `${section}.series[${i}].date`);
    if (row.kind != null && !(CASH_FLOW_KINDS as readonly unknown[]).includes(row.kind))
      refuse('Unknown cash-flow kind.', `${section}.series[${i}].kind`);
    if (row.label != null && typeof row.label !== 'string')
      refuse('Cash-flow label must be text or null.', `${section}.series[${i}].label`);
  }
  const stated = content.stated_metrics;
  if (stated != null && !obj(stated)) refuse('Expected a stated_metrics object or null.', `${section}.stated_metrics`);
  const checked = metrics.filter(metric => obj(stated) && stated[metric] != null);
  for (const metric of checked) {
    const value = (stated as Record<string, unknown>)[metric];
    const p = `${section}.stated_metrics.${metric}`;
    if (metric === 'xnpv') {
      if (!obj(value)) refuse('Expected an xnpv claim object.', p);
      for (const key of ['rate', 'value']) {
        if (value[key] != null && !finite(value[key])) refuse('Claim must be a finite number.', `${p}.${key}`);
      }
    } else if (!finite(value)) refuse('Claim must be a finite number.', p);
  }
  const verification = checked.length ? verifyCashFlowSeries(series) : null;
  const status = verification?.verdict ?? 'no_stated_metrics';
  return {
    exitCode: status === 'verified' ? 0 : status === 'failed' ? 1 : 3,
    report: { section, variant: block.annotation.variant ?? null, status,
      checked_metrics: checked, verification },
  };
}
