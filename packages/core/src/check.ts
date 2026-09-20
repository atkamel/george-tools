import { CHECK_URL, DEFAULT_TIMEOUT_MS, MAX_FILE_BYTES } from "./constants.js";

export interface CheckOptions {
  timeoutMs?: number;
}

export class GeorgeUnreachableError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "GeorgeUnreachableError";
  }
}

/** Sends a .grg file to george and returns the plain-text reply. */
export async function check(text: string, opts: CheckOptions = {}): Promise<string> {
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes > MAX_FILE_BYTES) {
    throw new Error(`File is ${bytes} bytes; george accepts at most ${MAX_FILE_BYTES}.`);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(CHECK_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: text,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new GeorgeUnreachableError(`george answered HTTP ${res.status}`);
    }
    return await res.text();
  } catch (err) {
    if (err instanceof GeorgeUnreachableError) throw err;
    const reason = err instanceof Error && err.name === "AbortError" ? "timed out" : "could not connect";
    throw new GeorgeUnreachableError(`Request to george ${reason}.`, err);
  } finally {
    clearTimeout(timer);
  }
}
