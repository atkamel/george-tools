import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/** True inside Windows Subsystem for Linux, where the kernel release names Microsoft. */
export function isWsl(platform: NodeJS.Platform = process.platform, release: string = os.release()): boolean {
  return platform === "linux" && /microsoft/i.test(release);
}

/**
 * The Windows Node.js reachable through WSL interop, or null. WSL appends the
 * Windows PATH to the Linux one, so node.exe shows up in a /mnt/<drive> directory.
 */
export function findWindowsNode(
  pathVar: string = process.env.PATH ?? "",
  exists: (file: string) => boolean = existsSync,
): string | null {
  for (const dir of pathVar.split(":")) {
    if (!dir.startsWith("/mnt/")) continue;
    const candidate = path.posix.join(dir, "node.exe");
    if (exists(candidate)) return candidate;
  }
  return null;
}

/** Major version of a node executable, or null if it does not run. */
export function nodeMajor(exe: string): number | null {
  try {
    const out = execFileSync(exe, ["--version"], { encoding: "utf8", timeout: 10_000 });
    const m = /v(\d+)/.exec(out);
    return m ? Number.parseInt(m[1], 10) : null;
  } catch {
    return null;
  }
}

/** A Linux path as Windows sees it: C:\... for /mnt/c, \\wsl.localhost\... for the Linux filesystem. */
export function toWindowsPath(linuxPath: string): string {
  return execFileSync("wslpath", ["-w", linuxPath], { encoding: "utf8" }).trim();
}
