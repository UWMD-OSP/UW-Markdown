import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  createDocumentMarketData,
  DEFAULT_MARKET_DATA_STALENESS_SECONDS,
  isDealFieldPath,
  isValidAsOf,
  MARKET_DATA_PROFILE_ID,
  MarketDataError,
  parseMarketDataDocument,
  selectCurrentMarketData,
  validateMarketDataDocument,
  type MarketDataDocument,
} from './market-data.js';
import { parseUWFile } from './parser.js';
import { resolveValue } from './cascade.js';
import { lookupDocumentProfile, STANDARD_SECTION_IDS } from './protocol.js';

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

describe('STANDARD_SECTION_IDS', () => {
  it('matches the section ids FORMAT_SPEC Part IV declares', () => {
    // Read the spec rather than restating it: this is the check that keeps the
    // list from drifting the way BUILTIN_VIEW_MODELS did.
    const specPath = fileURLToPath(new URL('../../../spec/UW_FORMAT_SPEC_v1.md', import.meta.url));
    const spec = readFileSync(specPath, 'utf-8');
    const declared = [...spec.matchAll(/^\*\*ID:\*\* `([a-z_]+)`/gm)].map((m) => m[1]!);
    expect(declared.length).toBeGreaterThan(0);
    expect([...STANDARD_SECTION_IDS].sort()).toEqual([...declared].sort());
  });

  it('registers market-data-v1 as an evidence profile', () => {
    const profile = lookupDocumentProfile(MARKET_DATA_PROFILE_ID);
    expect(profile).toBeDefined();
    // Not `underwriting`: no pack applies, and it carries no calculations.
    expect(profile!.financial_role).toBe('evidence');
    expect(profile!.required_identity).toContain('as_of');
    expect(profile!.required_identity).toContain('provider');
  });
});

describe('isValidAsOf', () => {
  it('accepts real calendar dates', () => {
    expect(isValidAsOf('2026-06-30')).toBe(true);
    expect(isValidAsOf('2024-02-29')).toBe(true);
  });

  it('rejects dates that do not exist rather than rolling them forward', () => {
    // `new Date('2026-02-30')` silently becomes March 2 — an observation set
    // dated to a day that never happened.
    expect(isValidAsOf('2026-02-30')).toBe(false);
    expect(isValidAsOf('2025-02-29')).toBe(false);
    expect(isValidAsOf('2026-13-01')).toBe(false);
  });

  it('rejects anything that is not YYYY-MM-DD', () => {
    for (const bad of ['2026-6-30', '30/06/2026', '2026-06-30T00:00:00Z', 'Q2 2026', '']) {
      expect(isValidAsOf(bad)).toBe(false);
    }
  });
});

describe('isDealFieldPath', () => {
  it('accepts a field under a registered section', () => {
    expect(isDealFieldPath('valuation.going_in_cap_rate')).toBe(true);
    expect(isDealFieldPath('operating_statement.total_opex')).toBe(true);
    expect(isDealFieldPath('rent_roll.units[3].current_rent')).toBe(true);
  });

  it('accepts x_ extension sections', () => {
    expect(isDealFieldPath('x_lender_internal.risk_band')).toBe(true);
  });

  it('rejects unknown sections and bare section ids', () => {
    expect(isDealFieldPath('not_a_section.foo')).toBe(false);
    expect(isDealFieldPath('valuation')).toBe(false);
    expect(isDealFieldPath('valuation.')).toBe(false);
    expect(isDealFieldPath('.going_in_cap_rate')).toBe(false);
  });
});

describe('validateMarketDataDocument', () => {
  it('accepts a conforming document', () => {
    expect(validateMarketDataDocument(doc())).toEqual([]);
  });

  it('refuses a missing as_of rather than storing it blank', () => {
    const errors = validateMarketDataDocument({ ...doc(), as_of: '' });
    expect(errors.map((e) => e.code)).toContain('MD-003');
  });

  it('refuses a missing provider', () => {
    const errors = validateMarketDataDocument({ ...doc(), provider: '' });
    expect(errors.map((e) => e.code)).toContain('MD-002');
  });

  it('refuses an empty basis — a number with no basis is an assertion', () => {
    const bad = doc();
    bad.observations[0]!.basis = '   ';
    expect(validateMarketDataDocument(bad).map((e) => e.code)).toContain('MD-014');
  });

  it('refuses a field_path no deal record could carry', () => {
    const bad = doc();
    bad.observations[0]!.field_path = 'submarket.vacancy';
    expect(validateMarketDataDocument(bad).map((e) => e.code)).toContain('MD-010');
  });

  it('refuses a deal_id — this is not an underwriting record', () => {
    const errors = validateMarketDataDocument({ ...doc(), deal_id: 'uw_parkview' });
    expect(errors.map((e) => e.code)).toContain('MD-005');
  });

  it('refuses duplicate observations for one path', () => {
    const bad = doc();
    bad.observations.push({ ...bad.observations[0]! });
    expect(validateMarketDataDocument(bad).map((e) => e.code)).toContain('MD-011');
  });

  it('refuses a range that is not ordered low <= central <= high', () => {
    const bad = doc();
    bad.observations[0]!.range = { low: 0.06, central: 0.0545, high: 0.059 };
    expect(validateMarketDataDocument(bad).map((e) => e.code)).toContain('MD-016');
  });

  it('reports every problem, not just the first', () => {
    const errors = validateMarketDataDocument({
      document_id: '',
      as_of: '',
      provider: '',
      geo: '',
      observations: [],
    });
    expect(errors.length).toBeGreaterThan(3);
  });
});

describe('createDocumentMarketData', () => {
  it('resolves an observation and reports the document as its origin', () => {
    const lookup = createDocumentMarketData(doc(), { now: NOW });
    const hit = lookup.resolve('valuation.going_in_cap_rate', { asset_class: 'multifamily' });
    expect(hit).not.toBeNull();
    expect(hit!.value).toBe(0.0545);
    expect(hit!.range).toEqual({ low: 0.051, central: 0.0545, high: 0.059 });
    // The attribution that made receipts over market data reproducible.
    expect(hit!.source_id).toBe('md:phx-multifamily:2026-Q2');
  });

  it('misses on a path it has no observation for', () => {
    const lookup = createDocumentMarketData(doc(), { now: NOW });
    expect(lookup.resolve('debt_structure.interest_rate', { asset_class: 'multifamily' })).toBeNull();
  });

  it('misses on a different asset class or geography', () => {
    const lookup = createDocumentMarketData(doc(), { now: NOW });
    expect(lookup.resolve('valuation.going_in_cap_rate', { asset_class: 'office' })).toBeNull();
    expect(
      lookup.resolve('valuation.going_in_cap_rate', { asset_class: 'multifamily', geo: 'Tucson, AZ' }),
    ).toBeNull();
  });

  it('goes stale from as_of, not from wall clock', () => {
    const lookup = createDocumentMarketData(doc(), {
      now: new Date('2026-12-31T00:00:00Z'),
    });
    // 184 days past as_of, well beyond the 90-day default.
    expect(lookup.resolve('valuation.going_in_cap_rate', { asset_class: 'multifamily' })).toBeNull();
    expect(lookup.staleness_seconds).toBe(DEFAULT_MARKET_DATA_STALENESS_SECONDS);
  });

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
        'uw_version: "1.1"',
        'deal_id: uw_test',
        'asset_class: multifamily',
        '---',
        '',
        '## Valuation {#valuation}',
        '',
        '```json uw:section=valuation v=1',
        '{ "_meta": { "section": "valuation", "version": 1, "superseded": false,',
        '  "source": "user_input", "agent_id": null, "agent_version": null,',
        '  "actor": "test", "ts": "2026-06-01T00:00:00Z" } }',
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

  it('resolves for any asset class when the document declares none', () => {
    const lookup = createDocumentMarketData(doc({ asset_class: undefined }), { now: NOW });
    expect(lookup.resolve('valuation.going_in_cap_rate', { asset_class: 'office' })).not.toBeNull();
  });
});

describe('selectCurrentMarketData', () => {
  it('picks the most recent as_of', () => {
    const older = doc({ document_id: 'md:q1', as_of: '2026-03-31' });
    const newer = doc({ document_id: 'md:q2', as_of: '2026-06-30' });
    expect(selectCurrentMarketData([older, newer]).document_id).toBe('md:q2');
    expect(selectCurrentMarketData([newer, older]).document_id).toBe('md:q2');
  });

  it('raises on a tie rather than letting array order decide', () => {
    const a = doc({ document_id: 'md:vendor-a' });
    const b = doc({ document_id: 'md:vendor-b' });
    expect(() => selectCurrentMarketData([a, b])).toThrow(MarketDataError);
    try {
      selectCurrentMarketData([a, b]);
    } catch (e) {
      expect((e as MarketDataError).code).toBe('MD-020');
      // Both ids named, so the operator knows what to reconcile.
      expect((e as MarketDataError).message).toContain('md:vendor-a');
      expect((e as MarketDataError).message).toContain('md:vendor-b');
    }
  });

  it('does not treat the same document listed twice as a tie', () => {
    const a = doc();
    expect(selectCurrentMarketData([a, { ...a }]).document_id).toBe(a.document_id);
  });

  it('raises on an empty list', () => {
    expect(() => selectCurrentMarketData([])).toThrow(MarketDataError);
  });
});

describe('parseMarketDataDocument', () => {
  const SOURCE = [
    '---',
    'uw_version: "1.1"',
    'document_profile: market-data-v1',
    'document_id: md:phx-multifamily:2026-Q2',
    'as_of: "2026-06-30"',
    'provider: Example Research LLC',
    'geo: Phoenix-Mesa-Chandler, AZ',
    'asset_class: multifamily',
    '---',
    '',
    '## Market Observations {#market_observations}',
    '',
    '```json uw:section=market_observations v=1',
    JSON.stringify(
      {
        _meta: {
          section: 'market_observations',
          version: 1,
          superseded: false,
          source: 'market_data',
          agent_id: null,
          agent_version: null,
          actor: 'conformance',
          ts: '2026-06-30T00:00:00Z',
        },
        observations: [
          {
            field_path: 'valuation.going_in_cap_rate',
            value: 0.0545,
            unit: 'fraction',
            basis: '42 closed sales, trailing 12 months',
          },
        ],
      },
      null,
      2,
    ),
    '```',
  ].join('\n');

  it('reads a well-formed document', () => {
    const parsed = parseMarketDataDocument(parseUWFile(SOURCE));
    expect(parsed.document_id).toBe('md:phx-multifamily:2026-Q2');
    expect(parsed.as_of).toBe('2026-06-30');
    expect(parsed.observations).toHaveLength(1);
  });

  it('refuses a document with the wrong profile', () => {
    const wrong = SOURCE.replace('market-data-v1', 'deal-underwriting-v1');
    expect(() => parseMarketDataDocument(parseUWFile(wrong))).toThrow(MarketDataError);
  });

  it('refuses a document with no observations section', () => {
    const stripped = SOURCE.split('## Market Observations')[0]!;
    try {
      parseMarketDataDocument(parseUWFile(stripped));
      expect.unreachable('should have thrown');
    } catch (e) {
      expect((e as MarketDataError).code).toBe('MD-018');
    }
  });
});
