import * as vscode from "vscode";
import type { Feedback, QuestionBlock } from "@george-tools/core";

/**
 * Turns parsed feedback into diagnostics. Messages that name file lines land
 * on those lines. Messages without one land on the block's `#check` line,
 * found by walking the document for the matching `#q` and its n-th `#check`.
 */
export function toDiagnostics(doc: vscode.TextDocument, fb: Feedback): vscode.Diagnostic[] {
  const out: vscode.Diagnostic[] = [];

  for (const e of fb.syntaxErrors) {
    const line = clampLine(doc, e.line - 1);
    const range = new vscode.Range(line, Math.min(e.column, doc.lineAt(line).text.length), line, doc.lineAt(line).text.length);
    out.push(diag(range, `Syntax error: ${e.text}`, vscode.DiagnosticSeverity.Error));
  }
  for (const p of fb.preamble) {
    out.push(diag(doc.lineAt(0).range, p, vscode.DiagnosticSeverity.Error));
  }

  for (const block of fb.blocks) {
    const anchor = findCheckLine(doc, block);
    for (const m of block.messages) {
      if (m.kind === "comment") continue;
      const severity = m.kind === "error" ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning;
      const targets = m.lines.length > 0 ? m.lines.map((l) => clampLine(doc, l - 1)) : [anchor];
      for (const line of targets) {
        out.push(diag(fullLine(doc, line), `#q ${block.question} ${block.method}: ${m.text}`, severity));
      }
    }
  }
  return out;
}

function diag(range: vscode.Range, message: string, severity: vscode.DiagnosticSeverity): vscode.Diagnostic {
  const d = new vscode.Diagnostic(range, message, severity);
  d.source = "george";
  return d;
}

function clampLine(doc: vscode.TextDocument, line: number): number {
  return Math.max(0, Math.min(line, doc.lineCount - 1));
}

function fullLine(doc: vscode.TextDocument, line: number): vscode.Range {
  const text = doc.lineAt(line);
  const start = text.firstNonWhitespaceCharacterIndex;
  return new vscode.Range(line, start, line, text.text.length);
}

function findCheckLine(doc: vscode.TextDocument, block: QuestionBlock): number {
  let inQuestion = false;
  let part = 0;
  for (let i = 0; i < doc.lineCount; i++) {
    const text = doc.lineAt(i).text.trim();
    const q = /^#q\s+(\S+)/.exec(text);
    if (q) {
      inQuestion = q[1] === block.question;
      part = 0;
      continue;
    }
    if (inQuestion && /^#check\b/.test(text)) {
      part++;
      if (part === block.part) return i;
    }
  }
  return 0;
}
