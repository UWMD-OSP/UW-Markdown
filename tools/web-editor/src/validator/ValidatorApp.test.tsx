// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ValidatorApp } from './ValidatorApp.js';

const WRONG = readFileSync(resolve(__dirname, '../../../../examples/verification/deal.wrong-cap-rate.uwx.md'), 'utf8');

describe('ValidatorApp', () => {
  afterEach(cleanup);

  it('checks a pasted record and lists the failed statement', async () => {
    render(<ValidatorApp />);
    fireEvent.change(screen.getByLabelText('Record'), { target: { value: WRONG } });
    fireEvent.click(screen.getByRole('button', { name: 'Validate and verify' }));
    expect(await screen.findByText(/Not verified/)).toBeTruthy();
    expect(screen.getByText('quick_metrics.cap_rate')).toBeTruthy();
  });

  it('loads a gallery example', async () => {
    render(<ValidatorApp />);
    const select = screen.getByLabelText('Try an example:') as HTMLSelectElement;
    const option = [...select.options].find((o) => o.value.startsWith('Parkview-Apts'));
    fireEvent.change(select, { target: { value: option!.value } });
    expect(await screen.findByText(/^Verified/)).toBeTruthy();
  });

  it('reports a refusal', async () => {
    render(<ValidatorApp />);
    fireEvent.click(screen.getByRole('button', { name: 'Validate and verify' }));
    expect((await screen.findByRole('alert')).textContent).toContain('EMPTY');
  });
});
