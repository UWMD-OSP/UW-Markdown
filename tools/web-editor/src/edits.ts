// Edit pipeline — every change to the deal flows through this.
//
// Calls @uwmd/core's applyEdit() to produce a new file content string,
// then re-parses it so the in-memory parsed state stays canonical. This
// is the only place that mutates the loaded deal — the editor never
// hand-edits ParsedUWFile or the source string. That single chokepoint
// is what guarantees calc-integrity: nothing can write a value to the
// file without going through the protocol's edit semantics.

import { parseUWFile, validateUWFile, applyEdit } from '@uwmd/core/browser';
import type {
  ParsedUWFile,
  ValidationResult,
  EditOperation,
  EditContext,
  EditResult,
} from '@uwmd/core/browser';

export interface EditState {
  source: string;
  parsed: ParsedUWFile;
  validation: ValidationResult;
}

export interface EditApplied {
  ok: true;
  state: EditState;
}

export interface EditFailed {
  ok: false;
  message: string;
}

export type EditOutcome = EditApplied | EditFailed;

/** Edit provenance + mode, configurable from the toolbar. Controls what gets
 *  stamped on `_meta` and whether a section edit replaces in place or appends
 *  a superseding version (the append-only provenance path). */
export interface EditSettings {
  actor: string;
  source: string;
  confidence: 'high' | 'medium' | 'low';
  notes: string;
  humanReview: boolean;
  /** 'replace' edits the head block in place; 'supersede' appends a new
   *  version and archives the prior one. */
  mode: 'replace' | 'supersede';
}

export const DEFAULT_EDIT_SETTINGS: EditSettings = {
  actor: 'web-editor',
  source: 'manual',
  confidence: 'high',
  notes: '',
  humanReview: false,
  mode: 'replace',
};

export function loadInitialState(source: string): EditState {
  const parsed = parseUWFile(source, { strict: false });
  const validation = validateUWFile(parsed);
  return { source, parsed, validation };
}

/** Apply an edit through the protocol, honoring the active EditSettings.
 *
 *  Section edits carry the settings' provenance on `_meta`; in 'supersede'
 *  mode a `section_replace` is promoted to `section_supersede` so the prior
 *  version is archived rather than overwritten. frontmatter_set and
 *  pipeline_log_append are unaffected by mode. */
export function runEdit(
  state: EditState,
  op: EditOperation,
  settings: EditSettings = DEFAULT_EDIT_SETTINGS,
): EditOutcome {
  const ctx: EditContext = {
    actor: settings.actor || 'web-editor',
    source: settings.source || 'manual',
    confidence: settings.confidence,
    ...(settings.notes.trim() ? { notes: settings.notes.trim() } : {}),
  };

  const effectiveOp = applySettingsToOp(op, settings);

  let result: EditResult;
  try {
    result = applyEdit(state.source, state.parsed, effectiveOp, ctx);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }

  if (!result.ok || !result.content) {
    return {
      ok: false,
      message: result.error?.message ?? 'Edit was rejected by the protocol.',
    };
  }

  const parsed = parseUWFile(result.content, { strict: false });
  const validation = validateUWFile(parsed);
  return {
    ok: true,
    state: { source: result.content, parsed, validation },
  };
}

function applySettingsToOp(op: EditOperation, settings: EditSettings): EditOperation {
  if (op.kind !== 'section_replace' && op.kind !== 'section_supersede') return op;

  const meta = {
    ...op.meta,
    confidence: settings.confidence,
    ...(settings.humanReview ? { human_review_required: true } : {}),
  };

  // Promote replace → supersede when in append mode.
  const kind = settings.mode === 'supersede' ? 'section_supersede' : op.kind;
  return { ...op, kind, meta } as EditOperation;
}
