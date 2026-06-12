import { useState } from 'react';
import type { ValidationResult } from '@uwmd/core/browser';

export function ValidationPanel({ validation }: { validation: ValidationResult }) {
  const [expanded, setExpanded] = useState(false);

  const errors = validation.issues.filter((i) => i.severity === 'error').length;
  const warnings = validation.issues.filter((i) => i.severity === 'warning').length;
  const infos = validation.issues.length - errors - warnings;

  const overall = validation.overall_status;
  const overallTone =
    overall === 'blocking' || overall === 'errors'
      ? 'bg-error text-white'
      : overall === 'warnings'
        ? 'bg-warn text-white'
        : 'bg-ok text-white';

  return (
    <div className="border-t border-rule bg-paper">
      <button
        type="button"
        onClick={() => setExpanded((s) => !s)}
        className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-canvas"
      >
        <span className="text-muted">{expanded ? '▾' : '▸'}</span>
        <span className="font-semibold">Validation</span>
        <span className="text-xs text-muted">
          {errors} error{errors === 1 ? '' : 's'} · {warnings} warning{warnings === 1 ? '' : 's'}
          {infos > 0 ? ` · ${infos} info` : ''}
        </span>
        <span className={`ml-auto rounded px-2 py-0.5 text-xs font-bold uppercase ${overallTone}`}>
          {overall}
        </span>
      </button>

      {expanded && (
        <ul className="max-h-56 overflow-y-auto border-t border-rule">
          {validation.issues.length === 0 && (
            <li className="px-4 py-3 text-sm text-muted">
              No issues. The file conforms to the format spec.
            </li>
          )}
          {validation.issues.map((issue) => (
            <li
              key={`${issue.code}|${issue.section ?? ''}|${issue.field ?? ''}|${issue.message}`}
              className="flex items-start gap-3 border-b border-rule px-4 py-2 text-sm"
            >
              <span
                className={`mt-0.5 w-14 shrink-0 text-center text-[0.65rem] font-bold uppercase ${
                  issue.severity === 'error'
                    ? 'text-error'
                    : issue.severity === 'warning'
                      ? 'text-warn'
                      : 'text-muted'
                }`}
              >
                {issue.severity}
              </span>
              <code className="shrink-0 text-xs text-muted">{issue.code}</code>
              <div className="min-w-0">
                {issue.section && (
                  <span className="mr-1.5 rounded bg-accent-soft px-1.5 text-xs text-accent">
                    {issue.section}
                    {issue.field ? `.${issue.field}` : ''}
                  </span>
                )}
                {issue.title && <strong>{issue.title}. </strong>}
                {issue.message}
                {issue.remediation && (
                  <div className="mt-0.5 text-xs text-muted">→ {issue.remediation}</div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
