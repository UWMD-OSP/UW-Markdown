// CF-01…CF-03 — the RFC 0034 cash-flow structural checks.
//
// Structure is validation, arithmetic is verification: these codes cover the
// date grammar, ordering, closed enums, and the stated-xirr sign-change
// precondition. The arithmetic lives in cash-flow-series.test.ts.

import { describe, expect, it } from 'vitest';
import { validateUWFile } from './validator.js';
import { parseUWFile } from './parser.js';

function doc(cashFlowJson: string, variant = 'base'): string {
  return `---
uw_version: "1.1"
deal_id: TEST-CF
asset_class: multifamily
---

\`\`\`json uw:section=property source=manual ts=2026-09-02T00:00:00Z v=1
{ "total_units": 48 }
\`\`\`

\`\`\`json uw:section=cash_flow_series variant=${variant} source=manual ts=2026-09-02T00:00:00Z v=1
${cashFlowJson}
\`\`\`
`;
}

const CLEAN = `{
  "day_count": "actual/365f",
  "series": [
    { "date": "2026-03-17", "amount": -14250000, "kind": "acquisition" },
    { "date": "2026-09-30", "amount": 412000 },
    { "date": "2031-03-17", "amount": 19800000, "kind": "disposition", "label": "Exit" }
  ],
  "stated_metrics": { "xirr": 0.062084 }
}`;

function cfIssues(content: string, variant?: string) {
  return validateUWFile(parseUWFile(doc(content, variant))).issues
    .filter((i) => i.code.startsWith('CF-'));
}

describe('a clean series', () => {
  it('emits no CF codes', () => {
    expect(cfIssues(CLEAN)).toEqual([]);
  });
  it('a document with no cash_flow_series emits no CF codes', () => {
    const issues = validateUWFile(parseUWFile(doc(CLEAN).replace(/```json uw:section=cash_flow_series[\s\S]*?```/, ''))).issues;
    expect(issues.filter((i) => i.code.startsWith('CF-'))).toEqual([]);
  });
});

describe('CF-01 — row grammar', () => {
  it('rejects a date that names no real day', () => {
    const issues = cfIssues(`{ "series": [ { "date": "2026-02-30", "amount": -1 } ] }`);
    expect(issues.map((i) => i.code)).toEqual(['CF-01']);
    expect(issues[0]!.field).toBe('series[0].date');
  });
  it('rejects a non-ISO date spelling', () => {
    expect(cfIssues(`{ "series": [ { "date": "03/17/2026", "amount": -1 } ] }`).map((i) => i.code)).toEqual(['CF-01']);
  });
  it('rejects a non-finite amount', () => {
    expect(cfIssues(`{ "series": [ { "date": "2026-03-17", "amount": "lots" } ] }`).map((i) => i.code)).toEqual(['CF-01']);
  });
  it('rejects an unknown day_count — closed enum, never a default', () => {
    const issues = cfIssues(`{ "day_count": "actual/365", "series": [ { "date": "2026-03-17", "amount": -1 } ] }`);
    expect(issues.map((i) => i.code)).toEqual(['CF-01']);
    expect(issues[0]!.field).toBe('day_count');
  });
  it('rejects an unknown kind', () => {
    const issues = cfIssues(`{ "series": [ { "date": "2026-03-17", "amount": -1, "kind": "misc" } ] }`);
    expect(issues.map((i) => i.code)).toEqual(['CF-01']);
    expect(issues[0]!.field).toBe('series[0].kind');
  });
  it('names the variant in the message', () => {
    const issues = cfIssues(`{ "series": [ { "date": "2026-02-30", "amount": -1 } ] }`, 'downside');
    expect(issues[0]!.message).toContain('variant "downside"');
  });
});

describe('CF-02 — ordering and presence', () => {
  it('rejects an empty or missing series', () => {
    expect(cfIssues(`{ "series": [] }`).map((i) => i.code)).toEqual(['CF-02']);
    expect(cfIssues('{}').map((i) => i.code)).toEqual(['CF-02']);
  });
  it('rejects descending dates', () => {
    const issues = cfIssues(`{ "series": [
      { "date": "2026-06-01", "amount": -1 },
      { "date": "2026-05-01", "amount": 1 }
    ] }`);
    expect(issues.map((i) => i.code)).toEqual(['CF-02']);
    expect(issues[0]!.field).toBe('series[1].date');
  });
  it('accepts same-day flows — ties are legal, not defects', () => {
    expect(cfIssues(`{ "series": [
      { "date": "2026-03-17", "amount": -100 },
      { "date": "2026-03-17", "amount": -50 },
      { "date": "2027-03-17", "amount": 200 }
    ] }`)).toEqual([]);
  });
  it('one diagnostic per defect: a bad date is not also reported as out of order', () => {
    const issues = cfIssues(`{ "series": [
      { "date": "2026-06-01", "amount": -1 },
      { "date": "not-a-date", "amount": 1 },
      { "date": "2026-07-01", "amount": 1 }
    ] }`);
    expect(issues.map((i) => i.code)).toEqual(['CF-01']);
  });
});

describe('CF-03 — a stated xirr needs a sign change', () => {
  it('rejects a stated xirr over all-positive flows', () => {
    const issues = cfIssues(`{
      "series": [ { "date": "2026-03-17", "amount": 100 }, { "date": "2027-03-17", "amount": 200 } ],
      "stated_metrics": { "xirr": 0.5 }
    }`);
    expect(issues.map((i) => i.code)).toEqual(['CF-03']);
  });
  it('does not fire when no xirr is stated', () => {
    expect(cfIssues(`{
      "series": [ { "date": "2026-03-17", "amount": 100 }, { "date": "2027-03-17", "amount": 200 } ],
      "stated_metrics": { "total_net": 300 }
    }`)).toEqual([]);
  });
});
