// Market-data documents through the starter cascade (RFC 0019). The documents,
// lookups and promotion are @uwmd/verify's (market-data.test.ts there); these
// two cases resolve through `resolveValue`, so they moved here with the cascade
// (RFC 0083).
import { describe, expect, it } from 'vitest';
import {
  buildMeta,
  createDocumentMarketData,
  parseUWFile,
  type MarketDataDocument,
  type UWMeta,
  type UWProvenance,
} from '@uwmd/verify';
import { resolveValue } from './cascade.js';

/** A Format 3.0 `_meta`; `provenance` members override the defaults. */
const fixtureMeta = (section: string, timestamp: string, provenance: Partial<UWProvenance>): UWMeta => {
  const meta = buildMeta(section, 1, { source: 'manual', actor: 'test', confidence: 'high', timestamp });
  return { ...meta, provenance: { ...meta.provenance, ...provenance } };
};

const AS_OF = '2026-06-30';
const NOW = new Date('2026-07-15T00:00:00Z');

function doc(overrides: Partial<MarketDataDocument> = {}): MarketDataDocument {
  return {
    document_id: 'md:phx-multifamily:2026-Q2',
    as_of: AS_OF,
    provider: 'Example Research LLC',
    geo: 'Phoenix-Mesa-Chandler, AZ',
    asset_class: 'multifamily',
    observations: [
      {
        field_path: 'valuation.going_in_cap_rate',
        value: 0.0545,
        unit: 'fraction',
        range: { low: 0.051, central: 0.0545, high: 0.059 },
        basis: '42 closed sales, trailing 12 months',
        confidence: 'medium',
      },
    ],
    ...overrides,
  };
}

describe('createDocumentMarketData through the cascade', () => {
  it('falls through to asset_class_default once stale, through the real cascade', () => {
    // Uses `valuation.exit_cap_rate_pct`, which the multifamily defaults table
    // actually carries — the fall-through is only observable on a path that has
    // somewhere to fall to.
    const observed = doc({
      observations: [
        {
          field_path: 'valuation.exit_cap_rate_pct',
          value: 0.0575,
          unit: 'fraction',
          basis: '42 closed sales, trailing 12 months',
        },
      ],
    });
    const deal = parseUWFile(
      [
        '---',
        "uw_version: \"3.0\"",
        'deal_id: uw_test',
        'asset_class: multifamily',
        '---',
        '',
        '## Valuation {#valuation}',
        '',
        '```json uw:section=valuation v=1',
        '{ "_meta": { "section": "valuation", "provenance": { "source": "manual", "resolution": "user_input", "actor": "test", "agent_id": null, "agent_version": null, "timestamp": "2026-06-01T00:00:00Z", "notes": null }, "quality": { "confidence": "high", "human_review_required": false, "flags": [] }, "lifecycle": { "revision": 1, "superseded": false } } }',
        '```',
      ].join('\n'),
    );

    const fresh = resolveValue('valuation.exit_cap_rate_pct', deal, {
      market: createDocumentMarketData(observed, { now: NOW }),
    });
    expect(fresh.step).toBe('market_data');
    expect(fresh.value).toBe(0.0575);
    expect(fresh.resolved_from).toBe('md:phx-multifamily:2026-Q2');

    const stale = resolveValue('valuation.exit_cap_rate_pct', deal, {
      market: createDocumentMarketData(observed, { now: new Date('2027-01-01T00:00:00Z') }),
    });
    expect(stale.step).toBe('asset_class_default');
    expect(stale.value).not.toBe(0.0575);
  });
});

describe('promoteMarketObservation through the cascade', () => {
  const DIGEST = `sha256:${'a'.repeat(64)}`;

  it('resolves at the user_input step while keeping its own source tag', () => {
    // Promotion makes the value an input of record, so it must outrank a live
    // market lookup — you accepted one vintage and a newer pull must not
    // silently replace it — while staying distinguishable from typed input.
    const deal = parseUWFile(
      [
        '---',
        "uw_version: \"3.0\"",
        'deal_id: uw_promoted',
        'asset_class: multifamily',
        '---',
        '',
        '## Valuation {#valuation}',
        '',
        '```json uw:section=valuation v=1',
        JSON.stringify({
          _meta: fixtureMeta('valuation', '2026-07-01T00:00:00Z', {
            resolution: 'market_data_accepted',
            actor: 'analyst@example.com',
            market_data_ref: {
              document_id: 'md:phx-multifamily:2026-Q2',
              as_of: AS_OF,
              digest: DIGEST,
            },
          }),
          exit_cap_rate_pct: 0.0595,
        }),
        '```',
      ].join('\n'),
    );

    // A *different*, fresher observation set is in scope; the promoted value
    // must still win.
    const fresher = createDocumentMarketData(
      doc({
        document_id: 'md:newer',
        as_of: '2026-07-31',
        observations: [
          {
            field_path: 'valuation.exit_cap_rate_pct',
            value: 0.0625,
            unit: 'fraction',
            basis: 'later pull',
          },
        ],
      }),
      { now: new Date('2026-08-01T00:00:00Z') },
    );

    const resolved = resolveValue('valuation.exit_cap_rate_pct', deal, { market: fresher });
    expect(resolved.value).toBe(0.0595);
    expect(resolved.step).toBe('user_input');
    expect(resolved.source).toBe('market_data_accepted');
  });
});
