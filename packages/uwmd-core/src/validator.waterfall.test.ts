// WF-01…WF-03 — the RFC 0035 (+ RFC 0036 hurdle grammar) waterfall structural checks.
//
// Structure is validation, arithmetic is verification: these codes cover the
// ladder grammar, the cash reference, and the capital precondition. The
// allocation arithmetic lives in waterfall.test.ts.

import { describe, expect, it } from 'vitest';
import { validateUWFile } from './validator.js';
import { parseUWFile } from './parser.js';

function doc(waterfallJson: string, opts: { series?: string | null; variant?: string } = {}): string {
  const { variant = 'base' } = opts;
  const series = opts.series === null ? '' : `
\`\`\`json uw:section=cash_flow_series variant=base source=manual ts=2026-09-02T00:00:00Z v=1
${opts.series ?? `{
  "series": [
    { "date": "2026-01-01", "amount": -1000000 },
    { "date": "2028-01-01", "amount": 2000000 }
  ]
}`}
\`\`\`
`;
  return `---
uw_version: "1.1"
deal_id: TEST-WF
asset_class: multifamily
---
${series}
\`\`\`json uw:section=distribution_waterfall variant=${variant} source=manual ts=2026-09-02T00:00:00Z v=1
${waterfallJson}
\`\`\`
`;
}

const CLEAN = `{
  "cash_flow_ref": { "variant": "base" },
  "equity_split": { "lp": 0.9, "gp": 0.1 },
  "tiers": [
    { "type": "return_of_capital" },
    { "type": "preferred_return", "rate": 0.08, "accrual": "simple" },
    { "type": "catch_up", "gp_share": 1.0, "target_promote": 0.2 },
    { "type": "split", "lp_share": 0.8, "gp_share": 0.2, "until_lp_em": 1.5 },
    { "type": "split", "lp_share": 0.7, "gp_share": 0.3 }
  ]
}`;

function wfIssues(content: string, opts?: Parameters<typeof doc>[1]) {
  return validateUWFile(parseUWFile(doc(content, opts))).issues
    .filter((i) => i.code.startsWith('WF-'));
}

describe('a clean waterfall', () => {
  it('emits no WF codes', () => {
    expect(wfIssues(CLEAN)).toEqual([]);
  });
});

describe('WF-01 — ladder grammar', () => {
  it('rejects an unknown tier type', () => {
    const issues = wfIssues(CLEAN.replace('"return_of_capital"', '"waterfall_promote"'));
    expect(issues.map((i) => i.code)).toContain('WF-01');
  });
  it('rejects an out-of-order ladder', () => {
    const issues = wfIssues(`{
      "cash_flow_ref": { "variant": "base" },
      "equity_split": { "lp": 0.9, "gp": 0.1 },
      "tiers": [
        { "type": "preferred_return", "rate": 0.08, "accrual": "simple" },
        { "type": "return_of_capital" },
        { "type": "split", "lp_share": 0.8, "gp_share": 0.2 }
      ]
    }`);
    expect(issues.map((i) => i.code)).toEqual(['WF-01']);
  });
  it('rejects a duplicated singleton tier', () => {
    const issues = wfIssues(`{
      "cash_flow_ref": { "variant": "base" },
      "equity_split": { "lp": 0.9, "gp": 0.1 },
      "tiers": [
        { "type": "return_of_capital" },
        { "type": "return_of_capital" },
        { "type": "split", "lp_share": 0.8, "gp_share": 0.2 }
      ]
    }`);
    expect(issues.map((i) => i.code)).toEqual(['WF-01']);
  });
  it('rejects a capped final split — the ladder needs a terminal residual tier', () => {
    const issues = wfIssues(`{
      "cash_flow_ref": { "variant": "base" },
      "equity_split": { "lp": 0.9, "gp": 0.1 },
      "tiers": [ { "type": "split", "lp_share": 0.8, "gp_share": 0.2, "until_lp_em": 1.5 } ]
    }`);
    expect(issues.map((i) => i.code)).toEqual(['WF-01']);
  });
  it('rejects a ladder with no split at all', () => {
    const issues = wfIssues(`{
      "cash_flow_ref": { "variant": "base" },
      "equity_split": { "lp": 0.9, "gp": 0.1 },
      "tiers": [ { "type": "return_of_capital" } ]
    }`);
    expect(issues.map((i) => i.code)).toEqual(['WF-01']);
  });
  it('rejects a catch_up whose gp_share does not exceed target_promote', () => {
    const issues = wfIssues(CLEAN.replace('"gp_share": 1.0, "target_promote": 0.2', '"gp_share": 0.2, "target_promote": 0.2'));
    expect(issues.map((i) => i.code)).toEqual(['WF-01']);
  });
  it('rejects splits and equity_split that do not sum to 1.0', () => {
    expect(wfIssues(CLEAN.replace('"lp": 0.9, "gp": 0.1', '"lp": 0.9, "gp": 0.2')).map((i) => i.code)).toEqual(['WF-01']);
    expect(wfIssues(CLEAN.replace('"lp_share": 0.7, "gp_share": 0.3', '"lp_share": 0.7, "gp_share": 0.4')).map((i) => i.code)).toEqual(['WF-01']);
  });
  // ── RFC 0036: until_lp_irr ─────────────────────────────────────────────
  it('accepts until_lp_irr in (0, 1) — the RFC 0035 reservation is gone', () => {
    expect(wfIssues(CLEAN.replace('"until_lp_em": 1.5', '"until_lp_irr": 0.12'))).toEqual([]);
    expect(wfIssues(CLEAN.replace('"until_lp_em": 1.5', '"until_lp_em": 1.5, "until_lp_irr": 0.12'))).toEqual([]);
    expect(wfIssues(CLEAN.replace('"until_lp_em": 1.5', '"until_lp_irr": null'))).toEqual([]);
  });
  it('rejects until_lp_irr outside (0, 1), anchored to the field', () => {
    for (const bad of ['1.2', '0', '1', '-0.1', '"12%"', 'true']) {
      const issues = wfIssues(CLEAN.replace('"until_lp_em": 1.5', `"until_lp_irr": ${bad}`));
      expect(issues.map((i) => i.code), bad).toEqual(['WF-01']);
      expect(issues[0]!.field).toBe('tiers[3].until_lp_irr');
    }
  });
  it('rejects an IRR-capped split that pays the LP nothing', () => {
    const issues = wfIssues(CLEAN.replace(
      '"lp_share": 0.8, "gp_share": 0.2, "until_lp_em": 1.5',
      '"lp_share": 0, "gp_share": 1, "until_lp_irr": 0.12',
    ));
    expect(issues.map((i) => i.code)).toEqual(['WF-01']);
    expect(issues[0]!.field).toBe('tiers[3].lp_share');
  });
  it('rejects an IRR-capped final split', () => {
    const issues = wfIssues(`{
      "cash_flow_ref": { "variant": "base" },
      "equity_split": { "lp": 0.9, "gp": 0.1 },
      "tiers": [ { "type": "split", "lp_share": 0.8, "gp_share": 0.2, "until_lp_irr": 0.12 } ]
    }`);
    expect(issues.map((i) => i.code)).toEqual(['WF-01']);
    expect(issues[0]!.field).toBe('tiers[0].until_lp_irr');
  });
  it('rejects a non-increasing until_lp_irr ladder at the offending tier', () => {
    const ladder = (a: string, b: string) => `{
      "cash_flow_ref": { "variant": "base" },
      "equity_split": { "lp": 0.9, "gp": 0.1 },
      "tiers": [
        { "type": "return_of_capital" },
        { "type": "split", "lp_share": 0.8, "gp_share": 0.2, "until_lp_irr": ${a} },
        { "type": "split", "lp_share": 0.7, "gp_share": 0.3, "until_lp_irr": ${b} },
        { "type": "split", "lp_share": 0.6, "gp_share": 0.4 }
      ]
    }`;
    expect(wfIssues(ladder('0.12', '0.15'))).toEqual([]);
    for (const [a, b] of [['0.15', '0.12'], ['0.12', '0.12'], ['0.12', '0.1200000001']]) {
      const issues = wfIssues(ladder(a, b));
      expect(issues.map((i) => i.code), `${a} → ${b}`).toEqual(['WF-01']);
      expect(issues[0]!.field).toBe('tiers[2].until_lp_irr');
    }
  });
  it('rejects a non-increasing until_lp_em ladder at the offending tier', () => {
    const ladder = (a: string, b: string) => `{
      "cash_flow_ref": { "variant": "base" },
      "equity_split": { "lp": 0.9, "gp": 0.1 },
      "tiers": [
        { "type": "return_of_capital" },
        { "type": "split", "lp_share": 0.8, "gp_share": 0.2, "until_lp_em": ${a} },
        { "type": "split", "lp_share": 0.7, "gp_share": 0.3, "until_lp_em": ${b} },
        { "type": "split", "lp_share": 0.6, "gp_share": 0.4 }
      ]
    }`;
    expect(wfIssues(ladder('1.5', '2.0'))).toEqual([]);
    for (const [a, b] of [['2.0', '1.5'], ['1.5', '1.5'], ['1.5', '1.50001']]) {
      const issues = wfIssues(ladder(a, b));
      expect(issues.map((i) => i.code), `${a} → ${b}`).toEqual(['WF-01']);
      expect(issues[0]!.field).toBe('tiers[2].until_lp_em');
    }
  });
  it('the two hurdle kinds ladder independently — an IRR after an EM tier is not compared across kinds', () => {
    expect(wfIssues(`{
      "cash_flow_ref": { "variant": "base" },
      "equity_split": { "lp": 0.9, "gp": 0.1 },
      "tiers": [
        { "type": "return_of_capital" },
        { "type": "split", "lp_share": 0.8, "gp_share": 0.2, "until_lp_em": 1.5 },
        { "type": "split", "lp_share": 0.7, "gp_share": 0.3, "until_lp_irr": 0.12 },
        { "type": "split", "lp_share": 0.65, "gp_share": 0.35, "until_lp_em": 2.0, "until_lp_irr": 0.15 },
        { "type": "split", "lp_share": 0.6, "gp_share": 0.4 }
      ]
    }`)).toEqual([]);
  });
  it('names the variant in the message', () => {
    const issues = wfIssues(CLEAN.replace('"rate": 0.08', '"rate": 8'), { variant: 'downside' });
    expect(issues[0]!.message).toContain('variant "downside"');
  });
});

describe('WF-02 — the cash reference', () => {
  it('rejects a ref to a variant the document does not carry', () => {
    const issues = wfIssues(CLEAN.replace('{ "variant": "base" }', '{ "variant": "upside" }'));
    expect(issues.map((i) => i.code)).toEqual(['WF-02']);
  });
  it('rejects a waterfall with no cash_flow_series in the document at all', () => {
    const issues = wfIssues(CLEAN, { series: null });
    expect(issues.map((i) => i.code)).toEqual(['WF-02']);
  });
});

describe('WF-03 — a waterfall needs capital', () => {
  it('rejects a referenced series with no contribution', () => {
    const issues = wfIssues(CLEAN, {
      series: `{ "series": [ { "date": "2026-01-01", "amount": 500000 } ] }`,
    });
    expect(issues.map((i) => i.code)).toEqual(['WF-03']);
  });
});
