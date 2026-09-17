import { mkdir } from "node:fs/promises";
import { loadConfig, saveConfig, type Config } from "./config.js";
import { downloadAll, type DownloadReport } from "./files.js";
import { login } from "./login.js";
import { isExpired, loadSession, type Session } from "./session.js";

export interface InitOptions {
  /** Asked when no user ids are saved. Return the ids to save. */
  askUserIds: () => Promise<string[]>;
  onStatus?: (message: string) => void;
  onFile?: Parameters<typeof downloadAll>[1]["onFile"];
}

/** Returns a working session, logging in through the browser when needed. */
export async function ensureSession(onStatus: (m: string) => void = () => {}): Promise<Session> {
  const saved = loadSession();
  if (saved && !(await isExpired(saved))) return saved;
  onStatus(saved ? "Saved session has expired." : "No saved session.");
  return login({ onStatus });
}

/** Returns saved user ids, asking for them once when missing. */
export async function ensureConfig(askUserIds: () => Promise<string[]>): Promise<Config> {
  const saved = loadConfig();
  if (saved) return saved;
  const config = { userIds: await askUserIds() };
  saveConfig(config);
  return config;
}

/**
 * One-shot setup of the george side: folder, login, user ids, download all.
 * Never touches git.
 */
export async function init(dir: string, opts: InitOptions): Promise<DownloadReport> {
  const status = opts.onStatus ?? (() => {});
  await mkdir(dir, { recursive: true });
  const session = await ensureSession(status);
  const config = await ensureConfig(opts.askUserIds);
  status(`Downloading into ${dir}...`);
  return downloadAll(dir, { session, userIds: config.userIds, onFile: opts.onFile });
}
