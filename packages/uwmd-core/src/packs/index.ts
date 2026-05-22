// Asset-class calc packs — public surface.
//
// A "pack" is a ModuleManifest declaring derived-metric calcs (and, in future
// versions, validations and view models) for a specific asset class. Packs are
// the modular unit that lets every tool in the ecosystem (web editor, Excel
// converter, agents, future viewers) consume the same calc definitions.

import type { ModuleManifest } from '../protocol.js';
import { MULTIFAMILY_PACK } from './multifamily.js';
import { OFFICE_PACK } from './office.js';
import { RETAIL_PACK } from './retail.js';
import { INDUSTRIAL_PACK } from './industrial.js';

export { MULTIFAMILY_PACK } from './multifamily.js';
export { OFFICE_PACK } from './office.js';
export { RETAIL_PACK } from './retail.js';
export { INDUSTRIAL_PACK } from './industrial.js';
export {
  emitFromAst,
  emitExcelFormula,
  ExcelEmitError,
  type ExcelEmitOptions,
} from './excel-emit.js';

/**
 * Built-in calc packs keyed by the asset class they target. Mirrors the
 * defaults REGISTRY in `defaults.ts`. Third-party / module-loaded packs are out
 * of scope for v1 (see RFC 0003) — these are the compiled-in starter packs.
 */
const PACK_REGISTRY: Readonly<Record<string, ModuleManifest>> = Object.freeze({
  multifamily: MULTIFAMILY_PACK,
  office: OFFICE_PACK,
  retail: RETAIL_PACK,
  industrial: INDUSTRIAL_PACK,
});

/**
 * Look up the built-in calc pack for an asset class. Returns null when no pack
 * is registered (callers may fall back to the multifamily pack or skip metrics).
 */
export function getPackForAssetClass(asset_class: string): ModuleManifest | null {
  return PACK_REGISTRY[asset_class] ?? null;
}
