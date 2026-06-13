// Diff vs. the loaded/last-saved source — what changed this session. Uses
// core's diff() (section-level status + changed field paths) plus a frontmatter
// scan. Read-only summary; the Source tab shows full bytes.

import { useMemo } from 'react';
import { parseUWFile, diff } from '@uwmd/core/browser';
import type { SectionDiff } from '@uwmd/core/browser';
import { displayName, deepGet } from '../catalog.js';

export function DiffView(props: { originalSource: string; currentSource: string }) {
  const { originalSource, currentSource } = props;

  const result = useMemo(() => {
    if (!originalSource) return null;
    if (originalSource === currentSource) return { sections: [], fmChanges: [] as FmChange[] };
    const before = parseUWFile(originalSource, { strict: false });
    const after = parseUWFile(currentSource, { strict: false });
    const sections = diff(before, after).filter((d) => d.status !== 'unchanged');
    const fmChanges = frontmatterDiff(
      before.frontmatter as Record<string, unknown>,
      after.frontmatter as Record<string, unknown>,
    );
    return { sections, fmChanges };
  }, [originalSource, currentSource]);

  if (!result) {
    return (
      <div className="px-8 py-6 text-sm text-muted">
        This deal was created in-session — there is no saved baseline to diff against yet. Download
        it, then further edits will diff against the saved file.
      </div>
    );
  }

  if (result.sections.length === 0 && result.fmChanges.length === 0) {
    return (
      <div className="px-8 py-6 text-sm text-muted">
        No changes since the file was loaded or last saved.
      </div>
    );
  }

  return (
    <div className="max-w-3xl px-8 py-6">
      <h2 className="font-display text-xl text-accent">Changes this session</h2>
      <p className="mt-1 text-sm text-muted">Compared against the loaded / last-saved file.</p>

      {result.fmChanges.length > 0 && (
        <section className="mt-5">
          <h3 className="text-xs font-semibold tracking-widest text-muted uppercase">Frontmatter</h3>
          <ul className="mt-2 divide-y divide-rule border-y border-rule">
            {result.fmChanges.map((c) => (
              <li key={c.path} className="flex items-baseline gap-3 py-1.5 text-sm">
                <code className="w-48 shrink-0 text-muted">{c.path}</code>
                <span className="text-error line-through">{c.before}</span>
                <span className="text-muted">→</span>
                <span className="text-ok">{c.after}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.sections.length > 0 && (
        <section className="mt-5">
          <h3 className="text-xs font-semibold tracking-widest text-muted uppercase">Sections</h3>
          <ul className="mt-2 divide-y divide-rule border-y border-rule">
            {result.sections.map((d) => (
              <li key={d.sectionId} className="py-2 text-sm">
                <div className="flex items-center gap-2">
                  <StatusChip status={d.status} />
                  <span className="font-semibold">{displayName(d.sectionId)}</span>
                </div>
                {d.changedFields && d.changedFields.length > 0 && (
                  <p className="mt-1 ml-1 text-xs text-muted">
                    {d.changedFields.length} field{d.changedFields.length === 1 ? '' : 's'}:{' '}
                    {d.changedFields.slice(0, 8).join(', ')}
                    {d.changedFields.length > 8 ? ', …' : ''}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

interface FmChange {
  path: string;
  before: string;
  after: string;
}

function frontmatterDiff(before: Record<string, unknown>, after: Record<string, unknown>): FmChange[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const out: FmChange[] = [];
  for (const k of keys) {
    if (k === 'last_modified') continue; // churns on every edit; not meaningful
    const b = JSON.stringify(deepGet(before, k) ?? null);
    const a = JSON.stringify(deepGet(after, k) ?? null);
    if (b !== a) out.push({ path: k, before: trunc(b), after: trunc(a) });
  }
  return out;
}

function trunc(s: string): string {
  const unquoted = s.replace(/^"|"$/g, '');
  return unquoted.length > 40 ? `${unquoted.slice(0, 40)}…` : unquoted;
}

function StatusChip({ status }: { status: SectionDiff['status'] }) {
  const tone =
    status === 'added' ? 'bg-ok/15 text-ok'
    : status === 'removed' ? 'bg-error/15 text-error'
    : 'bg-warn/15 text-warn';
  return <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase ${tone}`}>{status}</span>;
}
