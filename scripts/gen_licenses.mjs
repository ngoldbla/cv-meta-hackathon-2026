// Writes lowkey/app/lib/licenses.json: every direct dependency of the app,
// with the version and licence from its installed package.json (task 044).
//   node scripts/gen_licenses.mjs        (after `npm ci` in lowkey/app)
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const app = join(import.meta.dirname, "..", "lowkey", "app");
const pkg = JSON.parse(readFileSync(join(app, "package.json"), "utf8"));
const names = Object.keys({ ...pkg.dependencies }).sort();
const out = names.map((name) => {
  const p = JSON.parse(readFileSync(join(app, "node_modules", name, "package.json"), "utf8"));
  const license = typeof p.license === "string" ? p.license : p.license?.type ?? "see package";
  const repo = typeof p.repository === "string" ? p.repository : p.repository?.url ?? null;
  return { name, version: p.version, license, homepage: p.homepage ?? (repo ? repo.replace(/^git\+/, "").replace(/\.git$/, "") : null) };
});
writeFileSync(join(app, "lib", "licenses.json"), JSON.stringify(out, null, 1) + "\n");
console.log(`wrote ${out.length} packages`);
