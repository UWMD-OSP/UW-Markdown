// The end-to-end test RFC 0039 exists to make possible: a module that DECLARES
// its asset class and supplies sections, calculations and validations for it,
// loaded into a real registry and run against a real file.
//
// Everything here goes through the published surface of `@uwmd/core`. A
// product module that reached into the library's internals would demonstrate
// nothing about what an external author can actually do.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createModuleRegistry,
  evaluateModuleCalculations,
  loadModuleManifest,
  parseUWFile,
  resolveAssetClass,
  validateAgainstModules,
  validateUWFile,
} from '@uwmd/core';
import {
  DATA_CENTER_ASSET_CLASS,
  DATA_CENTER_MODULE,
  DATA_CENTER_MODULE_ID,
  DATA_CENTER_VIEW_MODELS,
} from './index.js';

const FIXTURE = resolve(__dirname, '../test/fixtures/mesa-gateway-data-center.uwx.md');
const EXAMPLE = resolve(__dirname, '../../../examples/Mesa-Gateway-Data-Center-Mesa-AZ.uwx.md');
const source = readFileSync(FIXTURE, 'utf8');
const parsed = parseUWFile(source);
const registry = createModuleRegistry({
  modules: [DATA_CENTER_MODULE],
  hostTier: 'tier-3-calc-host',
});

/** Every calc result, keyed by id. */
function results(file = parsed) {
  return Object.fromEntries(
    evaluateModuleCalculations(file, registry).map(({ result }) => [result.calc_id, result]),
  );
}

/** The fixture's capacity section, as authored. */
const CAPACITY = {
  critical_it_load_kw: 10000,
  planned_it_load_kw: 12500,
  contracted_it_load_kw: 11000,
  utility_feed_kw: 15000,
  design_pue: 1.25,
  measured_pue: 1.32,
  redundancy: 'n_plus_1',
  raised_floor_sf: 60000,
  design_density_kw_per_rack: 12.5,
};

const REVENUE = {
  lease_type: 'wholesale_turnkey',
  rent_per_kw_month: 150,
  interconnection_revenue_annual: 660000,
  services_revenue_annual: 264000,
  market_rent_per_kw_month: 187.5,
};

describe('the manifest itself', () => {
  it('loads against the protocol loader with no findings', () => {
    const loaded = loadModuleManifest(DATA_CENTER_MODULE, { hostTier: 'tier-3-calc-host' });
    expect(loaded.errors).toEqual([]);
    expect(loaded.ok).toBe(true);
  });

  it('loads standalone from the emitted dist/manifest.json', () => {
    // The artifact a host without a TypeScript toolchain fetches. If the build
    // has not run this test fails on the read, which is the right failure.
    const emitted = JSON.parse(readFileSync(resolve(__dirname, '../dist/manifest.json'), 'utf8'));
    expect(emitted.id).toBe(DATA_CENTER_MODULE_ID);
    expect(emitted.calculations.map((c: { id: string }) => c.id)).toEqual(
      DATA_CENTER_MODULE.calculations?.map((c) => c.id),
    );
    const loaded = loadModuleManifest(emitted, { hostTier: 'tier-3-calc-host' });
    expect(loaded.errors).toEqual([]);
  });

  it('is refused by a host below its declared tier', () => {
    const loaded = loadModuleManifest(DATA_CENTER_MODULE, { hostTier: 'tier-1-reader' });
    expect(loaded.ok).toBe(false);
  });

  it('declares the class, and no builtin', () => {
    expect(DATA_CENTER_MODULE.asset_classes).toBeUndefined();
    expect(DATA_CENTER_MODULE.declares_asset_classes).toEqual([
      {
        id: DATA_CENTER_ASSET_CLASS,
        display_name: 'Data Center',
        fallback: 'industrial',
        required_sections: ['dc_capacity'],
        optional_sections: ['dc_power', 'dc_revenue'],
      },
    ]);
  });

  it('is frozen, and its view models are the typed ones', () => {
    expect(Object.isFrozen(DATA_CENTER_MODULE)).toBe(true);
    expect(DATA_CENTER_MODULE.view_models).toHaveLength(DATA_CENTER_VIEW_MODELS.length);
    expect(DATA_CENTER_MODULE.view_models?.map((v) => v.section_id)).toEqual([
      'dc_capacity',
      'dc_power',
      'dc_revenue',
    ]);
  });

  it('keeps PUE >= 1 in the schema, not only in the rule', () => {
    const capacity = DATA_CENTER_MODULE.sections?.find((s) => s.id === 'dc_capacity');
    const pue = (capacity?.schema.properties as Record<string, { minimum?: number }>).design_pue;
    expect(pue?.minimum).toBe(1);
  });
});

describe('the fixture', () => {
  it('is byte-identical to the public example', () => {
    // One document, two homes: the package tests it and the examples/ corpus
    // publishes it. If they drift, the README's claims about the example stop
    // being tested.
    expect(readFileSync(EXAMPLE, 'utf8')).toBe(source);
  });

  it('validates clean under core with the module dependency declared', () => {
    const codes = validateUWFile(parsed).issues.map((i) => i.code);
    expect(codes).not.toContain('MOD-DEPENDENCY-UNDECLARED');
    expect(codes.filter((c) => c.startsWith('INVALID-ASSET-CLASS'))).toEqual([]);
  });
});

describe('asset-class resolution (RFC 0003 on a product module)', () => {
  it('resolves as custom with the module loaded, carrying the declaration', () => {
    const r = resolveAssetClass(parsed.frontmatter.asset_class, registry);
    expect(r.status).toBe('resolved');
    if (r.status !== 'resolved') return;
    expect(r.kind).toBe('custom');
    expect(r.declaration?.display_name).toBe('Data Center');
  });

  it('degrades to industrial with MOD-FALLBACK-001 when the module is absent', () => {
    const empty = createModuleRegistry({ modules: [], hostTier: 'tier-3-calc-host' });
    const r = resolveAssetClass(parsed.frontmatter.asset_class, empty, {
      knownDeclarations: DATA_CENTER_MODULE.declares_asset_classes,
    });
    expect(r.status).toBe('degraded');
    if (r.status !== 'degraded') return;
    expect(r.fallback).toBe('industrial');
    expect(r.issue.code).toBe('MOD-FALLBACK-001');
  });

  it('is unresolved with neither the module nor a declaration', () => {
    const empty = createModuleRegistry({ modules: [], hostTier: 'tier-3-calc-host' });
    const r = resolveAssetClass(parsed.frontmatter.asset_class, empty);
    expect(r.status).toBe('unresolved');
  });
});

describe('calculations', () => {
  it('computes all eleven from the fixture, each an exact decimal', () => {
    const r = results();
    // 11,000 / 10,000
    expect(r['utilization']?.value).toBe(1.1);
    // 10,000 / 12,500
    expect(r['commissioned_share']?.value).toBe(0.8);
    // 10,000 x 1.25
    expect(r['facility_load_kw']?.value).toBe(12_500);
    // 11,000 x 1.25 x 8,760
    expect(r['annual_facility_kwh_at_contract']?.value).toBe(120_450_000);
    // 120,450,000 x $0.08 (no stated bill)
    expect(r['annual_power_cost']?.value).toBe(9_636_000);
    // 9,636,000 / (11,000 x 12)
    expect(r['power_cost_per_kw_month']?.value).toBe(73);
    // $150 x 11,000 x 12
    expect(r['annual_rent_revenue']?.value).toBe(19_800_000);
    // (19,800,000 + 660,000 + 264,000) / 132,000
    expect(r['blended_revenue_per_kw_month']?.value).toBe(157);
    // 150 / 187.50
    expect(r['rent_index']?.value).toBe(0.8);
    // $160,000,000 / 10,000 — read from frontmatter quick_metrics
    expect(r['price_per_commissioned_kw']?.value).toBe(16_000);
    // $11,200,000 / 10,000 — read from the standard noi_model section
    expect(r['noi_per_commissioned_kw']?.value).toBe(1_120);
    expect(Object.values(r).every((x) => x.ok)).toBe(true);
    expect(Object.keys(r)).toHaveLength(11);
  });

  it('reads the standard sections a module formula names (the RFC 0039 finding)', () => {
    // The §X.2.4 question: a custom class gets no registry per-unit entry, so
    // the module supplies price and NOI per kW itself — from frontmatter
    // `quick_metrics` and the standard `noi_model`. Both resolve.
    const r = results();
    expect(r['price_per_commissioned_kw']?.ok).toBe(true);
    expect(r['noi_per_commissioned_kw']?.ok).toBe(true);
  });

  it('prefers a stated power bill over the computed one', () => {
    const stated = withSection('dc_power', {
      utility_rate_per_kwh: 0.08,
      billing: 'metered_pass_through',
      power_margin: null,
      stated_annual_power_cost: 9_900_000,
    });
    const r = results(stated);
    expect(r['annual_power_cost']?.value).toBe(9_900_000);
    // 9,900,000 / 132,000
    expect(r['power_cost_per_kw_month']?.value).toBe(75);
  });

  it('reports absent inputs as null rather than inventing a number', () => {
    const noComp = withSection('dc_revenue', { ...REVENUE, market_rent_per_kw_month: null });
    const r = results(noComp);
    expect(r['rent_index']?.value).toBeNull();
    expect(r['annual_rent_revenue']?.value).toBe(19_800_000);

    const noRevenue = withoutSection('dc_revenue');
    const r2 = results(noRevenue);
    expect(r2['annual_rent_revenue']?.value).toBeNull();
    expect(r2['blended_revenue_per_kw_month']?.value).toBeNull();
    expect(r2['rent_index']?.value).toBeNull();
    // The capacity-only calcs are unaffected.
    expect(r2['facility_load_kw']?.value).toBe(12_500);
  });
});

describe('validations', () => {
  it('fires CC-MOD-DC-04 and CC-MOD-DC-07 on the fixture, both warnings, nothing else', () => {
    const issues = validateAgainstModules(parsed, registry);
    expect(issues.map((i) => i.code).sort()).toEqual(['CC-MOD-DC-04', 'CC-MOD-DC-07']);
    expect(issues.every((i) => i.severity === 'warning')).toBe(true);
    expect(issues[0]?.remediation).toContain(DATA_CENTER_MODULE_ID);
  });

  it('raises CC-MOD-DC-01 as an ERROR for a PUE below one', () => {
    const issue = validateAgainstModules(
      withSection('dc_capacity', { ...CAPACITY, design_pue: 0.85 }),
      registry,
    ).find((i) => i.code === 'CC-MOD-DC-01');
    expect(issue?.severity).toBe('error');
  });

  it('warns CC-MOD-DC-02 above 1.6 and clears it at the threshold', () => {
    const codesAt = (design_pue: number) =>
      validateAgainstModules(withSection('dc_capacity', { ...CAPACITY, design_pue, measured_pue: null }), registry).map((i) => i.code);
    expect(codesAt(1.6)).not.toContain('CC-MOD-DC-02');
    expect(codesAt(1.61)).toContain('CC-MOD-DC-02');
  });

  it('raises CC-MOD-DC-03 as an ERROR when commissioned exceeds planned', () => {
    const issue = validateAgainstModules(
      withSection('dc_capacity', { ...CAPACITY, planned_it_load_kw: 9000 }),
      registry,
    ).find((i) => i.code === 'CC-MOD-DC-03');
    expect(issue?.severity).toBe('error');
  });

  it('clears CC-MOD-DC-04 once contracted load is within commissioned', () => {
    const codes = validateAgainstModules(
      withSection('dc_capacity', { ...CAPACITY, contracted_it_load_kw: 10000 }),
      registry,
    ).map((i) => i.code);
    expect(codes).not.toContain('CC-MOD-DC-04');
  });

  it('warns CC-MOD-DC-05 when the utility feed is below the facility load', () => {
    // 10,000 x 1.25 = 12,500 kW of facility load against a 12,000 kW feed.
    const issue = validateAgainstModules(
      withSection('dc_capacity', { ...CAPACITY, utility_feed_kw: 12000 }),
      registry,
    ).find((i) => i.code === 'CC-MOD-DC-05');
    expect(issue?.severity).toBe('warning');
  });

  it('warns CC-MOD-DC-06 when measured PUE runs more than 15% over design, and stays silent when unmeasured', () => {
    // 1.25 x 1.15 = 1.4375; 1.44 is over, null is not yet operating.
    const over = validateAgainstModules(
      withSection('dc_capacity', { ...CAPACITY, measured_pue: 1.44 }),
      registry,
    ).map((i) => i.code);
    expect(over).toContain('CC-MOD-DC-06');
    const unmeasured = validateAgainstModules(
      withSection('dc_capacity', { ...CAPACITY, measured_pue: null }),
      registry,
    ).map((i) => i.code);
    expect(unmeasured).not.toContain('CC-MOD-DC-06');
  });

  it('stays silent about a comp set the document does not have', () => {
    // The null guard in CC-MOD-DC-07. Without it every data center without a
    // comp set would carry a permanent below-market warning.
    const codes = validateAgainstModules(
      withSection('dc_revenue', { ...REVENUE, market_rent_per_kw_month: null }),
      registry,
    ).map((i) => i.code);
    expect(codes).not.toContain('CC-MOD-DC-07');
  });

  it('clears CC-MOD-DC-07 at the 0.85 boundary', () => {
    // 150 / 176.470588... rounds to 0.85 at four places; the rule is >=.
    const codes = validateAgainstModules(
      withSection('dc_revenue', { ...REVENUE, market_rent_per_kw_month: 176.4705 }),
      registry,
    ).map((i) => i.code);
    expect(codes).not.toContain('CC-MOD-DC-07');
  });

  it('requires dc_capacity, and says which module asked', () => {
    const issue = validateAgainstModules(withoutSection('dc_capacity'), registry).find(
      (i) => i.code === 'MOD-SECTION-MISSING',
    );
    expect(issue?.severity).toBe('error');
    expect(issue?.section).toBe('dc_capacity');
    expect(issue?.message).toContain(DATA_CENTER_MODULE_ID);
  });

  it('does not apply to the same file relabelled industrial', () => {
    // The module declares org.uwmd.data_center and enhances no builtin, so a
    // document that says `industrial` gets nothing from it — no calcs, no
    // findings, and in particular no MOD-SECTION-MISSING.
    const industrial = structuredClone(parsed) as typeof parsed;
    (industrial.frontmatter as { asset_class: string }).asset_class = 'industrial';
    delete (industrial.frontmatter as { modules?: unknown }).modules;
    expect(validateAgainstModules(industrial, registry)).toEqual([]);
    expect(evaluateModuleCalculations(industrial, registry)).toEqual([]);
  });
});

/** The fixture with one section's content swapped. */
function withSection(sectionId: string, content: Record<string, unknown>): typeof parsed {
  const clone = structuredClone(parsed) as typeof parsed;
  // The example authors its sections flat — the fields sit beside `_meta`
  // inside the fenced object rather than under a `content` key — so the
  // block's content IS the section body. Keep `_meta`, replace the rest.
  const block = (clone.sections as Record<string, { content: Record<string, unknown> }>)[sectionId];
  const meta = block.content['_meta'];
  block.content = { _meta: meta, ...content };
  return clone;
}

/** The fixture with one section removed. */
function withoutSection(sectionId: string): typeof parsed {
  const clone = structuredClone(parsed) as typeof parsed;
  delete (clone.sections as Record<string, unknown>)[sectionId];
  return clone;
}
