import * as vscode from "vscode";
import type { Feedback } from "@george-tools/core";
/**
 * Turns parsed feedback into diagnostics. Messages that name file lines land
 * on those lines. Messages without one land on the block's `#check` line,
 * found by walking the document for the matching `#q` and its n-th `#check`.
 */
export declare function toDiagnostics(doc: vscode.TextDocument, fb: Feedback): vscode.Diagnostic[];
