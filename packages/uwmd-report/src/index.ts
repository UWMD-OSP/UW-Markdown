// @uwmd/report — public API surface.
//
// generateReport(parsed) = @uwmd/core's renderReportHtml + the Chromium print
// step. HTML output needs no browser; PDF output resolves one via toPdf.ts.

import { renderReportHtml } from '@uwmd/core';
import type { ParsedUWFile, ReportOptions, ReportResult } from '@uwmd/core';
import { htmlToPdf } from './toPdf.js';
import type { PdfOptions } from './toPdf.js';

export { htmlToPdf, BrowserNotFoundError } from './toPdf.js';
export type { PdfOptions } from './toPdf.js';

export interface GenerateReportOptions extends ReportOptions {
  /** 'pdf' (default) renders via headless Chromium; 'html' skips the browser. */
  format?: 'pdf' | 'html';
  pdf?: PdfOptions;
}

export interface GenerateReportResult {
  /** PDF bytes when format is 'pdf'; UTF-8 HTML bytes when 'html'. */
  bytes: Buffer;
  report: ReportResult;
  format: 'pdf' | 'html';
}

export async function generateReport(
  parsed: ParsedUWFile,
  opts: GenerateReportOptions = {},
): Promise<GenerateReportResult> {
  const { format = 'pdf', pdf, ...reportOpts } = opts;
  const report = renderReportHtml(parsed, reportOpts);
  if (format === 'html') {
    return { bytes: Buffer.from(report.html, 'utf-8'), report, format };
  }
  const bytes = await htmlToPdf(report.html, pdf);
  return { bytes, report, format };
}
