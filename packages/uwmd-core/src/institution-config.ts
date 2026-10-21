// RFC 0097 filesystem validation adapter. This module is internal to the CLI;
// pure SOURCE/MODEL validation APIs never discover institution files.
import { lstatSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DEFAULT_THRESHOLDS, FINANCIAL_VALIDITY_CODES, type FinancialThresholds, type ProtocolError, type ValidationPolicy } from '@uwmd/verify';

type Failure = 'UNREADABLE' | 'MALFORMED';
export class InstitutionConfigError extends Error {
  readonly code: string;
  readonly proto: ProtocolError;
  constructor(failure: Failure, pointer?: string) {
    const message = failure === 'UNREADABLE'
      ? 'Selected institution config could not be read.'
      : 'Selected institution config is malformed.';
    super(message);
    this.name = 'InstitutionConfigError';
    this.code = `VAL-INSTITUTION-CONFIG-${failure}`;
    this.proto = { category: 'validate', code: this.code, message, ...(pointer === undefined ? {} : { pointer }) };
  }
}

function malformed(pointer?: string): never { throw new InstitutionConfigError('MALFORMED', pointer); }
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function scalarString(value: string): void {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) malformed();
    } else if (code >= 0xdc00 && code <= 0xdfff) malformed();
  }
}

// Whole JSON syntax is already proved by JSON.parse. Walk lexical strings, not
// the parsed object: duplicate names and overwritten string values must remain
// visible. The stack is iterative; no invented nesting/resource limit applies.
function jsonProfile(text: string): void {
  const stack: (Set<string> | null)[] = [];
  const tokens = /"(?:\\.|[^"\\])*"|[{}\[\]]/g;
  for (const match of text.matchAll(tokens)) {
    const token = match[0];
    if (token === '{') stack.push(new Set());
    else if (token === '[') stack.push(null);
    else if (token === '}' || token === ']') stack.pop();
    else {
      const value = JSON.parse(token) as string;
      scalarString(value);
      let after = match.index + token.length;
      while ([' ', '\t', '\r', '\n'].includes(text[after] ?? '')) after++;
      if (text[after] === ':') {
        const names = stack.at(-1);
        if (names?.has(value)) malformed();
        names?.add(value);
      }
    }
  }
}

/** What an admitted institution configuration applies: thresholds and RFC 0109 escalation. */
export interface InstitutionPolicy extends ValidationPolicy {
  thresholds?: Partial<FinancialThresholds>;
}

/** Strict whole-byte/whole-JSON admission precedes closed shape/key admission. */
export function parseInstitutionPolicy(bytes: Uint8Array): InstitutionPolicy | undefined {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) malformed();
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch (error) { if (error instanceof TypeError) malformed(); throw error; }
  let value: unknown;
  try { value = JSON.parse(text); }
  catch (error) { if (error instanceof SyntaxError) malformed(); throw error; }
  jsonProfile(text);
  if (!record(value)) malformed();
  if (Object.hasOwn(value, 'thresholds')) malformed('thresholds');
  if (!Object.hasOwn(value, 'validation_overrides')) return undefined;
  const overrides = value.validation_overrides;
  if (!record(overrides)) malformed('validation_overrides');
  // Check every recognized own leaf first, in governed precedence. Opaque data
  // (including lexically valid overflow numbers) is never applied or serialized.
  const keys = ['dscr_warning_below', 'ltv_warning_above', 'debt_yield_warning_below'] as const;
  for (const key of keys) {
    if (Object.hasOwn(overrides, key) && (typeof overrides[key] !== 'number' || !Number.isFinite(overrides[key]))) {
      malformed(`validation_overrides.${key}`);
    }
  }
  // RFC 0109 D3: an array of registered FV-NN codes, checked after the three
  // numeric leaves. Empty and repeated entries are admitted.
  const escalation = 'financial_validity_errors';
  const registered: readonly string[] = FINANCIAL_VALIDITY_CODES;
  if (Object.hasOwn(overrides, escalation)) {
    const codes = overrides[escalation];
    if (!Array.isArray(codes) || !codes.every(code => typeof code === 'string' && registered.includes(code))) {
      malformed(`validation_overrides.${escalation}`);
    }
  }
  const thresholds: Partial<FinancialThresholds> = {};
  if (Object.hasOwn(overrides, keys[0])) thresholds.dscr = { ...DEFAULT_THRESHOLDS.dscr, warning_below: overrides[keys[0]] as number };
  if (Object.hasOwn(overrides, keys[1])) thresholds.ltv = { ...DEFAULT_THRESHOLDS.ltv, warning_above: overrides[keys[1]] as number };
  if (Object.hasOwn(overrides, keys[2])) thresholds.debt_yield = { ...DEFAULT_THRESHOLDS.debt_yield, warning_below: overrides[keys[2]] as number };
  const result: InstitutionPolicy = {
    ...(Object.keys(thresholds).length ? { thresholds } : {}),
    ...(Object.hasOwn(overrides, escalation) ? { financial_validity_errors: [...overrides[escalation] as string[]] } : {}),
  };
  return Object.keys(result).length ? result : undefined;
}

// Internal seam supports real adapter/race/error controls without changing the
// public validation API or imposing platform-specific chmod/link assumptions.
export interface InstitutionFileIO {
  read(path: string): Uint8Array;
  lstat(path: string): unknown;
}
const FILE_IO: InstitutionFileIO = { read: path => readFileSync(path), lstat: path => lstatSync(path) };
function ioFailure(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && typeof (error as NodeJS.ErrnoException).code === 'string'
    && typeof (error as NodeJS.ErrnoException).syscall === 'string';
}

/** Select one lexical path. Only a genuinely missing automatic sidecar defaults. */
export function loadInstitutionPolicy(
  file: string, explicitPath?: string, io: InstitutionFileIO = FILE_IO,
): InstitutionPolicy | undefined {
  const automatic = explicitPath === undefined;
  const selected = automatic ? resolve(dirname(resolve(file)), '.uw.institution.json') : resolve(explicitPath);
  let bytes: Uint8Array;
  try { bytes = io.read(selected); }
  catch (error) {
    if (!ioFailure(error)) throw error;
    if (automatic && error.code === 'ENOENT') {
      try { io.lstat(selected); }
      catch (inspection) {
        if (!ioFailure(inspection)) throw inspection;
        if (inspection.code === 'ENOENT') return undefined;
      }
      // A present entry after ENOENT includes a dangling symlink. It is not
      // genuine automatic absence; do not follow it into a fallback policy.
    }
    throw new InstitutionConfigError('UNREADABLE');
  }
  return parseInstitutionPolicy(bytes);
}
