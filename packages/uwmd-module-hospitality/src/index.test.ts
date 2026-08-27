// The end-to-end test RFC 0006 exists to make possible: load a real external
// module into a real registry, run it against a real file, and check that the
// numbers and the findings come out.
//
// Everything here goes through the published surface of `@uwmd/core`. A
// reference module that reached into the library's internals would demonstrate
// nothing about what an external author can actually do.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createModuleRegistry,
  evaluateModuleCalculations,
  loadModuleManifest,
  parseUWFile,
  validateAgainstModules,
  type ModuleManifest,
} from '@uwmd/core';
import { HOSPITALITY_MODULE, HOSPITALITY_MODULE_ID, HOSPITALITY_VIEW_MODELS } from './index.js';

const FIXTURE = resolve(__dirname, '../test/fixtures/boutique-hotel-austin.uwx.md');
const parsed = parseUWFile(readFileSync(FIXTURE, 'utf8'));
const registry = createModuleRegistry({
  modules: [HOSPITALITY_MODULE],
  hostTier: 'tier-3-calc-host',
});

/** Every calc result, keyed by id, for the fixture. */
function results(file = parsed) {
  return Object.fromEntries(
    evaluateModuleCalculations(file, registry).map(({ result }) => [result.calc_id, result]),
  );
}

describe('the manifest itself', () => {
  it('loads against the protocol loader with no findings', () => {
    const loaded = loadModuleManifest(HOSPITALITY_MODULE, { hostTier: 'tier-3-calc-host' });
    expect(loaded.errors).toEqual([]);
    expect(loaded.ok).toBe(true);
  });

  it('is refused by a host below its declared tier', () => {
    // Not a defect: the module's whole contribution beyond structure is its
    // calculations, and a Tier-1 reader cannot run them.
    const loaded = loadModuleManifest(HOSPITALITY_MODULE, { hostTier: 'tier-1-reader' });
    expect(loaded.ok).toBe(false);
  });

  it('is frozen, and its view models are the typed ones', () => {
    expect(Object.isFrozen(HOSPITALITY_MODULE)).toBe(true);
    expect(HOSPITALITY_MODULE.view_models).toHaveLength(HOSPITALITY_VIEW_MODELS.length);
    expect(HOSPITALITY_MODULE.view_models?.map((v) => v.section_id)).toEqual([
      'hotel_metrics',
      'hotel_brand',
      'hotel_food_beverage',
    ]);
  });

  it('stores occupancy as a fraction, and says so in the schema', () => {
    const metrics = HOSPITALITY_MODULE.sections?.find((s) => s.id === 'hotel_metrics');
    const occupancy = (metrics?.schema.properties as Record<string, { maximum?: number }>).occupancy;
    expect(occupancy?.maximum).toBe(1);
  });
});

describe('calculations', () => {
  it('computes every declared calc from the fixture', () => {
    const r = results();
    // 180 x 0.72
    expect(r['revpar']?.value).toBe(129.6);
    // 180 x 0.72 x 29,200
    expect(r['total_room_revenue']?.value).toBe(3_784_320);
    // 3,784,320 / 80
    expect(r['room_revenue_per_key']?.value).toBe(47_304);
    // 129.60 / 160
    expect(r['revpar_index']?.value).toBe(0.81);
    // (900,000 - 270,000 - 380,000) / 900,000
    expect(r['fb_gross_margin']?.value).toBe(0.2778);
  });

  it('threads results forward, so a calc can build on an earlier one', () => {
    // `room_revenue_per_key` divides `total_room_revenue`, and `revpar_index`
    // divides `revpar`. Both would evaluate to a reference error if the runtime
    // did not carry prior results between declarations.
    const r = results();
    expect(r['room_revenue_per_key']?.ok).toBe(true);
    expect(r['revpar_index']?.ok).toBe(true);
  });

  it('reports absent inputs as null rather than inventing a number', () => {
    const noComp = withSection('hotel_metrics', { adr: 180, occupancy: 0.72, available_room_nights: 29200, key_count: 80 });
    const r = results(noComp);
    expect(r['revpar']?.value).toBe(129.6);
    expect(r['revpar_index']?.value).toBeNull();
  });
});

describe('validations', () => {
  it('fires both warning rules on the fixture and no errors', () => {
    const issues = validateAgainstModules(parsed, registry);
    const codes = issues.map((i) => i.code).sort();
    expect(codes).toEqual(['CC-MOD-HOSP-01', 'CC-MOD-HOSP-03']);
    expect(issues.every((i) => i.severity === 'warning')).toBe(true);
    // Attribution matters: a reader must be able to tell a module's finding
    // from a built-in one without memorizing prefixes.
    expect(issues[0]?.remediation).toContain(HOSPITALITY_MODULE_ID);
  });

  it('stays silent about a comp set the document does not have', () => {
    // The null guard in CC-MOD-HOSP-01. Without it every hotel file lacking an
    // STR report would carry a permanent underperformance warning.
    const noComp = withSection('hotel_metrics', {
      adr: 180,
      occupancy: 0.72,
      available_room_nights: 29200,
      key_count: 80,
      market_revpar: null,
    });
    const codes = validateAgainstModules(noComp, registry).map((i) => i.code);
    expect(codes).not.toContain('CC-MOD-HOSP-01');
  });

  it('clears CC-MOD-HOSP-01 once RevPAR is within 15% of market', () => {
    const strong = withSection('hotel_metrics', {
      adr: 180,
      occupancy: 0.72,
      available_room_nights: 29200,
      key_count: 80,
      market_revpar: 140,
    });
    const codes = validateAgainstModules(strong, registry).map((i) => i.code);
    expect(codes).not.toContain('CC-MOD-HOSP-01');
  });

  it('raises CC-MOD-HOSP-02 as an ERROR when occupancy is a percentage', () => {
    // The mistake the module exists to catch: 72 instead of 0.72.
    const percent = withSection('hotel_metrics', {
      adr: 180,
      occupancy: 72,
      available_room_nights: 29200,
      key_count: 80,
      market_revpar: 160,
    });
    const issue = validateAgainstModules(percent, registry).find((i) => i.code === 'CC-MOD-HOSP-02');
    expect(issue?.severity).toBe('error');
  });

  it('clears CC-MOD-HOSP-03 when the fee burden is at the threshold, not over it', () => {
    // 6% + 2% + 5% = 13%, and the rule is <=. Boundary, deliberately.
    const cheaper = withSection('hotel_brand', {
      flag: 'Marriott Autograph Collection',
      franchise_fee_pct_of_rooms: 0.06,
      marketing_fund_pct: 0.02,
      loyalty_program_pct: 0.05,
      term_years: 20,
    });
    const codes = validateAgainstModules(cheaper, registry).map((i) => i.code);
    expect(codes).not.toContain('CC-MOD-HOSP-03');
  });

  it('requires hotel_metrics, and says which module asked', () => {
    const withoutMetrics = structuredClone(parsed) as typeof parsed;
    delete (withoutMetrics.sections as Record<string, unknown>)['hotel_metrics'];
    const issue = validateAgainstModules(withoutMetrics, registry).find(
      (i) => i.code === 'MOD-SECTION-MISSING',
    );
    expect(issue?.severity).toBe('error');
    expect(issue?.section).toBe('hotel_metrics');
    expect(issue?.message).toContain(HOSPITALITY_MODULE_ID);
  });

  it('does not apply to a non-hospitality document', () => {
    const office = structuredClone(parsed) as typeof parsed;
    (office.frontmatter as { asset_class: string }).asset_class = 'office';
    expect(validateAgainstModules(office, registry)).toEqual([]);
  });

  it('reports a rule that fails at evaluation as MOD-RULE-ERROR, not silence', () => {
    // A silently skipped rule is a rule its author believes is protecting them.
    //
    // Note the rule PARSES — an unparseable one never gets this far, because
    // the loader refuses the whole manifest at load time (PROTO-MOD-026). This
    // covers the gap the loader cannot: an expression that is grammatical and
    // still cannot run.
    const broken: ModuleManifest = {
      ...HOSPITALITY_MODULE,
      id: 'org.uwmd.hospitality.broken',
      validations: [
        {
          code: 'CC-MOD-HOSP-99',
          severity: 'error',
          message: 'never seen',
          rule: 'no_such_builtin(hotel_metrics.adr) > 0',
        },
      ],
    };
    const brokenRegistry = createModuleRegistry({
      modules: [broken],
      hostTier: 'tier-3-calc-host',
    });
    const issue = validateAgainstModules(parsed, brokenRegistry).find(
      (i) => i.code === 'MOD-RULE-ERROR',
    );
    expect(issue?.severity).toBe('error');
    expect(issue?.message).toContain('CC-MOD-HOSP-99');
  });
});

/** The fixture with one section's content swapped. */
function withSection(sectionId: string, content: Record<string, unknown>): typeof parsed {
  const clone = structuredClone(parsed) as typeof parsed;
  // The parser stores the whole fenced object as `block.content`; the section
  // body lives one level in, under its `content` key. Replace that, not the
  // wrapper, or `_meta` disappears along with it.
  const block = (clone.sections as Record<string, { content: Record<string, unknown> }>)[sectionId];
  block.content['content'] = content;
  return clone;
}
