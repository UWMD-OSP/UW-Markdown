// Tier-3 Calc Host — error factory
// Codes per UW_PROTOCOL_v1.md §VIII.5.

import type { ProtocolError } from '../protocol.js';

export type CalcErrorCode =
  | 'CALC-PARSE-001'
  | 'CALC-RESOLVE-001'
  | 'CALC-TYPE-001'
  | 'CALC-DIV-ZERO'
  | 'CALC-IRR-DIVERGE'
  | 'CALC-LIMIT-001';

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
