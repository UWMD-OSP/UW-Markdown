// `lease-abstract-v1` document profile (RFC 0018 §2).
//
// A lease abstract is a portable, attributable record of one executed lease and
// its amendments. It carries *descriptive facts only* — no financial
// calculation is introduced, and no pack applies to it.
//
// Two rules carry the profile's weight:
//
//   1. Every asserted material term must be source-locatable.
//   2. `null` never means "an agent looked and found no obligation". A term may
//      be absent only with an explicit status saying why.
//
// Rule 2 exists because the alternative is silent invention. An extractor that
// writes `null` for a term it could not find is indistinguishable from one
// asserting the lease has no such term, and those are very different claims to
// put in front of a credit committee.

import type { ProtocolError } from './protocol.js';

export const LEASE_ABSTRACT_PROFILE_ID = 'lease-abstract-v1' as const;

/** The six logical groups a lease abstract is organized into. */
export const LEASE_ABSTRACT_GROUPS = Object.freeze([
  'lease_context',
  'lease_term',
  'lease_economics',
  'lease_obligations',
  'lease_credit',
  'lease_abstract_findings',
] as const);

export type LeaseAbstractGroup = (typeof LEASE_ABSTRACT_GROUPS)[number];

/** Why a term is absent. Never conflate these with "no such obligation exists". */
export type LeaseTermStatus = 'not_stated' | 'ambiguous' | 'not_reviewed';

export const LEASE_TERM_STATUSES: readonly LeaseTermStatus[] = Object.freeze([
  'not_stated',
  'ambiguous',
  'not_reviewed',
]);

export interface SourceRef {
  /** Package member id, or an external immutable source identifier. */
  source: string;
  /** Human-readable locator, e.g. "§3.2, p. 14". Required — a citation with no locator is not a citation. */
  locator: string;
  [key: string]: unknown;
}

export interface LeaseTermValue {
  value: unknown;
  /** Required whenever `value` is null. Forbidden otherwise. */
  status?: LeaseTermStatus;
  source_ref?: SourceRef;
  [key: string]: unknown;
}

export type LeaseArtifactKind =
  | 'executed_lease'
  | 'proposal'
  | 'amendment'
  | 'guaranty'
  | 'estoppel'
  | 'other';

export const LEASE_ARTIFACT_KINDS: readonly LeaseArtifactKind[] = Object.freeze([
  'executed_lease',
  'proposal',
  'amendment',
  'guaranty',
  'estoppel',
  'other',
]);

export interface LeaseAbstract {
  document_id: string;
  lease_id: string;
  artifact_kind: LeaseArtifactKind;
  tenant: string;
  premises: string;
  /** Package member ids or external identifiers the facts were read from. */
  governing_documents: string[];
  lease_context?: Record<string, LeaseTermValue>;
  lease_term?: Record<string, LeaseTermValue>;
  lease_economics?: Record<string, LeaseTermValue>;
  lease_obligations?: Record<string, LeaseTermValue>;
  lease_credit?: Record<string, LeaseTermValue>;
  lease_abstract_findings?: Record<string, unknown>;
  [key: string]: unknown;
}

export class LeaseAbstractError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`[${code}] ${message}`);
    this.name = 'LeaseAbstractError';
    this.code = code;
  }
}

function leaseError(code: string, message: string, pointer?: string): ProtocolError {
  return { category: 'validate', code, message, ...(pointer ? { pointer } : {}) };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function validateLeaseAbstract(candidate: unknown): ProtocolError[] {
  const errors: ProtocolError[] = [];
  if (!isRecord(candidate)) {
    return [leaseError('LEASE-001', 'Lease abstract must be an object.')];
  }
  const abstract = candidate as LeaseAbstract;

  for (const key of ['document_id', 'lease_id', 'tenant', 'premises'] as const) {
    if (typeof abstract[key] !== 'string' || (abstract[key] as string).length === 0) {
      errors.push(leaseError('LEASE-002', `${key} is required.`, key));
    }
  }
  if (!LEASE_ARTIFACT_KINDS.includes(abstract.artifact_kind)) {
    errors.push(leaseError(
      'LEASE-003',
      'artifact_kind must distinguish an executed lease from a proposal, amendment, guaranty, or estoppel.',
      'artifact_kind',
    ));
  }
  if (
    !Array.isArray(abstract.governing_documents) ||
    abstract.governing_documents.length === 0 ||
    !abstract.governing_documents.every((d) => typeof d === 'string' && d.length > 0)
  ) {
    errors.push(leaseError(
      'LEASE-004',
      'governing_documents must name at least one source artifact the facts were read from.',
      'governing_documents',
    ));
  }

  for (const group of LEASE_ABSTRACT_GROUPS) {
    if (group === 'lease_abstract_findings') continue; // narrative, not term/value
    const value = abstract[group];
    if (value === undefined) continue;
    if (!isRecord(value)) {
      errors.push(leaseError('LEASE-005', `${group} must be an object.`, group));
      continue;
    }
    for (const [term, entry] of Object.entries(value)) {
      const at = `${group}.${term}`;
      if (!isRecord(entry)) {
        errors.push(leaseError('LEASE-006', 'Term must be an object with a value.', at));
        continue;
      }
      const t = entry as LeaseTermValue;
      if (!('value' in t)) {
        errors.push(leaseError('LEASE-007', 'Term must carry a value.', at));
        continue;
      }
      if (t.value === null) {
        if (!t.status || !LEASE_TERM_STATUSES.includes(t.status)) {
          errors.push(leaseError(
            'LEASE-008',
            'A null term requires an explicit status (not_stated | ambiguous | not_reviewed). ' +
              'Null must never be read as "no such obligation exists".',
            at,
          ));
        }
      } else {
        if (t.status !== undefined) {
          errors.push(leaseError('LEASE-009', 'status is only meaningful when value is null.', `${at}.status`));
        }
        // An asserted term without a resolvable citation is exactly the claim
        // this profile exists to prevent.
        if (!isRecord(t.source_ref)) {
          errors.push(leaseError('LEASE-010', 'Every asserted term requires a source_ref.', `${at}.source_ref`));
        } else {
          const ref = t.source_ref as SourceRef;
          if (typeof ref.source !== 'string' || ref.source.length === 0) {
            errors.push(leaseError('LEASE-011', 'source_ref.source is required.', `${at}.source_ref.source`));
          }
          if (typeof ref.locator !== 'string' || ref.locator.length === 0) {
            errors.push(leaseError('LEASE-012', 'source_ref.locator is required.', `${at}.source_ref.locator`));
          }
        }
      }
    }
  }

  return errors;
}

export function assertLeaseAbstract(candidate: unknown): LeaseAbstract {
  const errors = validateLeaseAbstract(candidate);
  if (errors.length > 0) {
    throw new LeaseAbstractError(errors[0]!.code, errors.map((e) => e.message).join('; '));
  }
  return candidate as LeaseAbstract;
}

// ─── rent-roll-v1 projection ──────────────────────────────────────────────────

export interface RentRollProjectionRow {
  unit_id?: string;
  tenant: string;
  [key: string]: unknown;
}

export interface RentRollProjectionReport {
  profile: 'rent-roll-v1';
  projected_fields: string[];
  omitted: Array<{ term: string; reason: string }>;
  conflicts: Array<{ term: string; reason: string }>;
  lossy: true;
}

export interface RentRollProjectionResult {
  row: RentRollProjectionRow | null;
  report: RentRollProjectionReport;
}

/**
 * Project a lease abstract into a single rent-roll row.
 *
 * Deliberately narrow. It maps only unambiguous, current lease facts, and it
 * MUST NOT calculate a rent amount, annualize a partial period, or choose
 * between conflicting amendments — those are underwriting judgments, and a
 * projection that made them would be inventing facts under the guise of a
 * format conversion.
 *
 * It never mutates a deal. The caller applies the resulting row through the
 * normal Tier-2 editor contract, where byte preservation and provenance apply.
 */
export function projectLeaseAbstractToRentRoll(
  abstract: LeaseAbstract,
): RentRollProjectionResult {
  const report: RentRollProjectionReport = {
    profile: 'rent-roll-v1',
    projected_fields: [],
    omitted: [],
    conflicts: [],
    lossy: true,
  };

  if (abstract.artifact_kind !== 'executed_lease') {
    report.omitted.push({
      term: '(entire abstract)',
      reason: `artifact_kind is ${abstract.artifact_kind}; only an executed lease projects to a rent-roll row.`,
    });
    return { row: null, report };
  }

  const row: RentRollProjectionRow = { tenant: abstract.tenant };
  report.projected_fields.push('tenant');

  const MAPPINGS: Array<[LeaseAbstractGroup, string, string]> = [
    ['lease_context', 'suite', 'unit_id'],
    ['lease_term', 'commencement', 'lease_start'],
    ['lease_term', 'expiration', 'lease_end'],
    ['lease_economics', 'base_rent_annual', 'base_rent_annual'],
  ];

  for (const [group, term, target] of MAPPINGS) {
    const entry = (abstract[group] as Record<string, LeaseTermValue> | undefined)?.[term];
    if (!entry) {
      report.omitted.push({ term: `${group}.${term}`, reason: 'not present in the abstract' });
      continue;
    }
    if (entry.value === null) {
      // An ambiguous term is a conflict a human must resolve; a merely unstated
      // one is an omission. Collapsing the two would hide the disagreement.
      const bucket = entry.status === 'ambiguous' ? report.conflicts : report.omitted;
      bucket.push({ term: `${group}.${term}`, reason: `status: ${entry.status ?? 'unknown'}` });
      continue;
    }
    row[target] = entry.value;
    report.projected_fields.push(target);
  }

  return { row, report };
}
