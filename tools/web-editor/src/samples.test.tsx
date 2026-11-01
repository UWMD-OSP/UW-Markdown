// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';

const viewer = readFileSync(resolve('../web-viewer/index.html'), 'utf8');
const publish = readFileSync(resolve('../docs-site/scripts/prepare-public.mjs'), 'utf8');
const samples = [...publish.matchAll(/\['examples\/([^']+)', 'viewer\/samples\//g)].map(m => m[1]);

function openViewer(sample: string) {
  window.history.replaceState(null, '', `/?sample=${encodeURIComponent(sample)}`);
  document.body.innerHTML = viewer.match(/<body>([\s\S]*?)<script type="module">/)![1];
  // Execute the actual self-contained viewer module against the test DOM.
  new Function(viewer.match(/<script type="module">([\s\S]*?)<\/script>/)![1])();
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  window.history.replaceState(null, '', '/');
  vi.unstubAllGlobals();
});

describe('published sample loading', () => {
  it('offers a native file-picker button', () => {
    openViewer('');
    const input = document.querySelector<HTMLInputElement>('#file')!;
    const click = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByRole('button', { name: /choose a .uwx.md record/i }));
    expect(click).toHaveBeenCalledOnce();
  });

  it('exposes detail disclosures as buttons with expanded and controlled state', async () => {
    const text = readFileSync(resolve('../../examples/Parkview-Apts-Glendale-AZ.uwx.md'), 'utf8');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => text }));
    openViewer('/viewer/samples/Parkview-Apts-Glendale-AZ.uwx.md');
    const toggle = await screen.findByRole('button', { name: /property.*details/i });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById(toggle.getAttribute('aria-controls')!)).toBeTruthy();
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.closest('.card')?.classList.contains('open')).toBe(true);
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.closest('.card')?.classList.contains('open')).toBe(false);
    expect(screen.queryByRole('button', { name: /NOI Model/i })).toBeNull();
    expect(screen.getByRole('heading', { name: 'NOI Model' })).toBeTruthy();
  });

  it.each(samples)('renders %s in the standalone viewer', async name => {
    const text = readFileSync(resolve(`../../examples/${name}`), 'utf8');
    const fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => text });
    vi.stubGlobal('fetch', fetch);
    openViewer(`/viewer/samples/${name}`);
    await waitFor(() => expect(document.querySelector('.deal-name')?.textContent).toBeTruthy());
    expect(fetch).toHaveBeenCalledWith(`/viewer/samples/${name}`);
    expect(document.querySelector('.err')).toBeNull();
  });

  it('shows loading, then an actionable network error', async () => {
    let fail!: (error: Error) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise((_resolve, reject) => { fail = reject; })));
    openViewer('/viewer/samples/Parkview-Apts-Glendale-AZ.uwx.md');
    expect(screen.getByRole('status').textContent).toMatch(/Loading/);
    fail(new Error('Network unavailable'));
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /download/i }).getAttribute('href')).toBe('/viewer/samples/Parkview-Apts-Glendale-AZ.uwx.md');
  });

  it('explains a refused sample URL without fetching it', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    openViewer('https://example.invalid/record.uwx.md');
    expect(screen.getByRole('alert').textContent).toMatch(/sample/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('retries an HTTP failure and renders the record', async () => {
    const text = readFileSync(resolve('../../examples/Parkview-Apts-Glendale-AZ.uwx.md'), 'utf8');
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, text: async () => text }));
    openViewer('/viewer/samples/Parkview-Apts-Glendale-AZ.uwx.md');
    expect((await screen.findByRole('alert')).textContent).toContain('503');
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(document.querySelector('.deal-name')?.textContent).toContain('Parkview'));
  });

  it('reports a malformed sample with recovery actions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => 'not a UWX record' }));
    openViewer('/viewer/samples/Parkview-Apts-Glendale-AZ.uwx.md');
    expect((await screen.findByRole('alert')).textContent).toContain('Parse failed');
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();
  });

  it.each(samples)('opens %s in the editor', async name => {
    const text = readFileSync(resolve(`../../examples/${name}`), 'utf8');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => text }));
    window.history.replaceState(null, '', `/?sample=/viewer/samples/${name}`);
    render(<App />);
    expect(await screen.findByTitle(name)).toBeTruthy();
  });
});
