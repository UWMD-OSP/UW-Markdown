// REC-01…REC-10 — expense recoveries and the CAM true-up (RFC 0058, §4.3).
//
// The reference tenant is deliberately arithmetic-friendly: a 4.12% share of a
// $2,216,000 pool is $91,299.20, billed at $84,000, leaving a $7,299.20
// receivable. Every expected figure below is exact decimal arithmetic on those
// numbers, not a value read back out of the validator.

import { describe, expect, it } from 'vitest';
import { parseUWFile } from './parser.js';
import { validateUWFile } from './validator.js';

const TERMS = `"recovery_terms": {
        "method": "net",
        "pro_rata_share": 0.0412,
        "share_basis": "nra",
        "recoverable_pool": ["real_estate_taxes", "insurance", "contract_services"],
        "cap": { "pct": 0.05, "over": "base_year", "accumulation": "cumulative" }
      }`;

const TRUE_UP = `"recovery_true_up": [
        {
          "period_start": "2025-01-01",
          "period_end": "2025-12-31",
          "pool_actual": 2216000.0,
          "tenant_share_uncapped": 91299.2,
          "tenant_share_capped": 91299.2,
          "estimated_billed": 84000.0,
          "true_up_amount": 7299.2,
          "settlement": "billed"
        }
      ]`;

function doc(tenantBody: string, asOf = '2026-06-30'): string {
  return `---
uw_version: "1.1"
deal_id: TEST-REC
asset_class: office
---

\`\`\`json uw:section=rent_roll source=manual ts=2026-09-16T00:00:00Z v=1
{
  "as_of_date": "${asOf}",
  "tenants": [
    {
      "tenant_name": "Acme Corp",
      "nra_sqft": 12400,
      "lease_type": "nnn"${tenantBody ? `,\n      ${tenantBody}` : ''}
    }
  ]
}
\`\`\`
`;
}

const codes = (source: string) =>
  validateUWFile(parseUWFile(source)).issues.map((i) => i.code).filter((c) => c.startsWith('REC-'));

describe('RFC 0058 — a clean recovery record', () => {
  it('raises nothing on well-formed terms and a settled true-up', () => {
    expect(codes(doc(`${TERMS},\n      ${TRUE_UP}`))).toEqual([]);
  });

  it('raises nothing when a tenant states no recovery at all', () => {
    expect(codes(doc(''))).toEqual([]);
  });

  it('leaves the legacy cam_cap_pct alone when no typed cap contradicts it', () => {
    expect(codes(doc('"cam_cap_pct": 0.05'))).toEqual([]);
  });
});

describe('REC-01 — the share is a fraction', () => {
  it('refuses a share stated as a percent', () => {
    // 4.12 rather than 0.0412 multiplies every recovery by a hundred.
    expect(codes(doc('"recovery_terms": { "method": "net", "pro_rata_share": 4.12 }'))).toContain('REC-01');
  });

  it('refuses a zero or negative share', () => {
    for (const bad of ['0', '-0.04']) {
      expect(codes(doc(`"recovery_terms": { "method": "net", "pro_rata_share": ${bad} }`))).toContain('REC-01');
    }
  });

  it('accepts a whole-building share of exactly 1.0', () => {
    expect(codes(doc('"recovery_terms": { "method": "net", "pro_rata_share": 1.0 }'))).toEqual([]);
  });

  it('refuses a cap percent stated as a percent', () => {
    expect(codes(doc('"recovery_terms": { "method": "net", "cap": { "pct": 5, "accumulation": "cumulative" } }'))).toContain('REC-01');
  });
});

describe('REC-02 — a method carries its input, and a cap declares its accumulation', () => {
  it('refuses a method outside the closed vocabulary', () => {
    expect(codes(doc('"recovery_terms": { "method": "whatever_we_agreed" }'))).toContain('REC-02');
  });

  it('refuses each method that is missing its required input', () => {
    for (const method of ['base_year_stop', 'fixed_stop', 'fixed_amount']) {
      expect(codes(doc(`"recovery_terms": { "method": "${method}" }`))).toContain('REC-02');
    }
  });

  it('accepts each method once its input is present', () => {
    for (const [method, field, value] of [
      ['base_year_stop', 'base_year', '2024'],
      ['fixed_stop', 'expense_stop_per_sqft', '8.75'],
      ['fixed_amount', 'fixed_recovery_annual', '42000'],
    ] as const) {
      expect(codes(doc(`"recovery_terms": { "method": "${method}", "${field}": ${value} }`))).toEqual([]);
    }
  });

  it('refuses a stated cap percent with no accumulation — there is no default', () => {
    // Cumulative, non-cumulative and compounding diverge materially inside
    // three years; choosing one silently is how two readers disagree.
    expect(codes(doc('"recovery_terms": { "method": "net", "cap": { "pct": 0.05 } }'))).toContain('REC-02');
  });

  it('accepts each accumulation treatment', () => {
    for (const acc of ['cumulative', 'non_cumulative', 'compounding']) {
      expect(codes(doc(`"recovery_terms": { "method": "net", "cap": { "pct": 0.05, "accumulation": "${acc}" } }`))).toEqual([]);
    }
  });
});

describe('REC-03 — the pool names real operating-statement keys', () => {
  it('refuses a key no §4.4 expense line carries', () => {
    expect(codes(doc('"recovery_terms": { "method": "net", "recoverable_pool": ["janitorial"] }'))).toContain('REC-03');
  });

  it('refuses the total and the capital lines, which are not recoverable members', () => {
    for (const key of ['total_operating_expenses', 'replacement_reserves', 'capital_expenditures_actual', 'management_fee_pct_egi']) {
      expect(codes(doc(`"recovery_terms": { "method": "net", "recoverable_pool": ["${key}"] }`))).toContain('REC-03');
    }
  });

  it('refuses an empty pool', () => {
    expect(codes(doc('"recovery_terms": { "method": "net", "recoverable_pool": [] }'))).toContain('REC-03');
  });
});

describe('REC-04 / REC-05 — the period is well formed and closed', () => {
  const withRow = (row: string, asOf = '2026-06-30') =>
    doc(`"recovery_terms": { "method": "net", "pro_rata_share": 0.0412 },\n      "recovery_true_up": [${row}]`, asOf);

  it('refuses a period that ends before it starts', () => {
    expect(codes(withRow('{ "period_start": "2025-12-31", "period_end": "2025-01-01" }'))).toContain('REC-04');
  });

  it('refuses a malformed date', () => {
    expect(codes(withRow('{ "period_start": "2025-01", "period_end": "2025-12-31" }'))).toContain('REC-04');
  });

  it('refuses a settlement outside the closed vocabulary', () => {
    expect(codes(withRow('{ "period_start": "2025-01-01", "period_end": "2025-12-31", "settlement": "pending" }'))).toContain('REC-04');
  });

  it('refuses a period that has not closed as of the rent roll date', () => {
    // A reconciliation of an open period is a forecast.
    expect(codes(withRow('{ "period_start": "2026-01-01", "period_end": "2026-12-31" }'))).toContain('REC-05');
  });

  it('refuses a period ending exactly on the as-of date — the year is not yet shut', () => {
    expect(codes(withRow('{ "period_start": "2025-07-01", "period_end": "2026-06-30" }'))).toContain('REC-05');
  });

  it('skips the closed-period check when the rent roll states no as-of date', () => {
    const source = doc(
      '"recovery_terms": { "method": "net" },\n      "recovery_true_up": [{ "period_start": "2030-01-01", "period_end": "2030-12-31" }]',
    ).replace('"as_of_date": "2026-06-30",\n  ', '');
    expect(codes(source)).not.toContain('REC-05');
  });
});

describe('REC-06 / REC-07 / REC-08 — the arithmetic a single document can check', () => {
  const withRow = (row: string) =>
    doc(`"recovery_terms": { "method": "net", "pro_rata_share": 0.0412 },\n      "recovery_true_up": [${row}]`);

  const PERIOD = '"period_start": "2025-01-01", "period_end": "2025-12-31"';

  it('verifies the share of the pool', () => {
    expect(codes(withRow(`{ ${PERIOD}, "pool_actual": 2216000.0, "tenant_share_uncapped": 91299.2 }`))).toEqual([]);
  });

  it('REC-06 refuses a share that disagrees with pool x pro_rata_share', () => {
    expect(codes(withRow(`{ ${PERIOD}, "pool_actual": 2216000.0, "tenant_share_uncapped": 95000.0 }`))).toContain('REC-06');
  });

  it('REC-07 refuses a capped amount above the uncapped one — a cap cannot increase a recovery', () => {
    expect(codes(withRow(`{ ${PERIOD}, "tenant_share_uncapped": 91299.2, "tenant_share_capped": 94000.0 }`))).toContain('REC-07');
  });

  it('accepts a cap that genuinely reduces, without recomputing the cap itself', () => {
    // The capped figure is stated, not derived: a cumulative cap depends on a
    // base-year history this document does not carry.
    expect(codes(withRow(`{ ${PERIOD}, "tenant_share_uncapped": 91299.2, "tenant_share_capped": 88000.0, "estimated_billed": 84000.0, "true_up_amount": 4000.0 }`))).toEqual([]);
  });

  it('REC-08 refuses a true-up that is not capped share less billed', () => {
    expect(codes(withRow(`{ ${PERIOD}, "tenant_share_capped": 91299.2, "estimated_billed": 84000.0, "true_up_amount": 8000.0 }`))).toContain('REC-08');
  });

  it('accepts a negative true-up — the tenant overpaid and is owed a credit', () => {
    expect(codes(withRow(`{ ${PERIOD}, "tenant_share_capped": 80000.0, "estimated_billed": 84000.0, "true_up_amount": -4000.0, "settlement": "credited" }`))).toEqual([]);
  });

  it('checks nothing it was not given: a row with no figures raises only period rules', () => {
    expect(codes(withRow(`{ ${PERIOD} }`))).toEqual([]);
  });
});

describe('REC-10 — the legacy cap field', () => {
  it('warns, rather than refuses, when cam_cap_pct sits beside a typed cap', () => {
    const source = doc(`"cam_cap_pct": 0.05,\n      "recovery_terms": { "method": "net", "cap": { "pct": 0.04, "accumulation": "cumulative" } }`);
    const issues = validateUWFile(parseUWFile(source)).issues;
    const rec10 = issues.find((i) => i.code === 'REC-10');
    expect(rec10).toBeDefined();
    expect(rec10!.severity).toBe('warning');
  });
});
