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

### Logging in

`george login` opens a browser window on the UWaterloo sign-in and saves the course-site cookies once you are through. It uses a browser you already have, trying Google Chrome, then Microsoft Edge, then Firefox. Pick one with `--browser firefox`, or point at any executable with `--browser-path`. Firefox needs to be version 129 or newer.

| Where you run it | What opens |
|---|---|
| Windows, macOS, Linux | Your installed Chrome, Edge or Firefox. |
| WSL | A Windows browser, driven through the Windows Node.js that WSL already exposes. Nothing to install on the Linux side. Pass `--no-windows-browser` to use a Linux browser instead. |

Safari cannot be driven this way. On a Mac without Chrome, Edge or Firefox, or anywhere the browser window fails to open, sign in to the course site in any browser, open its devtools, copy the `Cookie` header from a request to `student.cs.uwaterloo.ca` (Network tab, request headers), and run `george login --cookie "<paste>"`. Paste the whole header: the session is tied to one backend by a second cookie.

Sessions and config live in `~/.config/george/` (`%USERPROFILE%\.config\george` on Windows). Node.js 22.12 or newer is required; on Ubuntu, the `apt` package is older, so use [nvm](https://github.com/nvm-sh/nvm) or the NodeSource repository.

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

`packages/cli/dist/login-worker.js` (and the same file in the extension) is the browser half of `login`, bundled separately so that on WSL the core library can run it under Windows Node.js.
