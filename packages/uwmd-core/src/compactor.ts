// .uw.md compactor — strips superseded blocks, writes clean file
// Spec: UW_FORMAT_SPEC_v1.md §2.7 "uwmd compact strips superseded blocks"

import type { ParsedUWFile, UWBlock } from './types.js';

// ─── Compact: remove all superseded blocks from raw file text ─────────────────
// Returns the compacted file content as a string.
// Strategy: parse line ranges of superseded blocks, remove those line spans.

export function compact(parsed: ParsedUWFile): string {
  const lines = parsed.raw.split('\n');

  // Collect all superseded block line ranges (1-indexed, inclusive)
  const supersededRanges: Array<{ start: number; end: number }> = [];

  for (const blocks of Object.values(parsed.superseded)) {
    for (const block of blocks) {
      supersededRanges.push({ start: block.lineStart, end: block.lineEnd });
    }
  }

  if (supersededRanges.length === 0) return parsed.raw;

  // Sort ranges by start line descending so we remove from bottom up
  supersededRanges.sort((a, b) => b.start - a.start);

  const resultLines = [...lines];

  for (const range of supersededRanges) {
    // lineStart is the opening ``` line, lineEnd is the closing ``` line (both 1-indexed)
    // Also remove one blank line before the fence if present, to avoid double spacing
    const startIdx = range.start - 1; // convert to 0-indexed
    const endIdx = range.end - 1;

    let removeFrom = startIdx;
    if (removeFrom > 0 && resultLines[removeFrom - 1].trim() === '') {
      removeFrom--;
    }

    resultLines.splice(removeFrom, endIdx - removeFrom + 1);
  }

  return resultLines.join('\n');
}

// ─── Diff: compare two ParsedUWFile objects section by section ────────────────

export interface SectionDiff {
  sectionId: string;
  status: 'added' | 'removed' | 'changed' | 'unchanged';
  before?: UWBlock;
  after?: UWBlock;
  changedFields?: string[];
}

export function diff(before: ParsedUWFile, after: ParsedUWFile): SectionDiff[] {
  const results: SectionDiff[] = [];
  const allIds = new Set([
    ...Object.keys(before.sections),
    ...Object.keys(after.sections),
  ]);

  for (const id of allIds) {
    const bEntry = before.sections[id];
    const aEntry = after.sections[id];

    if (!bEntry && aEntry) {
      results.push({ sectionId: id, status: 'added', after: aEntry as UWBlock });
      continue;
    }
    if (bEntry && !aEntry) {
      results.push({ sectionId: id, status: 'removed', before: bEntry as UWBlock });
      continue;
    }
    if (bEntry && aEntry) {
      const bBlock = bEntry as UWBlock;
      const aBlock = aEntry as UWBlock;
      const bJson = JSON.stringify(bBlock.content);
      const aJson = JSON.stringify(aBlock.content);

      if (bJson === aJson) {
        results.push({ sectionId: id, status: 'unchanged', before: bBlock, after: aBlock });
      } else {
        const changedFields = findChangedFields(bBlock.content, aBlock.content);
        results.push({ sectionId: id, status: 'changed', before: bBlock, after: aBlock, changedFields });
      }
    }
  }

  return results.sort((a, b) => a.sectionId.localeCompare(b.sectionId));
}

function findChangedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  prefix = '',
): string[] {
  const changed: string[] = [];
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    if (key === '_meta') continue; // version/timestamp always change
    const path = prefix ? `${prefix}.${key}` : key;
    const bVal = before[key];
    const aVal = after[key];

    if (typeof bVal === 'object' && typeof aVal === 'object' && bVal !== null && aVal !== null && !Array.isArray(bVal)) {
      changed.push(...findChangedFields(
        bVal as Record<string, unknown>,
        aVal as Record<string, unknown>,
        path,
      ));
    } else if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
      changed.push(path);
    }
  }

  return changed;
}
