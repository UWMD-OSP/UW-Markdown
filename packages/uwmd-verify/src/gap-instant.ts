// RFC 0122: deterministic DQ-05 instants, without host Date.parse admission.
import { dayOrdinal, parseISODate } from './calc/day-count.js';
import type { ProtocolError } from './protocol.js';
const EPOCH = dayOrdinal({ year: 1970, month: 1, day: 1 });
const INSTANT = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2}))?$/;

export function parseGapInstant(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = INSTANT.exec(value);
  if (!match || match[0] !== value) return null;
  const date = parseISODate(match[1]!);
  if (!date || date.year < 1) return null;
  let result = (dayOrdinal(date) - EPOCH) * 86_400_000;
  if (match[2] === undefined) return result;
  const hour = Number(match[2]);
  const minute = Number(match[3]);
  const second = Number(match[4] ?? 0);
  if (hour > 23 || minute > 59 || second > 59) return null;
  result += ((hour * 60 + minute) * 60 + second) * 1000 + Number((match[5] ?? '').padEnd(3, '0'));
  const zone = match[6]!;
  if (zone !== 'Z') {
    const hours = Number(zone.slice(1, 3));
    const minutes = Number(zone.slice(4, 6));
    if (hours > 23 || minutes > 59) return null;
    result -= (hours * 60 + minutes) * 60_000 * (zone[0] === '+' ? 1 : -1);
  }
  return result;
}

export class ValidationClockError extends Error implements ProtocolError {
  declare cause?: string;
  readonly category = 'validate' as const;
  readonly code = 'PROTO-VALIDATION-CLOCK';
  constructor() { super('The supplied validation clock is not an RFC 0122 instant.'); this.name = 'ValidationClockError'; }
}
