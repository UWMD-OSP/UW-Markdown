import { describe, expect, it } from 'vitest';
import { parseUWLite } from './lite.js';
import {
  compileUWLite,
  projectUWEnvelopeToLite,
  stringifyUWX,
  UW_LITE_SOURCE_EXTENSION,
} from './lite-bridge.js';
import type { UWEnvelopeBlock, UWEnvelopeSectionEntry } from './envelope.js';
import { getSection, parseUWFile } from './parser.js';

/**
 * Narrow a section entry to a single block.
 *
 * `'content' in entry` does not narrow this union on its own: the other arm is
 * the multi-variant map `Record<string, UWEnvelopeBlock>`, and a string index
 * signature means TypeScript cannot rule out a `content` key on it. So the
 * check is a runtime one and the cast is explicit, in one place.
 */
function singleBlock(entry: UWEnvelopeSectionEntry | undefined): UWEnvelopeBlock {
  if (!entry || !('annotation' in entry)) throw new Error('expected a single block');
  return entry as UWEnvelopeBlock;
}

const LITE = [
  '---',
  'uw_lite_version: 1.0',
  'deal_id: uw_lite_test',
  'deal_name: Lite Test',
  'created: 2026-07-29T00:00:00Z',
  'asset_class: multifamily',
  '---',
  '',
  '# Acquisition',
  '',
  '- Purchase price: $12,500,000 <!-- uw:acquisition.purchase_price -->',
  '- Going-in cap rate: 5.5% <!-- uw:valuation.going_in_cap_rate scenario=base -->',
  '- Loan amount: $8,000,000 <!-- uw:debt.loan_amount -->',
  '',
  'Narrative retained in the source extension.',
].join('\n');

describe('compileUWLite', () => {
  it('maps supported Lite anchors into the shared envelope model', () => {
    const result = compileUWLite(parseUWLite(LITE));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.envelope.frontmatter).toMatchObject({
      uw_version: '1.1',
      deal_id: 'uw_lite_test',
      deal_name: 'Lite Test',
    });
    expect(result.envelope.sections['valuation']).toMatchObject({
      content: {
        purchase_price: 12_500_000,
        going_in_cap_rate: 0.055,
      },
    });
    expect(result.envelope.sections['debt_structure']).toMatchObject({
      content: { loan_amount: 8_000_000 },
    });
    expect(result.report.defaults).toContainEqual(
      expect.objectContaining({ path: 'frontmatter.uw_version', value: '1.1' }),
    );
  });

  it('preserves the complete Lite source in a namespaced extension', () => {
    const result = compileUWLite(parseUWLite(LITE));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.envelope.extensions[UW_LITE_SOURCE_EXTENSION]?.content).toMatchObject({
      representation: 'uw-lite-markdown',
      markdown: LITE,
    });
  });

  it('rejects unknown fields and non-base scenarios', () => {
    const unknown = LITE
      .replace('acquisition.purchase_price', 'mystery.purchase_price')
      .replace('scenario=base', 'scenario=downside');
    const result = compileUWLite(parseUWLite(unknown));
    expect(result.ok).toBe(false);
    expect(result.report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'LITE_COMPILE_FIELD_UNKNOWN' }),
        expect.objectContaining({ code: 'LITE_COMPILE_SCENARIO_UNSUPPORTED' }),
      ]),
    );
  });

  it('requires deterministic identity and provenance frontmatter', () => {
    const result = compileUWLite(
      parseUWLite(LITE.replace('deal_id: uw_lite_test\n', '').replace('created: 2026-07-29T00:00:00Z\n', '')),
    );
    expect(result.ok).toBe(false);
    expect(result.report.issues).toContainEqual(
      expect.objectContaining({ code: 'LITE_COMPILE_FRONTMATTER_REQUIRED' }),
    );
  });
});

describe('UWX bridge rendering and Lite projection', () => {
  it('emits structured UWX that the existing parser can read', () => {
    const result = compileUWLite(parseUWLite(LITE));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const uwx = stringifyUWX(result.envelope);
    const parsed = parseUWFile(uwx, { strict: true });
    expect(getSection(parsed, 'valuation')?.content).toMatchObject({
      purchase_price: 12_500_000,
      going_in_cap_rate: 0.055,
    });
    expect(parsed.extensions[UW_LITE_SOURCE_EXTENSION]?.content['markdown']).toBe(LITE);
  });

  it('retains append-only superseded history in UWX output', () => {
    const result = compileUWLite(parseUWLite(LITE));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const valuation = singleBlock(result.envelope.sections['valuation']);
    const prior = structuredClone(valuation);
    prior.annotation.superseded = true;
    prior.annotation.v = 0;
    const meta = prior.content['_meta'];
    if (!meta || typeof meta !== 'object') throw new Error('expected metadata');
    Object.assign(meta, { superseded: true, version: 0 });
    prior.content['purchase_price'] = 12_000_000;
    result.envelope.superseded['valuation'] = [prior];

    const parsed = parseUWFile(stringifyUWX(result.envelope), { strict: true });
    expect(parsed.superseded['valuation']).toHaveLength(1);
    expect(parsed.superseded['valuation']?.[0]?.content['purchase_price']).toBe(12_000_000);
    expect(getSection(parsed, 'valuation')?.content['purchase_price']).toBe(12_500_000);
  });

  it('projects supported fields and reports omitted advanced data', () => {
    const result = compileUWLite(parseUWLite(LITE));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const valuation = singleBlock(result.envelope.sections['valuation']);
    valuation.content['advanced_only'] = 42;
    const projection = projectUWEnvelopeToLite(result.envelope);
    expect(parseUWLite(projection.content).issues).toEqual([]);
    expect(projection.content).toContain(
      '$12,500,000 <!-- uw:acquisition.purchase_price -->',
    );
    expect(projection.report).toMatchObject({
      lossy: true,
      omitted_paths: expect.arrayContaining(['valuation.advanced_only']),
    });
    expect(projection.report.externalized_sections).toEqual([]);
  });

  // RFC 0021 §3: projection is UWX→Lite only and never resolves fragments, so a
  // section whose rows live in `.uwpart.md` files is invisible to the envelope.
  // Naming it is the only complete account of the loss available.
  describe('externalized sections (RFC 0021 §3)', () => {
    function compiled() {
      const result = compileUWLite(parseUWLite(LITE));
      if (!result.ok) throw new Error('fixture must compile');
      return result.envelope;
    }

    it('names an externalized section and stays lossy', () => {
      const envelope = compiled();
      const valuation = singleBlock(envelope.sections['valuation']);
      valuation.content['external'] = {
        parts: ['comp-a', 'comp-b'],
        collection_key: 'comp_id',
        collection_path: 'comps',
        part_count: 2,
      };
      const projection = projectUWEnvelopeToLite(envelope);

      expect(projection.report.externalized_sections).toEqual(['valuation']);
      expect(projection.report.lossy).toBe(true);
      expect(projection.report.warnings.join(' ')).toContain('valuation');
    });

    // The regression that motivated the field. Reporting the directive's own
    // keys as omitted content made an externalized record look *less* lossy
    // than its inline twin — the wrapper standing in for the contents.
    it('never reports the directive keys as omitted content', () => {
      const envelope = compiled();
      singleBlock(envelope.sections['valuation']).content['external'] = {
        parts: ['comp-a'],
        collection_key: 'comp_id',
        collection_path: 'comps',
        part_count: 1,
      };
      const omitted = projectUWEnvelopeToLite(envelope).report.omitted_paths;

      expect(omitted.filter((p) => p.includes('.external.'))).toEqual([]);
      expect(omitted).not.toContain('valuation.external.part_count');
    });

    // Validity is composition's business. A projection that threw here would
    // deny a reader the one report telling them what the document is missing.
    it('does not throw on a malformed directive', () => {
      const envelope = compiled();
      singleBlock(envelope.sections['valuation']).content['external'] = { parts: 'not-an-array' };

      expect(() => projectUWEnvelopeToLite(envelope)).not.toThrow();
      expect(projectUWEnvelopeToLite(envelope).report.externalized_sections).toEqual([
        'valuation',
      ]);
    });
  });
});

// ─── RFC 0027 — any class's size intensive crosses the bridge ────────────────

describe('size intensives cross the bridge (RFC 0027)', () => {
  const OFFICE_LITE = [
    '---',
    'uw_lite_version: 1.0',
    'deal_id: uw_lite_office',
    'deal_name: Lite Office',
    'created: 2026-08-25T00:00:00Z',
    'asset_class: office',
    '---',
    '',
    '# Property',
    '',
    '- Rentable square feet: 42,500 <!-- uw:property.rentable_square_feet -->',
  ].join('\n');

  it('a Lite summary can state an office RSF', () => {
    const result = compileUWLite(parseUWLite(OFFICE_LITE));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.envelope.sections['property']).toMatchObject({
      content: { rentable_square_feet: 42_500 },
    });
  });

  it('round-trips: Lite → envelope → Lite keeps the RSF anchor and value', () => {
    const result = compileUWLite(parseUWLite(OFFICE_LITE));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const projection = projectUWEnvelopeToLite(result.envelope);
    expect(projection.content).toContain('<!-- uw:property.rentable_square_feet -->');
    const back = compileUWLite(parseUWLite(projection.content));
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.envelope.sections['property']).toMatchObject({
      content: { rentable_square_feet: 42_500 },
    });
  });

  it('every registered size intensive has a bridge anchor', async () => {
    const { SIZE_INTENSIVES } = await import('./protocol.js');
    const { UW_LITE_FIELD_MAPPINGS } = await import('./lite-bridge.js');
    const litePaths = new Set(UW_LITE_FIELD_MAPPINGS.map((m) => m.lite_path));
    for (const [cls, entry] of Object.entries(SIZE_INTENSIVES)) {
      for (const path of [entry.path, ...entry.secondary]) {
        expect(litePaths.has(`property.${path}`), `${cls}: property.${path}`).toBe(true);
      }
    }
  });
});
