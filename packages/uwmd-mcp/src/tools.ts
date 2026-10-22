// The connector's three read-only operations, independent of any MCP SDK so
// they can be tested directly. Each takes a record's source text, never a path:
// the connector reads no files and opens no network connections.
//
// Everything is computed by @uwmd/verify, the reference implementation of the
// standard. The model calling these tools does no financial math; it reads the
// deterministic results (invariant 1).

import {
  BUILTIN_REMEDIATIONS,
  parseUWFile,
  validateUWFile,
  verifyChain,
  verifyProvenance,
  verifyReplacementFundingBindings,
  verifyStatedMetrics,
  type ParsedUWFile,
  type DealFlag,
  type ValidationMessage,
} from '@uwmd/verify';

/** The largest record the connector reads, in UTF-8 bytes. */
export const MAX_SOURCE_BYTES = 5 * 1024 * 1024;

/** A refusal the connector reports as a tool error (`isError: true`). */
export class ConnectorError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'ConnectorError';
  }
}

/** A validation issue without the remediation prose, which `uwmd_explain_code` returns on request. */
export interface CompactIssue {
  code: string;
  severity: string;
  section?: string;
  field?: string;
  message: string;
}

/** A Format §5.2 deal flag (RFC 0109): the deal crosses a band; not a record defect. */
export interface CompactDealFlag {
  code: string;
  band: 'error' | 'warning';
  section: string;
  field: string;
  message: string;
}

export interface ValidateResult {
  overall_status: string;
  error_count: number;
  warning_count: number;
  stage_readiness: Record<string, boolean>;
  issues: CompactIssue[];
  /** Financial-validity findings, apart from `issues` and never counted in them (RFC 0109). */
  deal_flags: CompactDealFlag[];
}

export interface VerifyResult {
  /** True when nothing failed: no validation error, no failed metric, and integrity and provenance held. */
  ok: boolean;
  validation: Omit<ValidateResult, 'stage_readiness'>;
  stated_metrics: {
    counts: { verified: number; failed: number; unverifiable: number };
    /** Every failed statement, with what was stated and what the standard recomputes. */
    failed: Array<{ id: string; path: string; stated: number; computed: number | null }>;
    /** Statements that could not be checked, with the reason. */
    unverifiable: Array<{ id: string; path: string; reason?: string }>;
  };
  integrity: { ok: boolean; chains_verified: number; signatures_present: number; issues: unknown[] };
  provenance: { ok: boolean; issues: unknown[] };
  replacement_funding: { state: string; reason?: string };
}

function admit(source: unknown): string {
  if (typeof source !== 'string' || source.length === 0) {
    throw new ConnectorError('UWMD-MCP-NO-SOURCE', 'Pass the record\'s full .uwx.md text as `source`.');
  }
  if (Buffer.byteLength(source, 'utf8') > MAX_SOURCE_BYTES) {
    throw new ConnectorError('UWMD-MCP-TOO-LARGE', `The record is larger than ${MAX_SOURCE_BYTES} bytes.`);
  }
  return source;
}

function parse(source: string): ParsedUWFile {
  try {
    return parseUWFile(source);
  } catch (error) {
    const e = error as { code?: string; message?: string };
    throw new ConnectorError(e.code ?? 'UWMD-MCP-PARSE', e.message ?? 'The record could not be parsed.');
  }
}

function compactFlag(flag: DealFlag): CompactDealFlag {
  return { code: flag.code, band: flag.band, section: flag.section, field: flag.field, message: flag.message };
}

function compact(issue: ValidationMessage): CompactIssue {
  return {
    code: issue.code,
    severity: issue.severity,
    ...(issue.section !== undefined ? { section: issue.section } : {}),
    ...(issue.field !== undefined ? { field: issue.field } : {}),
    message: issue.message,
  };
}

/** Validate a record against the Format's rules (`uwmd validate`). */
export function validateSource(source: unknown): ValidateResult {
  const text = admit(source);
  parse(text); // a parse refusal is a tool error, not a validation result
  const result = validateUWFile(text);
  return {
    overall_status: result.overall_status,
    error_count: result.errors.length,
    warning_count: result.warnings.length,
    stage_readiness: { ...result.stage_readiness } as unknown as Record<string, boolean>,
    issues: result.issues.map(compact),
    deal_flags: result.deal_flags.map(compactFlag),
  };
}

/**
 * Verify a record the way `uwmd verify` does: validation, every stated
 * dictionary metric recomputed (RFC 0099 homes included), the hash chain and
 * provenance. Signatures are counted but not checked: the connector holds no
 * key store.
 */
export async function verifySource(source: unknown): Promise<VerifyResult> {
  const text = admit(source);
  const parsed = parse(text);
  const validation = validateUWFile(text);
  const funding = await verifyReplacementFundingBindings(parsed);
  const metrics = verifyStatedMetrics(parsed);
  const chain = await verifyChain(parsed);
  const provenance = verifyProvenance(parsed);
  const fundingReason = 'reason' in funding ? (funding.reason as string) : undefined;
  const fundingOk = funding.state === 'verified' || (funding.state === 'not_checked' && fundingReason === 'not_applicable');
  return {
    ok: validation.errors.length === 0 && fundingOk && metrics.counts.failed === 0 && chain.ok && provenance.ok,
    validation: {
      overall_status: validation.overall_status,
      error_count: validation.errors.length,
      warning_count: validation.warnings.length,
      issues: validation.issues.map(compact),
      deal_flags: validation.deal_flags.map(compactFlag),
    },
    stated_metrics: {
      counts: metrics.counts,
      failed: metrics.evidence.filter((e) => e.state === 'failed')
        .map(({ id, path, stated, computed }) => ({ id, path, stated, computed })),
      unverifiable: metrics.evidence.filter((e) => e.state === 'unverifiable')
        .map(({ id, path, reason }) => ({ id, path, ...(reason !== undefined ? { reason } : {}) })),
    },
    integrity: { ok: chain.ok, chains_verified: chain.chains_verified, signatures_present: chain.signatures_present, issues: chain.issues },
    provenance: { ok: provenance.ok, issues: provenance.issues ?? [] },
    replacement_funding: { state: funding.state, ...(fundingReason !== undefined ? { reason: fundingReason } : {}) },
  };
}

/** What a validation code means and how to fix it, from the standard's registry. */
export function explainCode(code: unknown): { code: string; severity: string; title: string; description: string; remediation: string; spec_ref?: string } {
  if (typeof code !== 'string' || code.length === 0) {
    throw new ConnectorError('UWMD-MCP-NO-CODE', 'Pass a validation code such as `CC-03`.');
  }
  const entry = BUILTIN_REMEDIATIONS.find((r) => r.code === code.trim().toUpperCase());
  if (!entry) throw new ConnectorError('UWMD-MCP-UNKNOWN-CODE', `${code} is not in the standard's code registry.`);
  return {
    code: entry.code,
    severity: entry.severity,
    title: entry.title,
    description: entry.description,
    remediation: entry.remediation,
    ...(entry.spec_ref !== undefined ? { spec_ref: entry.spec_ref } : {}),
  };
}
