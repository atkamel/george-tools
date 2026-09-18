import { spawn } from "node:child_process";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BROWSER_LABELS, BROWSERS, pickBrowser, type BrowserName } from "./browsers.js";
import { LOGIN_PROBE_URL, LOGIN_TIMEOUT_MS, MELLON_COOKIE_NAME } from "./constants.js";
import type { Cookie, Session } from "./session.js";
import { cookieMatchesHost, isExpired, saveSession } from "./session.js";
import { findWindowsNode, isWsl, nodeMajor, toWindowsPath } from "./wsl.js";

export interface LoginOptions {
  /** Which browser to open. Default: the first of chrome, edge, firefox that is installed. */
  browser?: BrowserName;
  /** A browser executable to use instead of searching. */
  browserPath?: string;
  /**
   * On WSL the browser runs on the Windows side through Windows Node.js, so no
   * Linux browser is needed. Set false to use a Linux browser instead.
   */
  windowsBrowser?: boolean;
  /** The login-worker.js to run under Windows Node.js on WSL. Default: next to this module. */
  workerPath?: string;
  /** How long to wait for the sign-in to finish. */
  timeoutMs?: number;
  /** Called with progress messages the caller may print. */
  onStatus?: (message: string) => void;
}

export class NoBrowserError extends Error {
  constructor(detail?: string) {
    super(
      (detail ?? `No browser found. george login looks for ${BROWSERS.map((b) => BROWSER_LABELS[b]).join(", ")}.`) +
        " Pass --browser-path to point at one, or --cookie to paste the session cookie instead.",
    );
    this.name = "NoBrowserError";
  }
}

export class LoginCancelledError extends Error {
  constructor() {
    super("The browser window was closed before the sign-in finished.");
    this.name = "LoginCancelledError";
  }
}

/**
 * Opens a browser on an SSO-gated course file, waits until the UWaterloo
 * sign-in redirects back to student.cs, and saves the course-site cookies.
 * On WSL the browser is a Windows one, driven by Windows Node.js.
 */
export async function login(opts: LoginOptions = {}): Promise<Session> {
  const status = opts.onStatus ?? (() => {});
  let cookies: Cookie[] | null = null;
  if (isWsl() && opts.windowsBrowser !== false) {
    const node = findWindowsNode();
    const major = node ? nodeMajor(node) : null;
    if (node && major !== null && major >= 22) {
      cookies = await loginViaWindows(node, opts);
    } else {
      status(
        node
          ? `Windows Node.js is version ${major ?? "?"}; 22 or later is needed to use a Windows browser. Using a Linux browser.`
          : "No Windows Node.js found through WSL; using a Linux browser.",
      );
    }
  }
  if (!cookies) cookies = await loginInBrowser(opts);
  return finish(cookies);
}

/**
 * Skips the browser: saves cookies the user copied from a browser they signed
 * in with. The course site sits behind haproxy and the mellon session lives on
 * one backend, so the sticky haproxy cookie is needed too: users paste the
 * whole Cookie header, and the probe runs a few times to catch a missing one.
 */
export async function loginWithCookie(input: string): Promise<Session> {
  const host = new URL(LOGIN_PROBE_URL).hostname;
  const cookies = parseCookieInput(input).map(([name, value]) => ({
    name,
    value,
    domain: name === MELLON_COOKIE_NAME ? `.${host}` : host,
    path: "/",
    expires: -1,
  }));
  const session: Session = { cookies, createdAt: new Date().toISOString() };
  for (let attempt = 0; attempt < 4; attempt++) {
    if (await isExpired(session)) {
      throw new Error(
        cookies.length === 1
          ? "That cookie did not get past the sign-in page on its own. Copy the whole Cookie header " +
            "from a request to student.cs.uwaterloo.ca and paste all of it."
          : "Those cookies did not get past the sign-in page. Sign in again and copy the current Cookie header.",
      );
    }
  }
  saveSession(session);
  return session;
}

/**
 * Accepts a whole Cookie header (`a=1; b=2`), a single `name=value`, or the
 * bare mellon value, as copied from devtools. Returns [name, value] pairs.
 */
export function parseCookieInput(input: string): [string, string][] {
  const text = input.trim().replace(/^cookie:\s*/i, "").replace(/^["']|["']$/g, "");
  const pairs: [string, string][] = [];
  const pieces = text.split(";").map((p) => p.trim()).filter((p) => p.length > 0);
  // A lone bare token is the mellon value on its own; inside a header every piece needs a name.
  if (pieces.length === 1 && !pieces[0].includes("=") && !/\s/.test(pieces[0])) return [[MELLON_COOKIE_NAME, pieces[0]]];
  for (const piece of pieces) {
    const eq = piece.indexOf("=");
    if (eq <= 0) throw new Error(`"${piece}" is not a cookie. Paste the Cookie header as devtools shows it.`);
    const name = piece.slice(0, eq).trim();
    const value = piece.slice(eq + 1).trim();
    if (name.length === 0 || value.length === 0 || /\s/.test(name) || /\s/.test(value)) {
      throw new Error(`"${piece}" is not a cookie. Paste the Cookie header as devtools shows it.`);
    }
    pairs.push([name, value]);
  }
  if (pairs.length === 0) throw new Error(`Paste the Cookie header, or at least the ${MELLON_COOKIE_NAME} value.`);
  return pairs;
}

function finish(cookies: Cookie[]): Session {
  const session: Session = { cookies, createdAt: new Date().toISOString() };
  saveSession(session);
  return session;
}

/**
 * The browser part of login, on this machine. Returns the cookies for the
 * course host. Runs under Windows Node.js when called from login-worker.js.
 */
export async function loginInBrowser(opts: LoginOptions = {}): Promise<Cookie[]> {
  const status = opts.onStatus ?? (() => {});
  const found = pickBrowser({ browser: opts.browser, executablePath: opts.browserPath });
  if (!found) {
    throw new NoBrowserError(
      opts.browser ? `${BROWSER_LABELS[opts.browser]} is not installed where george looks for it.` : undefined,
    );
  }
  const puppeteer = (await import("puppeteer-core")).default;

  // A profile of our own: never the user's, and on Linux under $HOME so a snap
  // Firefox, which cannot read /tmp, can use it.
  const profileRoot = process.platform === "linux" ? path.join(os.homedir(), ".cache", "george") : os.tmpdir();
  await mkdir(profileRoot, { recursive: true });
  const userDataDir = await mkdtemp(path.join(profileRoot, "login-"));

  status(`Opening the UWaterloo sign-in page in ${BROWSER_LABELS[found.name]}...`);
  const browser = await puppeteer.launch({
    browser: found.name === "firefox" ? "firefox" : "chrome",
    executablePath: found.executablePath,
    headless: false,
    defaultViewport: null,
    userDataDir,
    timeout: 60_000,
  });
  let closed = false;
  browser.once("disconnected", () => {
    closed = true;
  });

  try {
    const [page] = await browser.pages();
    const tab = page ?? (await browser.newPage());
    await tab.goto(LOGIN_PROBE_URL).catch(() => {
      /* the sign-in redirects mid-load; we poll the URL instead */
    });
    const probe = new URL(LOGIN_PROBE_URL);
    const deadline = Date.now() + (opts.timeoutMs ?? LOGIN_TIMEOUT_MS);
    for (;;) {
      if (closed) throw new LoginCancelledError();
      let current: URL | null = null;
      try {
        current = new URL(tab.url());
      } catch {
        /* about:blank or a page mid-navigation */
      }
      if (current && current.hostname === probe.hostname && !current.pathname.startsWith("/mellon/")) break;
      if (Date.now() > deadline) throw new Error("Timed out waiting for the sign-in to finish.");
      await new Promise((r) => setTimeout(r, 500));
    }
    status("Signed in. Saving session...");
    const all = await browser.cookies();
    return all
      .filter((c) => cookieMatchesHost(c.domain, probe.hostname))
      .map((c) => ({ name: c.name, value: c.value, domain: c.domain, path: c.path, expires: c.expires }));
  } finally {
    if (!closed) await browser.close().catch(() => {});
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Runs login-worker.js under Windows Node.js so a Windows browser does the sign-in. */
async function loginViaWindows(nodeExe: string, opts: LoginOptions): Promise<Cookie[]> {
  const status = opts.onStatus ?? (() => {});
  const worker = opts.workerPath ?? defaultWorkerPath();
  if (!worker) throw new Error("login-worker.js was not found next to the george library.");
  const args = [toWindowsPath(worker)];
  if (opts.browser) args.push("--browser", opts.browser);
  if (opts.browserPath) args.push("--browser-path", opts.browserPath);
  if (opts.timeoutMs) args.push("--timeout", String(opts.timeoutMs));
  status("Using a Windows browser through Windows Node.js.");

  const output = await new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve, reject) => {
    const child = spawn(nodeExe, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => {
      stdout += d.toString("utf8");
    });
    child.stderr.on("data", (d: Buffer) => {
      const text = d.toString("utf8");
      stderr += text;
      for (const line of text.split(/\r?\n/)) if (line.trim()) status(line.trim());
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout, stderr, code }));
  });
  const result = parseWorkerOutput(output.stdout);
  if (!result) {
    throw new Error(`The Windows login helper failed (exit ${output.code}). ${output.stderr.trim().split("\n").pop() ?? ""}`.trim());
  }
  if ("error" in result) {
    if (result.name === "NoBrowserError") throw new NoBrowserError(result.error);
    if (result.name === "LoginCancelledError") throw new LoginCancelledError();
    throw new Error(result.error);
  }
  return result.cookies;
}

export type WorkerResult = { cookies: Cookie[] } | { error: string; name: string };

/** The worker prints one JSON line last; anything before it is noise from the browser. */
export function parseWorkerOutput(stdout: string): WorkerResult | null {
  const lines = stdout.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].startsWith("{")) continue;
    try {
      const parsed = JSON.parse(lines[i]) as Partial<{ cookies: Cookie[]; error: string; name: string }>;
      if (Array.isArray(parsed.cookies)) return { cookies: parsed.cookies };
      if (typeof parsed.error === "string") return { error: parsed.error, name: parsed.name ?? "Error" };
    } catch {
      /* not ours */
    }
  }
  return null;
}

function defaultWorkerPath(): string | null {
  try {
    const url = import.meta.url;
    return typeof url === "string" && url.startsWith("file:") ? fileURLToPath(new URL("./login-worker.js", url)) : null;
  } catch {
    return null;
  }
}
