// Representation-aware analysis for the extension (RFC 0017).
//
// Free of any `vscode` import so it unit-tests in plain Node; `extension.ts`
// turns these descriptors into `vscode.Diagnostic`s.
//
// Why this exists: the extension used to run the STRUCTURED parser over every
// `.uw.md` file. Post-RFC-0017 `.uw.md` means UW Lite, and the structured
// parser finds no fenced sections in a Lite document — so it reported zero
// issues and a "clean" status for a file it had never actually parsed. A silent
// false pass is worse than a wrong error: it tells an author their document is
// fine when nothing has looked at it.
//
// So the parser is chosen from the content, exactly the way core's
// `detectUWSourceRepresentation` does it, rather than from the file extension.

import {
  compileUWLite,
  detectUWSourceRepresentation,
  parseUWFile,
  parseUWLite,
  UWX_REPRESENTATION_ID,
  validateUWFile,
} from '@uwmd/core';
import type {
  ParsedUWLite,
  UWBlock,
  UWSourceRepresentation,
  ValidationMessage,
  ValidationSeverity,
} from '@uwmd/core';

export type UWDiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint';

export interface UWDiagnostic {
  code: string;
  severity: UWDiagnosticSeverity;
  message: string;
  /** 0-based, ready for a vscode.Range. */
  line: number;
  /** 0-based, inclusive. Equals `line` for single-line findings. */
  endLine: number;
}

export interface AnalyzeResult {
  /** Null when the content could not be identified as either representation. */
  representation: UWSourceRepresentation | null;
  diagnostics: UWDiagnostic[];
}

/** Analyze a document with the parser its content actually calls for. */
export function analyzeDocument(text: string, filename: string): AnalyzeResult {
  let detection: ReturnType<typeof detectUWSourceRepresentation>;
  try {
    detection = detectUWSourceRepresentation(text, filename);
  } catch (error) {
    return {
      representation: null,
      diagnostics: [
        {
          code: codeOf(error, 'SOURCE_REPRESENTATION_UNKNOWN'),
          severity: 'error',
          message: messageOf(error),
          line: 0,
          endLine: 0,
        },
      ],
    };
  }

  // Detection notes — e.g. structured content still on the legacy .uw.md
  // extension — are guidance, not defects.
  const diagnostics: UWDiagnostic[] = detection.warnings.map((message) => ({
    code: 'SOURCE_LEGACY_EXTENSION',
    severity: 'info' as const,
    message,
    line: 0,
    endLine: 0,
  }));

  const rest =
    detection.representation === UWX_REPRESENTATION_ID
      ? analyzeStructured(text)
      : analyzeLite(text);

  return { representation: detection.representation, diagnostics: [...diagnostics, ...rest] };
}

// ─── UW Lite ─────────────────────────────────────────────────────────────────

function analyzeLite(text: string): UWDiagnostic[] {
  let parsed: ParsedUWLite;
  try {
    parsed = parseUWLite(text);
  } catch (error) {
    return [
      { code: codeOf(error, 'LITE_PARSE_FAILED'), severity: 'error', message: messageOf(error), line: 0, endLine: 0 },
    ];
  }

  const diagnostics: UWDiagnostic[] = parsed.issues.map((issue) => ({
    code: issue.code,
    severity: issue.severity,
    message: issue.message,
    ...atLine(issue.line ?? lineOfField(parsed, issue.field_path)),
  }));

  // Compiling a document that already failed to parse just restates the parse
  // errors in bridge vocabulary.
  if (parsed.issues.some((issue) => issue.severity === 'error')) return diagnostics;

  let compiled: ReturnType<typeof compileUWLite>;
  try {
    compiled = compileUWLite(parsed);
  } catch (error) {
    diagnostics.push({
      code: codeOf(error, 'LITE_COMPILE_FAILED'),
      severity: 'error',
      message: messageOf(error),
      line: 0,
      endLine: 0,
    });
    return diagnostics;
  }

  // Financial validation (DSCR/LTV thresholds) is deliberately NOT run here.
  // `checkFinancialValidity` reads `frontmatter.quick_metrics`, and the
  // deal-summary bridge does not populate it — so the FV family is inert for a
  // compiled Lite record by construction, and a toggle for it would do nothing.
  // Computing the metrics here instead would break this extension's contract
  // that it flags exactly what `uwmd validate` flags. Making Lite records carry
  // derived metrics is a core/bridge decision, not a tooling one.
  for (const issue of compiled.report.issues) {
    diagnostics.push({
      code: issue.code,
      severity: issue.severity,
      message: issue.message,
      ...atLine(lineOfField(parsed, issue.field_path)),
    });
  }


  return diagnostics;
}

function lineOfField(parsed: ParsedUWLite, path: string | undefined): number | undefined {
  if (!path) return undefined;
  return parsed.fields.find((field) => field.path === path)?.range.line;
}

// ─── UWX (structured) ────────────────────────────────────────────────────────

function analyzeStructured(text: string): UWDiagnostic[] {
  try {
    const parsed = parseUWFile(text, { strict: false });
    return validateUWFile(parsed).issues.map((message) => ({
      code: message.code,
      severity: toSeverity(message.severity),
      message: formatValidation(message),
      ...atLine(lineOfSection(parsed.sections[message.section ?? ''])),
    }));
  } catch (error) {
    return [
      { code: 'PARSE-001', severity: 'error', message: `Parse error: ${messageOf(error)}`, line: 0, endLine: 0 },
    ];
  }
}

function lineOfSection(entry: unknown): number | undefined {
  if (!entry || typeof entry !== 'object') return undefined;
  const block = entry as Partial<UWBlock>;
  if (typeof block.lineStart === 'number') return block.lineStart;
  // Multi-variant section: point at whichever variant comes first.
  const variants = Object.values(entry as Record<string, Partial<UWBlock>>);
  const first = variants.find((variant) => typeof variant?.lineStart === 'number');
  return first?.lineStart;
}

// ─── Shared ──────────────────────────────────────────────────────────────────

/** Core reports 1-based lines; VS Code ranges are 0-based. */
function atLine(line: number | undefined): { line: number; endLine: number } {
  const zero = Math.max(0, (line ?? 1) - 1);
  return { line: zero, endLine: zero };
}

function toSeverity(severity: ValidationSeverity): UWDiagnosticSeverity {
  switch (severity) {
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'info':
      return 'info';
    default:
      return 'hint';
  }
}

function formatValidation(message: ValidationMessage): string {
  const parts: string[] = [];
  if (message.title) parts.push(message.title);
  parts.push(message.message);
  if (message.remediation) parts.push(`\n\nRemediation: ${message.remediation}`);
  if (message.spec_ref) parts.push(`(spec: ${message.spec_ref})`);
  return parts.join(' ');
}

function codeOf(error: unknown, fallback: string): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : fallback;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
