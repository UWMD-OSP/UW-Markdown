// Reserve-account structural validation (RFC 0064, §4.28): RSV-01…RSV-07.
// Arithmetic and verdicts live in reserve-accounts.test.ts; this file pins
// what the validator refuses, what it warns, and — as important — what it
// leaves alone.

import { describe, expect, it } from 'vitest';
import { parseUWFile } from './parser.js';
import { validateUWFile } from './validator.js';

function doc(content: unknown, extra = ''): string {
  return [
    '---',
    'uw_version: "2.0"',
    'deal_id: RSV-TEST',
    'asset_class: multifamily',
    '---',
    '',
    '```json uw:section=reserve_accounts source=manual ts=2026-09-28T00:00:00Z v=1',
    JSON.stringify(content, null, 2),
    '```',
    extra,
  ].join('\n');
}

const rsv = (source: string) =>
  validateUWFile(parseUWFile(source)).issues.filter((i) => i.code.startsWith('RSV-'));

const GOOD = {
  label: 'Replacement reserve',
  accounts: [{
    account_id: 'replacement-reserve',
    class: 'property_reserve',
    purpose: 'Replacement reserve',
    currency_code: 'USD',
    statements: [
      {
        period_start: '2026-04-01', period_end: '2026-06-30', opening_balance: 0,
        movements: [
          { kind: 'contribution', amount: 250_000, date: '2026-04-15', label: 'Closing funding' },
          { kind: 'draw', amount: 84_300.5, date: '2026-06-20' },
        ],
        ending_balance: 165_699.5,
      },
      {
        period_start: '2026-07-01', period_end: '2026-09-30', opening_balance: 165_699.5,
        movements: [{ kind: 'release', amount: 50_000, date: '2026-09-30' }],
        ending_balance: 115_699.5,
      },
    ],
  }],
};

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe('reserve_accounts validation', () => {
  it('is silent when the section is absent', () => {
    const src = ['---', 'uw_version: "2.0"', 'deal_id: RSV-TEST', 'asset_class: multifamily', '---', ''].join('\n');
    expect(rsv(src)).toEqual([]);
  });

  it('accepts a well-formed two-period roll-forward', () => {
    expect(rsv(doc(GOOD))).toEqual([]);
  });

  it('accepts a quiet period with no movements', () => {
    const d = clone(GOOD);
    d.accounts[0]!.statements[1]!.movements = [];
    d.accounts[0]!.statements[1]!.ending_balance = 165_699.5;
    expect(rsv(doc(d))).toEqual([]);
  });

  describe('RSV-01 structure', () => {
    it('refuses an empty accounts list', () => {
      const issues = rsv(doc({ accounts: [] }));
      expect(issues.map((i) => [i.code, i.field])).toEqual([['RSV-01', 'accounts']]);
    });

    it('refuses an unsupported movement kind rather than reclassifying it', () => {
      const d = clone(GOOD);
      (d.accounts[0]!.statements[0]!.movements as unknown[]).push({ kind: 'interest', amount: 12, date: '2026-05-31' });
      const issues = rsv(doc(d));
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({ code: 'RSV-01', field: 'accounts[0].statements[0].movements[2].kind', value: 'interest' });
      // No RSV-05 on a statement RSV-01 already refused: the identity over a
      // refused movement would be noise.
      expect(issues.some((i) => i.code === 'RSV-05')).toBe(false);
    });

    it('refuses a negative movement: the kind carries the direction', () => {
      const d = clone(GOOD);
      d.accounts[0]!.statements[0]!.movements[1]!.amount = -84_300.5;
      const issues = rsv(doc(d));
      expect(issues.map((i) => i.code)).toEqual(['RSV-01']);
      expect(issues[0]!.field).toBe('accounts[0].statements[0].movements[1].amount');
    });

    it('refuses an impossible date and an unknown class', () => {
      const d = clone(GOOD) as unknown as { accounts: Array<Record<string, unknown>> };
      (d.accounts[0]!['statements'] as Array<Record<string, unknown>>)[0]!['period_end'] = '2026-06-31';
      d.accounts[0]!['class'] = 'operating_reserve';
      const issues = rsv(doc(d));
      expect(issues.map((i) => [i.code, i.field])).toEqual([
        ['RSV-01', 'accounts[0].class'],
        ['RSV-01', 'accounts[0].statements[0].period_end'],
      ]);
    });

    it('refuses an empty statements list and a blank purpose', () => {
      const d = clone(GOOD) as unknown as { accounts: Array<Record<string, unknown>> };
      d.accounts[0]!['statements'] = [];
      d.accounts[0]!['purpose'] = '  ';
      const issues = rsv(doc(d));
      expect(issues.map((i) => [i.code, i.field])).toEqual([
        ['RSV-01', 'accounts[0].purpose'],
        ['RSV-01', 'accounts[0].statements'],
      ]);
    });

    it('refuses a malformed currency_code but accepts null', () => {
      const d = clone(GOOD) as unknown as { accounts: Array<Record<string, unknown>> };
      d.accounts[0]!['currency_code'] = 'usd';
      expect(rsv(doc(d)).map((i) => [i.code, i.field])).toEqual([['RSV-01', 'accounts[0].currency_code']]);
      d.accounts[0]!['currency_code'] = null;
      expect(rsv(doc(d))).toEqual([]);
    });
  });

  it('RSV-02 refuses the reserved lender_reserve class with an explanation', () => {
    const d = clone(GOOD) as unknown as { accounts: Array<Record<string, unknown>> };
    d.accounts[0]!['class'] = 'lender_reserve';
    const issues = rsv(doc(d));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: 'RSV-02', severity: 'error', field: 'accounts[0].class' });
    expect(issues[0]!.message).toMatch(/reserved/);
    expect(issues[0]!.message).toMatch(/not property cash/);
  });

  describe('RSV-03 identity and order', () => {
    it('refuses a repeated account_id', () => {
      const d = clone(GOOD);
      d.accounts.push(clone(d.accounts[0]!));
      const issues = rsv(doc(d));
      expect(issues.map((i) => [i.code, i.field])).toEqual([['RSV-03', 'accounts[1].account_id']]);
    });

    it('refuses period_end before period_start', () => {
      const d = clone(GOOD);
      d.accounts[0]!.statements[1]!.period_end = '2026-06-30';
      const issues = rsv(doc(d));
      expect(issues.map((i) => [i.code, i.field])).toEqual([
        // The release on 09-30 now lies outside 07-01…06-30 too.
        ['RSV-04', 'accounts[0].statements[1].movements[0].date'],
        ['RSV-03', 'accounts[0].statements[1].period_end'],
      ]);
    });

    it('refuses overlapping and out-of-order statements', () => {
      const d = clone(GOOD);
      d.accounts[0]!.statements[1]!.period_start = '2026-06-30';
      const issues = rsv(doc(d));
      expect(issues.map((i) => [i.code, i.field])).toEqual([['RSV-03', 'accounts[0].statements[1].period_start']]);
    });
  });

  it('RSV-04 refuses a movement dated outside its statement', () => {
    const d = clone(GOOD);
    d.accounts[0]!.statements[0]!.movements[1]!.date = '2026-07-01';
    const issues = rsv(doc(d));
    expect(issues.map((i) => [i.code, i.field])).toEqual([['RSV-04', 'accounts[0].statements[0].movements[1].date']]);
  });

  describe('RSV-05 balance identity', () => {
    it('refuses a stated ending balance the movements do not produce', () => {
      const d = clone(GOOD);
      d.accounts[0]!.statements[0]!.ending_balance = 165_700;
      const issues = rsv(doc(d));
      expect(issues.map((i) => i.code)).toEqual(['RSV-05', 'RSV-06']);
      expect(issues[0]).toMatchObject({ field: 'accounts[0].statements[0].ending_balance', value: 165_700 });
      expect(issues[0]!.message).toContain('165699.5');
    });

    it('accepts a stated figure within the currency quantum', () => {
      const d = clone(GOOD);
      d.accounts[0]!.statements[0]!.ending_balance = 165_699.504;
      d.accounts[0]!.statements[1]!.opening_balance = 165_699.504;
      expect(rsv(doc(d))).toEqual([]);
    });

    it('never nets a draw against the gross expenditure it funded', () => {
      // A draw reduces the account by exactly its amount. If the identity had
      // been written to "net" the draw against a capex row elsewhere, this
      // statement — which has no capex row anywhere — could not verify.
      const d = clone(GOOD);
      d.accounts[0]!.statements[0]!.movements = [
        { kind: 'contribution', amount: 1_000, date: '2026-04-01', label: 'Funded' },
        { kind: 'draw', amount: 1_000, date: '2026-04-02', label: 'Spent in full' },
      ];
      d.accounts[0]!.statements[0]!.ending_balance = 0;
      d.accounts[0]!.statements[1]!.opening_balance = 0;
      d.accounts[0]!.statements[1]!.movements = [];
      d.accounts[0]!.statements[1]!.ending_balance = 0;
      expect(rsv(doc(d))).toEqual([]);
    });
  });

  describe('RSV-06 / RSV-07 continuity', () => {
    it('refuses a consecutive statement that opens at a different balance', () => {
      const d = clone(GOOD);
      d.accounts[0]!.statements[1]!.opening_balance = 165_000;
      d.accounts[0]!.statements[1]!.ending_balance = 115_000;
      const issues = rsv(doc(d));
      expect(issues.map((i) => [i.code, i.field])).toEqual([['RSV-06', 'accounts[0].statements[1].opening_balance']]);
    });

    it('warns across a gap and makes no continuity claim', () => {
      const d = clone(GOOD);
      d.accounts[0]!.statements[1]!.period_start = '2026-07-02';
      d.accounts[0]!.statements[1]!.opening_balance = 165_000;
      d.accounts[0]!.statements[1]!.ending_balance = 115_000;
      const issues = rsv(doc(d));
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({ code: 'RSV-07', severity: 'warning', field: 'accounts[0].statements[1].period_start' });
      expect(issues[0]!.message).toMatch(/does not fill it/);
    });

    it('treats a leap day as the boundary it is', () => {
      const d = clone(GOOD);
      d.accounts[0]!.statements[0]!.period_start = '2028-02-01';
      d.accounts[0]!.statements[0]!.period_end = '2028-02-29';
      d.accounts[0]!.statements[0]!.movements = [];
      d.accounts[0]!.statements[0]!.ending_balance = 0;
      d.accounts[0]!.statements[1]!.period_start = '2028-03-01';
      d.accounts[0]!.statements[1]!.period_end = '2028-03-31';
      d.accounts[0]!.statements[1]!.opening_balance = 1; // consecutive, so this is RSV-06
      d.accounts[0]!.statements[1]!.movements = [];
      d.accounts[0]!.statements[1]!.ending_balance = 1;
      expect(rsv(doc(d)).map((i) => i.code)).toEqual(['RSV-06']);
    });
  });

  it('checks the section inside a full deal without touching other families', () => {
    const src = doc(GOOD, [
      '',
      '```json uw:section=sources_uses variant=base source=manual ts=2026-09-28T00:00:00Z v=1',
      JSON.stringify({ uses: { renovation: { budget: 1, contingency: 1, contingency_used: 2, drawn_to_date: 0, as_of_date: '2026-09-01' } } }),
      '```',
    ].join('\n'));
    const all = validateUWFile(parseUWFile(src)).issues;
    expect(all.filter((i) => i.code.startsWith('RSV-'))).toEqual([]);
    expect(all.some((i) => i.code === 'CAPX-02')).toBe(true);
  });
});
