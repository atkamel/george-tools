import * as vscode from "vscode";
import { listFiles, type Group, type RemoteFile } from "@george-tools/core";

export type Node = GroupNode | FileNode;

export class GroupNode extends vscode.TreeItem {
  constructor(readonly group: Group) {
    super(group.name, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = "group";
    this.iconPath = new vscode.ThemeIcon("folder");
  }
}

export class FileNode extends vscode.TreeItem {
  constructor(readonly group: Group, readonly file: RemoteFile) {
    super(file.name, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "file";
    this.iconPath = new vscode.ThemeIcon("file");
    this.tooltip = file.path;
    this.command = { command: "george.downloadFile", title: "Download this file", arguments: [this] };
  }
}

export class AssignmentsProvider implements vscode.TreeDataProvider<Node> {
  private readonly changed = new vscode.EventEmitter<Node | undefined>();
  readonly onDidChangeTreeData = this.changed.event;
  private groups: Promise<Group[]> | null = null;

  refresh(): void {
    this.groups = null;
    this.changed.fire(undefined);
  }

  getTreeItem(node: Node): vscode.TreeItem {
    return node;
  }

  async getChildren(node?: Node): Promise<Node[]> {
    if (node instanceof GroupNode) return node.group.files.map((f) => new FileNode(node.group, f));
    if (node) return [];
    this.groups ??= listFiles().catch((err: Error) => {
      void vscode.window.showErrorMessage(`Could not load the assignment list: ${err.message}`);
      return [];
    });
    return (await this.groups).map((g) => new GroupNode(g));
  }
}
