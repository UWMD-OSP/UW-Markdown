import type { ParsedUWFile, ValidationResult, ValidationMessage } from '@uwmd/core/browser';
import { displayName } from '../catalog.js';

function issuesBySection(issues: ValidationMessage[]): Map<string, { errors: number; warnings: number }> {
  const map = new Map<string, { errors: number; warnings: number }>();
  for (const issue of issues) {
    const key = issue.section ?? '_root';
    const entry = map.get(key) ?? { errors: 0, warnings: 0 };
    if (issue.severity === 'error') entry.errors += 1;
    else if (issue.severity === 'warning') entry.warnings += 1;
    map.set(key, entry);
  }
  return map;
}

export function Sidebar(props: {
  parsed: ParsedUWFile;
  validation: ValidationResult | null;
  active: string | null;
  onSelect: (id: string) => void;
}) {
  const { parsed, validation, active, onSelect } = props;
  const issues = validation ? issuesBySection(validation.issues) : new Map<string, { errors: number; warnings: number }>();

  return (
    <aside className="w-60 shrink-0 overflow-y-auto border-r border-rule bg-paper py-3">
      <NavRow id="__frontmatter__" label="Frontmatter" active={active} onSelect={onSelect} />

      <GroupLabel>Sections</GroupLabel>
      {Object.keys(parsed.sections).map((id) => (
        <NavRow
          key={id}
          id={id}
          label={displayName(id)}
          counts={issues.get(id)}
          active={active}
          onSelect={onSelect}
        />
      ))}

      {parsed.pipeline_log.length > 0 && (
        <>
          <GroupLabel>History</GroupLabel>
          <NavRow
            id="__pipeline_log__"
            label={`Pipeline Log (${parsed.pipeline_log.length})`}
            active={active}
            onSelect={onSelect}
          />
        </>
      )}
    </aside>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 mb-1 px-4 text-[0.65rem] font-semibold tracking-widest text-muted uppercase">
      {children}
    </div>
  );
}

function NavRow(props: {
  id: string;
  label: string;
  counts?: { errors: number; warnings: number };
  active: string | null;
  onSelect: (id: string) => void;
}) {
  const { id, label, counts, active, onSelect } = props;
  const isActive = active === id;
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={`flex w-full items-center justify-between px-4 py-1.5 text-left text-sm transition-colors ${
        isActive
          ? 'border-r-2 border-accent bg-accent-soft font-semibold text-accent'
          : 'text-ink hover:bg-canvas'
      }`}
    >
      <span className="truncate">{label}</span>
      {counts && counts.errors > 0 && <Badge kind="error">{counts.errors}</Badge>}
      {counts && counts.errors === 0 && counts.warnings > 0 && <Badge kind="warn">{counts.warnings}</Badge>}
    </button>
  );
}

function Badge({ kind, children }: { kind: 'error' | 'warn'; children: React.ReactNode }) {
  return (
    <span
      className={`ml-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[0.65rem] font-bold text-white ${
        kind === 'error' ? 'bg-error' : 'bg-warn'
      }`}
    >
      {children}
    </span>
  );
}
