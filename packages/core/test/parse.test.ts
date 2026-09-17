import { readdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseFeedback, summarize } from "../src/parse.js";

const dir = path.resolve(__dirname, "../../../fixtures/replies");
const replies = readdirSync(dir).filter((f) => f.endsWith(".reply.txt"));

// Hand-checked expectations for every fixture. `blocks` lists [question, part, method, passed, magicUsed].
const expected: Record<string, { ok: boolean; syntaxErrors: number; blocks: [string, number, string, boolean, boolean][] }> = {
  arith_induction: { ok: true, syntaxErrors: 0, blocks: [["07", 1, "ND", true, false]] },
  empty: { ok: false, syntaxErrors: 0, blocks: [] },
  garbage_before_q: { ok: false, syntaxErrors: 1, blocks: [] },
  missing_u: { ok: false, syntaxErrors: 0, blocks: [["01", 1, "PROP", false, false]] },
  multi_question: {
    ok: true,
    syntaxErrors: 0,
    blocks: [["01a", 1, "PROP", true, false], ["01a", 2, "PROP", true, false], ["01b", 1, "ND", true, false]],
  },
  nd_incomplete: { ok: false, syntaxErrors: 0, blocks: [["05", 1, "ND", false, false]] },
  nd_magic: { ok: false, syntaxErrors: 0, blocks: [["05", 1, "ND", false, true]] },
  nd_pass: { ok: true, syntaxErrors: 0, blocks: [["05", 1, "ND", true, false]] },
  nd_wrong_rule: { ok: false, syntaxErrors: 0, blocks: [["05", 1, "ND", false, false]] },
  pc_factorial: {
    ok: true,
    syntaxErrors: 0,
    blocks: [["09", 1, "PC", true, false], ["09", 2, "ND", true, false], ["09", 3, "ND", true, false], ["09", 4, "ND", true, false]],
  },
  pred_pass: { ok: true, syntaxErrors: 0, blocks: [["02", 1, "PRED", true, false]] },
  predtypes_pass: { ok: true, syntaxErrors: 0, blocks: [["02", 1, "PREDTYPES", true, false]] },
  prop_pass: { ok: true, syntaxErrors: 0, blocks: [["01", 1, "PROP", true, false]] },
  prop_syntax_error: { ok: false, syntaxErrors: 1, blocks: [] },
  sem_ce_fail: { ok: false, syntaxErrors: 0, blocks: [["03", 1, "SEM_CE", false, false]] },
  sem_pass: { ok: true, syntaxErrors: 0, blocks: [["03", 1, "SEM", true, false]] },
  sem_t_fail: { ok: false, syntaxErrors: 0, blocks: [["03", 1, "SEM_T", false, false]] },
  set_tp: { ok: true, syntaxErrors: 0, blocks: [["08", 1, "TP", true, false]] },
  st_open_branch: { ok: false, syntaxErrors: 0, blocks: [["06", 1, "ST", false, false]] },
  st_pass: { ok: true, syntaxErrors: 0, blocks: [["06", 1, "ST", true, false]] },
  tp_magic: { ok: false, syntaxErrors: 0, blocks: [["04", 1, "TP", false, true]] },
  tp_pass: { ok: true, syntaxErrors: 0, blocks: [["04", 1, "TP", true, false]] },
  tp_wrong_rule: { ok: false, syntaxErrors: 0, blocks: [["04", 1, "TP", false, false]] },
  z_schema: { ok: true, syntaxErrors: 0, blocks: [["10", 1, "Z", true, false]] },
};

describe("parseFeedback against the fixture corpus", () => {
  it("has an expectation for every fixture", () => {
    const names = replies.map((f) => f.replace(/\.reply\.txt$/, "")).sort();
    expect(names).toEqual(Object.keys(expected).sort());
  });

  for (const file of replies) {
    const name = file.replace(/\.reply\.txt$/, "");
    it(name, () => {
      const fb = parseFeedback(readFileSync(path.join(dir, file), "utf8"));
      const want = expected[name];
      expect(fb.ok).toBe(want.ok);
      expect(fb.syntaxErrors).toHaveLength(want.syntaxErrors);
      expect(fb.blocks.map((b) => [b.question, b.part, b.method, b.passed, b.magicUsed])).toEqual(want.blocks);
      if (fb.blocks.length > 0 || fb.syntaxErrors.length > 0) expect(fb.version).toBe("2026-09-06");
    });
  }
});

describe("details", () => {
  const load = (n: string) => parseFeedback(readFileSync(path.join(dir, `${n}.reply.txt`), "utf8"));

  it("extracts the file line from an error", () => {
    const fb = load("nd_wrong_rule");
    const err = fb.blocks[0].messages.find((m) => m.kind === "error")!;
    expect(err.lines).toEqual([12]);
    expect(err.text).toContain("Could not match rule and_e");
  });

  it("extracts several lines from an unchecked-rule warning", () => {
    const fb = load("arith_induction");
    const warns = fb.blocks[0].messages.filter((m) => m.kind === "warning");
    expect(warns[0].lines).toEqual([10, 13, 14]);
    expect(warns[1].lines).toEqual([16]);
  });

  it("reports syntax error position", () => {
    const fb = load("prop_syntax_error");
    expect(fb.syntaxErrors[0]).toMatchObject({ line: 9, column: 0 });
    expect(fb.preamble[0]).toMatch(/^Input file had syntax errors/);
  });

  it("keeps Empty input. visible", () => {
    const fb = load("empty");
    expect(fb.preamble).toEqual(["Empty input."]);
  });

  it("summarizes one line per block", () => {
    expect(summarize(load("pc_factorial"))).toEqual([
      "PASS    #q 09 part 1 PC",
      "PASS    #q 09 part 2 ND (1 warning)",
      "PASS    #q 09 part 3 ND (1 warning)",
      "PASS    #q 09 part 4 ND",
    ]);
    expect(summarize(load("nd_magic"))[0]).toMatch(/^MAGIC   #q 05 part 1 ND: Unchecked rule: `magic`/);
  });
});
