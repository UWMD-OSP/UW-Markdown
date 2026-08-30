// Tier-3 Calc Host — error factory
// Codes per UW_PROTOCOL_v1.md §VIII.6.

import type { ProtocolError } from '../protocol.js';

export type CalcErrorCode =
  | 'CALC-PARSE-001'
  | 'CALC-RESOLVE-001'
  | 'CALC-TYPE-001'
  | 'CALC-DIV-ZERO'
  | 'CALC-IRR-DIVERGE'
  | 'CALC-LIMIT-001'
  // Sensitivity declarations (§VIII.7.4). Refusals of the DECLARATION, raised
  // before any cell runs — a cell that fails during the sweep is recorded in
  // place under whichever ordinary calc code stopped it, and does not fail the
  // table.
  | 'CALC-SENS-001'
  | 'CALC-SENS-002'
  | 'CALC-SENS-003'
  | 'CALC-SENS-004'
  | 'CALC-SENS-005';

export function calcError(code: CalcErrorCode, message: string, pointer?: string): ProtocolError {
  return {
    category: 'calc',
    code,
    message,
    ...(pointer ? { pointer } : {}),
  };
}

export class CalcError extends Error {
  readonly proto: ProtocolError;
  constructor(code: CalcErrorCode, message: string, pointer?: string) {
    super(`[${code}] ${message}`);
    this.proto = calcError(code, message, pointer);
  }
}
