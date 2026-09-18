import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { parseUserIds } from "@george-tools/core";

export async function askUserIds(): Promise<string[]> {
  if (!stdin.isTTY) {
    throw new Error("No user ids saved and no terminal to ask on. Run: george config --users id1,id2");
  }
  const rl = readline.createInterface({ input: stdin, output: stdout });
  // Ctrl+D or a closed stdin: stop asking instead of looping or exiting quietly.
  const closed = new Promise<never>((_, reject) => {
    rl.once("close", () => reject(new Error("No user ids entered. Run: george config --users id1,id2")));
  });
  try {
    for (;;) {
      const answer = await Promise.race([
        rl.question("WatIAM user id(s) for your group (one or two, comma separated): "),
        closed,
      ]);
      try {
        return parseUserIds(answer);
      } catch (err) {
        console.error((err as Error).message);
      }
    }
  } finally {
    rl.close();
  }
}
