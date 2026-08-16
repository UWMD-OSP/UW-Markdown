// `market-data-v1` document profile (RFC 0022).
//
// A market-data document carries dated, attributable *observations* — not
// conclusions. It has no `deal_id`, contains no calculations, and no pack
// applies to it. Making an external number attributable is the entire point;
// this module does not make it true.
//
// Two rules carry the profile's weight, and both are refusals rather than
// warnings:
//
//   1. `document_id`, `as_of`, `provider`, and `geo` are required. An
//      observation set with no as-of date or no named provider is not
//      attributable, and storing it with those fields blank would leave a
//      number in the file that nothing can ever trace.
//   2. Every observation states a `basis`. A number with no stated basis is an
//      assertion, and this profile is for observations.
//
// Browser-safe: no network access of any kind. Resolution reads a parsed
// document, never a vendor API — a host querying a live warehouse implements
// `MarketDataLookup` directly and snapshots to a document when it needs a
// receipt.

import type { MarketDataLookup } from './cascade.js';
import {
  EXTENSION_SECTION_PREFIX,
  isStandardSectionId,
  MARKET_DATA_PROFILE,
  type ProtocolError,
} from './protocol.js';
import type { ConfidenceLevel, ParsedUWFile } from './types.js';

export const MARKET_DATA_PROFILE_ID = MARKET_DATA_PROFILE;

/** The section a market-data document carries its observations in. */
export const MARKET_OBSERVATIONS_SECTION = 'market_observations' as const;

export interface MarketObservationRange {
  low: number;
  central: number;
  high: number;
}

export interface MarketObservation {
  /** A path a deal record could carry, e.g. `valuation.going_in_cap_rate`. */
  field_path: string;
  value: unknown;
  unit: string;
  range?: MarketObservationRange;
  /** What the observation rests on — sample size, method. Required, non-empty. */
  basis: string;
  confidence?: ConfidenceLevel;
  [key: string]: unknown;
}

export interface MarketDataDocument {
  document_id: string;
  /** ISO `YYYY-MM-DD`. The observation set's vintage, not the file's mtime. */
  as_of: string;
  provider: string;
  geo: string;
  /** Optional: an observation set may span asset classes. */
  asset_class?: string;
  observations: MarketObservation[];
}

export class MarketDataError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`[${code}] ${message}`);
    this.name = 'MarketDataError';
    this.code = code;
  }
}

function mdError(code: string, message: string, pointer?: string): ProtocolError {
  return { category: 'validate', code, message, ...(pointer ? { pointer } : {}) };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function nonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== '';
}

/**
 * `YYYY-MM-DD`, and a real calendar date. The round-trip check rejects
 * `2026-02-30`, which `Date.parse` would otherwise roll forward to March 2 —
 * silently dating an observation set to a day that does not exist.
 */
const AS_OF_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidAsOf(value: string): boolean {
  if (!AS_OF_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === value;
}

/**
 * A field path is `<section>.<rest>`, where `<section>` is registered by
 * FORMAT_SPEC Part IV or is an `x_` extension section (§ 4.21). The bare
 * section id with no `rest` is rejected: an observation about an entire section
 * is not a value a deal record could carry at a path.
 */
export function isDealFieldPath(path: string): boolean {
  const dot = path.indexOf('.');
  if (dot <= 0 || dot === path.length - 1) return false;
  const section = path.slice(0, dot);
  const rest = path.slice(dot + 1);
  if (rest.trim() === '') return false;
  return isStandardSectionId(section) || section.startsWith(EXTENSION_SECTION_PREFIX);
}

/**
 * Validate a market-data document, returning every problem rather than the
 * first. Returns `[]` when the candidate conforms.
 */
export function validateMarketDataDocument(candidate: unknown): ProtocolError[] {
  const errors: ProtocolError[] = [];
  if (!isRecord(candidate)) {
    return [mdError('MD-001', 'Market-data document must be an object.')];
  }
  const doc = candidate as Partial<MarketDataDocument> & Record<string, unknown>;

  for (const key of ['document_id', 'provider', 'geo'] as const) {
    if (!nonEmptyString(doc[key])) {
      errors.push(mdError('MD-002', `${key} is required and must be a non-empty string.`, key));
    }
  }

  if (!nonEmptyString(doc.as_of)) {
    errors.push(mdError('MD-003', 'as_of is required — an observation set with no vintage is not attributable.', 'as_of'));
  } else if (!isValidAsOf(doc.as_of)) {
    errors.push(mdError('MD-004', `as_of must be a real calendar date as YYYY-MM-DD; got '${doc.as_of}'.`, 'as_of'));
  }

  // A market-data document is not an underwriting record, and the cheapest way
  // for it to be misread as one is to carry a deal_id.
  if ('deal_id' in doc) {
    errors.push(mdError('MD-005', 'A market-data document MUST NOT carry deal_id — it is not an underwriting record.', 'deal_id'));
  }

  if (!Array.isArray(doc.observations)) {
    errors.push(mdError('MD-006', 'observations must be an array.', 'observations'));
    return errors;
  }
  if (doc.observations.length === 0) {
    errors.push(mdError('MD-007', 'observations must not be empty.', 'observations'));
  }

  const seen = new Set<string>();
  doc.observations.forEach((raw, i) => {
    const at = `observations[${i}]`;
    if (!isRecord(raw)) {
      errors.push(mdError('MD-008', 'Observation must be an object.', at));
      return;
    }
    const obs = raw as Partial<MarketObservation> & Record<string, unknown>;

    if (!nonEmptyString(obs.field_path)) {
      errors.push(mdError('MD-009', 'field_path is required.', `${at}.field_path`));
    } else if (!isDealFieldPath(obs.field_path)) {
      errors.push(mdError(
        'MD-010',
        `field_path '${obs.field_path}' is not a path a deal record could carry. It must be <section>.<field> where the section is registered by FORMAT_SPEC Part IV or is an x_ extension section.`,
        `${at}.field_path`,
      ));
    } else if (seen.has(obs.field_path)) {
      // Two observations for one path make resolution order-dependent, which is
      // the one thing a deterministic resolver must never be.
      errors.push(mdError('MD-011', `Duplicate observation for field_path '${obs.field_path}'.`, `${at}.field_path`));
    } else {
      seen.add(obs.field_path);
    }

    if (!('value' in obs)) {
      errors.push(mdError('MD-012', 'value is required.', `${at}.value`));
    }
    if (!nonEmptyString(obs.unit)) {
      errors.push(mdError('MD-013', 'unit is required.', `${at}.unit`));
    }
    if (!nonEmptyString(obs.basis)) {
      errors.push(mdError(
        'MD-014',
        'basis is required and must not be empty — a number with no stated basis is an assertion, not an observation.',
        `${at}.basis`,
      ));
    }

    if (obs.range !== undefined) {
      const r = obs.range as Partial<MarketObservationRange>;
      if (!isRecord(r) || !['low', 'central', 'high'].every((k) => typeof r[k as keyof typeof r] === 'number')) {
        errors.push(mdError('MD-015', 'range must carry numeric low, central, and high.', `${at}.range`));
      } else if (!((r.low as number) <= (r.central as number) && (r.central as number) <= (r.high as number))) {
        errors.push(mdError(
          'MD-016',
          `range must satisfy low <= central <= high; got ${r.low}, ${r.central}, ${r.high}.`,
          `${at}.range`,
        ));
      }
    }
  });

  return errors;
}

/**
 * Read a market-data document out of a parsed UW file, refusing rather than
 * repairing. Throws `MarketDataError` naming the first problem.
 */
export function parseMarketDataDocument(parsed: ParsedUWFile): MarketDataDocument {
  const frontmatter = parsed.frontmatter as Record<string, unknown>;
  const profile = frontmatter.document_profile;
  if (profile !== MARKET_DATA_PROFILE_ID) {
    throw new MarketDataError(
      'MD-017',
      `Expected document_profile '${MARKET_DATA_PROFILE_ID}'; got ${
        profile === undefined ? 'none' : `'${String(profile)}'`
      }.`,
    );
  }

  const entry = parsed.sections[MARKET_OBSERVATIONS_SECTION];
  if (!entry) {
    throw new MarketDataError(
      'MD-018',
      `A market-data document must carry a '${MARKET_OBSERVATIONS_SECTION}' section.`,
    );
  }
  const block = 'annotation' in (entry as object)
    ? (entry as { content: unknown })
    : Object.values(entry as Record<string, { content: unknown }>)[0]!;
  const content = block.content as Record<string, unknown> | undefined;

  const candidate = {
    document_id: frontmatter.document_id,
    as_of: frontmatter.as_of,
    provider: frontmatter.provider,
    geo: frontmatter.geo,
    ...(frontmatter.asset_class !== undefined ? { asset_class: frontmatter.asset_class } : {}),
    ...('deal_id' in frontmatter ? { deal_id: frontmatter.deal_id } : {}),
    observations: content?.observations,
  };

  const errors = validateMarketDataDocument(candidate);
  if (errors.length > 0) {
    throw new MarketDataError(errors[0]!.code, errors.map((e) => e.message).join('; '));
  }
  return candidate as MarketDataDocument;
}

// ─── Resolution ──────────────────────────────────────────────────────────────

export interface DocumentMarketDataOptions {
  /** Clock for the staleness check. Injectable so tests are not time-dependent. */
  now?: Date;
  /**
   * How long an observation remains usable, from `as_of`. Defaults to 90 days,
   * a quarter — the cadence most published market series actually move at.
   */
  staleness_seconds?: number;
  /**
   * Geography this deal sits in. When set, an observation set for a different
   * `geo` does not resolve. Matching is exact; normalizing place names is a
   * judgment call this module deliberately declines to make.
   */
  geo?: string;
}

/** 90 days. */
export const DEFAULT_MARKET_DATA_STALENESS_SECONDS = 90 * 24 * 60 * 60;

/**
 * Wrap a market-data document as a `MarketDataLookup`, so it drops into the
 * existing cascade with no change to `resolveValue`.
 *
 * Staleness is measured from the document's `as_of`, not from a wall-clock
 * guess about when the file was written. A stale observation resolves to
 * `null`, so the cascade falls through to `asset_class_default` — the value is
 * not silently used past its vintage.
 */
export function createDocumentMarketData(
  doc: MarketDataDocument,
  opts: DocumentMarketDataOptions = {},
): MarketDataLookup {
  const staleness = opts.staleness_seconds ?? DEFAULT_MARKET_DATA_STALENESS_SECONDS;
  const byPath = new Map(doc.observations.map((o) => [o.field_path, o]));

  return {
    staleness_seconds: staleness,
    resolve(field_path, context) {
      if (doc.asset_class !== undefined && doc.asset_class !== context.asset_class) return null;

      // `context.geo` is the caller's; `opts.geo` lets a host pin one without
      // threading it through every cascade call. Either mismatching is a miss.
      const wantedGeo = context.geo ?? opts.geo;
      if (wantedGeo !== undefined && wantedGeo !== doc.geo) return null;

      const observation = byPath.get(field_path);
      if (!observation) return null;

      const now = opts.now ?? new Date();
      const asOfMs = new Date(`${doc.as_of}T00:00:00Z`).getTime();
      const ageSeconds = (now.getTime() - asOfMs) / 1000;
      if (ageSeconds > staleness) return null;

      return {
        value: observation.value,
        ...(observation.range ? { range: observation.range } : {}),
        source_id: doc.document_id,
      };
    },
  };
}

/**
 * Pick the observation set to use when several are in scope: the most recent
 * `as_of` wins.
 *
 * A tie is an error rather than a silent pick, on the same reasoning as RFC
 * 0021's ambiguous-inheritance rule — two same-dated sets from different
 * providers genuinely disagree about which is authoritative, and choosing by
 * array order would make the answer depend on directory listing.
 */
export function selectCurrentMarketData(docs: readonly MarketDataDocument[]): MarketDataDocument {
  if (docs.length === 0) {
    throw new MarketDataError('MD-019', 'No market-data documents to select from.');
  }
  let best = docs[0]!;
  let tied: MarketDataDocument[] = [];
  for (const doc of docs.slice(1)) {
    if (doc.as_of > best.as_of) {
      best = doc;
      tied = [];
    } else if (doc.as_of === best.as_of && doc.document_id !== best.document_id) {
      tied.push(doc);
    }
  }
  if (tied.length > 0) {
    const ids = [best, ...tied].map((d) => d.document_id).sort().join(', ');
    throw new MarketDataError(
      'MD-020',
      `Ambiguous market data: ${tied.length + 1} documents share as_of '${best.as_of}' (${ids}). Resolve which is authoritative rather than letting order decide.`,
    );
  }
  return best;
}
