// Workbook-layout registry — selects the per-asset-class layout.
//
// Mirrors `getPackForAssetClass` / `getAssetClassDefaults` in @uwmd/core: a
// single lookup keyed by the deal's `frontmatter.asset_class`. Add a class by
// dropping its layout module here.

import type { WorkbookLayout } from './layout.js';
import { MULTIFAMILY_LAYOUT } from './multifamily.js';
import { OFFICE_LAYOUT } from './office.js';
import { RETAIL_LAYOUT } from './retail.js';
import { INDUSTRIAL_LAYOUT } from './industrial.js';

const LAYOUT_REGISTRY: Readonly<Record<string, WorkbookLayout>> = Object.freeze({
  multifamily: MULTIFAMILY_LAYOUT,
  office: OFFICE_LAYOUT,
  retail: RETAIL_LAYOUT,
  industrial: INDUSTRIAL_LAYOUT,
});

/** Asset classes with a workbook layout, for help text and error messages. */
export const SUPPORTED_ASSET_CLASSES: readonly string[] = Object.keys(LAYOUT_REGISTRY);

/**
 * Look up the workbook layout for an asset class, or null if none is registered
 * (the converter only supports the classes with a layout module).
 */
export function getLayoutForAssetClass(asset_class: string): WorkbookLayout | null {
  return LAYOUT_REGISTRY[asset_class] ?? null;
}
