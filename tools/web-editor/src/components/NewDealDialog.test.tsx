// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { NewDealDialog } from './NewDealDialog.js';

afterEach(() => { cleanup(); document.body.innerHTML = ''; });

it('describes creating a structured UWX record in user-facing language', () => {
  render(<NewDealDialog onCreate={vi.fn()} onClose={vi.fn()} />);
  expect(screen.getByRole('dialog').textContent).toContain('Create a structured .uwx.md record with empty sections.');
  expect(screen.getByRole('dialog').textContent).not.toContain('generateBlankUWFile');
});

it('asks viewer users for UWX and points Lite users to the editor', () => {
  const html = readFileSync(resolve('../web-viewer/index.html'), 'utf8');
  document.body.innerHTML = html.match(/<body>([\s\S]*?)<script type="module">/)![1];
  expect(screen.getByText('Drop a .uwx.md record here')).toBeTruthy();
  expect(screen.getByRole('link', { name: /editor/i }).getAttribute('href')).toBe('/editor/');
  expect(document.querySelector('header .sub')?.textContent).toContain('.uwx.md');
});
