import type { EditOperation, ParsedUWFile } from '@uwmd/core/browser';
import {
  EDITABLE_FRONTMATTER_FIELDS,
  READONLY_FRONTMATTER_FIELDS,
  type FrontmatterFieldDef,
} from '../catalog.js';

export function FrontmatterEditor(props: {
  parsed: ParsedUWFile;
  dispatch: (op: EditOperation) => void;
}) {
  const fm = props.parsed.frontmatter as Record<string, unknown>;

  const commit = (field: FrontmatterFieldDef, raw: string) => {
    let value: unknown = raw;
    if (field.kind === 'list') {
      value = raw.split(',').map((s) => s.trim()).filter(Boolean);
    } else if (raw === '' && field.kind !== 'enum' && field.nullable) {
      value = null;
    }
    if (sameValue(value, fm[field.path])) return;
    props.dispatch({ kind: 'frontmatter_set', path: field.path, value });
  };

  return (
    <div className="max-w-3xl">
      <h2 className="font-display text-xl text-accent">Frontmatter</h2>
      <p className="mt-1 text-sm text-muted">
        Deal identity and pipeline state. Every change is a{' '}
        <code>frontmatter_set</code> edit operation.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {EDITABLE_FRONTMATTER_FIELDS.map((field) => {
          const current = fm[field.path];
          return (
            <label key={field.path} htmlFor={`fm-${field.path}`} className="block">
              <span className="mb-1 block text-xs font-semibold text-muted">{field.label}</span>
              {field.kind === 'enum' ? (
                <select
                  id={`fm-${field.path}`}
                  className="w-full rounded border border-rule bg-paper px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                  value={typeof current === 'string' ? current : ''}
                  onChange={(e) => commit(field, e.target.value)}
                >
                  {field.nullable && <option value="">—</option>}
                  {field.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={`fm-${field.path}`}
                  type="text"
                  className="w-full rounded border border-rule bg-paper px-2.5 py-1.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
                  key={String(displayValue(current))}
                  defaultValue={displayValue(current)}
                  placeholder={field.kind === 'list' ? 'comma, separated' : '—'}
                  onBlur={(e) => commit(field, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                />
              )}
            </label>
          );
        })}
      </div>

      <h3 className="mt-8 text-xs font-semibold tracking-widest text-muted uppercase">Read-only</h3>
      <dl className="mt-2 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
        {READONLY_FRONTMATTER_FIELDS.map(({ path, label }) => (
          <div key={path} className="flex justify-between border-b border-rule py-1.5 text-sm">
            <dt className="text-muted">{label}</dt>
            <dd className="font-medium">{displayValue(fm[path]) || '—'}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function displayValue(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}
