// The twelve builtin calc pack manifests (RFC 0083, standard side).
//
// A "pack" is a ModuleManifest declaring derived-metric calcs for a specific
// asset class. The manifests are data: receipts name a pack id and version,
// and builtin-class validation evaluates them, so a verifier holding only the
// standard needs them (RFC 0083 decisions). Each pack equals its
// `spec/metrics/builtin.json` entries by an exact parity test
// (`metric-dictionary.test.ts`). Tools that consume packs (the Excel emitter,
// the editor, agents) are starter products; `../packs/index.ts` re-exports
// everything here beside the Excel emitter.

import type { ModuleManifest } from '../protocol.js';
import { toBuiltinAssetClass } from '../types.js';
import { DATA_CENTER_PACK } from './data-center.js';
import { HOSPITALITY_PACK } from './hospitality.js';
import { INDUSTRIAL_PACK } from './industrial.js';
import { LAND_PACK } from './land.js';
import { MANUFACTURED_HOUSING_PACK } from './manufactured-housing.js';
import { MIXED_USE_PACK } from './mixed-use.js';
import { MULTIFAMILY_PACK } from './multifamily.js';
import { OFFICE_PACK } from './office.js';
import { RETAIL_PACK } from './retail.js';
import { SELF_STORAGE_PACK } from './self-storage.js';
import { SENIOR_HOUSING_PACK } from './senior-housing.js';
import { STUDENT_HOUSING_PACK } from './student-housing.js';

export {
  DATA_CENTER_PACK,
  HOSPITALITY_PACK,
  INDUSTRIAL_PACK,
  LAND_PACK,
  MANUFACTURED_HOUSING_PACK,
  MIXED_USE_PACK,
  MULTIFAMILY_PACK,
  OFFICE_PACK,
  RETAIL_PACK,
  SELF_STORAGE_PACK,
  SENIOR_HOUSING_PACK,
  STUDENT_HOUSING_PACK,
};

/**
 * Built-in calc packs keyed by the asset class they target. Mirrors the
 * defaults REGISTRY in `defaults.ts`. Third-party / module-loaded packs are out
 * of scope for v1 (see RFC 0003) — these are the compiled-in builtin packs.
 */
const PACK_REGISTRY: Readonly<Record<string, ModuleManifest>> = Object.freeze({
  multifamily: MULTIFAMILY_PACK,
  office: OFFICE_PACK,
  retail: RETAIL_PACK,
  industrial: INDUSTRIAL_PACK,
  self_storage: SELF_STORAGE_PACK,
  hospitality: HOSPITALITY_PACK,
  senior_housing: SENIOR_HOUSING_PACK,
  student_housing: STUDENT_HOUSING_PACK,
  land: LAND_PACK,
  data_center: DATA_CENTER_PACK,
  manufactured_housing: MANUFACTURED_HOUSING_PACK,
  mixed_use: MIXED_USE_PACK,
});

/**
 * Look up the built-in calc pack for an asset class. Returns null when no pack
 * is registered (callers may fall back to the multifamily pack or skip metrics).
 */
export function getPackForAssetClass(asset_class: string): ModuleManifest | null {
  return PACK_REGISTRY[toBuiltinAssetClass(asset_class) ?? asset_class] ?? null;
}
