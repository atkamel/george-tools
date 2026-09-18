import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { configDir } from "./config.js";
import { LOGIN_PROBE_URL } from "./constants.js";

export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  /** Unix seconds, -1 for a session cookie. */
  expires: number;
}

export interface Session {
  cookies: Cookie[];
  /** ISO timestamp of the login. */
  createdAt: string;
}

const sessionPath = () => path.join(configDir(), "session.json");

export function loadSession(): Session | null {
  try {
    const parsed = JSON.parse(readFileSync(sessionPath(), "utf8")) as Session;
    if (!Array.isArray(parsed.cookies)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  mkdirSync(configDir(), { recursive: true });
  writeFileSync(sessionPath(), JSON.stringify(session, null, 2) + "\n", { mode: 0o600 });
}

export function clearSession(): void {
  try {
    unlinkSync(sessionPath());
  } catch {
    /* nothing to clear */
  }
}

/** Whether a cookie set for `domain` (with or without a leading dot) is sent to `host`. */
export function cookieMatchesHost(domain: string, host: string): boolean {
  const bare = domain.replace(/^\./, "");
  return host === bare || host.endsWith(`.${bare}`);
}

export function cookieHeader(session: Session, url: string): string {
  const host = new URL(url).hostname;
  return session.cookies
    .filter((c) => cookieMatchesHost(c.domain, host))
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

/** True if the saved session no longer gets past the SSO redirect. */
export async function isExpired(session: Session, probeUrl: string = LOGIN_PROBE_URL): Promise<boolean> {
  const res = await fetch(probeUrl, {
    method: "HEAD",
    headers: { Cookie: cookieHeader(session, probeUrl) },
    redirect: "manual",
  });
  return res.status !== 200;
}
