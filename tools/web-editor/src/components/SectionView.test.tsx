// @vitest-environment jsdom
//
// SectionView surfaces the validator's issues for the active section IN CONTEXT —
// the same BUILTIN_REMEDIATIONS copy the footer shows, read off the message (never
// re-authored) — and flags the offending flat field with aria-invalid. This pins
// that wiring so a fix stays one glance from the field that needs it.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import {
  generateBlankUWFile,
  parseUWFile,
  validateUWFile,
  type ValidationMessage,
} from '@uwmd/core/browser';
import { SectionView } from './SectionView.js';

afterEach(cleanup);

function setup(
  extraIssues: ValidationMessage[],
  assetClass: 'multifamily' | 'office' | 'land' = 'multifamily',
) {
  const parsed = parseUWFile(generateBlankUWFile({ assetClass }), { strict: false });
  const validation = validateUWFile(parsed);
  validation.issues.push(...extraIssues);
  return { parsed, validation };
}

const REMEDIATION = 'Confirm the rent roll unit count against the property block.';

describe('SectionView — inline validation', () => {
  it('shows the remediation in-context and marks the offending field invalid', () => {
    const { parsed, validation } = setup([
      {
        code: 'FV-TEST',
        severity: 'warning',
        section: 'property',
        field: 'total_units',
        message: 'Unit count looks low for the stated NRA.',
        remediation: REMEDIATION,
      },
    ]);

    const { getAllByText, getByLabelText } = render(
      <SectionView parsed={parsed} activeId="property" dispatch={vi.fn()} validation={validation} />,
    );

    // Remediation copy appears in-context (section strip + the field's inline note).
    expect(getAllByText(new RegExp(REMEDIATION)).length).toBeGreaterThan(0);
    // The offending input is flagged for assistive tech.
    expect(getByLabelText('Total units').getAttribute('aria-invalid')).toBe('true');
  });

  it('renders no remediation when the active section is clean', () => {
    const { parsed, validation } = setup([
      {
        code: 'FV-TEST',
        severity: 'warning',
        section: 'property',
        field: 'total_units',
        message: 'Unit count looks low.',
        remediation: REMEDIATION,
      },
    ]);

    // 'ownership' has no issues — the property issue must not leak into it.
    const { queryByText } = render(
      <SectionView parsed={parsed} activeId="ownership" dispatch={vi.fn()} validation={validation} />,
    );

    expect(queryByText(new RegExp(REMEDIATION))).toBeNull();
  });
});

describe('SectionView — the quick-edit grid is asset-class aware', () => {
  it('offers a multifamily deal units and an office deal rentable area', () => {
    const mf = setup([]);
    const { getByLabelText, queryByLabelText } = render(
      <SectionView parsed={mf.parsed} activeId="property" dispatch={vi.fn()} validation={mf.validation} />,
    );
    expect(getByLabelText('Total units')).toBeTruthy();
    expect(queryByLabelText('Rentable area (sqft)')).toBeNull();

    cleanup();

    const office = setup([], 'office');
    const rendered = render(
      <SectionView
        parsed={office.parsed}
        activeId="property"
        dispatch={vi.fn()}
        validation={office.validation}
      />,
    );
    expect(rendered.getByLabelText('Rentable area (sqft)')).toBeTruthy();
    expect(rendered.queryByLabelText('Total units')).toBeNull();
    // Class-independent fields stay in every grid.
    expect(rendered.getByLabelText('Year built')).toBeTruthy();
  });

  it('offers a land parcel acres rather than a unit count', () => {
    const { parsed, validation } = setup([], 'land');
    const { getByLabelText, queryByLabelText } = render(
      <SectionView parsed={parsed} activeId="property" dispatch={vi.fn()} validation={validation} />,
    );
    expect(getByLabelText('Gross acres')).toBeTruthy();
    expect(getByLabelText('Entitled units')).toBeTruthy();
    expect(queryByLabelText('Total units')).toBeNull();
  });
});
