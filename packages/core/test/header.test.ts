import { describe, expect, it } from "vitest";
import { writeHeader } from "../src/header.js";
import { parseUserIds } from "../src/config.js";

describe("writeHeader", () => {
  it("replaces an existing #u line", () => {
    expect(writeHeader("#u \n#a 01\n\n#q 01\n", ["abc"])).toBe("#u abc\n#a 01\n\n#q 01\n");
    expect(writeHeader("#u nday\n#a 01\n", ["a", "b"])).toBe("#u a b\n#a 01\n");
  });
  it("prepends when there is none", () => {
    expect(writeHeader("#a 01\n", ["abc"])).toBe("#u abc\n#a 01\n");
  });
  it("skips leading blank lines when looking for #u", () => {
    expect(writeHeader("\n#u x\n#a 01\n", ["abc"])).toBe("\n#u abc\n#a 01\n");
  });
});

describe("parseUserIds", () => {
  it("accepts commas or spaces", () => {
    expect(parseUserIds("abc, def")).toEqual(["abc", "def"]);
    expect(parseUserIds("abc def")).toEqual(["abc", "def"]);
    expect(parseUserIds("abc")).toEqual(["abc"]);
  });
  it("rejects bad input", () => {
    expect(() => parseUserIds("")).toThrow();
    expect(() => parseUserIds("a,b,c")).toThrow();
    expect(() => parseUserIds("a-b")).toThrow();
  });
});
