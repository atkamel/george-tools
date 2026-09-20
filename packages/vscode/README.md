# george for VS Code

Run [george](https://student.cs.uwaterloo.ca/~se212/george/george-docs-1/index.html), the SE212 logic checker, on `.grg` files without leaving the editor.

- **Run George**: the play button in the editor title bar, Ctrl+Enter (Cmd+Enter on Mac), the right-click menu, or the command palette. The full reply lands in the "George" output channel. Failed checks show in the Problems panel on the lines george names, and the status bar shows pass, fail, or magic used.
- **Syntax highlighting** for directives, proof keywords, rule names, set and Z operators. `magic` is highlighted as an error.
- **SE212 Assignments** view in the Explorer: every assignment and homework file the course publishes. Click one to download it into the open folder as `Assignment N/<file>` with your group's `#u` line filled in. The download button at the top fetches everything, skipping files you already have.
- **Log in to the course site** opens your Chrome, Edge or Firefox for the UWaterloo sign-in and keeps the session in `~/.config/george/`, shared with the `george` CLI. Choose the browser with the `george.browser` setting, or point `george.browserPath` at an executable. In a WSL window the browser is a Windows one. Safari is not supported: use `george login --cookie` from the CLI instead.

Setting: `george.timeoutMs`, how long to wait for george.

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
