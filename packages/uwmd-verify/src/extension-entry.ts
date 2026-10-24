import type { UWExtensionEntry } from './types.js';

export function extensionBlocks<T>(entry: UWExtensionEntry<T>): T[] {
  return entry.mode === 'single' ? [entry.block] : entry.blocks.map(record => record.block);
}

export function mapExtensionEntry<T, U>(entry: UWExtensionEntry<T>, project: (block: T) => U): UWExtensionEntry<U> {
  return entry.mode === 'single' ? { mode: 'single', block: project(entry.block) }
    : { mode: 'variants', blocks: entry.blocks.map(record => ({ variant: record.variant, block: project(record.block) })) };
}

export function compareExtensionIdentity(left: string | null, right: string | null): number {
  return left === right ? 0 : left === null ? -1 : right === null ? 1 : left < right ? -1 : 1;
}
