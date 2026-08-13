// @vitest-environment jsdom
//
// Asset-class awareness of the pinned metric strip.
//
// CalcDashboard renders one card per calculation in the asset class's pack, so
// the strip is only as correct as the pack selection behind it. The failure
// mode worth pinning is not a crash — it is a card that renders anyway. Nine of
// the ten packs are income-property shaped, and it is easy to assume every deal
// has a cap rate, a DSCR, and a debt yield. `land` has none of those: its
// noi_model is a carry model that nets negative, so a cap-rate card on a land
// deal would show either an em-dash, a NaN, or worse, a plausible negative
// number that reads as a yield when it is a carry burden.
//
// These tests run against the real worked examples rather than fixtures, so
// they also catch a pack whose formulas stop resolving against the canonical
// document shape.

import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseUWFile, getPackForAssetClass } from '@uwmd/core/browser';
import type { ParsedUWFile } from '@uwmd/core/browser';
import { CalcDashboard } from './CalcDashboard.js';

afterEach(cleanup);

const EXAMPLES = resolve(__dirname, '../../../../examples');

function example(file: string): ParsedUWFile {
  return parseUWFile(readFileSync(resolve(EXAMPLES, file), 'utf8'));
}

const LAND = 'Sundance-Ranch-Land-Buckeye-AZ.uwx.md';
const MULTIFAMILY = 'Parkview-Apts-Glendale-AZ.uwx.md';

/** The label of every card currently on the strip. */
function cardLabels(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('button')).map((b) =>
    (b.querySelector('div')?.textContent ?? '').trim(),
  );
}

/** The rendered value of the card whose label matches, or null if absent. */
function cardValue(container: HTMLElement, label: RegExp): string | null {
  for (const button of Array.from(container.querySelectorAll('button'))) {
    const divs = button.querySelectorAll('div');
    if (label.test((divs[0]?.textContent ?? '').trim())) {
      return (divs[1]?.textContent ?? '').trim();
    }
  }
  return null;
}

describe('CalcDashboard — the strip follows the asset class', () => {
  it('renders no cap-rate, DSCR, or debt-yield card for a land deal', () => {
    // The headline contract. `land` omits these three deliberately; the strip
    // must omit them too rather than render an empty or NaN card.
    const { container } = render(<CalcDashboard parsed={example(LAND)} />);

    expect(cardValue(container, /cap rate/i)).toBeNull();
    expect(cardValue(container, /dscr/i)).toBeNull();
    expect(cardValue(container, /debt yield/i)).toBeNull();
  });

  it('renders the land metrics that do apply, and computes them', () => {
    // The other half: omitting the strip entirely would also pass the test
    // above. Land-specific cards must be present *and* resolve to a value,
    // not the '—' placeholder the component shows on an evaluation failure.
    const { container } = render(<CalcDashboard parsed={example(LAND)} />);
    const labels = cardLabels(container);

    expect(labels.length).toBeGreaterThan(0);
    // Acre-denominated and carry metrics are land's own — no income-property
    // pack has either, so their presence proves the right pack was selected.
    expect(labels.some((l) => /acre/i.test(l)), `no acre metric in: ${labels.join(', ')}`).toBe(true);
    expect(labels.some((l) => /carry/i.test(l)), `no carry metric in: ${labels.join(', ')}`).toBe(true);

    for (const label of labels) {
      const value = cardValue(container, new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));
      expect(value, `land card "${label}" rendered the failure placeholder`).not.toBe('—');
    }
  });

  it('renders exactly the pack\'s calculations, in the pack\'s order', () => {
    // Pins the strip to the pack as the single source of truth: no card is
    // added, dropped, or reordered by the UI. Adding a metric to a pack in
    // @uwmd/core should surface here with no change to this component.
    for (const file of [LAND, MULTIFAMILY]) {
      const parsed = example(file);
      const assetClass = (parsed.frontmatter as { asset_class?: string }).asset_class ?? '';
      const expected = (getPackForAssetClass(assetClass)?.calculations ?? []).map((c) => c.label);

      const { container } = render(<CalcDashboard parsed={parsed} />);
      expect(cardLabels(container), `${file} strip does not match its pack`).toEqual(expected);
      cleanup();
    }
  });

  it('still renders cap rate and DSCR for an income property', () => {
    // Guards against "fixing" the land case by suppressing these globally.
    const { container } = render(<CalcDashboard parsed={example(MULTIFAMILY)} />);

    expect(cardValue(container, /cap rate/i)).not.toBeNull();
    expect(cardValue(container, /dscr/i)).not.toBeNull();
    expect(cardValue(container, /cap rate/i)).not.toBe('—');
  });

  it('renders nothing at all for an asset class with no pack', () => {
    // `mixed_use` has no pack until RFC 0019 lands, and an unknown class never
    // will. Either way the strip must collapse rather than render an empty
    // frame or fall back to another class's metrics.
    const parsed = parseUWFile(
      [
        '---',
        'uw_version: "1.1"',
        'deal_id: "x"',
        'deal_name: "X"',
        'asset_class: "__unregistered_test_class__"',
        '---',
        '# X',
      ].join('\n'),
    );
    const { container } = render(<CalcDashboard parsed={parsed} />);
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });

  it('degrades to a placeholder rather than a wrong number when inputs are missing', () => {
    // A multifamily document with no sections: every formula's inputs are
    // absent. The cards must show the '—' placeholder, never NaN, Infinity, or
    // a coerced zero — a zero DSCR reads as a measured failure, not missing data.
    const parsed = parseUWFile(
      [
        '---',
        'uw_version: "1.1"',
        'deal_id: "x"',
        'deal_name: "X"',
        'asset_class: "multifamily"',
        '---',
        '# X',
      ].join('\n'),
    );
    const { container } = render(<CalcDashboard parsed={parsed} />);
    const buttons = Array.from(container.querySelectorAll('button'));
    expect(buttons.length).toBeGreaterThan(0);

    for (const button of buttons) {
      const value = (button.querySelectorAll('div')[1]?.textContent ?? '').trim();
      expect(value).toBe('—');
      expect(value).not.toMatch(/NaN|Infinity/);
    }
    // And the whole strip is visibly de-emphasised rather than silently blank.
    for (const button of buttons) {
      expect(within(button).getByText('—')).toBeTruthy();
    }
  });
});
