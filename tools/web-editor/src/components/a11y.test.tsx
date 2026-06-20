// @vitest-environment jsdom
//
// Accessibility smoke check. Runs axe-core against the New Deal dialog and a
// section view and fails on any serious/critical violation — the bar that
// catches unlabelled fields, missing dialog semantics, and broken ARIA. Color
// contrast is excluded because jsdom can't compute rendered colors.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import axe from 'axe-core';
import { generateBlankUWFile, parseUWFile, validateUWFile } from '@uwmd/core/browser';
import { NewDealDialog } from './NewDealDialog.js';
import { SectionView } from './SectionView.js';

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
});
