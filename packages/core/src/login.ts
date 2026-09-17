import { LOGIN_PROBE_URL } from "./constants.js";
import type { Cookie, Session } from "./session.js";
import { saveSession } from "./session.js";

export interface LoginOptions {
  /** Called with progress messages the caller may print. */
  onStatus?: (message: string) => void;
}

export class NoBrowserError extends Error {
  constructor() {
    super(
      "No browser found. george login needs Google Chrome or Microsoft Edge installed, " +
        "or run `npx playwright install chromium` once to download a browser.",
    );
    this.name = "NoBrowserError";
  }
}

/**
 * Opens a real browser window on an SSO-gated course file, waits until the
 * UWaterloo sign-in redirects back to student.cs, and saves the cookies.
 * Uses the system Chrome or Edge through playwright-core, so no browser download.
 */
export async function login(opts: LoginOptions = {}): Promise<Session> {
  const status = opts.onStatus ?? (() => {});
  const { chromium } = await import("playwright-core");

  let browser;
  for (const channel of ["chrome", "msedge", undefined] as const) {
    try {
      browser = await chromium.launch({ headless: false, channel });
      break;
    } catch {
      /* try the next one */
    }
  }
  if (!browser) throw new NoBrowserError();

  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    status("Opening the UWaterloo sign-in page in your browser...");
    await page.goto(LOGIN_PROBE_URL);
    const probe = new URL(LOGIN_PROBE_URL);
    await page.waitForURL(
      (url) => url.hostname === probe.hostname && !url.pathname.startsWith("/mellon/"),
      { timeout: 10 * 60 * 1000 },
    );
    status("Signed in. Saving session...");
    const cookies: Cookie[] = (await context.cookies()).map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      expires: c.expires,
    }));
    const session: Session = { cookies, createdAt: new Date().toISOString() };
    saveSession(session);
    return session;
  } finally {
    await browser.close();
  }
}
