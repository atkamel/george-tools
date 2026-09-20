import * as vscode from "vscode";
import path from "node:path";
import { listFiles, type Feedback, type Group } from "@george-tools/core";

/**
 * The George panel: the assignment folder you have open, one node per group
 * (Assignment 1, Homework, ...) and one per .grg file. Files on disk open in
 * the editor. Files the course index lists that you do not have yet are
 * dimmed with a download icon. Each file carries its last george result.
 * The index only says what is missing; the folder is the source of truth.
 */

export type Node = GroupNode | FileNode;

export class GroupNode extends vscode.TreeItem {
  constructor(
    readonly name: string,
    readonly dir: vscode.Uri,
    readonly missing: number,
  ) {
    super(name, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = "group";
    this.iconPath = new vscode.ThemeIcon("folder");
    this.resourceUri = dir;
    if (missing > 0) this.description = `${missing} to download`;
  }
}

export class FileNode extends vscode.TreeItem {
  constructor(
    readonly group: string,
    readonly name: string,
    readonly uri: vscode.Uri,
    /** Path on the course site, when the index lists this file. */
    readonly remotePath: string | undefined,
    readonly onDisk: boolean,
    result: Feedback | undefined,
  ) {
    super(name, vscode.TreeItemCollapsibleState.None);
    this.resourceUri = uri;
    if (onDisk) {
      this.contextValue = "file";
      this.command = { command: "vscode.open", title: "Open", arguments: [uri] };
      this.iconPath = resultIcon(result);
      this.tooltip = resultTooltip(result) ?? uri.fsPath;
      if (result) this.description = resultLabel(result);
    } else {
      this.contextValue = "remoteFile";
      this.command = { command: "george.downloadFile", title: "Download", arguments: [this] };
      this.iconPath = new vscode.ThemeIcon("cloud-download");
      this.description = "not downloaded";
      this.tooltip = `${remotePath} on the course site. Click to download.`;
    }
  }
}

function resultIcon(fb: Feedback | undefined): vscode.ThemeIcon {
  if (!fb) return new vscode.ThemeIcon("file");
  if (!fb.ok) return new vscode.ThemeIcon("error", new vscode.ThemeColor("testing.iconFailed"));
  if (fb.blocks.some((b) => b.magicUsed)) return new vscode.ThemeIcon("wand", new vscode.ThemeColor("charts.yellow"));
  return new vscode.ThemeIcon("check", new vscode.ThemeColor("testing.iconPassed"));
}

function resultLabel(fb: Feedback): string {
  if (!fb.ok) {
    const failed = fb.blocks.filter((b) => !b.passed).length + fb.syntaxErrors.length + (fb.preamble.length > 0 ? 1 : 0);
    return `${failed} failed`;
  }
  return fb.blocks.some((b) => b.magicUsed) ? "magic used" : "pass";
}

function resultTooltip(fb: Feedback | undefined): string | undefined {
  if (!fb) return undefined;
  return fb.blocks.map((b) => `#q ${b.question} part ${b.part} ${b.method}: ${b.passed ? "pass" : "FAIL"}`).join("\n");
}

export class AssignmentsProvider implements vscode.TreeDataProvider<Node>, vscode.Disposable {
  private readonly changed = new vscode.EventEmitter<Node | undefined>();
  readonly onDidChangeTreeData = this.changed.event;
  private index: Promise<Group[]> | null = null;
  private readonly watcher: vscode.FileSystemWatcher;

  constructor(private readonly resultFor: (uri: vscode.Uri) => Feedback | undefined) {
    this.watcher = vscode.workspace.createFileSystemWatcher("**/*.grg", false, true, false);
    this.watcher.onDidCreate(() => this.refresh(false));
    this.watcher.onDidDelete(() => this.refresh(false));
  }

  dispose(): void {
    this.watcher.dispose();
    this.changed.dispose();
  }

  /** The folder assignments live in: the workspace folder, or george.folder under it. */
  root(): vscode.Uri | undefined {
    const folder = vscode.workspace.workspaceFolders?.find((f) => f.uri.scheme === "file");
    if (!folder) return undefined;
    const sub = vscode.workspace.getConfiguration("george").get<string>("folder") ?? "";
    return sub.trim().length > 0 ? vscode.Uri.joinPath(folder.uri, sub.trim()) : folder.uri;
  }

  /** Re-reads the folder; with `index` also refetches the course index. */
  refresh(index = true): void {
    if (index) this.index = null;
    this.changed.fire(undefined);
  }

  getTreeItem(node: Node): vscode.TreeItem {
    return node;
  }

  async getChildren(node?: Node): Promise<Node[]> {
    const root = this.root();
    if (!root) {
      await setContext("george.state", "noFolder");
      return [];
    }
    if (node instanceof GroupNode) return this.filesIn(node.name, node.dir);
    if (node) return [];

    const [groups, local] = await Promise.all([this.loadIndex(), this.localGroups(root)]);
    const names = new Set<string>([...local.keys(), ...groups.map((g) => g.name)]);
    const anyLocal = [...local.values()].some((files) => files.length > 0);
    await setContext("george.state", anyLocal ? "ready" : "empty");
    if (!anyLocal) return []; // the welcome view offers the download

    const nodes: GroupNode[] = [];
    for (const name of [...names].sort(compareGroups)) {
      const onDisk = new Set(local.get(name) ?? []);
      const missing = (groups.find((g) => g.name === name)?.files ?? []).filter((f) => !onDisk.has(f.name)).length;
      nodes.push(new GroupNode(name, vscode.Uri.joinPath(root, name), missing));
    }
    return nodes;
  }

  /** Every .grg on disk under the group, plus index entries not on disk. */
  private async filesIn(group: string, dir: vscode.Uri): Promise<FileNode[]> {
    const onDisk = new Set(await listGrg(dir));
    const indexed = (await this.loadIndex()).find((g) => g.name === group)?.files ?? [];
    const remote = new Map(indexed.map((f) => [f.name, f.path]));
    const names = [...new Set([...onDisk, ...remote.keys()])].sort();
    return names.map((name) => {
      const uri = vscode.Uri.joinPath(dir, name);
      return new FileNode(group, name, uri, remote.get(name), onDisk.has(name), this.resultFor(uri));
    });
  }

  /** Group folders on disk that hold .grg files, with those file names. */
  private async localGroups(root: vscode.Uri): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>();
    let entries: [string, vscode.FileType][] = [];
    try {
      entries = await vscode.workspace.fs.readDirectory(root);
    } catch {
      return out;
    }
    for (const [name, type] of entries) {
      if (type !== vscode.FileType.Directory || name.startsWith(".") || name === "node_modules") continue;
      const files = await listGrg(vscode.Uri.joinPath(root, name));
      if (files.length > 0) out.set(name, files);
    }
    return out;
  }

  private loadIndex(): Promise<Group[]> {
    this.index ??= listFiles().catch((err: Error) => {
      void vscode.window.showWarningMessage(`george: could not load the course index: ${err.message}`);
      return [];
    });
    return this.index;
  }

  /** All .grg files on disk in the panel, for Run All. */
  async localFiles(group?: string): Promise<vscode.Uri[]> {
    const root = this.root();
    if (!root) return [];
    const groups = await this.localGroups(root);
    const out: vscode.Uri[] = [];
    for (const [name, files] of groups) {
      if (group && name !== group) continue;
      for (const f of files) out.push(vscode.Uri.joinPath(root, name, f));
    }
    return out;
  }
}

async function listGrg(dir: vscode.Uri): Promise<string[]> {
  try {
    const entries = await vscode.workspace.fs.readDirectory(dir);
    return entries.filter(([n, t]) => t === vscode.FileType.File && n.endsWith(".grg")).map(([n]) => n);
  } catch {
    return [];
  }
}

/** "Assignment 2" after "Assignment 1", "Homework" after the assignments, anything else last. */
function compareGroups(a: string, b: string): number {
  const rank = (s: string) => (/^Assignment \d+$/.test(s) ? 0 : s === "Homework" ? 1 : 2);
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  return a.localeCompare(b, undefined, { numeric: true });
}

function setContext(key: string, value: string): Thenable<unknown> {
  return vscode.commands.executeCommand("setContext", key, value);
}

export function basename(uri: vscode.Uri): string {
  return path.basename(uri.fsPath);
}
