// Bundles the CLI and the core library into one file so `npm i -g george-tools`
// needs nothing but its declared dependencies. login-worker.js is bundled
// beside it: on WSL, core runs that file under Windows Node.js.
import { build } from "esbuild";

await build({
  entryPoints: { george: "src/index.ts", "login-worker": "../core/dist/login-worker.js" },
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outdir: "dist",
  banner: { js: "#!/usr/bin/env node" },
  external: ["commander", "puppeteer-core"],
  sourcemap: true,
});
