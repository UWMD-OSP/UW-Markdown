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

const DEFAULT_CONTEXT: EditContext = {
  actor: 'web-editor',
  source: 'manual',
  confidence: 'high',
};

export function loadInitialState(source: string): EditState {
  const parsed = parseUWFile(source, { strict: false });
  const validation = validateUWFile(parsed);
  return { source, parsed, validation };
}

export function runEdit(
  state: EditState,
  op: EditOperation,
  ctx: EditContext = DEFAULT_CONTEXT
): EditOutcome {
  let result;
  try {
    result = applyEdit(state.source, state.parsed, op, ctx);
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
