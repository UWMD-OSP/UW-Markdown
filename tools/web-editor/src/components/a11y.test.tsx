// @vitest-environment jsdom
//
// Accessibility smoke check. Runs axe-core against the New Deal dialog and a
// section view and fails on any serious/critical violation — the bar that
// catches unlabelled fields, missing dialog semantics, and broken ARIA. Color
// contrast is excluded because jsdom can't compute rendered colors.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor, screen, fireEvent } from '@testing-library/react';
import axe from 'axe-core';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateBlankUWFile, parseUWFile, validateUWFile } from '@uwmd/core/browser';
import { NewDealDialog } from './NewDealDialog.js';
import { SectionView } from './SectionView.js';
import { ReceiptPanel } from './ReceiptPanel.js';

afterEach(cleanup);

const AXE_OPTS: axe.RunOptions = { rules: { 'color-contrast': { enabled: false } } };

async function seriousViolations(container: HTMLElement) {
  const results = await axe.run(container, AXE_OPTS);
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help}`);
}

describe('a11y smoke (axe-core)', () => {
  it('the New Deal dialog has no serious/critical violations', async () => {
    const { container } = render(<NewDealDialog onCreate={vi.fn()} onClose={vi.fn()} />);
    expect(await seriousViolations(container)).toEqual([]);
  });

  it('a section view with a flagged field has no serious/critical violations', async () => {
    const parsed = parseUWFile(generateBlankUWFile({ assetClass: 'multifamily' }), { strict: false });
    const validation = validateUWFile(parsed);
    validation.issues.push({
      code: 'FV-TEST',
      severity: 'warning',
      section: 'property',
      field: 'total_units',
      message: 'Unit count looks low.',
      remediation: 'Confirm the rent roll.',
    });
    const { container } = render(
      <SectionView parsed={parsed} activeId="property" dispatch={vi.fn()} validation={validation} />,
    );
    expect(await seriousViolations(container)).toEqual([]);
  });

  it('the receipt panel, with a verdict and results table rendered, has no serious/critical violations', async () => {
    const source = readFileSync(
      resolve(__dirname, '../../../../conformance/receipts/issue/01-uwx-multifamily/deal.uwx.md'),
      'utf8',
    );
    const { container } = render(<ReceiptPanel source={source} filename="deal.uwx.md" />);
    fireEvent.click(screen.getByRole('button', { name: /issue receipt/i }));
    await waitFor(() => expect(screen.getByText(/^Verified$/i)).toBeTruthy());
    expect(await seriousViolations(container)).toEqual([]);
  });
});
