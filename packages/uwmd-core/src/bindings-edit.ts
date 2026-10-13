// Source-edit bindings wired to the starter editor (RFC 0083).
//
// `bindings.ts` is standard side: it owns the semantic If-Match check and the
// envelope, and takes the edit engine as an injected adapter. These are the
// `applyUWMDSourceEdit` and `createUWMCPApplyEditResult` that `@uwmd/core`
// exports, with the starter editor (`applyEditAsync`) as that engine, so their
// callers see no change.

import {
  applyUWMDSourceEditWith,
  createUWMCPApplyEditResultWith,
  type UWMCPToolResult,
  type UWSourceEditAdapter,
  type UWSourceEditResult,
} from './bindings.js';
import { applyEditAsync, type EditContext, type EditOptions } from './editor.js';
import type { EditOperation } from './protocol.js';

/** The starter editor as a source-edit adapter. */
function starterEditor(context: EditContext, options: EditOptions): UWSourceEditAdapter {
  return (source, parsed, operation) => applyEditAsync(source, parsed, operation, context, undefined, options);
}

export async function applyUWMDSourceEdit(
  source: string,
  operation: EditOperation,
  context: EditContext,
  ifMatch: string | undefined,
  options: EditOptions = { integrity: true, maintainGaps: true },
): Promise<UWSourceEditResult> {
  return applyUWMDSourceEditWith(starterEditor(context, options), source, operation, ifMatch);
}

export async function createUWMCPApplyEditResult(
  source: string,
  operation: EditOperation,
  context: EditContext,
  ifMatch: string | undefined,
): Promise<{ edit: UWSourceEditResult; result: UWMCPToolResult }> {
  return createUWMCPApplyEditResultWith(starterEditor(context, { integrity: true, maintainGaps: true }), source, operation, ifMatch);
}
