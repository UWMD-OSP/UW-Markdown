// The validator page's checks, kept free of React so they test in Node. Every
// result comes from the standard's reference implementation running in the
// browser; the record is never sent anywhere.
import {
  parseUWFile,
  validateUWFile,
  verifyReplacementFundingBindings,
  verifyStatedMetrics,
  type ParsedUWFile,
  type StatedMetricsReport,
  type ValidationResult,
} from '@uwmd/core/browser';

/** The largest record the page reads, in characters. */
export const MAX_SOURCE_CHARS = 5_000_000;

export type CheckResult =
  | { kind: 'refused'; code: string; message: string }
  | {
      kind: 'checked';
      asset_class: string;
      deal_name: string | null;
      validation: ValidationResult;
      metrics: StatedMetricsReport;
      funding: { state: string; reason?: string };
      /** Nothing failed: no validation error, no failed stated metric, funding verified or not applicable. */
      ok: boolean;
    };

export async function runChecks(source: string): Promise<CheckResult> {
  if (source.trim() === '') return { kind: 'refused', code: 'EMPTY', message: 'Paste or drop a .uwx.md record first.' };
  if (source.length > MAX_SOURCE_CHARS) return { kind: 'refused', code: 'TOO-LARGE', message: 'The record is larger than this page reads (5 MB).' };
  let parsed: ParsedUWFile;
  try {
    parsed = parseUWFile(source);
  } catch (error) {
    const e = error as { code?: string; message?: string };
    return { kind: 'refused', code: e.code ?? 'PARSE', message: e.message ?? 'The record could not be parsed.' };
  }
  const validation = validateUWFile(source);
  const metrics = verifyStatedMetrics(parsed);
  const binding = await verifyReplacementFundingBindings(parsed);
  const reason = 'reason' in binding ? String(binding.reason) : undefined;
  const fundingOk = binding.state === 'verified' || (binding.state === 'not_checked' && reason === 'not_applicable');
  const name = parsed.frontmatter.deal_name;
  return {
    kind: 'checked',
    asset_class: String(parsed.frontmatter.asset_class ?? ''),
    deal_name: typeof name === 'string' ? name : null,
    validation,
    metrics,
    funding: { state: binding.state, ...(reason !== undefined ? { reason } : {}) },
    ok: validation.errors.length === 0 && metrics.counts.failed === 0 && fundingOk,
  };
}
