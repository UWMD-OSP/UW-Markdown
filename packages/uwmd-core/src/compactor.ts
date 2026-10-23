// Section-by-section diff. RFC 0085 removes record compaction.

import type { ParsedUWFile, UWBlock } from '@uwmd/verify';

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
