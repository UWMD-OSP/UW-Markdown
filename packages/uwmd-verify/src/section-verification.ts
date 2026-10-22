// Document-level section verifiers for the portable Verifier subcommands
// (RFC 0115, Protocol §II.6a.1).
//
// `verifyCapitalStack`, `verifyLeaseUpSchedule` and `verifyWaterfall` take a
// bare section payload. A Verifier applies them to the figures a document
// states (§II.2 item 3), so each subcommand reads its section from a parsed
// document first. Selection follows Protocol §VIII.2 (RFC 0066): an explicit
// variant, else RFC 0040's primary/default/base/sole order, else a typed
// refusal. An absent section is `not_applicable`, never a synthetic payload.
// The verdict is the section verifier's own, unchanged. No new arithmetic;
// browser-safe; performs no I/O.

import { verifyCapitalStack, capitalStackContext, type CapitalStack } from './capital-stack.js';
import { verifyLeaseUpSchedule, leaseUpContext, type LeaseUpSchedule } from './lease-up.js';
import { verifyWaterfall, type DistributionWaterfall } from './waterfall.js';
import type { CashFlowSeries } from './cash-flow-series.js';
import { blockPayload } from './parser.js';
import { resolveSectionBlock } from './section-resolution.js';
import type {
  CapitalStackVerificationReport,
  LeaseUpVerificationReport,
  SectionVerificationReport,
  WaterfallVerificationReport,
} from './protocol.js';
import type { ParsedUWFile, UWBlock } from './types.js';

/** Options for the document-level section verifiers. */
export interface SectionVerificationOptions {
  /** Verify this exact variant (no fallback); otherwise §VIII.2 selection. */
  variant?: string;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * The one block a section verifier checks, or null for an absent section.
 * An ambiguous section, or a named variant the document does not carry,
 * refuses with `CALC-RESOLVE-002` (§VIII.2) rather than choosing by fence order.
 */
function selectBlock(parsed: ParsedUWFile, section: string, options: SectionVerificationOptions): UWBlock | null {
  return resolveSectionBlock(parsed, section,
    options.variant === undefined ? {} : { sectionVariants: { [section]: options.variant } });
}

function report<S extends string, V extends { verdict: 'verified' | 'failed' | 'unverifiable' }>(
  section: S,
  block: UWBlock | null,
  verify: (payload: Record<string, unknown>) => V,
): SectionVerificationReport<V> & { section: S } {
  if (!block) return { section, variant: null, status: 'not_applicable', verification: null };
  // A structured block body is always one JSON object: the reader refuses any
  // other body (Format §2.4, RFC 0106).
  const verification = verify(blockPayload(block) as Record<string, unknown>);
  return { section, variant: block.annotation.variant ?? null, status: verification.verdict, verification };
}

/** `verify-capital-stack`: the stated sizing of the selected `capital_stack` (Format §4.24). */
export function verifyCapitalStackDocument(
  parsed: ParsedUWFile,
  options: SectionVerificationOptions = {},
): CapitalStackVerificationReport {
  return report('capital_stack', selectBlock(parsed, 'capital_stack', options),
    (payload) => verifyCapitalStack(payload as unknown as CapitalStack, capitalStackContext(parsed)));
}

/** `verify-lease-up`: the stated figures of the selected `lease_up_schedule` (Format §4.25). */
export function verifyLeaseUpDocument(
  parsed: ParsedUWFile,
  options: SectionVerificationOptions = {},
): LeaseUpVerificationReport {
  return report('lease_up_schedule', selectBlock(parsed, 'lease_up_schedule', options),
    (payload) => verifyLeaseUpSchedule(payload as unknown as LeaseUpSchedule, leaseUpContext(parsed)));
}

/**
 * The `cash_flow_series` variant a waterfall's `cash_flow_ref` names, resolved
 * exactly as the validator's WF-02 rule resolves it: the named key of a
 * variant map, or a standalone block only when the reference names `default`.
 * Null when it does not resolve; `verifyWaterfall` then reports the stated
 * figures `unverifiable` (§VIII.10 step 6).
 */
function referencedSeries(parsed: ParsedUWFile, waterfall: Record<string, unknown>): CashFlowSeries | null {
  const ref = waterfall['cash_flow_ref'];
  const variant = isObject(ref) && typeof ref['variant'] === 'string' ? ref['variant'] : null;
  if (variant === null) return null;
  const entry = parsed.sections['cash_flow_series'] as UWBlock | Record<string, UWBlock> | undefined;
  if (!entry) return null;
  const standalone = 'annotation' in entry && isObject((entry as UWBlock).annotation);
  const block = standalone
    ? (variant === 'default' ? (entry as UWBlock) : undefined)
    : Object.hasOwn(entry, variant) ? (entry as Record<string, UWBlock>)[variant] : undefined;
  if (!block) return null;
  const payload = blockPayload(block);
  return isObject(payload) ? (payload as unknown as CashFlowSeries) : null;
}

/** `verify-waterfall`: the stated outcomes and schedule of the selected `distribution_waterfall` (§VIII.10). */
export function verifyWaterfallDocument(
  parsed: ParsedUWFile,
  options: SectionVerificationOptions = {},
): WaterfallVerificationReport {
  return report('distribution_waterfall', selectBlock(parsed, 'distribution_waterfall', options),
    (payload) => verifyWaterfall(payload as unknown as DistributionWaterfall, referencedSeries(parsed, payload)));
}
