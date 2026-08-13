// @uwmd/report tests — HTML path is always testable; the PDF path needs a
// Chromium-based browser and is skipped (with a notice) when none is found.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseUWFile } from '@uwmd/core';
import { generateReport, htmlToPdf, BrowserNotFoundError } from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PARKVIEW_PATH = resolve(__dirname, '../../../examples/Parkview-Apts-Glendale-AZ.uwx.md');

function loadParkview() {
  return parseUWFile(readFileSync(PARKVIEW_PATH, 'utf-8'));
}

describe('generateReport', () => {
  it('produces HTML bytes without a browser when format is html', async () => {
    const result = await generateReport(loadParkview(), { format: 'html', tier: 'screener' });

    expect(result.format).toBe('html');
    expect(result.bytes.toString('utf-8')).toContain('<!doctype html>');
    expect(result.report.tier).toBe('screener');
    expect(result.report.sectionsRendered).toContain('executive_summary');
  });

  it('passes report options through to the core renderer', async () => {
    const result = await generateReport(loadParkview(), {
      format: 'html',
      tier: 'analyst',
      preparedBy: 'Report Pipeline Test',
    });

    expect(result.bytes.toString('utf-8')).toContain('Prepared by Report Pipeline Test');
    expect(result.report.sectionsRendered).toContain('market_analysis');
  });

  it('renders a real PDF when a Chromium browser is available', async () => {
    let pdf: Buffer;
    try {
      pdf = await htmlToPdf('<!doctype html><html><body><h1>uwmd</h1></body></html>');
    } catch (err) {
      if (err instanceof BrowserNotFoundError) {
        console.warn('[uwmd-report] no Chromium browser found — PDF test skipped');
        return;
      }
      throw err;
    }

    // %PDF magic bytes
    expect(pdf.subarray(0, 4).toString('latin1')).toBe('%PDF');

    const result = await generateReport(loadParkview(), { tier: 'screener' });
    expect(result.format).toBe('pdf');
    expect(result.bytes.subarray(0, 4).toString('latin1')).toBe('%PDF');
    expect(result.bytes.length).toBeGreaterThan(10_000);
  }, 120_000);
});
