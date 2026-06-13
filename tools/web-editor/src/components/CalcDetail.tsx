// Calc transparency — makes the deterministic engine legible. Given a pack
// calc, shows its formula, the resolved input values feeding it (parsed from
// the formula's dependency identifiers), the computed result, and any error.
//
// Inputs are dotted `section.field` paths; we resolve each against the live
// file (wrapper-aware via getNumeric) so the displayed numbers are exactly what
// the engine consumed.

import { useEffect } from 'react';
import {
  evaluateCalc,
  parseExpression,
  getExprDependencies,
  getSection,
  formatValue,
} from '@uwmd/core/browser';
import type { ParsedUWFile, ModuleCalcDecl } from '@uwmd/core/browser';
import { deepGet, getNumeric, displayName } from '../catalog.js';

function useEscape(onClose: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
}

export function CalcDetail(props: {
  decl: ModuleCalcDecl;
  parsed: ParsedUWFile;
  onClose: () => void;
}) {
  const { decl, parsed, onClose } = props;
  useEscape(onClose);

  const ctx = {
    parsed,
    prior_results: {} as Readonly<Record<string, number | string | boolean | null>>,
    locale: 'en-US' as const,
  };
  const result = evaluateCalc(decl, ctx);

  let deps: string[] = [];
  try {
    deps = getExprDependencies(parseExpression(decl.formula));
  } catch {
    deps = [];
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <dialog
        open
        aria-label={`Calc detail: ${decl.label}`}
        className="static w-[34rem] max-w-[92vw] rounded border border-rule bg-paper p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
      >
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg text-accent">{decl.label}</h2>
          <code className="text-xs text-muted">{decl.id}</code>
        </div>

        <div className="mt-3 rounded bg-canvas px-3 py-2">
          <div className="text-[0.62rem] font-semibold tracking-wider text-muted uppercase">Formula</div>
          <code className="text-sm">{decl.formula}</code>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <span className="text-[0.62rem] font-semibold tracking-wider text-muted uppercase">Result</span>
          {result.ok ? (
            <span className="text-lg font-semibold text-accent tabular-nums">
              {result.display ?? formatValue(result.value)}
            </span>
          ) : (
            <span className="text-sm text-error">
              {result.error?.code}: {result.error?.message}
            </span>
          )}
        </div>

        <div className="mt-4">
          <div className="mb-1 text-[0.62rem] font-semibold tracking-wider text-muted uppercase">
            Inputs ({deps.length})
          </div>
          {deps.length === 0 ? (
            <p className="text-sm text-muted">No field inputs — constant or builtin-only formula.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <tbody>
                {deps.map((path) => {
                  const { value, missing } = resolveInput(parsed, path);
                  return (
                    <tr key={path} className="border-b border-rule">
                      <td className="py-1">
                        <code className="text-xs">{path}</code>
                        <span className="ml-2 text-[0.65rem] text-muted">{sectionLabel(path)}</span>
                      </td>
                      <td className="py-1 text-right tabular-nums">
                        {missing ? (
                          <span className="text-error">missing</span>
                        ) : (
                          formatValue(value)
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <p className="mt-3 text-xs text-muted">
          {decl.deterministic ? 'Deterministic' : 'Non-deterministic'} · re-evaluated live from the
          file. Edit any input and this result updates immediately — the AI never computes these.
        </p>

        <div className="mt-4 flex justify-end">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </dialog>
    </div>
  );
}

function splitFirstDot(path: string): [string, string] {
  const i = path.indexOf('.');
  return i === -1 ? [path, ''] : [path.slice(0, i), path.slice(i + 1)];
}

function resolveInput(parsed: ParsedUWFile, path: string): { value: unknown; missing: boolean } {
  const [sectionId, fieldPath] = splitFirstDot(path);
  const block = getSection(parsed, sectionId);
  if (!block) return { value: null, missing: true };
  if (!fieldPath) return { value: block.content, missing: false };
  const num = getNumeric(block.content, fieldPath);
  if (num !== undefined) return { value: num, missing: false };
  const raw = deepGet(block.content, fieldPath);
  return { value: raw, missing: raw === undefined || raw === null };
}

function sectionLabel(path: string): string {
  const [sectionId] = splitFirstDot(path);
  return displayName(sectionId);
}
