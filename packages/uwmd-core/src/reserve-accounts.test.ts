// Reserve-account roll-forward arithmetic + three-state verification (RFC 0064,
// §4.28 / protocol §VIII.9.7). Structure is validation
// (validator.reserve-accounts.test.ts); this file covers the identity, the
// continuity rule and the verifier.

import { describe, expect, it } from 'vitest';
import {
  type ReserveAccountsSection,
  type ReserveStatement,
  rollForwardEndingBalance,
  statementsConsecutive,
  sumMovements,
  verifyReserveAccounts,
  RESERVE_MOVEMENT_KINDS,
  RESERVE_ACCOUNT_CLASSES,
  RESERVED_RESERVE_ACCOUNT_CLASSES,
} from './reserve-accounts.js';

// The §4.28 worked example. The stated ending balances were computed by this
// module and pinned in the spec, so the two cannot drift silently.
const SPEC_EXAMPLE: ReserveAccountsSection = {
  label: 'Replacement reserve, quarterly statements',
  accounts: [
    {
      account_id: 'replacement-reserve',
      class: 'property_reserve',
      purpose: 'Replacement reserve funded at closing and monthly thereafter',
      currency_code: 'USD',
      statements: [
        {
          period_start: '2026-04-01',
          period_end: '2026-06-30',
          opening_balance: 0,
          movements: [
            { kind: 'contribution', amount: 250_000, date: '2026-04-15', label: 'Closing funding' },
            { kind: 'contribution', amount: 12_500, date: '2026-05-01', label: 'Monthly deposit' },
            { kind: 'contribution', amount: 12_500, date: '2026-06-01', label: 'Monthly deposit' },
            { kind: 'draw', amount: 84_300.5, date: '2026-06-20', label: 'Roof replacement draw' },
          ],
          ending_balance: 190_699.5,
        },
        {
          period_start: '2026-07-01',
          period_end: '2026-09-30',
          opening_balance: 190_699.5,
          movements: [
            { kind: 'contribution', amount: 12_500, date: '2026-07-01' },
            { kind: 'contribution', amount: 12_500, date: '2026-08-01' },
            { kind: 'contribution', amount: 12_500, date: '2026-09-01' },
            { kind: 'release', amount: 50_000, date: '2026-09-30', label: 'Excess returned to owner' },
          ],
          ending_balance: 178_199.5,
        },
      ],
    },
  ],
};

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe('closed vocabularies', () => {
  it('registers exactly three movement kinds and one verifiable class', () => {
    expect([...RESERVE_MOVEMENT_KINDS]).toEqual(['contribution', 'draw', 'release']);
    expect([...RESERVE_ACCOUNT_CLASSES]).toEqual(['property_reserve']);
    expect([...RESERVED_RESERVE_ACCOUNT_CLASSES]).toEqual(['lender_reserve']);
  });
});

describe('rollForwardEndingBalance', () => {
  it('adds every stated movement exactly once, signed by kind', () => {
    const s = SPEC_EXAMPLE.accounts[0]!.statements[0]!;
    expect(sumMovements(s.movements, 'contribution')).toBe(275_000);
    expect(sumMovements(s.movements, 'draw')).toBe(84_300.5);
    expect(sumMovements(s.movements, 'release')).toBe(0);
    expect(rollForwardEndingBalance(s)).toBe(190_699.5);
  });

  it('is the opening balance over a quiet period', () => {
    expect(rollForwardEndingBalance({ opening_balance: 1234.56, movements: [] })).toBe(1234.56);
  });

  it('quantizes at the currency quantum with half-away-from-zero', () => {
    // 0.1 + 0.2 in binary64 is 0.30000000000000004; the identity reports 0.3.
    expect(rollForwardEndingBalance({
      opening_balance: 0.1,
      movements: [{ kind: 'contribution', amount: 0.2, date: '2026-01-02' }],
    })).toBe(0.3);
    expect(rollForwardEndingBalance({ opening_balance: 10.004, movements: [] })).toBe(10);
    expect(rollForwardEndingBalance({ opening_balance: 10.006, movements: [] })).toBe(10.01);
  });

  it('uses the shared decimal shift at half cents and for scientific notation', () => {
    expect(rollForwardEndingBalance({ opening_balance: 1.005, movements: [] })).toBe(1.01);
    expect(rollForwardEndingBalance({ opening_balance: 1.005e+0, movements: [] })).toBe(1.01);
    expect(rollForwardEndingBalance({ opening_balance: 1.5e-2, movements: [] })).toBe(0.02);
    // A negative result is structurally invalid as an account balance, but the
    // arithmetic helper still quantizes it consistently before validation.
    expect(rollForwardEndingBalance({ opening_balance: 0, movements: [
      { kind: 'draw', amount: 1.005, date: '2026-01-02' },
    ] })).toBe(-1.01);
    const zero = rollForwardEndingBalance({ opening_balance: 0, movements: [
      { kind: 'draw', amount: 0.004, date: '2026-01-02' },
    ] });
    expect(Object.is(zero, 0)).toBe(true);
  });

  it('never nets a draw against anything but the balance', () => {
    // A draw of X reduces the account by exactly X and nothing else is touched:
    // the gross expenditure it funded lives in its own section.
    const s: ReserveStatement = {
      period_start: '2026-01-01', period_end: '2026-01-31', opening_balance: 500,
      movements: [{ kind: 'draw', amount: 200, date: '2026-01-10' }],
      ending_balance: 300,
    };
    expect(rollForwardEndingBalance(s)).toBe(300);
  });
});

describe('statementsConsecutive', () => {
  it('is true only across adjacent calendar days', () => {
    expect(statementsConsecutive('2026-06-30', '2026-07-01')).toBe(true);
    expect(statementsConsecutive('2026-02-28', '2026-03-01')).toBe(true);
    expect(statementsConsecutive('2028-02-28', '2028-03-01')).toBe(false); // leap year: 02-29 exists
    expect(statementsConsecutive('2028-02-29', '2028-03-01')).toBe(true);
    expect(statementsConsecutive('2026-12-31', '2027-01-01')).toBe(true);
    expect(statementsConsecutive('2026-06-30', '2026-07-02')).toBe(false);
    expect(statementsConsecutive('2026-06-30', '2026-06-30')).toBe(false);
  });

  it('is null outside the date grammar rather than guessing', () => {
    expect(statementsConsecutive('2026-02-30', '2026-03-01')).toBeNull();
    expect(statementsConsecutive('2026-06-30', 'July 1')).toBeNull();
  });
});

describe('verifyReserveAccounts', () => {
  it('verifies the §4.28 worked example and reports each roll-forward', () => {
    const v = verifyReserveAccounts(SPEC_EXAMPLE);
    expect(v.verdict).toBe('verified');
    expect(v.issues).toEqual([]);
    expect(v.accounts).toHaveLength(1);
    const [acct] = v.accounts;
    expect(acct!.account_id).toBe('replacement-reserve');
    expect(acct!.verdict).toBe('verified');
    expect(acct!.statements.map((s) => s.computed_ending_balance)).toEqual([190_699.5, 178_199.5]);
    expect(acct!.statements.map((s) => s.consecutive)).toEqual([false, true]);
    expect(acct!.statements[1]).toMatchObject({
      contributions: 37_500, draws: 0, releases: 50_000,
      stated_ending_balance: 178_199.5, verdict: 'verified',
    });
  });

  it('does not mutate its input', () => {
    const before = JSON.stringify(SPEC_EXAMPLE);
    verifyReserveAccounts(SPEC_EXAMPLE);
    expect(JSON.stringify(SPEC_EXAMPLE)).toBe(before);
  });

  it('fails a stated ending balance that disagrees beyond the quantum', () => {
    const doc = clone(SPEC_EXAMPLE);
    doc.accounts[0]!.statements[0]!.ending_balance = 190_699.51;
    // Keep the second statement consistent with the (wrong) figure it was
    // handed, so only the identity fails and continuity does not.
    doc.accounts[0]!.statements[1]!.opening_balance = 190_699.51;
    doc.accounts[0]!.statements[1]!.ending_balance = 178_199.51;
    const v = verifyReserveAccounts(doc);
    expect(v.verdict).toBe('failed');
    expect(v.issues).toHaveLength(1);
    expect(v.issues[0]).toMatchObject({
      code: 'RSV-BALANCE-DISAGREES', severity: 'failure',
      account_id: 'replacement-reserve', statement_index: 0,
      expected: '190699.5', actual: '190699.51',
    });
    expect(v.accounts[0]!.statements[0]!.verdict).toBe('failed');
    // The second statement still rolls forward on its own stated figures.
    expect(v.accounts[0]!.statements[1]!.verdict).toBe('verified');

    // And a wrong ending that the next statement does NOT echo fails both ways.
    const both = clone(SPEC_EXAMPLE);
    both.accounts[0]!.statements[0]!.ending_balance = 190_699.51;
    expect(verifyReserveAccounts(both).issues.map((i) => i.code))
      .toEqual(['RSV-BALANCE-DISAGREES', 'RSV-CONTINUITY-DISAGREES']);
  });

  it('accepts a stated ending balance within the currency quantum', () => {
    const doc = clone(SPEC_EXAMPLE);
    doc.accounts[0]!.statements[0]!.ending_balance = 190_699.504;
    expect(verifyReserveAccounts(doc).verdict).toBe('verified');
  });

  it('compares half-cent continuity at the same quantum as the balance identity', () => {
    const doc = clone(SPEC_EXAMPLE);
    const first = doc.accounts[0]!.statements[0]!;
    first.opening_balance = 1.005;
    first.movements = [];
    first.ending_balance = 1.005;
    const second = doc.accounts[0]!.statements[1]!;
    second.opening_balance = 1.01;
    second.movements = [];
    second.ending_balance = 1.01;
    expect(verifyReserveAccounts(doc).verdict).toBe('verified');
    second.opening_balance = 1.004;
    second.ending_balance = 1.004;
    expect(verifyReserveAccounts(doc).issues.map((i) => i.code)).toEqual(['RSV-CONTINUITY-DISAGREES']);
  });

  it('fails a consecutive statement that opens at a different balance', () => {
    const doc = clone(SPEC_EXAMPLE);
    doc.accounts[0]!.statements[1]!.opening_balance = 190_000;
    doc.accounts[0]!.statements[1]!.ending_balance = 177_500; // identity holds on its own
    const v = verifyReserveAccounts(doc);
    expect(v.verdict).toBe('failed');
    expect(v.issues.map((i) => i.code)).toEqual(['RSV-CONTINUITY-DISAGREES']);
    expect(v.issues[0]).toMatchObject({ statement_index: 1, expected: '190699.5', actual: '190000' });
  });

  it('makes no continuity claim across a gap and never fills it', () => {
    const doc = clone(SPEC_EXAMPLE);
    doc.accounts[0]!.statements[1]!.period_start = '2026-07-02';
    doc.accounts[0]!.statements[1]!.opening_balance = 190_000;
    doc.accounts[0]!.statements[1]!.ending_balance = 177_500;
    const v = verifyReserveAccounts(doc);
    expect(v.verdict).toBe('verified');
    expect(v.accounts[0]!.statements[1]!.consecutive).toBe(false);
    expect(v.accounts[0]!.statements).toHaveLength(2);
  });

  it('reports an unevaluable statement as indeterminate, never as zero', () => {
    const doc = clone(SPEC_EXAMPLE) as unknown as { accounts: Array<{ statements: Array<Record<string, unknown>> }> };
    doc.accounts[0]!.statements[0]!['movements'] = [{ kind: 'interest', amount: 12, date: '2026-05-31' }];
    const v = verifyReserveAccounts(doc as unknown as ReserveAccountsSection);
    expect(v.verdict).toBe('unverifiable');
    expect(v.issues.map((i) => i.code)).toEqual(['RSV-UNEVALUABLE']);
    expect(v.accounts[0]!.statements[0]!.verdict).toBe('unverifiable');
    expect(Number.isNaN(v.accounts[0]!.statements[0]!.computed_ending_balance)).toBe(true);
    // The statement after an unevaluable one is not "consecutive" to it: there
    // is nothing evaluable to be continuous with.
    expect(v.accounts[0]!.statements[1]!.consecutive).toBe(false);
    expect(v.accounts[0]!.statements[1]!.verdict).toBe('verified');
  });

  it('ranks failed above unverifiable above verified', () => {
    const doc = clone(SPEC_EXAMPLE) as unknown as { accounts: Array<{ statements: Array<Record<string, unknown>> }> };
    doc.accounts[0]!.statements[0]!['movements'] = [{ kind: 'interest', amount: 12, date: '2026-05-31' }];
    doc.accounts[0]!.statements[1]!['ending_balance'] = 1;
    const v = verifyReserveAccounts(doc as unknown as ReserveAccountsSection);
    expect(v.verdict).toBe('failed');
    expect(v.issues.map((i) => i.code).sort()).toEqual(['RSV-BALANCE-DISAGREES', 'RSV-UNEVALUABLE']);
  });

  it('is unverifiable when accounts is not an array', () => {
    const v = verifyReserveAccounts({ accounts: 'none' } as unknown as ReserveAccountsSection);
    expect(v.verdict).toBe('unverifiable');
    expect(v.accounts).toEqual([]);
    expect(v.issues[0]!.code).toBe('RSV-UNEVALUABLE');
  });

  it('verifies several accounts independently', () => {
    const doc = clone(SPEC_EXAMPLE);
    doc.accounts.push({
      account_id: 'ti-lc-reserve',
      class: 'property_reserve',
      purpose: 'TI/LC reserve',
      statements: [{
        period_start: '2026-04-01', period_end: '2026-04-30', opening_balance: 10_000,
        movements: [{ kind: 'draw', amount: 2_500, date: '2026-04-20' }],
        ending_balance: 7_000, // wrong
      }],
    });
    const v = verifyReserveAccounts(doc);
    expect(v.accounts.map((a) => [a.account_id, a.verdict])).toEqual([
      ['replacement-reserve', 'verified'],
      ['ti-lc-reserve', 'failed'],
    ]);
    expect(v.verdict).toBe('failed');
  });
});
