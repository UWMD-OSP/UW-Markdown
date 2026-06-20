// Tests for the edit chokepoint — the one place that mutates a loaded deal.
//
// Everything the editor does to a file goes through runEdit(): it threads the
// active EditSettings onto the op, carries forward _meta.field_overrides, calls
// core's applyEdit(), and re-parses so in-memory state never drifts from the
// canonical bytes. That contract is the editor's entire calc-integrity story,
// so it's the thing most worth testing.

import { describe, it, expect } from 'vitest';
import { generateBlankUWFile, getSection, deriveDCF } from '@uwmd/core/browser';
import type { EditOperation, UWFieldOverride } from '@uwmd/core/browser';
import { loadInitialState, runEdit, DEFAULT_EDIT_SETTINGS, type EditState } from './edits.js';

function blankState(): EditState {
  return loadInitialState(generateBlankUWFile({ dealName: 'Test Deal', assetClass: 'multifamily' }));
}

/** Count the JSON section fences for a given section id in the canonical source. */
function fenceCount(source: string, sectionId: string): number {
  return (source.match(new RegExp(`uw:section=${sectionId}\\b`, 'g')) ?? []).length;
}

describe('loadInitialState', () => {
  it('parses the blank file into sections + validation', () => {
    const state = blankState();
    expect(Object.keys(state.parsed.sections).length).toBeGreaterThan(0);
    expect(getSection(state.parsed, 'property')).toBeTruthy();
    expect(state.validation).toBeDefined();
    expect(Array.isArray(state.validation.issues)).toBe(true);
  });
});

describe('runEdit — frontmatter_set', () => {
  it('applies the edit and reparses so parsed reflects the new value', () => {
    const state = blankState();
    const op: EditOperation = { kind: 'frontmatter_set', path: 'recommendation', value: 'approve' };
    const outcome = runEdit(state, op);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.state.parsed.frontmatter.recommendation).toBe('approve');
    // The canonical source string actually changed — not just the in-memory tree.
    expect(outcome.state.source).not.toBe(state.source);
  });

  it('returns a failed outcome (not a throw) when the protocol rejects the op', () => {
    const state = blankState();
    const op: EditOperation = { kind: 'frontmatter_set', path: 'no_such_key', value: 'x' };
    const outcome = runEdit(state, op);

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.message).toBeTruthy();
  });
});

describe('runEdit — EditSettings are threaded onto section edits', () => {
  const replaceProperty = (overrides: Partial<typeof DEFAULT_EDIT_SETTINGS>) => {
    const state = blankState();
    const op: EditOperation = {
      kind: 'section_replace',
      section_id: 'property',
      content: { total_units: 50 },
      meta: {},
    };
    return runEdit(state, op, { ...DEFAULT_EDIT_SETTINGS, ...overrides });
  };

  it('stamps the chosen confidence onto the written block (low stub → high)', () => {
    const outcome = replaceProperty({ confidence: 'high' });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(getSection(outcome.state.parsed, 'property')?.meta?.confidence).toBe('high');
  });

  it('drives human_review_required from the humanReview toggle', () => {
    const off = replaceProperty({ humanReview: false });
    const on = replaceProperty({ humanReview: true });
    expect(off.ok && getSection(off.state.parsed, 'property')?.meta?.human_review_required).toBe(false);
    expect(on.ok && getSection(on.state.parsed, 'property')?.meta?.human_review_required).toBe(true);
  });
});

describe('runEdit — supersede mode appends instead of replacing in place', () => {
  it('replace mode keeps one block; supersede mode archives the prior and adds a new one', () => {
    const state = blankState();
    const op: EditOperation = {
      kind: 'section_replace',
      section_id: 'property',
      content: { total_units: 50 },
      meta: {},
    };

    const replaced = runEdit(state, op, { ...DEFAULT_EDIT_SETTINGS, mode: 'replace' });
    const superseded = runEdit(state, op, { ...DEFAULT_EDIT_SETTINGS, mode: 'supersede' });

    expect(replaced.ok && superseded.ok).toBe(true);
    if (!replaced.ok || !superseded.ok) return;

    const replacedCount = fenceCount(replaced.state.source, 'property');
    const supersededCount = fenceCount(superseded.state.source, 'property');
    expect(replacedCount).toBe(1);
    expect(supersededCount).toBeGreaterThan(replacedCount);
  });
});

describe('runEdit — carryForwardOverrides', () => {
  it('preserves _meta.field_overrides across a later edit that does not restate them', () => {
    const state = blankState();
    const overrides: UWFieldOverride[] = [{ path: 'gross_potential_rent', reason: 'overridden' }];

    // Edit A: pin a field override on the rent roll.
    const withOverride = runEdit(state, {
      kind: 'section_replace',
      section_id: 'rent_roll',
      content: { units: [] },
      meta: { field_overrides: overrides },
    });
    expect(withOverride.ok).toBe(true);
    if (!withOverride.ok) return;
    expect(getSection(withOverride.state.parsed, 'rent_roll')?.meta?.field_overrides).toEqual(overrides);

    // Edit B: a later rent-roll edit that says nothing about overrides.
    const later = runEdit(withOverride.state, {
      kind: 'section_replace',
      section_id: 'rent_roll',
      content: { units: [{ unit_type: 'studio', count: 10 }] },
      meta: {},
    });
    expect(later.ok).toBe(true);
    if (!later.ok) return;
    // The pinned override must survive — buildMeta() doesn't carry _meta forward,
    // so carryForwardOverrides() is the thing keeping it alive.
    expect(getSection(later.state.parsed, 'rent_roll')?.meta?.field_overrides).toEqual(overrides);
  });
});

describe('runEdit — dcf array-indexed content round-trips through applyEdit', () => {
  it('preserves per-year rows and foots them after reparse (what DcfModel relies on)', () => {
    const state = blankState();
    const outcome = runEdit(state, {
      kind: 'section_replace',
      section_id: 'dcf',
      content: {
        assumptions: { disposition_costs_pct: 0.02 },
        annual_cash_flows: [
          {
            year: 1,
            net_operating_income: 396_635,
            annual_debt_service: 296_100,
            cumulative_equity_invested: 2_400_000,
          },
        ],
        exit_analysis: { exit_value_gross: 7_750_733, loan_balance_at_exit: 4_800_000 },
      },
      meta: {},
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const block = getSection(outcome.state.parsed, 'dcf');
    expect(block).toBeTruthy();
    if (!block) return;

    // The array of per-year rows survived the protocol edit + reparse as an array.
    const content = block.content as Record<string, unknown>;
    const flows = content['annual_cash_flows'] as Array<Record<string, unknown>>;
    expect(Array.isArray(flows)).toBe(true);
    expect(flows[0]['net_operating_income']).toBe(396_635);

    // And deriveDCF foots the reparsed block exactly as the footed surface would.
    const d = deriveDCF(content);
    const at = (p: string) => d.fields.find((f) => f.path === p)?.value;
    expect(at('annual_cash_flows.0.net_cash_flow_levered')).toBe(100_535);
    expect(at('exit_analysis.net_proceeds_to_equity')).toBe(2_795_718);
  });
});
