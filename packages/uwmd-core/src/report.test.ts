// Report renderer tests — verifies the §7.1 / §7.2 HTML output contracts.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseUWFile } from './parser.js';
import { REPORT_CSS, renderReportHtml } from './report.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PARKVIEW_PATH = resolve(__dirname, '../../../examples/Parkview-Apts-Glendale-AZ.uwx.md');

function loadParkview() {
  return parseUWFile(readFileSync(PARKVIEW_PATH, 'utf-8'));
}

function minimalFile(dealName = 'Minimal Deal') {
  return parseUWFile(`---
uw_version: "1.1"
deal_id: "uw_2026_REPORT"
deal_name: "${dealName}"
created: "2026-01-01T00:00:00Z"
last_modified: "2026-01-02T00:00:00Z"
property_address: "1 Report Way"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
quick_metrics:
  purchase_price: 1000000
  dscr: 1.25
---

\`\`\`json uw:section=property source=manual ts=2026-01-01T00:00:00Z v=1 confidence=high
{ "_meta": { "section": "property", "version": 1, "superseded": false, "source": "manual", "agent_id": null, "agent_version": null, "actor": "user", "timestamp": "2026-01-01T00:00:00Z", "confidence": "high", "human_review_required": false, "flags": [], "input_hash": null, "notes": null }, "total_units": 12, "year_built": 1990 }
\`\`\`
`);
}

describe('renderReportHtml', () => {
  it('renders a full standalone HTML document by default', () => {
    const result = renderReportHtml(loadParkview(), { tier: 'screener' });

    expect(result.html.startsWith('<!doctype html>')).toBe(true);
    expect(result.html).toContain('<style>');
    expect(result.html).toContain('Parkview Apartments — Glendale, AZ');
    expect(result.html).toContain('Lender Package');
    expect(result.title).toBe('Parkview Apartments — Glendale, AZ');
    expect(result.tier).toBe('screener');
  });

  it('renders all §7.1 lender-package sections for a complete deal', () => {
    const result = renderReportHtml(loadParkview(), { tier: 'screener' });

    for (const id of [
      'cover',
      'executive_summary',
      'property',
      'noi_model',
      'rent_roll',
      'debt_structure',
      'sources_uses',
      'borrower_sponsor',
      'exit_analysis',
      'assumptions',
    ]) {
      expect(result.sectionsRendered).toContain(id);
    }
    // Analyst-only sections must NOT appear at screener tier
    expect(result.sectionsRendered).not.toContain('market_analysis');
    expect(result.sectionsRendered).not.toContain('financial_analysis');
    expect(result.html).not.toContain('id="rpt-market_analysis"');
  });

  it('adds §7.2 credit-memo sections at analyst tier', () => {
    const result = renderReportHtml(loadParkview(), { tier: 'analyst' });

    for (const id of [
      'market_analysis',
      'financial_analysis',
      'due_diligence',
      'risk_assessment',
      'compliance',
      'covenants',
      'appendix',
    ]) {
      expect(result.sectionsRendered).toContain(id);
    }
    expect(result.html).toContain('Credit Memo');
  });

  it('defaults tier from frontmatter (Parkview is analyst)', () => {
    const result = renderReportHtml(loadParkview());
    expect(result.tier).toBe('analyst');
  });

  it('reports numbers exactly as stored in the file (no recomputation)', () => {
    const result = renderReportHtml(loadParkview(), { tier: 'screener' });

    expect(result.html).toContain('$7,200,000');   // purchase price
    expect(result.html).toContain('$396,635');     // underwritten NOI
    expect(result.html).toContain('1.109x');       // DSCR
    expect(result.html).toContain('5.51%');        // cap rate
    expect(result.html).toContain('70.00%');       // LTV
    expect(result.html).toContain('$5,040,000');   // loan amount
  });

  it('escapes HTML in user-controlled content', () => {
    const parsed = minimalFile('Evil <script>alert(1)</script> Deal');
    const result = renderReportHtml(parsed, { tier: 'screener' });

    expect(result.html).not.toContain('<script>alert(1)</script>');
    expect(result.html).toContain('&lt;script&gt;');
  });

  it('emits a fragment without the document shell when requested', () => {
    const result = renderReportHtml(loadParkview(), { tier: 'screener', fragment: true });

    expect(result.html.startsWith('<article class="uwmd-report"')).toBe(true);
    expect(result.html).not.toContain('<!doctype html>');
    expect(result.html).not.toContain('<style>');
  });

  it('skips spec sections that have no data instead of failing', () => {
    const result = renderReportHtml(minimalFile(), { tier: 'screener' });

    expect(result.sectionsRendered).toContain('cover');
    expect(result.sectionsRendered).toContain('property');
    expect(result.sectionsSkipped).toContain('noi_model');
    expect(result.sectionsSkipped).toContain('debt_structure');
    expect(result.sectionsSkipped).toContain('borrower_sponsor');
  });

  it('honors preparedBy / preparedDate / disclaimer overrides', () => {
    const result = renderReportHtml(loadParkview(), {
      tier: 'screener',
      preparedBy: 'Acme Capital Underwriting',
      preparedDate: '2026-06-11',
      disclaimer: 'Custom disclaimer text for testing.',
    });

    expect(result.html).toContain('Prepared by Acme Capital Underwriting');
    expect(result.html).toContain('Prepared 2026-06-11');
    expect(result.html).toContain('Custom disclaimer text for testing.');
  });

  it('exports non-empty print-aware CSS', () => {
    expect(REPORT_CSS).toContain('@media print');
    expect(REPORT_CSS).toContain('@page');
    expect(REPORT_CSS).toContain('.uwmd-report');
  });

  it('renders the assumptions table with source badges', () => {
    const result = renderReportHtml(loadParkview(), { tier: 'screener' });

    expect(result.html).toContain('Vacancy / Credit Loss Rate');
    expect(result.html).toContain('rpt-badge');
    expect(result.html).toContain('User Override');
  });
});

// ─── RFC 0027 — the cover and property table state the class's own size ──────

describe('renderReportHtml — size intensives (RFC 0027)', () => {
  const OFFICE_PATH = resolve(__dirname, '../../../examples/Riverside-Office-Phoenix-AZ.uwx.md');
  const HOTEL_PATH = resolve(__dirname, '../../../examples/Saguaro-Select-Hotel-Tempe-AZ.uwx.md');

  it('the office cover and property table carry RSF 42,500', () => {
    const parsed = parseUWFile(readFileSync(OFFICE_PATH, 'utf-8'));
    const { html } = renderReportHtml(parsed, { tier: 'screener' });
    expect(html).toContain('<span>RSF</span><strong>42,500</strong>');
    expect(html).toContain('RSF');
  });

  it('the hotel cover carries Keys 142', () => {
    const parsed = parseUWFile(readFileSync(HOTEL_PATH, 'utf-8'));
    const { html } = renderReportHtml(parsed, { tier: 'screener' });
    expect(html).toContain('<span>Keys</span><strong>142</strong>');
  });

  it('no drift: the multifamily cover gains no size fact', () => {
    const { html } = renderReportHtml(loadParkview(), { tier: 'screener' });
    expect(html).not.toContain('<span>RSF</span>');
    expect(html).not.toContain('<span>Keys</span>');
    // its size is the Units fact it always had
    expect(html).toContain('<span>Units</span>');
  });
});
