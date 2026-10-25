// RFC0092 structural addressing. No hashing, model repair or historical fallback.
import { CalcError } from './calc/errors.js';
import { hasBlockShape } from './block-kind.js';
import { extensionBlocks } from './extension-entry.js';
import { blockPayload, parsedPhysicalBlocks } from './parser.js';
import { jsonNumericTokens, quickMetricDecimals } from './metric-verification.js';
import { getStatedDecimals } from './calc/stated-precision.js';
import type { ParsedUWFile, UWBlock } from './types.js';
import type { ProFormaAddress, ProFormaTarget } from './pro-forma-types.js';

export const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
export const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const own = (v: unknown, key: string): boolean => (record(v) || Array.isArray(v)) && Object.hasOwn(v, key);
export function pointerOf(parts: readonly (string | number)[]): string {
  return parts.map(p => `/${String(p).replace(/~/g, '~0').replace(/\//g, '~1')}`).join('');
}
export interface ResolvedProFormaAddress {
  address: ProFormaAddress;
  target: ProFormaTarget;
  value: unknown;
  block?: UWBlock;
  parts: Array<string | number>;
  physical_key: string;
  key: string;
}
export function addressShape(value: unknown): value is ProFormaAddress {
  return record(value) && Object.keys(value).length === 3 &&
    typeof value.section === 'string' && value.section.length > 0 &&
    (value.variant === null || typeof value.variant === 'string') && typeof value.pointer === 'string';
}
export function proFormaAddressResolver(parsed: ParsedUWFile, source: boolean) {
  const physical = source ? parsedPhysicalBlocks(parsed) : [];
  const tokens = new Map<UWBlock, Map<string, string>>();
  const resolve = (raw: unknown): ResolvedProFormaAddress => {
    if (!addressShape(raw)) throw new CalcError('CALC-PRO-FORMA', 'Address requires section, explicit nullable variant and pointer.');
    const address = raw;
    if (address.pointer !== '' && !address.pointer.startsWith('/')) throw new CalcError('CALC-PRO-FORMA', 'Invalid JSON pointer.');
    const strings = address.pointer === '' ? [] : address.pointer.slice(1).split('/').map(s => {
      if (/~(?:[^01]|$)/.test(s)) throw new CalcError('CALC-PRO-FORMA', 'Invalid JSON pointer escape.');
      return s.replace(/~1/g, '/').replace(/~0/g, '~');
    });
    let block: UWBlock | undefined;
    let path: Array<string | number>;
    let value: unknown;
    if (address.section === 'frontmatter') {
      if (address.variant !== null) throw new CalcError('CALC-RESOLVE-002', 'Frontmatter has no variant.');
      value = parsed.frontmatter; path = ['frontmatter'];
    } else {
      const entry = Object.hasOwn(parsed.sections, address.section) ? parsed.sections[address.section] : undefined;
      if (entry && hasBlockShape(entry)) {
        if (((entry as UWBlock).annotation.variant ?? null) === address.variant) {
          block = entry as UWBlock; path = ['sections', address.section, 'content'];
        }
      } else if (entry) {
        const matches = Object.entries(entry).filter(([, b]) => (b.annotation.variant ?? null) === address.variant);
        if (matches.length === 1) {
          block = matches[0]![1]; path = ['sections', address.section, matches[0]![0], 'content'];
        }
      } else if (Object.hasOwn(parsed.extensions, address.section)) {
        const ext = parsed.extensions[address.section]!;
        const blocks = extensionBlocks(ext);
        const indexes = blocks.map((b, i) => (b.annotation.variant ?? null) === address.variant ? i : -1).filter(i => i >= 0);
        if (indexes.length === 1) {
          block = blocks[indexes[0]!]!;
          path = ext.mode === 'single' ? ['extensions', address.section, 'block', 'content']
            : ['extensions', address.section, 'blocks', indexes[0]!, 'block', 'content'];
        }
      }
      if (!block || block.annotation.superseded === true || block.meta?.lifecycle?.superseded === true) throw new CalcError('CALC-RESOLVE-002', 'Exact current section variant is unavailable.');
      value = blockPayload(block);
    }
    const payload = value;
    const parts: Array<string | number> = [];
    for (const s of strings) {
      if (Array.isArray(value)) {
        if (!/^(0|[1-9][0-9]*)$/.test(s) || !Number.isSafeInteger(Number(s))) throw new CalcError('CALC-PRO-FORMA', 'Array pointer indexes must be canonical integers.');
        const index = Number(s);
        if (!own(value, s)) throw new CalcError('CALC-RESOLVE-001', 'Target array member is unavailable.');
        parts.push(index); value = value[index];
      } else {
        if (!own(value, s)) throw new CalcError('CALC-RESOLVE-001', 'Target member is unavailable.');
        parts.push(s); value = (value as Record<string, unknown>)[s];
      }
    }
    let period: string | null = null;
    let cursor = payload;
    for (let i = 0; i < parts.length; i++) {
      if (typeof parts[i] === 'number' && Array.isArray(cursor)) {
        const row = cursor[parts[i] as number];
        if (record(row)) {
          if (typeof row.period === 'string') period = row.period;
          else if (Number.isInteger(row.year)) period = `Y${String(row.year)}`;
        }
      }
      cursor = (cursor as Record<string | number, unknown>)?.[parts[i]!];
    }
    const ordinal = block ? physical.indexOf(block) : -1;
    const kind = source && block && ordinal >= 0 ? 'source' : 'model';
    const blockAddress = kind === 'source' ? ordinal : path!;
    const target: ProFormaTarget = {
      block_address_kind: kind, block_address: blockAddress,
      section_id: address.section, variant: address.variant, target_pointer: pointerOf(parts),
      period_key: period, loan_ref: address.section === 'debt_structure'
        ? JSON.stringify([kind, blockAddress, address.section, address.variant]) : null,
    };
    const physical_key = JSON.stringify([kind, blockAddress, address.section, address.variant, parts]);
    return { address: { ...address, pointer: pointerOf(parts) }, target, value, block, parts, physical_key,
      key: JSON.stringify([kind, blockAddress, address.section, address.variant, parts, period, target.loan_ref]) };
  };
  const precision = (r: ResolvedProFormaAddress, supplied?: ReadonlyMap<string, string>): number | undefined => {
    if (!finite(r.value)) return undefined;
    // Source operations use their admitted original token; overrides belong only to models.
    const explicit = source ? undefined : supplied?.get(r.key);
    if (explicit !== undefined) return /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/.test(explicit) && Number(explicit) === r.value ? getStatedDecimals(explicit) : undefined;
    if (!source) return undefined;
    if (!r.block && r.parts.length === 2 && r.parts[0] === 'quick_metrics') return quickMetricDecimals(parsed.raw, String(r.parts[1]), r.value);
    if (!r.block) return undefined;
    if (!tokens.has(r.block)) {
      try { tokens.set(r.block, jsonNumericTokens(r.block.rawJson)); } catch { return undefined; }
    }
    const token = tokens.get(r.block)!.get(JSON.stringify(r.parts.map(String)));
    return token !== undefined && Number(token) === r.value ? getStatedDecimals(token) : undefined;
  };
  return { resolve, precision };
}
/** Compare typed addresses, with null first and actual array indexes numerically. */
export function compareProFormaTargets(a: ProFormaTarget, b: ProFormaTarget, aParts: readonly (string | number)[] = [a.target_pointer], bParts: readonly (string | number)[] = [b.target_pointer]): number {
  const scalar = (x: string | number | null, y: string | number | null): number => {
    if (x === y) return 0; if (x === null) return -1; if (y === null) return 1;
    if (typeof x === 'number' && typeof y === 'number') return x - y;
    return String(x) < String(y) ? -1 : 1;
  };
  if (a.block_address_kind === 'source' && b.block_address_kind === 'source' && a.block_address !== b.block_address) return Number(a.block_address) - Number(b.block_address);
  for (const [x, y] of [[a.section_id, b.section_id], [a.variant, b.variant]] as const) {
    const cmp = scalar(x, y); if (cmp) return cmp;
  }
  const x = [...(Array.isArray(a.block_address) ? a.block_address : [a.block_address]), ...aParts];
  const y = [...(Array.isArray(b.block_address) ? b.block_address : [b.block_address]), ...bParts];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if (i >= x.length) return -1; if (i >= y.length) return 1;
    const cmp = scalar(x[i]!, y[i]!); if (cmp) return cmp;
  }
  return 0;
}

