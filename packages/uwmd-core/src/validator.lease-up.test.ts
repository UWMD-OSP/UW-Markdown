// LU-01…LU-04 + CC-15 — the RFC 0008 lease-up structural checks.
//
// Structure is validation, arithmetic is verification: these codes cover the
// period grammar, contiguity, presence, and the tolerance-checked CC-15 seam
// to noi_model. The arithmetic lives in lease-up.test.ts.

import { describe, expect, it } from 'vitest';
import { validateUWFile } from './validator.js';
import { parseUWFile } from './parser.js';

function doc(leaseUpJson: string, opts: { variant?: string; rentRoll?: boolean; noi?: number | null } = {}): string {
  const { variant = 'base', rentRoll = true, noi = 480000 } = opts;
  return `---
uw_version: "1.1"
deal_id: TEST-LU
asset_class: office
---

\`\`\`json uw:section=property source=manual ts=2026-09-01T00:00:00Z v=1
{ "rentable_square_feet": 42500 }
\`\`\`
${rentRoll ? `
\`\`\`json uw:section=rent_roll source=manual ts=2026-09-01T00:00:00Z v=1
{ "total_units": 12, "occupied_units": 9 }
\`\`\`
` : ''}${noi !== null ? `
\`\`\`json uw:section=noi_model source=manual ts=2026-09-01T00:00:00Z v=1
{ "net_operating_income": ${noi} }
\`\`\`
` : ''}
\`\`\`json uw:section=lease_up_schedule variant=${variant} source=manual ts=2026-09-01T00:00:00Z v=1
${leaseUpJson}
\`\`\`
`;
}

const CLEAN = `{
  "model_type": "natural_turnover",
  "period_granularity": "quarterly",
  "stabilization_target": "2027-Q4",
  "schedule": [
    { "period": "2026-Q3", "occupied_sf": 31000 },
    { "period": "2026-Q4", "occupied_sf": 40500 }
  ],
  "stabilized_summary": { "annualized_noi": 478000 }
}`;

function luIssues(content: string, opts?: Parameters<typeof doc>[1]) {
  return validateUWFile(parseUWFile(doc(content, opts))).issues
    .filter((i) => i.code.startsWith('LU-') || i.code === 'CC-15');
}

describe('a clean schedule', () => {
  it('emits no LU or CC-15 codes', () => {
    expect(luIssues(CLEAN)).toEqual([]);
  });
});

describe('LU-01 — period grammar', () => {
  it('rejects a monthly-form period in a quarterly schedule', () => {
    const issues = luIssues(CLEAN.replace('"2026-Q4"', '"2026-11"'));
    expect(issues.map((i) => i.code)).toEqual(['LU-01']);
    expect(issues[0]!.severity).toBe('error');
  });

  it('rejects an invalid period_granularity', () => {
    const issues = luIssues(CLEAN.replace('"quarterly"', '"weekly"'));
    expect(issues.map((i) => i.code)).toContain('LU-01');
  });
});

describe('LU-02 — contiguity', () => {
  it('rejects a gapped schedule', () => {
    const issues = luIssues(CLEAN.replace('"2026-Q4"', '"2027-Q2"'));
    expect(issues.map((i) => i.code)).toEqual(['LU-02']);
  });

  it('rejects out-of-order periods', () => {
    const issues = luIssues(CLEAN.replace('"2026-Q3"', '"2027-Q1"'));
    expect(issues.map((i) => i.code)).toContain('LU-02');
  });
});

describe('LU-03 — presence and direction', () => {
  it('rejects an empty schedule', () => {
    const issues = luIssues(`{ "model_type": "absorption_curve", "period_granularity": "monthly", "schedule": [] }`);
    expect(issues.map((i) => i.code)).toEqual(['LU-03']);
  });

  it('rejects a stabilization_target earlier than the first period', () => {
    const issues = luIssues(CLEAN.replace('"2027-Q4"', '"2026-Q1"'));
    expect(issues.map((i) => i.code)).toEqual(['LU-03']);
  });
});

describe('LU-04 — turnover with no rent roll', () => {
  it('warns when natural_turnover has no rent_roll in the document', () => {
    const issues = luIssues(CLEAN, { rentRoll: false });
    expect(issues.map((i) => i.code)).toEqual(['LU-04']);
    expect(issues[0]!.severity).toBe('warning');
  });

  it('stays silent for an absorption_curve with no rent_roll', () => {
    const issues = luIssues(CLEAN.replace('"natural_turnover"', '"absorption_curve"'), { rentRoll: false });
    expect(issues).toEqual([]);
  });
});

describe('CC-15 — the tolerance-checked endpoint seam', () => {
  it('stays silent inside the 2% band', () => {
    // 478000 vs 480000 is ~0.42% drift.
    expect(luIssues(CLEAN)).toEqual([]);
  });

  it('warns beyond the band, on the base variant', () => {
    const issues = luIssues(CLEAN.replace('478000', '420000'));
    expect(issues.map((i) => i.code)).toEqual(['CC-15']);
    expect(issues[0]!.severity).toBe('warning');
  });

  it('exempts non-base variants — a downside is supposed to disagree', () => {
    const issues = luIssues(CLEAN.replace('478000', '300000'), { variant: 'downside' });
    expect(issues).toEqual([]);
  });

  it('stays silent when noi_model is absent — no seam to check', () => {
    const issues = luIssues(CLEAN.replace('478000', '300000'), { noi: null });
    expect(issues).toEqual([]);
  });
});
