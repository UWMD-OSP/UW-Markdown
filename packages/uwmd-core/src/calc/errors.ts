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
  | 'CALC-SENS-005'
  // Stochastic declarations (§VIII.8.5). Like the sensitivity codes, these
  // refuse the DECLARATION before any draw; a sample whose formula fails during
  // the run is counted in `failed_samples` and excluded from the summary.
  | 'CALC-STOCH-001'
  | 'CALC-STOCH-002'
  | 'CALC-STOCH-003'
  | 'CALC-STOCH-004'
  | 'CALC-STOCH-005'
  | 'CALC-STOCH-006'
  // Calendar-anchored cash flows (§VIII.9, RFC 0034). `CALC-XIRR-DIVERGE` is
  // the §VIII.9.3 procedure's own refusal (no bracket / no convergence);
  // `CALC-CF-SERIES` refuses a DECLARATION naming a missing, malformed, or
  // wrong-variant series, raised before any arithmetic runs.
  | 'CALC-XIRR-DIVERGE'
  | 'CALC-CF-SERIES';

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
