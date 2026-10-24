import { canonicalize } from './integrity-canonical.js';

/** Direct model admission; this is deliberately not a carrier/block schema. */
export class JSONValueError extends TypeError {
  readonly code = 'JSON_VALUE_INVALID';
  constructor(reason: string) { super(`Non-JSON model value: ${reason}`); this.name = 'JSONValueError'; }
}

export function assertJSONValue(value: unknown, depth = 0, parents = new Set<object>()): void {
  const refuse = (reason: string): never => { throw new JSONValueError(reason); };
  if (depth >= 128) refuse('depth limit');
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'string') { canonicalize(value); return; }
  if (typeof value === 'number') { if (!Number.isFinite(value)) refuse('nonfinite number'); return; }
  if (typeof value !== 'object' || parents.has(value)) refuse('unsupported type or cycle');
  const object = value as object;
  const array = Array.isArray(object);
  if (!array && ![null, Object.prototype].includes(Object.getPrototypeOf(object))) refuse('object prototype');
  const descriptors = Object.getOwnPropertyDescriptors(object);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some(key => typeof key !== 'string')) refuse('symbol property');
  const length = array ? descriptors['length']!.value as number : null;
  if (array && (keys.length !== length! + 1 || keys.some(key => key !== 'length' &&
    (typeof key !== 'string' || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= length!)))) refuse('array hole or extra property');
  parents.add(object);
  for (const key of keys as string[]) {
    if (array && key === 'length') continue;
    canonicalize(key);
    const descriptor = descriptors[key]!;
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) refuse('hidden or accessor descriptor');
    assertJSONValue(descriptor.value, depth + 1, parents);
  }
  parents.delete(object);
}

/** Snapshot before async work; never read an accessor or silently erase a member. */
export function snapshotJSONValue<T>(value: T): T {
  assertJSONValue(value);
  const copy = (input: unknown): unknown => {
    if (input === null || typeof input !== 'object') return input;
    const descriptors = Object.getOwnPropertyDescriptors(input);
    if (Array.isArray(input)) return Array.from({ length: descriptors['length']!.value as number }, (_, index) => copy(descriptors[String(index)]!.value));
    const output = Object.create(Object.getPrototypeOf(input)) as Record<string, unknown>;
    for (const [key, descriptor] of Object.entries(descriptors)) Object.defineProperty(output, key, {
      value: copy(descriptor.value), enumerable: true, writable: true, configurable: true,
    });
    return output;
  };
  return copy(value) as T;
}

/** Parsed implementation records may contain optional undefined metadata.
 * Inspect descriptors before projection without treating raw/source bookkeeping
 * as committed JSON or importing full carrier schema admission.
 */
export function assertDataDescriptors(value: unknown, parents = new Set<object>()): void {
  if (value === null || typeof value !== 'object') return;
  if (parents.has(value)) throw new JSONValueError('cyclic parsed model');
  parents.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (Array.isArray(value) && key === 'length') continue;
    if (typeof key !== 'string' || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) throw new JSONValueError('hidden or accessor parsed descriptor');
    assertDataDescriptors(descriptor.value, parents);
  }
  parents.delete(value);
}
