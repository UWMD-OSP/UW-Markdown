// Asset-class calc packs — public surface.
//
// A "pack" is a ModuleManifest declaring derived-metric calcs (and, in future
// versions, validations and view models) for a specific asset class. Packs are
// the modular unit that lets every tool in the ecosystem (web editor, Excel
// converter, agents, future viewers) consume the same calc definitions.
//
// The twelve builtin manifests and their registry live in `../builtin-packs/`
// (standard side, RFC 0083); this module re-exports them beside the Excel
// emitter, a starter product, under the same names.

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
  getPackForAssetClass,
} from '../builtin-packs/index.js';
export {
  emitFromAst,
  emitExcelFormula,
  emitCalcExcelFormula,
  ExcelEmitError,
  type ExcelEmitOptions,
} from './excel-emit.js';
