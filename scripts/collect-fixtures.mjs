// Posts every fixtures/replies/*.grg to george and stores the reply next to it.
// Run: npm run fixtures            (all)
//      npm run fixtures -- nd_pass (one)
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const CHECK_URL =
  "https://student.cs.uwaterloo.ca/~se212/george/ask-george/cgi-bin/george.cgi/check";
const dir = new URL("../fixtures/replies/", import.meta.url);
const only = process.argv[2];

const names = (await readdir(dir))
  .filter((n) => n.endsWith(".grg"))
  .filter((n) => !only || n.startsWith(only));

for (const name of names) {
  const text = await readFile(new URL(name, dir), "utf8");
  const res = await fetch(CHECK_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: text,
  });
  const reply = await res.text();
  const out = name.replace(/\.grg$/, ".reply.txt");
  await writeFile(new URL(out, dir), reply);
  console.log(`${res.status} ${name} -> ${out} (${reply.length} bytes)`);
  await new Promise((r) => setTimeout(r, 300));
}
