import { build } from "esbuild";

await build({
  // login-worker.js runs under Windows Node.js when the extension host is WSL.
  entryPoints: { extension: "src/extension.ts", "login-worker": "../core/dist/login-worker.js" },
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  outdir: "dist",
  external: ["vscode", "puppeteer-core"],
  sourcemap: true,
});
