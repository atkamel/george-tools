# george-tools

Tools for [george](https://student.cs.uwaterloo.ca/~se212/george/george-docs-1/index.html), the SE212 logic checker at the University of Waterloo: a CLI that downloads assignment files and checks `.grg` files from the terminal, and a VS Code extension built on the same library.

## CLI

```
npm i -g george-tools
```

| Command | What it does |
|---|---|
| `george init [dir]` | First-time setup: log in, save your group's user ids, download every file. |
| `george login` | Sign in to the course site in a browser window and save the session. |
| `george config --users id1,id2` | Save the WatIAM ids written to every downloaded file as `#u`. |
| `george download [a01]` | Download all assignment and homework files into `Assignment N/` and `Homework/`, skipping files you already have. |
| `george check <file or dir>` | Send files to george and print the feedback. `--quiet` for one line per question, `--json` for the parsed result. |

Exit codes for `check`: 0 all passed, 1 something failed, 2 george unreachable or not logged in.

Version control is up to you. Make a private repo, run `george init` inside it, commit.

`george login` uses your installed Chrome or Edge. Sessions and config live in `~/.config/george/`.

## VS Code extension

Open a `.grg` file and press the Run button (or Ctrl+Enter). Feedback goes to the "George" output channel, failures to the Problems panel on the lines george names, and the status bar shows pass or fail. The "SE212 Assignments" view in the Explorer lists every file and downloads it into the open folder.

Install from a `.vsix` built with `npm run package -w packages/vscode`.

## Layout

```
packages/core     @george-tools/core: check, parseFeedback, login, download, config
packages/cli      george-tools on npm, executable `george`
packages/vscode   the extension
fixtures/replies  real george replies that drive the parser tests
```

```
npm install
npm run build
npm test
npm run fixtures   # re-collect replies from george
```
