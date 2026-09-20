import * as vscode from "vscode";
import { type Feedback } from "@george-tools/core";
/**
 * The George panel: the assignment folder you have open, one node per group
 * (Assignment 1, Homework, ...) and one per .grg file. Files on disk open in
 * the editor. Files the course index lists that you do not have yet are
 * dimmed with a download icon. Each file carries its last george result.
 * The index only says what is missing; the folder is the source of truth.
 */
export type Node = GroupNode | FileNode;
export declare class GroupNode extends vscode.TreeItem {
    readonly name: string;
    readonly dir: vscode.Uri;
    readonly missing: number;
    constructor(name: string, dir: vscode.Uri, missing: number);
}
export declare class FileNode extends vscode.TreeItem {
    readonly group: string;
    readonly name: string;
    readonly uri: vscode.Uri;
    /** Path on the course site, when the index lists this file. */
    readonly remotePath: string | undefined;
    readonly onDisk: boolean;
    constructor(group: string, name: string, uri: vscode.Uri, 
    /** Path on the course site, when the index lists this file. */
    remotePath: string | undefined, onDisk: boolean, result: Feedback | undefined);
}
export declare class AssignmentsProvider implements vscode.TreeDataProvider<Node>, vscode.Disposable {
    private readonly resultFor;
    private readonly changed;
    readonly onDidChangeTreeData: vscode.Event<Node | undefined>;
    private index;
    private readonly watcher;
    constructor(resultFor: (uri: vscode.Uri) => Feedback | undefined);
    dispose(): void;
    /** The folder assignments live in: the workspace folder, or george.folder under it. */
    root(): vscode.Uri | undefined;
    /** Re-reads the folder; with `index` also refetches the course index. */
    refresh(index?: boolean): void;
    getTreeItem(node: Node): vscode.TreeItem;
    getChildren(node?: Node): Promise<Node[]>;
    /** Every .grg on disk under the group, plus index entries not on disk. */
    private filesIn;
    /** Group folders on disk that hold .grg files, with those file names. */
    private localGroups;
    private loadIndex;
    /** All .grg files on disk in the panel, for Run All. */
    localFiles(group?: string): Promise<vscode.Uri[]>;
}
export declare function basename(uri: vscode.Uri): string;
