import { describe, expect, it } from "vitest";
import { candidatePaths, findBrowser, pickBrowser, type Host } from "../src/browsers.js";

function host(platform: NodeJS.Platform, installed: string[], env: NodeJS.ProcessEnv = {}): Host {
  const set = new Set(installed);
  return { platform, env, home: platform === "win32" ? "C:\\Users\\me" : "/home/me", exists: (p) => set.has(p) };
}

describe("browser discovery", () => {
  it("finds Edge under Program Files (x86) on Windows", () => {
    const h = host("win32", ["C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"], {
      PROGRAMFILES: "C:\\Program Files",
      "PROGRAMFILES(X86)": "C:\\Program Files (x86)",
      LOCALAPPDATA: "C:\\Users\\me\\AppData\\Local",
    });
    expect(findBrowser("chrome", h)).toBeNull();
    expect(findBrowser("edge", h)?.executablePath).toBe(
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    );
    expect(candidatePaths("firefox", h)).toContain("C:\\Users\\me\\AppData\\Local\\Mozilla Firefox\\firefox.exe");
  });

  it("looks in /Applications and ~/Applications on macOS", () => {
    const h = host("darwin", ["/home/me/Applications/Firefox.app/Contents/MacOS/firefox"]);
    expect(candidatePaths("chrome", h)[0]).toBe("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
    expect(findBrowser("firefox", h)?.executablePath).toBe("/home/me/Applications/Firefox.app/Contents/MacOS/firefox");
  });

  it("walks PATH on Linux and knows the fixed install locations", () => {
    const h = host("linux", ["/usr/bin/firefox", "/opt/google/chrome/chrome"], { PATH: "/usr/local/bin:/usr/bin" });
    expect(findBrowser("chrome", h)?.executablePath).toBe("/opt/google/chrome/chrome");
    expect(findBrowser("firefox", h)?.executablePath).toBe("/usr/bin/firefox");
    expect(findBrowser("edge", h)).toBeNull();
  });

  it("picks chrome, then edge, then firefox unless told otherwise", () => {
    const h = host("linux", ["/usr/bin/microsoft-edge", "/usr/bin/firefox"], { PATH: "/usr/bin" });
    expect(pickBrowser({}, h)?.name).toBe("edge");
    expect(pickBrowser({ browser: "firefox" }, h)?.name).toBe("firefox");
    expect(pickBrowser({ browser: "chrome" }, h)).toBeNull();
  });

  it("trusts an explicit path and infers the browser from its name", () => {
    const h = host("linux", []);
    expect(pickBrowser({ executablePath: "/opt/firefox/firefox" }, h)).toEqual({
      name: "firefox",
      executablePath: "/opt/firefox/firefox",
    });
    expect(pickBrowser({ executablePath: "C:\\x\\msedge.exe" }, h)?.name).toBe("edge");
    expect(pickBrowser({ executablePath: "/usr/bin/chromium", browser: "chrome" }, h)?.name).toBe("chrome");
  });
});
