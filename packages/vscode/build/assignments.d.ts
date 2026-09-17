import * as vscode from "vscode";
import { type Group, type RemoteFile } from "@george-tools/core";
export type Node = GroupNode | FileNode;
export declare class GroupNode extends vscode.TreeItem {
    readonly group: Group;
    constructor(group: Group);
}
export declare class FileNode extends vscode.TreeItem {
    readonly group: Group;
    readonly file: RemoteFile;
    constructor(group: Group, file: RemoteFile);
}
export declare class AssignmentsProvider implements vscode.TreeDataProvider<Node> {
    private readonly changed;
    readonly onDidChangeTreeData: vscode.Event<Node | undefined>;
    private groups;
    refresh(): void;
    getTreeItem(node: Node): vscode.TreeItem;
    getChildren(node?: Node): Promise<Node[]>;
}
