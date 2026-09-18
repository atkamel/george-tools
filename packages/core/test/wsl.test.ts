import { describe, expect, it } from "vitest";
import { findWindowsNode, isWsl } from "../src/wsl.js";
import { parseCookieInput, parseWorkerOutput } from "../src/login.js";

describe("isWsl", () => {
  it("is true only for a Linux kernel built by Microsoft", () => {
    expect(isWsl("linux", "6.6.87.2-microsoft-standard-WSL2")).toBe(true);
    expect(isWsl("linux", "6.8.0-45-generic")).toBe(false);
    expect(isWsl("win32", "10.0.26200")).toBe(false);
  });
});

describe("findWindowsNode", () => {
  it("finds node.exe in a mounted Windows directory on PATH", () => {
    const exists = (p: string) => p === "/mnt/c/Program Files/nodejs/node.exe";
    expect(findWindowsNode("/usr/bin:/mnt/c/Program Files/nodejs:/mnt/c/Windows", exists)).toBe(
      "/mnt/c/Program Files/nodejs/node.exe",
    );
    expect(findWindowsNode("/usr/bin:/usr/local/bin", exists)).toBeNull();
    // A node.exe outside /mnt is not Windows Node.
    expect(findWindowsNode("/opt/nodejs", () => true)).toBeNull();
  });
});

describe("parseWorkerOutput", () => {
  it("reads the last JSON line and ignores browser noise", () => {
    const out = "DevTools listening on ws://127.0.0.1:1\r\n{\"cookies\":[{\"name\":\"a\",\"value\":\"b\",\"domain\":\".x\",\"path\":\"/\",\"expires\":-1}]}\r\n";
    expect(parseWorkerOutput(out)).toEqual({
      cookies: [{ name: "a", value: "b", domain: ".x", path: "/", expires: -1 }],
    });
  });
  it("passes errors through with their name", () => {
    expect(parseWorkerOutput('{"error":"nope","name":"NoBrowserError"}\n')).toEqual({
      error: "nope",
      name: "NoBrowserError",
    });
    expect(parseWorkerOutput("garbage\n")).toBeNull();
    expect(parseWorkerOutput("")).toBeNull();
  });
});

describe("parseCookieInput", () => {
  const M = "mellon-student.cs.uwaterloo.ca";
  it("accepts the forms devtools hands out", () => {
    expect(parseCookieInput("abc123")).toEqual([[M, "abc123"]]);
    expect(parseCookieInput(`${M}=abc123`)).toEqual([[M, "abc123"]]);
    expect(parseCookieInput('"abc123"')).toEqual([[M, "abc123"]]);
    expect(parseCookieInput(`Cookie: ${M}=abc; student.cs.uwaterloo.ca_haproxy_cookie=srv2`)).toEqual([
      [M, "abc"],
      ["student.cs.uwaterloo.ca_haproxy_cookie", "srv2"],
    ]);
    expect(parseCookieInput("a=1; b=2;")).toEqual([
      ["a", "1"],
      ["b", "2"],
    ]);
  });
  it("rejects nothing and whitespace", () => {
    expect(() => parseCookieInput("")).toThrow();
    expect(() => parseCookieInput("a b")).toThrow();
    expect(() => parseCookieInput("a=1; b")).toThrow(/Cookie header/);
  });
});
