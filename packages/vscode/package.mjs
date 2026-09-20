// Packages the extension as a .vsix. The extension's runtime dependency
// (puppeteer-core) is hoisted to the monorepo root, which vsce cannot see,
// so the extension is staged in a plain folder and its dependencies installed
// there before vsce runs.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const stage = path.join(here, "stage");
const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: "inherit" });

run("npm run build", here);

rmSync(stage, { recursive: true, force: true });
mkdirSync(stage);

const pkg = JSON.parse(readFileSync(path.join(here, "package.json"), "utf8"));
delete pkg.devDependencies;
delete pkg.scripts;
delete pkg.private;
writeFileSync(path.join(stage, "package.json"), JSON.stringify(pkg, null, 2));

for (const f of ["README.md", "LICENSE", "language-configuration.json", "syntaxes", "media", "dist"]) {
  cpSync(path.join(here, f), path.join(stage, f), { recursive: true });
}
writeFileSync(path.join(stage, ".vscodeignore"), "**/*.map\n");

run("npm install --omit=dev --ignore-scripts --no-package-lock --no-audit --no-fund", stage);
const out = path.join(here, `${pkg.name}-${pkg.version}.vsix`);
run(`npx --yes @vscode/vsce package --allow-missing-repository -o "${out}"`, stage);
console.log(`\nPackaged ${out}`);
