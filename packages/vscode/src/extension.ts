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
  isBrowserName,
  type Feedback,
  type LoginOptions,
} from "@george-tools/core";
import { AssignmentsProvider, FileNode } from "./assignments.js";
import { toDiagnostics } from "./diagnostics.js";

let output: vscode.OutputChannel;
let diagnostics: vscode.DiagnosticCollection;
let status: vscode.StatusBarItem;
let extensionPath: string;
const lastResult = new Map<string, Feedback>();

/**
 * One language id per highlighting mode: a TextMate grammar is bound to a
 * language id in the manifest and cannot be swapped at runtime, so the
 * george.highlighting setting is applied by moving documents between ids.
 * Everything else treats the three as the same language.
 */
const LANGUAGE_IDS = ["george", "george-classic", "george-plain"] as const;
type GeorgeLanguageId = (typeof LANGUAGE_IDS)[number];

function isGeorge(doc: vscode.TextDocument | undefined): doc is vscode.TextDocument {
  return doc !== undefined && (LANGUAGE_IDS as readonly string[]).includes(doc.languageId);
}

function wantedLanguageId(): GeorgeLanguageId {
  const mode = vscode.workspace.getConfiguration("george").get<string>("highlighting") ?? "default";
  if (mode === "georgecode") return "george-classic";
  if (mode === "off") return "george-plain";
  return "george";
}

async function applyHighlighting(doc: vscode.TextDocument): Promise<void> {
  const wanted = wantedLanguageId();
  if (isGeorge(doc) && doc.languageId !== wanted) await vscode.languages.setTextDocumentLanguage(doc, wanted);
}

export function activate(context: vscode.ExtensionContext): void {
  extensionPath = context.extensionPath;
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
    vscode.workspace.onDidOpenTextDocument((doc) => void applyHighlighting(doc)),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("george.highlighting")) {
        for (const doc of vscode.workspace.textDocuments) void applyHighlighting(doc);
      }
    }),
    vscode.workspace.onDidChangeTextDocument((e) => {
      // The result no longer describes the file once it is edited.
      if (lastResult.delete(e.document.uri.toString())) updateStatus(vscode.window.activeTextEditor);
    }),
  );
  updateStatus(vscode.window.activeTextEditor);
  for (const doc of vscode.workspace.textDocuments) void applyHighlighting(doc);
}

export function deactivate(): void {}

function timeoutSetting(): number | undefined {
  return vscode.workspace.getConfiguration("george").get<number>("timeoutMs");
}

async function runGeorge(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !isGeorge(editor.document)) {
    void vscode.window.showInformationMessage("Open a .grg file to run george.");
    return;
  }
  const doc = editor.document;

  status.text = "$(sync~spin) george";
  status.show();
  output.clear();
  output.appendLine(`Asking george about ${path.basename(doc.fileName)}...`);
  output.show(true);

  try {
    // In a Live Share session this also works on a guest: the document is the
    // synced text, and Live Share copies the host's diagnostics to guests by itself.
    const raw = await check(doc.getText(), { timeoutMs: timeoutSetting() });
    applyResult(doc.uri, raw);
  } catch (err) {
    output.appendLine((err as Error).message);
    lastResult.delete(doc.uri.toString());
    updateStatus(editor);
    void vscode.window.showErrorMessage(`george: ${(err as Error).message}`);
  }
}

/** Shows a reply for a document: output channel, diagnostics, status bar. */
function applyResult(uri: vscode.Uri, raw: string): void {
  const fb = parseFeedback(raw);
  const doc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString());
  output.clear();
  output.appendLine(`george on ${path.basename(uri.path)}:`);
  output.append(raw.replace(/^\s*\n/, ""));
  if (doc) diagnostics.set(doc.uri, toDiagnostics(doc, fb));
  lastResult.set(uri.toString(), fb);
  updateStatus(vscode.window.activeTextEditor);
}

function updateStatus(editor: vscode.TextEditor | undefined): void {
  if (!editor || !isGeorge(editor.document)) {
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

/** Browser settings, plus the worker core runs under Windows Node.js when the extension host is WSL. */
function loginOptions(): Omit<LoginOptions, "onStatus"> {
  const cfg = vscode.workspace.getConfiguration("george");
  const browser = cfg.get<string>("browser") ?? "auto";
  const browserPath = cfg.get<string>("browserPath") ?? "";
  return {
    browser: isBrowserName(browser) ? browser : undefined,
    browserPath: browserPath.length > 0 ? browserPath : undefined,
    workerPath: path.join(extensionPath, "dist", "login-worker.js"),
  };
}

async function loginCommand(): Promise<void> {
  try {
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "george: sign in to the course site in the browser window" },
      (progress) => login({ ...loginOptions(), onStatus: (message) => progress.report({ message }) }),
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

/** The first workspace folder on disk. A Live Share guest's folder is virtual, so downloads need the host. */
function workspaceRoot(): string | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) return undefined;
  if (folder.uri.scheme !== "file") {
    void vscode.window.showErrorMessage("george: downloads need a folder on this machine. In a Live Share session, the host downloads.");
    return undefined;
  }
  return folder.uri.fsPath;
}

async function downloadEverything(): Promise<void> {
  const root = workspaceRoot();
  if (!root) {
    if (!vscode.workspace.workspaceFolders?.length) void vscode.window.showErrorMessage("george: open a folder first; files download into it.");
    return;
  }
  try {
    const session = await ensureSession(undefined, loginOptions());
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
    if (!vscode.workspace.workspaceFolders?.length) void vscode.window.showErrorMessage("george: open a folder first; files download into it.");
    return;
  }
  try {
    const session = await ensureSession(undefined, loginOptions());
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
