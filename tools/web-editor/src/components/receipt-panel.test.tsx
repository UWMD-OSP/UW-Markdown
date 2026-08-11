// @vitest-environment jsdom
//
// UW_RECEIPT_v1 §1 is a requirement on the interface, not just on the library:
// a `verified` receipt MUST NOT be presented as an unqualified checkmark, and
// the reader MUST be able to see what it does and does not attest. That is a
// UI property, so it needs a UI test — a passing core test cannot prove the
// caveat survived into the markup.

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ReceiptPanel } from './ReceiptPanel.js';

afterEach(cleanup);

const DEAL = resolve(
  __dirname,
  '../../../../conformance/receipts/issue/01-uwx-multifamily/deal.uwx.md',
);
const source = () => readFileSync(DEAL, 'utf8');
const edited = () => source().replace('"net_operating_income": 1380000', '"net_operating_income": 1450000');

function issueButton(): HTMLElement {
  return screen.getByRole('button', { name: /issue receipt/i });
}

describe('ReceiptPanel', () => {
  it('states the assurance boundary before any receipt exists', () => {
    render(<ReceiptPanel source={source()} filename="deal.uwx.md" />);
    expect(screen.getByText(/says nothing about whether the inputs are true/i)).toBeTruthy();
    expect(screen.getByText(/fabricated NOI can\s+carry a perfectly valid receipt/i)).toBeTruthy();
  });

  it('never presents a verified receipt as an unqualified pass', async () => {
    render(<ReceiptPanel source={source()} filename="deal.uwx.md" />);
    fireEvent.click(issueButton());

    await waitFor(() => expect(screen.getByText(/^Verified$/i)).toBeTruthy());

    // The verdict is present...
    expect(screen.getByText(/These numbers follow from this record/i)).toBeTruthy();
    // ...and so is the caveat, in the same view, not behind a disclosure.
    expect(
      screen.getByText(/not a statement that the underwriting is correct, complete, audited,\s*or approved/i),
    ).toBeTruthy();
  });

  it('shows the pack and engine that produced the numbers', async () => {
    render(<ReceiptPanel source={source()} filename="deal.uwx.md" />);
    fireEvent.click(issueButton());
    await waitFor(() => expect(screen.getByText(/org\.uwmd\.pack\.multifamily @ /)).toBeTruthy());
    expect(screen.getByText(/unsigned/i)).toBeTruthy();
  });

  it('reports a receipt as stale — not failed — after the deal is edited', async () => {
    const view = render(<ReceiptPanel source={source()} filename="deal.uwx.md" />);
    fireEvent.click(issueButton());
    await waitFor(() => expect(screen.getByText(/^Verified$/i)).toBeTruthy());

    view.rerender(<ReceiptPanel source={edited()} filename="deal.uwx.md" />);

    await waitFor(() => expect(screen.getByText(/^Stale$/i)).toBeTruthy());
    expect(screen.getByText(/not a sign the record was tampered with/i)).toBeTruthy();
    expect(screen.queryByText(/^Failed$/i)).toBeNull();
  });

  it('surfaces a refusal rather than a receipt when issuance is impossible', async () => {
    render(<ReceiptPanel source={'garbage, not a deal'} filename="mystery.uwx.md" />);
    fireEvent.click(issueButton());
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.queryByText(/^Verified$/i)).toBeNull();
  });

  it('labels uncomputed pack outputs as uncomputed rather than as a value', async () => {
    // The industrial pack declares outputs this multifamily-shaped deal cannot
    // support, so the Lite fixture exercises the uncomputed path.
    const lite = readFileSync(
      resolve(__dirname, '../../../../conformance/receipts/issue/02-lite-industrial/deal.uw.md'),
      'utf8',
    );
    render(<ReceiptPanel source={lite} filename="deal.uw.md" />);
    fireEvent.click(issueButton());
    await waitFor(() => expect(screen.getByText(/^Verified$/i)).toBeTruthy());
    expect(screen.getAllByText(/not computed — this deal lacks the inputs/i).length).toBeGreaterThan(0);
  });
});
