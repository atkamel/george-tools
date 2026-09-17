import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { COURSE_ROOT, FILES_INDEX_URL } from "./constants.js";
import { writeHeader } from "./header.js";
import { cookieHeader, type Session } from "./session.js";

export interface RemoteFile {
  name: string;
  /** Path relative to the course root, e.g. "/asn/a01/a01q01.grg". */
  path: string;
}

export interface Group {
  /** "Assignment 1", "Homework", ... Also the folder name on disk. */
  name: string;
  files: RemoteFile[];
}

export class NotLoggedInError extends Error {
  constructor() {
    super("Not logged in. Run `george login` first.");
    this.name = "NotLoggedInError";
  }
}

/** The public index of every assignment and homework file. No login needed. */
export async function listFiles(): Promise<Group[]> {
  const res = await fetch(FILES_INDEX_URL);
  if (!res.ok) throw new Error(`Could not fetch ${FILES_INDEX_URL}: HTTP ${res.status}`);
  const data = (await res.json()) as Group[];
  return data.map((g) => ({ name: g.name, files: g.files.map((f) => ({ name: f.name, path: f.path })) }));
}

/** Fetches one SSO-gated file. Throws NotLoggedInError on the mellon redirect. */
export async function download(filePath: string, session: Session): Promise<string> {
  const url = COURSE_ROOT + filePath;
  const res = await fetch(url, {
    headers: { Cookie: cookieHeader(session, url) },
    redirect: "manual",
  });
  if (res.status >= 300 && res.status < 400) throw new NotLoggedInError();
  if (!res.ok) throw new Error(`Could not fetch ${url}: HTTP ${res.status}`);
  const text = await res.text();
  // A login page served with 200 would otherwise be saved as a .grg file.
  if (/<html|<!DOCTYPE/i.test(text.slice(0, 200))) throw new NotLoggedInError();
  return text;
}

export interface DownloadAllOptions {
  session: Session;
  userIds: string[];
  /** Restrict to files whose name starts with this, e.g. "a01" or "h02". */
  only?: string;
  onFile?: (event: { group: string; file: string; status: "written" | "skipped" }) => void;
}

export interface DownloadReport {
  written: string[];
  skipped: string[];
}

/**
 * Downloads every file in the index into `dest/<group name>/<file>`, writing
 * the `#u` header, and never overwriting a file that already exists locally.
 */
export async function downloadAll(dest: string, opts: DownloadAllOptions): Promise<DownloadReport> {
  const groups = await listFiles();
  const report: DownloadReport = { written: [], skipped: [] };
  const only = opts.only?.toLowerCase();

  for (const group of groups) {
    const files = only ? group.files.filter((f) => f.name.toLowerCase().startsWith(only)) : group.files;
    if (files.length === 0) continue;
    const dir = path.join(dest, group.name);
    await mkdir(dir, { recursive: true });
    for (const file of files) {
      const target = path.join(dir, file.name);
      if (await exists(target)) {
        report.skipped.push(target);
        opts.onFile?.({ group: group.name, file: file.name, status: "skipped" });
        continue;
      }
      const text = await download(file.path, opts.session);
      await writeFile(target, writeHeader(text, opts.userIds));
      report.written.push(target);
      opts.onFile?.({ group: group.name, file: file.name, status: "written" });
    }
  }
  return report;
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export async function readGrg(file: string): Promise<string> {
  return readFile(file, "utf8");
}
