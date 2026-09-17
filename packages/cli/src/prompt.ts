import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { parseUserIds } from "@george-tools/core";

export async function askUserIds(): Promise<string[]> {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    for (;;) {
      const answer = await rl.question("WatIAM user id(s) for your group (one or two, comma separated): ");
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
