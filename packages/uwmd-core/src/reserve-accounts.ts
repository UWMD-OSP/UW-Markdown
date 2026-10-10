// RFC 0064 / Protocol §VIII.11: read-only balance identity verification.
import type { ParsedUWFile } from './types.js';
import type { ReserveAccountsVerification, ReservePeriodEvidence } from './protocol.js';
import { checkReserveAccountsStructure } from './reserve-accounts-structure.js';
import { quantizeAtDecimals } from './cash-flow-series.js';
import { computeEnvelopeDigest, toUWEnvelope } from './envelope.js';

export async function verifyReserveAccounts(parsed: ParsedUWFile): Promise<ReserveAccountsVerification> {
  const snapshot = structuredClone(parsed); // Snapshot before the first await.
  const structure = checkReserveAccountsStructure(snapshot);
  const base = { source_digest: null, evidence: [], issues: [] };
  if (!structure.present) return { ...base, state: 'not_checked', reason: 'not_applicable' };
  if (structure.issues.length) return { ...base, state: 'unverifiable', reason: 'invalid_structure', issues: structure.issues };
  let source_digest: string;
  try { source_digest = await computeEnvelopeDigest(toUWEnvelope(snapshot)); }
  catch { return { ...base, state: 'unverifiable', reason: 'digest_unavailable' }; }
  const evidence: ReservePeriodEvidence[] = [];
  const issues: ReserveAccountsVerification['issues'] = [];
  for (const { variant, payload } of structure.sections) {
    for (const [ai, account] of payload.accounts.entries()) {
      for (const [pi, period] of account.periods.entries()) {
        // Ordered binary64 arithmetic; never round intermediate balances or net gross costs.
        let ending = period.opening_balance;
        for (const m of period.movements) ending += m.kind === 'contribution' ? m.amount : -m.amount;
        const field = 'accounts[' + ai + '].periods[' + pi + ']';
        const item: ReservePeriodEvidence = { variant, account_id: account.account_id, period_id: period.period_id, field, currency_code: account.currency_code, source: period.source, opening_balance: period.opening_balance, stated_ending_balance: period.ending_balance, computed_ending_balance: ending, movements: structuredClone(period.movements) };
        const issue = (code: string, suffix: string, message: string) => issues.push({ code, severity: 'error', section: 'reserve_accounts', field: field + suffix, message: code + ': ' + message + ' (' + account.account_id + '/' + period.period_id + ')', context: { variant, account_id: account.account_id, period_id: period.period_id, source: period.source } });
        if (!Number.isFinite(ending) || !Number.isFinite(ending * 100) || !Number.isFinite(period.ending_balance * 100) || !Number.isFinite(period.opening_balance * 100)) {
          issue('RSV-08', '', 'Balance arithmetic or currency quantization is nonfinite');
          // A nonfinite number cannot enter a JSON verification result.
          return { state: 'unverifiable', reason: 'nonfinite_arithmetic', source_digest, evidence, issues };
        }
        evidence.push(item);
        if (quantizeAtDecimals(ending, 2) !== quantizeAtDecimals(period.ending_balance, 2)) issue('RSV-06', '.ending_balance', 'Stated ending balance disagrees with opening plus stated movements at the currency quantum');
        if (period.previous_period_id !== undefined && quantizeAtDecimals(period.opening_balance, 2) !== quantizeAtDecimals(account.periods[pi - 1]!.ending_balance, 2)) issue('RSV-07', '.opening_balance', 'Claimed consecutive opening balance disagrees with the preceding ending balance at the currency quantum');
      }
    }
  }
  return { state: issues.length ? 'failed' : 'verified', source_digest, evidence, issues };
}
