// Deterministic rent-roll footing — the single source of truth for rolling a
// unit-level (multifamily) or tenant-level (commercial) schedule up into the
// section's totals (GPR, in-place rent, occupancy, leased SF, WALT, per-SF, and
// the unit-mix / tenant-concentration summaries).
//
// Why this lives in core, not the editor: per invariant #4 (Excel ↔ calc-engine
// parity, one source drives both), any value the file stores must be derivable
// the same way everywhere. The web editor calls deriveRentRoll() to lock these
// totals to their line items; the CLI and Excel converter can call the identical
// function so they never disagree.
//
// This is *not* AI math — it is plain deterministic arithmetic over line items,
// exactly like the calc packs. It does no I/O and mutates nothing.
//
// Field-name tolerance: real files use two commercial naming conventions (the
// format spec's `nra_sqft`/`base_rent_annual` and the worked-example's
// `leased_sf`/`annual_base_rent`). deriveRentRoll reads either and writes back
// to whichever total keys already exist in the block, falling back to the spec
// name when the block is new.

import { collector, numOrNull, type DerivedField } from './derived.js';

export type { DerivedField, DerivedKind } from './derived.js';

export type RentRollVariant = 'multifamily' | 'commercial';

/** Which line-item array the rollup was footed from. */
export type RentRollBasis = 'units' | 'unit_mix_summary' | 'tenants' | 'none';

export interface RentRollDerivation {
  variant: RentRollVariant;
  basis: RentRollBasis;
  /** Footed totals, in display order. Empty when there are no line items. */
  fields: DerivedField[];
  /** Recomputed unit_mix_summary — only when basis === 'units'. */
  unit_mix_summary?: Array<Record<string, unknown>>;
  /** Recomputed tenant_concentration — only for commercial with tenants. */
  tenant_concentration?: Array<Record<string, unknown>>;
}

type Row = Record<string, unknown>;

const num = numOrNull;
const lower = (v: unknown): string => (typeof v === 'string' ? v.toLowerCase() : '');

/** First key in `keys` that exists on `content`, else `keys[0]` (the default to write). */
function pickKey(content: Row, keys: string[]): string {
  for (const k of keys) if (k in content) return k;
  return keys[0];
}

/** First finite number among `keys` on `row`. */
function firstNum(row: Row, keys: string[]): number | null {
  for (const k of keys) {
    const n = num(row[k]);
    if (n != null) return n;
  }
  return null;
}

/** Detect the rent-roll variant from explicit type or line-item shape. */
export function rentRollVariant(content: Row): RentRollVariant {
  const t = lower(content['rent_roll_type']);
  if (t === 'commercial') return 'commercial';
  if (t === 'multifamily') return 'multifamily';
  return Array.isArray(content['tenants']) ? 'commercial' : 'multifamily';
}

/** Foot a rent-roll content block. Pure: never mutates `content`. */
export function deriveRentRoll(content: Row): RentRollDerivation {
  const variant = rentRollVariant(content);
  if (variant === 'commercial') return deriveCommercial(content);
  return deriveMultifamily(content);
}

// ─── Multifamily ──────────────────────────────────────────────────────────────

// Unit statuses that contribute contractual in-place rent (a unit on notice is
// still paying; vacant/model/down units are not).
const PAYING = new Set(['occupied', 'notice', 'holdover', '']);

function deriveMultifamily(content: Row): RentRollDerivation {
  const units = content['units'];
  if (Array.isArray(units) && units.length > 0) {
    return deriveMultifamilyFromUnits(content, units as Row[]);
  }
  const mix = content['unit_mix_summary'];
  if (Array.isArray(mix) && mix.length > 0) {
    return deriveMultifamilyFromMix(content, mix as Row[]);
  }
  return { variant: 'multifamily', basis: 'none', fields: [] };
}

function deriveMultifamilyFromUnits(_content: Row, units: Row[]): RentRollDerivation {
  const c = collector();
  const n = units.length;
  let occ = 0;
  let vac = 0;
  let notice = 0;
  let model = 0;
  let down = 0;
  let mtm = 0;
  let gprM = 0;
  let inplaceM = 0;
  let concM = 0;

  for (const u of units) {
    const status = lower(u['status']);
    if (status === 'occupied') occ++;
    else if (status === 'vacant') vac++;
    else if (status === 'notice') notice++;
    else if (status === 'model') model++;
    else if (status === 'down') down++;

    const market = num(u['market_rent']);
    const contract = num(u['monthly_rent']);
    gprM += market ?? contract ?? 0;
    if (PAYING.has(status)) inplaceM += contract ?? 0;
    concM += num(u['concession_monthly_equiv']) ?? 0;
    if (u['is_month_to_month'] === true) mtm++;
  }

  c.add('total_units', 'Total Units', 'count', n);
  c.add('occupied_units', 'Occupied Units', 'count', occ);
  c.add('vacant_units', 'Vacant Units', 'count', vac);
  if (notice > 0) c.add('notice_units', 'Units on Notice', 'count', notice);
  if (model > 0) c.add('model_units', 'Model Units', 'count', model);
  if (down > 0) c.add('down_units', 'Down Units', 'count', down);
  c.add('physical_occupancy_pct', 'Physical Occupancy', 'rate', n ? occ / n : null);
  c.add('gross_potential_rent_monthly', 'GPR (monthly)', 'currency', gprM);
  c.add('gross_potential_rent_annual', 'GPR (annual)', 'currency', gprM * 12);
  c.add('in_place_rent_monthly', 'In-Place Rent (monthly)', 'currency', inplaceM);
  c.add('in_place_rent_annual', 'In-Place Rent (annual)', 'currency', inplaceM * 12);
  c.add('loss_to_lease_monthly', 'Loss to Lease (monthly)', 'currency', gprM - inplaceM);
  c.add('loss_to_lease_pct', 'Loss to Lease %', 'rate', gprM ? (gprM - inplaceM) / gprM : null);
  c.add('concessions_monthly', 'Concessions (monthly)', 'currency', concM);
  c.add('concessions_annual', 'Concessions (annual)', 'currency', concM * 12);
  c.add('net_effective_rent_monthly', 'Net Effective Rent (monthly)', 'currency', inplaceM - concM);
  c.add('month_to_month_units', 'Month-to-Month Units', 'count', mtm);
  c.add('month_to_month_pct', 'Month-to-Month %', 'rate', n ? mtm / n : null);

  return {
    variant: 'multifamily',
    basis: 'units',
    fields: c.fields,
    unit_mix_summary: buildUnitMix(units, n),
  };
}

function buildUnitMix(units: Row[], total: number): Row[] {
  const groups = new Map<string, Row[]>();
  for (const u of units) {
    const key = typeof u['unit_type'] === 'string' ? (u['unit_type'] as string) : 'Unknown';
    const list = groups.get(key);
    if (list) list.push(u);
    else groups.set(key, [u]);
  }

  const mean = (xs: number[]): number | null =>
    xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

  return [...groups.entries()].map(([unit_type, us]) => {
    const count = us.length;
    const sqfts = us.map((u) => num(u['sqft'])).filter((x): x is number => x != null);
    const occupiedRents = us
      .filter((u) => PAYING.has(lower(u['status'])))
      .map((u) => num(u['monthly_rent']))
      .filter((x): x is number => x != null);
    const markets = us.map((u) => num(u['market_rent'])).filter((x): x is number => x != null);
    const occInGroup = us.filter((u) => lower(u['status']) === 'occupied').length;
    const avgSqft = mean(sqfts);
    const avgInplace = mean(occupiedRents);
    const avgMarket = mean(markets);

    const row: Row = { unit_type, count };
    row['avg_sqft'] = avgSqft == null ? null : Math.round(avgSqft);
    row['avg_rent_inplace'] = avgInplace == null ? 0 : Math.round(avgInplace);
    row['avg_rent_market'] = avgMarket == null ? null : Math.round(avgMarket);
    row['occupancy_pct'] = count ? Math.round((occInGroup / count) * 1e4) / 1e4 : 0;
    row['pct_of_total'] = total ? Math.round((count / total) * 1e4) / 1e4 : 0;
    return row;
  });
}

function deriveMultifamilyFromMix(_content: Row, mix: Row[]): RentRollDerivation {
  const c = collector();
  let total = 0;
  let gprM = 0;
  let inplaceM = 0;
  let occWeighted = 0;

  for (const m of mix) {
    const count = num(m['count']) ?? 0;
    const inplace = num(m['avg_rent_inplace']) ?? 0;
    const market = num(m['avg_rent_market']) ?? inplace;
    const occ = num(m['occupancy_pct']) ?? 1;
    total += count;
    gprM += count * market;
    inplaceM += count * occ * inplace;
    occWeighted += count * occ;
  }

  c.add('total_units', 'Total Units', 'count', total);
  c.add('occupied_units', 'Occupied Units', 'count', occWeighted);
  c.add('physical_occupancy_pct', 'Physical Occupancy', 'rate', total ? occWeighted / total : null);
  c.add('gross_potential_rent_monthly', 'GPR (monthly)', 'currency', gprM);
  c.add('gross_potential_rent_annual', 'GPR (annual)', 'currency', gprM * 12);
  c.add('in_place_rent_monthly', 'In-Place Rent (monthly)', 'currency', inplaceM);
  c.add('in_place_rent_annual', 'In-Place Rent (annual)', 'currency', inplaceM * 12);
  c.add('loss_to_lease_monthly', 'Loss to Lease (monthly)', 'currency', gprM - inplaceM);
  c.add('loss_to_lease_pct', 'Loss to Lease %', 'rate', gprM ? (gprM - inplaceM) / gprM : null);

  return { variant: 'multifamily', basis: 'unit_mix_summary', fields: c.fields };
}

// ─── Commercial ─────────────────────────────────────────────────────────────

const SF_KEYS = ['leased_sf', 'nra_sqft'];
const RENT_KEYS = ['annual_base_rent', 'base_rent_annual'];
const TERM_KEYS = ['remaining_term_years', 'lease_term_years'];

function deriveCommercial(content: Row): RentRollDerivation {
  const tenants = content['tenants'];
  if (!Array.isArray(tenants) || tenants.length === 0) {
    return { variant: 'commercial', basis: 'none', fields: [] };
  }
  const rows = tenants as Row[];
  const c = collector();

  let allSf = 0;
  let leasedSf = 0;
  let inplaceA = 0;
  let waltNum = 0;
  let waltDen = 0;

  for (const t of rows) {
    const sf = firstNum(t, SF_KEYS) ?? 0;
    const vacantSf = num(t['vacant_sf']) ?? 0;
    const rent = firstNum(t, RENT_KEYS) ?? 0;
    const leased = rent > 0 && lower(t['status']) !== 'vacant';
    allSf += sf + vacantSf;
    if (leased) {
      leasedSf += sf;
      inplaceA += rent;
      const term = firstNum(t, TERM_KEYS);
      if (term != null && rent > 0) {
        waltNum += term * rent;
        waltDen += rent;
      }
    }
  }

  const totalKey = pickKey(content, ['total_rentable_sf', 'total_nra_sqft']);
  const total = num(content[totalKey]) ?? allSf;
  const vacantSf = Math.max(total - leasedSf, 0);

  c.add(pickKey(content, ['occupied_sf', 'leased_sqft']), 'Occupied SF', 'count', leasedSf);
  c.add('vacant_sf', 'Vacant SF', 'count', vacantSf);
  c.add(totalKey, 'Total Rentable SF', 'count', total);
  c.add(
    pickKey(content, ['occupancy_pct', 'physical_occupancy_pct']),
    'Physical Occupancy',
    'rate',
    total ? leasedSf / total : null,
  );
  c.add('in_place_rent_annual', 'In-Place Rent (annual)', 'currency', inplaceA);
  c.add(
    pickKey(content, ['weighted_avg_rent_psf', 'in_place_rent_per_sqft']),
    'In-Place Rent PSF',
    'psf',
    leasedSf ? inplaceA / leasedSf : null,
  );
  c.add(
    'weighted_avg_lease_term_years',
    'WALT (years)',
    'rate',
    waltDen ? waltNum / waltDen : null,
  );

  return {
    variant: 'commercial',
    basis: 'tenants',
    fields: c.fields,
    tenant_concentration: buildConcentration(rows, total, inplaceA),
  };
}

function buildConcentration(tenants: Row[], totalSf: number, totalIncome: number): Row[] {
  return tenants
    .map((t) => {
      const name = typeof t['tenant_name'] === 'string' ? (t['tenant_name'] as string) : null;
      const sf = firstNum(t, SF_KEYS) ?? 0;
      const rent = firstNum(t, RENT_KEYS) ?? 0;
      return { name, sf, rent };
    })
    .filter((t) => t.name && t.rent > 0)
    .sort((a, b) => b.rent - a.rent)
    .slice(0, 5)
    .map((t) => ({
      tenant_name: t.name,
      pct_of_nra: totalSf ? Math.round((t.sf / totalSf) * 1e4) / 1e4 : 0,
      pct_of_income: totalIncome ? Math.round((t.rent / totalIncome) * 1e4) / 1e4 : 0,
    }));
}
