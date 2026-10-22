// RFC 0100: the generic size contract (Format §5.5).
//
// A closed table of size, count, area and rent fields. A stated value MUST be a
// finite JSON number ≥ 0, and a count MUST also be an integer; otherwise the
// field draws SIZE-01 (error). `null` and absence are not stated: they draw
// nothing here (stage readiness owns missing facts). Signed amounts
// (concessions, credits, losses, cash flows) are outside the table by
// construction. A class's own contract (mhc_sites, dc_capacity, BED-*, keys)
// keeps its own code; where both report one field, both findings stand.

import { blockPayload } from './parser.js';
import { currentPayloadBlocks } from './payload-admission.js';
import type { ParsedUWFile, ValidationMessage } from './types.js';

/** `count` fields are integers; `measure` fields (area, capacity, rent) are any finite number. */
export type SizeContractKind = 'count' | 'measure';

/**
 * The closed size contract table, by section. A path segment ending in `[]`
 * applies to every element of that array.
 */
export const SIZE_CONTRACT: Readonly<Record<'property' | 'rent_roll' | 'components', Readonly<Record<string, SizeContractKind>>>> = Object.freeze({
  property: Object.freeze({
    total_units: 'count', keys: 'count', total_beds: 'count', total_sites: 'count',
    rentable_units: 'count', entitled_units: 'count', parking_spaces: 'count',
    total_nra_sqft: 'measure', rentable_square_feet: 'measure', gross_leasable_area: 'measure',
    net_rentable_square_feet: 'measure', critical_it_load_kw: 'measure', gross_acres: 'measure',
    usable_acres: 'measure', land_area_sqft: 'measure', land_area_acres: 'measure', site_acres: 'measure',
  }),
  rent_roll: Object.freeze({
    total_units: 'count', occupied_units: 'count', vacant_units: 'count', notice_units: 'count',
    model_units: 'count', down_units: 'count', month_to_month_units: 'count',
    total_sites: 'count', occupied_sites: 'count', vacant_sites: 'count', park_owned_homes: 'count',
    total_beds: 'count', 'unit_mix[].units': 'count', 'unit_mix[].beds': 'count', 'unit_mix[].occupied_beds': 'count',
    'unit_mix_summary[].count': 'count', 'lease_expiration_schedule[].expiring_count': 'count',
    total_rentable_sf: 'measure', occupied_sf: 'measure', vacant_sf: 'measure',
    'tenants[].leased_sf': 'measure', 'units[].sqft': 'measure', 'unit_mix_summary[].avg_sqft': 'measure',
    weighted_avg_rent_psf: 'measure', 'tenants[].rent_psf': 'measure',
    'units[].monthly_rent': 'measure', 'units[].market_rent': 'measure',
  }),
  components: Object.freeze(Object.fromEntries(
    ['multifamily', 'retail', 'office', 'industrial', 'self_storage', 'hospitality',
      'senior_housing', 'student_housing', 'data_center', 'manufactured_housing']
      .flatMap(slot => Object.entries({ total_units: 'count', total_beds: 'count', total_sites: 'count',
        nra_sqft: 'measure', critical_it_load_kw: 'measure' } as const)
        .map(([field, kind]) => [`${slot}.${field}`, kind])),
  )),
});

/** Whether a stated value meets its contract. `null` and `undefined` are not stated. */
export function meetsSizeContract(value: unknown, kind: SizeContractKind): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return false;
  return kind === 'measure' || Number.isInteger(value);
}

/** Each stated value at a contract path, with its concrete field address. */
function* statedAt(payload: unknown, path: string): Generator<[string, unknown]> {
  const [head, ...rest] = path.split('.');
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return;
  const record = payload as Record<string, unknown>;
  if (head!.endsWith('[]')) {
    const key = head!.slice(0, -2);
    const rows = record[key];
    if (!Array.isArray(rows)) return;
    for (const [i, row] of rows.entries()) {
      for (const [tail, value] of statedAt(row, rest.join('.'))) yield [`${key}[${i}].${tail}`, value];
    }
    return;
  }
  if (rest.length === 0) {
    if (Object.hasOwn(record, head!)) yield [head!, record[head!]];
    return;
  }
  for (const [tail, value] of statedAt(record[head!], rest.join('.'))) yield [`${head}.${tail}`, value];
}

/** The area measurement standards `property.area_measurement.standard` admits (RFC 0114). */
export const AREA_MEASUREMENT_STANDARDS: readonly string[] = Object.freeze(['boma', 'ipms', 'rebny', 'rics', 'other']);
const AREA_MEASUREMENT_MEMBERS = new Set(['standard', 'edition', 'note']);

/**
 * SIZE-02 (RFC 0114): a stated `property.area_measurement` is an object with a
 * `standard` from the closed list and optional string `edition` and `note`, and
 * nothing else. `null` and absence are not stated.
 */
function areaMeasurementProblems(value: unknown): [field: string, message: string][] {
  if (value === null || value === undefined) return [];
  if (typeof value !== 'object' || Array.isArray(value)) return [['area_measurement', 'must be an object']];
  const record = value as Record<string, unknown>;
  const problems: [string, string][] = [];
  const standard = record['standard'];
  if (typeof standard !== 'string' || !AREA_MEASUREMENT_STANDARDS.includes(standard)) {
    problems.push(['area_measurement.standard', `must be one of ${AREA_MEASUREMENT_STANDARDS.join(', ')}`]);
  }
  for (const member of ['edition', 'note']) {
    if (Object.hasOwn(record, member) && typeof record[member] !== 'string') {
      problems.push([`area_measurement.${member}`, 'must be a string']);
    }
  }
  for (const member of Object.keys(record)) {
    if (!AREA_MEASUREMENT_MEMBERS.has(member)) problems.push([`area_measurement.${member}`, 'is not a member of area_measurement']);
  }
  return problems;
}

/** SIZE-01 for every current `property` / `rent_roll` block that breaks the size contract; SIZE-02 for a malformed area measurement. */
export function checkSizeContract(parsed: ParsedUWFile, issues: ValidationMessage[]): void {
  for (const [variant, block] of currentPayloadBlocks(parsed, 'property')) {
    const payload = blockPayload(block);
    if (payload === null || typeof payload !== 'object' || !Object.hasOwn(payload, 'area_measurement')) continue;
    for (const [field, problem] of areaMeasurementProblems((payload as Record<string, unknown>)['area_measurement'])) {
      issues.push({
        code: 'SIZE-02', severity: 'error', section: 'property', field,
        message: `SIZE-02: property${variant ? ` (variant "${variant}")` : ''}.${field} ${problem} (RFC 0114)`,
      });
    }
  }
  for (const [section, table] of Object.entries(SIZE_CONTRACT)) {
    for (const [variant, block] of currentPayloadBlocks(parsed, section)) {
      const payload = blockPayload(block);
      for (const [path, kind] of Object.entries(table)) {
        for (const [field, value] of statedAt(payload, path)) {
          if (meetsSizeContract(value, kind)) continue;
          issues.push({
            code: 'SIZE-01', severity: 'error', section, field,
            message: `SIZE-01: ${section}${variant ? ` (variant "${variant}")` : ''}.${field} must be a finite number ≥ 0${kind === 'count' ? ' with no fractional part' : ''} (RFC 0100 size contract)`,
            ...(typeof value === 'number' ? { value } : {}),
          });
        }
      }
    }
  }
}
