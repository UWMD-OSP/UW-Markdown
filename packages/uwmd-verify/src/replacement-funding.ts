// RFC 0070: read-only verification of a modeled payment commitment.
import type { ParsedUWFile } from './types.js';
import type { ReplacementFundingVerificationResult, ProtocolError } from './protocol.js';
import type { CashFlowRow } from './cash-flow-series.js';
import { isCurrencyCode } from './protocol.js';
import { canonicalize } from './integrity-canonical.js';
import { sha256TextHex } from './integrity.js';
import { validateUWFile, checkCashFlowContent } from './validator.js';
import { hasBlockShape } from './block-kind.js';
import {
  checkReplacementFundingStructure,
  validBindingSeries,
} from './replacement-funding-structure.js';

export async function computeReplacementCashFlowBindingDigest(
  series: readonly CashFlowRow[],
  variant: string,
  rowIndex: number,
  currencyCode: string | null
): Promise<string> {
  if (
    !validBindingSeries(series) ||
    typeof variant !== 'string' ||
    variant.length === 0 ||
    !Number.isSafeInteger(rowIndex) ||
    rowIndex < 0 ||
    rowIndex >= series.length ||
    (currencyCode !== null && !isCurrencyCode(currencyCode))
  ) {
    throw {
      category: 'validate',
      code: 'HDG-08',
      message: 'Invalid replacement cash-flow binding digest inputs',
    } satisfies ProtocolError;
  }
  const bytes = canonicalize({
    currency_code: currencyCode,
    row_index: rowIndex,
    section: 'cash_flow_series',
    series,
    variant,
  });
  return `sha256:${await sha256TextHex(bytes)}`;
}

export async function verifyReplacementFundingBindings(
  parsed: ParsedUWFile
): Promise<ReplacementFundingVerificationResult> {
  const snapshot = structuredClone(parsed);
  const structure = checkReplacementFundingStructure(snapshot);
  const validation = validateUWFile(snapshot);
  const structuralIssues = validation.errors.filter(
    (i) => i.code.startsWith('HDG-') || i.code.startsWith('ESC-') || i.code === 'CUR-01'
  );
  // RFC 0120: reuse validation on the exact selected physical source, not
  // all-document CF findings (whose public locations intentionally omit variants).
  if (structure.selectedSource) {
    const entry = snapshot.sections.cash_flow_series;
    const variant = hasBlockShape(entry) ? 'default'
      : Object.entries(entry ?? {}).find(([, block]) => block === structure.selectedSource)?.[0] ?? 'default';
    checkCashFlowContent(structure.selectedSource.content as Record<string, unknown>, variant, structuralIssues);
  }
  if (structure.unresolvable)
    return {
      state: 'unverifiable',
      reason: 'unresolvable_source',
      context: structure.context,
      structural_issues: structuralIssues,
      issues: [],
    };
  if (structuralIssues.length)
    return {
      state: 'unverifiable',
      reason: 'invalid_structure',
      context: structure.context,
      structural_issues: structuralIssues,
      issues: [],
    };
  if (structure.funding !== 'outright')
    return { state: 'not_checked', reason: 'not_applicable', issues: [] };
  if (!structure.ref || !structure.series || !structure.context)
    return {
      state: 'unverifiable',
      reason: 'invalid_structure',
      context: structure.context,
      structural_issues: structuralIssues,
      issues: [],
    };
  const { ref, series, context } = structure;
  let computed: string;
  try {
    computed = await computeReplacementCashFlowBindingDigest(
      series,
      ref.variant,
      ref.row_index,
      context.currency_code
    );
  } catch {
    return {
      state: 'unverifiable',
      reason: 'crypto_unavailable',
      context,
      structural_issues: [],
      issues: [],
    };
  }
  if (computed === ref.binding_digest)
    return {
      state: 'verified',
      context,
      stated_digest: ref.binding_digest,
      computed_digest: computed,
      issues: [],
    };
  return {
    state: 'failed',
    reason: 'stale_binding',
    context,
    stated_digest: ref.binding_digest,
    computed_digest: computed,
    issues: [
      {
        code: 'HDG-09',
        severity: 'error',
        section: 'debt_structure',
        field: 'rate_hedge.replacement_funding.cash_flow_ref.binding_digest',
        context,
        stated_digest: ref.binding_digest,
        computed_digest: computed,
        message: `HDG-09: replacement binding is stale: stated ${ref.binding_digest}, computed ${computed}, variant ${ref.variant}, row_index ${ref.row_index}`,
      },
    ],
  };
}
