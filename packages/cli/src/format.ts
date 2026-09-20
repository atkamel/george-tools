import type { Feedback } from "@george-tools/core";
import { summarize } from "@george-tools/core";

const tty = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: string) => (s: string) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
export const green = paint("32");
export const red = paint("31");
export const yellow = paint("33");
export const dim = paint("2");
export const bold = paint("1");

/** Colours the raw reply line by line without changing its text. */
export function colourReply(raw: string): string {
  return raw
    .split("\n")
    .map((line) => {
      if (line.startsWith("++ Comment:")) return green(line);
      if (line.startsWith("-- Error:")) return red(line);
      if (line.startsWith("-- Warning:")) return yellow(line);
      if (line.startsWith("#q ")) return bold(line);
      if (/^line \d+:\d+ /.test(line) || line.startsWith("Input file had syntax errors")) return red(line);
      return line;
    })
    .join("\n");
}

export function colourSummary(fb: Feedback): string {
  return summarize(fb)
    .map((line) => {
      if (line.startsWith("PASS")) return green(line);
      if (line.startsWith("MAGIC")) return yellow(line);
      if (line.startsWith("FAIL") || line.startsWith("SYNTAX")) return red(line);
      return line;
    })
    .join("\n");
}
