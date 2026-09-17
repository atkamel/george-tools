import * as vscode from "vscode";
import path from "node:path";
import {
  check,
  parseFeedback,
  parseUserIds,
  saveConfig,
  login,
  download,
  downloadAll,
  writeHeader,
  ensureSession,
  ensureConfig,
  NotLoggedInError,
  NoBrowserError,
  type Feedback,
} from "@george-tools/core";
import { AssignmentsProvider, FileNode } from "./assignments.js";
import { toDiagnostics } from "./diagnostics.js";

let output: vscode.OutputChannel;
let diagnostics: vscode.DiagnosticCollection;
let status: vscode.StatusBarItem;
const lastResult = new Map<string, Feedback>();

export function activate(context: vscode.ExtensionContext): void {
  output = vscode.window.createOutputChannel("George");
  diagnostics = vscode.languages.createDiagnosticCollection("george");
  status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  status.command = "george.run";

  const assignments = new AssignmentsProvider();
  vscode.window.registerTreeDataProvider("georgeAssignments", assignments);

  context.subscriptions.push(
    output,
    diagnostics,
    status,
    vscode.commands.registerCommand("george.run", runGeorge),
    vscode.commands.registerCommand("george.login", loginCommand),
    vscode.commands.registerCommand("george.setUserIds", setUserIds),
    vscode.commands.registerCommand("george.download", downloadEverything),
    vscode.commands.registerCommand("george.downloadFile", downloadOne),
    vscode.commands.registerCommand("george.refreshAssignments", () => assignments.refresh()),
    vscode.window.onDidChangeActiveTextEditor(updateStatus),
    vscode.workspace.onDidChangeTextDocument((e) => {
      // The result no longer describes the file once it is edited.
      if (lastResult.delete(e.document.uri.toString())) updateStatus(vscode.window.activeTextEditor);
    }),
  );
  updateStatus(vscode.window.activeTextEditor);
}

export function deactivate(): void {}

async function runGeorge(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "george") {
    void vscode.window.showInformationMessage("Open a .grg file to run george.");
    return;
  }
  const doc = editor.document;
  const timeoutMs = vscode.workspace.getConfiguration("george").get<number>("timeoutMs");

  status.text = "$(sync~spin) george";
  status.show();
  output.clear();
  output.appendLine(`Asking george about ${path.basename(doc.fileName)}...`);
  output.show(true);

  let raw: string;
  try {
    raw = await check(doc.getText(), { timeoutMs });
  } catch (err) {
    output.appendLine((err as Error).message);
    lastResult.delete(doc.uri.toString());
    updateStatus(editor);
    void vscode.window.showErrorMessage(`george: ${(err as Error).message}`);
    return;
  }
  const fb = parseFeedback(raw);
  output.clear();
  output.append(raw.replace(/^\s*\n/, ""));
  diagnostics.set(doc.uri, toDiagnostics(doc, fb));
  lastResult.set(doc.uri.toString(), fb);
  updateStatus(editor);
}

function updateStatus(editor: vscode.TextEditor | undefined): void {
  if (!editor || editor.document.languageId !== "george") {
    status.hide();
    return;
  }
  const fb = lastResult.get(editor.document.uri.toString());
  if (!fb) {
    status.text = "$(run) george";
    status.tooltip = "Run George on this file";
  } else if (fb.ok) {
    const magic = fb.blocks.some((b) => b.magicUsed);
    status.text = magic ? "$(wand) george: magic used" : "$(check) george: pass";
    status.tooltip = `${fb.blocks.length} check${fb.blocks.length === 1 ? "" : "s"} passed`;
  } else {
    const failed = fb.blocks.filter((b) => !b.passed).length + fb.syntaxErrors.length;
    status.text = `$(error) george: ${failed} failed`;
    status.tooltip = "See the Problems panel";
  }
  status.show();
}

async function loginCommand(): Promise<void> {
  try {
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "george: sign in to the course site in the browser window" },
      () => login(),
    );
    void vscode.window.showInformationMessage("george: logged in.");
  } catch (err) {
    void vscode.window.showErrorMessage(`george: ${(err as Error).message}`);
  }
}

async function askUserIds(): Promise<string[]> {
  const answer = await vscode.window.showInputBox({
    prompt: "WatIAM user id(s) for your group, one or two, comma separated. Written to every file as #u.",
    placeHolder: "id1,id2",
    validateInput: (v) => {
      try {
        parseUserIds(v);
        return null;
      } catch (err) {
        return (err as Error).message;
      }
    },
  });
  if (answer === undefined) throw new Error("No user ids entered.");
  return parseUserIds(answer);
}

async function setUserIds(): Promise<void> {
  try {
    const userIds = await askUserIds();
    saveConfig({ userIds });
    void vscode.window.showInformationMessage(`george: files will be headed #u ${userIds.join(" ")}`);
  } catch (err) {
    void vscode.window.showErrorMessage(`george: ${(err as Error).message}`);
  }
}

function workspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

async function downloadEverything(): Promise<void> {
  const root = workspaceRoot();
  if (!root) {
    void vscode.window.showErrorMessage("george: open a folder first; files download into it.");
    return;
  }
  try {
    const session = await ensureSession();
    const { userIds } = await ensureConfig(askUserIds);
    const report = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "george: downloading assignment files" },
      (progress) =>
        downloadAll(root, {
          session,
          userIds,
          onFile: (e) => progress.report({ message: `${e.group}/${e.file}` }),
        }),
    );
    void vscode.window.showInformationMessage(
      `george: ${report.written.length} file(s) written, ${report.skipped.length} already present.`,
    );
  } catch (err) {
    reportDownloadError(err);
  }
}

async function downloadOne(node: FileNode): Promise<void> {
  const root = workspaceRoot();
  if (!root) {
    void vscode.window.showErrorMessage("george: open a folder first; files download into it.");
    return;
  }
  try {
    const session = await ensureSession();
    const { userIds } = await ensureConfig(askUserIds);
    const target = vscode.Uri.file(path.join(root, node.group.name, node.file.name));
    const exists = await vscode.workspace.fs.stat(target).then(() => true, () => false);
    if (!exists) {
      const text = writeHeader(await download(node.file.path, session), userIds);
      await vscode.workspace.fs.writeFile(target, Buffer.from(text, "utf8"));
    }
    await vscode.window.showTextDocument(target);
  } catch (err) {
    reportDownloadError(err);
  }
}

function reportDownloadError(err: unknown): void {
  if (err instanceof NotLoggedInError || err instanceof NoBrowserError) {
    void vscode.window.showErrorMessage(`george: ${err.message}`, "Log in").then((pick) => {
      if (pick === "Log in") void loginCommand();
    });
    return;
  }
  void vscode.window.showErrorMessage(`george: ${(err as Error).message}`);
}
