import * as vscode from 'vscode';
import { parseUWFile, validateUWFile } from '@uwmd/core';
import type { ValidationMessage, ValidationSeverity } from '@uwmd/core';

const LANGUAGE_ID = 'uwmd';
const DIAGNOSTIC_SOURCE = 'uwmd';

let diagnostics: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext): void {
  diagnostics = vscode.languages.createDiagnosticCollection(LANGUAGE_ID);
  context.subscriptions.push(diagnostics);

  context.subscriptions.push(
    vscode.languages.registerFoldingRangeProvider(
      { language: LANGUAGE_ID },
      new UWMDFoldingProvider(),
    ),
  );

  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(
      { language: LANGUAGE_ID },
      new UWMDSymbolProvider(),
    ),
  );

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(maybeValidate),
    vscode.workspace.onDidSaveTextDocument(maybeValidate),
    vscode.workspace.onDidChangeTextDocument((event) => {
      const cfg = vscode.workspace.getConfiguration('uwmd');
      if (cfg.get<boolean>('validate.onChange', false)) {
        maybeValidate(event.document);
      }
    }),
    vscode.workspace.onDidCloseTextDocument((doc) => {
      diagnostics.delete(doc.uri);
    }),
  );

  for (const doc of vscode.workspace.textDocuments) maybeValidate(doc);
}

export function deactivate(): void {
  diagnostics?.dispose();
}

function maybeValidate(doc: vscode.TextDocument): void {
  if (doc.languageId !== LANGUAGE_ID) return;
  const cfg = vscode.workspace.getConfiguration('uwmd');
  if (!cfg.get<boolean>('validate.onSave', true)) {
    diagnostics.delete(doc.uri);
    return;
  }

  try {
    const text = doc.getText();
    const parsed = parseUWFile(text, { strict: false });
    const result = validateUWFile(parsed);
    diagnostics.set(doc.uri, result.issues.map(toDiagnostic));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const diag = new vscode.Diagnostic(
      new vscode.Range(0, 0, 0, 1),
      `Parse error: ${message}`,
      vscode.DiagnosticSeverity.Error,
    );
    diag.source = DIAGNOSTIC_SOURCE;
    diag.code = 'PARSE-001';
    diagnostics.set(doc.uri, [diag]);
  }
}

function toDiagnostic(msg: ValidationMessage): vscode.Diagnostic {
  const diag = new vscode.Diagnostic(
    new vscode.Range(0, 0, 0, 1),
    formatMessage(msg),
    severityToDiagnostic(msg.severity),
  );
  diag.source = DIAGNOSTIC_SOURCE;
  diag.code = msg.code;
  return diag;
}

function formatMessage(msg: ValidationMessage): string {
  const parts: string[] = [];
  if (msg.title) parts.push(msg.title);
  parts.push(msg.message);
  if (msg.remediation) parts.push(`\n\nRemediation: ${msg.remediation}`);
  if (msg.spec_ref) parts.push(`(spec: ${msg.spec_ref})`);
  return parts.join(' ');
}

function severityToDiagnostic(sev: ValidationSeverity): vscode.DiagnosticSeverity {
  switch (sev) {
    case 'error':   return vscode.DiagnosticSeverity.Error;
    case 'warning': return vscode.DiagnosticSeverity.Warning;
    case 'info':    return vscode.DiagnosticSeverity.Information;
    default:        return vscode.DiagnosticSeverity.Hint;
  }
}

class UWMDFoldingProvider implements vscode.FoldingRangeProvider {
  provideFoldingRanges(doc: vscode.TextDocument): vscode.FoldingRange[] {
    const ranges: vscode.FoldingRange[] = [];
    const lineCount = doc.lineCount;

    let frontmatterStart = -1;
    const headingStack: { line: number; level: number }[] = [];
    let fenceStart = -1;

    for (let i = 0; i < lineCount; i++) {
      const text = doc.lineAt(i).text;

      if (i === 0 && text.trimEnd() === '---') {
        frontmatterStart = 0;
        continue;
      }
      if (frontmatterStart >= 0 && text.trimEnd() === '---' && i > frontmatterStart) {
        ranges.push(new vscode.FoldingRange(frontmatterStart, i, vscode.FoldingRangeKind.Region));
        frontmatterStart = -1;
        continue;
      }

      const fenceMatch = text.match(/^\s*```/);
      if (fenceMatch) {
        if (fenceStart === -1) {
          fenceStart = i;
        } else {
          ranges.push(new vscode.FoldingRange(fenceStart, i, vscode.FoldingRangeKind.Region));
          fenceStart = -1;
        }
        continue;
      }

      if (fenceStart !== -1 || frontmatterStart >= 0) continue;

      const headingMatch = text.match(/^(#{1,6})\s+/);
      if (headingMatch) {
        const level = headingMatch[1]!.length;
        while (headingStack.length && headingStack[headingStack.length - 1]!.level >= level) {
          const top = headingStack.pop()!;
          if (i - 1 > top.line) {
            ranges.push(new vscode.FoldingRange(top.line, i - 1, vscode.FoldingRangeKind.Region));
          }
        }
        headingStack.push({ line: i, level });
      }
    }

    while (headingStack.length) {
      const top = headingStack.pop()!;
      if (lineCount - 1 > top.line) {
        ranges.push(new vscode.FoldingRange(top.line, lineCount - 1, vscode.FoldingRangeKind.Region));
      }
    }

    return ranges;
  }
}

class UWMDSymbolProvider implements vscode.DocumentSymbolProvider {
  provideDocumentSymbols(doc: vscode.TextDocument): vscode.DocumentSymbol[] {
    const symbols: vscode.DocumentSymbol[] = [];
    const lineCount = doc.lineCount;
    const stack: { symbol: vscode.DocumentSymbol; level: number }[] = [];

    for (let i = 0; i < lineCount; i++) {
      const text = doc.lineAt(i).text;
      const headingMatch = text.match(/^(#{1,6})\s+(.*?)\s*$/);
      if (!headingMatch) continue;

      const level = headingMatch[1]!.length;
      const name = headingMatch[2]!;
      const range = new vscode.Range(i, 0, i, text.length);
      const sym = new vscode.DocumentSymbol(
        name || '(untitled)',
        '',
        vscode.SymbolKind.String,
        range,
        range,
      );

      while (stack.length && stack[stack.length - 1]!.level >= level) stack.pop();
      if (stack.length === 0) {
        symbols.push(sym);
      } else {
        stack[stack.length - 1]!.symbol.children.push(sym);
      }
      stack.push({ symbol: sym, level });
    }

    return symbols;
  }
}
