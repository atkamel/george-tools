# george for VS Code

Run [george](https://student.cs.uwaterloo.ca/~se212/george/george-docs-1/index.html), the SE212 logic checker, on `.grg` files without leaving the editor.

- **Run George**: the play button in the editor title bar, Ctrl+Enter (Cmd+Enter on Mac), the right-click menu, or the command palette. The full reply lands in the "George" output channel. Failed checks show in the Problems panel on the lines george names, and the status bar shows pass, fail, or magic used.
- **Syntax highlighting** for directives, proof keywords, rule names, set and Z operators. `magic` is highlighted as an error.
- **SE212 Assignments** view in the Explorer: every assignment and homework file the course publishes. Click one to download it into the open folder as `Assignment N/<file>` with your group's `#u` line filled in. The download button at the top fetches everything, skipping files you already have.
- **Log in to the course site** opens your Chrome, Edge or Firefox for the UWaterloo sign-in and keeps the session in `~/.config/george/`, shared with the `george` CLI. Choose the browser with the `george.browser` setting, or point `george.browserPath` at an executable. In a WSL window the browser is a Windows one. Safari is not supported: use `george login --cookie` from the CLI instead.

Setting: `george.timeoutMs`, how long to wait for george.
