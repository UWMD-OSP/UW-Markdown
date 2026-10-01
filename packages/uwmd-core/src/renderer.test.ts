// Renderer tests - verifies public render() output contracts.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseUWFile } from './parser.js';
import { render, UnsupportedRenderFormatError } from './renderer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = resolve(
  __dirname,
  '../../../conformance/tier-1-reader/fixtures/01-minimal-screening.uwx.md',
);

function loadFixture() {
  return parseUWFile(readFileSync(FIXTURE_PATH, 'utf-8'));
}

describe('render', () => {
  it('renders json without superseded history by default', () => {
    const parsed = parseUWFile(`---
uw_version: "1.1"
deal_id: "uw_2026_RENDER"
deal_name: "Renderer Fixture"
created: "2026-01-01T00:00:00Z"
last_modified: "2026-01-02T00:00:00Z"
property_address: "1 Render Way"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
---

\`\`\`json uw:section=property source=manual ts=2026-01-01T00:00:00Z v=1 superseded=true confidence=medium
{ "_meta": { "section": "property", "version": 1, "superseded": true, "source": "manual", "agent_id": null, "agent_version": null, "actor": "user", "timestamp": "2026-01-01T00:00:00Z", "confidence": "medium", "human_review_required": false, "flags": [], "input_hash": null, "notes": null }, "total_units": 12 }
\`\`\`

\`\`\`json uw:section=property source=manual ts=2026-01-02T00:00:00Z v=2 confidence=high
{ "_meta": { "section": "property", "version": 2, "superseded": false, "source": "manual", "agent_id": null, "agent_version": null, "actor": "user", "timestamp": "2026-01-02T00:00:00Z", "confidence": "high", "human_review_required": false, "flags": [], "input_hash": null, "notes": null }, "total_units": 24 }
\`\`\`
`);

    const output = JSON.parse(render(parsed, { format: 'json' }).content);

    expect(output.frontmatter.deal_id).toBe('uw_2026_RENDER');
    expect(output.sections.property.total_units).toBe(24);
    expect(output.superseded).toBeUndefined();
  });

  it('renders superseded history when requested for json', () => {
    const parsed = parseUWFile(`---
uw_version: "1.1"
deal_id: "uw_2026_RENDER"
deal_name: "Renderer Fixture"
created: "2026-01-01T00:00:00Z"
last_modified: "2026-01-02T00:00:00Z"
property_address: "1 Render Way"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
---

\`\`\`json uw:section=property source=manual ts=2026-01-01T00:00:00Z v=1 superseded=true confidence=medium
{ "_meta": { "section": "property", "version": 1, "superseded": true, "source": "manual", "agent_id": null, "agent_version": null, "actor": "user", "timestamp": "2026-01-01T00:00:00Z", "confidence": "medium", "human_review_required": false, "flags": [], "input_hash": null, "notes": null }, "total_units": 12 }
\`\`\`

\`\`\`json uw:section=property source=manual ts=2026-01-02T00:00:00Z v=2 confidence=high
{ "_meta": { "section": "property", "version": 2, "superseded": false, "source": "manual", "agent_id": null, "agent_version": null, "actor": "user", "timestamp": "2026-01-02T00:00:00Z", "confidence": "high", "human_review_required": false, "flags": [], "input_hash": null, "notes": null }, "total_units": 24 }
\`\`\`
`);

    const output = JSON.parse(render(parsed, { format: 'json', includeSuperseded: true }).content);

    expect(output.superseded.property).toHaveLength(1);
    expect(output.superseded.property[0].total_units).toBe(12);
  });

  it('renders csv with raw numeric cells and percent values scaled to display units', () => {
    const parsed = loadFixture();
    const result = render(parsed, { format: 'csv' });
    const [headerLine, rowLine] = result.content.split('\n');

    expect(result.format).toBe('csv');
    expect(headerLine).toContain('deal_id,deal_name,address');
    expect(rowLine).toContain('TEST-MIN-001,"Minimal Screening Fixture","100 Test Lane"');
    expect(rowLine).toContain('10000000,7500000,2500000,600000,1.25,75.0000');
  });

  it('renders a markdown summary with validation and readiness sections', () => {
    const parsed = loadFixture();
    const result = render(parsed, { format: 'summary' });

    expect(result.format).toBe('summary');
    expect(result.content).toContain('# Minimal Screening Fixture');
    expect(result.content).toContain('| Purchase Price | $10,000,000 |');
    expect(result.content).toContain('## Validation');
    expect(result.content).toContain('## Stage Readiness');
    expect(result.estimatedTokens).toBeGreaterThan(0);
  });

  it('renders chat output and truncates when the token budget is exceeded', () => {
    const parsed = loadFixture();
    const result = render(parsed, { format: 'chat', maxTokens: 40 });

    expect(result.format).toBe('chat');
    expect(result.truncated).toBe(true);
    expect(result.content).toContain('[TRUNCATED');
    expect(result.estimatedTokens).toBeGreaterThan(40);
  });

  it('fails explicitly for formats that require dedicated pipelines', () => {
    const parsed = loadFixture();

    for (const format of ['pdf', 'docx'] as const) {
      expect(() => render(parsed, { format })).toThrowError(UnsupportedRenderFormatError);

      try {
        render(parsed, { format });
      } catch (error) {
        expect(error).toMatchObject({ code: 'UNSUPPORTED_RENDER_FORMAT', format });
      }
    }
  });
});

// ─── RFC 0027 — the class's own size in every read model ─────────────────────

const officeDoc = `---
uw_version: "1.1"
deal_id: "uw_2026_OFFICE"
deal_name: "Office Size Fixture"
created: "2026-08-25T00:00:00Z"
last_modified: "2026-08-25T00:00:00Z"
property_address: "42 Camelback Rd"
city: "Phoenix"
state: "AZ"
zip: "85012"
asset_class: office
---

\`\`\`json uw:section=property source=manual ts=2026-08-25T00:00:00Z v=1 confidence=high
{ "_meta": { "section": "property", "version": 1, "superseded": false, "source": "manual", "agent_id": null, "agent_version": null, "actor": "user", "timestamp": "2026-08-25T00:00:00Z", "confidence": "high", "human_review_required": false, "flags": [], "input_hash": null, "notes": null }, "rentable_square_feet": 42500, "year_built": 1998 }
\`\`\`
`;

describe('render — size intensives (RFC 0027)', () => {
  it('csv appends size_basis/size_quantity and keeps total_units in place', () => {
    const parsed = parseUWFile(officeDoc);
    const [headerLine, rowLine] = render(parsed, { format: 'csv' }).content.split('\n');

    expect(headerLine!.endsWith('recommendation,size_basis,size_quantity')).toBe(true);
    expect(rowLine!.endsWith(',rentable_square_feet,42500')).toBe(true);
    // total_units keeps its column, empty for a class that has none
    const headers = headerLine!.split(',');
    const cells = rowLine!.split(',');
    expect(cells[headers.indexOf('total_units')]).toBe('');
  });

  it('csv states the multifamily size as total_units, value unchanged', () => {
    const parsed = parseUWFile(officeDoc.replace('asset_class: office', 'asset_class: multifamily')
      .replace('"rentable_square_feet": 42500', '"total_units": 48'));
    const [headerLine, rowLine] = render(parsed, { format: 'csv' }).content.split('\n');
    const headers = headerLine!.split(',');
    const cells = rowLine!.split(',');
    expect(cells[headers.indexOf('size_basis')]).toBe('total_units');
    expect(cells[headers.indexOf('size_quantity')]).toBe(cells[headers.indexOf('total_units')]);
  });

  it('summary header states a non-multifamily class\'s size', () => {
    const content = render(parseUWFile(officeDoc), { format: 'summary' }).content;
    expect(content).toContain('· 42,500 RSF');
  });

  it('chat property block states a non-multifamily class\'s size', () => {
    const content = render(parseUWFile(officeDoc), { format: 'chat' }).content;
    expect(content).toContain('Size: 42,500 RSF (rentable_square_feet)');
  });

  it('no drift: multifamily summary and chat carry no separate size term', () => {
    // Multifamily's primary is total_units, which these renderings already
    // state — RFC 0027 must not change a single multifamily byte.
    const parsed = loadFixture();
    const summary = render(parsed, { format: 'summary' }).content;
    const chat = render(parsed, { format: 'chat' }).content;
    expect(summary).not.toContain('RSF');
    expect(summary).not.toMatch(/·\s+\d[\d,]*\s+Units/);
    expect(chat).not.toContain('Size:');
  });
});

// ─── Format §4.5 — the chat NOI block reads the stated paths ─────────────────
//
// §4.5 places the NOI lines under `income` / `expenses` and states each money
// line as `{ value, ... }`. The chat block read top-level keys that no §4.5
// document carries, so a fully stated model rendered GPR, EGI and OpEx as n/a.

function noiDoc(content: Record<string, unknown>): string {
  const meta = '"_meta": { "section": "noi_model", "version": 1, "superseded": false, "source": "manual", "agent_id": null, "agent_version": null, "actor": "user", "timestamp": "2026-10-01T00:00:00Z", "confidence": "high", "human_review_required": false, "flags": [], "input_hash": null, "notes": null }';
  return `---
uw_version: "1.1"
deal_id: "uw_2026_NOI"
deal_name: "NOI Read Fixture"
created: "2026-10-01T00:00:00Z"
last_modified: "2026-10-01T00:00:00Z"
property_address: "45 Spec Way"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
---

\`\`\`json uw:section=noi_model source=manual ts=2026-10-01T00:00:00Z v=1 confidence=high
{ ${meta}, ${JSON.stringify(content).slice(1, -1)} }
\`\`\`
`;
}

/** The chat NOI block's lines, heading excluded. */
function chatNoiLines(parsed: ReturnType<typeof parseUWFile>): string[] {
  const content = render(parsed, { format: 'chat' }).content;
  const start = content.indexOf('## NOI MODEL');
  expect(start, 'NOI block present').toBeGreaterThanOrEqual(0);
  return content.slice(start).split('\n\n')[0]!.split('\n').slice(1);
}

/** A §4.5-shaped model. Every figure is stated; the renderer derives none. */
const SPEC_NOI = {
  underwriting_basis: 'stabilized',
  income: {
    gross_potential_rent: { value: 1000000, source: 'rent_roll', per_unit_monthly: null, per_sqft_annually: null, rationale: null },
    vacancy_credit_loss: { value: 50000, rate_applied: 0.05, source: 'underwritten', vs_t12_actual: null, vs_submarket_avg: null, rationale: null },
    concessions: { value: 0, rationale: null },
    loss_to_lease: { value: 0, rationale: null },
    other_income: { value: 20000, vs_t12: null, non_recurring_excluded: null, breakdown: {} },
    effective_gross_income: 970000,
  },
  expenses: {
    real_estate_taxes: { value: 150000, per_unit: null, source: 'actual' },
    total_operating_expenses: 400000,
    expense_ratio: 0.4124,
  },
  net_operating_income: 570000,
};

describe('render — chat NOI block reads Format §4.5 paths', () => {
  it('renders GPR, vacancy, other income, EGI, OpEx, NOI and the ratio from their §4.5 paths', () => {
    expect(chatNoiLines(parseUWFile(noiDoc(SPEC_NOI)))).toEqual([
      'GPR: $1,000,000',
      'Vacancy Loss: $50,000 (5.00%)',
      'Other Income: $20,000',
      'EGI: $970,000',
      'Total OpEx: $400,000',
      'NOI: $570,000',
      'OpEx Ratio: 0.4124',
    ]);
  });

  it('renders a structured money line as its numeric value, never the object', () => {
    const lines = chatNoiLines(parseUWFile(noiDoc(SPEC_NOI)));
    for (const prefix of ['GPR:', 'Vacancy Loss:', 'Other Income:']) {
      const line = lines.find((l) => l.startsWith(prefix))!;
      expect(line, prefix).not.toContain('[object Object]');
      expect(line, prefix).not.toMatch(/: n\/a/);
    }
  });

  it('renders the tier-1 §4.5 conformance fixture with its stated figures', () => {
    const parsed = parseUWFile(readFileSync(
      resolve(__dirname, '../../../conformance/tier-1-reader/fixtures/02-full-multifamily.uwx.md'),
      'utf-8',
    ));
    expect(chatNoiLines(parsed)).toEqual([
      'GPR: $655,200',
      'Vacancy Loss: $45,864 (7.00%)',
      'Other Income: $21,600',
      'EGI: $630,936',
      'Total OpEx: $234,301',
      'NOI: $396,635',
      'OpEx Ratio: 0.3713',
    ]);
  });

  it('derives no ratio from §4.5 totals: an unstated expense_ratio renders n/a', () => {
    const { expense_ratio: _omitted, ...expenses } = SPEC_NOI.expenses;
    const lines = chatNoiLines(parseUWFile(noiDoc({ ...SPEC_NOI, expenses })));
    expect(lines).toContain('EGI: $970,000');
    expect(lines).toContain('Total OpEx: $400,000');
    expect(lines).toContain('OpEx Ratio: n/a');
  });

  it('reads a bare number stated at a §4.5 object path as stated', () => {
    const income = { ...SPEC_NOI.income, other_income: 20000 };
    expect(chatNoiLines(parseUWFile(noiDoc({ ...SPEC_NOI, income })))).toContain('Other Income: $20,000');
  });
});

// Compatibility only: the top-level keys the chat block read before it
// followed §4.5. They are consulted only when the §4.5 path is absent.

const LEGACY_NOI = {
  gross_potential_rent: 800000,
  vacancy_loss: 40000,
  vacancy_rate: 0.05,
  other_income: 10000,
  effective_gross_income: 770000,
  total_operating_expenses: 300000,
  net_operating_income: 470000,
};

describe('render — chat NOI legacy top-level fallback (compatibility only)', () => {
  it('a document with only legacy top-level keys renders exactly as before', () => {
    // These are the bytes the pre-§4.5 renderer produced for this block,
    // including its own legacy ratio division.
    expect(chatNoiLines(parseUWFile(noiDoc(LEGACY_NOI)))).toEqual([
      'GPR: $800,000',
      'Vacancy Loss: $40,000 (5.00%)',
      'Other Income: $10,000',
      'EGI: $770,000',
      'Total OpEx: $300,000',
      'NOI: $470,000',
      'OpEx Ratio: 0.3896',
    ]);
  });

  it('keeps scheduled_gross_revenue as the last legacy GPR key', () => {
    const { gross_potential_rent: _omitted, ...rest } = LEGACY_NOI;
    const lines = chatNoiLines(parseUWFile(noiDoc({ ...rest, scheduled_gross_revenue: 790000 })));
    expect(lines).toContain('GPR: $790,000');
  });

  it('never overrides a stated §4.5 value', () => {
    // Both shapes present with different figures: §4.5 wins on every line.
    const lines = chatNoiLines(parseUWFile(noiDoc({ ...LEGACY_NOI, ...SPEC_NOI, opex_ratio: 0.9 })));
    expect(lines).toEqual([
      'GPR: $1,000,000',
      'Vacancy Loss: $50,000 (5.00%)',
      'Other Income: $20,000',
      'EGI: $970,000',
      'Total OpEx: $400,000',
      'NOI: $570,000',
      'OpEx Ratio: 0.4124',
    ]);
  });
});
