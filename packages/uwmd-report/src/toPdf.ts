// HTML → PDF via headless Chromium (playwright-core).
//
// We deliberately depend on playwright-core (no bundled browser download) and
// resolve a browser at runtime in this order:
//   1. an explicit executable path (option or UWMD_REPORT_BROWSER env var)
//   2. the system Chrome channel
//   3. the system Edge channel (always present on Windows 10/11)
//   4. a Playwright-managed chromium, if the user has run `playwright install`
//
// The HTML itself comes from @uwmd/core's renderReportHtml — this module adds
// no content; it only prints. Page styling (margins, page breaks, colors) is
// owned by REPORT_CSS's @page / @media print rules, so `preferCSSPageSize` is
// on and Playwright's own margins are zeroed.

import { chromium } from 'playwright-core';
import type { Browser, LaunchOptions } from 'playwright-core';

export class BrowserNotFoundError extends Error {
  constructor(attempts: string[]) {
    super(
      `No Chromium-based browser found for PDF rendering. Tried: ${attempts.join(', ')}. Install Google Chrome or Microsoft Edge, run \`npx playwright install chromium\`, or set UWMD_REPORT_BROWSER to a Chromium executable path.`,
    );
    this.name = 'BrowserNotFoundError';
  }
}

export interface PdfOptions {
  /** Explicit Chromium executable. Overrides channel discovery. */
  executablePath?: string;
  /** Extra time budget for layout/fonts, in ms. Default 30_000. */
  timeoutMs?: number;
}

interface LaunchAttempt {
  label: string;
  options: LaunchOptions;
}

function launchPlan(opts: PdfOptions): LaunchAttempt[] {
  const attempts: LaunchAttempt[] = [];
  const explicit = opts.executablePath ?? process.env['UWMD_REPORT_BROWSER'];
  if (explicit) {
    attempts.push({ label: `executable (${explicit})`, options: { executablePath: explicit } });
  }
  attempts.push(
    { label: 'chrome channel', options: { channel: 'chrome' } },
    { label: 'msedge channel', options: { channel: 'msedge' } },
    { label: 'playwright chromium', options: {} },
  );
  return attempts;
}

async function launchBrowser(opts: PdfOptions): Promise<Browser> {
  const attempts = launchPlan(opts);
  const tried: string[] = [];
  for (const attempt of attempts) {
    try {
      return await chromium.launch({ ...attempt.options, headless: true });
    } catch {
      tried.push(attempt.label);
    }
  }
  throw new BrowserNotFoundError(tried);
}

/** Render a self-contained HTML document string to PDF bytes. */
export async function htmlToPdf(html: string, opts: PdfOptions = {}): Promise<Buffer> {
  const timeout = opts.timeoutMs ?? 30_000;
  const browser = await launchBrowser(opts);
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load', timeout });
    const pdf = await page.pdf({
      preferCSSPageSize: true,
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    return pdf;
  } finally {
    await browser.close();
  }
}
