// Asset-class calc packs — public surface.
//
// A "pack" is a ModuleManifest declaring derived-metric calcs (and, in future
// versions, validations and view models) for a specific asset class. Packs are
// the modular unit that lets every tool in the ecosystem (web editor, Excel
// converter, agents, future viewers) consume the same calc definitions.

export { MULTIFAMILY_PACK } from './multifamily.js';
export {
  emitFromAst,
  emitExcelFormula,
  ExcelEmitError,
  type ExcelEmitOptions,
} from './excel-emit.js';
