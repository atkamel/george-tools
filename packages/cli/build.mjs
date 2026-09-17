// Bundles the CLI and the core library into one file so `npm i -g george-tools`
// needs nothing but its declared dependencies.
import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  outfile: "dist/george.js",
  banner: { js: "#!/usr/bin/env node" },
  external: ["commander", "playwright-core"],
  sourcemap: true,
});
