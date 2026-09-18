import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/** Browsers george can drive for the one-time login, in the order they are tried. */
export type BrowserName = "chrome" | "edge" | "firefox";
export const BROWSERS: readonly BrowserName[] = ["chrome", "edge", "firefox"];
export const BROWSER_LABELS: Record<BrowserName, string> = {
  chrome: "Google Chrome",
  edge: "Microsoft Edge",
  firefox: "Firefox",
};

export function isBrowserName(value: string): value is BrowserName {
  return (BROWSERS as readonly string[]).includes(value);
}

/** What the discovery needs to know about the machine. Injected so tests can fake other platforms. */
export interface Host {
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
  home: string;
  exists: (file: string) => boolean;
}

export function thisHost(): Host {
  return { platform: process.platform, env: process.env, home: os.homedir(), exists: existsSync };
}

export interface FoundBrowser {
  name: BrowserName;
  executablePath: string;
}

/** Every place a browser is normally installed on the host's platform, most common first. */
export function candidatePaths(name: BrowserName, host: Host): string[] {
  switch (host.platform) {
    case "win32":
      return windowsPaths(name, host);
    case "darwin":
      return macPaths(name, host);
    default:
      return linuxPaths(name, host);
  }
}

function windowsPaths(name: BrowserName, host: Host): string[] {
  const relative: Record<BrowserName, string> = {
    chrome: "Google\\Chrome\\Application\\chrome.exe",
    edge: "Microsoft\\Edge\\Application\\msedge.exe",
    firefox: "Mozilla Firefox\\firefox.exe",
  };
  const roots = [host.env.PROGRAMFILES, host.env["PROGRAMFILES(X86)"], host.env.LOCALAPPDATA].filter(
    (r): r is string => typeof r === "string" && r.length > 0,
  );
  return roots.map((root) => path.win32.join(root, relative[name]));
}

function macPaths(name: BrowserName, host: Host): string[] {
  const app: Record<BrowserName, string> = {
    chrome: "Google Chrome.app/Contents/MacOS/Google Chrome",
    edge: "Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    firefox: "Firefox.app/Contents/MacOS/firefox",
  };
  return ["/Applications", path.posix.join(host.home, "Applications")].map((dir) => path.posix.join(dir, app[name]));
}

function linuxPaths(name: BrowserName, host: Host): string[] {
  const commands: Record<BrowserName, string[]> = {
    chrome: ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"],
    edge: ["microsoft-edge", "microsoft-edge-stable"],
    firefox: ["firefox", "firefox-esr"],
  };
  const fixed: Record<BrowserName, string[]> = {
    chrome: ["/opt/google/chrome/chrome"],
    edge: ["/opt/microsoft/msedge/msedge"],
    firefox: ["/usr/lib/firefox/firefox", "/snap/firefox/current/usr/lib/firefox/firefox"],
  };
  const dirs = (host.env.PATH ?? "").split(":").filter((d) => d.length > 0);
  const onPath = commands[name].flatMap((cmd) => dirs.map((dir) => path.posix.join(dir, cmd)));
  return [...onPath, ...fixed[name]];
}

/** The first installed copy of one browser, or null. */
export function findBrowser(name: BrowserName, host: Host = thisHost()): FoundBrowser | null {
  const found = candidatePaths(name, host).find((p) => host.exists(p));
  return found ? { name, executablePath: found } : null;
}

/**
 * The browser to use for login: the requested one, or the first installed one
 * in BROWSERS order. An explicit executable path wins and is not checked.
 */
export function pickBrowser(
  preferred: { browser?: BrowserName; executablePath?: string },
  host: Host = thisHost(),
): FoundBrowser | null {
  if (preferred.executablePath) {
    return { name: preferred.browser ?? guessName(preferred.executablePath), executablePath: preferred.executablePath };
  }
  if (preferred.browser) return findBrowser(preferred.browser, host);
  for (const name of BROWSERS) {
    const found = findBrowser(name, host);
    if (found) return found;
  }
  return null;
}

/** Firefox needs a different protocol, so an explicit path still needs a name. */
function guessName(executablePath: string): BrowserName {
  const base = path.basename(executablePath).toLowerCase();
  if (base.includes("firefox")) return "firefox";
  if (base.includes("edge")) return "edge";
  return "chrome";
}
