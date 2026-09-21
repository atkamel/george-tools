# george for VS Code

Run [george](https://student.cs.uwaterloo.ca/~se212/george/george-docs-1/index.html), the SE212 logic checker at the University of Waterloo, on `.grg` files without leaving the editor.

- **Run George** with the play button in the editor title, Ctrl+Enter (Cmd+Enter on Mac), the right-click menu or the command palette. The full reply goes to the George output channel, each failure lands in the Problems panel on the line george names, and the status bar shows pass, fail or magic used.
- **The George panel**, behind the G in the Activity Bar, shows your assignment folder: one group per assignment, the last result beside every file, files the course has published that you have not downloaded yet, and buttons to sync new files or check the whole folder.
- **Log in to the course site** from the panel. Your own Chrome, Edge or Firefox opens for the UWaterloo sign-in, and the session is shared with the [`george` CLI](https://www.npmjs.com/package/george-tools).
- **Syntax highlighting** with three looks: a calm default, a rule-for-rule port of GeorgeCode, or off.

## The George panel

The G in the Activity Bar opens a view of the folder you have open, laid out the way the course site and the `george` CLI lay it out: one group per folder (Assignment 1, Homework, ...) and the `.grg` files inside. Files you have open in the editor when clicked. Files the course index lists that are not on disk yet are dimmed with a download icon, and a click downloads one into place. Each file shows its last result: a check, a cross with the number of failures, or a wand when magic was used.

Title buttons: **Sync** downloads every file that is new on the course site and never overwrites anything on disk; **Run George on all files** checks the whole folder, or one group from its row; **Refresh** re-reads the folder and the index. Log in and user ids are under the `...` menu. An empty folder gets a button that downloads everything, which is `george init` from the sidebar. Set `george.folder` if the assignments live in a subfolder of the workspace.

## Highlighting

Three looks, chosen with the `george.highlighting` setting:

| Value | What is coloured |
|---|---|
| `default` | Directives and their arguments, proof and Z and PC keywords, the rule after `by`, `magic` in red, the connectives and turnstiles, comments. Line labels are soft; numbers, arithmetic and brackets are left alone. |
| `georgecode` | The 2018 GeorgeCode extension's colours, rule for rule, plus `//` comments. |
| `off` | None. Everything else in the extension still works. |

The change applies to files as they are opened.

## Live Share

Nothing to set up. In a [Live Share](https://marketplace.visualstudio.com/items?itemName=MS-vsliveshare.vsliveshare) session, a guest can press Run George on a shared `.grg` file: it runs on the guest's machine on the synced text, so the result matches the host's. When the host runs it, Live Share copies the host's Problems entries to every guest, so both see the failures on the same lines. Downloads happen on the host, since guests have no folder on disk.

## Settings

| Setting | What it does |
|---|---|
| `george.highlighting` | `default`, `georgecode` or `off`. See Highlighting above. |
| `george.folder` | Subfolder of the workspace that holds the assignments. Empty means the workspace folder itself. |
| `george.browser` | `auto` tries Chrome, then Edge, then Firefox. Or name one. |
| `george.browserPath` | Path to a browser executable, when `george.browser` is not enough. |
| `george.timeoutMs` | How long to wait for george before giving up. |

Safari is not supported: run `george login --cookie` from the CLI instead. In a WSL window the browser that opens is a Windows one.
