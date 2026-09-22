# george-tools

Tools for [george](https://student.cs.uwaterloo.ca/~se212/george/george-docs-1/index.html), the SE212 logic checker at the University of Waterloo. A CLI that downloads assignments and checks `.grg` files from the terminal, and a VS Code extension built on the same library.

## Install

| | |
|---|---|
| CLI | `npm i -g george-tools` (Node.js 22.12 or newer) |
| VS Code | [George Tools](https://marketplace.visualstudio.com/items?itemName=AdamKamel.george-tools) on the Marketplace, or search "George Tools" in the Extensions view |

## CLI

```
george init            # log in, save your group's user ids, download everything
george check a01.grg   # send a file (or a folder) to george
```

| Command | What it does |
|---|---|
| `george init [dir]` | First-time setup: log in, save user ids, download every file into `dir`. |
| `george login` | Sign in to the course site in a browser window and save the session. |
| `george config --users id1,id2` | The WatIAM ids written to every downloaded file as `#u`. |
| `george download [a01]` | Download new assignment and homework files into `Assignment N/` and `Homework/`. Never overwrites. |
| `george check <paths...>` | Print george's feedback. `--quiet` for one line per question, `--json` for the parsed result. |
| `george logout` | Forget the saved session. |

`check` exits 0 when everything passed, 1 when something failed, 2 when george is unreachable or you are not logged in.

Version control is up to you: make a private repo, run `george init` inside it, commit.

### Logging in

`george login` opens your own Chrome, Edge or Firefox on the UWaterloo sign-in and saves the session once you are through. On WSL it opens a Windows browser; nothing to install on the Linux side. Options:

| Option | |
|---|---|
| `--browser firefox` | Choose the browser instead of taking the first one installed. Firefox 129 or newer. |
| `--browser-path <file>` | Any browser executable. |
| `--no-windows-browser` | On WSL, use a Linux browser. |
| `--cookie "<header>"` | No browser window. Sign in on the course site in any browser, copy the whole `Cookie` header from a request to `student.cs.uwaterloo.ca` in devtools, and paste it. This is the route for Safari. |

Sessions and config live in `~/.config/george/`, shared with the VS Code extension.

## VS Code

Open a `.grg` file and press Run, or Ctrl+Enter. Failures land in the Problems panel on the lines george names. The G in the Activity Bar shows your assignment folder with each file's last result and downloads what you are missing. Details on the [Marketplace page](https://marketplace.visualstudio.com/items?itemName=AdamKamel.george-tools).

## Development

```
packages/core     @george-tools/core: check, parseFeedback, login, download, config
packages/cli      george-tools on npm, executable `george`
packages/vscode   the extension, packaged with `node packages/vscode/package.mjs`
fixtures/replies  real george replies that drive the parser tests
```

```
npm install
npm run build
npm test
```

`login-worker.js`, bundled next to the CLI and the extension, is the browser half of login. It is a separate file so that on WSL it can run under Windows Node.js.
