// Public API for @uwmd/excel.

export { toWorkbook, UnsupportedAssetClassError } from './toWorkbook.js';

export {
  buildNamedRangeMap,
  buildDerivedMetrics,
  excelFormatFor,
  SUBTOTAL_RANGES,
} from './layout.js';
export type {
  WorkbookLayout,
  IncomeLine,
  ExpenseLine,
  NamedInput,
  DerivedMetric,
} from './layout.js';

export { getLayoutForAssetClass, SUPPORTED_ASSET_CLASSES } from './layouts.js';
export { MULTIFAMILY_LAYOUT } from './multifamily.js';
export { OFFICE_LAYOUT } from './office.js';
export { RETAIL_LAYOUT } from './retail.js';
export { INDUSTRIAL_LAYOUT } from './industrial.js';
