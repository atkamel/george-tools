import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import {
  check,
  parseFeedback,
  readGrg,
  loadConfig,
  saveConfig,
  parseUserIds,
  configDir,
  loadSession,
  clearSession,
  login,
  downloadAll,
  init,
  ensureSession,
  ensureConfig,
  GeorgeUnreachableError,
  NotLoggedInError,
  NoBrowserError,
} from "@george-tools/core";
import { askUserIds } from "./prompt.js";
import { bold, colourReply, colourSummary, dim, green, red, yellow } from "./format.js";

const EXIT_FAIL = 1;
const EXIT_UNREACHABLE = 2;

const program = new Command()
  .name("george")
  .description("Download SE212 assignments and check .grg files against george.")
  .version("0.1.0");

program
  .command("login")
  .description("Sign in to the course site in a browser window and save the session.")
  .action(async () => {
    try {
      await login({ onStatus: (m) => console.log(dim(m)) });
      console.log(green("Logged in.") + dim(` Session saved in ${configDir()}.`));
    } catch (err) {
      if (err instanceof NoBrowserError) fail(err.message, EXIT_UNREACHABLE);
      throw err;
    }
  });

program
  .command("logout")
  .description("Forget the saved session.")
  .action(() => {
    clearSession();
    console.log("Session cleared.");
  });

program
  .command("config")
  .description("Show or set the group's WatIAM user ids, written to every downloaded file as #u.")
  .option("--users <ids>", "one or two ids, comma separated")
  .action((opts: { users?: string }) => {
    if (opts.users) {
      const userIds = parseUserIds(opts.users);
      saveConfig({ userIds });
      console.log(`Saved: #u ${userIds.join(" ")}`);
      return;
    }
    const cfg = loadConfig();
    console.log(cfg ? `#u ${cfg.userIds.join(" ")}` : dim("No user ids saved. Run: george config --users id1,id2"));
    console.log(dim(`Config directory: ${configDir()}`));
    console.log(dim(loadSession() ? "Session: saved" : "Session: none (run george login)"));
  });

program
  .command("download [only]")
  .description(
    "Download every assignment and homework file into Assignment N/ and Homework/ folders, " +
      "skipping files that already exist. Pass a prefix such as a01 or h02 to restrict.",
  )
  .option("--dest <dir>", "folder to download into", ".")
  .action(async (only: string | undefined, opts: { dest: string }) => {
    const session = await ensureSession((m) => console.log(dim(m)));
    const { userIds } = await ensureConfig(askUserIds);
    try {
      const report = await downloadAll(path.resolve(opts.dest), { session, userIds, only, onFile: printFile });
      console.log(summaryLine(report.written.length, report.skipped.length));
    } catch (err) {
      if (err instanceof NotLoggedInError) fail(err.message, EXIT_UNREACHABLE);
      throw err;
    }
  });

program
  .command("check <paths...>")
  .description("Send .grg files (or every .grg in a directory) to george and print the feedback.")
  .option("--json", "print the parsed feedback as JSON")
  .option("--quiet", "print one line per question instead of the full reply")
  .option("--timeout <ms>", "give up after this many milliseconds", (v) => Number.parseInt(v, 10))
  .action(async (paths: string[], opts: { json?: boolean; quiet?: boolean; timeout?: number }) => {
    const files = await expandPaths(paths);
    if (files.length === 0) fail("No .grg files found.", EXIT_FAIL);
    let allOk = true;
    const results: Record<string, unknown> = {};
    for (const file of files) {
      const text = await readGrg(file);
      let raw: string;
      try {
        raw = await check(text, { timeoutMs: opts.timeout });
      } catch (err) {
        if (err instanceof GeorgeUnreachableError) fail(err.message, EXIT_UNREACHABLE);
        throw err;
      }
      const fb = parseFeedback(raw);
      allOk &&= fb.ok;
      if (opts.json) {
        results[file] = { ...fb, raw: undefined };
        continue;
      }
      if (files.length > 1 || opts.quiet) console.log(bold(file));
      console.log(opts.quiet ? colourSummary(fb) : colourReply(raw).trimEnd());
      if (!opts.quiet && files.length > 1) console.log();
    }
    if (opts.json) console.log(JSON.stringify(files.length === 1 ? results[files[0]] : results, null, 2));
    process.exitCode = allOk ? 0 : EXIT_FAIL;
  });

program
  .command("init [dir]")
  .description(
    "One-shot setup: log in if needed, save user ids if missing, download every file into dir " +
      "(default: current folder). Does not touch git.",
  )
  .action(async (dir: string | undefined) => {
    const target = path.resolve(dir ?? ".");
    try {
      const report = await init(target, {
        askUserIds,
        onStatus: (m) => console.log(dim(m)),
        onFile: printFile,
      });
      console.log(summaryLine(report.written.length, report.skipped.length));
      console.log(dim("Version control is up to you: create a private repo and commit these files."));
    } catch (err) {
      if (err instanceof NoBrowserError || err instanceof NotLoggedInError) fail(err.message, EXIT_UNREACHABLE);
      throw err;
    }
  });

function printFile(e: { group: string; file: string; status: "written" | "skipped" }) {
  const mark = e.status === "written" ? green("+") : dim("=");
  console.log(`${mark} ${e.group}/${e.file}${e.status === "skipped" ? dim(" (exists)") : ""}`);
}

function summaryLine(written: number, skipped: number): string {
  return `${written} file${written === 1 ? "" : "s"} written, ${skipped} already present.`;
}

function fail(message: string, code: number): never {
  console.error(red(message));
  process.exit(code);
}

async function expandPaths(paths: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const p of paths) {
    const s = await stat(p).catch(() => null);
    if (!s) fail(`No such file: ${p}`, EXIT_FAIL);
    if (s.isDirectory()) {
      const entries = (await readdir(p)).filter((f) => f.endsWith(".grg")).sort();
      out.push(...entries.map((f) => path.join(p, f)));
    } else {
      out.push(p);
    }
  }
  return out;
}

program.parseAsync(process.argv).catch((err: Error) => {
  console.error(red(err.message));
  process.exit(EXIT_UNREACHABLE);
});
