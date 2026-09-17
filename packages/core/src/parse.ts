/**
 * Parser for george's plain-text reply. Driven by the corpus in fixtures/replies.
 *
 * Shape of a reply:
 *
 *   +-+-+ George Version 2026-09-06
 *
 *   #q 05, part 1, #check ND
 *   ++ Comment: Typechecking passed
 *   -- Error: line 12: Could not match rule and_e "$P & &Q |- $P"
 *   -- Warning: Unchecked rule: `arith` used on line(s): 10, 13, 14
 *
 * Top-level syntax errors replace the blocks entirely:
 *
 *   Input file had syntax errors and may not have been parsed correctly or completely
 *   line 9:0 mismatched input '<EOF>' expecting {...}
 *
 * Line numbers are 1-based and refer to the whole .grg file.
 */

export type MessageKind = "comment" | "error" | "warning";

export interface Message {
  kind: MessageKind;
  /** Message text with the `++ Comment: ` / `-- Error: ` prefix removed. */
  text: string;
  /** File lines this message points at, when george names any. */
  lines: number[];
}

export interface QuestionBlock {
  /** The `#q` id, e.g. "05" or "01a". */
  question: string;
  /** 1-based index of the `#check` within the question. */
  part: number;
  /** The `#check` method, e.g. "ND". */
  method: string;
  /** No `-- Error:` lines in the block. */
  passed: boolean;
  /** george reported `magic` as used. Always an error. */
  magicUsed: boolean;
  messages: Message[];
  /** Every line of the block, header included, verbatim. */
  lines: string[];
}

export interface SyntaxError {
  /** 1-based file line. */
  line: number;
  /** 0-based column, as george prints it. */
  column: number;
  text: string;
}

export interface Feedback {
  /** From `+-+-+ George Version ...`, or null if the line was absent. */
  version: string | null;
  /** True when at least one block was found, none failed, and there were no syntax errors. */
  ok: boolean;
  blocks: QuestionBlock[];
  syntaxErrors: SyntaxError[];
  /** Non-empty lines that belong to no block and are not syntax errors or the version line. */
  preamble: string[];
  raw: string;
}

const VERSION_RE = /^\+-\+-\+ George Version (\S+)/;
const BLOCK_RE = /^#q (\S+), part (\d+), #check (\S+)\s*$/;
const MESSAGE_RE = /^(\+\+ Comment|-- Error|-- Warning): ?(.*)$/;
const SYNTAX_RE = /^line (\d+):(\d+) (.*)$/;
const LINE_REF_RE = /\bline (\d+):/;
const LINES_REF_RE = /line\(s\): ([\d,\s]+)/;
const MAGIC_RE = /Unchecked rule: `magic`/;

function referencedLines(text: string): number[] {
  const many = LINES_REF_RE.exec(text);
  if (many) {
    return many[1]
      .split(",")
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n));
  }
  const one = LINE_REF_RE.exec(text);
  return one ? [Number.parseInt(one[1], 10)] : [];
}

export function parseFeedback(raw: string): Feedback {
  const lines = raw.split(/\r?\n/);
  let version: string | null = null;
  const blocks: QuestionBlock[] = [];
  const syntaxErrors: SyntaxError[] = [];
  const preamble: string[] = [];
  let current: QuestionBlock | null = null;

  for (const line of lines) {
    const v = VERSION_RE.exec(line);
    if (v) {
      version = v[1];
      continue;
    }
    const b = BLOCK_RE.exec(line);
    if (b) {
      current = {
        question: b[1],
        part: Number.parseInt(b[2], 10),
        method: b[3],
        passed: true,
        magicUsed: false,
        messages: [],
        lines: [line],
      };
      blocks.push(current);
      continue;
    }
    if (current) {
      if (line.trim() === "") {
        // A blank line ends the block; keep collecting blanks out of the block.
        current = null;
        continue;
      }
      current.lines.push(line);
      const m = MESSAGE_RE.exec(line);
      if (m) {
        const kind: MessageKind =
          m[1] === "++ Comment" ? "comment" : m[1] === "-- Error" ? "error" : "warning";
        const text = m[2];
        current.messages.push({ kind, text, lines: referencedLines(text) });
        if (kind === "error") current.passed = false;
        if (MAGIC_RE.test(text)) current.magicUsed = true;
      } else {
        // Unknown line inside a block: keep it visible and treat it as an error
        // so a format change fails loudly rather than passing silently.
        current.messages.push({ kind: "error", text: line, lines: referencedLines(line) });
        current.passed = false;
      }
      continue;
    }
    if (line.trim() === "") continue;
    const s = SYNTAX_RE.exec(line);
    if (s) {
      syntaxErrors.push({ line: Number.parseInt(s[1], 10), column: Number.parseInt(s[2], 10), text: s[3] });
      continue;
    }
    preamble.push(line);
  }

  const ok = blocks.length > 0 && syntaxErrors.length === 0 && blocks.every((b) => b.passed);
  return { version, ok, blocks, syntaxErrors, preamble, raw };
}

/** One line per block plus one per syntax error; what `george check --quiet` prints. */
export function summarize(fb: Feedback): string[] {
  const out: string[] = [];
  for (const e of fb.syntaxErrors) out.push(`SYNTAX  line ${e.line}: ${e.text}`);
  for (const p of fb.preamble) out.push(`        ${p}`);
  for (const b of fb.blocks) {
    const status = b.passed ? "PASS" : b.magicUsed ? "MAGIC" : "FAIL";
    const errors = b.messages.filter((m) => m.kind === "error").map((m) => m.text);
    const warnings = b.messages.filter((m) => m.kind === "warning").length;
    let line = `${status.padEnd(7)} #q ${b.question} part ${b.part} ${b.method}`;
    if (errors.length) line += `: ${errors.join("; ")}`;
    else if (warnings) line += ` (${warnings} warning${warnings === 1 ? "" : "s"})`;
    out.push(line);
  }
  return out;
}
