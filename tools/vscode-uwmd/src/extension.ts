import * as vscode from 'vscode';
import { checkReceipt, formatReport, receiptPathFor, summaryLine } from './receipts.js';
import { analyzeDocument } from './validate.js';
import type { UWDiagnostic, UWDiagnosticSeverity } from './validate.js';

const LANGUAGE_ID = 'uwmd';
const DIAGNOSTIC_SOURCE = 'uwmd';

let diagnostics: vscode.DiagnosticCollection;
let receiptOutput: vscode.OutputChannel;

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

  receiptOutput = vscode.window.createOutputChannel('UW Markdown Receipts');
  context.subscriptions.push(receiptOutput);
  context.subscriptions.push(
    vscode.commands.registerCommand('uwmd.verifyReceipt', verifyReceiptCommand),
  );

  for (const doc of vscode.workspace.textDocuments) maybeValidate(doc);
}

export function deactivate(): void {
  diagnostics?.dispose();
  receiptOutput?.dispose();
}

/**
 * Verify the receipt sitting beside the active deal.
 *
 * The extension verifies but never issues: a receipt issued mid-authoring is
 * stale on the next keystroke. Verification is the operation that fits an
 * editor — "someone sent me this deal and this receipt; do they agree?"
 *
 * Each verdict gets the notification severity it deserves, and per
 * UW_RECEIPT_v1 §1 the `verified` case is never a bare checkmark: the summary
 * states the assurance boundary inline, and the full breakdown is one click
 * away in the output channel.
 */
async function verifyReceiptCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showWarningMessage('Open a .uw.md or .uwx.md deal first.');
    return;
  }

  const doc = editor.document;
  if (doc.uri.scheme !== 'file') {
    void vscode.window.showWarningMessage(
      'Save this deal to disk before verifying — a receipt is a sidecar file.',
    );
    return;
  }

  const dealPath = doc.uri.fsPath;
  const check = await checkReceipt(dealPath, doc.getText(), receiptPathFor(dealPath));

  receiptOutput.clear();
  receiptOutput.appendLine(formatReport(check, dealPath));

  const summary = summaryLine(check, { dirty: doc.isDirty });
  const DETAILS = 'Show details';

  const picked =
    check.kind === 'checked' && check.verdict === 'verified'
      ? await vscode.window.showInformationMessage(summary, DETAILS)
      : check.kind === 'checked' && check.verdict === 'failed'
        ? await vscode.window.showErrorMessage(summary, DETAILS)
        : await vscode.window.showWarningMessage(summary, DETAILS);

  if (picked === DETAILS) receiptOutput.show(true);
}

function maybeValidate(doc: vscode.TextDocument): void {
  if (doc.languageId !== LANGUAGE_ID) return;
  const cfg = vscode.workspace.getConfiguration('uwmd');
  if (!cfg.get<boolean>('validate.onSave', true)) {
    diagnostics.delete(doc.uri);
    return;
  }

  // The parser is chosen from the content, not the extension: `.uw.md` is UW
  // Lite post-RFC-0017, and running the structured parser over it used to
  // report a clean bill of health for a document nothing had parsed.
  const result = analyzeDocument(doc.getText(), doc.uri.fsPath);
  diagnostics.set(doc.uri, result.diagnostics.map((issue) => toDiagnostic(doc, issue)));
}

function toDiagnostic(doc: vscode.TextDocument, issue: UWDiagnostic): vscode.Diagnostic {
  const diag = new vscode.Diagnostic(
    rangeFor(doc, issue),
    issue.message,
    severityToDiagnostic(issue.severity),
  );
  diag.source = DIAGNOSTIC_SOURCE;
  diag.code = issue.code;
  return diag;
}

/** Span the reported line, clamped to the document the user actually has. */
function rangeFor(doc: vscode.TextDocument, issue: UWDiagnostic): vscode.Range {
  const last = Math.max(0, doc.lineCount - 1);
  const start = Math.min(Math.max(0, issue.line), last);
  const end = Math.min(Math.max(start, issue.endLine), last);
  return new vscode.Range(start, 0, end, doc.lineAt(end).text.length || 1);
}

function severityToDiagnostic(sev: UWDiagnosticSeverity): vscode.DiagnosticSeverity {
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
