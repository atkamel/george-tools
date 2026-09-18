// Runs the browser half of `george login` and prints the cookies as one JSON
// line on stdout. On WSL, core runs this file under Windows Node.js so the
// sign-in happens in a Windows browser. Status goes to stderr.
import { isBrowserName, type BrowserName } from "./browsers.js";
import { loginInBrowser } from "./login.js";

function parseArgs(argv: string[]): { browser?: BrowserName; browserPath?: string; timeoutMs?: number } {
  const out: { browser?: BrowserName; browserPath?: string; timeoutMs?: number } = {};
  for (let i = 0; i < argv.length; i++) {
    const next = argv[i + 1];
    if (argv[i] === "--browser" && next && isBrowserName(next)) out.browser = next;
    if (argv[i] === "--browser-path" && next) out.browserPath = next;
    if (argv[i] === "--timeout" && next) out.timeoutMs = Number.parseInt(next, 10);
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  try {
    const cookies = await loginInBrowser({ ...args, onStatus: (m) => process.stderr.write(`${m}\n`) });
    process.stdout.write(`${JSON.stringify({ cookies })}\n`);
  } catch (err) {
    const e = err as Error;
    process.stdout.write(`${JSON.stringify({ error: e.message, name: e.name })}\n`);
    process.exitCode = 1;
  }
}

void main();
