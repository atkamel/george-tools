import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export interface Config {
  userIds: string[];
}

export function configDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  return path.join(xdg && xdg.length > 0 ? xdg : path.join(os.homedir(), ".config"), "george");
}

const configPath = () => path.join(configDir(), "config.json");

export function loadConfig(): Config | null {
  try {
    const parsed = JSON.parse(readFileSync(configPath(), "utf8")) as Partial<Config>;
    if (!Array.isArray(parsed.userIds) || parsed.userIds.length === 0) return null;
    return { userIds: parsed.userIds.map(String) };
  } catch {
    return null;
  }
}

export function saveConfig(config: Config): void {
  mkdirSync(configDir(), { recursive: true });
  writeFileSync(configPath(), JSON.stringify(config, null, 2) + "\n");
}

const USER_ID_RE = /^[a-zA-Z0-9_]+$/;

/** Accepts "id1,id2" or "id1 id2"; rejects anything george would not. */
export function parseUserIds(input: string): string[] {
  const ids = input
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (ids.length === 0 || ids.length > 2) {
    throw new Error("Enter one or two WatIAM user ids.");
  }
  for (const id of ids) {
    if (!USER_ID_RE.test(id)) throw new Error(`"${id}" is not a valid user id.`);
  }
  return ids;
}
