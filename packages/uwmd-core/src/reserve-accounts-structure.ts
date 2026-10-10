// RFC 0064 / Format §4.28: stated custody facts; no reconciliation here.
import type { ParsedUWFile, ValidationMessage } from './types.js';
import type { ReserveAccounts, ReserveSource } from './protocol.js';
import { isCurrencyCode } from './protocol.js';
import { blockPayload } from './parser.js';
import { sectionBlocks } from './replacement-funding-structure.js';
import { parseISODate } from './calc/day-count.js';

const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const amount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const date = (v: unknown): v is string => typeof v === 'string' && parseISODate(v) !== null;
const closed = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).every(k => keys.includes(k));
export const validReserveSource = (v: unknown): v is ReserveSource => record(v) && closed(v, ['document', 'locator']) && text(v.document) && text(v.locator);
export interface ReserveAccountsStructure {
  present: boolean;
  issues: ValidationMessage[];
  sections: { variant: string | null; payload: ReserveAccounts }[];
}
export function checkReserveAccountsStructure(parsed: ParsedUWFile): ReserveAccountsStructure {
  const blocks = sectionBlocks(parsed.sections.reserve_accounts).filter(b => !b.annotation.superseded && !b.meta.superseded);
  const out: ReserveAccountsStructure = { present: blocks.length > 0, issues: [], sections: [] };
  for (const block of blocks) {
    const variant = block.annotation.variant ?? null;
    const payload = blockPayload(block);
    const issue = (code: string, field: string, message: string) => out.issues.push({ code, severity: 'error', section: 'reserve_accounts', field, value: { variant }, message: code + ': ' + message + (variant === null ? '' : ' (variant ' + variant + ')') });
    if (!record(payload) || !closed(payload, ['accounts', '_meta', '_role', '_notes']) || !Array.isArray(payload.accounts) || payload.accounts.length === 0) {
      issue('RSV-01', 'accounts', 'State a nonempty accounts array in the closed reserve payload'); continue;
    }
    const ids = new Set<string>();
    for (const [ai, a] of payload.accounts.entries()) {
      const ap = 'accounts[' + ai + ']';
      if (!record(a) || !closed(a, ['account_id', 'class', 'purpose', 'owner', 'currency_code', 'source', 'periods']) || !text(a.account_id) || !text(a.purpose) || !text(a.owner) || !isCurrencyCode(a.currency_code) || !validReserveSource(a.source) || !Array.isArray(a.periods) || a.periods.length === 0) {
        issue('RSV-01', ap, 'Account requires identity, purpose, economic owner, currency, source pointer and stated periods'); continue;
      }
      if (a.class !== 'property_reserve') issue('RSV-04', ap + '.class', 'Only property_reserve is supported; lender reserves are outside this contract');
      if (ids.has(a.account_id)) issue('RSV-02', ap + '.account_id', 'Account identity must be unique within the section');
      ids.add(a.account_id);
      if (parsed.frontmatter.currency_code != null && a.currency_code !== parsed.frontmatter.currency_code) issue('RSV-01', ap + '.currency_code', 'Account currency must agree with the stated document currency; no FX is supported');
      const periods = new Set<string>();
      let lastEnd = ''; let lastStart = '';
      for (const [pi, p] of a.periods.entries()) {
        const pp = ap + '.periods[' + pi + ']';
        if (!record(p) || !closed(p, ['period_id', 'start_date', 'end_date', 'opening_balance', 'ending_balance', 'previous_period_id', 'source', 'movements']) || !text(p.period_id) || !amount(p.opening_balance) || !amount(p.ending_balance) || !validReserveSource(p.source) || !Array.isArray(p.movements)) {
          issue('RSV-01', pp, 'Period requires explicit balances, source and movements (including an explicit empty array)'); continue;
        }
        if (periods.has(p.period_id)) issue('RSV-02', pp + '.period_id', 'Period identity must be unique within its account');
        periods.add(p.period_id);
        if (!date(p.start_date) || !date(p.end_date) || p.start_date > p.end_date) issue('RSV-03', pp, 'State real ordered opening and closing dates');
        else {
          if (p.start_date < lastEnd || p.start_date <= lastStart) issue('RSV-05', pp + '.start_date', 'Periods must be in chronological order without overlap (a shared boundary is allowed)');
          lastStart = p.start_date; lastEnd = p.end_date;
        }
        if (Object.hasOwn(p, 'previous_period_id') && (!text(p.previous_period_id) || pi === 0 || (!record(a.periods[pi - 1]) || p.previous_period_id !== a.periods[pi - 1].period_id))) issue('RSV-05', pp + '.previous_period_id', 'A claimed consecutive statement must name the immediately preceding stated period');
        let lastDate = ''; const movements = new Set<string>();
        for (const [mi, m] of p.movements.entries()) {
          const mp = pp + '.movements[' + mi + ']';
          if (!record(m)) { issue('RSV-01', mp, 'Movement must be a stated object'); continue; }
          if (!['contribution', 'internal_draw', 'external_release'].includes(m.kind as string)) issue('RSV-04', mp + '.kind', 'Source must establish contribution, internal_draw or external_release; unclassified or unsupported movements refuse');
          if (!closed(m, ['movement_id', 'date', 'kind', 'amount', 'counterparty', 'source']) || !text(m.movement_id) || !amount(m.amount) || !text(m.counterparty) || !validReserveSource(m.source)) issue('RSV-01', mp, 'Movement requires identity, nonnegative amount, counterparty and source pointer establishing its class');
          if (text(m.movement_id)) { if (movements.has(m.movement_id)) issue('RSV-02', mp + '.movement_id', 'Movement identity must be unique within its period'); movements.add(m.movement_id); }
          if (!date(m.date) || (date(p.start_date) && m.date < p.start_date) || (date(p.end_date) && m.date > p.end_date)) issue('RSV-03', mp + '.date', 'Movement must have a real date within the stated opening/closing bounds');
          else { if (m.date < lastDate) issue('RSV-05', mp + '.date', 'Movement dates must be nondecreasing; same-day rows stay separate'); lastDate = m.date; }
        }
      }
    }
    out.sections.push({ variant, payload: payload as unknown as ReserveAccounts });
  }
  return out;
}
