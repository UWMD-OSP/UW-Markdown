// RFC 0070 structural binding checks. No hashing, financial math or writes.
import type { ParsedUWFile, ValidationMessage, UWBlock } from './types.js';
import type { ReplacementCashFlowRef, ReplacementFundingBindingContext } from './protocol.js';
import { isCurrencyCode } from './protocol.js';
import { blockPayload, deepGet } from './parser.js';
import { resolveRoleBlock } from './block-roles.js';
import { CASH_FLOW_KINDS, type CashFlowRow } from './cash-flow-series.js';
import { isDayCountConvention, parseISODate } from './calc/day-count.js';

const at = 'rate_hedge.replacement_funding';
const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const date = (v: unknown): v is string => typeof v === 'string' && parseISODate(v) !== null;
const closed = (v: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(v).every((k) => keys.includes(k));
export const isBindingDigest = (v: unknown): v is string =>
  typeof v === 'string' && /^sha256:[0-9a-f]{64}$/.test(v);
export function sectionBlocks(entry: ParsedUWFile['sections'][string] | undefined): UWBlock[] {
  return !entry
    ? []
    : 'annotation' in entry
      ? [entry as UWBlock]
      : Object.values(entry as Record<string, UWBlock>);
}

export function validBindingSeries(series: unknown): series is CashFlowRow[] {
  if (!Array.isArray(series) || series.length === 0) return false;
  let prior = '';
  for (const row of series) {
    if (
      !record(row) ||
      !closed(row, ['date', 'amount', 'kind', 'label']) ||
      !date(row.date) ||
      !finite(row.amount) ||
      row.date < prior ||
      (row.kind != null && !(CASH_FLOW_KINDS as readonly unknown[]).includes(row.kind)) ||
      (row.label != null && typeof row.label !== 'string')
    )
      return false;
    prior = row.date;
  }
  return true;
}

export interface ReplacementFundingStructure {
  issues: ValidationMessage[];
  funding: 'absent' | 'escrow' | 'outright' | 'invalid';
  unresolvable: boolean;
  /**
   * A stated hedge's `debt_structure` or `sources_uses` selection refused
   * (RFC 0076). The rules that compare the two sides, HDG-05 and ESC-04, are
   * then not evaluated. A missing cash_flow_series variant is `unresolvable`
   * but not this.
   */
  selectionRefused: boolean;
  context: ReplacementFundingBindingContext | null;
  ref: ReplacementCashFlowRef | null;
  series: CashFlowRow[] | null;
}

export function checkReplacementFundingStructure(
  parsed: ParsedUWFile
): ReplacementFundingStructure {
  const out: ReplacementFundingStructure = {
    issues: [],
    funding: 'absent',
    unresolvable: false,
    selectionRefused: false,
    context: null,
    ref: null,
    series: null,
  };
  const issue = (code: string, suffix: string, message: string) =>
    out.issues.push({
      code,
      severity: 'error',
      section: 'debt_structure',
      field: suffix ? `${at}.${suffix}` : at,
      message: `${code}: ${message}`,
    });
  // A stated hedge whose loan or cash lines cannot be selected is refused,
  // never read as absent (RFC 0076, extending RFC 0070 §V.12.1 step 1).
  const refuse = (message: string) => {
    out.unresolvable = true;
    out.selectionRefused = true;
    out.issues.push({
      code: 'HDG-08',
      severity: 'error',
      section: 'debt_structure',
      field: 'rate_hedge',
      message: `HDG-08: ${message}`,
    });
    return out;
  };
  // The hedge rules share one senior-preferring selection (RFC 0075).
  const debt = resolveRoleBlock(parsed.sections.debt_structure, 'debt_structure', [], 'HDG-08');
  if (debt.state === 'unresolvable') {
    // RFC 0076 D2: any current block stating a hedge, as RFC 0070 scanned for funding.
    const payloads = sectionBlocks(parsed.sections.debt_structure).map(blockPayload);
    if (payloads.some((p) => deepGet(p, at) != null)) out.funding = 'invalid';
    if (payloads.some((p) => deepGet(p, 'rate_hedge') != null))
      return refuse('a stated rate_hedge requires unambiguous property-level debt selection');
    return out;
  }
  if (!debt.block) return out;
  const hedge = deepGet(blockPayload(debt.block), 'rate_hedge');
  if (hedge == null) return out;
  // RFC 0076 D3: HDG-05 and ESC-04 need the cash side for any stated hedge.
  // The debt-only rules, HDG-07 here, still run first.
  const sourcesRefused =
    resolveRoleBlock(parsed.sections.sources_uses, 'sources_uses').state === 'unresolvable';
  const done = () =>
    sourcesRefused
      ? refuse('a stated rate_hedge requires stated sources_uses to resolve')
      : out;
  if (!record(hedge) || hedge.replacement_funding == null) return done();
  const funding = hedge.replacement_funding;
  out.funding = 'invalid';
  if (
    !record(funding) ||
    (funding.mode !== 'escrow' && funding.mode !== 'outright') ||
    !closed(funding, funding.mode === 'escrow' ? ['mode'] : ['mode', 'cash_flow_ref']) ||
    (funding.mode === 'outright' &&
      (!record(funding.cash_flow_ref) ||
        !closed(funding.cash_flow_ref, ['variant', 'row_index', 'binding_digest']) ||
        !['variant', 'row_index', 'binding_digest'].every((k) =>
          Object.hasOwn(funding.cash_flow_ref as object, k)
        )))
  ) {
    issue(
      'HDG-07',
      '',
      'replacement funding must be the closed escrow/outright union with its required members'
    );
    return done();
  }
  out.funding = funding.mode;
  if (hedge.post_expiration_assumption !== 'replace') {
    issue('HDG-07', '', 'replacement funding requires post_expiration_assumption replace');
    return done();
  }
  if (sourcesRefused) return done();
  if (funding.mode === 'escrow') return out;
  const ref = funding.cash_flow_ref as Record<string, unknown>;
  if (
    typeof ref.variant !== 'string' ||
    ref.variant.length === 0 ||
    !Number.isSafeInteger(ref.row_index) ||
    (ref.row_index as number) < 0 ||
    !isBindingDigest(ref.binding_digest)
  ) {
    issue(
      'HDG-08',
      'cash_flow_ref',
      'reference requires exact variant, nonnegative safe row_index and sha256 lowercase digest'
    );
    return out;
  }
  const sources = sectionBlocks(parsed.sections.cash_flow_series).filter(
    (b) => b.annotation.variant === ref.variant && !b.annotation.superseded && !b.meta.superseded
  );
  if (sources.length !== 1) {
    out.unresolvable = true;
    issue(
      'HDG-08',
      'cash_flow_ref.variant',
      'exact current cash_flow_series variant does not resolve; no fallback is permitted'
    );
    return out;
  }
  const payload = blockPayload(sources[0]!);
  const series = record(payload) ? payload.series : undefined;
  if (
    (record(payload) && payload.day_count != null && !isDayCountConvention(payload.day_count)) ||
    !validBindingSeries(series) ||
    (ref.row_index as number) >= series.length
  ) {
    issue(
      'HDG-08',
      'cash_flow_ref.row_index',
      'selected ordered series/row must have legal shape, real dates, finite amounts and an in-range index'
    );
    return out;
  }
  const row = series[ref.row_index as number]!;
  if (row.amount > 0 || (date(hedge.effective_date) && row.date <= hedge.effective_date)) {
    issue(
      'HDG-10',
      'cash_flow_ref',
      'payment must be nonpositive and strictly after initial effective_date; expiration imposes no payment constraint'
    );
  }
  const currency = parsed.frontmatter.currency_code ?? null;
  if (currency !== null && !isCurrencyCode(currency)) return out; // existing CUR-01 owns this finding
  out.ref = ref as unknown as ReplacementCashFlowRef;
  out.series = series;
  out.context = {
    debt_variant: debt.variant ?? debt.block.annotation.variant ?? null,
    cash_flow_variant: ref.variant,
    row_index: ref.row_index as number,
    currency_code: currency,
  };
  return out;
}
